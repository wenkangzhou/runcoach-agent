/**
 * API 路由: /api/runs
 * GET: 获取最近跑步记录
 * POST: 添加跑步记录
 */

import { NextRequest, NextResponse } from "next/server";
import { loadMemory, addRun } from "@/lib/memory/store";

export async function GET() {
  try {
    const memory = await loadMemory();
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

    const run = {
      date: new Date().toISOString().split("T")[0],
      distance: Number(distance),
      pace: String(pace || "-"),
      hr: hr ? Number(hr) : undefined,
      feeling: String(feeling),
      notes: notes ? String(notes) : undefined,
    };

    await addRun(run);

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
