/**
 * 训练建议工具
 * Day 3: 核心工具 - 根据用户状态给出明日训练建议
 */

import type { RegisteredTool } from "../core/types.js";
import { loadMemory } from "../memory/store.js";

export const suggestNextWorkoutTool: RegisteredTool = {
  description: {
    name: "suggestNextWorkout",
    description:
      "根据用户画像、近期训练记录和当前疲劳状态，生成明日训练建议。会考虑周跑量、伤病史、训练目标和恢复需求。",
    parameters: [
      {
        name: "todayRun",
        type: "object",
        description: "今天的跑步数据（由 parseRunLog 提取），包含 distance, pace, hr, feeling",
        required: true,
      },
      {
        name: "question",
        type: "string",
        description: "用户的具体问题，例如: '明天该怎么跑？'、'我想下周冲一次 10km PB'",
        required: false,
      },
    ],
  },
  execute: async (args) => {
    const todayRun = args.todayRun as Record<string, unknown> || {};
    const question = String(args.question || "");

    // 加载记忆
    const memory = await loadMemory();
    const { profile, recentRuns } = memory;

    // 提取今日数据
    const distance = Number(todayRun.distance || 0);
    const pace = String(todayRun.pace || "未知");
    const hr = Number(todayRun.hr || 0);
    const feeling = String(todayRun.feeling || "").toLowerCase();
    const bodySignal = String(todayRun.bodySignal || "").toLowerCase();
    const combinedSignal = feeling + " " + bodySignal;
    const load = Number(todayRun.estimatedLoad || 0);

    // 计算本周跑量（最近 7 天）
    const today = new Date();
    const weekRuns = recentRuns.filter((r) => {
      const runDate = new Date(r.date);
      const diffDays = (today.getTime() - runDate.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 7;
    });
    const weeklyDistance = weekRuns.reduce((sum, r) => sum + r.distance, 0) + distance;

    // 判断疲劳信号
    const fatigueSignals = ["累", "疲劳", "酸", "痛", "紧", "tired", "sore", "pain", "tight"];
    const hasFatigue = fatigueSignals.some((s) => combinedSignal.includes(s));

    // 判断伤病风险
    const injuryKeywords = profile.issues.flatMap((issue) => {
      const map: Record<string, string[]> = {
        "30km cramp": ["抽筋", "cramp", "长距离"],
        "calf tightness": ["小腿", "calf", "紧"],
        "heat sensitive": ["热", "heat", "中暑"],
      };
      return map[issue] || [issue];
    });
    const hasInjuryRisk = injuryKeywords.some((k) => combinedSignal.includes(k) || question.toLowerCase().includes(k));

    // 决策逻辑
    let recommendation: {
      type: string;
      duration: string;
      distance: string;
      paceZone: string;
      hrZone: string;
      reason: string;
      alternative: string;
      warning?: string;
    };

    if (hasFatigue && hasInjuryRisk) {
      recommendation = {
        type: "休息或交叉训练",
        duration: "0-30 分钟",
        distance: "0km",
        paceZone: "N/A",
        hrZone: "N/A",
        reason: `你当前有疲劳信号（"${feeling}"），且触发了伤病关注项（${profile.issues.join(", ")}）。恢复优先于训练。`,
        alternative: "游泳、骑车或完全休息。如果必须动，只做 15 分钟拉伸 + 泡沫轴放松。",
        warning: "⚠️ 如果疼痛持续超过 48 小时，建议就医或咨询运动康复师。",
      };
    } else if (hasFatigue) {
      recommendation = {
        type: "恢复跑",
        duration: "30-40 分钟",
        distance: "4-6km",
        paceZone: "比目标配速慢 60-90 秒",
        hrZone: "Z1-Z2（< 最大心率的 70%）",
        reason: `你反馈"${todayRun.feeling || todayRun.bodySignal || "疲劳"}"，说明身体需要恢复。虽然周跑量${weeklyDistance}km 不算高，但局部疲劳优先级高于总跑量。`,
        alternative: "如果跑 10 分钟后仍感觉疲劳，改为快走或完全休息。",
      };
    } else if (weeklyDistance > 50) {
      recommendation = {
        type: "轻松跑或休息",
        duration: "30-45 分钟",
        distance: "5-8km",
        paceZone: "比目标配速慢 45-75 秒",
        hrZone: "Z1-Z2",
        reason: `本周已跑 ${weeklyDistance}km，接近/超过你的周跑量上限。建议减量，避免过度训练。`,
        alternative: "完全休息一天，或做瑜伽/拉伸。",
      };
    } else {
      recommendation = {
        type: "有氧基础跑",
        duration: "45-60 分钟",
        distance: "8-10km",
        paceZone: "比目标配速慢 30-60 秒",
        hrZone: "Z2（最大心率的 65%-75%）",
        reason: `状态良好（"${todayRun.feeling || "不错"}"），周跑量 ${weeklyDistance}km 在合理范围。适合堆有氧基础。`,
        alternative: "如果时间不够，改为 30 分钟节奏跑（比目标配速慢 15-30 秒）。",
      };
    }

    // 结合目标给出更具体建议
    const goalPace = profile.preferredPace || "5:30";
    const goalHint = profile.goal
      ? `你的目标是 ${profile.goal}，目标配速约 ${goalPace}。`
      : "";

    return {
      today: { distance, pace, hr, feeling, load },
      weeklyDistance,
      hasFatigue,
      hasInjuryRisk,
      profile: {
        goal: profile.goal,
        issues: profile.issues,
      },
      recommendation,
      goalHint,
      summary: `${recommendation.type} | ${recommendation.distance} | ${recommendation.paceZone} | 原因: ${recommendation.reason}`,
    };
  },
};
