/**
 * API 路由: /api/runs
 * GET: 获取最近跑步记录
 * POST: 添加跑步记录
 */

import { NextRequest, NextResponse } from "next/server";
import { join } from "path";

// 使用 new Function 绕过 webpack 静态分析，动态加载 .ts 文件
async function loadMemoryStore() {
  const storePath = join(process.cwd(), "src", "memory", "store.ts");
  // eslint-disable-next-line no-new-func
  const fn = new Function("path", "return import(path)");
  const { loadMemory, addRun } = await fn(storePath);
  return { loadMemory, addRun };
}

export async function GET() {
  try {
    const { loadMemory } = await loadMemoryStore();
    const memory = loadMemory();
    return NextResponse.json({
      success: true,
      runs: memory.recentRuns,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "获取记录失败", detail: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { distance, pace, hr, feeling, notes } = body;

    if (!distance || !feeling) {
      return NextResponse.json(
        { error: "距离和感受不能为空" },
        { status: 400 }
      );
    }

    const { addRun } = await loadMemoryStore();
    const run = {
      date: new Date().toISOString().split("T")[0],
      distance: Number(distance),
      pace: String(pace || "-"),
      hr: hr ? Number(hr) : undefined,
      feeling: String(feeling),
      notes: notes ? String(notes) : undefined,
    };

    addRun(run);

    return NextResponse.json({
      success: true,
      run,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "添加记录失败", detail: String(error) },
      { status: 500 }
    );
  }
}
