/**
 * API 路由: /api/chat
 * 接收用户消息，调用 Agent 循环，返回回答
 */

import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/core/agent";

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
