/**
 * Harness CLI 入口 v2
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { runHarness } from "./harness/engine.js";
import type { HarnessConfig, RunMode, MatrixEntry } from "./harness/types.js";

function detectAvailableModels(): string[] {
  const models: string[] = [];
  if (process.env.KIMI_API_KEY) models.push("kimi");
  if (process.env.OPENAI_API_KEY) models.push("openai");
  if (models.length === 0) models.push("mock");
  return models;
}

const autoModels = detectAvailableModels();

function parseArgs(): Partial<HarnessConfig> & { dryRun?: boolean; sampleCount?: number; recommend?: boolean; deploy?: boolean } {
  const args = process.argv.slice(2);
  const result: any = {
    suite: "./src/harness/config/default-suite.json",
    evaluators: [{ type: "rule" as const, weight: 1, config: {} }],
    concurrency: autoModels.includes("kimi") ? 1 : 3,
    mode: "agent" as RunMode,
    models: [],
    compareBaseline: false,
    outputDir: "./harness-runs",
    formats: ["json", "markdown", "html"] as ("json" | "markdown" | "html")[],
    saveBaseline: false,
    sampleCount: undefined,
    category: undefined,
    tags: undefined,
    recommend: false,
    deploy: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--suite=")) result.suite = arg.split("=")[1];
    else if (arg === "--suite") result.suite = args[++i];
    else if (arg.startsWith("--model=")) result.models = arg.split("=")[1].split(",").map((s: string) => s.trim());
    else if (arg === "--model") result.models = args[++i].split(",").map((s: string) => s.trim());
    else if (arg.startsWith("--mode=")) result.mode = arg.split("=")[1] as RunMode;
    else if (arg === "--mode") result.mode = args[++i] as RunMode;
    else if (arg.startsWith("--concurrency=")) result.concurrency = parseInt(arg.split("=")[1], 10) || 3;
    else if (arg === "--concurrency") result.concurrency = parseInt(args[++i], 10) || 3;
    else if (arg.startsWith("--output=")) result.outputDir = arg.split("=")[1];
    else if (arg === "--output") result.outputDir = args[++i];
    else if (arg.startsWith("--sample=")) result.sampleCount = parseInt(arg.split("=")[1], 10) || 3;
    else if (arg === "--sample") result.sampleCount = parseInt(args[++i], 10) || 3;
    else if (arg.startsWith("--category=")) result.category = arg.split("=")[1];
    else if (arg === "--category") result.category = args[++i];
    else if (arg.startsWith("--tag=")) result.tags = arg.split("=")[1].split(",").map((s: string) => s.trim());
    else if (arg === "--tag") result.tags = args[++i].split(",").map((s: string) => s.trim());
    else if (arg.startsWith("--matrix=")) result.matrix = parseMatrix(arg.split("=")[1]);
    else if (arg === "--matrix") result.matrix = parseMatrix(args[++i]);
    else if (arg === "--compare") result.compareBaseline = true;
    else if (arg === "--save-baseline") result.saveBaseline = true;
    else if (arg === "--no-md") result.formats = result.formats.filter((f: string) => f !== "markdown");
    else if (arg === "--no-html") result.formats = result.formats.filter((f: string) => f !== "html");
    else if (arg === "--no-json") result.formats = result.formats.filter((f: string) => f !== "json");
    else if (arg === "--dry-run") result.dryRun = true;
    else if (arg === "--recommend") result.recommend = true;
    else if (arg === "--deploy") result.deploy = true;
  }

  return result;
}

function parseMatrix(input: string): MatrixEntry[] {
  const trimmed = input.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return JSON.parse(trimmed) as MatrixEntry[];
  }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return [JSON.parse(trimmed) as MatrixEntry];
  }
  // 文件路径
  if (fs.existsSync(path.resolve(trimmed))) {
    return JSON.parse(fs.readFileSync(path.resolve(trimmed), "utf-8")) as MatrixEntry[];
  }
  throw new Error(`无法解析 matrix: ${trimmed}`);
}


async function main() {
  const args = parseArgs();

  const config: HarnessConfig = {
    suite: args.suite || "./src/harness/config/default-suite.json",
    evaluators: args.evaluators || [{ type: "rule", weight: 1, config: {} }],
    concurrency: args.concurrency || (autoModels.includes("kimi") ? 1 : 3),
    mode: args.mode || "agent",
    models: args.models && args.models.length > 0 ? args.models : autoModels,
    compareBaseline: args.compareBaseline || false,
    outputDir: args.outputDir || "./harness-runs",
    formats: args.formats || ["json", "markdown", "html"],
    saveBaseline: args.saveBaseline || false,
    sampleCount: args.sampleCount,
    category: args.category,
    tags: args.tags,
    matrix: args.matrix,
  };

  console.log("=".repeat(60));
  console.log("🏗️  RunCoach Harness v2");
  console.log("=".repeat(60));
  console.log(`Suite:      ${config.suite}${config.sampleCount ? ` (sample: ${config.sampleCount})` : ""}${config.category ? ` [category: ${config.category}]` : ""}${config.tags ? ` [tags: ${config.tags.join(", ")}]` : ""}`);
  console.log(`Models:     ${config.models.length > 0 ? config.models.join(", ") : "auto"}`);
  console.log(`Mode:       ${config.mode}`);
  console.log(`Concurrency: ${config.concurrency}`);
  console.log(`Evaluators: ${config.evaluators.map((e) => e.type).join(", ")}`);
  console.log(`Formats:    ${config.formats.join(", ")}`);
  console.log(`Baseline:   ${config.compareBaseline ? "compare" : "-"} / ${config.saveBaseline ? "save" : "-"}`);
  console.log("=".repeat(60));

  if (args.dryRun) {
    console.log("\n🛑 Dry run, exiting.");
    process.exit(0);
  }

  const result = await runHarness(config);

  // 用例推荐（如果 --recommend）
  if (args.recommend) {
    const { recommendCases } = await import("./harness/recommender.js");
    await recommendCases(result, path.join(config.outputDir, `harness-recommended-${result.runId}.json`));
  }

  // 静态托管（如果 --deploy）
  if (args.deploy) {
    const { generateDeployPackage } = await import("./harness/reporter/deploy.js");
    const deployDir = generateDeployPackage(config.outputDir, result);
    console.log(`\n🚀 Deploy package generated: ${deployDir}`);
    console.log(`   Run: cd ${deployDir} && npx vercel --prod`);
  }

  // CLI 摘要
  console.log("\n" + "=".repeat(60));
  console.log("📊 Harness Summary");
  console.log("=".repeat(60));
  for (const s of result.summaries) {
    console.log(`\n${s.model}${s.matrixName ? ` / ${s.matrixName}` : ""}`);
    console.log(`  Passed: ${s.passed}/${s.total} (${s.passRate}%)`);
    console.log(`  AvgScore: ${s.avgScore} | AvgDuration: ${s.avgDurationMs}ms | AvgIterations: ${s.avgIterations}`);
  }
  console.log(`\n⏱️ Total: ${result.totalDurationMs}ms`);
  console.log("=".repeat(60));

  const overallRate = Math.round(result.summaries.reduce((s, sm) => s + sm.passRate, 0) / result.summaries.length);
  process.exit(overallRate >= 50 ? 0 : 1);
}

main().catch((err) => {
  console.error("\n💥 Harness failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
