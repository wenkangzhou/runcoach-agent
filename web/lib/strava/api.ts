/**
 * Strava API 封装
 * 处理 OAuth、活动拉取、Token 刷新
 */

import type { StravaActivity, StravaTokenResponse, StravaAthlete } from "./types.js";

const STRAVA_API_BASE = "https://www.strava.com/api/v3";

/** 获取 Strava 环境变量 */
function getEnv() {
  const clientId = process.env.STRAVA_CLIENT_ID || process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("STRAVA_CLIENT_ID (或 NEXT_PUBLIC_STRAVA_CLIENT_ID) 和 STRAVA_CLIENT_SECRET 未配置");
  }
  return { clientId, clientSecret };
}

/** 生成 Strava OAuth 授权 URL */
export function getStravaAuthUrl(redirectUri: string, state?: string): string {
  const { clientId } = getEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read",
  });
  if (state) params.set("state", state);
  return `https://www.strava.com/oauth/authorize?${params.toString()}`;
}

/** 用 code 换取 access_token */
export async function exchangeCodeForToken(
  code: string
): Promise<StravaTokenResponse> {
  const { clientId, clientSecret } = getEnv();
  const res = await fetch(`${STRAVA_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Strava token exchange failed: ${res.status} ${err}`);
  }
  return res.json();
}

/** 刷新 access_token */
export async function refreshToken(
  refreshToken: string
): Promise<StravaTokenResponse> {
  const { clientId, clientSecret } = getEnv();
  const res = await fetch(`${STRAVA_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Strava refresh token failed: ${res.status} ${err}`);
  }
  return res.json();
}

/** 获取当前运动员信息 */
export async function getAthlete(accessToken: string): Promise<StravaAthlete> {
  const res = await fetch(`${STRAVA_API_BASE}/athlete`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`getAthlete failed: ${res.status}`);
  return res.json();
}

/** 获取活动列表 */
export async function getActivities(
  accessToken: string,
  options: {
    before?: number;   // Unix 时间戳
    after?: number;    // Unix 时间戳
    page?: number;
    perPage?: number;
  } = {}
): Promise<StravaActivity[]> {
  const { before, after, page = 1, perPage = 200 } = options;
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(Math.min(perPage, 200)),
  });
  if (before) params.set("before", String(before));
  if (after) params.set("after", String(after));

  const res = await fetch(`${STRAVA_API_BASE}/athlete/activities?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`getActivities failed: ${res.status}`);
  return res.json();
}

/** 获取单个活动详情 */
export async function getActivityDetail(
  accessToken: string,
  activityId: number
): Promise<StravaActivity> {
  const res = await fetch(`${STRAVA_API_BASE}/activities/${activityId}?include_all_efforts=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`getActivityDetail failed: ${res.status}`);
  return res.json();
}

/** 获取所有跑步活动（自动分页） */
export async function getAllRunActivities(
  accessToken: string,
  options: {
    after?: number;
    before?: number;
    maxPages?: number;
  } = {}
): Promise<StravaActivity[]> {
  const { after, before, maxPages = 5 } = options;
  const all: StravaActivity[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const activities = await getActivities(accessToken, { page, perPage: 200, after, before });
    if (activities.length === 0) break;

    const runs = activities.filter(
      (a) => a.type === "Run" || a.sport_type === "Run"
    );
    all.push(...runs);

    // 如果本页不足 200 条，说明已经到末尾
    if (activities.length < 200) break;
  }

  return all;
}
