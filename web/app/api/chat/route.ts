/**
 * API 路由: /api/chat
 * 接收用户消息 + 历史记录，调用 Agent 循环，返回回答
 * 如果检测到生成计划意图，直接生成训练计划并保存
 */

import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/core/agent";
import { generateTrainingPlan } from "@/lib/training/plan-generator";
import { savePlan } from "@/lib/training/plan-store";
import { loadMemory } from "@/lib/memory/store";
import { getCurrentUserId } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "消息不能为空" },
        { status: 400 }
      );
    }

    const userId = await getCurrentUserId();

    // 检测生成计划意图
    const planKeywords = ["计划", "课表", "训练安排", "制定计划", "生成计划", "帮我规划"];
    const hasPlanIntent = planKeywords.some(k => message.includes(k));
    const hasGoal = message.match(/全马\s*(\d+[:：]?\d*)/) || message.match(/半马\s*(\d+[:：]?\d*)/) || message.match(/(\d+)\s*公里/);

    if (hasPlanIntent) {
      try {
        const memory = await loadMemory(userId);
        const goal = hasGoal
          ? (message.includes("全马") ? `全马 ${hasGoal[1]}` : message.includes("半马") ? `半马 ${hasGoal[1]}` : `目标 ${hasGoal[1]}`)
          : "全马 4:00";

        const result = generateTrainingPlan({
          goal,
          currentWeeklyDistance: 30,
          availableDays: ["周二", "周四", "周六", "周日"],
          availableTimePerDay: 90,
          historyRuns: memory.recentRuns.map((r) => ({
            date: r.date,
            distance: r.distance,
            pace: r.pace,
            hr: r.hr,
          })),
          preferredTerrain: "公路",
          issues: memory.profile.issues || [],
        });

        await savePlan(result.plan, userId);

        const planText = result.plan.weeks.map(w =>
          `第 ${w.weekNumber} 周 (${w.phase}): ${w.totalDistance}km`
        ).join("\n");

        return NextResponse.json({
          success: true,
          answer: `✅ 已为您生成 ${result.plan.totalWeeks} 周训练计划！\n\n目标：${goal}\n${planText}\n\n详细课表可在"数据仪表盘" → "训练计划"查看。`,
          plan: result.plan,
          toolCalls: [],
          iterations: 1,
        });
      } catch (err) {
        console.error("Chat 中生成计划失败:", err);
        // 回退到正常对话
      }
    }

    const result = await runAgent(message, userId, history);

    return NextResponse.json({
      success: true,
      answer: result.answer,
      toolCalls: result.toolCalls,
      iterations: result.iterations,
      memoryUpdate: result.memoryUpdate,
    });
  } catch (error) {
    console.error("Chat API 错误:", error);
    return NextResponse.json(
      { error: "Agent 处理失败", detail: String(error) },
      { status: 500 }
    );
  }
}
