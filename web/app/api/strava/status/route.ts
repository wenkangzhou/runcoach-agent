/**
 * Strava 连接状态查询
 * GET /api/strava/status
 */

import { NextResponse } from "next/server";
import { loadStravaConnection } from "@/lib/strava/store";
import type { StravaConnection } from "@/lib/strava/types";

export async function GET() {
  try {
    const conn = await loadStravaConnection();

    const status: StravaConnection = conn
      ? {
          connected: true,
          athleteId: conn.athleteId,
          athleteName: conn.athleteName,
          profileImage: conn.profileImage,
          lastSyncAt: conn.lastSyncAt,
          totalActivities: conn.totalActivities,
        }
      : { connected: false };

    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
