/**
 * API 路由: /api/chat
 * 接收用户消息，调用 Agent 循环，返回回答
 */

import { NextRequest, NextResponse } from "next/server";
import { join } from "path";

// 使用 new Function 绕过 webpack 静态分析，动态加载 .ts 文件
async function loadAgent() {
  const agentPath = join(process.cwd(), "src", "core", "agent.ts");
  // eslint-disable-next-line no-new-func
  const fn = new Function("path", "return import(path)");
  const { runAgent } = await fn(agentPath);
  return runAgent;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "消息不能为空" },
        { status: 400 }
      );
    }

    const runAgent = await loadAgent();
    const result = await runAgent(message);

    return NextResponse.json({
      success: true,
      answer: result.answer,
      toolCalls: result.toolCalls,
      iterations: result.iterations,
      memoryUpdate: result.memoryUpdate,
    });
  } catch (error) {
    console.error("Chat API 错误:", error);
    return NextResponse.json(
      { error: "Agent 处理失败", detail: String(error) },
      { status: 500 }
    );
  }
}
