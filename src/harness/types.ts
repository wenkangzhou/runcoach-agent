/**
 * Harness 核心类型 — 配置驱动、可插拔评估、环境隔离
 *
 * 架构:
 *   SuiteConfig -> SuiteLoader -> TestCase -> Runner -> Evaluator -> Result -> Reporter
 */

// ========== 配置层 ==========

/** 单个测试用例定义（配置驱动） */
export interface CaseDefinition {
  id: string;
  name: string;
  category: string;
  input: string;
  tags?: string[];
  /** 是否跳过 */
  skip?: boolean;
  /** 期望参数（传递给 Agent） */
  expectedParams?: Record<string, unknown>;
  /** 多轮对话（与 input 二选一，mutually exclusive） */
  turns?: TurnDefinition[];
}

/** 多轮对话中单轮定义 */
export interface TurnDefinition {
  input: string;
  /** 该轮的期望参数（如上一轮未设置则继承） */
  expectedParams?: Record<string, unknown>;
  /** 该轮标签（如上一轮未设置则继承） */
  tags?: string[];
}

/** 测试套件定义 */
export interface SuiteDefinition {
  name: string;
  description?: string;
  version: string;
  cases: CaseDefinition[];
  /** 全局默认配置 */
  defaults?: {
    mode?: RunMode;
    model?: string;
    maxIterations?: number;
  };
}

/** 评估策略配置 */
export interface EvaluatorConfig {
  /** 评估器类型 */
  type: "rule" | "llm-judge" | "embedding" | "custom";
  /** 评分权重 (0-1) */
  weight: number;
  /** 具体配置 */
  config?: Record<string, unknown>;
}

/** 参数矩阵条目 */
export interface MatrixEntry {
  name: string;
  env: Record<string, string>;
  /** 可覆盖的 suite 配置 */
  overrides?: Partial<SuiteDefinition>;
}

/** Harness 完整配置 */
export interface HarnessConfig {
  /** 测试套件路径（JSON 文件） */
  suite: string;
  /** 评估器列表 */
  evaluators: EvaluatorConfig[];
  /** 参数矩阵（为空则只跑一组） */
  matrix?: MatrixEntry[];
  /** 并发数 */
  concurrency: number;
  /** 运行模式 */
  mode: RunMode;
  /** 模型列表 */
  models: string[];
  /** 是否对比基线 */
  compareBaseline: boolean;
  /** 基线路径 */
  baselinePath?: string;
  /** 输出目录 */
  outputDir: string;
  /** 报告格式 */
  formats: ("json" | "markdown" | "html")[];
  /** 是否保存基线 */
  saveBaseline: boolean;
  /** 抽样数量 */
  sampleCount?: number;
  /** 分类过滤 */
  category?: string;
  /** 标签过滤 */
  tags?: string[];
}

export type RunMode = "agent" | "workflow" | "multi";

// ========== 执行层 ==========

/** 单用例运行结果（原始） */
export interface CaseRunResult {
  caseId: string;
  caseName: string;
  category: string;
  input: string;
  matrixName?: string;
  model: string;
  mode: RunMode;
  /** 原始回答 */
  answer: string;
  /** 工具调用记录 */
  toolCalls: { tool: string; durationMs: number; error?: string }[];
  /** 迭代次数 */
  iterations: number;
  /** 运行耗时 ms */
  durationMs: number;
  /** 错误信息 */
  error?: string;
  /** 完整 messages 上下文（用于调试） */
  messageHistory?: { role: string; content: string }[];
  /** Token 消耗（如 LLM 返回了 usage 信息） */
  tokenUsage?: { prompt?: number; completion?: number; total?: number };
  /** 工具调用总耗时 */
  toolCallsTotalMs?: number;
  /** 多轮对话结果（如果该用例是多轮） */
  turnResults?: TurnResult[];
  /** 各步骤耗时明细 */
  timing?: {
    llmDecisionMs?: number;
    toolExecutionMs?: number;
    evaluationMs?: number;
  };
}

/** 多轮对话中单轮结果 */
export interface TurnResult {
  turnIndex: number;
  input: string;
  answer: string;
  toolCalls: { tool: string; durationMs: number; error?: string }[];
  iterations: number;
  durationMs: number;
}

// ========== 评估层 ==========

/** 评估维度得分 */
export interface EvaluationScore {
  evaluator: string;
  score: number; // 0-100
  passed: boolean;
  /** 未通过原因 */
  failures: string[];
  /** 评估器额外信息 */
  metadata?: Record<string, unknown>;
}

/** 单用例完整评估结果 */
export interface EvaluatedCase {
  run: CaseRunResult;
  scores: EvaluationScore[];
  /** 加权总分 */
  totalScore: number;
  /** 是否通过（所有评估器都通过） */
  passed: boolean;
  /** 评估耗时 ms */
  evalDurationMs: number;
}

/** 评估器接口 */
export interface Evaluator {
  name: string;
  weight: number;
  evaluate(caseDef: CaseDefinition, result: CaseRunResult): Promise<EvaluationScore>;
}

// ========== 汇总层 ==========

/** 模型-矩阵维度的汇总 */
export interface RunSummary {
  model: string;
  matrixName?: string;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  avgScore: number;
  avgDurationMs: number;
  avgIterations: number;
  categoryBreakdown: Record<string, { total: number; passed: number; avgScore: number }>;
  evaluatorBreakdown: Record<string, { total: number; passed: number; avgScore: number }>;
}

/** 完整 Harness 运行结果 */
export interface HarnessResult {
  runId: string;
  timestamp: string;
  config: HarnessConfig;
  evaluated: EvaluatedCase[];
  summaries: RunSummary[];
  totalDurationMs: number;
  /** 性能指标汇总 */
  performanceMetrics?: {
    avgToolCallsMs: number;
    avgLlmDecisionMs: number;
    avgEvaluationMs: number;
    totalTokens: number;
    avgTokensPerCase: number;
  };
}

// ========== 基线层 ==========

/** 基线条目 */
export interface BaselineEntry {
  caseId: string;
  matrixName?: string;
  model: string;
  /** 基准回答 */
  answer: string;
  /** 基准分数 */
  score: number;
  /** 是否通过 */
  passed: boolean;
  /** 保存时间 */
  savedAt: string;
}

/** 基线文件 */
export interface Baseline {
  version: string;
  suite: string;
  createdAt: string;
  entries: BaselineEntry[];
}

/** Delta 对比结果 */
export interface DeltaResult {
  caseId: string;
  matrixName?: string;
  model: string;
  baselineScore: number;
  currentScore: number;
  scoreDelta: number;
  baselinePassed: boolean;
  currentPassed: boolean;
  status: "new-pass" | "new-fail" | "regressed" | "improved" | "stable";
}

// ========== 报告层 ==========

export interface ReportData {
  result: HarnessResult;
  deltas?: DeltaResult[];
  history?: { runId: string; timestamp: string; passRate: number; avgScore: number }[];
}
