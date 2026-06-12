/**
 * API 路由: /api/reminder
 * GET: 返回今日训练提醒（供前端调用）
 */

import { NextResponse } from "next/server";
import { getTodayTraining, formatReminder } from "@/lib/training/reminder";
import { loadPlan } from "@/lib/training/plan-store";

export async function GET() {
  try {
    const plan = await loadPlan();
    const reminder = getTodayTraining(plan);

    if (!reminder.hasTraining) {
      return NextResponse.json({
        success: true,
        hasTraining: false,
        message: "今日无训练安排",
        formatted: "今日休息 🛌",
      });
    }

    return NextResponse.json({
      success: true,
      hasTraining: true,
      reminder,
      formatted: formatReminder(reminder),
    });
  } catch (error) {
    console.error("Reminder API 错误:", error);
    return NextResponse.json(
      { error: "获取训练提醒失败", detail: String(error) },
      { status: 500 }
    );
  }
}
