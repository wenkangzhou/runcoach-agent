/**
 * AI 训练分析引擎 - 类型定义
 */

import type { StravaSplit, NormalizedRun } from "../strava/types.js";

// ========== 结构解析 ==========

/** 跑步阶段 */
export interface RunPhase {
  splits: StravaSplit[];
  distance: number;      // 米
  duration: number;      // 秒
  avgPaceSec: number;    // 每公里秒数
  avgPace: string;       // mm:ss /km
}

/** 结构解析结果 */
export interface RunStructure {
  warmup: RunPhase;
  main: RunPhase;
  cooldown: RunPhase;
  hasClearStructure: boolean;
}

// ========== 训练分类 ==========

/** 训练类型 */
export type RunCategory =
  | "恢复跑"
  | "轻松跑"
  | "有氧跑"
  | "节奏跑"
  | "间歇跑"
  | "LSD"
  | "比赛"
  | "日常跑";

/** 配速区间 */
export type PaceZone = "E" | "M" | "T" | "I" | "R";

/** 动态配速区间边界 */
export interface PaceZoneBoundaries {
  E: number;   // < 60 百分位 (秒/km)
  M: number;   // 60-75 百分位
  T: number;   // 75-85 百分位
  I: number;   // 85-95 百分位
  R: number;   // > 95 百分位
}

/** 分类结果 */
export interface ClassificationResult {
  category: RunCategory;
  paceZone: PaceZone | null;
  confidence: number;   // 0-1 置信度
  reasons: string[];     // 分类依据
}

// ========== 训练解读 ==========

/** 阶段评估 */
export interface PhaseAssessment {
  distance: number;      // km
  pace: string;          // mm:ss /km
  assessment: string;    // 文字评估
}

/** 完整分析结果 */
export interface RunAnalysis {
  quality: number;        // 1-10 质量评分
  fatigue: number;        // 1-10 疲劳度
  structure: {
    warmup: PhaseAssessment;
    main: PhaseAssessment;
    cooldown: PhaseAssessment;
  };
  highlights: string[];   // 亮点
  concerns: string[];     // 注意事项
  suggestions: string[];  // 改进建议
  comparison: string;      // 与近期平均对比
}

/** 分析输入 */
export interface AnalysisInput {
  run: NormalizedRun;
  structure: RunStructure;
  classification: ClassificationResult;
  recentRuns: NormalizedRun[];
}
