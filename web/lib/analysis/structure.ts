/**
 * 模块 1: 活动结构解析
 * 基于 Strava 分段数据，自动识别热身/主课/放松段
 */

import type { StravaSplit } from "../strava/types.js";
import type { RunStructure, RunPhase } from "./types.js";

/** 秒数 → mm:ss 配速字符串 */
function formatPace(secondsPerKm: number): string {
  if (!isFinite(secondsPerKm) || secondsPerKm <= 0) return "-";
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.floor(secondsPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** 计算数组平均值 */
function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** 计算数组标准差 */
function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/** 计算单段配速 (秒/km) */
function splitPaceSec(split: StravaSplit): number {
  const km = split.distance / 1000;
  if (km <= 0) return 0;
  return split.moving_time / km;
}

/** 创建空阶段 */
function emptyPhase(): RunPhase {
  return {
    splits: [],
    distance: 0,
    duration: 0,
    avgPaceSec: 0,
    avgPace: "-",
  };
}

/** 从 splits 构建 RunPhase */
function buildPhase(splits: StravaSplit[]): RunPhase {
  if (splits.length === 0) return emptyPhase();
  const distance = splits.reduce((s, sp) => s + sp.distance, 0);
  const duration = splits.reduce((s, sp) => s + sp.moving_time, 0);
  const avgPaceSec = distance > 0 ? (duration / (distance / 1000)) : 0;
  return {
    splits,
    distance,
    duration,
    avgPaceSec,
    avgPace: formatPace(avgPaceSec),
  };
}

/**
 * 解析跑步结构
 * @param splits Strava 分段数据
 * @returns 热身/主课/放松三段结构
 */
export function parseRunStructure(splits: StravaSplit[]): RunStructure {
  // 防御：无分段或分段过少
  if (!splits || splits.length === 0) {
    return {
      warmup: emptyPhase(),
      main: emptyPhase(),
      cooldown: emptyPhase(),
      hasClearStructure: false,
    };
  }

  // 如果只有 1-3 段，视为连续跑不分段
  if (splits.length <= 3) {
    const main = buildPhase(splits);
    return {
      warmup: emptyPhase(),
      main,
      cooldown: emptyPhase(),
      hasClearStructure: false,
    };
  }

  // 计算每段配速
  const paces = splits.map(splitPaceSec);

  // 计算全局平均配速和标准差（排除异常值）
  const validPaces = paces.filter((p) => p > 0 && isFinite(p));
  const globalMean = mean(validPaces);
  const globalStd = stdDev(validPaces);

  // 突变点检测：某段配速与前后段差异 > 1.5 倍标准差 → 标记为阶段边界
  const boundaries: number[] = [];
  for (let i = 1; i < splits.length - 1; i++) {
    const prev = paces[i - 1];
    const curr = paces[i];
    const next = paces[i + 1];
    if (!isFinite(prev) || !isFinite(curr) || !isFinite(next)) continue;

    // 与前后平均的差异
    const neighborAvg = (prev + next) / 2;
    const diff = Math.abs(curr - neighborAvg);
    if (diff > 1.5 * globalStd) {
      boundaries.push(i);
    }
  }

  // 去重：相邻边界合并
  const mergedBoundaries: number[] = [];
  for (const b of boundaries) {
    if (mergedBoundaries.length === 0 || b - mergedBoundaries[mergedBoundaries.length - 1] > 1) {
      mergedBoundaries.push(b);
    }
  }

  // 默认边界：如果没有检测到突变点，使用前 1-2 段热身，最后 1-2 段放松
  let warmupEnd = 1;
  let cooldownStart = splits.length - 2;

  if (mergedBoundaries.length >= 1) {
    // 使用第一个突变点作为热身结束（如果它在前面一半）
    const firstBoundary = mergedBoundaries[0];
    if (firstBoundary <= Math.floor(splits.length / 3)) {
      warmupEnd = firstBoundary;
    }

    // 使用最后一个突变点作为放松开始（如果它在后面一半）
    const lastBoundary = mergedBoundaries[mergedBoundaries.length - 1];
    if (lastBoundary >= Math.floor((splits.length * 2) / 3)) {
      cooldownStart = lastBoundary;
    }
  }

  // 启发式调整：前段明显慢于平均 → 扩展热身
  for (let i = 0; i < Math.min(3, splits.length); i++) {
    if (paces[i] > globalMean + 0.8 * globalStd) {
      warmupEnd = Math.max(warmupEnd, i + 1);
    }
  }

  // 启发式调整：后段明显慢于平均 → 扩展放松
  for (let i = splits.length - 1; i >= Math.max(0, splits.length - 3); i--) {
    if (paces[i] > globalMean + 0.8 * globalStd) {
      cooldownStart = Math.min(cooldownStart, i);
    }
  }

  // 确保主课段至少有一段
  if (warmupEnd >= cooldownStart) {
    warmupEnd = 1;
    cooldownStart = splits.length - 1;
  }

  const warmupSplits = splits.slice(0, warmupEnd);
  const mainSplits = splits.slice(warmupEnd, cooldownStart);
  const cooldownSplits = splits.slice(cooldownStart);

  const warmup = buildPhase(warmupSplits);
  const main = buildPhase(mainSplits);
  const cooldown = buildPhase(cooldownSplits);

  // 判断是否有清晰结构
  const hasClearStructure =
    warmup.splits.length > 0 &&
    cooldown.splits.length > 0 &&
    main.splits.length >= 2 &&
    (warmup.avgPaceSec > globalMean || cooldown.avgPaceSec > globalMean);

  return { warmup, main, cooldown, hasClearStructure };
}
