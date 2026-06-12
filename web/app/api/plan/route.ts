/**
 * API 路由: /api/plan
 * POST: 生成训练计划
 * GET: 获取当前训练计划
 */

import { NextRequest, NextResponse } from "next/server";
import { generateTrainingPlan, getPlanSummary } from "@/lib/training/plan-generator";
import { buildPlanSystemPrompt, buildPlanUserPrompt } from "@/lib/training/plan-prompt";
import type { PlanInput, TrainingPlan } from "@/lib/training/plan-types";
import { loadMemory } from "@/lib/memory/store";
import { savePlan, loadPlan } from "@/lib/training/plan-store";
import { getCurrentUserId } from "@/lib/auth";

// 保留内存缓存以兼容旧代码，但优先使用持久化存储
const planCache = new Map<string, TrainingPlan | null>();

/**
 * POST /api/plan
 * 生成新的训练计划
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      goal,
      currentWeeklyDistance,
      availableDays,
      availableTimePerDay,
      preferredTerrain,
      issues,
      useLLM,
    } = body;

    // 验证必填字段
    if (!goal || typeof goal !== "string") {
      return NextResponse.json(
        { error: "目标不能为空" },
        { status: 400 }
      );
    }

    if (!currentWeeklyDistance || typeof currentWeeklyDistance !== "number") {
      return NextResponse.json(
        { error: "当前周跑量不能为空" },
        { status: 400 }
      );
    }

    const userId = await getCurrentUserId();

    // 加载用户记忆数据
    const memory = await loadMemory(userId);

    // 构建输入
    const input: PlanInput = {
      goal,
      currentWeeklyDistance: Number(currentWeeklyDistance),
      availableDays: availableDays || ["周二", "周四", "周六", "周日"],
      availableTimePerDay: availableTimePerDay || 90,
      historyRuns: memory.recentRuns.map((r) => ({
        date: r.date,
        distance: r.distance,
        pace: r.pace,
        hr: r.hr,
      })),
      preferredTerrain: preferredTerrain || "公路",
      issues: issues || memory.profile.issues || [],
    };

    let plan: TrainingPlan;
    let paceZones;
    let weeklyProgression;

    if (useLLM) {
      // LLM 模式：调用 Kimi/OpenAI 生成
      const result = await generatePlanWithLLM(input);
      plan = result.plan;
      paceZones = result.paceZones;
      weeklyProgression = result.weeklyProgression;
    } else {
      // 本地引擎模式：使用规则引擎生成
      const result = generateTrainingPlan(input);
      plan = result.plan;
      paceZones = result.paceZones;
      weeklyProgression = result.weeklyProgression;
    }

    // 缓存当前计划
    planCache.set(userId, plan);
    await savePlan(plan, userId);

    return NextResponse.json({
      success: true,
      plan,
      paceZones,
      weeklyProgression,
      summary: getPlanSummary(plan),
    });
  } catch (error) {
    console.error("Plan API 错误:", error);
    return NextResponse.json(
      { error: "生成计划失败", detail: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/plan
 * 获取当前训练计划
 */
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const cached = planCache.get(userId);
    if (!cached) {
      const plan = await loadPlan(userId);
      if (!plan) {
        return NextResponse.json(
          { success: true, plan: null, message: "暂无活跃计划" },
          { status: 200 }
        );
      }
      planCache.set(userId, plan);
      return NextResponse.json({
        success: true,
        plan,
        summary: getPlanSummary(plan),
      });
    }

    return NextResponse.json({
      success: true,
      plan: cached,
      summary: getPlanSummary(cached),
    });
  } catch (error) {
    console.error("Get Plan API 错误:", error);
    return NextResponse.json(
      { error: "获取计划失败", detail: String(error) },
      { status: 500 }
    );
  }
}

/**
 * 使用 LLM 生成训练计划
 */
async function generatePlanWithLLM(input: PlanInput): Promise<{
  plan: TrainingPlan;
  paceZones: any;
  weeklyProgression: number[];
}> {
  const provider = getLLMProvider();

  if (provider === "mock") {
    // 无 API Key 时回退到本地引擎
    return generateTrainingPlan(input);
  }

  try {
    const { OpenAI } = await import("openai");
    const client = new OpenAI({
      apiKey: provider === "kimi" ? process.env.KIMI_API_KEY : process.env.OPENAI_API_KEY,
      baseURL: provider === "kimi" ? "https://api.moonshot.cn/v1" : process.env.OPENAI_BASE_URL,
      maxRetries: 2,
      timeout: 60000,
    });

    const systemPrompt = buildPlanSystemPrompt();
    const userPrompt = buildPlanUserPrompt(input);

    const completion = await client.chat.completions.create({
      model: provider === "kimi" ? (process.env.KIMI_MODEL || "kimi-k2.5") : (process.env.OPENAI_MODEL || "gpt-4o-mini"),
      temperature: (process.env.KIMI_MODEL || "").includes("k2.5") ? 0.6 : 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error("LLM 返回空内容");
    }

    const parsed = JSON.parse(content);

    // 验证并补充必要字段
    const plan: TrainingPlan = {
      id: parsed.plan?.id || `plan_${Date.now()}`,
      weeks: parsed.plan?.weeks || [],
      goal: parsed.plan?.goal || input.goal,
      startDate: parsed.plan?.startDate || new Date().toISOString().split("T")[0],
      endDate: parsed.plan?.endDate || new Date().toISOString().split("T")[0],
      totalWeeks: parsed.plan?.totalWeeks || parsed.plan?.weeks?.length || 8,
      createdAt: parsed.plan?.createdAt || new Date().toISOString(),
    };

    const paceZones = parsed.paceZones || {
      easy: { min: "5:30", max: "5:45" },
      marathon: { min: "5:00", max: "5:10" },
      tempo: { min: "4:45", max: "4:55" },
      interval: { min: "4:20", max: "4:35" },
      rep: { min: "4:00", max: "4:15" },
    };

    const weeklyProgression = plan.weeks.map((w: { totalDistance: number }) => w.totalDistance);

    return { plan, paceZones, weeklyProgression };
  } catch (err) {
    console.warn("LLM 生成计划失败，回退到本地引擎:", err instanceof Error ? err.message : String(err));
    return generateTrainingPlan(input);
  }
}

/**
 * 获取 LLM Provider
 */
function getLLMProvider(): "kimi" | "openai" | "mock" {
  if (process.env.KIMI_API_KEY) return "kimi";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "mock";
}
