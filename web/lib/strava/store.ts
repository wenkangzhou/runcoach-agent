/**
 * Strava Token 存储
 * 使用 Upstash Redis 保存 access_token / refresh_token
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

/** 更新同步时间 */
export async function updateLastSync(totalActivities: number): Promise<void> {
  const conn = await loadStravaConnection();
  if (conn) {
    conn.lastSyncAt = new Date().toISOString();
    conn.totalActivities = totalActivities;
    await saveStravaConnection(conn);
  }
}
