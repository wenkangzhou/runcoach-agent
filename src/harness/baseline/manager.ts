/**
 * 基线管理 — 保存通过的 golden 回答，支持对比
 */

import * as fs from "fs";
import * as path from "path";
import type { Baseline, BaselineEntry, DeltaResult, HarnessResult, EvaluatedCase } from "../types.js";

const DEFAULT_BASELINE_NAME = "baseline.json";

/** 加载基线 */
export function loadBaseline(baselinePath: string): Baseline | null {
  const fullPath = path.resolve(baselinePath);
  if (!fs.existsSync(fullPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf-8")) as Baseline;
  } catch {
    return null;
  }
}

/** 保存基线（从当前结果中只保存通过的） */
export function saveBaseline(
  baselinePath: string,
  suiteName: string,
  evaluated: EvaluatedCase[]
): Baseline {
  const entries: BaselineEntry[] = evaluated
    .filter((e) => e.passed)
    .map((e) => ({
      caseId: e.run.caseId,
      matrixName: e.run.matrixName,
      model: e.run.model,
      answer: e.run.answer,
      score: e.totalScore,
      passed: true,
      savedAt: new Date().toISOString(),
    }));

  const baseline: Baseline = {
    version: "1.0",
    suite: suiteName,
    createdAt: new Date().toISOString(),
    entries,
  };

  const dir = path.dirname(path.resolve(baselinePath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2), "utf-8");
  return baseline;
}

/** 计算 delta */
export function computeDelta(
  baseline: Baseline,
  result: HarnessResult
): DeltaResult[] {
  const baselineMap = new Map<string, BaselineEntry>();
  for (const e of baseline.entries) {
    const key = `${e.caseId}-${e.matrixName || "default"}-${e.model}`;
    baselineMap.set(key, e);
  }

  const deltas: DeltaResult[] = [];

  for (const e of result.evaluated) {
    const key = `${e.run.caseId}-${e.run.matrixName || "default"}-${e.run.model}`;
    const base = baselineMap.get(key);

    if (!base) {
      // 新增用例，没有基线
      deltas.push({
        caseId: e.run.caseId,
        matrixName: e.run.matrixName,
        model: e.run.model,
        baselineScore: 0,
        currentScore: e.totalScore,
        scoreDelta: e.totalScore,
        baselinePassed: false,
        currentPassed: e.passed,
        status: e.passed ? "new-pass" : "new-fail",
      });
      continue;
    }

    let status: DeltaResult["status"] = "stable";
    if (!base.passed && e.passed) status = "improved";
    if (base.passed && !e.passed) status = "regressed";
    if (e.totalScore > base.score + 5) status = "improved";
    if (e.totalScore < base.score - 5) status = "regressed";

    deltas.push({
      caseId: e.run.caseId,
      matrixName: e.run.matrixName,
      model: e.run.model,
      baselineScore: base.score,
      currentScore: e.totalScore,
      scoreDelta: Math.round((e.totalScore - base.score) * 10) / 10,
      baselinePassed: base.passed,
      currentPassed: e.passed,
      status,
    });
  }

  return deltas;
}

/** 获取默认基线路径 */
export function getDefaultBaselinePath(outputDir: string): string {
  return path.join(path.resolve(outputDir), DEFAULT_BASELINE_NAME);
}
