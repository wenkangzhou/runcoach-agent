/**
 * 评测运行器
 * Day 9: 执行测试用例并评分
 */

import { runAgent } from "../core/agent.js";
import { runWorkflowAgent } from "../workflow-agent.js";
import { runMultiAgent } from "../multi-agent/orchestrator.js";
import type { TestCase } from "./cases.js";

/** 评测结果 */
export interface EvalResult {
  caseId: string;
  category: string;
  passed: boolean;
  score: number;
  toolCalls: string[];
  answer: string;
  failures: string[];
}

/** 运行单个测试用例 */
export async function runTestCase(
  testCase: TestCase,
  mode: "agent" | "workflow" | "multi" = "agent"
): Promise<EvalResult> {
  let answer: string;
  let toolCalls: { tool: string }[] = [];

  try {
    if (mode === "workflow") {
      const result = await runWorkflowAgent(testCase.input);
      answer = result.answer;
      toolCalls = result.toolCalls;
    } else if (mode === "multi") {
      const result = await runMultiAgent(testCase.input);
      answer = result.answer;
      toolCalls = result.toolCalls;
    } else {
      const result = await runAgent(testCase.input);
      answer = result.answer;
      toolCalls = result.toolCalls;
    }
  } catch (err) {
    return {
      caseId: testCase.id,
      category: testCase.category,
      passed: false,
      score: 0,
      toolCalls: [],
      answer: `ERROR: ${err instanceof Error ? err.message : String(err)}`,
      failures: ["Agent 执行失败"],
    };
  }

  const failures: string[] = [];
  let score = 100;

  // 1. 检查 mustInclude
  for (const keyword of testCase.mustInclude) {
    if (!answer.toLowerCase().includes(keyword.toLowerCase())) {
      failures.push(`缺少必须包含的关键词: "${keyword}"`);
      score -= 15;
    }
  }

  // 2. 检查 mustNotInclude
  for (const keyword of testCase.mustNotInclude) {
    if (answer.toLowerCase().includes(keyword.toLowerCase())) {
      failures.push(`包含不应出现的关键词: "${keyword}"`);
      score -= 20;
    }
  }

  // 3. 检查期望工具
  if (testCase.expectedTool) {
    const calledTools = toolCalls.map((tc) => tc.tool);
    if (!calledTools.includes(testCase.expectedTool)) {
      failures.push(`未调用期望工具: ${testCase.expectedTool}，实际调用: ${calledTools.join(", ") || "无"}`);
      score -= 10;
    }
  }

  // 4. 最低分数检查
  const minScore = testCase.minScore || 60;
  const passed = score >= minScore && failures.length === 0;

  return {
    caseId: testCase.id,
    category: testCase.category,
    passed,
    score: Math.max(0, score),
    toolCalls: toolCalls.map((tc) => tc.tool),
    answer: answer.slice(0, 500),
    failures,
  };
}

/** 运行所有测试用例 */
export async function runAllTests(
  testCases: TestCase[],
  mode: "agent" | "workflow" | "multi" = "agent"
): Promise<{
  results: EvalResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    avgScore: number;
    categoryBreakdown: Record<string, { total: number; passed: number }>;
  };
}> {
  const results: EvalResult[] = [];

  for (const testCase of testCases) {
    const result = await runTestCase(testCase, mode);
    results.push(result);
  }

  // 统计
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const avgScore = Math.round(
    results.reduce((s, r) => s + r.score, 0) / total
  );

  // 分类统计
  const categoryBreakdown: Record<string, { total: number; passed: number }> = {};
  for (const r of results) {
    if (!categoryBreakdown[r.category]) {
      categoryBreakdown[r.category] = { total: 0, passed: 0 };
    }
    categoryBreakdown[r.category].total++;
    if (r.passed) categoryBreakdown[r.category].passed++;
  }

  return {
    results,
    summary: {
      total,
      passed,
      failed: total - passed,
      passRate: Math.round((passed / total) * 100),
      avgScore,
      categoryBreakdown,
    },
  };
}
