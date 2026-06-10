/**
 * MCP Client - 连接跑步数据 MCP Server
 * Day 8: Agent 通过 MCP Client 访问外部数据服务
 *
 * 支持两种模式:
 * 1. stdio 模式: 启动 Server 子进程，通过 stdin/stdout 通信
 * 2. direct 模式: 直接调用 Server 工具（内存模式，用于测试）
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { createRunningMCPServer } from "./server.js";
import { loadRuns, saveRuns, loadProfile, saveProfile } from "../memory/store.js";
import type { RunLog } from "../core/types.js";

/** MCP Client 封装 */
export class RunningMCPClient {
  private client: Client | null = null;
  private tools: Tool[] = [];
  private mode: "stdio" | "direct";

  constructor(mode: "stdio" | "direct" = "direct") {
    this.mode = mode;
  }

  /** 连接到 MCP Server */
  async connect(): Promise<void> {
    if (this.mode === "stdio") {
      // stdio 模式: 启动 Server 子进程
      const transport = new StdioClientTransport({
        command: "node",
        args: ["--experimental-vm-modules", "dist/mcp/server.js"],
      });

      this.client = new Client(
        { name: "runcoach-client", version: "0.1.0" },
        { capabilities: {} }
      );

      await this.client.connect(transport);

      // 获取可用工具列表
      const toolsResult = await this.client.listTools();
      this.tools = toolsResult.tools;
      console.log(`🔗 MCP Client 已连接 (stdio)，发现 ${this.tools.length} 个工具`);
    } else {
      // direct 模式: 直接调用（模拟 MCP 协议）
      console.log(`🔗 MCP Client 已连接 (direct 内存模式)`);
      this.tools = [
        { name: "get_recent_runs", description: "...", inputSchema: {} },
        { name: "add_run_log", description: "...", inputSchema: {} },
        { name: "get_training_profile", description: "...", inputSchema: {} },
        { name: "update_training_profile", description: "...", inputSchema: {} },
        { name: "add_injury_note", description: "...", inputSchema: {} },
      ] as Tool[];
    }
  }

  /** 获取工具列表 */
  getTools(): Tool[] {
    return this.tools;
  }

  /** 调用工具 */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (this.mode === "stdio" && this.client) {
      const result = await this.client.callTool({ name, arguments: args });
      // 解析 text 内容
      const content = result.content as Array<{ type: string; text?: string }>;
      const textContent = content.find((c) => c.type === "text");
      if (textContent && "text" in textContent) {
        return JSON.parse(textContent.text as string);
      }
      return result;
    } else {
      // direct 模式: 直接调用内存函数
      return this.callDirect(name, args);
    }
  }

  /** 直接调用（内存模式） */
  private callDirect(name: string, args: Record<string, unknown>): unknown {
    switch (name) {
      case "get_recent_runs": {
        const limit = (args?.limit as number) || 10;
        const days = (args?.days as number) || 30;
        const runs = loadRuns();
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const filtered = runs
          .filter((r) => new Date(r.date) >= cutoff)
          .slice(0, limit);
        return { count: filtered.length, runs: filtered };
      }

      case "add_run_log": {
        const run: RunLog = {
          date: (args?.date as string) || new Date().toISOString().split("T")[0],
          distance: Number(args?.distance || 0),
          pace: String(args?.pace || "-"),
          hr: args?.hr ? Number(args.hr) : undefined,
          feeling: String(args?.feeling || "-"),
          notes: (args?.notes as string) || "",
        };
        const runs = loadRuns();
        runs.unshift(run);
        if (runs.length > 20) runs.length = 20;
        saveRuns(runs);
        return { success: true, added: run };
      }

      case "get_training_profile": {
        return loadProfile();
      }

      case "update_training_profile": {
        const field = String(args?.field || "");
        const value = String(args?.value || "");
        const profile = loadProfile();
        if (field in profile) {
          (profile as any)[field] = value;
          saveProfile(profile);
          return { success: true, updated: { field, value } };
        }
        return { error: `字段 "${field}" 不存在` };
      }

      case "add_injury_note": {
        const issue = String(args?.issue || "");
        const profile = loadProfile();
        if (!profile.issues.includes(issue)) {
          profile.issues.push(issue);
          saveProfile(profile);
        }
        return { success: true, issues: profile.issues };
      }

      default:
        return { error: `未知工具: ${name}` };
    }
  }

  /** 断开连接 */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
}

/** 工具描述转换（给 LLM 看） */
export function getMCPToolDescriptions(): Array<{
  name: string;
  description: string;
  parameters: Array<{ name: string; type: string; description: string; required?: boolean }>;
}> {
  return [
    {
      name: "mcp_get_recent_runs",
      description: "通过 MCP 获取最近跑步记录。适用于需要查看用户历史训练数据时调用。",
      parameters: [
        { name: "limit", type: "number", description: "返回记录数量，默认 10", required: false },
        { name: "days", type: "number", description: "最近多少天，默认 30", required: false },
      ],
    },
    {
      name: "mcp_add_run_log",
      description: "通过 MCP 添加跑步记录。适用于保存新的训练数据。",
      parameters: [
        { name: "distance", type: "number", description: "距离 km", required: true },
        { name: "pace", type: "string", description: "配速 M:SS", required: true },
        { name: "feeling", type: "string", description: "感受", required: true },
        { name: "hr", type: "number", description: "心率", required: false },
        { name: "notes", type: "string", description: "备注", required: false },
      ],
    },
    {
      name: "mcp_get_training_profile",
      description: "通过 MCP 获取用户训练画像。适用于了解用户目标和限制。",
      parameters: [],
    },
    {
      name: "mcp_add_injury_note",
      description: "通过 MCP 添加伤病记录。适用于用户提到新的身体不适。",
      parameters: [
        { name: "issue", type: "string", description: "伤病描述", required: true },
      ],
    },
  ];
}
