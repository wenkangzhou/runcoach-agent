/**
 * 多轮对话 Runner — 测试 Agent 上下文保持能力
 *
 * 与单轮不同，多轮不重置内存，而是将同一 AgentContext 传递下去，
 * 验证 Agent 是否能在后续对话中引用之前提到的信息。
 */

import type { CaseDefinition, CaseRunResult, TurnResult, RunMode } from "../types.js";
import { runAgent } from "../../core/agent.js";
import type { AgentContext } from "../../core/types.js";

const DATA_DIR = "./data";
const PROFILE_FILE = `${DATA_DIR}/profile.json`;
const RUNS_FILE = `${DATA_DIR}/recent_runs.json`;

import * as fs from "fs";

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

function detectCurrentModel(): string {
  if (process.env.LLM_PROVIDER === "mock") return "mock";
  if (process.env.LLM_PROVIDER === "openai") return "openai";
  if (process.env.KIMI_API_KEY) return "kimi";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "mock";
}

/** 运行多轮对话用例 */
export async function runCaseMultiTurn(
  caseDef: CaseDefinition,
  mode: RunMode,
  matrixName?: string
): Promise<CaseRunResult> {
  const start = Date.now();
  let snapshot: MemorySnapshot = {};

  try {
    // 1. 备份（整个多轮开始前只备份一次）
    snapshot = backupMemory();

    // 2. 清空（隔离整个多轮会话）
    clearMemory();

    const turnResults: TurnResult[] = [];
    let context: AgentContext | undefined;
    let allToolCalls: { tool: string; durationMs: number; error?: string }[] = [];
    let totalIterations = 0;

    const turns = caseDef.turns || [];

    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      const turnStart = Date.now();

      console.log(`\n🔄 Multi-turn [${caseDef.id}] Turn ${i + 1}/${turns.length}: "${turn.input}"`);

      // 运行 Agent（传递上一轮的 context）
      const result = await runAgent(turn.input, context);
      const turnDuration = Date.now() - turnStart;

      context = result.context;
      totalIterations += result.iterations;

      const turnToolCalls = result.toolCalls.map((tc) => ({
        tool: tc.tool,
        durationMs: 0,
        error: tc.error,
      }));
      allToolCalls.push(...turnToolCalls);

      turnResults.push({
        turnIndex: i,
        input: turn.input,
        answer: result.answer,
        toolCalls: turnToolCalls,
        iterations: result.iterations,
        durationMs: turnDuration,
      });

      console.log(`   ✅ Turn ${i + 1} done: ${turnDuration}ms, ${result.iterations} iter`);
    }

    const durationMs = Date.now() - start;

    // 最后一轮的 answer 作为 overall answer，但保留所有 turn
    return {
      caseId: caseDef.id,
      caseName: caseDef.name,
      category: caseDef.category,
      input: turns.map((t) => t.input).join(" → "),
      matrixName,
      model: detectCurrentModel(),
      mode,
      answer: turnResults[turnResults.length - 1]?.answer || "",
      toolCalls: allToolCalls,
      iterations: totalIterations,
      durationMs,
      turnResults,
      messageHistory: context?.messages.map((m) => ({ role: m.role, content: m.content })),
    };
  } catch (err) {
    return {
      caseId: caseDef.id,
      caseName: caseDef.name,
      category: caseDef.category,
      input: caseDef.turns?.map((t) => t.input).join(" → ") || "",
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
    // 3. 恢复（整个多轮结束后只恢复一次）
    restoreMemory(snapshot);
  }
}
