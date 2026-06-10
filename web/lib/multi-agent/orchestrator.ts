/**
 * Multi-Agent 编排器
 * Day 7: 管理 4 个 Agent 的协作流程
 *
 * 流程:
 * 用户输入
 *   ↓
 * ProductAgent: 提取诉求
 *   ↓
 * TrainingAgent: 生成方案
 *   ↓
 * RiskAgent: 审查风险
 *   ↓
 *   ├─ 通过 → ExpressionAgent: 输出
 *   └─ 不通过 → TrainingAgent: 修正 → RiskAgent: 再审 → ...
 */

import type { MultiAgentState, AgentMessage } from "./types.js";
import { createMultiAgentState } from "./types.js";
import {
  BaseAgent,
  ProductAgent,
  TrainingAgent,
  RiskAgent,
  ExpressionAgent,
} from "./agents.js";
import { addRun } from "../memory/store.js";
import { autoUpdateProfile } from "../memory/update.js";
import type { RunLog } from "../core/types.js";

/** 所有 Agent 实例 */
const agents: BaseAgent[] = [
  new ProductAgent(),
  new TrainingAgent(),
  new RiskAgent(),
  new ExpressionAgent(),
];

/** 按轮次选择下一个 Agent */
function selectNextAgent(state: MultiAgentState): BaseAgent | null {
  const hasProduct = state.messages.some((m) => m.role === "product");
  const hasTrainingProposal = state.messages.some((m) => m.role === "training" && m.type === "proposal");
  const hasTrainingRevision = state.messages.some((m) => m.role === "training" && m.type === "revision");
  const hasRisk = state.messages.some((m) => m.role === "risk");
  const hasExpression = state.messages.some((m) => m.role === "expression");

  // 获取意图
  const productMsg = state.messages.find((m) => m.role === "product");
  const intent = (productMsg?.metadata?.intent as string) || "general";
  const isKnowledgeQuery = intent === "fueling_question" || intent === "knowledge_question";

  // 1. 还没有产品分析 → ProductAgent
  if (!hasProduct) {
    return agents[0]; // ProductAgent
  }

  // 2. 已有产品分析，还没有训练方案 → TrainingAgent
  if (!hasTrainingProposal) {
    return agents[1]; // TrainingAgent
  }

  // 3. 知识库问题：跳过风控，直接到表达
  if (isKnowledgeQuery && !hasExpression) {
    return agents[3]; // ExpressionAgent
  }

  // 4. 已有训练方案，还没有风控审查 → RiskAgent
  if (!hasRisk) {
    return agents[2]; // RiskAgent
  }

  // 5. 已有风控审查
  const lastRisk = state.messages.filter((m) => m.role === "risk").pop();
  const riskApproved = lastRisk?.metadata?.approved === true;

  if (riskApproved) {
    // 风控通过 → ExpressionAgent
    if (!hasExpression) {
      return agents[3]; // ExpressionAgent
    }
  } else {
    // 风控反对
    if (!hasTrainingRevision) {
      // 还没有修正 → TrainingAgent 修正
      return agents[1]; // TrainingAgent
    } else {
      // 已修正过 → ExpressionAgent（带上风险提示）
      if (!hasExpression) {
        return agents[3]; // ExpressionAgent
      }
    }
  }

  return null;
}

/** 运行 Multi-Agent 协作 */
export async function runMultiAgent(userInput: string): Promise<{
  answer: string;
  toolCalls: { tool: string; result: unknown; error?: string }[];
  iterations: number;
  agentHistory: string[];
  memoryUpdate?: string;
}> {
  const state = createMultiAgentState(userInput);

  console.log("=".repeat(50));
  console.log("🏃 RunCoach Agent v0.3 - Multi-Agent 协作模式");
  console.log("=".repeat(50));
  console.log(`\n🎭 角色: Product | Training | Risk | Expression`);
  console.log(`-`.repeat(40));

  // 协作循环
  while (state.iteration < state.maxIterations && !state.isComplete) {
    state.iteration++;

    // 按轮次调度 Agent
    const activeAgent = selectNextAgent(state);

    if (!activeAgent) {
      console.log(`\n⚠️ 没有 Agent 愿意参与，结束协作`);
      break;
    }

    console.log(`\n🎭 回合 ${state.iteration}: ${activeAgent.name}`);
    console.log(`   ${activeAgent.description}`);

    // 执行 Agent
    const message = await activeAgent.execute(state);
    state.messages.push(message);

    // 打印结果摘要
    const summary = message.content.split("\n")[0].slice(0, 80);
    console.log(`   → ${summary}...`);

    // 检查是否完成
    if (activeAgent instanceof ExpressionAgent) {
      state.isComplete = true;
      state.finalOutput = message.content;
    }
  }

  if (state.iteration >= state.maxIterations) {
    state.finalOutput = "Multi-Agent 协作次数过多，请简化问题。";
  }

  // 收尾：保存训练记录
  let memoryUpdate = "";
  const parseToolCall = state.toolCalls.find((tc) => tc.tool === "parseRunLog");
  if (parseToolCall && !parseToolCall.error) {
    const data = parseToolCall.result as Record<string, unknown>;
    const extracted = data.extracted as Record<string, unknown> || {};
    if (data.isValid) {
      const run: RunLog = {
        date: new Date().toISOString().split("T")[0],
        distance: Number(extracted.distance || 0),
        pace: String(extracted.pace || "-"),
        hr: extracted.hr ? Number(extracted.hr) : undefined,
        feeling: String(extracted.feeling || "-"),
        notes: userInput.slice(0, 100),
      };
      await addRun(run);
      memoryUpdate += `\n📝 已保存训练记录: ${run.distance}km @ ${run.pace}`;
    }
  }

  // 自动更新 profile
  const update = await autoUpdateProfile(userInput);
  if (update.hasUpdate) {
    memoryUpdate += `\n${update.message}`;
  }

  return {
    answer: state.finalOutput || "未能生成回答。",
    toolCalls: state.toolCalls.map((tc) => ({
      tool: tc.tool,
      result: tc.result,
      error: tc.error,
    })),
    iterations: state.iteration,
    agentHistory: state.messages.map((m) => `${m.role}(${m.type})`),
    memoryUpdate,
  };
}
