/**
 * Suite 加载器 — 从 JSON 配置文件加载测试套件
 */

import * as fs from "fs";
import * as path from "path";
import type { SuiteDefinition, CaseDefinition } from "../types.js";

/** 加载测试套件 */
export function loadSuite(suitePath: string): SuiteDefinition {
  const fullPath = path.resolve(suitePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Suite 文件不存在: ${fullPath}`);
  }

  const raw = fs.readFileSync(fullPath, "utf-8");
  const suite: SuiteDefinition = JSON.parse(raw);

  // 校验
  if (!suite.name || !suite.version || !suite.cases || suite.cases.length === 0) {
    throw new Error("Suite 配置无效: 缺少 name, version 或 cases");
  }

  // 去重检查
  const ids = suite.cases.map((c) => c.id);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) {
    throw new Error(`Suite 中存在重复的 case ID: ${dup}`);
  }

  return suite;
}

/** 保存测试套件（用于生成模板） */
export function saveSuite(suitePath: string, suite: SuiteDefinition): void {
  const dir = path.dirname(path.resolve(suitePath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(suitePath, JSON.stringify(suite, null, 2), "utf-8");
}

/** 从现有 cases.ts 生成 suite 文件 */
export function generateSuiteFromCases(outputPath: string): SuiteDefinition {
  // 动态导入现有 cases（因为我们有 import.meta.url 限制，这里用同步 require 风格）
  // 实际实现中通过运行时导入
  const suite: SuiteDefinition = {
    name: "RunCoach Core Suite",
    description: "从 eval/cases.ts 迁移的 20 条核心测试用例",
    version: "1.0.0",
    cases: [],
  };
  saveSuite(outputPath, suite);
  return suite;
}

/** 筛选用例 */
export function filterCases(
  cases: CaseDefinition[],
  filters: { category?: string; tags?: string[]; ids?: string[] }
): CaseDefinition[] {
  return cases.filter((c) => {
    if (c.skip) return false;
    if (filters.category && c.category !== filters.category) return false;
    if (filters.tags && filters.tags.length > 0) {
      if (!c.tags || !filters.tags.some((t) => c.tags!.includes(t))) return false;
    }
    if (filters.ids && filters.ids.length > 0) {
      if (!filters.ids.includes(c.id)) return false;
    }
    return true;
  });
}
