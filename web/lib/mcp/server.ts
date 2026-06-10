/**
 * MCP Server - 跑步数据服务
 * Day 8: 通过 MCP 协议暴露本地跑步数据
 *
 * 暴露的工具:
 * - get_recent_runs: 获取最近训练记录
 * - add_run_log: 添加训练记录
 * - get_training_profile: 获取用户画像
 * - update_training_profile: 更新用户画像
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadRuns, saveRuns, loadProfile, saveProfile } from "../memory/store.js";
import type { RunLog, UserProfile } from "../core/types.js";

/** 创建 MCP Server */
export function createRunningMCPServer(): Server {
  const server = new Server(
    {
      name: "runcoach-memory-server",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // 注册工具列表
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "get_recent_runs",
          description: "获取用户最近的跑步训练记录，包括距离、配速、心率和感受",
          inputSchema: {
            type: "object",
            properties: {
              limit: {
                type: "number",
                description: "返回记录数量，默认 10",
              },
              days: {
                type: "number",
                description: "最近多少天内的记录，默认 30",
              },
            },
          },
        },
        {
          name: "add_run_log",
          description: "添加一条新的跑步训练记录",
          inputSchema: {
            type: "object",
            properties: {
              date: {
                type: "string",
                description: "日期，格式 YYYY-MM-DD，默认今天",
              },
              distance: {
                type: "number",
                description: "距离（km）",
              },
              pace: {
                type: "string",
                description: "配速，格式 M:SS",
              },
              hr: {
                type: "number",
                description: "平均心率",
              },
              feeling: {
                type: "string",
                description: "主观感受，例如: 很好、有点累、轻松",
              },
              notes: {
                type: "string",
                description: "备注",
              },
            },
            required: ["distance", "pace", "feeling"],
          },
        },
        {
          name: "get_training_profile",
          description: "获取用户的训练画像，包括目标、周跑量、可用时间和伤病史",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "update_training_profile",
          description: "更新用户的训练画像字段",
          inputSchema: {
            type: "object",
            properties: {
              field: {
                type: "string",
                description: "字段名: goal, weeklyMileage, availableTime, preferredPace, experience",
                enum: ["goal", "weeklyMileage", "availableTime", "preferredPace", "experience"],
              },
              value: {
                type: "string",
                description: "新值",
              },
            },
            required: ["field", "value"],
          },
        },
        {
          name: "add_injury_note",
          description: "添加伤病记录到用户画像",
          inputSchema: {
            type: "object",
            properties: {
              issue: {
                type: "string",
                description: "伤病描述，例如: 膝盖痛、小腿紧",
              },
            },
            required: ["issue"],
          },
        },
      ],
    };
  });

  // 注册工具调用处理
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "get_recent_runs": {
        const limit = (args?.limit as number) || 10;
        const days = (args?.days as number) || 30;
        const runs = await loadRuns();
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const filtered = runs
          .filter((r) => new Date(r.date) >= cutoff)
          .slice(0, limit);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ count: filtered.length, runs: filtered }, null, 2),
            },
          ],
        };
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
        const runs = await loadRuns();
        runs.unshift(run);
        if (runs.length > 20) runs.length = 20;
        await saveRuns(runs);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, added: run }, null, 2),
            },
          ],
        };
      }

      case "get_training_profile": {
        const profile = await loadProfile();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(profile, null, 2),
            },
          ],
        };
      }

      case "update_training_profile": {
        const field = String(args?.field || "");
        const value = String(args?.value || "");
        const profile = await loadProfile();
        if (field in profile) {
          (profile as any)[field] = value;
          await saveProfile(profile);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ success: true, updated: { field, value } }, null, 2),
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `字段 "${field}" 不存在` }, null, 2),
            },
          ],
          isError: true,
        };
      }

      case "add_injury_note": {
        const issue = String(args?.issue || "");
        const profile = await loadProfile();
        if (!profile.issues.includes(issue)) {
          profile.issues.push(issue);
          await saveProfile(profile);
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, issues: profile.issues }, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `未知工具: ${name}` }, null, 2),
            },
          ],
          isError: true,
        };
    }
  });

  return server;
}

/** 启动 MCP Server (stdio 模式) */
export async function startMCPServer(): Promise<void> {
  const server = createRunningMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🏃 RunCoach MCP Server 已启动 (stdio)");
}
