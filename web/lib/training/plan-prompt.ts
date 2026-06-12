/**
 * LLM Prompt 模板
 * 用于基于用户画像 + 历史数据生成个性化课表
 */

import type { PlanInput, TrainingPlan, PaceZones } from "./plan-types.js";

/**
 * 构建生成训练计划的系统提示
 */
export function buildPlanSystemPrompt(): string {
  return `你是一位国家级马拉松教练，精通运动科学和周期化训练理论。

你的任务是根据用户的跑步画像和历史数据，生成一份结构化、可执行的周期化训练计划。

## 训练周期理论

1. **基础期 (Base)**: 建立有氧基础，以轻松跑为主，跑量逐步增加
2. **建设期 (Build)**: 引入强度训练（节奏跑、间歇跑），跑量继续增加
3. **巅峰期 (Peak)**: 达到最大跑量和强度，模拟比赛配速
4. **Taper (减量期)**: 减少跑量和强度，让身体恢复，准备比赛

## 配速区间定义（Jack Daniels 体系）

- **E 区 (Easy)**: 65-79% 最大心率，可轻松对话的配速
- **M 区 (Marathon)**: 80-88% 最大心率，马拉松比赛配速
- **T 区 (Tempo)**: 88-92% 最大心率，乳酸阈值配速，舒适地 hard
- **I 区 (Interval)**: 92-97% 最大心率，间歇训练配速， VO2max 区间
- **R 区 (Rep)**: >97% 最大心率，重复跑，发展速度和跑步经济性

## 输出规则

1. 必须输出有效的 JSON 格式
2. 每周必须包含具体的每日安排
3. 配速必须基于用户近期数据动态计算
4. 考虑用户的可用时间和伤病限制
5. 如果用户有伤病史，减少强度训练比例，增加恢复跑
6. 计划必须循序渐进，避免跑量突增（每周增幅不超过 10%）

## JSON 输出格式

\`\`\`json
{
  "plan": {
    "id": "plan_xxx",
    "weeks": [
      {
        "weekNumber": 1,
        "phase": "基础期",
        "totalDistance": 35.0,
        "days": [
          {
            "day": "周一",
            "type": "轻松跑",
            "distance": 8.0,
            "pace": "5:30-5:45",
            "duration": "45min",
            "notes": "有氧基础跑，保持心率在 E 区"
          }
        ]
      }
    ],
    "goal": "全马 3:20",
    "startDate": "2026-06-15",
    "endDate": "2026-09-07",
    "totalWeeks": 12,
    "createdAt": "2026-06-12T10:00:00Z"
  },
  "paceZones": {
    "easy": {"min": "5:30", "max": "5:45"},
    "marathon": {"min": "5:00", "max": "5:10"},
    "tempo": {"min": "4:45", "max": "4:55"},
    "interval": {"min": "4:20", "max": "4:35"},
    "rep": {"min": "4:00", "max": "4:15"}
  }
}
\`\`\``;
}

/**
 * 构建用户画像 + 历史数据的上下文提示
 */
export function buildPlanUserPrompt(input: PlanInput): string {
  const historyText = input.historyRuns && input.historyRuns.length > 0
    ? input.historyRuns
        .slice(0, 10)
        .map(
          (r) =>
            `- ${r.date}: ${r.distance}km, 配速 ${r.pace}${r.hr ? `, 心率 ${r.hr}` : ""}${r.type ? `, 类型 ${r.type}` : ""}`
        )
        .join("\n")
    : "无历史记录";

  const issuesText = input.issues && input.issues.length > 0
    ? input.issues.join(", ")
    : "无";

  return `请为以下用户生成一份个性化的周期化训练计划：

## 用户画像

- **目标**: ${input.goal}
- **当前周跑量**: ${input.currentWeeklyDistance} km
- **可用训练日**: ${input.availableDays.join(", ") || "未指定"}
- **每次可用时间**: ${input.availableTimePerDay} 分钟
- **伤病/注意事项**: ${issuesText}
- **偏好地形**: ${input.preferredTerrain || "未指定"}

## 近期训练记录

${historyText}

## 要求

1. 生成一份完整的周期化训练计划（4-12 周，根据目标自动判断）
2. 每周跑量循序渐进，增幅不超过 10%
3. 配速基于用户近期数据计算，如果没有数据则基于目标成绩估算
4. 考虑用户的可用时间和伤病限制
5. 输出严格的 JSON 格式，不要包含任何其他文字

请直接输出 JSON：`;
}

/**
 * 构建计划调整提示（用于后续修改计划）
 */
export function buildPlanAdjustmentPrompt(
  currentPlan: TrainingPlan,
  adjustmentRequest: string
): string {
  const planSummary = currentPlan.weeks
    .map(
      (w) =>
        `第 ${w.weekNumber} 周 (${w.phase}): ${w.totalDistance}km`
    )
    .join("\n");

  return `当前训练计划概要：

目标: ${currentPlan.goal}
总周数: ${currentPlan.totalWeeks}
时间: ${currentPlan.startDate} → ${currentPlan.endDate}

周跑量分布:
${planSummary}

用户调整请求: "${adjustmentRequest}"

请基于以上信息，调整训练计划并输出新的 JSON 格式计划。
调整原则：
1. 保持周期化结构（基础期→建设期→巅峰期→taper）
2. 跑量调整幅度每次不超过 20%
3. 如果用户要求增加强度，优先在建设期和巅峰期调整
4. 如果用户有伤病信号，增加恢复跑比例
5. 输出严格的 JSON 格式`;
}

/**
 * 构建计划解读提示
 */
export function buildPlanExplanationPrompt(plan: TrainingPlan, paceZones: PaceZones): string {
  const phaseStats = plan.weeks.reduce((acc, week) => {
    if (!acc[week.phase]) {
      acc[week.phase] = { weeks: 0, distance: 0 };
    }
    acc[week.phase].weeks += 1;
    acc[week.phase].distance += week.totalDistance;
    return acc;
  }, {} as Record<string, { weeks: number; distance: number }>);

  return `请为以下训练计划生成一份人性化的解读说明：

## 计划概要

- **目标**: ${plan.goal}
- **总周数**: ${plan.totalWeeks} 周
- **时间跨度**: ${plan.startDate} 至 ${plan.endDate}

## 阶段分布

${Object.entries(phaseStats)
  .map(([phase, stats]) => `- ${phase}: ${stats.weeks} 周，总跑量 ${Math.round(stats.distance * 10) / 10}km`)
  .join("\n")}

## 配速区间

- **轻松跑 (E)**: ${paceZones.easy.min} - ${paceZones.easy.max}
- **马拉松配速 (M)**: ${paceZones.marathon.min} - ${paceZones.marathon.max}
- **节奏跑 (T)**: ${paceZones.tempo.min} - ${paceZones.tempo.max}
- **间歇跑 (I)**: ${paceZones.interval.min} - ${paceZones.interval.max}
- **重复跑 (R)**: ${paceZones.rep.min} - ${paceZones.rep.max}

## 要求

1. 用专业但易懂的语言解释计划设计思路
2. 指出每个阶段的重点和预期效果
3. 给出执行建议（如何调整、何时休息、补给策略）
4. 提醒常见错误和注意事项
5. 控制在 500 字以内`;
}
