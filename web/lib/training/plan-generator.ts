/**
 * 周期化课表生成引擎
 * 基于用户目标和当前状态，生成 4-12 周周期化训练计划
 */

import type {
  PlanInput,
  TrainingPlan,
  WeekPlan,
  DayPlan,
  Phase,
  RunType,
  PaceZones,
  PlanResult,
  RunHistory,
} from "./plan-types.js";

// ========== 常量配置 ==========

/** 各阶段周数比例 */
const PHASE_RATIOS: Record<string, number[]> = {
  short: [0.25, 0.35, 0.25, 0.15],   // 4-6 周: 基础期短
  medium: [0.30, 0.30, 0.25, 0.15],  // 7-9 周
  long: [0.30, 0.35, 0.25, 0.10],    // 10-12 周: 基础期充分
};

/** 每周跑量递增系数（建设期） */
const BUILD_INCREASE = 1.08;  // 每周增加 8%

/** 巅峰期跑量系数 */
const PEAK_MULTIPLIER = 1.15;

/** Taper 期跑量系数 */
const TAPER_MULTIPLIERS = [0.80, 0.60, 0.40];

/** 各训练类型占比（按周跑量分配） */
const RUN_TYPE_DISTRIBUTION: Record<Phase, Record<RunType, number>> = {
  "基础期": {
    "轻松跑": 0.70,
    "长距离": 0.20,
    "节奏跑": 0.05,
    "间歇跑": 0.00,
    "恢复跑": 0.05,
    "休息": 0,
    "比赛": 0,
  },
  "建设期": {
    "轻松跑": 0.50,
    "长距离": 0.20,
    "节奏跑": 0.15,
    "间歇跑": 0.10,
    "恢复跑": 0.05,
    "休息": 0,
    "比赛": 0,
  },
  "巅峰期": {
    "轻松跑": 0.45,
    "长距离": 0.20,
    "节奏跑": 0.15,
    "间歇跑": 0.15,
    "恢复跑": 0.05,
    "休息": 0,
    "比赛": 0,
  },
  "taper": {
    "轻松跑": 0.50,
    "长距离": 0.15,
    "节奏跑": 0.10,
    "间歇跑": 0.05,
    "恢复跑": 0.20,
    "休息": 0,
    "比赛": 0,
  },
};

/** 星期映射 */
const WEEK_DAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

// ========== 核心生成函数 ==========

/**
 * 生成完整训练计划
 */
export function generateTrainingPlan(input: PlanInput): PlanResult {
  const totalWeeks = determinePlanLength(input);
  const phases = distributePhases(totalWeeks);
  const paceZones = calculatePaceZones(input);
  const weeklyDistances = calculateWeeklyDistances(input, phases);

  const weeks: WeekPlan[] = [];
  let weekCounter = 1;

  for (const phase of phases) {
    for (let i = 0; i < phase.weeks; i++) {
      const totalDistance = weeklyDistances[weekCounter - 1];
      const days = generateWeekDays(
        phase.phase,
        totalDistance,
        paceZones,
        input.availableDays,
        input.availableTimePerDay,
        weekCounter,
        totalWeeks
      );

      weeks.push({
        weekNumber: weekCounter,
        phase: phase.phase,
        totalDistance: Math.round(totalDistance * 10) / 10,
        days,
      });
      weekCounter++;
    }
  }

  const startDate = new Date().toISOString().split("T")[0];
  const endDate = new Date(Date.now() + totalWeeks * 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const plan: TrainingPlan = {
    id: `plan_${Date.now()}`,
    weeks,
    goal: input.goal,
    startDate,
    endDate,
    totalWeeks,
    createdAt: new Date().toISOString(),
  };

  return {
    plan,
    paceZones,
    weeklyProgression: weeklyDistances,
  };
}

/**
 * 根据目标确定计划长度
 */
function determinePlanLength(input: PlanInput): number {
  const goal = input.goal.toLowerCase();

  // 全马通常需要 10-12 周
  if (goal.includes("全马") || goal.includes("马拉松")) {
    return Math.min(12, Math.max(10, Math.floor(input.currentWeeklyDistance / 10) + 6));
  }

  // 半马 8-10 周
  if (goal.includes("半马")) {
    return Math.min(10, Math.max(8, Math.floor(input.currentWeeklyDistance / 8) + 5));
  }

  // 10K 6-8 周
  if (goal.includes("10k") || goal.includes("10公里")) {
    return Math.min(8, Math.max(6, Math.floor(input.currentWeeklyDistance / 6) + 4));
  }

  // 默认 8 周基础计划
  return 8;
}

/**
 * 分配各阶段周数
 */
function distributePhases(totalWeeks: number): Array<{ phase: Phase; weeks: number }> {
  let ratios: number[];
  if (totalWeeks <= 6) ratios = PHASE_RATIOS.short;
  else if (totalWeeks <= 9) ratios = PHASE_RATIOS.medium;
  else ratios = PHASE_RATIOS.long;

  const phases: Phase[] = ["基础期", "建设期", "巅峰期", "taper"];
  const result: Array<{ phase: Phase; weeks: number }> = [];

  let allocated = 0;
  for (let i = 0; i < phases.length; i++) {
    const weeks = i === phases.length - 1
      ? totalWeeks - allocated  // 最后一个阶段拿剩余
      : Math.max(1, Math.round(totalWeeks * ratios[i]));
    result.push({ phase: phases[i], weeks });
    allocated += weeks;
  }

  // 修正：确保总周数正确
  const diff = totalWeeks - allocated;
  if (diff !== 0) {
    result[1].weeks += diff; // 在建设期调整
  }

  return result.filter((p) => p.weeks > 0);
}

/**
 * 计算每周跑量
 */
function calculateWeeklyDistances(
  input: PlanInput,
  phases: Array<{ phase: Phase; weeks: number }>
): number[] {
  const distances: number[] = [];
  let currentDistance = input.currentWeeklyDistance;

  for (const phase of phases) {
    for (let i = 0; i < phase.weeks; i++) {
      let distance: number;

      switch (phase.phase) {
        case "基础期":
          // 基础期：小幅递增，建立有氧基础
          distance = currentDistance * (1 + i * 0.03);
          break;
        case "建设期":
          // 建设期：每周增加 8%
          distance = currentDistance * BUILD_INCREASE;
          currentDistance = distance;
          break;
        case "巅峰期":
          // 巅峰期：维持峰值
          distance = currentDistance * PEAK_MULTIPLIER;
          break;
        case "taper":
          // Taper：递减
          const taperIndex = i;
          distance = currentDistance * (TAPER_MULTIPLIERS[taperIndex] ?? 0.40);
          break;
      }

      distances.push(Math.round(distance * 10) / 10);
    }
  }

  return distances;
}

/**
 * 生成一周的训练日安排
 */
function generateWeekDays(
  phase: Phase,
  totalDistance: number,
  paceZones: PaceZones,
  availableDays: string[],
  availableTime: number,
  weekNumber: number,
  totalWeeks: number
): DayPlan[] {
  const distribution = RUN_TYPE_DISTRIBUTION[phase];
  const days: DayPlan[] = [];

  // 将可用训练日映射到星期
  const dayIndices = availableDays.map((d) => WEEK_DAYS.indexOf(d)).filter((i) => i >= 0);
  if (dayIndices.length === 0) {
    // 默认训练日：周二、周四、周六、周日
    dayIndices.push(1, 3, 5, 6);
  }

  // 排序
  dayIndices.sort((a, b) => a - b);

  // 长距离放在周末（周六或周日）
  const longRunDay = dayIndices.includes(6) ? 6 : dayIndices[dayIndices.length - 1];

  // 间歇/节奏放在周中
  const hardDays = dayIndices.filter((d) => d !== longRunDay && d !== 0 && d !== 6);
  const hardDay = hardDays.length > 0 ? hardDays[Math.floor(hardDays.length / 2)] : dayIndices[1];

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const dayName = WEEK_DAYS[dayIndex];

    if (!dayIndices.includes(dayIndex)) {
      // 休息日
      days.push({
        day: dayName,
        type: "休息",
        distance: 0,
        pace: "-",
        duration: "-",
        notes: "完全休息或轻度活动",
      });
      continue;
    }

    let type: RunType;
    let distance: number;
    let pace: string;
    let duration: string;
    let notes: string;

    if (dayIndex === longRunDay) {
      // 长距离日
      type = "长距离";
      distance = Math.min(totalDistance * 0.30, availableTime / 6); // 长距离不超过 30% 周跑量
      pace = paceZones.easy.max;
      duration = `${Math.round(distance * 6)}min`;
      notes = `LSD 长距离慢跑，保持轻松对话配速`;
    } else if (dayIndex === hardDay && (phase === "建设期" || phase === "巅峰期")) {
      // 强度日
      if (phase === "巅峰期" && weekNumber >= totalWeeks - 2) {
        type = "间歇跑";
        distance = Math.min(totalDistance * 0.12, 8);
        pace = paceZones.interval.min;
        duration = `${Math.round(distance * 5 + 20)}min`; // 含热身和冷身
        notes = `间歇训练: 800m x 6组，组间慢跑恢复 2min`;
      } else {
        type = "节奏跑";
        distance = Math.min(totalDistance * 0.15, availableTime / 5.5);
        pace = paceZones.tempo.min;
        duration = `${Math.round(distance * 5.5)}min`;
        notes = `节奏跑: 20min 热身 + ${Math.round(distance * 0.7)}km @ 乳酸阈值配速 + 10min 冷身`;
      }
    } else {
      // 轻松跑或恢复跑
      const isRecovery = dayIndex === dayIndices[0] && phase !== "基础期";
      type = isRecovery ? "恢复跑" : "轻松跑";
      const multiplier = isRecovery ? 0.08 : 0.12;
      distance = Math.min(totalDistance * multiplier, availableTime / 6.5);
      pace = isRecovery ? paceZones.easy.max : paceZones.easy.min;
      duration = `${Math.round(distance * 6.5)}min`;
      notes = isRecovery ? "超慢速恢复跑，促进血流" : "有氧基础跑，保持心率在 E 区";
    }

    days.push({
      day: dayName,
      type,
      distance: Math.round(distance * 10) / 10,
      pace,
      duration,
      notes,
    });
  }

  return days;
}

// ========== 配速计算 ==========

/**
 * 基于用户历史数据计算配速区间
 * 使用 Jack Daniels VDOT 简化算法
 */
export function calculatePaceZones(input: PlanInput): PaceZones {
  const recentRuns = input.historyRuns || [];

  // 从最近记录中提取有效配速
  const paces = recentRuns
    .map((r) => parsePaceToSeconds(r.pace))
    .filter((s) => s > 0);

  // 默认配速（基于目标）
  const defaultPace = estimatePaceFromGoal(input.goal);
  const basePace = paces.length > 0
    ? paces.reduce((a, b) => a + b, 0) / paces.length
    : defaultPace;

  // VDOT 简化：以近期平均配速为 E 区中点
  const easyMin = basePace * 1.15;      // E 区下限（更慢）
  const easyMax = basePace * 1.05;      // E 区上限
  const marathonPace = basePace * 0.95;   // M 区
  const tempoPace = basePace * 0.88;    // T 区
  const intervalPace = basePace * 0.82; // I 区
  const repPace = basePace * 0.75;      // R 区

  return {
    easy: { min: formatPace(easyMin), max: formatPace(easyMax) },
    marathon: { min: formatPace(marathonPace * 1.02), max: formatPace(marathonPace * 0.98) },
    tempo: { min: formatPace(tempoPace * 1.02), max: formatPace(tempoPace * 0.98) },
    interval: { min: formatPace(intervalPace * 1.03), max: formatPace(intervalPace * 0.97) },
    rep: { min: formatPace(repPace * 1.05), max: formatPace(repPace * 0.95) },
  };
}

/**
 * 从目标成绩估算配速
 */
function estimatePaceFromGoal(goal: string): number {
  const goalLower = goal.toLowerCase();

  // 全马目标
  const marathonMatch = goalLower.match(/(\d+):(\d+)/);
  if (marathonMatch && (goalLower.includes("全马") || goalLower.includes("马拉松"))) {
    const hours = parseInt(marathonMatch[1], 10);
    const minutes = parseInt(marathonMatch[2], 10);
    const totalMinutes = hours * 60 + minutes;
    const paceSeconds = (totalMinutes * 60) / 42.195;
    return paceSeconds;
  }

  // 半马目标
  const halfMatch = goalLower.match(/(\d+):(\d+)/);
  if (halfMatch && goalLower.includes("半马")) {
    const hours = parseInt(halfMatch[1], 10);
    const minutes = parseInt(halfMatch[2], 10);
    const totalMinutes = hours * 60 + minutes;
    const paceSeconds = (totalMinutes * 60) / 21.0975;
    return paceSeconds;
  }

  // 默认配速 5:30/km = 330s
  return 330;
}

/**
 * 解析配速字符串为秒数
 */
function parsePaceToSeconds(pace: string): number {
  const match = pace.match(/(\d+)[：:](\d+)/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/**
 * 秒数格式化为配速字符串
 */
function formatPace(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

// ========== 工具函数 ==========

/**
 * 获取计划摘要文本
 */
export function getPlanSummary(plan: TrainingPlan): string {
  const phaseBreakdown = plan.weeks.reduce((acc, week) => {
    acc[week.phase] = (acc[week.phase] || 0) + week.totalDistance;
    return acc;
  }, {} as Record<string, number>);

  const lines = [
    `【${plan.goal}】${plan.totalWeeks} 周训练计划`,
    `时间: ${plan.startDate} → ${plan.endDate}`,
    ``,
    `阶段分布:`,
    ...Object.entries(phaseBreakdown).map(
      ([phase, dist]) => `  ${phase}: ${Math.round(dist * 10) / 10}km`
    ),
    ``,
    `首周安排:`,
    ...plan.weeks[0]?.days
      .filter((d) => d.type !== "休息")
      .map((d) => `  ${d.day}: ${d.type} ${d.distance}km @ ${d.pace}`) || [],
  ];

  return lines.join("\n");
}

/**
 * 将计划导出为 JSON
 */
export function exportPlanToJson(plan: TrainingPlan): string {
  return JSON.stringify(plan, null, 2);
}

/**
 * 将计划导出为 iCal 格式（简化版）
 */
export function exportPlanToICal(plan: TrainingPlan): string {
  const events: string[] = [];
  const start = new Date(plan.startDate);

  for (const week of plan.weeks) {
    for (const day of week.days) {
      if (day.type === "休息") continue;

      const dayIndex = WEEK_DAYS.indexOf(day.day);
      const date = new Date(start);
      date.setDate(date.getDate() + (week.weekNumber - 1) * 7 + dayIndex);

      const dateStr = date.toISOString().split("T")[0].replace(/-/g, "");
      const uid = `${plan.id}_w${week.weekNumber}_${day.day}`;

      events.push(
        `BEGIN:VEVENT`,
        `UID:${uid}`,
        `DTSTART;VALUE=DATE:${dateStr}`,
        `SUMMARY:[跑蓝] ${day.type} ${day.distance}km`,
        `DESCRIPTION:目标配速: ${day.pace}\\n${day.notes || ""}`,
        `END:VEVENT`
      );
    }
  }

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RunCoach//Training Plan//EN",
    ...events,
    "END:VCALENDAR",
  ].join("\n");
}
