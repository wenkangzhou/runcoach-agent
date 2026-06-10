/**
 * Multi-Agent 角色实现
 * Day 7: 4 个角色的具体逻辑
 */

import { executeTool } from "../tools/registry.js";
import { loadMemory } from "../memory/store.js";
import { retrieveDocuments, shouldRetrieve } from "../rag/retriever.js";
import type { AgentRole, AgentMessage, MultiAgentState } from "./types.js";

/** Agent 基类 */
export abstract class BaseAgent {
  abstract role: AgentRole;
  abstract name: string;
  abstract description: string;

  /** 执行 Agent 任务 */
  abstract execute(state: MultiAgentState): Promise<AgentMessage>;

  /** 判断该 Agent 是否应该参与 */
  abstract shouldParticipate(state: MultiAgentState): boolean;
}

// ========== 产品 Agent：提取真实诉求 ==========

export class ProductAgent extends BaseAgent {
  role: AgentRole = "product";
  name = "产品 Agent";
  description = "理解用户输入，提取真实诉求、约束条件和隐含需求";

  shouldParticipate(): boolean {
    return true; // 总是第一个参与
  }

  async execute(state: MultiAgentState): Promise<AgentMessage> {
    const text = state.userInput.toLowerCase();
    const memory = await loadMemory();

    // 提取诉求
    let intent = "general";
    if (text.includes("明天") || text.includes("怎么跑") || text.includes("安排")) {
      intent = "next_workout";
    } else if (text.includes("计划") || text.includes("课表")) {
      intent = "training_plan";
    } else if (text.includes("伤") || text.includes("痛") || text.includes("恢复")) {
      intent = "injury_concern";
    } else if (text.includes("补给") || text.includes("胶") || text.includes("吃")) {
      intent = "fueling_question";
    } else if (text.includes("心率") || text.includes("区间")) {
      intent = "knowledge_question";
    }

    // 提取约束
    const constraints: string[] = [];
    if (text.includes("时间") || text.includes("分钟")) {
      const timeMatch = state.userInput.match(/(\d+)\s*分钟/);
      if (timeMatch) constraints.push(`时间限制: ${timeMatch[1]}分钟`);
    }
    if (text.includes("只能") || text.includes("只能跑")) {
      constraints.push("用户有明确限制");
    }
    if (memory.profile.issues.length > 0) {
      constraints.push(`已知伤病: ${memory.profile.issues.join(", ")}`);
    }

    // 提取隐含需求
    const implicitNeeds: string[] = [];
    if (text.includes("pb") || text.includes("冲") || text.includes("破")) {
      implicitNeeds.push("用户有成绩突破诉求，可能需要强度训练");
    }
    if (text.includes("累") || text.includes("疲劳") || text.includes("酸")) {
      implicitNeeds.push("用户可能有恢复需求，不应推荐高强度");
    }

    const content = `【诉求分析】
意图: ${intent}
约束: ${constraints.length ? constraints.join("; ") : "无"}
隐含需求: ${implicitNeeds.length ? implicitNeeds.join("; ") : "无"}`;

    return {
      role: "product",
      content,
      type: "analysis",
      metadata: { intent, constraints, implicitNeeds },
    };
  }
}

// ========== 训练 Agent：生成方案 ==========

export class TrainingAgent extends BaseAgent {
  role: AgentRole = "training";
  name = "训练 Agent";
  description = "基于用户诉求和记忆，生成具体训练建议";

  shouldParticipate(state: MultiAgentState): boolean {
    // 只有产品 Agent 分析完后才参与
    return state.messages.some((m) => m.role === "product");
  }

  async execute(state: MultiAgentState): Promise<AgentMessage> {
    const productMsg = state.messages.find((m) => m.role === "product");
    const intent = (productMsg?.metadata?.intent as string) || "general";

    // 检查是否是修正请求（风控反对后）
    const lastRisk = state.messages.filter((m) => m.role === "risk").pop();
    const isRevision = lastRisk && lastRisk.metadata?.approved === false;

    // 如果是知识库问题，调用 RAG
    if (intent === "fueling_question" || intent === "knowledge_question") {
      if (shouldRetrieve(state.userInput)) {
        const result = await executeTool("retrieveKnowledge", { query: state.userInput });
        state.toolCalls.push(result);
        return {
          role: "training",
          content: `【训练 Agent ${isRevision ? "修正" : "方案"}】\n基于知识库检索回答:\n${(result.result as any)?.context || "无检索结果"}`,
          type: isRevision ? "revision" : "proposal",
        };
      }
    }

    // 如果是训练建议，调用 suggestNextWorkout
    if (intent === "next_workout" || intent === "training_plan") {
      // 先解析跑步数据
      const parseResult = await executeTool("parseRunLog", { text: state.userInput });
      state.toolCalls.push(parseResult);

      const data = parseResult.result as Record<string, unknown>;
      const extracted = data.extracted as Record<string, unknown> || {};

      if (data.isValid) {
        const suggestResult = await executeTool("suggestNextWorkout", {
          todayRun: extracted,
          question: state.userInput,
        });
        state.toolCalls.push(suggestResult);

        const rec = (suggestResult.result as any)?.recommendation;
        if (rec) {
          return {
            role: "training",
            content: `【训练 Agent ${isRevision ? "修正" : "方案"}】\n类型: ${rec.type}\n距离: ${rec.distance}\n配速: ${rec.paceZone}\n心率: ${rec.hrZone}\n原因: ${rec.reason}\n替代: ${rec.alternative}`,
            type: isRevision ? "revision" : "proposal",
            metadata: { recommendation: rec },
          };
        }
      }
    }

    // 默认回复
    return {
      role: "training",
      content: `【训练 Agent ${isRevision ? "修正" : "方案"}】\n请提供更多跑步数据（距离、配速、感受），我才能给出具体建议。`,
      type: isRevision ? "revision" : "proposal",
    };
  }
}

// ========== 风控 Agent：挑刺 ==========

export class RiskAgent extends BaseAgent {
  role: AgentRole = "risk";
  name = "风控 Agent";
  description = "审查训练方案是否存在伤病风险或过度训练";

  shouldParticipate(state: MultiAgentState): boolean {
    // 只对训练建议类方案进行审查
    const productMsg = state.messages.find((m) => m.role === "product");
    const intent = (productMsg?.metadata?.intent as string) || "general";
    // 知识库问题不需要风控审查
    if (intent === "fueling_question" || intent === "knowledge_question") {
      return false;
    }
    // 训练 Agent 给出方案后才参与
    return state.messages.some((m) => m.role === "training" && m.type === "proposal");
  }

  async execute(state: MultiAgentState): Promise<AgentMessage> {
    const trainingMsg = state.messages.find((m) => m.role === "training" && m.type === "proposal");
    const rec = trainingMsg?.metadata?.recommendation as Record<string, string> | undefined;
    const memory = await loadMemory();

    const objections: string[] = [];
    const severity: ("low" | "medium" | "high")[] = [];

    if (!rec) {
      return {
        role: "risk",
        content: "【风控 Agent 审查】\n无具体方案可审查。",
        type: "objection",
      };
    }

    // 审查规则 1: 伤病史 + 强度训练
    if (memory.profile.issues.length > 0) {
      const intensityTypes = ["阈值跑", "间歇", "节奏跑", "高强度"];
      if (intensityTypes.some((t) => rec.type.includes(t))) {
        objections.push(`用户有伤病史（${memory.profile.issues.join(", ")}），建议避免 ${rec.type}`);
        severity.push("high");
      }
    }

    // 审查规则 2: 疲劳信号 + 不休息
    const userText = state.userInput.toLowerCase();
    const fatigueSignals = ["累", "疲劳", "酸", "痛", "紧"];
    const hasFatigue = fatigueSignals.some((s) => userText.includes(s));
    if (hasFatigue && !rec.type.includes("恢复") && !rec.type.includes("休息")) {
      objections.push(`用户有疲劳信号，但方案是"${rec.type}"，建议改为恢复跑或休息`);
      severity.push("high");
    }

    // 审查规则 3: 周跑量检查
    const weekDistance = (trainingMsg?.metadata?.weeklyDistance as number) || 0;
    if (weekDistance > 60 && rec.distance.includes("10")) {
      objections.push(`本周跑量已超 60km，建议距离应减至 5-8km`);
      severity.push("medium");
    }

    // 审查规则 4: 配速合理性
    if (rec.paceZone.includes("快") && hasFatigue) {
      objections.push("疲劳状态下不应建议快配速");
      severity.push("medium");
    }

    const hasHighRisk = severity.includes("high");
    const hasMediumRisk = severity.includes("medium");

    if (objections.length === 0) {
      return {
        role: "risk",
        content: "【风控 Agent 审查】\n✅ 方案通过审查，无明显风险。",
        type: "objection",
        metadata: { approved: true },
      };
    }

    return {
      role: "risk",
      content: `【风控 Agent 审查】\n${hasHighRisk ? "🔴 高风险反对" : hasMediumRisk ? "🟡 中风险提醒" : "🟢 低风险建议"}\n\n反对意见:\n${objections.map((o, i) => `${i + 1}. ${o}`).join("\n")}`,
      type: "objection",
      metadata: { approved: false, objections, severity },
    };
  }
}

// ========== 表达 Agent：改写人话 ==========

export class ExpressionAgent extends BaseAgent {
  role: AgentRole = "expression";
  name = "表达 Agent";
  description = "把技术方案改写得更自然、更像人话";

  shouldParticipate(state: MultiAgentState): boolean {
    // 情况 1: 有风控通过或修正
    const riskMsgs = state.messages.filter((m) => m.role === "risk");
    if (riskMsgs.length > 0) {
      const lastRisk = riskMsgs[riskMsgs.length - 1];
      if (lastRisk.metadata?.approved === true) return true;
      if (state.messages.some((m) => m.role === "training" && m.type === "revision")) return true;
    }
    // 情况 2: 知识库问题（没有风控，但有 training proposal）
    const productMsg = state.messages.find((m) => m.role === "product");
    const intent = (productMsg?.metadata?.intent as string) || "general";
    const isKnowledgeQuery = intent === "fueling_question" || intent === "knowledge_question";
    const hasTraining = state.messages.some((m) => m.role === "training");
    if (isKnowledgeQuery && hasTraining) return true;

    return false;
  }

  async execute(state: MultiAgentState): Promise<AgentMessage> {
    // 收集所有相关消息
    const trainingMsgs = state.messages.filter((m) => m.role === "training");
    const riskMsgs = state.messages.filter((m) => m.role === "risk");

    const finalTraining = trainingMsgs[trainingMsgs.length - 1];
    const rec = finalTraining?.metadata?.recommendation as Record<string, string> | undefined;

    // 情况 1: 知识库回答（没有 recommendation）
    if (!rec) {
      const content = finalTraining?.content || state.userInput;
      // 提取知识库内容（去掉前缀）
      const cleanContent = content.replace(/【训练 Agent.*?】\n/, "").trim();
      return {
        role: "expression",
        content: `【RunCoach 知识库回答】\n\n${cleanContent}`,
        type: "output",
      };
    }

    // 格式化输出
    let output = `【RunCoach 训练建议】

📋 明日安排: ${rec.type}
⏱️ 时长: ${rec.duration} | 📏 距离: ${rec.distance}
🎯 配速区间: ${rec.paceZone}
❤️ 心率区间: ${rec.hrZone}

💡 原因:
${rec.reason}

🔄 替代方案:
${rec.alternative}`;

    // 如果有风控反对但最终通过，加上提醒
    const riskObj = riskMsgs.find((m) => m.metadata?.approved === false);
    if (riskObj && finalTraining.type === "revision") {
      output += `\n\n⚠️ 风控提醒: 原方案有风险，已根据审查意见调整。如有不适请立即停止。`;
    }

    return {
      role: "expression",
      content: output,
      type: "output",
    };
  }
}
