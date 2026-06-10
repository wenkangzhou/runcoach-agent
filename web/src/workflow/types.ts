/**
 * Workflow 编排核心类型
 * Day 6: 把 Agent 逻辑拆成节点式工作流
 *
 * 节点设计:
 * InputNode → ParseRunNode → RiskCheckNode → PlanNode → ReviewNode → OutputNode
 */

import type { ToolResult } from "../core/types.js";

/** 工作流节点 */
export interface WorkflowNode {
  name: string;
  description: string;
  execute: (state: WorkflowState) => Promise<WorkflowState>;
  // 条件跳转: 返回下一个节点名，或 null 表示结束
  next: (state: WorkflowState) => string | null;
}

/** 工作流状态（跨节点共享） */
export interface WorkflowState {
  // 输入
  userInput: string;
  queryType: string;

  // 解析结果
  parsedRun: {
    distance: number | null;
    pace: string | null;
    hr: number | null;
    feeling: string | null;
    bodySignal: string | null;
    isValid: boolean;
  } | null;

  // 风险评估
  riskAssessment: {
    hasFatigue: boolean;
    hasInjuryRisk: boolean;
    weeklyDistance: number;
    riskLevel: "low" | "medium" | "high";
    warning: string;
  } | null;

  // 计划生成
  recommendation: {
    type: string;
    duration: string;
    distance: string;
    paceZone: string;
    hrZone: string;
    reason: string;
    alternative: string;
    warning?: string;
  } | null;

  // 审查结果
  review: {
    approved: boolean;
    concerns: string[];
    modifications: string[];
  } | null;

  // 输出
  finalAnswer: string;

  // 元数据
  toolCalls: ToolResult[];
  nodeHistory: string[];
  iteration: number;
  maxIterations: number;
}

/** 创建初始状态 */
export function createWorkflowState(userInput: string): WorkflowState {
  return {
    userInput,
    queryType: "general",
    parsedRun: null,
    riskAssessment: null,
    recommendation: null,
    review: null,
    finalAnswer: "",
    toolCalls: [],
    nodeHistory: [],
    iteration: 0,
    maxIterations: 10,
  };
}
