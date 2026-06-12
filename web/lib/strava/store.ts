/**
 * Strava Token 存储
 * 使用 Upstash Redis 保存 access_token / refresh_token
 * 
 * 回退到固定 key：不依赖 userId，因为 Strava OAuth 是独立的认证流程，
 * 与 NextAuth 分开。callback 和 status/sync 使用同一个 key。
 */

import { Redis } from "@upstash/redis";
import { isRedisConfigured } from "../storage/upstash.js";

const redis = Redis.fromEnv();

const KEY_STRAVA_TOKEN = "runcoach:strava:token";
const KEY_STRAVA_CONNECTION = "runcoach:strava:connection";

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
export async function saveStravaToken(data: StravaTokenData): Promise<void> {
  if (!isRedisConfigured()) throw new Error("Redis 未配置，无法保存 Strava Token");
  await redis.set(KEY_STRAVA_TOKEN, data);
}

/** 加载 Token */
export async function loadStravaToken(): Promise<StravaTokenData | null> {
  if (!isRedisConfigured()) return null;
  return await redis.get<StravaTokenData>(KEY_STRAVA_TOKEN);
}

/** 删除 Token（断开连接） */
export async function deleteStravaToken(): Promise<void> {
  if (!isRedisConfigured()) return;
  await redis.del(KEY_STRAVA_TOKEN);
  await redis.del(KEY_STRAVA_CONNECTION);
}

/** 保存连接状态 */
export async function saveStravaConnection(data: {
  athleteId: number;
  athleteName: string;
  profileImage?: string;
  lastSyncAt?: string;
  totalActivities?: number;
}): Promise<void> {
  if (!isRedisConfigured()) return;
  await redis.set(KEY_STRAVA_CONNECTION, data);
}

/** 加载连接状态 */
export async function loadStravaConnection(): Promise<{
  athleteId: number;
  athleteName: string;
  profileImage?: string;
  lastSyncAt?: string;
  totalActivities?: number;
} | null> {
  if (!isRedisConfigured()) return null;
  return await redis.get(KEY_STRAVA_CONNECTION);
}

/** 获取有效的 access_token（自动刷新） */
export async function getValidAccessToken(): Promise<string | null> {
  const tokenData = await loadStravaToken();
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
      await saveStravaToken(updated);
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
export async function updateLastSync(totalActivities: number): Promise<void> {
  const conn = await loadStravaConnection();
  if (conn) {
    conn.lastSyncAt = new Date().toISOString();
    conn.totalActivities = totalActivities;
    await saveStravaConnection(conn);
  }
}
