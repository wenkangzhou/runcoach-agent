/**
 * Strava Token 存储
 * 使用 Upstash Redis 保存 access_token / refresh_token
 */

import { Redis } from "@upstash/redis";
import { isRedisConfigured, getUserKey } from "../storage/upstash.js";

const redis = Redis.fromEnv();

/** Strava Token 数据 */
interface StravaTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;      // Unix 时间戳
  athleteId: number;
  athleteName: string;
  profileImage?: string;
}

/** 保存 Token */
export async function saveStravaToken(data: StravaTokenData, userId: string = "anonymous"): Promise<void> {
  if (!isRedisConfigured()) throw new Error("Redis 未配置，无法保存 Strava Token");
  await redis.set(getUserKey(userId, "strava:token"), data);
}

/** 加载 Token */
export async function loadStravaToken(userId: string = "anonymous"): Promise<StravaTokenData | null> {
  if (!isRedisConfigured()) return null;
  return await redis.get<StravaTokenData>(getUserKey(userId, "strava:token"));
}

/** 删除 Token（断开连接） */
export async function deleteStravaToken(userId: string = "anonymous"): Promise<void> {
  if (!isRedisConfigured()) return;
  await redis.del(getUserKey(userId, "strava:token"));
  await redis.del(getUserKey(userId, "strava:connection"));
}

/** 保存连接状态 */
export async function saveStravaConnection(
  data: {
    athleteId: number;
    athleteName: string;
    profileImage?: string;
    lastSyncAt?: string;
    totalActivities?: number;
  },
  userId: string = "anonymous"
): Promise<void> {
  if (!isRedisConfigured()) return;
  await redis.set(getUserKey(userId, "strava:connection"), data);
}

/** 加载连接状态 */
export async function loadStravaConnection(userId: string = "anonymous"): Promise<{
  athleteId: number;
  athleteName: string;
  profileImage?: string;
  lastSyncAt?: string;
  totalActivities?: number;
} | null> {
  if (!isRedisConfigured()) return null;
  return await redis.get(getUserKey(userId, "strava:connection"));
}

/** 获取有效的 access_token（自动刷新） */
export async function getValidAccessToken(userId: string = "anonymous"): Promise<string | null> {
  const tokenData = await loadStravaToken(userId);
  if (!tokenData) return null;

  const now = Math.floor(Date.now() / 1000);
  // 提前 5 分钟刷新，避免边界情况
  if (tokenData.expiresAt < now + 300) {
    try {
      const { refreshToken } = await import("./api.js");
      const refreshed = await refreshToken(tokenData.refreshToken);
      // 更新存储
      const updated: StravaTokenData = {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        expiresAt: refreshed.expires_at,
        athleteId: tokenData.athleteId,
        athleteName: tokenData.athleteName,
        profileImage: tokenData.profileImage,
      };
      await saveStravaToken(updated, userId);
      return refreshed.access_token;
    } catch (err) {
      console.error("Strava token refresh failed:", err);
      // 刷新失败，返回 null 让调用方处理
      return null;
    }
  }

  return tokenData.accessToken;
}

/** 更新同步时间 */
export async function updateLastSync(totalActivities: number, userId: string = "anonymous"): Promise<void> {
  const conn = await loadStravaConnection(userId);
  if (conn) {
    conn.lastSyncAt = new Date().toISOString();
    conn.totalActivities = totalActivities;
    await saveStravaConnection(conn, userId);
  }
}
