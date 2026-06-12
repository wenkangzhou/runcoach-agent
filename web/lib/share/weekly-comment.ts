/**
 * AI 点评生成
 * 基于本周跑步数据生成一句像素风语气的中文点评
 */

import type { RunLog } from "@/lib/core/types";

export interface WeeklyData {
  runs: RunLog[];
  totalDistance: number;
  avgPace: string;
  totalDuration: number;
  runsCount: number;
  longestRun: number;
  restDays: number;
}

/**
 * 生成周训练点评
 */
export function generateWeeklyComment(data: WeeklyData): string {
  const { runs, totalDistance, runsCount, longestRun } = data;

  // 全休息
  if (runsCount === 0) {
    return "本周彻底休息，身体恢复得怎么样？🛌";
  }

  // 判断跑量是否达标（假设月跑量 150-200km = 周跑量 37-50km）
  const weeklyTargetLow = 30;

  // 判断强度
  let hasIntensity = false;
  let intensityTooHigh = false;

  for (const run of runs) {
    if (run.hr && run.hr >= 160) {
      hasIntensity = true;
    }
    // 配速 < 5:00 视为高强度
    const paceSec = parsePace(run.pace);
    if (paceSec > 0 && paceSec < 300) {
      hasIntensity = true;
    }
  }

  // 如果高强度训练次数过多（>3 次）认为强度过大
  const highIntensityRuns = runs.filter((r) => {
    if (r.hr && r.hr >= 160) return true;
    const paceSec = parsePace(r.pace);
    return paceSec > 0 && paceSec < 300;
  }).length;

  if (highIntensityRuns >= 3) {
    intensityTooHigh = true;
  }

  // 有长距离（>15km）
  const hasLongRun = longestRun >= 15;

  // 跑量达标 + 强度够
  if (totalDistance >= weeklyTargetLow && hasIntensity && !intensityTooHigh) {
    return "本周训练扎实，继续保持 🔥";
  }

  // 强度过高
  if (intensityTooHigh) {
    return "本周强度偏大，注意恢复 ⚠️";
  }

  // 有长距离
  if (hasLongRun) {
    return "长距离完成得不错，耐力在提升 🏔️";
  }

  // 跑量不足
  if (totalDistance < weeklyTargetLow) {
    return "本周跑量偏少，下周加油补回来 💪";
  }

  // 默认
  return "本周训练平稳，循序渐进就是胜利 ✨";
}

function parsePace(pace: string): number {
  const match = pace.match(/(\d+)[：:](\d+)/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}
