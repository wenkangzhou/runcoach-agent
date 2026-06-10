/**
 * Agent 核心循环
 * Day 1: 最小 Agent Loop
 * 
 * 伪代码实现:
 * while (!done) {
 *   const nextAction = await model.decide(context)
 *   if (nextAction.type === 'tool') {
 *     const result = await callTool(nextAction.tool, nextAction.args)
 *     context.push(result)
 *   } else {
 *     return nextAction.answer
 *   }
 * }
 */

import type {
  AgentContext,
  Message,
  NextAction,
  ToolResult,
  RunLog,
} from "./types.js";
import { decideNextAction } from "./llm.js";
import { getToolDescriptions, executeTool, initMCPTools } from "../tools/registry.js";
import { loadMemory, formatMemoryForContext, addRun } from "../memory/store.js";
import { buildMemoryContext } from "../memory/retrieval.js";
import { autoUpdateProfile } from "../memory/update.js";
import { retrieveDocuments, formatRetrievalContext, shouldRetrieve } from "../rag/retriever.js";
import { initVectorStore } from "../rag/chroma-store.js";

/** 创建初始上下文 */
export async function createContext(userInput: string): Promise<AgentContext> {
  // Day 4: 按需检索记忆，而非全量加载
  const memoryContext = await buildMemoryContext(userInput);

  // Day 5: RAG 知识库检索（向量检索 + 关键词回退）
  let knowledgeContext = "";
  if (shouldRetrieve(userInput)) {
    const ragResults = await retrieveDocuments(userInput, 3);
    knowledgeContext = formatRetrievalContext(ragResults);
  }

  const systemMessage: Message = {
    role: "system",
    content: `你是 RunCoach，一个专业的跑步训练 Agent。

${memoryContext}

${knowledgeContext}

你的职责：
1. 根据用户的训练记录和状态给出建议
2. 必要时调用工具获取信息（天气、计算等）
3. 优先考虑用户安全和长期目标
4. 如果用户有伤病信号，建议休息或就医
5. 如果用户提到新的个人信息（目标、时间、伤病），记住并在后续建议中考虑
6. 回答知识库相关问题时，基于检索到的文档内容回答，不要编造`,
  };

  const userMessage: Message = {
    role: "user",
    content: userInput,
  };

  return {
    messages: [systemMessage, userMessage],
    memory: await loadMemory(),
    iteration: 0,
    maxIterations: 5,
  };
}

/** 运行 Agent 循环 */
export async function runAgent(userInput: string): Promise<{
  answer: string;
  toolCalls: ToolResult[];
  iterations: number;
  memoryUpdate?: string;
}> {
  // Day 8: 初始化 MCP 工具
  await initMCPTools();

  // Day 5: 初始化向量数据库
  try {
    await initVectorStore();
  } catch (err) {
    console.warn("⚠️ 向量数据库初始化失败，将使用关键词检索回退:", err instanceof Error ? err.message : String(err));
  }

  const context = await createContext(userInput);
  const toolCalls: ToolResult[] = [];
  const tools = getToolDescriptions();

  console.log(`\n🏃 RunCoach Agent 启动`);
  console.log(`用户: "${userInput}"`);
  console.log(`-`.repeat(40));

  while (context.iteration < context.maxIterations) {
    context.iteration++;
    console.log(`\n🔄 迭代 ${context.iteration}/${context.maxIterations}`);

    // 1. LLM 决策下一步
    const action = await decideNextAction(context.messages, tools);
    console.log(`🧠 LLM 决策: ${action.type}`);

    if (action.type === "clarify") {
      return await finalize(userInput, `需要澄清: ${action.question}`, toolCalls, context.iteration);
    }

    if (action.type === "answer") {
      console.log(`✅ 直接回答`);
      const answer = formatAnswer(action.content, toolCalls);
      return await finalize(userInput, answer, toolCalls, context.iteration);
    }

    if (action.type === "tool") {
      const { toolCall } = action;
      console.log(`🔧 调用工具: ${toolCall.tool}(${JSON.stringify(toolCall.args)})`);

      // 2. 执行工具
      const result = await executeTool(toolCall.tool, toolCall.args);
      toolCalls.push(result);

      if (result.error) {
        console.log(`❌ 工具错误: ${result.error}`);
      } else {
        console.log(`📦 工具结果: ${JSON.stringify(result.result).slice(0, 200)}`);
      }

      // 3. 将结果加入上下文（OpenAI/Kimi function calling 格式）
      context.messages.push({
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: toolCall.id,
            type: "function",
            function: {
              name: toolCall.tool,
              arguments: JSON.stringify(toolCall.args),
            },
          },
        ],
      });

      context.messages.push({
        role: "tool",
        content: result.error
          ? `错误: ${result.error}`
          : JSON.stringify(result.result),
        toolCallId: toolCall.id,
        toolResult: result,
      });
    }
  }

  // 达到最大迭代次数，强制返回
  console.log(`⚠️ 达到最大迭代次数`);
  return await finalize(userInput, "Agent 思考次数过多，请简化问题或稍后重试。", toolCalls, context.iteration);
}

/** 格式化最终回答 */
function formatAnswer(rawAnswer: string, toolCalls: ToolResult[]): string {
  // 如果上下文中有训练建议结果，格式化输出
  const suggestResult = toolCalls.find(tc => tc.tool === "suggestNextWorkout")?.result as Record<string, unknown> | undefined;
  if (suggestResult && suggestResult.recommendation) {
    const rec = suggestResult.recommendation as Record<string, string>;
    return `【RunCoach 训练建议】

📋 明日安排: ${rec.type}
⏱️ 时长: ${rec.duration} | 📏 距离: ${rec.distance}
🎯 配速区间: ${rec.paceZone}
❤️ 心率区间: ${rec.hrZone}

💡 原因:
${rec.reason}

🔄 替代方案:
${rec.alternative}

${rec.warning ? `\n${rec.warning}\n` : ""}${suggestResult.goalHint || ""}`;
  }
  return rawAnswer;
}

/** 收尾：保存记录 + 更新 profile */
async function finalize(
  userInput: string,
  answer: string,
  toolCalls: ToolResult[],
  iterations: number
): Promise<{
  answer: string;
  toolCalls: ToolResult[];
  iterations: number;
  memoryUpdate: string;
}> {
  let memoryUpdate = "";

  // 1. 如果 parseRunLog 成功，自动保存到 recent_runs
  const parseResult = toolCalls.find(tc => tc.tool === "parseRunLog")?.result as Record<string, unknown> | undefined;
  if (parseResult && parseResult.isValid) {
    const extracted = parseResult.extracted as Record<string, unknown>;
    const run: RunLog = {
      date: new Date().toISOString().split("T")[0],
      distance: Number(extracted.distance || 0),
      pace: String(extracted.pace || "-"),
      hr: extracted.hr ? Number(extracted.hr) : undefined,
      feeling: String(extracted.feeling || "-"),
      notes: userInput.slice(0, 100),
    };
    await addRun(run);
    memoryUpdate += `\n📝 已保存训练记录: ${run.distance}km @ ${run.pace}`;
  }

  // 2. 自动更新 profile
  const update = await autoUpdateProfile(userInput);
  if (update.hasUpdate) {
    memoryUpdate += `\n${update.message}`;
  }

  return { answer, toolCalls, iterations, memoryUpdate };
}
