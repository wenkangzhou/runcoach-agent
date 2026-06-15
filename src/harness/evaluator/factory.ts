/**
 * Evaluator 工厂 — 创建可插拔的评估器实例
 *
 * 支持的评估器:
 *   1. rule-based: 关键词匹配（硬规则）
 *   2. llm-judge: LLM 作为裁判（更灵活）
 *   3. embedding: 语义相似度（基于 embedding 向量）
 *   4. custom: 自定义函数（预留扩展）
 */

import type { Evaluator, EvaluatorConfig, CaseDefinition, CaseRunResult, EvaluationScore } from "../types.js";
import { callLLMText } from "../../core/llm.js";

// ====== Rule-Based Evaluator ======

interface RuleConfig {
  mustInclude?: string[];
  mustNotInclude?: string[];
  expectedTool?: string;
  minScore?: number;
  maxIterations?: number;
  maxDurationMs?: number;
}

export class RuleEvaluator implements Evaluator {
  name = "rule";
  weight: number;
  private config: RuleConfig;

  constructor(weight: number, config: RuleConfig = {}) {
    this.weight = weight;
    this.config = config;
  }

  async evaluate(caseDef: CaseDefinition, result: CaseRunResult): Promise<EvaluationScore> {
    const failures: string[] = [];
    let score = 100;

    const answer = result.answer.toLowerCase();

    // 从 case definition 的 expectedParams 读取规则（优先）
    const params = caseDef.expectedParams || {};
    const mustInclude = (params.mustInclude as string[]) || this.config.mustInclude || [];
    const mustNotInclude = (params.mustNotInclude as string[]) || this.config.mustNotInclude || [];
    const expectedTool = (params.expectedTool as string) || this.config.expectedTool;
    const minScore = (params.minScore as number) || this.config.minScore || 60;

    // 1. 必须包含的关键词
    for (const kw of mustInclude) {
      if (!answer.includes(kw.toLowerCase())) {
        failures.push(`缺少关键词: "${kw}"`);
        score -= 15;
      }
    }

    // 2. 不应包含的关键词
    for (const kw of mustNotInclude) {
      if (answer.includes(kw.toLowerCase())) {
        failures.push(`包含禁用词: "${kw}"`);
        score -= 20;
      }
    }

    // 3. 期望工具
    if (expectedTool) {
      const called = result.toolCalls.map((t) => t.tool);
      if (!called.includes(expectedTool)) {
        failures.push(`未调用工具: ${expectedTool} (实际: ${called.join(", ") || "无"})`);
        score -= 10;
      }
    }

    // 4. 迭代次数检查
    if (this.config.maxIterations && result.iterations > this.config.maxIterations) {
      failures.push(`迭代次数过多: ${result.iterations} > ${this.config.maxIterations}`);
      score -= 10;
    }

    // 5. 耗时检查
    if (this.config.maxDurationMs && result.durationMs > this.config.maxDurationMs) {
      failures.push(`耗时过长: ${result.durationMs}ms > ${this.config.maxDurationMs}ms`);
      score -= 5;
    }

    // 6. 错误检查
    if (result.error) {
      failures.push(`运行错误: ${result.error}`);
      score -= 30;
    }

    const passed = score >= minScore && failures.length === 0 && !result.error;

    return {
      evaluator: this.name,
      score: Math.max(0, score),
      passed,
      failures,
      metadata: {
        keywordsMatched: mustInclude.filter((k) => answer.includes(k.toLowerCase())).length,
        totalKeywords: mustInclude.length,
        toolsCalled: result.toolCalls.map((t) => t.tool),
      },
    };
  }
}

// ====== LLM Judge Evaluator ======

interface LLMJudgeConfig {
  criteria: string;
  minScore?: number;
}

export class LLMJudgeEvaluator implements Evaluator {
  name = "llm-judge";
  weight: number;
  private config: LLMJudgeConfig;

  constructor(weight: number, config: LLMJudgeConfig) {
    this.weight = weight;
    this.config = config;
  }

  async evaluate(caseDef: CaseDefinition, result: CaseRunResult): Promise<EvaluationScore> {
    const judgePrompt = `你是一位严格的评测员，评估以下 Agent 回答。

【测试用例】${caseDef.name}
【输入】${caseDef.input}
【评估标准】${this.config.criteria}
【Agent 回答】${result.answer}

请评分 (0-100) 并给出理由。格式：
Score: <数字>
Reason: <理由>`;

    const judgeResponse = await callLLMText(judgePrompt);

    // 解析评分
    const scoreMatch = judgeResponse.match(/Score:\s*(\d+)/i);
    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 70;
    const clampedScore = Math.min(100, Math.max(0, score));

    return {
      evaluator: this.name,
      score: clampedScore,
      passed: clampedScore >= (this.config.minScore || 60),
      failures: clampedScore < (this.config.minScore || 60) ? [`LLM Judge 评分过低: ${clampedScore}`] : [],
      metadata: { judgeResponse: judgeResponse.slice(0, 300) },
    };
  }
}

// ====== Embedding Similarity Evaluator ======

interface EmbeddingConfig {
  referenceAnswer?: string;
  threshold?: number;
}

export class EmbeddingEvaluator implements Evaluator {
  name = "embedding";
  weight: number;
  private config: EmbeddingConfig;

  constructor(weight: number, config: EmbeddingConfig) {
    this.weight = weight;
    this.config = config;
  }

  async evaluate(caseDef: CaseDefinition, result: CaseRunResult): Promise<EvaluationScore> {
    // 使用 TF-IDF 做简单的语义相似度（复用已有 RAG 能力）
    const ref = this.config.referenceAnswer || "";
    const ans = result.answer;

    const similarity = this.computeTFIDFSimilarity(ref, ans);
    const threshold = this.config.threshold || 0.3;

    return {
      evaluator: this.name,
      score: Math.round(similarity * 100),
      passed: similarity >= threshold,
      failures: similarity < threshold ? [`语义相似度 ${similarity.toFixed(2)} < ${threshold}`] : [],
      metadata: { similarity },
    };
  }

  private computeTFIDFSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    const tokensA = this.tokenize(a);
    const tokensB = this.tokenize(b);
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    return intersection.size / Math.max(setA.size, setB.size);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-z0-9]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1);
  }
}

// ====== Evaluator 工厂 ======

export function createEvaluator(config: EvaluatorConfig): Evaluator {
  switch (config.type) {
    case "rule":
      return new RuleEvaluator(config.weight, (config.config || {}) as unknown as RuleConfig);
    case "llm-judge":
      return new LLMJudgeEvaluator(config.weight, (config.config || { criteria: "回答质量" }) as unknown as LLMJudgeConfig);
    case "embedding":
      return new EmbeddingEvaluator(config.weight, (config.config || {}) as unknown as EmbeddingConfig);
    case "custom":
      // 预留：通过注册表扩展
      throw new Error("Custom evaluator 需要通过注册表注册");
    default:
      throw new Error(`未知的 evaluator 类型: ${config.type}`);
  }
}
