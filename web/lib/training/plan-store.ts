/**
 * 训练计划持久化存储
 * 供 plan API、reminder API、cron 共享使用
 */

import { Redis } from "@upstash/redis";
import { isRedisConfigured } from "../storage/upstash.js";
import type { TrainingPlan } from "./plan-types.js";

const redis = Redis.fromEnv();
const KEY_PLAN = "runcoach:plan:current";

// 内存回退（仅单实例有效）
let memoryPlan: TrainingPlan | null = null;

/** 保存当前训练计划 */
export async function savePlan(plan: TrainingPlan): Promise<void> {
  memoryPlan = plan;
  if (isRedisConfigured()) {
    await redis.set(KEY_PLAN, plan);
  }
}

/** 加载当前训练计划 */
export async function loadPlan(): Promise<TrainingPlan | null> {
  if (isRedisConfigured()) {
    const plan = await redis.get<TrainingPlan>(KEY_PLAN);
    if (plan) {
      memoryPlan = plan;
      return plan;
    }
  }
  return memoryPlan;
}

/** 清除当前计划 */
export async function clearPlan(): Promise<void> {
  memoryPlan = null;
  if (isRedisConfigured()) {
    await redis.del(KEY_PLAN);
  }
}
