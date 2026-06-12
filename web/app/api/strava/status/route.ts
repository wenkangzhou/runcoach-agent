/**
 * Strava 连接状态查询
 * GET /api/strava/status
 */

import { NextResponse } from "next/server";
import { loadStravaConnection, getValidAccessToken } from "@/lib/strava/store";
import type { StravaConnection } from "@/lib/strava/types";

export async function GET() {
  try {
    const conn = await loadStravaConnection();

    if (conn) {
      return NextResponse.json({
        connected: true,
        athleteId: conn.athleteId,
        athleteName: conn.athleteName,
        profileImage: conn.profileImage,
        lastSyncAt: conn.lastSyncAt,
        totalActivities: conn.totalActivities,
      });
    }

    // 如果 connection 不存在，检查 token 是否存在（兼容 signIn 回调只保存了 token 的情况）
    const token = await getValidAccessToken();
    if (token) {
      return NextResponse.json({
        connected: true,
        athleteName: "Strava 用户",
        lastSyncAt: null,
        totalActivities: null,
      });
    }

    return NextResponse.json({ connected: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
