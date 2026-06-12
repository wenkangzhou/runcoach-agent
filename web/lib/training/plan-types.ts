/**
 * 训练计划类型定义
 * 周期化课表数据结构
 */

/** 单次训练安排 */
export interface DayPlan {
  day: string;           // 日期或星期几，如 "周一" 或 "2026-06-15"
  type: RunType;
  distance: number;        // km
  pace: string;           // 目标配速，如 "5:30-5:45"
  duration: string;       // 预计时长，如 "45min"
  notes?: string;         // 备注说明
}

/** 跑步训练类型 */
export type RunType =
  | "轻松跑"      // Easy Run (E)
  | "长距离"      // Long Run (L)
  | "节奏跑"      // Tempo Run (T)
  | "间歇跑"      // Interval (I)
  | "恢复跑"      // Recovery (R)
  | "休息"        // Rest
  | "比赛";       // Race

/** 训练周期阶段 */
export type Phase =
  | "基础期"      // Base Building
  | "建设期"      // Build
  | "巅峰期"      // Peak
  | "taper";      // Taper / 减量期

/** 单周计划 */
export interface WeekPlan {
  weekNumber: number;
  phase: Phase;
  totalDistance: number;  // 本周总跑量 (km)
  days: DayPlan[];
}

/** 完整训练计划 */
export interface TrainingPlan {
  id: string;
  weeks: WeekPlan[];
  goal: string;            // 如 "全马 3:20"
  startDate: string;       // ISO 日期
  endDate: string;         // ISO 日期
  totalWeeks: number;
  createdAt: string;
}

/** 用户输入参数 */
export interface PlanInput {
  goal: string;            // 目标赛事 + 目标成绩
  currentWeeklyDistance: number;  // 当前周跑量 (km)
  availableDays: string[]; // 可用训练日，如 ["周一", "周三", "周五", "周日"]
  availableTimePerDay: number;    // 每次可用时间 (分钟)
  historyRuns?: RunHistory[];     // 历史数据
  preferredTerrain?: string;      // 偏好地形
  issues?: string[];       // 伤病/注意事项
}

/** 历史跑步记录（用于配速计算） */
export interface RunHistory {
  date: string;
  distance: number;
  pace: string;            // 如 "5:40"
  hr?: number;
  type?: string;
}

/** 配速区间计算结果 */
export interface PaceZones {
  easy: { min: string; max: string };      // E 区
  marathon: { min: string; max: string };  // M 区
  tempo: { min: string; max: string };     // T 区
  interval: { min: string; max: string };  // I 区
  rep: { min: string; max: string };       // R 区
}

/** 计划生成结果 */
export interface PlanResult {
  plan: TrainingPlan;
  paceZones: PaceZones;
  weeklyProgression: number[];  // 每周跑量递增数组
}
