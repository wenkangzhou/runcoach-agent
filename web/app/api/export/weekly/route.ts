/**
 * API 路由: /api/export/weekly
 * GET: 导出最近 N 周周报
 *   ?weeks=4 - 默认 4 周
 * 返回 JSON：{ weekEnding, totalDistance, avgPace, totalDuration, runsCount, longestRun, restDays }
 */

import { NextRequest, NextResponse } from "next/server";
import { loadMemory } from "@/lib/memory/store";
import type { RunLog } from "@/lib/core/types";

export interface WeeklyReport {
  weekEnding: string;      // 周日日期 YYYY-MM-DD
  weekRange: string;       // 如 "06/08-06/14"
  totalDistance: number;   // km
  avgPace: string;         // mm:ss
  totalDuration: number;    // 分钟
  runsCount: number;
  longestRun: number;     // km
  restDays: number;        // 7 - 有训练的天数
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weeksParam = searchParams.get("weeks");
    const weeks = Math.min(Math.max(parseInt(weeksParam || "4", 10), 1), 12);

    const memory = await loadMemory();
    const runs = memory.recentRuns || [];

    const reports = generateWeeklyReports(runs, weeks);

    return NextResponse.json({
      success: true,
      weeks: reports,
    });
  } catch (error) {
    console.error("Weekly export API 错误:", error);
    return NextResponse.json(
      { error: "导出周报失败", detail: String(error) },
      { status: 500 }
    );
  }
}

function generateWeeklyReports(runs: RunLog[], weeks: number): WeeklyReport[] {
  if (!runs || runs.length === 0) return [];

  // 按日期排序（新到旧）
  const sorted = [...runs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // 找到最新的日期，计算该日期所在周的周日
  const latestDate = new Date(sorted[0].date);
  const latestWeekEnd = getWeekEnd(latestDate);

  const reports: WeeklyReport[] = [];

  for (let i = 0; i < weeks; i++) {
    const weekEnd = new Date(latestWeekEnd);
    weekEnd.setDate(weekEnd.getDate() - i * 7);

    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);

    const weekRuns = sorted.filter((run) => {
      const d = new Date(run.date);
      return d >= weekStart && d <= weekEnd;
    });

    const totalDistance = weekRuns.reduce((sum, r) => sum + r.distance, 0);
    const totalDuration = weekRuns.reduce((sum, r) => {
      const paceSec = parsePace(r.pace);
      return sum + (paceSec > 0 ? r.distance * (paceSec / 60) : r.distance * 6);
    }, 0);

    const validPaces = weekRuns.filter((r) => parsePace(r.pace) > 0);
    const avgPaceSec =
      validPaces.length > 0
        ? validPaces.reduce((sum, r) => sum + parsePace(r.pace), 0) / validPaces.length
        : 0;

    const longestRun = weekRuns.length > 0 ? Math.max(...weekRuns.map((r) => r.distance)) : 0;

    // 计算有训练的天数（同一天多次算一天）
    const trainingDays = new Set(weekRuns.map((r) => r.date)).size;
    const restDays = 7 - trainingDays;

    reports.push({
      weekEnding: weekEnd.toISOString().split("T")[0],
      weekRange: `${formatDate(weekStart)}-${formatDate(weekEnd)}`,
      totalDistance: Math.round(totalDistance * 10) / 10,
      avgPace: avgPaceSec > 0 ? formatPace(avgPaceSec) : "-",
      totalDuration: Math.round(totalDuration),
      runsCount: weekRuns.length,
      longestRun: Math.round(longestRun * 10) / 10,
      restDays,
    });
  }

  return reports;
}

/** 获取该周周日（周日为一周结束） */
function getWeekEnd(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=周日, 1=周一...
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
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
