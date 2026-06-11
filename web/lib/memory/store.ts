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
const PROFILE_PATH = join(MEMORY_DIR, "profile.json");
const RUNS_PATH = join(MEMORY_DIR, "recent_runs.json");

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

// ========== 内存缓存（用于减少 Redis 调用） ==========

let cacheProfile: UserProfile | null = null;
let cacheRuns: RunLog[] | null = null;
let cacheLoaded = false;

async function initCache(): Promise<void> {
  if (cacheLoaded) return;
  cacheLoaded = true;

  if (isRedisConfigured()) {
    const profile = await loadProfileRedis();
    const runs = await loadRunsRedis();
    cacheProfile = profile || { ...DEFAULT_PROFILE };
    cacheRuns = runs || DEFAULT_RUNS.map((r) => ({ ...r }));
    return;
  }

  if (IS_VERCEL) {
    cacheProfile = { ...DEFAULT_PROFILE };
    cacheRuns = DEFAULT_RUNS.map((r) => ({ ...r }));
    return;
  }

  // 本地开发: 从文件加载
  initFileStorage();
  cacheProfile = loadJson<UserProfile>(PROFILE_PATH);
  cacheRuns = loadJson<RunLog[]>(RUNS_PATH);
}

// ========== 文件系统存储 ==========

function initFileStorage(): void {
  if (!existsSync(PROFILE_PATH)) {
    saveJson(PROFILE_PATH, DEFAULT_PROFILE);
  }
  if (!existsSync(RUNS_PATH)) {
    saveJson(RUNS_PATH, DEFAULT_RUNS);
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
export async function loadProfile(): Promise<UserProfile> {
  await initCache();
  return cacheProfile!;
}

/** 保存用户画像 */
export async function saveProfile(profile: UserProfile): Promise<void> {
  cacheProfile = profile;
  if (isRedisConfigured()) {
    await saveProfileRedis(profile);
    return;
  }
  if (!IS_VERCEL) {
    saveJson(PROFILE_PATH, profile);
  }
}

/** 更新用户画像（部分更新） */
export async function updateProfile(updates: Partial<UserProfile>): Promise<void> {
  const profile = await loadProfile();
  Object.assign(profile, updates);
  await saveProfile(profile);
}

/** 加载最近训练记录 */
export async function loadRuns(): Promise<RunLog[]> {
  await initCache();
  // 防御：如果缓存被意外设为 null，重新加载
  if (cacheRuns == null) {
    cacheLoaded = false;
    await initCache();
  }
  return cacheRuns!;
}

/** 保存训练记录 */
export async function saveRuns(runs: RunLog[]): Promise<void> {
  cacheRuns = runs;
  if (isRedisConfigured()) {
    await saveRunsRedis(runs);
    return;
  }
  if (!IS_VERCEL) {
    saveJson(RUNS_PATH, runs);
  }
}

/** 添加一条训练记录 */
export async function addRun(run: RunLog): Promise<void> {
  if (isRedisConfigured()) {
    await addRunRedis(run);
    // 刷新缓存
    const fresh = await loadRunsRedis();
    cacheRuns = fresh || [];
    return;
  }
  const runs = await loadRuns();
  runs.unshift(run);
  if (runs.length > 20) runs.length = 20;
  await saveRuns(runs);
}

/** 加载完整记忆状态 */
export async function loadMemory(): Promise<MemoryState> {
  const [profile, recentRuns] = await Promise.all([loadProfile(), loadRuns()]);
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
