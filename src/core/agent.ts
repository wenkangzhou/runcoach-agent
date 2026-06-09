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
} from "./types.js";
import { decideNextAction } from "./llm.js";
import { getToolDescriptions, executeTool } from "../tools/registry.js";
import { loadMemory, formatMemoryForContext } from "../memory/store.js";

/** 创建初始上下文 */
export function createContext(userInput: string): AgentContext {
  const memory = loadMemory();

  const systemMessage: Message = {
    role: "system",
    content: `你是 RunCoach，一个专业的跑步训练 Agent。

${formatMemoryForContext(memory)}

你的职责：
1. 根据用户的训练记录和状态给出建议
2. 必要时调用工具获取信息（天气、计算等）
3. 优先考虑用户安全和长期目标
4. 如果用户有伤病信号，建议休息或就医`,
  };

  const userMessage: Message = {
    role: "user",
    content: userInput,
  };

  return {
    messages: [systemMessage, userMessage],
    memory,
    iteration: 0,
    maxIterations: 5,
  };
}

/** 运行 Agent 循环 */
export async function runAgent(userInput: string): Promise<{
  answer: string;
  toolCalls: ToolResult[];
  iterations: number;
}> {
  const context = createContext(userInput);
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
      return {
        answer: `需要澄清: ${action.question}`,
        toolCalls,
        iterations: context.iteration,
      };
    }

    if (action.type === "answer") {
      console.log(`✅ 直接回答`);

      // 如果上下文中有训练建议结果，格式化输出
      const suggestResult = toolCalls.find(tc => tc.tool === "suggestNextWorkout")?.result as Record<string, unknown> | undefined;
      if (suggestResult && suggestResult.recommendation) {
        const rec = suggestResult.recommendation as Record<string, string>;
        const formattedAnswer = `【RunCoach 训练建议】

📋 明日安排: ${rec.type}
⏱️ 时长: ${rec.duration} | 📏 距离: ${rec.distance}
🎯 配速区间: ${rec.paceZone}
❤️ 心率区间: ${rec.hrZone}

💡 原因:
${rec.reason}

🔄 替代方案:
${rec.alternative}

${rec.warning ? `\n${rec.warning}\n` : ""}${suggestResult.goalHint || ""}`;
        return {
          answer: formattedAnswer,
          toolCalls,
          iterations: context.iteration,
        };
      }

      return {
        answer: action.content,
        toolCalls,
        iterations: context.iteration,
      };
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

      // 3. 将结果加入上下文
      context.messages.push({
        role: "assistant",
        content: `调用工具: ${toolCall.tool}`,
        toolCall,
      });

      context.messages.push({
        role: "tool",
        content: result.error
          ? `错误: ${result.error}`
          : JSON.stringify(result.result),
        toolResult: result,
      });
    }
  }

  // 达到最大迭代次数，强制返回
  console.log(`⚠️ 达到最大迭代次数`);
  return {
    answer: "Agent 思考次数过多，请简化问题或稍后重试。",
    toolCalls,
    iterations: context.iteration,
  };
}
