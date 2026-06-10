/**
 * Eval CLI 入口
 * Day 9: 运行评测并生成报告
 *
 * 使用方式:
 *   npm run eval              # 默认 Agent Loop 模式
 *   MODE=workflow npm run eval  # Workflow 模式
 *   MODE=multi npm run eval     # Multi-Agent 模式
 */

import { testCases, getCategoryStats } from "./eval/cases.js";
import { runAllTests } from "./eval/runner.js";

async function main() {
  const mode = (process.env.MODE || "agent") as "agent" | "workflow" | "multi";

  console.log("=".repeat(60));
  console.log("🏃 RunCoach Agent - 评测报告");
  console.log(`模式: ${mode.toUpperCase()}`);
  console.log("=".repeat(60));

  console.log(`\n📋 测试用例分布:`);
  const stats = getCategoryStats();
  for (const [cat, count] of Object.entries(stats)) {
    console.log(`  ${cat}: ${count} 条`);
  }
  console.log(`  总计: ${testCases.length} 条`);

  console.log(`\n🔄 开始运行测试...\n`);

  const { results, summary } = await runAllTests(testCases, mode);

  // 打印每个结果
  for (const r of results) {
    const icon = r.passed ? "✅" : "❌";
    console.log(`${icon} ${r.caseId} [${r.category}] 分数: ${r.score}`);
    if (r.failures.length > 0) {
      for (const f of r.failures) {
        console.log(`   ↳ ${f}`);
      }
    }
  }

  // 打印汇总
  console.log("\n" + "=".repeat(60));
  console.log("📊 评测汇总");
  console.log("=".repeat(60));
  console.log(`总用例: ${summary.total}`);
  console.log(`通过: ${summary.passed} ✅`);
  console.log(`失败: ${summary.failed} ❌`);
  console.log(`通过率: ${summary.passRate}%`);
  console.log(`平均分数: ${summary.avgScore}`);

  console.log(`\n📈 分类明细:`);
  for (const [cat, data] of Object.entries(summary.categoryBreakdown)) {
    const rate = Math.round((data.passed / data.total) * 100);
    console.log(`  ${cat}: ${data.passed}/${data.total} (${rate}%)`);
  }

  // 失败用例详情
  const failedCases = results.filter((r) => !r.passed);
  if (failedCases.length > 0) {
    console.log(`\n🔍 失败用例详情:`);
    for (const r of failedCases) {
      console.log(`\n  ${r.caseId} [${r.category}]`);
      console.log(`  输入: ${testCases.find((tc) => tc.id === r.caseId)?.input}`);
      console.log(`  回答: ${r.answer.slice(0, 200)}...`);
      console.log(`  失败原因:`);
      for (const f of r.failures) {
        console.log(`    - ${f}`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));

  // 退出码
  process.exit(summary.passRate >= 80 ? 0 : 1);
}

main().catch((err) => {
  console.error("💥 评测失败:", err);
  process.exit(1);
});
