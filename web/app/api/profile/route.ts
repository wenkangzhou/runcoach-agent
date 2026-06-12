/**
 * API 路由: /api/profile
 * GET: 获取用户画像
 * POST: 更新用户画像
 */

import { NextRequest, NextResponse } from "next/server";
import { loadMemory, updateProfile } from "@/lib/memory/store";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const memory = await loadMemory(userId);
    return NextResponse.json({
      success: true,
      profile: memory.profile,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "获取画像失败", detail: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { goal, weeklyMileage, availableTime, issues, preferredPace, experience } = body;

    const profile: Record<string, unknown> = {};
    if (goal !== undefined) profile.goal = goal;
    if (weeklyMileage !== undefined) profile.weeklyMileage = weeklyMileage;
    if (availableTime !== undefined) profile.availableTime = availableTime;
    if (issues !== undefined) profile.issues = issues;
    if (preferredPace !== undefined) profile.preferredPace = preferredPace;
    if (experience !== undefined) profile.experience = experience;

    const userId = await getCurrentUserId();
    await updateProfile(profile, userId);

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "更新画像失败", detail: String(error) },
      { status: 500 }
    );
  }
}
