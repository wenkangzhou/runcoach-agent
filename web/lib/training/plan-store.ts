/**
 * 训练计划持久化存储
 * 供 plan API、reminder API、cron 共享使用
 */

import { Redis } from "@upstash/redis";
import { isRedisConfigured, getUserKey } from "../storage/upstash.js";
import type { TrainingPlan } from "./plan-types.js";

const redis = Redis.fromEnv();

// 内存回退（仅单实例有效，按用户隔离）
const memoryPlanMap = new Map<string, TrainingPlan | null>();

/** 保存当前训练计划 */
export async function savePlan(plan: TrainingPlan, userId: string = "anonymous"): Promise<void> {
  memoryPlanMap.set(userId, plan);
  if (isRedisConfigured()) {
    await redis.set(getUserKey(userId, "plan:current"), plan);
  }
}

/** 加载当前训练计划 */
export async function loadPlan(userId: string = "anonymous"): Promise<TrainingPlan | null> {
  if (isRedisConfigured()) {
    const plan = await redis.get<TrainingPlan>(getUserKey(userId, "plan:current"));
    if (plan) {
      memoryPlanMap.set(userId, plan);
      return plan;
    }
  }
  return memoryPlanMap.get(userId) || null;
}

/** 清除当前计划 */
export async function clearPlan(userId: string = "anonymous"): Promise<void> {
  memoryPlanMap.set(userId, null);
  if (isRedisConfigured()) {
    await redis.del(getUserKey(userId, "plan:current"));
  }
}
