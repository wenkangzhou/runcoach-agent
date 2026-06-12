/**
 * Upstash Redis 持久化存储封装
 * Serverless 友好的 HTTP Redis（无需 TCP 连接）
 *
 * 免费额度: 10,000 commands/day
 * 数据量估算:
 *   - 用户画像: ~500 bytes
 *   - 训练记录(20条): ~2 KB
 *   - 向量库索引: 每次冷启动重建，不持久化
 */

import { Redis } from "@upstash/redis";
import type { UserProfile, RunLog } from "../core/types.js";

const redis = Redis.fromEnv();

/** 生成用户隔离的 Redis key */
export function getUserKey(userId: string, suffix: string): string {
  return `runcoach:user:${userId}:${suffix}`;
}

/** 检查 Redis 是否配置 */
export function isRedisConfigured(): boolean {
  return !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
}

/** 保存用户画像 */
export async function saveProfileRedis(profile: UserProfile, userId: string = "anonymous"): Promise<void> {
  await redis.set(getUserKey(userId, "profile"), profile);
}

/** 加载用户画像 */
export async function loadProfileRedis(userId: string = "anonymous"): Promise<UserProfile | null> {
  return await redis.get<UserProfile>(getUserKey(userId, "profile"));
}

/** 保存训练记录 */
export async function saveRunsRedis(runs: RunLog[], userId: string = "anonymous"): Promise<void> {
  await redis.set(getUserKey(userId, "runs"), runs);
}

/** 加载训练记录 */
export async function loadRunsRedis(userId: string = "anonymous"): Promise<RunLog[] | null> {
  return await redis.get<RunLog[]>(getUserKey(userId, "runs"));
}

/** 添加单条训练记录 */
export async function addRunRedis(run: RunLog, userId: string = "anonymous"): Promise<void> {
  const runs = (await loadRunsRedis(userId)) || [];
  runs.unshift(run);
  if (runs.length > 20) runs.length = 20;
  await saveRunsRedis(runs, userId);
}
