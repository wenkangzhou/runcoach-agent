/**
 * Multi-Agent 协作类型
 * Day 7: 多角色协作
 *
 * 角色分工:
 * - ProductAgent: 提取用户真实诉求
 * - TrainingAgent: 生成训练方案
 * - RiskAgent: 审查伤病/过度训练风险
 * - ExpressionAgent: 把方案改写成人话
 */

import type { ToolResult } from "../core/types.js";

/** Agent 角色 */
export type AgentRole = "product" | "training" | "risk" | "expression";

/** Agent 消息 */
export interface AgentMessage {
  role: AgentRole;
  content: string;
  type: "analysis" | "proposal" | "objection" | "revision" | "output";
  metadata?: Record<string, unknown>;
}

/** 多 Agent 会话状态 */
export interface MultiAgentState {
  userInput: string;
  messages: AgentMessage[];
  finalOutput: string;
  toolCalls: ToolResult[];
  iteration: number;
  maxIterations: number;
  isComplete: boolean;
}

/** 创建初始状态 */
export function createMultiAgentState(userInput: string): MultiAgentState {
  return {
    userInput,
    messages: [],
    finalOutput: "",
    toolCalls: [],
    iteration: 0,
    maxIterations: 8,
    isComplete: false,
  };
}
