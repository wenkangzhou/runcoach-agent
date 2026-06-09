/**
 * RunCoach Agent - 核心类型定义
 * Day 1: 先搞清楚 Agent 到底是什么
 *
 * Agent = LLM + 工具 + 状态 + 决策循环 + 约束 + 评估
 */

// ========== 工具系统 ==========

/** 工具参数定义 */
export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  required?: boolean;
  enum?: string[];
}

/** 工具描述 (给 LLM 看的) */
export interface ToolDescription {
  name: string;
  description: string;
  parameters: ToolParameter[];
}

/** 工具调用请求 (LLM 输出) */
export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}

/** 工具执行结果 */
export interface ToolResult {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
  error?: string;
}

/** 工具函数签名 */
export type ToolFunction = (args: Record<string, unknown>) => Promise<unknown> | unknown;

/** 注册的工具 */
export interface RegisteredTool {
  description: ToolDescription;
  execute: ToolFunction;
}

// ========== Agent 循环 ==========

/** LLM 的下一步决策 */
export type NextAction =
  | { type: "tool"; toolCall: ToolCall }
  | { type: "answer"; content: string }
  | { type: "clarify"; question: string };

/** 对话消息 */
export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
}

/** Agent 上下文/状态 */
export interface AgentContext {
  messages: Message[];
  memory: MemoryState;
  iteration: number;
  maxIterations: number;
}

// ========== 记忆系统 ==========

/** 用户长期画像 */
export interface UserProfile {
  goal: string;           // 例如: "全马 3:20-3:25"
  weeklyMileage: string;  // 例如: "150-200km/month"
  availableTime: string;  // 例如: "weekday morning or late night"
  issues: string[];     // 例如: ["30km cramp", "calf tightness"]
  preferredPace?: string;
  experience?: string;
}

/** 单次跑步记录 */
export interface RunLog {
  date: string;
  distance: number;      // km
  pace: string;          // 例如: "5:40"
  hr?: number;           // 平均心率
  feeling: string;       // 主观感受
  notes?: string;
}

/** 记忆状态 */
export interface MemoryState {
  profile: UserProfile;
  recentRuns: RunLog[];
}

// ========== 配置 ==========

export interface AgentConfig {
  model: string;
  temperature: number;
  maxIterations: number;
  systemPrompt: string;
}
