/**
 * Strava OAuth 回调处理
 * GET /api/strava/callback?code=xxx&scope=xxx
 */

import { NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/strava/api";
import { saveStravaToken, saveStravaConnection } from "@/lib/strava/store";

export const dynamic = "force-dynamic";

function getBaseUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3675";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const baseUrl = getBaseUrl();

    if (error) {
      return NextResponse.redirect(
        `${baseUrl}/?strava_error=${encodeURIComponent(error)}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${baseUrl}/?strava_error=${encodeURIComponent("未收到授权码")}`
      );
    }

    // 用 code 换 token
    const tokenRes = await exchangeCodeForToken(code);

    // 保存 token
    await saveStravaToken({
      accessToken: tokenRes.access_token,
      refreshToken: tokenRes.refresh_token,
      expiresAt: tokenRes.expires_at,
      athleteId: tokenRes.athlete.id,
      athleteName: `${tokenRes.athlete.firstname} ${tokenRes.athlete.lastname}`.trim(),
      profileImage: tokenRes.athlete.profile,
    });

    // 保存连接状态
    await saveStravaConnection({
      athleteId: tokenRes.athlete.id,
      athleteName: `${tokenRes.athlete.firstname} ${tokenRes.athlete.lastname}`.trim(),
      profileImage: tokenRes.athlete.profile,
    });

    // 跳回首页，带上成功标记
    return NextResponse.redirect(`${baseUrl}/?strava_connected=1`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const baseUrl = getBaseUrl();
    return NextResponse.redirect(
      `${baseUrl}/?strava_error=${encodeURIComponent(message)}`
    );
  }
}
