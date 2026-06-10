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

const KEY_PROFILE = "runcoach:profile";
const KEY_RUNS = "runcoach:runs";

/** 检查 Redis 是否配置 */
export function isRedisConfigured(): boolean {
  return !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
}

/** 保存用户画像 */
export async function saveProfileRedis(profile: UserProfile): Promise<void> {
  await redis.set(KEY_PROFILE, profile);
}

/** 加载用户画像 */
export async function loadProfileRedis(): Promise<UserProfile | null> {
  return await redis.get<UserProfile>(KEY_PROFILE);
}

/** 保存训练记录 */
export async function saveRunsRedis(runs: RunLog[]): Promise<void> {
  await redis.set(KEY_RUNS, runs);
}

/** 加载训练记录 */
export async function loadRunsRedis(): Promise<RunLog[] | null> {
  return await redis.get<RunLog[]>(KEY_RUNS);
}

/** 添加单条训练记录 */
export async function addRunRedis(run: RunLog): Promise<void> {
  const runs = (await loadRunsRedis()) || [];
  runs.unshift(run);
  if (runs.length > 20) runs.length = 20;
  await saveRunsRedis(runs);
}
