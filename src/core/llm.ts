/**
 * LLM 调用封装
 * 支持真实 OpenAI API 和本地模拟模式（用于测试和离线开发）
 */

import type { Message, NextAction, ToolDescription } from "./types.js";

// 尝试加载真实 OpenAI 客户端
let openai: any = null;
try {
  const { OpenAI } = await import("openai");
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey.startsWith("sk-")) {
    openai = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL,
    });
  }
} catch {
  // openai 包未安装或加载失败
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

  return `你是一个跑步训练助手 Agent。你可以使用以下工具来帮助用户：

${toolDefs}

重要规则：
1. 如果用户的问题需要工具才能回答，你必须输出工具调用。
2. 如果信息足够直接回答，请直接回答。
3. 如果用户意图不明确，请提出澄清问题。
4. 回答要简洁、专业，考虑用户的训练安全和长期目标。

输出格式（严格 JSON）：
- 调用工具: {"type": "tool", "toolCall": {"tool": "工具名", "args": {...}}}
- 直接回答: {"type": "answer", "content": "你的回答"}
- 澄清问题: {"type": "clarify", "question": "你的问题"}`;
}

/** 调用 LLM 获取下一步决策 */
export async function decideNextAction(
  messages: Message[],
  tools: ToolDescription[]
): Promise<NextAction> {
  // 如果有真实 API，优先使用
  if (openai) {
    return callRealLLM(messages, tools);
  }

  // 否则使用模拟 LLM（用于 Day 1-2 快速验证结构）
  return callMockLLM(messages, tools);
}

/** 真实 OpenAI API 调用 */
async function callRealLLM(
  messages: Message[],
  tools: ToolDescription[]
): Promise<NextAction> {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.3,
    messages: [
      { role: "system", content: buildSystemPrompt(tools) },
      ...messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ],
  });

  const raw = completion.choices[0].message.content || "";

  // 尝试解析 JSON
  try {
    const parsed = JSON.parse(raw);
    if (parsed.type === "tool" && parsed.toolCall) {
      return { type: "tool", toolCall: parsed.toolCall };
    }
    if (parsed.type === "answer") {
      return { type: "answer", content: parsed.content };
    }
    if (parsed.type === "clarify") {
      return { type: "clarify", question: parsed.question };
    }
  } catch {
    // 不是 JSON，当作直接回答
  }

  return { type: "answer", content: raw };
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

    return {
      type: "answer",
      content:
        "【模拟模式】我收到了你的跑步相关问题。真实模式下我会结合你的训练记录和天气数据给出建议。现在请告诉我更多细节，比如今天的距离、配速和感受。",
    };
  }

  return {
    type: "answer",
    content: `【模拟模式】我理解了你的问题："${lastUserMessage.content}"。当前运行的是模拟 LLM，无需 API Key。如需真实模型响应，请配置 OPENAI_API_KEY。`,
  };
}
