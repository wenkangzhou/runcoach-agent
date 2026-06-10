/**
 * Workflow 版 Agent 入口
 * Day 6: 节点式工作流编排
 */

import { createWorkflowState } from "./workflow/types.js";
import { registerAllNodes } from "./workflow/nodes.js";
import { runWorkflow, findNode } from "./workflow/engine.js";
import { addRun } from "./memory/store.js";
import { autoUpdateProfile } from "./memory/update.js";
import type { RunLog } from "./core/types.js";

/** 运行 Workflow Agent */
export async function runWorkflowAgent(userInput: string): Promise<{
  answer: string;
  toolCalls: { tool: string; result: unknown; error?: string }[];
  iterations: number;
  nodeHistory: string[];
  memoryUpdate?: string;
}> {
  // 注册所有节点
  registerAllNodes();

  // 创建初始状态
  const state = createWorkflowState(userInput);

  console.log("=".repeat(50));
  console.log("🏃 RunCoach Agent v0.2 - Workflow 编排模式");
  console.log("=".repeat(50));

  // 找到起始节点
  const startNode = findNode("InputNode");
  if (!startNode) {
    throw new Error("InputNode 未注册");
  }

  // 执行工作流
  const finalState = await runWorkflow(startNode, state);

  // 收尾：保存训练记录
  let memoryUpdate = "";
  if (finalState.parsedRun?.isValid) {
    const run: RunLog = {
      date: new Date().toISOString().split("T")[0],
      distance: finalState.parsedRun.distance || 0,
      pace: finalState.parsedRun.pace || "-",
      hr: finalState.parsedRun.hr || undefined,
      feeling: finalState.parsedRun.feeling || "-",
      notes: userInput.slice(0, 100),
    };
    await addRun(run);
    memoryUpdate += `\n📝 已保存训练记录: ${run.distance}km @ ${run.pace}`;
  }

  // 自动更新 profile
  const update = await autoUpdateProfile(userInput);
  if (update.hasUpdate) {
    memoryUpdate += `\n${update.message}`;
  }

  return {
    answer: finalState.finalAnswer,
    toolCalls: finalState.toolCalls.map((tc) => ({
      tool: tc.tool,
      result: tc.result,
      error: tc.error,
    })),
    iterations: finalState.iteration,
    nodeHistory: finalState.nodeHistory,
    memoryUpdate,
  };
}
