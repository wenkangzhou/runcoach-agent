/**
 * API 路由: /api/routes/cluster
 * GET: 返回路线聚类结果
 */

import { NextResponse } from "next/server";
import { loadMemory } from "@/lib/memory/store";
import { clusterRoutes, getClusterSummary } from "@/lib/map/cluster";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const memory = await loadMemory(userId);
    const runs = memory.recentRuns || [];

    // 将 RunLog 转换为带 route 的 NormalizedRun 格式
    // 注意：RunLog 本身没有 route 字段，需要从 Strava 同步数据中获取
    // 这里我们先尝试从内存中加载带 route 的数据
    const runsWithRoute = runs.map((run) => ({
      ...run,
      route: (run as any).route as string | undefined,
    }));

    const clusters = clusterRoutes(runsWithRoute as any);
    const summary = getClusterSummary(clusters);

    return NextResponse.json({
      success: true,
      clusters,
      summary,
    });
  } catch (error) {
    console.error("Route cluster API 错误:", error);
    return NextResponse.json(
      { error: "获取路线聚类失败", detail: String(error) },
      { status: 500 }
    );
  }
}
