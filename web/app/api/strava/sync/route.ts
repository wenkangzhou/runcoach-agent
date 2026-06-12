/**
 * Strava 数据同步 API
 * POST /api/strava/sync
 * 拉取最近跑步活动，清洗后存入 Redis
 * 如果有训练计划，自动匹配并标记完成
 */

import { NextResponse } from "next/server";
import { getAllRunActivities } from "@/lib/strava/api";
import { normalizeActivities, toRunLog } from "@/lib/strava/normalize";
import { getValidAccessToken, updateLastSync } from "@/lib/strava/store";
import { saveRuns } from "@/lib/memory/store";
import { loadPlan, savePlan } from "@/lib/training/plan-store";
import type { DayPlan } from "@/lib/training/plan-types";

export async function POST() {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return NextResponse.json(
        { error: "Strava 未连接或 Token 已过期，请重新授权" },
        { status: 401 }
      );
    }

    // 拉取最近 30 天的跑步活动
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;
    const activities = await getAllRunActivities(accessToken, {
      after: thirtyDaysAgo,
      maxPages: 5,
    });

    if (activities.length === 0) {
      await updateLastSync(0);
      return NextResponse.json({
        success: true,
        message: "最近 30 天没有跑步记录",
        synced: 0,
      });
    }

    // 清洗数据
    const normalized = normalizeActivities(activities);
    const runLogs = normalized.map(toRunLog);

    // 保存到 Redis（覆盖现有 runs）
    await saveRuns(runLogs);

    // 自动匹配训练计划
    let matchedCount = 0;
    const plan = await loadPlan();
    if (plan) {
      const startDate = new Date(plan.startDate);
      const endDate = new Date(plan.endDate);

      for (const run of normalized) {
        const runDate = new Date(run.date);
        if (runDate < startDate || runDate > endDate) continue;

        const diffDays = Math.floor(
          (runDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const weekIndex = Math.floor(diffDays / 7);
        const dayIndex = diffDays % 7;

        if (weekIndex >= 0 && weekIndex < plan.weeks.length) {
          const week = plan.weeks[weekIndex];
          if (dayIndex >= 0 && dayIndex < week.days.length) {
            const day = week.days[dayIndex];
            if (day.type !== "休息" && (!day.status || day.status === "scheduled")) {
              const updatedDay: DayPlan = {
                ...day,
                status: "completed",
                actualDistance: run.distance,
                actualPace: run.pace,
                actualDuration: `${Math.round(run.duration)}min`,
                actualHr: run.avgHr,
                feeling: run.feeling,
                completedAt: new Date().toISOString(),
              };
              week.days[dayIndex] = updatedDay;
              matchedCount++;
            }
          }
        }
      }

      if (matchedCount > 0) {
        await savePlan(plan);
      }
    }

    // 更新同步状态
    await updateLastSync(normalized.length);

    return NextResponse.json({
      success: true,
      message: `成功同步 ${normalized.length} 条跑步记录` + (matchedCount > 0 ? `，自动匹配 ${matchedCount} 条训练计划` : ""),
      synced: normalized.length,
      matched: matchedCount,
      latest: normalized[0],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
