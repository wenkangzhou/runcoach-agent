/**
 * MCP 演示入口
 * Day 8: 直接体验 MCP 工具调用
 *
 * 使用方式:
 *   npm run mcp
 */

import { RunningMCPClient } from "./mcp/client.js";

async function main() {
  console.log("=".repeat(50));
  console.log("🏃 RunCoach MCP 演示");
  console.log("=".repeat(50));

  const client = new RunningMCPClient("direct");
  await client.connect();

  console.log("\n📋 可用 MCP 工具:");
  const tools = client.getTools();
  tools.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.name}: ${t.description}`);
  });

  console.log("\n--- 演示 1: 获取用户画像 ---");
  const profile = await client.callTool("get_training_profile", {});
  console.log(JSON.stringify(profile, null, 2));

  console.log("\n--- 演示 2: 获取最近跑步记录 ---");
  const runs = await client.callTool("get_recent_runs", { limit: 3, days: 30 });
  console.log(JSON.stringify(runs, null, 2));

  console.log("\n--- 演示 3: 添加新记录 ---");
  const addResult = await client.callTool("add_run_log", {
    distance: 10,
    pace: "5:30",
    feeling: "很好",
    hr: 150,
    notes: "MCP 演示添加",
  });
  console.log(JSON.stringify(addResult, null, 2));

  console.log("\n--- 演示 4: 再次获取记录（验证添加成功）---");
  const runs2 = await client.callTool("get_recent_runs", { limit: 3, days: 30 });
  console.log(JSON.stringify(runs2, null, 2));

  console.log("\n--- 演示 5: 添加伤病记录 ---");
  const injuryResult = await client.callTool("add_injury_note", { issue: "脚踝轻微扭伤" });
  console.log(JSON.stringify(injuryResult, null, 2));

  await client.disconnect();

  console.log("\n✅ MCP 演示完成");
}

main().catch((err) => {
  console.error("💥 MCP 演示失败:", err);
  process.exit(1);
});
