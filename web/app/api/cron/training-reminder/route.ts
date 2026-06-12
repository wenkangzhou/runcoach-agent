/**
 * API 路由: /api/cron/training-reminder
 * GET: 返回今日训练提醒内容
 * 可被 Vercel Cron 每天早上 7 点调用
 */

import { NextResponse } from "next/server";
import { getTodayTraining, formatReminder } from "@/lib/training/reminder";
import { loadPlan } from "@/lib/training/plan-store";

export async function GET() {
  try {
    const plan = await loadPlan();
    const reminder = getTodayTraining(plan);

    // 如果没有计划，返回友好提示
    if (!reminder.hasTraining) {
      return NextResponse.json({
        success: true,
        hasTraining: false,
        message: "今日无训练安排或暂无活跃计划",
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
    console.error("Training reminder cron 错误:", error);
    return NextResponse.json(
      { error: "获取训练提醒失败", detail: String(error) },
      { status: 500 }
    );
  }
}
