/**
 * RunCoach Agent - CLI 入口
 * 
 * 使用方式:
 *   npm install
 *   npm run dev
 * 
 * 或带参数直接提问:
 *   npm run dev -- "上海明天适合跑步吗？"
 */

import { runAgent } from "./core/agent.js";

async function main() {
  // 从命令行参数获取问题，或使用默认问题
  const userQuestion = process.argv[2] || "我今天跑了 8km，配速 5:40，心率 145，感觉有点累，明天该怎么跑？";

  console.log("=".repeat(50));
  console.log("🏃 RunCoach Agent v0.1 - 最小 Agent Loop");
  console.log("=".repeat(50));

  try {
    const { answer, toolCalls, iterations } = await runAgent(userQuestion);

    console.log("\n" + "=".repeat(50));
    console.log("📤 最终回答:");
    console.log(answer);
    console.log("=".repeat(50));
    console.log(`🔧 工具调用次数: ${toolCalls.length}`);
    console.log(`🔄 总迭代次数: ${iterations}`);

    if (toolCalls.length > 0) {
      console.log("\n📋 工具调用详情:");
      toolCalls.forEach((tc, i) => {
        console.log(`  ${i + 1}. ${tc.tool} => ${tc.error ? "❌ " + tc.error : "✅ 成功"}`);
      });
    }
  } catch (err) {
    console.error("\n💥 Agent 运行失败:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
