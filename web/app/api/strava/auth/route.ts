/**
 * Strava OAuth 授权入口
 * GET /api/strava/auth
 */

import { NextResponse } from "next/server";
import { getStravaAuthUrl } from "@/lib/strava/api";

export async function GET() {
  try {
    // 生产环境回调地址
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3675";

    const redirectUri = `${baseUrl}/api/strava/callback`;
    const authUrl = getStravaAuthUrl(redirectUri);

    return NextResponse.redirect(authUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
