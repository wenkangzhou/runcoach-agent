/**
 * Agent 对话流程测试脚本
 * 诊断卡顿问题
 * 运行: cd runcoach-agent/web && npx dotenv-cli -e .env.local -- npx tsx scripts/test-agent-chat.ts
 */

import { runAgent } from "../lib/core/agent.js";

async function test() {
  console.log("=== Agent 对话测试 ===\n");

  const testCases = [
    "我最近一个月跑的怎么样",
    "今天跑了 5 公里",
    "明天怎么跑",
  ];

  for (const input of testCases) {
    console.log(`\n--- 测试: "${input}" ---`);
    const start = Date.now();
    try {
      const result = await Promise.race([
        runAgent(input),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT: 30秒超时")), 30000)
        ),
      ]);
      const elapsed = Date.now() - start;
      console.log(`✅ 成功 (${elapsed}ms)`);
      console.log(`   迭代: ${result.iterations}`);
      console.log(`   回答: ${result.answer.slice(0, 100)}...`);
      console.log(`   工具调用: ${result.toolCalls.map(t => t.tool).join(", ") || "无"}`);
    } catch (err) {
      const elapsed = Date.now() - start;
      console.log(`❌ 失败 (${elapsed}ms): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log("\n=== 测试完成 ===");
}

test().catch((err) => {
  console.error("未捕获错误:", err);
  process.exit(1);
});
