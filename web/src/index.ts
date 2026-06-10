/**
 * RunCoach Agent - CLI 入口
 * 
 * 使用方式:
 *   npm run dev              # 默认问题，Agent Loop 模式
 *   npm run dev -- "问题"     # 指定问题
 *   MODE=workflow npm run dev -- "问题"  # Workflow 编排模式
 */

import "dotenv/config";

import { runAgent } from "./core/agent.js";
import { runWorkflowAgent } from "./workflow-agent.js";
import { runMultiAgent } from "./multi-agent/orchestrator.js";

async function main() {
  // 解析参数
  const args = process.argv.slice(2);
  const mode = process.env.MODE || "agent"; // "agent" | "workflow" | "multi"
  const userQuestion = args[0] || "我今天跑了 8km，配速 5:40，心率 145，感觉有点累，明天该怎么跑？";

  console.log("=".repeat(50));
  if (mode === "workflow") {
    console.log("🏃 RunCoach Agent v0.2 - Workflow 编排模式");
  } else if (mode === "multi") {
    console.log("🏃 RunCoach Agent v0.3 - Multi-Agent 协作模式");
  } else {
    console.log("🏃 RunCoach Agent v0.1 - Agent Loop 模式");
  }
  console.log("=".repeat(50));

  try {
    let result;
    if (mode === "workflow") {
      result = await runWorkflowAgent(userQuestion);
    } else if (mode === "multi") {
      result = await runMultiAgent(userQuestion);
    } else {
      result = await runAgent(userQuestion);
    }

    const { answer, toolCalls, iterations, memoryUpdate } = result;

    console.log("\n" + "=".repeat(50));
    console.log("📤 最终回答:");
    console.log(answer);
    console.log("=".repeat(50));
    console.log(`🔧 工具调用次数: ${toolCalls.length}`);
    console.log(`🔄 总迭代次数: ${iterations}`);

    if ("nodeHistory" in result) {
      console.log(`📍 节点路径: ${result.nodeHistory.join(" → ")}`);
    }

    if ("agentHistory" in result) {
      console.log(`🎭 Agent 协作链: ${result.agentHistory.join(" → ")}`);
    }

    if (memoryUpdate) {
      console.log("\n🧠 Memory 更新:");
      console.log(memoryUpdate);
    }

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
