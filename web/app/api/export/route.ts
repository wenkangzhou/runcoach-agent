/**
 * API 路由: /api/export
 * GET: 导出所有数据
 *   ?format=csv - 跑步记录 CSV
 *   ?format=json - 完整数据包 { profile, runs, plan, stravaConnection }
 */

import { NextRequest, NextResponse } from "next/server";
import { loadMemory } from "@/lib/memory/store";
import { loadPlan } from "@/lib/training/plan-store";
import type { RunLog } from "@/lib/core/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";

    const memory = await loadMemory();
    const plan = await loadPlan();

    // 尝试获取 Strava 连接状态（如果存在）
    let stravaConnection = null;
    try {
      const stravaRes = await fetch(new URL("/api/strava/status", request.url));
      if (stravaRes.ok) {
        const stravaData = await stravaRes.json();
        stravaConnection = stravaData.connection || null;
      }
    } catch {
      // Strava 状态不可用，忽略
    }

    if (format === "csv") {
      const csv = runsToCsv(memory.recentRuns);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="runcoach-export.csv"',
        },
      });
    }

    // JSON 格式
    const payload = {
      profile: memory.profile,
      runs: memory.recentRuns,
      plan,
      stravaConnection,
      exportedAt: new Date().toISOString(),
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="runcoach-export.json"',
      },
    });
  } catch (error) {
    console.error("Export API 错误:", error);
    return NextResponse.json(
      { error: "导出失败", detail: String(error) },
      { status: 500 }
    );
  }
}

/**
 * 将跑步记录转为 CSV
 * 列：日期, 名称, 距离(km), 时长(分), 配速, 平均心率, 最大心率, 爬升(m), 体感, 设备
 */
function runsToCsv(runs: RunLog[]): string {
  const headers = ["日期", "名称", "距离(km)", "时长(分)", "配速", "平均心率", "最大心率", "爬升(m)", "体感", "设备"];

  const rows = runs.map((run) => {
    // 估算时长：距离 * 配速（秒）/ 60
    const paceSec = parsePace(run.pace);
    const duration = paceSec > 0 ? Math.round(run.distance * (paceSec / 60)) : "";

    return [
      run.date,
      escapeCsv(run.notes || ""),
      run.distance,
      duration,
      run.pace,
      run.hr ?? "",
      "", // 最大心率（RunLog 中没有）
      "", // 爬升（RunLog 中没有）
      run.feeling,
      "", // 设备（RunLog 中没有）
    ];
  });

  // BOM for Excel UTF-8 support
  const bom = "\uFEFF";
  const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
  return bom + csv;
}

function parsePace(pace: string): number {
  const match = pace.match(/(\d+)[：:](\d+)/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function escapeCsv(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
