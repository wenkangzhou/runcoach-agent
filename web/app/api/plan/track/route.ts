/**
 * API 路由: /api/plan/track
 * POST: 标记某天训练完成/跳过/部分完成
 */

import { NextRequest, NextResponse } from "next/server";
import { loadPlan, savePlan } from "@/lib/training/plan-store";
import type { DayPlan } from "@/lib/training/plan-types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      dayIndex,
      weekIndex,
      status,
      actualDistance,
      actualPace,
      actualDuration,
      actualHr,
      feeling,
    } = body;

    if (
      typeof dayIndex !== "number" ||
      typeof weekIndex !== "number" ||
      !status ||
      !["completed", "skipped", "partial"].includes(status)
    ) {
      return NextResponse.json(
        { error: "参数错误: 需要 dayIndex, weekIndex, status" },
        { status: 400 }
      );
    }

    const plan = await loadPlan();
    if (!plan) {
      return NextResponse.json(
        { error: "当前没有活跃的训练计划" },
        { status: 404 }
      );
    }

    const week = plan.weeks[weekIndex];
    if (!week) {
      return NextResponse.json(
        { error: `周索引 ${weekIndex} 超出范围` },
        { status: 400 }
      );
    }

    const day = week.days[dayIndex];
    if (!day) {
      return NextResponse.json(
        { error: `日索引 ${dayIndex} 超出范围` },
        { status: 400 }
      );
    }

    // 更新状态
    const updatedDay: DayPlan = {
      ...day,
      status,
      completedAt: status === "completed" || status === "partial" ? new Date().toISOString() : undefined,
    };

    if (actualDistance !== undefined) {
      updatedDay.actualDistance = Number(actualDistance);
    }
    if (actualPace !== undefined) {
      updatedDay.actualPace = String(actualPace);
    }
    if (actualDuration !== undefined) {
      updatedDay.actualDuration = String(actualDuration);
    }
    if (actualHr !== undefined) {
      updatedDay.actualHr = Number(actualHr);
    }
    if (feeling !== undefined) {
      updatedDay.feeling = String(feeling);
    }

    // 如果 completed 且提供了 actualDistance/actualPace，自动计算偏差
    let deviation = null;
    if (status === "completed" && actualDistance != null && day.distance > 0) {
      const distDiff = ((Number(actualDistance) - day.distance) / day.distance) * 100;
      deviation = {
        distancePercent: Math.round(distDiff * 10) / 10,
      };
    }

    week.days[dayIndex] = updatedDay;
    await savePlan(plan);

    return NextResponse.json({
      success: true,
      day: updatedDay,
      deviation,
    });
  } catch (error) {
    console.error("Track API 错误:", error);
    return NextResponse.json(
      { error: "更新训练状态失败", detail: String(error) },
      { status: 500 }
    );
  }
}
