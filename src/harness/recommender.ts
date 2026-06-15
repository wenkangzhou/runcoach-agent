/**
 * LLM 测试用例推荐器
 *
 * 分析失败的测试用例，调用 LLM 推荐新的测试用例来覆盖盲区。
 * 输出一个新的 Suite JSON 文件，可直接用于下一轮测试。
 */

import * as fs from "fs";
import * as path from "path";
import { callLLMText } from "../core/llm.js";
import type { HarnessResult, SuiteDefinition, CaseDefinition } from "./types.js";

interface Recommendation {
  id: string;
  name: string;
  category: string;
  input: string;
  tags: string[];
  expectedParams: Record<string, unknown>;
  rationale: string;
}

/**
 * 基于失败用例生成推荐测试用例
 *
 * @param result  Harness 运行结果
 * @param outputPath  输出 JSON 路径（默认为 harness-recommended.json）
 */
export async function recommendCases(
  result: HarnessResult,
  outputPath: string = "./harness-recommended.json"
): Promise<{ recommendations: Recommendation[]; outputPath: string }> {
  const failed = result.evaluated.filter((e) => !e.passed);

  if (failed.length === 0) {
    console.log("\n🎉 所有用例通过！无需推荐新用例。");
    return { recommendations: [], outputPath };
  }

  console.log(`\n🧠 分析 ${failed.length} 个失败用例，请求 LLM 推荐新测试用例...`);

  const prompt = buildRecommendationPrompt(failed, result);
  const response = await callLLMText(prompt);

  let recommendations: Recommendation[] = [];
  try {
    const parsed = JSON.parse(response);
    if (Array.isArray(parsed.recommendations)) {
      recommendations = parsed.recommendations;
    } else if (Array.isArray(parsed)) {
      recommendations = parsed;
    }
  } catch {
    // 如果 LLM 返回的不是 JSON，尝试从 markdown 代码块中提取
    const codeBlock = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeBlock) {
      try {
        const parsed = JSON.parse(codeBlock[1]);
        if (Array.isArray(parsed.recommendations)) {
          recommendations = parsed.recommendations;
        } else if (Array.isArray(parsed)) {
          recommendations = parsed;
        }
      } catch {
        console.warn("⚠️ LLM 返回的 JSON 格式无效，无法解析推荐。");
      }
    }
  }

  if (recommendations.length === 0) {
    console.warn("⚠️ LLM 未返回有效推荐，跳过生成。");
    return { recommendations: [], outputPath };
  }

  // 去重：基于 input 哈希
  const seen = new Set<string>();
  const unique = recommendations.filter((r) => {
    const hash = r.input.trim();
    if (seen.has(hash)) return false;
    seen.add(hash);
    return true;
  });

  // 构建 Suite
  const suite: SuiteDefinition = {
    name: `Recommended Suite (from ${result.runId})`,
    description: `LLM 基于 ${failed.length} 个失败用例自动推荐的测试用例。`,
    version: "1.0.0",
    cases: unique.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      input: r.input,
      tags: r.tags,
      expectedParams: r.expectedParams,
    })) as CaseDefinition[],
  };

  fs.writeFileSync(outputPath, JSON.stringify(suite, null, 2), "utf-8");

  console.log(`\n✅ 推荐 ${unique.length} 个新用例，已保存至 ${outputPath}`);
  for (const r of unique) {
    console.log(`   - [${r.id}] ${r.name} (${r.category})`);
  }

  return { recommendations: unique, outputPath };
}

function buildRecommendationPrompt(
  failed: HarnessResult["evaluated"],
  result: HarnessResult
): string {
  const failures = failed.map((f) => ({
    id: f.run.caseId,
    name: f.run.caseName,
    category: f.run.category,
    input: f.run.input,
    answer: f.run.answer,
    failures: f.scores
      .filter((s) => !s.passed)
      .flatMap((s) => s.failures),
  }));

  return `你是一位资深的 AI 测试工程师，擅长为对话型 Agent 设计边界测试用例。

当前 Agent 是 "RunCoach"，一个跑步训练助手。以下测试用例在最近一次 Harness 测试中失败：

${JSON.stringify(failures, null, 2)}

请分析这些失败的原因，并推荐 3-5 个新的测试用例来覆盖这些盲区。

要求：
1. 每个用例必须包含 id, name, category, input, tags, expectedParams
2. expectedParams 中必须包含 mustInclude（必须包含的关键词数组）和 minScore（最低分数，0-100）
3. 用例要精准击中失败暴露的弱点，而非泛泛而谈
4. 尽量覆盖不同场景（疲劳恢复、伤病风险、目标匹配、时间限制、工具调用等）
5. 返回严格的 JSON 格式，不要包含 markdown 标记或其他说明文字

格式示例：
{
  "recommendations": [
    {
      "id": "R001",
      "name": "伤病后恢复训练",
      "category": "伤病风险",
      "input": "上周脚踝扭伤，这周已经好得差不多了，可以开始慢跑了吗？",
      "tags": ["injury", "recovery", "edge-case"],
      "expectedParams": {
        "mustInclude": ["建议", "恢复", "慢跑"],
        "mustNotInclude": ["高强度", "间歇", "比赛"],
        "expectedTool": "suggestNextWorkout",
        "minScore": 80
      },
      "rationale": "测试 Agent 在伤病恢复期的边界判断"
    }
  ]
}`;
}
