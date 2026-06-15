/**
 * Harness 主引擎 — 串联 Suite → Runner → Evaluator → Baseline → Reporter
 */

import type {
  HarnessConfig,
  HarnessResult,
  EvaluatedCase,
  RunSummary,
  CaseDefinition,
  Evaluator,
  MatrixEntry,
  ReportData,
} from "./types.js";
import { loadSuite, filterCases } from "./suite/loader.js";
import { createEvaluator } from "./evaluator/factory.js";
import { runCaseIsolated } from "./runner/isolated.js";
import { loadBaseline, saveBaseline, computeDelta, getDefaultBaselinePath } from "./baseline/manager.js";
import { saveJson, saveMarkdown, saveHtml } from "./reporter/generator.js";
import { saveBadge } from "./reporter/badge.js";
import { extractRecord, saveRecord } from "./db/store.js";

// ====== 并发池 ======

async function runPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

// ====== 模型环境切换 ======

function withModelEnv<T>(model: string, fn: () => Promise<T>): Promise<T> {
  const original = {
    LLM_PROVIDER: process.env.LLM_PROVIDER,
    KIMI_API_KEY: process.env.KIMI_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  };

  switch (model) {
    case "mock":
      process.env.LLM_PROVIDER = "mock";
      delete process.env.KIMI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      break;
    case "kimi":
      process.env.LLM_PROVIDER = "kimi";
      break;
    case "openai":
      process.env.LLM_PROVIDER = "openai";
      break;
    default:
      if (model.includes(":")) {
        const [provider] = model.split(":");
        process.env.LLM_PROVIDER = provider;
      }
      break;
  }

  return fn().finally(() => {
    Object.assign(process.env, original);
  });
}

// ====== 核心执行 ======

export async function runHarness(config: HarnessConfig): Promise<HarnessResult> {
  const runId = generateRunId();
  const timestamp = new Date().toISOString();
  const totalStart = Date.now();

  // 1. 加载 Suite
  const suite = loadSuite(config.suite);
  let allCases = suite.cases;
  let cases = filterCases(allCases, {
    category: config.category,
    tags: config.tags,
  });

  if (cases.length === 0) {
    console.log(`❌ No cases matched filters: category=${config.category || "any"}, tags=${config.tags?.join(",") || "any"}`);
    const availableCategories = [...new Set(allCases.map((c) => c.category))];
    const availableTags = [...new Set(allCases.flatMap((c) => c.tags || []))];
    console.log(`   Available categories: ${availableCategories.join(", ")}`);
    console.log(`   Available tags: ${availableTags.join(", ")}`);
    process.exit(1);
  }

  // 抽样模式
  if (config.sampleCount && config.sampleCount > 0 && config.sampleCount < cases.length) {
    cases = cases.slice(0, config.sampleCount);
    console.log(`📎 Sample mode: ${config.sampleCount}/${allCases.length} cases`);
  } // 可扩展过滤

  // 2. 创建 Evaluators
  const evaluators = config.evaluators.map((ec) => createEvaluator(ec));

  // 3. 确定矩阵
  const matrix: MatrixEntry[] = config.matrix && config.matrix.length > 0
    ? config.matrix
    : [{ name: "default", env: {} }];

  const models = config.models.length > 0 ? config.models : [detectCurrentModel()];

  console.log(`\n🏗️  Harness v2 启动`);
  console.log(`   Run ID: ${runId}`);
  console.log(`   Suite: ${suite.name} v${suite.version} (${cases.length} cases)`);
  console.log(`   Models: ${models.join(", ")}`);
  console.log(`   Matrices: ${matrix.map((m) => m.name).join(", ")}`);
  console.log(`   Evaluators: ${evaluators.map((e) => `${e.name}(${e.weight})`).join(", ")}`);
  console.log(`   Concurrency: ${config.concurrency}`);
  console.log(`   Mode: ${config.mode}`);
  console.log("-".repeat(50));

  // 4. 执行所有组合 (model × matrix × case)
  const evaluated: EvaluatedCase[] = [];

  for (const model of models) {
    for (const mx of matrix) {
      console.log(`\n🤖 Model: ${model} | Matrix: ${mx.name}`);

      // 应用矩阵环境变量
      const prevEnv = { ...process.env };
      Object.assign(process.env, mx.env);

      const items = cases.map((c) => ({ caseDef: c, model, mode: config.mode, matrixName: mx.name, evaluators }));

      const results = await runPool(items, config.concurrency, async (item) => {
        return withModelEnv(item.model, async () => {
          const runResult = await runCaseIsolated(item.caseDef, item.mode, item.matrixName);

          // 评估
          const evalStart = Date.now();
          const scores = await Promise.all(
            item.evaluators.map((ev) => ev.evaluate(item.caseDef, runResult))
          );
          const evalDurationMs = Date.now() - evalStart;

          // 加权总分
          const totalWeight = item.evaluators.reduce((s, e) => s + e.weight, 0);
          const totalScore = totalWeight > 0
            ? Math.round(scores.reduce((s, sc, i) => s + sc.score * item.evaluators[i].weight, 0) / totalWeight)
            : 0;

          const passed = scores.every((s) => s.passed);

          const icon = passed ? "✅" : "❌";
          console.log(`   ${icon} ${runResult.caseId} [${runResult.category}] score=${totalScore} ${runResult.durationMs}ms`);
          if (!passed) {
            for (const sc of scores.filter((s) => !s.passed)) {
              for (const f of sc.failures.slice(0, 2)) {
                console.log(`      ↳ ${sc.evaluator}: ${f}`);
              }
            }
          }

          return { run: runResult, scores, totalScore, passed, evalDurationMs };
        });
      });

      evaluated.push(...results.map((r) => {
        // 将评估耗时注入 runResult
        r.run.timing = { evaluationMs: r.evalDurationMs };
        return r;
      }));

      // 恢复环境
      Object.assign(process.env, prevEnv);
    }
  }

  // 5. 生成汇总
  const summaries = buildSummaries(evaluated);

  const totalDurationMs = Date.now() - totalStart;

  const result: HarnessResult = {
    runId,
    timestamp,
    config,
    evaluated,
    summaries,
    totalDurationMs,
    performanceMetrics: buildPerformanceMetrics(evaluated),
  };

  // 6. 基线对比
  let deltas = undefined;
  if (config.compareBaseline) {
    const baselinePath = config.baselinePath || getDefaultBaselinePath(config.outputDir);
    const baseline = loadBaseline(baselinePath);
    if (baseline) {
      deltas = computeDelta(baseline, result);
    }
  }

  // 7. 保存基线
  if (config.saveBaseline) {
    const baselinePath = config.baselinePath || getDefaultBaselinePath(config.outputDir);
    saveBaseline(baselinePath, suite.name, evaluated);
    console.log(`\n💾 Baseline saved: ${baselinePath}`);
  }

  // 8. 生成报告
  const reportData: ReportData = { result, deltas };
  const saved: string[] = [];

  if (config.formats.includes("json")) {
    saved.push(saveJson(config.outputDir, runId, result));
  }
  if (config.formats.includes("markdown")) {
    saved.push(saveMarkdown(config.outputDir, runId, reportData));
  }
  if (config.formats.includes("html")) {
    saved.push(saveHtml(config.outputDir, runId, reportData));
  }

  // 10. 生成 Badge
  const summary = result.summaries[0];
  if (summary) {
    saved.push(saveBadge(config.outputDir, summary.passRate, summary.avgScore, summary.total));
  }

  console.log(`\n📁 Reports saved:`);
  for (const p of saved) {
    console.log(`   ${p}`);
  }

  // 9. 保存到数据库
  saveRecord(config.outputDir, extractRecord(result));
  console.log(`\n💾 Record saved to harness-db.json`);

  return result;
}

// ====== 汇总 ======

function buildSummaries(evaluated: EvaluatedCase[]): RunSummary[] {
  const groups = new Map<string, EvaluatedCase[]>();
  for (const e of evaluated) {
    const key = `${e.run.model}-${e.run.matrixName || "default"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  const summaries: RunSummary[] = [];
  for (const [_, group] of groups) {
    const model = group[0].run.model;
    const matrixName = group[0].run.matrixName;
    const total = group.length;
    const passed = group.filter((e) => e.passed).length;

    const categoryBreakdown: Record<string, { total: number; passed: number; avgScore: number }> = {};
    for (const e of group) {
      const cat = e.run.category;
      if (!categoryBreakdown[cat]) categoryBreakdown[cat] = { total: 0, passed: 0, avgScore: 0 };
      categoryBreakdown[cat].total++;
      if (e.passed) categoryBreakdown[cat].passed++;
      categoryBreakdown[cat].avgScore += e.totalScore;
    }
    for (const cat of Object.keys(categoryBreakdown)) {
      categoryBreakdown[cat].avgScore = Math.round(categoryBreakdown[cat].avgScore / categoryBreakdown[cat].total);
    }

    const evaluatorBreakdown: Record<string, { total: number; passed: number; avgScore: number }> = {};
    for (const e of group) {
      for (const s of e.scores) {
        if (!evaluatorBreakdown[s.evaluator]) evaluatorBreakdown[s.evaluator] = { total: 0, passed: 0, avgScore: 0 };
        evaluatorBreakdown[s.evaluator].total++;
        if (s.passed) evaluatorBreakdown[s.evaluator].passed++;
        evaluatorBreakdown[s.evaluator].avgScore += s.score;
      }
    }
    for (const name of Object.keys(evaluatorBreakdown)) {
      evaluatorBreakdown[name].avgScore = Math.round(evaluatorBreakdown[name].avgScore / evaluatorBreakdown[name].total);
    }

    summaries.push({
      model,
      matrixName,
      total,
      passed,
      failed: total - passed,
      passRate: Math.round((passed / total) * 100),
      avgScore: Math.round(group.reduce((s, e) => s + e.totalScore, 0) / total),
      avgDurationMs: Math.round(group.reduce((s, e) => s + e.run.durationMs, 0) / total),
      avgIterations: Math.round((group.reduce((s, e) => s + e.run.iterations, 0) / total) * 10) / 10,
      categoryBreakdown,
      evaluatorBreakdown,
    });
  }

  return summaries;
}

function buildPerformanceMetrics(evaluated: EvaluatedCase[]): HarnessResult["performanceMetrics"] {
  const total = evaluated.length;
  if (total === 0) return undefined;

  const totalTokens = evaluated.reduce((s, e) => s + (e.run.tokenUsage?.total || 0), 0);
  const avgTokens = totalTokens > 0 ? Math.round(totalTokens / total) : 0;

  const evalMs = evaluated.map((e) => e.run.timing?.evaluationMs || 0);
  const avgEvalMs = Math.round(evalMs.reduce((s, ms) => s + ms, 0) / total);

  const toolCallsMs = evaluated.map((e) => e.run.toolCallsTotalMs || 0);
  const avgToolCallsMs = Math.round(toolCallsMs.reduce((s, ms) => s + ms, 0) / total);

  const llmDecisionMs = evaluated.map((e) => e.run.timing?.llmDecisionMs || 0);
  const avgLlmDecisionMs = Math.round(llmDecisionMs.reduce((s, ms) => s + ms, 0) / total);

  return {
    avgToolCallsMs,
    avgLlmDecisionMs,
    avgEvaluationMs: avgEvalMs,
    totalTokens,
    avgTokensPerCase: avgTokens,
  };
}

// ====== 工具 ======

function generateRunId(): string {
  const now = new Date();
  const d = now.toISOString().slice(0, 10).replace(/-/g, "");
  const t = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const r = Math.random().toString(36).slice(2, 6);
  return `${d}-${t}-${r}`;
}

function detectCurrentModel(): string {
  if (process.env.LLM_PROVIDER === "mock") return "mock";
  if (process.env.LLM_PROVIDER === "openai") return "openai";
  if (process.env.KIMI_API_KEY) return "kimi";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "mock";
}
