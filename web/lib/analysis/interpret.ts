/**
 * 模块 3: AI 训练解读
 * 生成单次训练的质量评分和分析报告
 */

import type { NormalizedRun } from "../strava/types.js";
import type {
  RunStructure,
  ClassificationResult,
  RunAnalysis,
  PhaseAssessment,
} from "./types.js";

/** 配速字符串 → 秒/km */
function parsePaceToSec(pace: string): number {
  const match = pace.match(/(\d+)[：:](\d+)/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/** 格式化距离 km */
function formatKm(meters: number): number {
  return Math.round((meters / 1000) * 10) / 10;
}

/** 评估阶段 */
function assessPhase(
  label: string,
  phase: RunStructure["warmup"],
  globalMeanPaceSec: number,
  expectedSlower: boolean
): PhaseAssessment {
  const distance = formatKm(phase.distance);
  const pace = phase.avgPace;

  if (phase.splits.length === 0) {
    return { distance, pace, assessment: `未检测到${label}段` };
  }

  const diff = phase.avgPaceSec - globalMeanPaceSec;
  const diffSec = Math.round(diff);
  const diffText = diffSec > 0 ? `慢 ${diffSec}s` : `快 ${Math.abs(diffSec)}s`;

  if (expectedSlower) {
    if (diff > 15) {
      return { distance, pace, assessment: `${label}充分，配速比平均 ${diffText}/km，节奏合理` };
    } else if (diff > -10) {
      return { distance, pace, assessment: `${label}略短或配速接近平均，建议再慢一些` };
    } else {
      return { distance, pace, assessment: `${label}偏快，建议降低强度` };
    }
  } else {
    // 主课段期望快且稳定
    if (diff < -10) {
      return { distance, pace, assessment: `主课强度到位，比平均快 ${Math.abs(diffSec)}s/km` };
    } else if (diff < 10) {
      return { distance, pace, assessment: `主课配速接近平均，强度适中` };
    } else {
      return { distance, pace, assessment: `主课偏慢，未达到预期强度` };
    }
  }
}

/**
 * 生成训练分析报告
 * @param run 单次跑步记录
 * @param structure 结构解析结果
 * @param classification 分类结果
 * @param recentRuns 最近跑步记录（用于对比）
 * @param maxHr 用户最大心率（默认 180）
 * @returns 完整分析结果
 */
export function interpretRun(
  run: NormalizedRun,
  structure: RunStructure,
  classification: ClassificationResult,
  recentRuns: NormalizedRun[],
  maxHr: number = 180
): RunAnalysis {
  const { distance, pace, avgHr, maxHr: runMaxHr, rpe, feeling, sufferScore, name } = run;
  const paceSec = parsePaceToSec(pace);

  // 计算近期平均
  const recentPaces = recentRuns
    .slice(0, 10)
    .map((r) => parsePaceToSec(r.pace))
    .filter((p) => p > 0);
  const recentDistances = recentRuns.slice(0, 10).map((r) => r.distance);
  const avgRecentPace = recentPaces.length > 0
    ? recentPaces.reduce((a, b) => a + b, 0) / recentPaces.length
    : 0;
  const avgRecentDistance = recentDistances.length > 0
    ? recentDistances.reduce((a, b) => a + b, 0) / recentDistances.length
    : 0;

  // 全局平均配速（用于结构评估）
  const globalMeanPaceSec = avgRecentPace > 0 ? avgRecentPace : paceSec;

  // ========== 评分维度 ==========

  // 1. 结构完整性（3 分）
  let structureScore = 0;
  if (structure.warmup.splits.length > 0) structureScore += 1;
  if (structure.main.splits.length > 0) structureScore += 1;
  if (structure.cooldown.splits.length > 0) structureScore += 1;
  // 如果只有 1-3 段，结构分降低（视为连续跑）
  if (!structure.hasClearStructure && structure.main.splits.length <= 3) {
    structureScore = Math.max(1, structureScore - 1);
  }

  // 2. 配速执行（3 分）
  let paceScore = 2; // 基础分
  const paceDiff = avgRecentPace > 0 ? Math.abs(paceSec - avgRecentPace) : 0;
  if (paceDiff < 15) paceScore = 3; // 配速稳定
  else if (paceDiff > 45) paceScore = 1; // 配速波动大

  // 根据分类调整
  if (classification.paceZone) {
    const expectedZone = classification.category === "轻松跑" ? "E"
      : classification.category === "有氧跑" ? "M"
      : classification.category === "节奏跑" ? "T"
      : classification.category === "间歇跑" ? "I"
      : classification.category === "LSD" ? "M"
      : null;
    if (expectedZone && classification.paceZone === expectedZone) {
      paceScore = Math.min(3, paceScore + 0.5);
    }
  }

  // 3. 心率控制（2 分）
  let hrScore = 1; // 基础分（有心率数据）
  const hrPercent = avgHr ? avgHr / maxHr : null;
  if (hrPercent != null) {
    const expectedHr = classification.category === "轻松跑" ? 0.65
      : classification.category === "有氧跑" ? 0.75
      : classification.category === "节奏跑" ? 0.85
      : classification.category === "间歇跑" ? 0.92
      : classification.category === "LSD" ? 0.75
      : 0.7;
    const hrDiff = Math.abs(hrPercent - expectedHr);
    if (hrDiff < 0.05) hrScore = 2;
    else if (hrDiff < 0.1) hrScore = 1.5;
    else hrScore = 1;
  } else {
    hrScore = 1; // 无心率数据，给基础分
  }

  // 4. 恢复信号（2 分）
  let recoveryScore = 1;
  if (structure.cooldown.splits.length > 0) {
    const cdPace = structure.cooldown.avgPaceSec;
    if (cdPace > globalMeanPaceSec + 15) {
      recoveryScore = 2; // 放松段明显慢于平均
    } else if (cdPace > globalMeanPaceSec - 5) {
      recoveryScore = 1.5; // 放松段略慢
    } else {
      recoveryScore = 0.5; // 放松段偏快
    }
  } else {
    recoveryScore = 0.5; // 无放松段
  }

  // 综合质量评分 1-10
  const rawScore = structureScore + paceScore + hrScore + recoveryScore;
  const quality = Math.max(1, Math.min(10, Math.round(rawScore)));

  // 疲劳度 1-10
  let fatigue = 5;
  if (rpe != null) {
    fatigue = rpe;
  } else if (sufferScore != null) {
    fatigue = Math.min(10, Math.max(1, Math.round(sufferScore / 40)));
  } else if (avgHr != null && maxHr > 0) {
    fatigue = Math.min(10, Math.max(1, Math.round((avgHr / maxHr) * 10)));
  }
  // 根据距离调整
  if (distance > avgRecentDistance * 1.5) fatigue = Math.min(10, fatigue + 1);

  // ========== 结构评估 ==========
  const warmup = assessPhase("热身", structure.warmup, globalMeanPaceSec, true);
  const main = assessPhase("主课", structure.main, globalMeanPaceSec, false);
  const cooldown = assessPhase("放松", structure.cooldown, globalMeanPaceSec, true);

  // ========== 亮点 ==========
  const highlights: string[] = [];
  if (structure.hasClearStructure) {
    highlights.push("训练结构完整，热身-主课-放松三段清晰");
  }
  if (paceDiff < 15 && avgRecentPace > 0) {
    highlights.push("配速执行稳定，与近期平均水平接近");
  }
  if (classification.category === "LSD" && distance >= 15) {
    highlights.push(`长距离耐力训练完成，${distance}km 距离达标`);
  }
  if (classification.category === "间歇跑" && structure.hasClearStructure) {
    highlights.push("间歇结构清晰，快慢交替执行到位");
  }
  if (hrPercent != null && hrPercent < 0.75 && distance >= 10) {
    highlights.push("长距离低心率，有氧基础扎实");
  }
  if (runMaxHr && avgHr && runMaxHr - avgHr < 15) {
    highlights.push("心率波动小，控制精准");
  }
  if (highlights.length === 0) {
    highlights.push("训练完成，保持规律运动习惯");
  }

  // ========== 注意事项 ==========
  const concerns: string[] = [];
  if (!structure.hasClearStructure && distance >= 5) {
    concerns.push("训练结构不够清晰，建议加入充分的热身和放松");
  }
  if (structure.warmup.splits.length === 0 && distance >= 5) {
    concerns.push("未检测到热身段，直接高强度起步可能增加受伤风险");
  }
  if (structure.cooldown.splits.length === 0 && distance >= 5) {
    concerns.push("未检测到放松段， abrupt stop 可能影响恢复");
  }
  if (hrPercent != null && hrPercent > 0.9 && distance > 5) {
    concerns.push("心率长时间处于高位，注意监控身体反应");
  }
  if (paceDiff > 45 && avgRecentPace > 0) {
    concerns.push("配速与近期平均差异较大，注意是否过度训练或状态下滑");
  }
  if (fatigue >= 8) {
    concerns.push("本次训练疲劳度较高，后续注意恢复");
  }
  if (concerns.length === 0) {
    concerns.push("暂无显著问题，继续保持");
  }

  // ========== 改进建议 ==========
  const suggestions: string[] = [];
  if (!structure.hasClearStructure) {
    suggestions.push("建议前 1-2km 以比目标慢 30-60s/km 的配速热身");
    suggestions.push("建议最后 1km 降速放松，帮助身体恢复");
  }
  if (classification.category === "LSD" && hrPercent != null && hrPercent > 0.8) {
    suggestions.push("LSD 心率偏高，建议降低配速 10-15s/km，确保在有氧区间");
  }
  if (classification.category === "轻松跑" && hrPercent != null && hrPercent > 0.75) {
    suggestions.push("轻松跑心率偏高，建议再慢一些，确保恢复效果");
  }
  if (classification.category === "间歇跑" && !structure.hasClearStructure) {
    suggestions.push("间歇跑建议明确分组，每组后充分休息再开始下一组");
  }
  if (distance < 3 && classification.category !== "恢复跑") {
    suggestions.push("单次距离较短，如非恢复日，可适当增加跑量");
  }
  if (suggestions.length === 0) {
    suggestions.push("当前训练模式良好，可尝试逐步增加跑量或强度");
  }

  // ========== 对比 ==========
  let comparison = "";
  if (avgRecentPace > 0) {
    const paceDiffSec = Math.round(paceSec - avgRecentPace);
    const distDiff = Math.round((distance - avgRecentDistance) * 10) / 10;
    const paceText = paceDiffSec > 0
      ? `比近期平均慢 ${paceDiffSec}s/km`
      : paceDiffSec < 0
      ? `比近期平均快 ${Math.abs(paceDiffSec)}s/km`
      : "配速与近期平均持平";
    const distText = distDiff > 0
      ? `距离多 ${distDiff}km`
      : distDiff < 0
      ? `距离少 ${Math.abs(distDiff)}km`
      : "距离与近期平均持平";
    comparison = `本次 ${paceText}，${distText}。`;
  } else {
    comparison = "暂无近期数据可供对比。";
  }
  comparison += ` 本次训练类型判定为「${classification.category}」，${classification.reasons[0] || ""}`;

  return {
    quality,
    fatigue,
    structure: { warmup, main, cooldown },
    highlights,
    concerns,
    suggestions,
    comparison,
  };
}
