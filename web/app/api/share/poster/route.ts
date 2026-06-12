/**
 * API 路由: /api/share/poster
 * GET: 获取海报数据
 *   ?weeks=1|4|all - 统计周期，默认 1
 * 返回 JSON：海报所需的所有统计数据
 */

import { NextRequest, NextResponse } from "next/server";
import { loadMemory } from "@/lib/memory/store";
import { generateWeeklyComment } from "@/lib/share/weekly-comment";
import type { RunLog } from "@/lib/core/types";

export interface PosterData {
  title: string;
  period: string;
  totalDistance: number;
  avgPace: string;
  runsCount: number;
  totalDuration: number;
  longestRun: number;
  restDays: number;
  comment: string;
  typeDistribution: Record<string, number>;
  generatedAt: string;
  appUrl: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weeksParam = searchParams.get("weeks") || "1";
    const weeks = weeksParam === "all" ? 999 : Math.min(Math.max(parseInt(weeksParam, 10), 1), 52);

    const memory = await loadMemory();
    const runs = memory.recentRuns || [];

    // 筛选周期内的跑步记录
    const filteredRuns = filterRunsByWeeks(runs, weeks);

    // 计算统计数据
    const totalDistance = filteredRuns.reduce((sum, r) => sum + r.distance, 0);
    const totalDuration = filteredRuns.reduce((sum, r) => {
      const paceSec = parsePace(r.pace);
      return sum + (paceSec > 0 ? r.distance * (paceSec / 60) : r.distance * 6);
    }, 0);

    const validPaces = filteredRuns.filter((r) => parsePace(r.pace) > 0);
    const avgPaceSec =
      validPaces.length > 0
        ? validPaces.reduce((sum, r) => sum + parsePace(r.pace), 0) / validPaces.length
        : 0;

    const longestRun = filteredRuns.length > 0 ? Math.max(...filteredRuns.map((r) => r.distance)) : 0;
    const trainingDays = new Set(filteredRuns.map((r) => r.date)).size;
    const restDays = weeks === 999 ? 0 : Math.max(0, weeks * 7 - trainingDays);

    // 训练类型分布
    const typeDistribution = getTypeDistribution(filteredRuns);

    // AI 点评
    const comment = generateWeeklyComment({
      runs: filteredRuns,
      totalDistance: Math.round(totalDistance * 10) / 10,
      avgPace: avgPaceSec > 0 ? formatPace(avgPaceSec) : "-",
      totalDuration: Math.round(totalDuration),
      runsCount: filteredRuns.length,
      longestRun: Math.round(longestRun * 10) / 10,
      restDays,
    });

    const periodLabel =
      weeksParam === "all"
        ? "全部记录"
        : weeksParam === "1"
        ? "本周"
        : `最近 ${weeks} 周`;

    const data: PosterData = {
      title: `${periodLabel}训练周报`,
      period: periodLabel,
      totalDistance: Math.round(totalDistance * 10) / 10,
      avgPace: avgPaceSec > 0 ? formatPace(avgPaceSec) : "-",
      runsCount: filteredRuns.length,
      totalDuration: Math.round(totalDuration),
      longestRun: Math.round(longestRun * 10) / 10,
      restDays,
      comment,
      typeDistribution,
      generatedAt: new Date().toISOString(),
      appUrl: process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3675",
    };

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Poster API 错误:", error);
    return NextResponse.json(
      { error: "获取海报数据失败", detail: String(error) },
      { status: 500 }
    );
  }
}

function filterRunsByWeeks(runs: RunLog[], weeks: number): RunLog[] {
  if (weeks >= 999) return [...runs];

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - weeks * 7);
  cutoff.setHours(0, 0, 0, 0);

  return runs.filter((run) => new Date(run.date) >= cutoff);
}

function getTypeDistribution(runs: RunLog[]): Record<string, number> {
  const dist: Record<string, number> = {
    轻松跑: 0,
    间歇跑: 0,
    长距离: 0,
    节奏跑: 0,
    恢复跑: 0,
    其他: 0,
  };

  for (const run of runs) {
    const type = classifyRunType(run);
    dist[type] = (dist[type] || 0) + run.distance;
  }

  // 移除 0 值
  for (const key of Object.keys(dist)) {
    if (dist[key] === 0) delete dist[key];
  }

  return dist;
}

function classifyRunType(run: RunLog): string {
  if (run.hr && run.hr > 0) {
    if (run.hr >= 170) return "间歇跑";
    if (run.hr >= 160) return "节奏跑";
    if (run.hr >= 150) return "轻松跑";
    return "恢复跑";
  }

  const paceSec = parsePace(run.pace);
  if (paceSec === 0) return "其他";

  if (paceSec <= 240) return "间歇跑";
  if (paceSec <= 270) return "节奏跑";
  if (paceSec <= 360) return "轻松跑";
  return "恢复跑";
}

function parsePace(pace: string): number {
  const match = pace.match(/(\d+)[：:](\d+)/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function formatPace(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}
