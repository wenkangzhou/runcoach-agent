/**
 * 持久化存储
 * Day 4: 加入 Memory，让 Agent 记住用户状态
 * 
 * 优先级: Upstash Redis (Vercel) > 本地 JSON 文件 (本地开发) > 内存 (fallback)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { MemoryState, UserProfile, RunLog } from "../core/types.js";
import {
  isRedisConfigured,
  loadProfileRedis,
  saveProfileRedis,
  loadRunsRedis,
  saveRunsRedis,
  addRunRedis,
} from "../storage/upstash.js";

const IS_VERCEL = !!process.env.VERCEL;

const MEMORY_DIR = join(process.cwd(), "data");

function getProfilePath(userId: string): string {
  return join(MEMORY_DIR, `profile-${userId}.json`);
}

function getRunsPath(userId: string): string {
  return join(MEMORY_DIR, `recent_runs-${userId}.json`);
}

/** 默认用户画像 */
const DEFAULT_PROFILE: UserProfile = {
  goal: "全马 3:20-3:25",
  weeklyMileage: "150-200km/month",
  availableTime: "weekday morning or late night",
  issues: ["30km cramp", "calf tightness", "heat sensitive"],
};

/** 默认最近训练记录 */
const DEFAULT_RUNS: RunLog[] = [
  {
    date: "2026-06-08",
    distance: 8,
    pace: "5:40",
    hr: 145,
    feeling: "tired",
    notes: "工作日晚跑，睡眠不足",
  },
  {
    date: "2026-06-06",
    distance: 15,
    pace: "5:20",
    hr: 152,
    feeling: "good",
    notes: "周末长距离，后半程小腿紧",
  },
];

// ========== 内存缓存（按用户隔离，用于减少 Redis 调用） ==========

const cacheProfileMap = new Map<string, UserProfile | null>();
const cacheRunsMap = new Map<string, RunLog[] | null>();
const cacheLoadedSet = new Set<string>();

async function initCache(userId: string): Promise<void> {
  if (cacheLoadedSet.has(userId)) return;
  cacheLoadedSet.add(userId);

  if (isRedisConfigured()) {
    const profile = await loadProfileRedis(userId);
    const runs = await loadRunsRedis(userId);
    cacheProfileMap.set(userId, profile || { ...DEFAULT_PROFILE });
    cacheRunsMap.set(userId, runs || DEFAULT_RUNS.map((r) => ({ ...r })));
    return;
  }

  if (IS_VERCEL) {
    cacheProfileMap.set(userId, { ...DEFAULT_PROFILE });
    cacheRunsMap.set(userId, DEFAULT_RUNS.map((r) => ({ ...r })));
    return;
  }

  // 本地开发: 从文件加载
  initFileStorage(userId);
  cacheProfileMap.set(userId, loadJson<UserProfile>(getProfilePath(userId)));
  cacheRunsMap.set(userId, loadJson<RunLog[]>(getRunsPath(userId)));
}

// ========== 文件系统存储 ==========

function initFileStorage(userId: string): void {
  const profilePath = getProfilePath(userId);
  const runsPath = getRunsPath(userId);
  if (!existsSync(profilePath)) {
    saveJson(profilePath, DEFAULT_PROFILE);
  }
  if (!existsSync(runsPath)) {
    saveJson(runsPath, DEFAULT_RUNS);
  }
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function saveJson<T>(path: string, data: T): void {
  writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
}

// ========== 统一接口（全部 async） ==========

/** 加载用户画像 */
export async function loadProfile(userId: string = "anonymous"): Promise<UserProfile> {
  await initCache(userId);
  return cacheProfileMap.get(userId)!;
}

/** 保存用户画像 */
export async function saveProfile(profile: UserProfile, userId: string = "anonymous"): Promise<void> {
  cacheProfileMap.set(userId, profile);
  if (isRedisConfigured()) {
    await saveProfileRedis(profile, userId);
    return;
  }
  if (!IS_VERCEL) {
    saveJson(getProfilePath(userId), profile);
  }
}

/** 更新用户画像（部分更新） */
export async function updateProfile(updates: Partial<UserProfile>, userId: string = "anonymous"): Promise<void> {
  const profile = await loadProfile(userId);
  Object.assign(profile, updates);
  await saveProfile(profile, userId);
}

/** 加载最近训练记录 */
export async function loadRuns(userId: string = "anonymous"): Promise<RunLog[]> {
  await initCache(userId);
  // 防御：如果缓存被意外设为 null，重新加载
  if (cacheRunsMap.get(userId) == null) {
    cacheLoadedSet.delete(userId);
    await initCache(userId);
  }
  return cacheRunsMap.get(userId)!;
}

/** 保存训练记录 */
export async function saveRuns(runs: RunLog[], userId: string = "anonymous"): Promise<void> {
  cacheRunsMap.set(userId, runs);
  if (isRedisConfigured()) {
    await saveRunsRedis(runs, userId);
    return;
  }
  if (!IS_VERCEL) {
    saveJson(getRunsPath(userId), runs);
  }
}

/** 添加一条训练记录 */
export async function addRun(run: RunLog, userId: string = "anonymous"): Promise<void> {
  if (isRedisConfigured()) {
    await addRunRedis(run, userId);
    // 刷新缓存
    const fresh = await loadRunsRedis(userId);
    cacheRunsMap.set(userId, fresh || []);
    return;
  }
  const runs = await loadRuns(userId);
  runs.unshift(run);
  if (runs.length > 20) runs.length = 20;
  await saveRuns(runs, userId);
}

/** 加载完整记忆状态 */
export async function loadMemory(userId: string = "anonymous"): Promise<MemoryState> {
  const [profile, recentRuns] = await Promise.all([loadProfile(userId), loadRuns(userId)]);
  return { profile, recentRuns };
}

/** 格式化记忆为文本（放入 LLM 上下文） */
export function formatMemoryForContext(memory: MemoryState): string {
  const { profile, recentRuns } = memory;

  const runsText = recentRuns
    .slice(0, 5)
    .map(
      (r) =>
        `- ${r.date}: ${r.distance}km, 配速${r.pace}, 心率${r.hr || "-"}, 感受: ${r.feeling}${r.notes ? ` (${r.notes})` : ""}`
    )
    .join("\n");

  return `【用户画像】
目标: ${profile.goal}
周跑量: ${profile.weeklyMileage}
可用时间: ${profile.availableTime}
注意事项: ${profile.issues.join(", ")}

【最近训练】
${runsText || "无记录"}`;
}
