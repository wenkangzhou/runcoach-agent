/**
 * 记忆检索 - 根据问题类型选择加载哪些记忆
 * Day 4: Memory 不是"把所有聊天记录塞进去"，而是按需检索
 */

import type { MemoryState, RunLog } from "../core/types.js";
import { loadMemory } from "./store.js";
import { summarizeWeek, summarizeMonth, formatWeeklySummary, formatMonthlySummary } from "./summary.js";

/** 问题类型 */
export type QueryType = "next_workout" | "weekly_review" | "monthly_review" | "injury_check" | "general";

/** 检索配置 */
export interface RetrievalConfig {
  queryType: QueryType;
  includeProfile: boolean;
  includeWeeklySummary: boolean;
  includeMonthlySummary: boolean;
  maxRecentRuns: number;
  lookbackDays: number;
}

/** 判断问题类型 */
export function classifyQuery(question: string): QueryType {
  const q = question.toLowerCase();

  if (q.includes("明天") || q.includes("下周") || q.includes("怎么跑") || q.includes("安排")) {
    return "next_workout";
  }
  if (q.includes("这周") || q.includes("本周") || q.includes("周总结") || q.includes("week")) {
    return "weekly_review";
  }
  if (q.includes("这月") || q.includes("本月") || q.includes("月总结") || q.includes("month")) {
    return "monthly_review";
  }
  if (q.includes("伤") || q.includes("痛") || q.includes("紧") || q.includes("恢复") || q.includes("injury")) {
    return "injury_check";
  }
  return "general";
}

/** 根据问题类型生成检索配置 */
export function getRetrievalConfig(type: QueryType): RetrievalConfig {
  switch (type) {
    case "next_workout":
      return {
        queryType: type,
        includeProfile: true,
        includeWeeklySummary: true,
        includeMonthlySummary: false,
        maxRecentRuns: 3, // 只看最近 3 次
        lookbackDays: 7,
      };
    case "weekly_review":
      return {
        queryType: type,
        includeProfile: true,
        includeWeeklySummary: true,
        includeMonthlySummary: false,
        maxRecentRuns: 7,
        lookbackDays: 7,
      };
    case "monthly_review":
      return {
        queryType: type,
        includeProfile: true,
        includeWeeklySummary: true,
        includeMonthlySummary: true,
        maxRecentRuns: 10,
        lookbackDays: 30,
      };
    case "injury_check":
      return {
        queryType: type,
        includeProfile: true,
        includeWeeklySummary: false,
        includeMonthlySummary: false,
        maxRecentRuns: 10, // 看更多历史找规律
        lookbackDays: 30,
      };
    case "general":
    default:
      return {
        queryType: type,
        includeProfile: true,
        includeWeeklySummary: false,
        includeMonthlySummary: false,
        maxRecentRuns: 5,
        lookbackDays: 14,
      };
  }
}

/** 检索记忆并格式化 */
export function retrieveMemory(question: string): {
  profileText: string;
  runsText: string;
  summaryText: string;
  config: RetrievalConfig;
} {
  const queryType = classifyQuery(question);
  const config = getRetrievalConfig(queryType);
  const memory = loadMemory();

  // 1. 用户画像
  const profileText = config.includeProfile
    ? `【用户画像】
目标: ${memory.profile.goal}
周跑量: ${memory.profile.weeklyMileage}
可用时间: ${memory.profile.availableTime}
注意事项: ${memory.profile.issues.join(", ")}`
    : "";

  // 2. 最近训练（按需裁剪）
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.lookbackDays);

  const relevantRuns = memory.recentRuns
    .filter((r) => {
      const d = new Date(r.date);
      return d >= cutoffDate;
    })
    .slice(0, config.maxRecentRuns);

  const runsText = relevantRuns.length
    ? `【最近训练 (${config.lookbackDays}天内)】
${relevantRuns
  .map(
    (r) =>
      `- ${r.date}: ${r.distance}km, 配速${r.pace}, 心率${r.hr || "-"}, 感受: ${r.feeling}${r.notes ? ` (${r.notes})` : ""}`
  )
  .join("\n")}`
    : "【最近训练】\n无记录";

  // 3. 摘要
  const parts: string[] = [];
  if (config.includeWeeklySummary) {
    parts.push(formatWeeklySummary(summarizeWeek(memory.recentRuns)));
  }
  if (config.includeMonthlySummary) {
    parts.push(formatMonthlySummary(summarizeMonth(memory.recentRuns)));
  }
  const summaryText = parts.join("\n\n");

  return { profileText, runsText, summaryText, config };
}

/** 构建完整上下文文本 */
export function buildMemoryContext(question: string): string {
  const { profileText, runsText, summaryText } = retrieveMemory(question);

  const sections = [profileText, summaryText, runsText].filter(Boolean);
  return sections.join("\n\n");
}
