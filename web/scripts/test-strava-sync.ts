/**
 * Strava 同步流程测试脚本
 * 运行: cd runcoach-agent/web && npx tsx scripts/test-strava-sync.ts
 */

import { loadStravaToken } from "../lib/strava/store.js";
import { getAllRunActivities } from "../lib/strava/api.js";
import { normalizeActivities, toRunLog } from "../lib/strava/normalize.js";
import { saveRuns, loadRuns } from "../lib/memory/store.js";

async function test() {
  console.log("=== Strava 同步流程测试 ===\n");

  // 1. 检查 Token
  console.log("[1/5] 检查 Strava Token...");
  const token = await loadStravaToken();
  if (!token) {
    console.error("❌ Token 不存在，请先通过 /api/strava/auth 授权");
    process.exit(1);
  }
  console.log(`✅ Token 存在，运动员: ${token.athleteName}，过期时间: ${new Date(token.expiresAt * 1000).toLocaleString()}`);

  // 2. 检查 Token 是否过期
  const now = Math.floor(Date.now() / 1000);
  if (token.expiresAt < now + 300) {
    console.error("❌ Token 即将过期，需要重新授权");
    process.exit(1);
  }
  console.log("✅ Token 未过期\n");

  // 3. 拉取活动
  console.log("[2/5] 拉取 Strava 活动...");
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;
  let activities;
  try {
    activities = await getAllRunActivities(token.accessToken, {
      after: thirtyDaysAgo,
      maxPages: 2, // 测试时只拉 2 页
    });
  } catch (err) {
    console.error("❌ 拉取活动失败:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  console.log(`✅ 拉取到 ${activities.length} 条跑步活动`);
  if (activities.length > 0) {
    const first = activities[0];
    console.log(`   最新活动: ${first.name} (${first.start_date_local})`);
    console.log(`   距离: ${(first.distance / 1000).toFixed(1)}km, 类型: ${first.type}/${first.sport_type}`);
    console.log(`   原始数据字段检查:`);
    console.log(`     - distance: ${first.distance != null ? "✅" : "❌"}`);
    console.log(`     - moving_time: ${first.moving_time != null ? "✅" : "❌"}`);
    console.log(`     - elapsed_time: ${first.elapsed_time != null ? "✅" : "❌"}`);
    console.log(`     - average_speed: ${first.average_speed != null ? "✅" : "❌"}`);
    console.log(`     - start_date_local: ${first.start_date_local != null ? "✅" : "❌"}`);
  }
  console.log();

  // 4. 清洗数据
  console.log("[3/5] 清洗数据...");
  let normalized;
  try {
    normalized = normalizeActivities(activities);
  } catch (err) {
    console.error("❌ 数据清洗失败:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  console.log(`✅ 清洗后 ${normalized.length} 条记录`);
  if (normalized.length > 0) {
    const first = normalized[0];
    console.log(`   首条记录:`);
    console.log(`     - date: ${first.date}`);
    console.log(`     - name: ${first.name}`);
    console.log(`     - distance: ${first.distance}km`);
    console.log(`     - pace: ${first.pace}`);
    console.log(`     - feeling: ${first.feeling}`);
    console.log(`     - notes: ${first.notes.slice(0, 50)}...`);
  }
  console.log();

  // 5. 转换为 RunLog
  console.log("[4/5] 转换为内部 RunLog 格式...");
  const runLogs = normalized.map(toRunLog);
  console.log(`✅ 转换后 ${runLogs.length} 条 RunLog`);
  if (runLogs.length > 0) {
    const first = runLogs[0];
    console.log(`   首条 RunLog:`, JSON.stringify(first, null, 2).split("\n").join("\n     "));
  }
  console.log();

  // 6. 保存到 Redis
  console.log("[5/5] 保存到 Redis...");
  try {
    await saveRuns(runLogs);
    const loaded = await loadRuns();
    console.log(`✅ 保存成功，Redis 中现有 ${loaded.length} 条记录`);
  } catch (err) {
    console.error("❌ 保存失败:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  console.log("\n=== 全部测试通过 ✅ ===");
}

test().catch((err) => {
  console.error("未捕获的错误:", err);
  process.exit(1);
});
