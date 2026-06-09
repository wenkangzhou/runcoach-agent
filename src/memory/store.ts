/**
 * 简单内存存储
 * Day 4: 加入 Memory，让 Agent 记住用户状态
 * 
 * 当前实现: 本地 JSON 文件
 * 后续可替换为 SQLite / 向量数据库
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { MemoryState, UserProfile, RunLog } from "../core/types.js";

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

/** 初始化存储文件 */
function initStorage(): void {
  if (!existsSync(PROFILE_PATH)) {
    saveProfile(DEFAULT_PROFILE);
  }
  if (!existsSync(RUNS_PATH)) {
    saveRuns(DEFAULT_RUNS);
  }
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function saveJson<T>(path: string, data: T): void {
  writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
}

/** 加载用户画像 */
export function loadProfile(): UserProfile {
  initStorage();
  return loadJson<UserProfile>(PROFILE_PATH);
}

/** 保存用户画像 */
export function saveProfile(profile: UserProfile): void {
  saveJson(PROFILE_PATH, profile);
}

/** 加载最近训练记录 */
export function loadRuns(): RunLog[] {
  initStorage();
  return loadJson<RunLog[]>(RUNS_PATH);
}

/** 保存训练记录 */
export function saveRuns(runs: RunLog[]): void {
  saveJson(RUNS_PATH, runs);
}

/** 添加一条训练记录 */
export function addRun(run: RunLog): void {
  const runs = loadRuns();
  runs.unshift(run); // 最新的在前面
  // 只保留最近 20 条
  if (runs.length > 20) runs.length = 20;
  saveRuns(runs);
}

/** 加载完整记忆状态 */
export function loadMemory(): MemoryState {
  return {
    profile: loadProfile(),
    recentRuns: loadRuns(),
  };
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
