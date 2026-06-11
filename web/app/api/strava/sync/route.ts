/**
 * Strava 数据同步 API
 * POST /api/strava/sync
 * 拉取最近跑步活动，清洗后存入 Redis
 */

import { NextResponse } from "next/server";
import { getAllRunActivities } from "@/lib/strava/api";
import { normalizeActivities, toRunLog } from "@/lib/strava/normalize";
import { loadStravaToken, updateLastSync } from "@/lib/strava/store";
import { saveRuns } from "@/lib/memory/store";

export async function POST() {
  try {
    const tokenData = await loadStravaToken();
    if (!tokenData) {
      return NextResponse.json(
        { error: "Strava 未连接，请先授权" },
        { status: 401 }
      );
    }

    // 检查 token 是否过期，如过期则刷新（简化版：暂不实现刷新）
    const now = Math.floor(Date.now() / 1000);
    if (tokenData.expiresAt < now + 300) {
      // Token 即将过期，这里应该调用 refreshToken
      // 为简化先返回错误，后续可补充刷新逻辑
      return NextResponse.json(
        { error: "Token 已过期，请重新连接 Strava" },
        { status: 401 }
      );
    }

    // 拉取最近 30 天的跑步活动
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;
    const activities = await getAllRunActivities(tokenData.accessToken, {
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

    // 更新同步状态
    await updateLastSync(normalized.length);

    return NextResponse.json({
      success: true,
      message: `成功同步 ${normalized.length} 条跑步记录`,
      synced: normalized.length,
      latest: normalized[0],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
