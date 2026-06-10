/**
 * 评测测试用例
 * Day 9: 20 条测试用例覆盖核心场景
 */

export interface TestCase {
  id: string;
  category: string;
  input: string;
  description: string;
  mustInclude: string[];      // 回答中必须包含的关键词
  mustNotInclude: string[];   // 回答中不能包含的关键词
  expectedTool?: string;      // 期望调用的工具
  minScore?: number;          // 最低分数（0-100）
}

/** 测试用例集 */
export const testCases: TestCase[] = [
  // ========== 疲劳恢复类 ==========
  {
    id: "E001",
    category: "疲劳恢复",
    input: "我今天跑了 15km，配速 5:30，心率 155，感觉很累，明天该怎么跑？",
    description: "高强度长距离后疲劳，应建议恢复",
    mustInclude: ["恢复", "休息"],
    mustNotInclude: ["间歇", "阈值", "高强度", "冲"],
    expectedTool: "suggestNextWorkout",
    minScore: 80,
  },
  {
    id: "E002",
    category: "疲劳恢复",
    input: "昨天跑了间歇，今天腿酸，晚上还能跑阈值吗？",
    description: "间歇后酸痛，不应建议阈值",
    mustInclude: ["不建议", "恢复"],
    mustNotInclude: ["阈值", "可以跑", "继续"],
    expectedTool: "suggestNextWorkout",
    minScore: 85,
  },
  {
    id: "E003",
    category: "疲劳恢复",
    input: "这周跑了 5 次，每次 10km，今天感觉腿很沉，明天怎么安排？",
    description: "周频率过高+疲劳，应建议休息",
    mustInclude: ["休息", "恢复"],
    mustNotInclude: ["跑", "训练", "强度"],
    expectedTool: "suggestNextWorkout",
    minScore: 80,
  },

  // ========== 伤病风险类 ==========
  {
    id: "E004",
    category: "伤病风险",
    input: "今天跑了 8km，配速 5:40，膝盖有点痛，明天想跑 15km 可以吗？",
    description: "膝盖痛+想加长距离，应阻止",
    mustInclude: ["不建议", "膝盖", "休息", "就医"],
    mustNotInclude: ["15km", "可以", "没问题"],
    expectedTool: "suggestNextWorkout",
    minScore: 90,
  },
  {
    id: "E005",
    category: "伤病风险",
    input: "小腿有点紧，但本周只跑了 20km，明天想跑快一点，可以吗？",
    description: "小腿紧+想跑快，应建议恢复",
    mustInclude: ["不建议", "小腿", "恢复"],
    mustNotInclude: ["快", "冲", "PB"],
    expectedTool: "suggestNextWorkout",
    minScore: 85,
  },
  {
    id: "E006",
    category: "伤病风险",
    input: "脚踝扭伤了，但下周有比赛，这周还能训练吗？",
    description: "急性伤病，应完全禁止训练",
    mustInclude: ["不能", "休息", "恢复", "医生"],
    mustNotInclude: ["可以跑", "训练", "比赛"],
    expectedTool: "suggestNextWorkout",
    minScore: 90,
  },

  // ========== 周跑量控制类 ==========
  {
    id: "E007",
    category: "周跑量",
    input: "这周已经跑了 70km，今天感觉不错，明天想跑个 20km 长距离，可以吗？",
    description: "周跑量已高，不应再加长距离",
    mustInclude: ["不建议", "减量", "休息"],
    mustNotInclude: ["20km", "长距离", "可以"],
    expectedTool: "suggestNextWorkout",
    minScore: 85,
  },
  {
    id: "E008",
    category: "周跑量",
    input: "本周只跑了 15km，状态很好，明天怎么安排？",
    description: "周跑量低+状态好，应正常训练",
    mustInclude: ["有氧", "基础", "跑"],
    mustNotInclude: ["休息", "减量"],
    expectedTool: "suggestNextWorkout",
    minScore: 70,
  },

  // ========== 目标匹配类 ==========
  {
    id: "E009",
    category: "目标匹配",
    input: "我目标是全马 3:20，今天跑了 10km 轻松跑，明天该跑什么？",
    description: "目标 3:20，建议应匹配目标配速",
    mustInclude: ["3:20", "配速"],
    mustNotInclude: ["2:50", "4:00"],
    expectedTool: "suggestNextWorkout",
    minScore: 75,
  },
  {
    id: "E010",
    category: "目标匹配",
    input: "目标全马破 3，这周该怎么安排强度？",
    description: "高目标需要强度训练",
    mustInclude: ["间歇", "阈值", "节奏"],
    mustNotInclude: ["只跑轻松", "不需要强度"],
    expectedTool: "suggestNextWorkout",
    minScore: 70,
  },

  // ========== 时间限制类 ==========
  {
    id: "E011",
    category: "时间限制",
    input: "我只有 30 分钟，今天想跑一下，该怎么安排？",
    description: "时间限制 30 分钟",
    mustInclude: ["30", "分钟"],
    mustNotInclude: ["60", "90", "小时"],
    expectedTool: "suggestNextWorkout",
    minScore: 75,
  },
  {
    id: "E012",
    category: "时间限制",
    input: "早上只有 45 分钟，想跑个高质量的，怎么安排？",
    description: "45 分钟高质量训练",
    mustInclude: ["45", "节奏", "阈值"],
    mustNotInclude: ["长距离", "90"],
    expectedTool: "suggestNextWorkout",
    minScore: 75,
  },

  // ========== 状态良好类 ==========
  {
    id: "E013",
    category: "状态良好",
    input: "今天休息，感觉很好，这周跑了 30km，明天怎么安排？",
    description: "状态好+周跑量正常，应正常训练",
    mustInclude: ["有氧", "基础", "跑"],
    mustNotInclude: ["休息", "恢复"],
    expectedTool: "suggestNextWorkout",
    minScore: 70,
  },
  {
    id: "E014",
    category: "状态良好",
    input: "今天轻松跑了 5km，感觉很好，明天想跑个强度，可以吗？",
    description: "轻松日后想上强度，应允许",
    mustInclude: ["可以", "间歇", "阈值", "节奏"],
    mustNotInclude: ["不建议", "休息"],
    expectedTool: "suggestNextWorkout",
    minScore: 70,
  },

  // ========== 知识库类 ==========
  {
    id: "E015",
    category: "知识库",
    input: "马拉松比赛当天早餐吃什么？",
    description: "应检索补给知识库",
    mustInclude: ["早餐", "碳水"],
    mustNotInclude: ["不知道", "不清楚"],
    expectedTool: "retrieveKnowledge",
    minScore: 70,
  },
  {
    id: "E016",
    category: "知识库",
    input: "心率区间怎么划分？Z2 是什么？",
    description: "应检索心率区间知识",
    mustInclude: ["Z2", "有氧", "心率"],
    mustNotInclude: ["不知道"],
    expectedTool: "retrieveKnowledge",
    minScore: 70,
  },
  {
    id: "E017",
    category: "知识库",
    input: "膝盖有点痛，是不是跑者膝？怎么预防？",
    description: "应检索伤病预防知识",
    mustInclude: ["跑者膝", "预防", "膝盖"],
    mustNotInclude: ["不知道"],
    expectedTool: "retrieveKnowledge",
    minScore: 70,
  },

  // ========== 工具调用类 ==========
  {
    id: "E018",
    category: "工具调用",
    input: "上海明天适合跑步吗？",
    description: "应调用天气工具",
    mustInclude: ["天气", "上海"],
    mustNotInclude: [],
    expectedTool: "getWeather",
    minScore: 60,
  },
  {
    id: "E019",
    category: "工具调用",
    input: "帮我计算 5:40 配速跑 10km 需要多少分钟",
    description: "应调用计算工具或正确计算",
    mustInclude: ["57", "分钟"],
    mustNotInclude: [],
    expectedTool: "calculate",
    minScore: 80,
  },
  {
    id: "E020",
    category: "工具调用",
    input: "今天跑了 8km，配速 5:40，心率 145，感觉有点累",
    description: "应正确解析跑步数据",
    mustInclude: ["8km", "5:40", "145"],
    mustNotInclude: [],
    expectedTool: "parseRunLog",
    minScore: 80,
  },
];

/** 获取分类统计 */
export function getCategoryStats(): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const tc of testCases) {
    stats[tc.category] = (stats[tc.category] || 0) + 1;
  }
  return stats;
}
