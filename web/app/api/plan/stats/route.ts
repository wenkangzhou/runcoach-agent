/**
 * API 路由: /api/plan/stats
 * GET: 返回计划执行统计
 */

import { NextResponse } from "next/server";
import { loadPlan } from "@/lib/training/plan-store";
import type { WeekStats } from "@/lib/training/plan-types";

export async function GET() {
  try {
    const plan = await loadPlan();
    if (!plan) {
      return NextResponse.json(
        { success: true, hasPlan: false, message: "暂无活跃计划" },
        { status: 200 }
      );
    }

    let totalPlanned = 0;
    let totalActual = 0;
    let totalCompletedDays = 0;
    let totalSkippedDays = 0;
    let totalScheduledDays = 0;
    let streakDays = 0;
    let currentStreak = 0;

    const weekStats: WeekStats[] = [];

    for (const week of plan.weeks) {
      let weekActual = 0;
      let weekCompleted = 0;
      let weekSkipped = 0;
      let weekTotal = 0;

      for (const day of week.days) {
        if (day.type === "休息") continue;

        weekTotal++;
        totalScheduledDays++;
        totalPlanned += day.distance || 0;

        if (day.status === "completed") {
          weekCompleted++;
          totalCompletedDays++;
          const actual = day.actualDistance ?? day.distance;
          weekActual += actual;
          totalActual += actual;
          currentStreak++;
          streakDays = Math.max(streakDays, currentStreak);
        } else if (day.status === "partial") {
          weekCompleted++;
          totalCompletedDays++;
          const actual = day.actualDistance ?? day.distance * 0.5;
          weekActual += actual;
          totalActual += actual;
          currentStreak = 0;
        } else if (day.status === "skipped") {
          weekSkipped++;
          totalSkippedDays++;
          currentStreak = 0;
        } else {
          currentStreak = 0;
        }
      }

      const completionRate = weekTotal > 0
        ? Math.round((weekCompleted / weekTotal) * 100)
        : 0;

      weekStats.push({
        weekNumber: week.weekNumber,
        plannedDistance: Math.round(week.totalDistance * 10) / 10,
        actualDistance: Math.round(weekActual * 10) / 10,
        completionRate,
        completedDays: weekCompleted,
        skippedDays: weekSkipped,
        totalDays: weekTotal,
      });
    }

    const overallCompletionRate = totalScheduledDays > 0
      ? Math.round((totalCompletedDays / totalScheduledDays) * 100)
      : 0;

    // 计算当前周（基于 startDate）
    const startDate = new Date(plan.startDate);
    const today = new Date();
    const diffDays = Math.floor(
      (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const currentWeek = Math.max(1, Math.min(plan.totalWeeks, Math.floor(diffDays / 7) + 1));

    return NextResponse.json({
      success: true,
      hasPlan: true,
      overallCompletionRate,
      currentWeek,
      weekStats,
      streakDays,
      totalPlanned: Math.round(totalPlanned * 10) / 10,
      totalActual: Math.round(totalActual * 10) / 10,
      totalScheduledDays,
      totalCompletedDays,
      totalSkippedDays,
    });
  } catch (error) {
    console.error("Stats API 错误:", error);
    return NextResponse.json(
      { error: "获取统计失败", detail: String(error) },
      { status: 500 }
    );
  }
}
