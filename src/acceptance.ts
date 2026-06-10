#!/usr/bin/env node
/**
 * 最终验收测试
 * Day 10: 验证 Agent 能完成核心任务
 */

import { runAgent } from "./core/agent.js";
import { runWorkflowAgent } from "./workflow-agent.js";
import { runMultiAgent } from "./multi-agent/orchestrator.js";

const ACCEPTANCE_QUESTION = "我昨天跑了 12km，今天小腿有点紧，但我这周只跑了 20km，明天想跑快一点，可以吗？";

const EXPECTED_KEYWORDS = ["不建议", "小腿", "恢复", "Z1", "Z2", "休息"];
const BAD_KEYWORDS = ["可以", "快", "冲", "PB", "阈值", "间歇"];

async function testMode(mode: string, runner: (q: string) => Promise<any>) {
  console.log(`\n🧪 验收测试: ${mode}`);
  console.log(`问题: ${ACCEPTANCE_QUESTION}`);
  console.log("-".repeat(50));

  const result = await runner(ACCEPTANCE_QUESTION);
  const answer = result.answer.toLowerCase();

  const foundExpected = EXPECTED_KEYWORDS.filter((k) => answer.includes(k.toLowerCase()));
  const foundBad = BAD_KEYWORDS.filter((k) => answer.includes(k.toLowerCase()));

  console.log(`回答: ${result.answer.slice(0, 300)}...`);
  console.log(`\n✅ 期望关键词 (${foundExpected.length}/${EXPECTED_KEYWORDS.length}): ${foundExpected.join(", ") || "无"}`);
  console.log(`❌ 不良关键词 (${foundBad.length}/${BAD_KEYWORDS.length}): ${foundBad.join(", ") || "无"}`);

  const passed = foundExpected.length >= 3 && foundBad.length === 0;
  console.log(`\n${passed ? "🎉 验收通过" : "⚠️ 验收未通过"}`);

  return passed;
}

async function main() {
  console.log("=".repeat(60));
  console.log("🏃 RunCoach Agent v1.0 - 最终验收测试");
  console.log("=".repeat(60));

  const results: Record<string, boolean> = {};

  results["Agent Loop"] = await testMode("Agent Loop (v0.1)", runAgent);
  results["Workflow"] = await testMode("Workflow (v0.2)", runWorkflowAgent);
  results["Multi-Agent"] = await testMode("Multi-Agent (v0.3)", runMultiAgent);

  console.log("\n" + "=".repeat(60));
  console.log("📊 验收汇总");
  console.log("=".repeat(60));

  for (const [mode, passed] of Object.entries(results)) {
    console.log(`${passed ? "✅" : "❌"} ${mode}`);
  }

  const allPassed = Object.values(results).every((r) => r);
  console.log(`\n${allPassed ? "🎉 全部通过验收！" : "⚠️ 部分模式未通过，建议接入真实 LLM"}`);

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("💥 验收测试失败:", err);
  process.exit(1);
});
