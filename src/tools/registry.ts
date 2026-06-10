/**
 * 工具注册表
 * Day 2: 学会 Tool Calling，这是 Agent 的地基
 */

import type { RegisteredTool, ToolResult } from "../core/types.js";
import { getWeatherTool } from "./weather.js";
import { calculateTool, parseRunLogTool } from "./training.js";

import { suggestNextWorkoutTool } from "./coach.js";
import { retrieveKnowledgeTool } from "./rag.js";

/** 所有可用工具 */
export const tools: RegisteredTool[] = [
  getWeatherTool,
  calculateTool,
  parseRunLogTool,
  suggestNextWorkoutTool,
  retrieveKnowledgeTool,
];

/** 获取工具描述列表（给 LLM 看） */
export function getToolDescriptions() {
  return tools.map((t) => t.description);
}

/** 执行工具调用 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const tool = tools.find((t) => t.description.name === toolName);

  if (!tool) {
    return {
      tool: toolName,
      args,
      result: null,
      error: `工具 "${toolName}" 不存在。可用工具: ${tools.map((t) => t.description.name).join(", ")}`,
    };
  }

  try {
    const result = await tool.execute(args);
    return { tool: toolName, args, result };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { tool: toolName, args, result: null, error };
  }
}
