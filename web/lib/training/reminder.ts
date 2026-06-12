/**
 * 训练提醒模块
 * 检查今日是否有训练安排
 */

import type { TrainingPlan, DayPlan } from "./plan-types.js";

/** 今日训练提醒结果 */
export interface TrainingReminder {
  hasTraining: boolean;
  type?: string;
  distance?: number;
  pace?: string;
  notes?: string;
  duration?: string;
}

/**
 * 从训练计划中提取今日课表
 */
export function getTodayTraining(plan: TrainingPlan | null): TrainingReminder {
  if (!plan || !plan.weeks || plan.weeks.length === 0) {
    return { hasTraining: false };
  }

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const weekDay = today.getDay(); // 0=周日, 1=周一...
  const weekDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const todayWeekDay = weekDays[weekDay];

  // 计算今天是计划开始后的第几天
  const startDate = new Date(plan.startDate);
  const diffDays = Math.floor(
    (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) {
    return { hasTraining: false };
  }

  const weekIndex = Math.floor(diffDays / 7);
  const dayIndex = diffDays % 7;

  // 优先按周数+星期几匹配
  const week = plan.weeks[weekIndex];
  if (week && week.days) {
    // 先尝试按星期几名称匹配
    let dayPlan = week.days.find((d) => d.day === todayWeekDay);
    // 如果没找到，按索引匹配
    if (!dayPlan) {
      dayPlan = week.days[dayIndex];
    }

    if (dayPlan && dayPlan.type !== "休息") {
      return {
        hasTraining: true,
        type: dayPlan.type,
        distance: dayPlan.distance,
        pace: dayPlan.pace,
        notes: dayPlan.notes,
        duration: dayPlan.duration,
      };
    }
  }

  return { hasTraining: false };
}

/**
 * 格式化训练提醒为展示文本
 */
export function formatReminder(reminder: TrainingReminder): string {
  if (!reminder.hasTraining) return "今日休息 🛌";

  const parts: string[] = [];
  if (reminder.type) parts.push(reminder.type);
  if (reminder.distance) parts.push(`${reminder.distance}km`);
  if (reminder.pace && reminder.pace !== "-") parts.push(`@ ${reminder.pace}`);

  return parts.join(" ");
}
