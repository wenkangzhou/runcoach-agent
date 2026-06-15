/**
 * 环境隔离执行器
 *
 * 每个用例运行前:
 *   1. 备份当前内存状态（profile.json + recent_runs.json）
 *   2. 清空/重置记忆状态
 *   3. 运行 Agent
 *   4. 恢复原始状态
 *
 * 这样确保用例之间不会互相污染。
 */

import * as fs from "fs";
import * as path from "path";
import { runAgent } from "../../core/agent.js";
import { runWorkflowAgent } from "../../workflow-agent.js";
import { runMultiAgent } from "../../multi-agent/orchestrator.js";
import { runCaseMultiTurn } from "./multi-turn.js";
import type { CaseDefinition, CaseRunResult, RunMode } from "../types.js";

const DATA_DIR = path.resolve("./data");
const PROFILE_FILE = path.join(DATA_DIR, "profile.json");
const RUNS_FILE = path.join(DATA_DIR, "recent_runs.json");

interface MemorySnapshot {
  profile?: string;
  runs?: string;
}

/** 备份当前内存状态 */
function backupMemory(): MemorySnapshot {
  const snapshot: MemorySnapshot = {};
  if (fs.existsSync(PROFILE_FILE)) {
    snapshot.profile = fs.readFileSync(PROFILE_FILE, "utf-8");
  }
  if (fs.existsSync(RUNS_FILE)) {
    snapshot.runs = fs.readFileSync(RUNS_FILE, "utf-8");
  }
  return snapshot;
}

/** 恢复内存状态 */
function restoreMemory(snapshot: MemorySnapshot): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (snapshot.profile) {
    fs.writeFileSync(PROFILE_FILE, snapshot.profile, "utf-8");
  } else if (fs.existsSync(PROFILE_FILE)) {
    fs.unlinkSync(PROFILE_FILE);
  }
  if (snapshot.runs) {
    fs.writeFileSync(RUNS_FILE, snapshot.runs, "utf-8");
  } else if (fs.existsSync(RUNS_FILE)) {
    fs.unlinkSync(RUNS_FILE);
  }
}

/** 清空内存状态 */
function clearMemory(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const emptyProfile = {
    goal: "",
    weeklyMileage: "",
    availableTime: "",
    issues: [],
  };
  const emptyRuns: unknown[] = [];
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(emptyProfile, null, 2), "utf-8");
  fs.writeFileSync(RUNS_FILE, JSON.stringify(emptyRuns, null, 2), "utf-8");
}

/** 在隔离环境中运行单个用例 */
export async function runCaseIsolated(
  caseDef: CaseDefinition,
  mode: RunMode,
  matrixName?: string
): Promise<CaseRunResult> {
  const start = Date.now();
  let snapshot: MemorySnapshot = {};

  try {
    // 1. 备份
    snapshot = backupMemory();

    // 2. 清空（隔离环境）
    clearMemory();

    // 多轮对话用例直接委托给 multi-turn runner（它自己管理内存隔离）
    if (caseDef.turns && caseDef.turns.length > 0) {
      return await runCaseMultiTurn(caseDef, mode, matrixName);
    }

    // 3. 运行 Agent
    let result: { answer: string; toolCalls: { tool: string; args?: Record<string, unknown>; result?: unknown; error?: string }[]; iterations: number };

    if (mode === "workflow") {
      result = await runWorkflowAgent(caseDef.input);
    } else if (mode === "multi") {
      result = await runMultiAgent(caseDef.input);
    } else {
      result = await runAgent(caseDef.input);
    }

    const durationMs = Date.now() - start;

    return {
      caseId: caseDef.id,
      caseName: caseDef.name,
      category: caseDef.category,
      input: caseDef.input,
      matrixName,
      model: detectCurrentModel(),
      mode,
      answer: result.answer,
      toolCalls: result.toolCalls.map((tc) => ({
        tool: tc.tool,
        durationMs: 0, // 细化可后续追踪
        error: tc.error,
      })),
      iterations: result.iterations,
      durationMs,
    };
  } catch (err) {
    return {
      caseId: caseDef.id,
      caseName: caseDef.name,
      category: caseDef.category,
      input: caseDef.input,
      matrixName,
      model: detectCurrentModel(),
      mode,
      answer: "",
      toolCalls: [],
      iterations: 0,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    // 4. 恢复
    restoreMemory(snapshot);
  }
}

function detectCurrentModel(): string {
  if (process.env.LLM_PROVIDER === "mock") return "mock";
  if (process.env.LLM_PROVIDER === "openai") return "openai";
  if (process.env.KIMI_API_KEY) return "kimi";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "mock";
}
