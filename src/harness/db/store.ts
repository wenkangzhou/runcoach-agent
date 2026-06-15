/**
 * Harness 历史数据库 — 简单 JSON 文件存储
 *
 * 每运行一次追加一条记录，支持历史查询和趋势分析。
 */

import * as fs from "fs";
import * as path from "path";
import type { HarnessResult } from "../types.js";

export interface HistoryRecord {
  runId: string;
  timestamp: string;
  suite: string;
  mode: string;
  models: string[];
  totalCases: number;
  passed: number;
  failed: number;
  passRate: number;
  avgScore: number;
  totalDurationMs: number;
  categoryBreakdown: Record<string, { total: number; passed: number; avgScore: number }>;
}

const DB_FILE = "harness-db.json";

function getDbPath(outputDir: string): string {
  return path.join(path.resolve(outputDir), DB_FILE);
}

/** 从 HarnessResult 生成记录 */
export function extractRecord(result: HarnessResult): HistoryRecord {
  const summary = result.summaries[0]; // 取第一个模型汇总
  return {
    runId: result.runId,
    timestamp: result.timestamp,
    suite: path.basename(result.config.suite),
    mode: result.config.mode,
    models: result.config.models,
    totalCases: summary?.total || result.evaluated.length,
    passed: summary?.passed || 0,
    failed: summary?.failed || 0,
    passRate: summary?.passRate || 0,
    avgScore: summary?.avgScore || 0,
    totalDurationMs: result.totalDurationMs,
    categoryBreakdown: summary?.categoryBreakdown || {},
  };
}

/** 保存运行记录 */
export function saveRecord(outputDir: string, record: HistoryRecord): void {
  const dbPath = getDbPath(outputDir);
  let records: HistoryRecord[] = [];
  if (fs.existsSync(dbPath)) {
    try {
      records = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
    } catch {
      records = [];
    }
  }
  records.push(record);
  fs.writeFileSync(dbPath, JSON.stringify(records, null, 2), "utf-8");
}

/** 读取所有历史记录 */
export function loadRecords(outputDir: string): HistoryRecord[] {
  const dbPath = getDbPath(outputDir);
  if (!fs.existsSync(dbPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(dbPath, "utf-8")) as HistoryRecord[];
  } catch {
    return [];
  }
}

/** 按时间范围查询 */
export function queryRecords(
  outputDir: string,
  options: { since?: string; until?: string; model?: string } = {}
): HistoryRecord[] {
  let records = loadRecords(outputDir);
  if (options.since) {
    records = records.filter((r) => r.timestamp >= options.since!);
  }
  if (options.until) {
    records = records.filter((r) => r.timestamp <= options.until!);
  }
  if (options.model) {
    records = records.filter((r) => r.models.includes(options.model!));
  }
  return records;
}

/** 获取最近 N 条记录 */
export function getRecentRecords(outputDir: string, n: number = 10): HistoryRecord[] {
  return loadRecords(outputDir).slice(-n);
}

/** 获取趋势数据（用于 Chart.js） */
export function getTrendData(outputDir: string, n: number = 30): {
  labels: string[];
  passRates: number[];
  avgScores: number[];
  durations: number[];
} {
  const records = getRecentRecords(outputDir, n);
  return {
    labels: records.map((r) => r.timestamp.slice(0, 10)),
    passRates: records.map((r) => r.passRate),
    avgScores: records.map((r) => r.avgScore),
    durations: records.map((r) => r.totalDurationMs),
  };
}
