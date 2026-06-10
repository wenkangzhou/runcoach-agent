/**
 * 记忆自动更新
 * Day 4: 从对话中提取新信息更新 profile
 * 
 * 规则：
 * 1. 用户明确说"我换了..."、"我的目标是..." → 更新 profile
 * 2. 用户提到新的伤病 → 添加到 issues
 * 3. 用户提到时间变化 → 更新 availableTime
 */

import type { UserProfile } from "../core/types.js";
import { loadProfile, saveProfile } from "./store.js";

/** 可更新的 profile 字段 */
export type ProfileField = "goal" | "weeklyMileage" | "availableTime" | "issues" | "preferredPace" | "experience";

/** 更新记录 */
export interface ProfileUpdate {
  field: ProfileField;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
}

/** 从用户输入中提取 profile 更新 */
export function extractProfileUpdates(userInput: string): ProfileUpdate[] {
  const updates: ProfileUpdate[] = [];
  const current = loadProfile();
  const text = userInput.toLowerCase();

  // 1. 目标更新 - 严格匹配马拉松完赛时间（排除配速场景）
  // 先排除包含"配速"的句子，避免 "配速 5:40" 被误识别为目标
  const textWithoutPace = userInput.replace(/配速\s*[\d:]+/g, "");
  const goalPatterns = [
    /目标[是为]?\s*(\d{1,2}:\d{2})/i,
    /(?:想|计划|准备)\s*(?:冲|跑|破)?\s*(\d{1,2}:\d{2})\s*(?:pb|全马|半马|马拉松)?/i,
    /pb\s*(\d{1,2}:\d{2})/i,
    /破\s*(\d{1,2}:\d{2})/i,
    /(?:全马|半马|马拉松)\s*(?:目标|成绩|完赛)?\s*(\d{1,2}:\d{2})/i,
    /完赛\s*(\d{1,2}:\d{2})/i,
  ];
  for (const pattern of goalPatterns) {
    const match = textWithoutPace.match(pattern);
    if (match) {
      const time = match[1];
      // 进一步校验：马拉松完赛时间通常在 2:00-6:00 之间
      const [min] = time.split(":").map(Number);
      if (min < 2 || min > 6) continue; // 排除明显不是完赛时间的情况

      const newGoal = `全马 ${time}`;
      if (newGoal !== current.goal) {
        updates.push({
          field: "goal",
          oldValue: current.goal,
          newValue: newGoal,
          reason: `用户提到新目标: ${time}`,
        });
      }
      break;
    }
  }

  // 2. 周跑量更新
  const mileagePatterns = [
    /周跑量?\s*(\d+)[\s-]*(\d*)\s*km/i,
    /每周[跑约]?\s*(\d+)[\s-]*(\d*)\s*km/i,
    /月跑量?\s*(\d+)[\s-]*(\d*)\s*km/i,
  ];
  for (const pattern of mileagePatterns) {
    const match = userInput.match(pattern);
    if (match) {
      const min = match[1];
      const max = match[2] || min;
      const newMileage = `${min}-${max}km/${text.includes("月") ? "month" : "week"}`;
      if (newMileage !== current.weeklyMileage) {
        updates.push({
          field: "weeklyMileage",
          oldValue: current.weeklyMileage,
          newValue: newMileage,
          reason: `用户提到新跑量: ${min}-${max}km`,
        });
      }
      break;
    }
  }

  // 3. 可用时间更新
  const timePatterns = [
    /只能?([早晚中][上间]?|[\u4e00-\u9fa5]+时间)/,
    /([早晚中][上间]?|[\u4e00-\u9fa5]+时间)[跑练]/,
    /时间[变改]?成?\s*([\u4e00-\u9fa5]+)/,
  ];
  for (const pattern of timePatterns) {
    const match = userInput.match(pattern);
    if (match) {
      const newTime = match[1];
      if (!current.availableTime.includes(newTime)) {
        updates.push({
          field: "availableTime",
          oldValue: current.availableTime,
          newValue: `${current.availableTime}, ${newTime}`,
          reason: `用户提到新时间: ${newTime}`,
        });
      }
      break;
    }
  }

  // 4. 伤病/注意事项更新
  const injuryPatterns = [
    /(小腿|膝盖|脚踝|腿|脚|髋|腰|背|肩)\s*(有点|很|非常)?\s*(紧|酸|痛|不舒服|不适)/i,
    /(抽筋|cramp|拉伤|扭伤|炎症)/i,
  ];
  for (const pattern of injuryPatterns) {
    const match = userInput.match(pattern);
    if (match) {
      const newIssue = `${match[1]} ${match[3] || match[1]}`;
      const normalized = newIssue.toLowerCase().trim();
      const exists = current.issues.some((i) =>
        normalized.includes(i.toLowerCase()) || i.toLowerCase().includes(normalized)
      );
      if (!exists) {
        updates.push({
          field: "issues",
          oldValue: current.issues,
          newValue: [...current.issues, newIssue],
          reason: `用户提到新伤病信号: ${newIssue}`,
        });
      }
      break;
    }
  }

  // 5. 目标配速更新
  const preferredPaceMatch = userInput.match(/目标配速\s*([\d:]+)/i);
  if (preferredPaceMatch) {
    const newPace = preferredPaceMatch[1];
    if (newPace !== current.preferredPace) {
      updates.push({
        field: "preferredPace",
        oldValue: current.preferredPace,
        newValue: newPace,
        reason: `用户提到目标配速: ${newPace}`,
      });
    }
  }

  return updates;
}

/** 应用更新到 profile */
export function applyProfileUpdates(updates: ProfileUpdate[]): {
  applied: ProfileUpdate[];
  rejected: ProfileUpdate[];
} {
  const profile = loadProfile();
  const applied: ProfileUpdate[] = [];
  const rejected: ProfileUpdate[] = [];

  for (const update of updates) {
    // 安全校验：issues 最多 10 条
    if (update.field === "issues" && (update.newValue as string[]).length > 10) {
      rejected.push({ ...update, reason: `${update.reason} (拒绝: issues 超过 10 条)` });
      continue;
    }

    // 应用更新
    (profile as any)[update.field] = update.newValue;
    applied.push(update);
  }

  if (applied.length > 0) {
    saveProfile(profile);
  }

  return { applied, rejected };
}

/** 自动更新入口：分析用户输入并更新 */
export function autoUpdateProfile(userInput: string): {
  hasUpdate: boolean;
  updates: ProfileUpdate[];
  message: string;
} {
  const updates = extractProfileUpdates(userInput);

  if (updates.length === 0) {
    return { hasUpdate: false, updates: [], message: "" };
  }

  const { applied, rejected } = applyProfileUpdates(updates);

  const lines = applied.map(
    (u) => `  ✓ ${u.field}: ${JSON.stringify(u.oldValue)} → ${JSON.stringify(u.newValue)}`
  );
  if (rejected.length > 0) {
    lines.push(...rejected.map((u) => `  ✗ ${u.field}: ${u.reason}`));
  }

  return {
    hasUpdate: applied.length > 0,
    updates: applied,
    message: `【记忆已更新】\n${lines.join("\n")}`,
  };
}
