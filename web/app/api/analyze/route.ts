/**
 * API 路由: /api/analyze
 * POST: 分析单次训练（接收 runId 或 run data）
 * GET: 获取最近分析历史
 */

import { NextRequest, NextResponse } from "next/server";
import { loadMemory } from "@/lib/memory/store";
import { parseRunStructure } from "@/lib/analysis/structure";
import { classifyRun } from "@/lib/analysis/classify";
import { interpretRun } from "@/lib/analysis/interpret";
import { getCurrentUserId } from "@/lib/auth";
import type { NormalizedRun } from "@/lib/strava/types";
import type { RunAnalysis } from "@/lib/analysis/types";

// 内存缓存最近分析历史（生产环境应使用 Redis）
const analysisHistoryMap = new Map<string, Array<{ id: string; date: string; analysis: RunAnalysis }>>();
const MAX_HISTORY = 20;

/** 生成简单 ID */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 从 memory 的 RunLog 构造 NormalizedRun（简化版） */
function runLogToNormalized(run: { date: string; distance: number; pace: string; hr?: number; feeling: string; notes?: string }): NormalizedRun {
  return {
    stravaId: 0,
    date: run.date,
    name: run.notes || "训练记录",
    distance: run.distance,
    duration: run.distance * 6, // 估算
    movingDuration: run.distance * 6,
    pace: run.pace,
    avgSpeed: 0,
    maxSpeed: 0,
    elevationGain: 0,
    avgHr: run.hr,
    feeling: run.feeling,
    notes: run.notes || "",
    isTreadmill: false,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { runId, run } = body;

    let targetRun: NormalizedRun | null = null;
    let allRuns: NormalizedRun[] = [];

    const userId = await getCurrentUserId();

    // 如果提供了 run 数据，直接使用
    if (run && typeof run === "object") {
      targetRun = run as NormalizedRun;
    }

    // 否则尝试从 memory 查找（通过 runId 或最近记录）
    if (!targetRun) {
      const memory = await loadMemory(userId);
      allRuns = memory.recentRuns.map(runLogToNormalized);

      if (runId) {
        targetRun = allRuns.find((r) => r.stravaId === runId || r.date === runId) || null;
      }

      // 如果没有指定，使用最近一条
      if (!targetRun && allRuns.length > 0) {
        targetRun = allRuns[0];
      }
    } else {
      // 也需要加载近期记录用于对比
      const memory = await loadMemory(userId);
      allRuns = memory.recentRuns.map(runLogToNormalized);
    }

    if (!targetRun) {
      return NextResponse.json(
        { error: "未找到训练记录，请提供 run 数据或有效的 runId" },
        { status: 404 }
      );
    }

    // 执行分析流水线
    const structure = parseRunStructure(targetRun.splits || []);
    const classification = classifyRun(targetRun, allRuns);
    const analysis = interpretRun(targetRun, structure, classification, allRuns);

    // 保存到历史
    const record = { id: generateId(), date: targetRun.date, analysis };
    const history = analysisHistoryMap.get(userId) || [];
    history.unshift(record);
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    analysisHistoryMap.set(userId, history);

    return NextResponse.json({
      success: true,
      run: {
        date: targetRun.date,
        name: targetRun.name,
        distance: targetRun.distance,
        pace: targetRun.pace,
        hr: targetRun.avgHr,
      },
      structure: {
        hasClearStructure: structure.hasClearStructure,
        warmupDistance: structure.warmup.distance,
        mainDistance: structure.main.distance,
        cooldownDistance: structure.cooldown.distance,
      },
      classification: {
        category: classification.category,
        paceZone: classification.paceZone,
        confidence: classification.confidence,
        reasons: classification.reasons,
      },
      analysis,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "分析失败", detail: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const history = analysisHistoryMap.get(userId) || [];
    return NextResponse.json({
      success: true,
      history: history.slice(0, 10),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "获取历史失败", detail: String(error) },
      { status: 500 }
    );
  }
}
