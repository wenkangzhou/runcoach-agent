/**
 * 模块 2: 训练类型自动分类
 * 基于距离/配速/心率/爬升，自动分类训练类型
 */

import type { NormalizedRun } from "../strava/types.js";
import type {
  RunCategory,
  PaceZone,
  PaceZoneBoundaries,
  ClassificationResult,
} from "./types.js";

/** 配速字符串 → 秒/km */
function parsePaceToSec(pace: string): number {
  const match = pace.match(/(\d+)[：:](\d+)/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/** 计算百分位值 */
function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, idx)];
}

/**
 * 基于用户最近 10 次跑步的配速分布，计算动态配速区间
 * @param recentRuns 最近跑步记录（按时间倒序）
 * @returns 配速区间边界（秒/km）
 */
export function calculatePaceZones(recentRuns: NormalizedRun[]): PaceZoneBoundaries {
  const runs = recentRuns.slice(0, 10);
  const paces = runs
    .map((r) => parsePaceToSec(r.pace))
    .filter((p) => p > 0)
    .sort((a, b) => a - b);

  if (paces.length === 0) {
    // 默认边界（基于全马 3:30 的参考配速）
    return { E: 360, M: 330, T: 300, I: 270, R: 240 };
  }

  return {
    E: percentile(paces, 60),
    M: percentile(paces, 75),
    T: percentile(paces, 85),
    I: percentile(paces, 95),
    R: percentile(paces, 100),
  };
}

/**
 * 判断配速所属区间
 * @param paceSec 配速（秒/km）
 * @param zones 动态配速区间
 * @returns 区间标签
 */
export function getPaceZone(paceSec: number, zones: PaceZoneBoundaries): PaceZone | null {
  if (paceSec <= 0) return null;
  if (paceSec <= zones.E) return "E";
  if (paceSec <= zones.M) return "M";
  if (paceSec <= zones.T) return "T";
  if (paceSec <= zones.I) return "I";
  return "R";
}

/**
 * 检测是否有明确的快慢交替结构（间歇特征）
 * @param run 标准化跑步记录
 * @returns 是否有间歇结构
 */
function hasIntervalStructure(run: NormalizedRun): boolean {
  const splits = run.splits;
  if (!splits || splits.length < 4) return false;

  const paces = splits.map((s) => {
    const km = s.distance / 1000;
    return km > 0 ? s.moving_time / km : 0;
  }).filter((p) => p > 0);

  if (paces.length < 4) return false;

  // 检测快慢交替：相邻段配速差异显著
  let alternations = 0;
  for (let i = 1; i < paces.length; i++) {
    const diff = Math.abs(paces[i] - paces[i - 1]);
    const avg = (paces[i] + paces[i - 1]) / 2;
    if (diff / avg > 0.15) {
      alternations++;
    }
  }

  // 至少 2 次显著交替，且交替次数占总段数比例 > 30%
  return alternations >= 2 && alternations / (paces.length - 1) > 0.3;
}

/**
 * 自动分类训练类型
 * @param run 单次跑步记录
 * @param recentRuns 最近跑步记录（用于动态配速区间）
 * @param maxHr 用户最大心率（默认 180）
 * @returns 分类结果
 */
export function classifyRun(
  run: NormalizedRun,
  recentRuns: NormalizedRun[],
  maxHr: number = 180
): ClassificationResult {
  const { distance, pace, avgHr, name, sufferScore, rpe } = run;
  const paceSec = parsePaceToSec(pace);
  const zones = calculatePaceZones(recentRuns);
  const paceZone = paceSec > 0 ? getPaceZone(paceSec, zones) : null;

  const hrPercent = avgHr ? avgHr / maxHr : null;
  const reasons: string[] = [];

  // 1. 比赛检测（最高优先级）
  const isRace =
    (name && /[赛race]/i.test(name)) ||
    (sufferScore != null && sufferScore > 300);
  if (isRace) {
    if (name && /[赛race]/i.test(name)) reasons.push(`活动名称含比赛关键词"${name}"`);
    if (sufferScore != null && sufferScore > 300) reasons.push(`suffer_score ${sufferScore} > 300`);
    return { category: "比赛", paceZone, confidence: 0.95, reasons };
  }

  // 2. 恢复跑: <5km 且配速比平均慢 30s+/km
  if (distance < 5) {
    const recentPaces = recentRuns
      .slice(0, 10)
      .map((r) => parsePaceToSec(r.pace))
      .filter((p) => p > 0);
    const avgPace = recentPaces.length > 0
      ? recentPaces.reduce((a, b) => a + b, 0) / recentPaces.length
      : 0;
    if (avgPace > 0 && paceSec > avgPace + 30) {
      reasons.push(`距离 ${distance}km < 5km，配速 ${pace} 比近期平均慢 ${Math.round(paceSec - avgPace)}s/km`);
      return { category: "恢复跑", paceZone, confidence: 0.85, reasons };
    }
  }

  // 3. LSD: >15km，心率 < 80%
  if (distance >= 15) {
    if (hrPercent != null && hrPercent < 0.8) {
      reasons.push(`距离 ${distance}km ≥ 15km，心率 ${avgHr} 低于 80% 最大心率`);
      return { category: "LSD", paceZone, confidence: 0.9, reasons };
    }
    // 距离很长但心率数据缺失，也倾向 LSD
    if (hrPercent == null) {
      reasons.push(`距离 ${distance}km ≥ 15km，长距离特征明显`);
      return { category: "LSD", paceZone, confidence: 0.75, reasons };
    }
  }

  // 4. 间歇跑: 有明确快慢交替结构，或距离 < 10km 且心率 > 90%
  const intervalStructure = hasIntervalStructure(run);
  const highHrShort = hrPercent != null && hrPercent > 0.9 && distance < 10;
  if (intervalStructure || highHrShort) {
    if (intervalStructure) reasons.push("分段数据呈现明显的快慢交替结构");
    if (highHrShort) reasons.push(`距离 ${distance}km < 10km 且心率 ${avgHr} > 90% 最大心率`);
    return { category: "间歇跑", paceZone, confidence: 0.85, reasons };
  }

  // 5. 节奏跑 (T): 心率 80-90%，配速比马拉松快 10-15s/km
  if (hrPercent != null && hrPercent >= 0.8 && hrPercent < 0.9) {
    reasons.push(`心率 ${avgHr} 处于 80-90% 最大心率区间`);
    return { category: "节奏跑", paceZone, confidence: 0.8, reasons };
  }

  // 6. 轻松跑 (E): 心率 < 70% 最大心率，配速舒适
  if (hrPercent != null && hrPercent < 0.7) {
    reasons.push(`心率 ${avgHr} 低于 70% 最大心率，处于舒适区`);
    return { category: "轻松跑", paceZone, confidence: 0.8, reasons };
  }

  // 7. 有氧跑: 心率 70-80%，中等距离
  if (hrPercent != null && hrPercent >= 0.7 && hrPercent < 0.8) {
    reasons.push(`心率 ${avgHr} 处于 70-80% 有氧区间`);
    return { category: "有氧跑", paceZone, confidence: 0.75, reasons };
  }

  // 8. 基于 RPE 的兜底判断
  if (rpe != null) {
    if (rpe <= 3) {
      reasons.push(`RPE ${rpe} ≤ 3，主观感受轻松`);
      return { category: "轻松跑", paceZone, confidence: 0.7, reasons };
    }
    if (rpe >= 8) {
      reasons.push(`RPE ${rpe} ≥ 8，主观用力程度高`);
      return { category: "间歇跑", paceZone, confidence: 0.65, reasons };
    }
  }

  // 9. 基于配速区间的兜底
  if (paceZone === "E") {
    reasons.push(`配速 ${pace} 处于 E 区（< 60 百分位）`);
    return { category: "轻松跑", paceZone, confidence: 0.65, reasons };
  }
  if (paceZone === "T" || paceZone === "I" || paceZone === "R") {
    reasons.push(`配速 ${pace} 处于 ${paceZone} 区，强度较高`);
    return { category: "节奏跑", paceZone, confidence: 0.6, reasons };
  }

  // 默认
  if (distance >= 10) {
    reasons.push(`距离 ${distance}km ≥ 10km，默认归类为有氧跑`);
    return { category: "有氧跑", paceZone, confidence: 0.5, reasons };
  }

  reasons.push(`距离 ${distance}km，无显著特征，默认归类为日常跑`);
  return { category: "日常跑", paceZone, confidence: 0.5, reasons };
}
