/**
 * Workflow 节点实现
 * Day 6: 6 个节点的具体逻辑
 */

import { executeTool } from "../tools/registry.js";
import { loadMemory } from "../memory/store.js";
import { retrieveDocuments, formatRetrievalContext, shouldRetrieve } from "../rag/retriever.js";
import { registerNode } from "./engine.js";
import type { WorkflowNode, WorkflowState } from "./types.js";

// ========== 节点 1: 输入解析 ==========

const inputNode: WorkflowNode = {
  name: "InputNode",
  description: "解析用户输入，判断问题类型，初始化上下文",
  execute: async (state) => {
    const text = state.userInput.toLowerCase();

    // 判断问题类型
    if (text.includes("明天") || text.includes("怎么跑") || text.includes("安排")) {
      state.queryType = "next_workout";
    } else if (text.includes("这周") || text.includes("本周")) {
      state.queryType = "weekly_review";
    } else if (text.includes("心率") || text.includes("区间") || text.includes("zone")) {
      state.queryType = "knowledge_zones";
    } else if (text.includes("胶") || text.includes("补给") || text.includes("吃")) {
      state.queryType = "knowledge_fueling";
    } else if (text.includes("伤") || text.includes("痛") || text.includes("膝盖") || text.includes("小腿")) {
      state.queryType = "knowledge_injury";
    } else {
      state.queryType = "general";
    }

    console.log(`   问题类型: ${state.queryType}`);
    return state;
  },
  next: (state) => {
    // 知识库问题直接走 RAG → Output
    if (state.queryType.startsWith("knowledge_")) {
      return "RAGNode";
    }
    // 训练建议问题：如果有跑步数据，先解析
    const hasRunData = /\d+\s*(km|公里)/.test(state.userInput) &&
      (state.userInput.includes("配速") || state.userInput.includes("跑了"));
    return hasRunData ? "ParseRunNode" : "RiskCheckNode";
  },
};

// ========== 节点 2: 跑步数据解析 ==========

const parseRunNode: WorkflowNode = {
  name: "ParseRunNode",
  description: "从自然语言中提取结构化跑步数据",
  execute: async (state) => {
    const result = await executeTool("parseRunLog", { text: state.userInput });
    state.toolCalls.push(result);

    if (result.error || !result.result) {
      console.log(`   ❌ 解析失败: ${result.error || "未知错误"}`);
      state.parsedRun = { distance: null, pace: null, hr: null, feeling: null, bodySignal: null, isValid: false };
      return state;
    }

    const data = result.result as Record<string, unknown>;
    const extracted = data.extracted as Record<string, unknown> || {};

    state.parsedRun = {
      distance: extracted.distance ? Number(extracted.distance) : null,
      pace: extracted.pace ? String(extracted.pace) : null,
      hr: extracted.hr ? Number(extracted.hr) : null,
      feeling: extracted.feeling ? String(extracted.feeling) : null,
      bodySignal: extracted.bodySignal ? String(extracted.bodySignal) : null,
      isValid: Boolean(data.isValid),
    };

    console.log(`   ✅ 提取: ${state.parsedRun.distance}km, 配速${state.parsedRun.pace}, 感受:${state.parsedRun.feeling}`);
    return state;
  },
  next: () => "RiskCheckNode",
};

// ========== 节点 3: 风险评估 ==========

const riskCheckNode: WorkflowNode = {
  name: "RiskCheckNode",
  description: "综合评估伤病风险和疲劳状态",
  execute: async (state) => {
    const memory = loadMemory();
    const { profile, recentRuns } = memory;

    // 计算本周跑量
    const today = new Date();
    const weekRuns = recentRuns.filter((r) => {
      const d = new Date(r.date);
      const diff = (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    });
    const weeklyDistance = weekRuns.reduce((s, r) => s + r.distance, 0) +
      (state.parsedRun?.distance || 0);

    // 判断疲劳
    const fatigueSignals = ["累", "疲劳", "酸", "痛", "紧", "tired", "sore", "pain", "tight"];
    const feeling = (state.parsedRun?.feeling || "") + " " + (state.parsedRun?.bodySignal || "");
    const hasFatigue = fatigueSignals.some((s) => feeling.toLowerCase().includes(s));

    // 判断伤病风险
    const injuryKeywords = profile.issues.flatMap((issue) => {
      const map: Record<string, string[]> = {
        "30km cramp": ["抽筋", "cramp"],
        "calf tightness": ["小腿", "calf", "紧"],
        "heat sensitive": ["热", "heat"],
      };
      return map[issue] || [issue];
    });
    const hasInjuryRisk = injuryKeywords.some((k) =>
      feeling.toLowerCase().includes(k) || state.userInput.toLowerCase().includes(k)
    );

    // 风险分级
    let riskLevel: "low" | "medium" | "high" = "low";
    let warning = "";

    if (hasFatigue && hasInjuryRisk) {
      riskLevel = "high";
      warning = `高风险：疲劳信号（"${feeling.trim()}"）+ 伤病关注项（${profile.issues.join(", ")}）`;
    } else if (hasFatigue) {
      riskLevel = "medium";
      warning = `中风险：有疲劳信号（"${feeling.trim()}"）`;
    } else if (weeklyDistance > 50) {
      riskLevel = "medium";
      warning = `中风险：本周跑量 ${weeklyDistance}km 偏高`;
    }

    state.riskAssessment = {
      hasFatigue,
      hasInjuryRisk,
      weeklyDistance,
      riskLevel,
      warning,
    };

    console.log(`   风险等级: ${riskLevel.toUpperCase()}${warning ? ` | ${warning}` : ""}`);
    return state;
  },
  next: (state) => {
    // 高风险直接输出警告，跳过计划生成
    if (state.riskAssessment?.riskLevel === "high") {
      return "OutputNode";
    }
    return "PlanNode";
  },
};

// ========== 节点 4: 计划生成 ==========

const planNode: WorkflowNode = {
  name: "PlanNode",
  description: "根据风险评估生成训练建议",
  execute: async (state) => {
    const memory = loadMemory();
    const risk = state.riskAssessment;
    const parsed = state.parsedRun;

    if (!risk) {
      state.recommendation = null;
      return state;
    }

    let rec: WorkflowState["recommendation"];

    if (risk.riskLevel === "medium") {
      rec = {
        type: "恢复跑",
        duration: "30-40 分钟",
        distance: "4-6km",
        paceZone: "比目标配速慢 60-90 秒",
        hrZone: "Z1-Z2（< 最大心率的 70%）",
        reason: risk.warning + "。局部疲劳优先级高于总跑量。",
        alternative: "如果跑 10 分钟后仍感觉疲劳，改为快走或完全休息。",
      };
    } else {
      rec = {
        type: "有氧基础跑",
        duration: "45-60 分钟",
        distance: "8-10km",
        paceZone: "比目标配速慢 30-60 秒",
        hrZone: "Z2（最大心率的 65%-75%）",
        reason: `状态良好，周跑量 ${risk.weeklyDistance}km 在合理范围。适合堆有氧基础。`,
        alternative: "如果时间不够，改为 30 分钟节奏跑（比目标配速慢 15-30 秒）。",
      };
    }

    state.recommendation = rec;
    console.log(`   生成建议: ${rec.type} | ${rec.distance} | ${rec.paceZone}`);
    return state;
  },
  next: () => "ReviewNode",
};

// ========== 节点 5: 审查节点 ==========

const reviewNode: WorkflowNode = {
  name: "ReviewNode",
  description: "自检建议是否过激或不安全",
  execute: async (state) => {
    const rec = state.recommendation;
    const risk = state.riskAssessment;
    const concerns: string[] = [];
    const modifications: string[] = [];

    if (!rec) {
      state.review = { approved: true, concerns: [], modifications: [] };
      return state;
    }

    // 审查规则
    if (risk?.hasInjuryRisk && rec.type !== "休息或交叉训练") {
      concerns.push("用户有伤病信号，但建议不是休息");
      modifications.push("建议改为：休息或交叉训练");
    }

    if (risk?.weeklyDistance > 60 && rec.distance.includes("10")) {
      concerns.push("周跑量已超 60km，建议距离偏大");
      modifications.push("建议减至 5-8km 或休息");
    }

    if (rec.type === "恢复跑" && !rec.reason.includes("恢复")) {
      concerns.push("恢复跑建议缺少恢复相关说明");
    }

    const approved = concerns.length === 0;
    state.review = { approved, concerns, modifications };

    console.log(`   审查结果: ${approved ? "✅ 通过" : "⚠️ 有顾虑"}`);
    if (concerns.length > 0) {
      concerns.forEach((c) => console.log(`     - ${c}`));
    }

    return state;
  },
  next: (state) => {
    // 审查不通过，回到 PlanNode 修正
    if (state.review && !state.review.approved && state.iteration < 3) {
      console.log(`   ↩️ 返回 PlanNode 修正`);
      return "PlanNode";
    }
    return "OutputNode";
  },
};

// ========== 节点 6: RAG 检索节点 ==========

const ragNode: WorkflowNode = {
  name: "RAGNode",
  description: "从知识库检索相关文档",
  execute: async (state) => {
    if (!shouldRetrieve(state.userInput)) {
      return state;
    }

    const results = retrieveDocuments(state.userInput, 3);
    const context = formatRetrievalContext(results);

    // 把检索结果存入状态，供 OutputNode 使用
    state.finalAnswer = context;

    console.log(`   检索到 ${results.length} 条相关文档`);
    return state;
  },
  next: () => "OutputNode",
};

// ========== 节点 7: 输出格式化 ==========

const outputNode: WorkflowNode = {
  name: "OutputNode",
  description: "格式化最终输出",
  execute: async (state) => {
    // 情况 1: 高风险直接警告
    if (state.riskAssessment?.riskLevel === "high") {
      state.finalAnswer = `【RunCoach 警告】

⚠️ ${state.riskAssessment.warning}

📋 明日安排: 休息或交叉训练
⏱️ 时长: 0-30 分钟 | 📏 距离: 0km

💡 原因:
你当前有疲劳或伤病信号，恢复优先于训练。强行训练可能加重伤情。

🔄 替代方案:
游泳、骑车或完全休息。如果必须动，只做 15 分钟拉伸 + 泡沫轴放松。

⚠️ 如果疼痛持续超过 48 小时，建议就医或咨询运动康复师。`;
      return state;
    }

    // 情况 2: 知识库回答
    if (state.queryType.startsWith("knowledge_") && state.finalAnswer) {
      // finalAnswer 已在 RAGNode 中设置为检索结果
      // 这里可以进一步让 LLM 基于检索结果生成回答
      state.finalAnswer = `【RunCoach 知识库回答】\n\n${state.finalAnswer}\n\n（以上为检索到的相关知识，请基于这些内容回答用户问题）`;
      return state;
    }

    // 情况 3: 正常训练建议
    const rec = state.recommendation;
    if (rec) {
      const reviewNote = state.review && !state.review.approved
        ? `\n⚠️ 审查提醒: ${state.review.concerns.join("; ")}\n`
        : "";

      state.finalAnswer = `【RunCoach 训练建议】

📋 明日安排: ${rec.type}
⏱️ 时长: ${rec.duration} | 📏 距离: ${rec.distance}
🎯 配速区间: ${rec.paceZone}
❤️ 心率区间: ${rec.hrZone}

💡 原因:
${rec.reason}

🔄 替代方案:
${rec.alternative}
${rec.warning ? `\n${rec.warning}` : ""}${reviewNote}`;
    } else {
      state.finalAnswer = "【RunCoach】\n\n未能生成训练建议。请提供更多跑步数据（距离、配速、感受）。";
    }

    return state;
  },
  next: () => null, // 结束
};

// ========== 注册所有节点 ==========

export function registerAllNodes(): void {
  registerNode(inputNode);
  registerNode(parseRunNode);
  registerNode(riskCheckNode);
  registerNode(planNode);
  registerNode(reviewNode);
  registerNode(ragNode);
  registerNode(outputNode);
}
