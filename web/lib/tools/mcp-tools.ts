/**
 * MCP 工具封装
 * Day 8: 把 MCP Client 的工具暴露给 Agent
 */

import type { RegisteredTool } from "../core/types.js";
import { RunningMCPClient, getMCPToolDescriptions } from "../mcp/client.js";

/** MCP Client 实例（懒加载） */
let mcpClient: RunningMCPClient | null = null;

/** 初始化 MCP Client */
export async function initMCPClient(mode: "stdio" | "direct" = "direct"): Promise<void> {
  if (!mcpClient) {
    mcpClient = new RunningMCPClient(mode);
    await mcpClient.connect();
  }
}

/** 获取 MCP 工具描述 */
export function getMCPRegisteredTools(): RegisteredTool[] {
  const descriptions = getMCPToolDescriptions();

  return descriptions.map((desc) => ({
    description: {
      name: desc.name,
      description: desc.description,
      parameters: desc.parameters.map((p) => ({
        name: p.name,
        type: p.type as any,
        description: p.description,
        required: p.required,
      })),
    },
    execute: async (args: Record<string, unknown>) => {
      if (!mcpClient) {
        throw new Error("MCP Client 未初始化，请先调用 initMCPClient()");
      }
      // 去掉 mcp_ 前缀，得到真实工具名
      const realName = desc.name.replace("mcp_", "");
      return await mcpClient.callTool(realName, args);
    },
  }));
}
