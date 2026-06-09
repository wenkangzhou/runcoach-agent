/**
 * 记忆总结与趋势分析
 * Day 4: 把 recent_runs 压缩成结构化摘要
 */

import type { RunLog } from "../core/types.js";

/** 周训练摘要 */
export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  totalRuns: number;
  totalDistance: number;
  totalDuration: number; // 估算分钟
  avgPace: string;
  avgHr: number | null;
  easyRuns: number; // 轻松跑次数
  hardRuns: number; // 强度跑次数
  restDays: number;
  fatigueTrend: "上升" | "稳定" | "下降" | "未知";
  keyNotes: string[];
}

/** 月训练摘要 */
export interface MonthlySummary {
  month: string;
  totalRuns: number;
  totalDistance: number;
  weeklyAvg: number;
  longestRun: { date: string; distance: number; pace: string } | null;
  avgPace: string;
  injuryFlags: string[];
  consistency: "高" | "中" | "低"; // 基于每周跑量方差
}

/** 解析配速为秒/公里 */
function parsePaceToSec(pace: string): number {
  const [min, sec] = pace.split(":").map(Number);
  return min * 60 + sec;
}

/** 秒/公里转配速字符串 */
function secToPace(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** 估算跑步时长（分钟） */
function estimateDuration(run: RunLog): number {
  if (run.distance && run.pace) {
    const paceSec = parsePaceToSec(run.pace);
    return Math.round((paceSec * run.distance) / 60);
  }
  return 0;
}

/** 判断是否为强度跑（配速快于阈值） */
function isHardRun(pace: string, thresholdSec: number = 330): boolean {
  return parsePaceToSec(pace) < thresholdSec; // < 5:30 算强度
}

/** 生成周摘要（最近 7 天） */
export function summarizeWeek(runs: RunLog[]): WeeklySummary {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const weekRuns = runs.filter((r) => {
    const d = new Date(r.date);
    return d >= weekAgo && d <= today;
  });

  if (weekRuns.length === 0) {
    return {
      weekStart: weekAgo.toISOString().split("T")[0],
      weekEnd: today.toISOString().split("T")[0],
      totalRuns: 0,
      totalDistance: 0,
      totalDuration: 0,
      avgPace: "-",
      avgHr: null,
      easyRuns: 0,
      hardRuns: 0,
      restDays: 7,
      fatigueTrend: "未知",
      keyNotes: ["本周无训练记录"],
    };
  }

  const totalDistance = weekRuns.reduce((s, r) => s + r.distance, 0);
  const totalDuration = weekRuns.reduce((s, r) => s + estimateDuration(r), 0);

  // 平均配速（加权）
  const totalPaceSec = weekRuns.reduce(
    (s, r) => s + parsePaceToSec(r.pace) * r.distance,
    0
  );
  const avgPace = secToPace(totalPaceSec / totalDistance);

  // 平均心率
  const runsWithHr = weekRuns.filter((r) => r.hr);
  const avgHr = runsWithHr.length
    ? Math.round(runsWithHr.reduce((s, r) => s + (r.hr || 0), 0) / runsWithHr.length)
    : null;

  // 轻松跑 vs 强度跑
  const easyRuns = weekRuns.filter((r) => !isHardRun(r.pace)).length;
  const hardRuns = weekRuns.filter((r) => isHardRun(r.pace)).length;

  // 休息天数 = 7 - 有记录的天数（简化，不处理一天多跑）
  const uniqueDays = new Set(weekRuns.map((r) => r.date)).size;
  const restDays = 7 - uniqueDays;

  // 疲劳趋势（基于感受关键词）
  const fatigueKeywords = ["累", "疲劳", "酸", "痛", "紧", "tired", "sore"];
  const fatigueCount = weekRuns.filter((r) =>
    fatigueKeywords.some((k) => r.feeling.toLowerCase().includes(k))
  ).length;
  const fatigueTrend =
    fatigueCount >= weekRuns.length * 0.6
      ? "上升"
      : fatigueCount <= weekRuns.length * 0.2
        ? "下降"
        : "稳定";

  // 关键备注（去重）
  const keyNotes = [
    ...new Set(weekRuns.map((r) => r.notes).filter(Boolean)),
  ] as string[];

  return {
    weekStart: weekAgo.toISOString().split("T")[0],
    weekEnd: today.toISOString().split("T")[0],
    totalRuns: weekRuns.length,
    totalDistance,
    totalDuration,
    avgPace,
    avgHr,
    easyRuns,
    hardRuns,
    restDays,
    fatigueTrend,
    keyNotes: keyNotes.length ? keyNotes : ["无特别备注"],
  };
}

/** 生成月摘要（最近 30 天） */
export function summarizeMonth(runs: RunLog[]): MonthlySummary {
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const monthRuns = runs.filter((r) => {
    const d = new Date(r.date);
    return d >= monthAgo && d <= today;
  });

  if (monthRuns.length === 0) {
    return {
      month: today.toISOString().slice(0, 7),
      totalRuns: 0,
      totalDistance: 0,
      weeklyAvg: 0,
      longestRun: null,
      avgPace: "-",
      injuryFlags: [],
      consistency: "低",
    };
  }

  const totalDistance = monthRuns.reduce((s, r) => s + r.distance, 0);
  const weeklyAvg = Math.round(totalDistance / 4.3);

  // 最长距离
  const longest = monthRuns.reduce((max, r) =>
    r.distance > max.distance ? r : max
  );

  // 平均配速
  const totalPaceSec = monthRuns.reduce(
    (s, r) => s + parsePaceToSec(r.pace) * r.distance,
    0
  );
  const avgPace = secToPace(totalPaceSec / totalDistance);

  // 伤病信号
  const injuryKeywords = ["痛", "疼", "伤", "紧", "抽筋", "不适", "pain", "injury"];
  const injuryFlags = [
    ...new Set(
      monthRuns
        .filter((r) =>
          injuryKeywords.some(
            (k) =>
              r.feeling.toLowerCase().includes(k) ||
              (r.notes && r.notes.toLowerCase().includes(k))
          )
        )
        .map((r) => `${r.date}: ${r.feeling}${r.notes ? ` (${r.notes})` : ""}`)
    ),
  ];

  // 一致性：按周分组，计算方差
  const weeklyDistances: number[] = [];
  for (let i = 0; i < 4; i++) {
    const weekStart = new Date(today.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(today.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const weekDist = monthRuns
      .filter((r) => {
        const d = new Date(r.date);
        return d >= weekStart && d < weekEnd;
      })
      .reduce((s, r) => s + r.distance, 0);
    weeklyDistances.push(weekDist);
  }
  const avg = weeklyDistances.reduce((s, d) => s + d, 0) / weeklyDistances.length;
  const variance =
    weeklyDistances.reduce((s, d) => s + Math.pow(d - avg, 2), 0) /
    weeklyDistances.length;
  const consistency: "高" | "中" | "低" =
    variance < 10 ? "高" : variance < 25 ? "中" : "低";

  return {
    month: today.toISOString().slice(0, 7),
    totalRuns: monthRuns.length,
    totalDistance,
    weeklyAvg,
    longestRun: { date: longest.date, distance: longest.distance, pace: longest.pace },
    avgPace,
    injuryFlags,
    consistency,
  };
}

/** 格式化周摘要为文本 */
export function formatWeeklySummary(s: WeeklySummary): string {
  return `【本周训练 (${s.weekStart} ~ ${s.weekEnd})】
总次数: ${s.totalRuns} | 总距离: ${s.totalDistance}km | 总时长: ~${s.totalDuration}min
平均配速: ${s.avgPace} | 平均心率: ${s.avgHr || "-"}
轻松跑: ${s.easyRuns} | 强度跑: ${s.hardRuns} | 休息: ${s.restDays}天
疲劳趋势: ${s.fatigueTrend}
备注: ${s.keyNotes.join("; ")}`;
}

/** 格式化月摘要为文本 */
export function formatMonthlySummary(m: MonthlySummary): string {
  const longest = m.longestRun
    ? `${m.longestRun.date} ${m.longestRun.distance}km @ ${m.longestRun.pace}`
    : "-";
  return `【本月训练 (${m.month})】
总次数: ${m.totalRuns} | 总距离: ${m.totalDistance}km | 周均: ${m.weeklyAvg}km
平均配速: ${m.avgPace} | 一致性: ${m.consistency}
最长距离: ${longest}
${m.injuryFlags.length ? `⚠️ 伤病信号: ${m.injuryFlags.join("; ")}` : ""}`;
}
