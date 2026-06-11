/**
 * LLM 调用封装
 * 支持 Kimi (Moonshot AI)、OpenAI API 和本地模拟模式
 */

import type { Message, NextAction, ToolDescription } from "./types.js";

// ==========================================
// LLM Provider 配置
// ==========================================

/** 当前使用的 LLM Provider */
export type LLMProvider = "kimi" | "openai" | "mock";

/** 获取当前 Provider */
function getProvider(): LLMProvider {
  const envProvider = process.env.LLM_PROVIDER?.toLowerCase();
  if (envProvider === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (envProvider === "kimi" && process.env.KIMI_API_KEY) return "kimi";
  // 自动检测：有 KIMI_KEY 用 Kimi，有 OPENAI_KEY 用 OpenAI，都没有用 mock
  if (process.env.KIMI_API_KEY) return "kimi";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "mock";
}

/** OpenAI SDK 客户端（懒加载） */
let openaiClient: any = null;

/** 初始化 LLM 客户端 */
async function initLLMClient(): Promise<void> {
  if (openaiClient) return;

  const provider = getProvider();
  if (provider === "mock") return;

  try {
    const { OpenAI } = await import("openai");

    if (provider === "kimi") {
      openaiClient = new OpenAI({
        apiKey: process.env.KIMI_API_KEY,
        baseURL: "https://api.moonshot.cn/v1",
      });
      console.log("🤖 LLM Provider: Kimi (Moonshot AI)");
    } else if (provider === "openai") {
      openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL,
      });
      console.log("🤖 LLM Provider: OpenAI");
    }
  } catch (err) {
    console.warn("⚠️ 无法加载 OpenAI SDK，回退到模拟模式:", err instanceof Error ? err.message : String(err));
  }
}

/** 获取当前模型名 */
function getModel(): string {
  const provider = getProvider();
  if (provider === "kimi") {
    return process.env.KIMI_MODEL || "moonshot-v1-8k";
  }
  if (provider === "openai") {
    return process.env.OPENAI_MODEL || "gpt-4o-mini";
  }
  return "mock";
}

/** 构建给 LLM 的系统提示 */
function buildSystemPrompt(tools: ToolDescription[]): string {
  const toolDefs = tools
    .map(
      (t) => `
工具名称: ${t.name}
描述: ${t.description}
参数:
${t.parameters
  .map((p) => `  - ${p.name} (${p.type}${p.required ? ", 必填" : ""}): ${p.description}`)
  .join("\n")}
`
    )
    .join("\n---\n");

  return `你是 RunCoach，一个专业的跑步训练助手 Agent。

你可以使用以下工具来帮助用户：

${toolDefs}

重要规则：
1. 如果用户的问题需要工具才能回答，请调用对应工具。
2. 如果信息足够直接回答，请直接回答。
3. 如果用户意图不明确，请提出澄清问题。
4. 回答要简洁、专业，考虑用户的训练安全和长期目标。
5. 如果用户有伤病信号，建议休息或就医。
6. 如果用户提到新的个人信息（目标、时间、伤病），记住并在后续建议中考虑。`;
}

/** 调用 LLM 获取下一步决策 */
export async function decideNextAction(
  messages: Message[],
  tools: ToolDescription[]
): Promise<NextAction> {
  // 初始化客户端（只执行一次）
  await initLLMClient();

  const provider = getProvider();

  // 如果有真实 API，优先使用
  if (provider !== "mock" && openaiClient) {
    return callRealLLM(messages, tools);
  }

  // 否则使用模拟 LLM（用于离线开发和快速验证）
  return callMockLLM(messages, tools);
}

/** 真实 LLM API 调用（Kimi / OpenAI 兼容） */
async function callRealLLM(
  messages: Message[],
  tools: ToolDescription[]
): Promise<NextAction> {
  const model = getModel();
  const provider = getProvider();

  try {
    // 转换消息为 OpenAI API 格式
    const apiMessages = messages.map((m) => {
      if (m.role === "assistant" && m.toolCalls) {
        return {
          role: "assistant",
          content: m.content || null,
          tool_calls: m.toolCalls,
        };
      }
      if (m.role === "tool" && m.toolCallId) {
        return {
          role: "tool",
          content: m.content,
          tool_call_id: m.toolCallId,
        };
      }
      return {
        role: m.role,
        content: m.content,
      };
    });

    // 转换工具为 OpenAI functions 格式
    const apiTools = tools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: {
          type: "object" as const,
          properties: Object.fromEntries(
            t.parameters.map((p) => [
              p.name,
              {
                type: p.type,
                description: p.description,
                ...(p.enum ? { enum: p.enum } : {}),
              },
            ])
          ),
          required: t.parameters.filter((p) => p.required).map((p) => p.name),
        },
      },
    }));

    const completion = await Promise.race([
      openaiClient.chat.completions.create({
        model,
        temperature: 0.3,
        messages: [
          { role: "system", content: buildSystemPrompt(tools) },
          ...apiMessages,
        ],
        tools: apiTools,
        tool_choice: "auto",
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("LLM API 调用超时 (8秒)")), 8000)
      ),
    ]);

    const response = completion.choices[0].message;

    // 处理 function call
    if (response.tool_calls && response.tool_calls.length > 0) {
      const tc = response.tool_calls[0];
      return {
        type: "tool",
        toolCall: {
          id: tc.id,
          tool: tc.function.name,
          args: JSON.parse(tc.function.arguments),
        },
      };
    }

    // 直接回答
    return { type: "answer", content: response.content || "" };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    // 429 过载错误：立即回退，不等待超时
    if (error.includes("429") || error.includes("overloaded") || error.includes("rate limit")) {
      console.error(`❌ ${provider} API 过载 (429)，立即回退到模拟模式`);
      return callMockLLM(messages, tools);
    }
    console.error(`❌ ${provider} API 调用失败:`, error);
    // API 失败时回退到模拟模式
    console.log("🔄 回退到模拟 LLM...");
    return callMockLLM(messages, tools);
  }
}

/** 模拟 LLM（基于关键词的简单规则） */
async function callMockLLM(
  messages: Message[],
  tools: ToolDescription[]
): Promise<NextAction> {
  const lastUserMessage = messages
    .slice()
    .reverse()
    .find((m) => m.role === "user");

  if (!lastUserMessage) {
    return { type: "clarify", question: "请告诉我你想了解什么？" };
  }

  const text = lastUserMessage.content.toLowerCase();
  const originalText = lastUserMessage.content;

  // 检查上下文中是否已有工具结果（避免循环调用）
  const hasToolResult = messages.some(m => m.role === "tool");
  const hasWeatherResult = messages.some(m => m.role === "tool" && m.toolResult?.tool === "getWeather");

  // 模拟工具选择逻辑 - 天气
  // 触发条件: 提到天气相关词，或 (提到城市 + 提到跑步/适合/出门)
  const weatherKeywords = ["天气", "下雨", "温度", "预报", "适合跑步", "能跑吗", "出门"];
  const knownCities = ["上海", "北京", "广州", "深圳", "杭州"];
  const foundCity = knownCities.find(c => originalText.includes(c));
  const hasWeatherKeyword = weatherKeywords.some(k => text.includes(k));

  if (!hasWeatherResult && (hasWeatherKeyword || (foundCity && (text.includes("跑") || text.includes("适合") || text.includes("吗"))))) {
    return {
      type: "tool",
      toolCall: {
        id: `call_${Date.now()}`,
        tool: "getWeather",
        args: { city: foundCity || "上海" },
      },
    };
  }

  if (text.includes("计算") || text.includes("多少") || text.includes("等于")) {
    // 配速计算: "5:40 配速跑 10km"
    const paceMatch = text.match(/(\d+)[：:](\d+)\s*配速.*?([\d.]+)\s*(km|公里)/i);
    if (paceMatch) {
      const min = parseInt(paceMatch[1], 10);
      const sec = parseInt(paceMatch[2], 10);
      const distance = parseFloat(paceMatch[3]);
      const paceSec = min * 60 + sec;
      const totalSec = paceSec * distance;
      const totalMin = Math.round(totalSec / 60);
      return {
        type: "answer",
        content: `【模拟模式】计算结果：${min}:${sec.toString().padStart(2, "0")} 配速跑 ${distance}km 约需 ${totalMin} 分钟（${Math.floor(totalSec / 60)}分${Math.round(totalSec % 60)}秒）。`,
      };
    }

    // 普通数学表达式 - 支持小数
    const hasCalcResult = messages.some(m => m.role === "tool" && m.toolResult?.tool === "calculate");
    if (!hasCalcResult) {
      // 尝试匹配更完整的表达式，包括小数
      const fullExprMatch = originalText.match(/([\d.]+\s*[+\-*/]\s*[\d.]+)/);
      if (fullExprMatch) {
        return {
          type: "tool",
          toolCall: {
            id: `call_${Date.now()}`,
            tool: "calculate",
            args: { expression: fullExprMatch[1].replace(/\s+/g, " ") },
          },
        };
      }
    }
  }

  // Day 5: RAG 知识库检索
  const knowledgeKeywords = ["补给", "胶", "水", "吃", "喝", "早餐", "心率", "区间", "zone", "强度", "有氧", "无氧", "阈值", "伤病", "痛", "伤", "恢复", "拉伸", "膝盖", "小腿", "足底", "跟腱", "预防", "治疗", "医生", "休息"];
  const hasKnowledgeKeyword = knowledgeKeywords.some(k => text.includes(k));
  const hasRagResult = messages.some(m => m.role === "tool" && m.toolResult?.tool === "retrieveKnowledge");

  if (hasKnowledgeKeyword && !hasRagResult) {
    return {
      type: "tool",
      toolCall: {
        id: `call_${Date.now()}`,
        tool: "retrieveKnowledge",
        args: { query: originalText },
      },
    };
  }

  if (text.includes("跑") || text.includes("训练") || text.includes("配速") || text.includes("明天") || text.includes("建议")) {
    // 如果用户输入包含具体数据，先调用 parseRunLog 提取
    const hasRunData = /\d+\s*(km|公里)/.test(originalText) && (text.includes("配速") || text.includes("跑了"));
    const parseRunLogResult = messages.find(m => m.role === "tool" && m.toolResult?.tool === "parseRunLog")?.toolResult?.result as Record<string, unknown> | undefined;
    const hasSuggestResult = messages.some(m => m.role === "tool" && m.toolResult?.tool === "suggestNextWorkout");

    // Step 1: 提取跑步数据
    if (hasRunData && !parseRunLogResult) {
      return {
        type: "tool",
        toolCall: {
          id: `call_${Date.now()}`,
          tool: "parseRunLog",
          args: { text: originalText },
        },
      };
    }

    // Step 2: 有了数据后，如果用户问建议，调用 suggestNextWorkout
    if (parseRunLogResult && !hasSuggestResult && (text.includes("明天") || text.includes("建议") || text.includes("怎么跑") || text.includes("该跑"))) {
      return {
        type: "tool",
        toolCall: {
          id: `call_${Date.now()}`,
          tool: "suggestNextWorkout",
          args: {
            todayRun: parseRunLogResult.extracted || parseRunLogResult,
            question: originalText,
          },
        },
      };
    }

    // Step 3: 如果已有建议结果，直接回答（由 agent.ts 处理，这里返回通用回答让 agent 继续）
    if (hasSuggestResult) {
      return {
        type: "answer",
        content: "【模拟模式】训练建议已生成，请查看上方结果。",
      };
    }

    // Day 8: MCP 工具触发 - 查询历史记录
    const hasMCPRunsResult = messages.some(m => m.role === "tool" && m.toolResult?.tool === "mcp_get_recent_runs");
    if (!hasMCPRunsResult && (text.includes("历史") || text.includes("记录") || text.includes("最近跑") || text.includes("周跑量"))) {
      return {
        type: "tool",
        toolCall: {
          id: `call_${Date.now()}`,
          tool: "mcp_get_recent_runs",
          args: { limit: 5, days: 30 },
        },
      };
    }

    // Day 8: MCP 工具触发 - 查询用户画像
    const hasMCPProfileResult = messages.some(m => m.role === "tool" && m.toolResult?.tool === "mcp_get_training_profile");
    if (!hasMCPProfileResult && (text.includes("目标") || text.includes("profile") || text.includes("画像"))) {
      return {
        type: "tool",
        toolCall: {
          id: `call_${Date.now()}`,
          tool: "mcp_get_training_profile",
          args: {},
        },
      };
    }

    return {
      type: "answer",
      content:
        "【模拟模式】我收到了你的跑步相关问题。真实模式下我会结合你的训练记录和天气数据给出建议。现在请告诉我更多细节，比如今天的距离、配速和感受。",
    };
  }

  return {
    type: "answer",
    content: `【模拟模式】我理解了你的问题："${lastUserMessage.content}"。

当前运行的是模拟 LLM，无需 API Key。

如需接入真实模型：
1. 复制 .env.example 为 .env
2. 填入 KIMI_API_KEY（推荐）或 OPENAI_API_KEY
3. 重新运行`,
  };
}
