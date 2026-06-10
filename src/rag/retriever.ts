/**
 * RAG 检索（向量检索 + 关键词回退）
 * Day 5: 让 Agent 能读知识库
 * 向量检索: Chroma + Kimi/OpenAI Embedding
 * 回退: 关键词 BM25-like 检索
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { queryVectorStore, initVectorStore } from "./chroma-store.js";

const DOCS_DIR = join(process.cwd(), "docs");

/** 文档片段 */
export interface DocumentChunk {
  docId: string;
  docTitle: string;
  chunkId: number;
  content: string;
  keywords: string[];
}

/** 检索结果 */
export interface RetrievalResult {
  chunk: DocumentChunk;
  score: number;
}

/** 加载所有文档并分块 */
function loadDocuments(): DocumentChunk[] {
  const files = readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"));
  const chunks: DocumentChunk[] = [];

  for (const file of files) {
    const content = readFileSync(join(DOCS_DIR, file), "utf-8");
    const docId = file.replace(".md", "");
    const docTitle = content.match(/^#\s+(.+)/)?.[1] || docId;

    // 按二级标题分块
    const sections = content.split(/^##\s+/m).filter(Boolean);
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const sectionTitle = section.match(/^(.+)/)?.[1] || "";
      const sectionContent = section.replace(/^(.+)\n+/, "").trim();

      // 提取关键词（简单分词 + 去停用词）
      const keywords = extractKeywords(sectionContent + " " + sectionTitle);

      chunks.push({
        docId,
        docTitle,
        chunkId: i,
        content: `## ${sectionTitle}\n\n${sectionContent}`,
        keywords,
      });
    }
  }

  return chunks;
}

/** 中文/英文分词 + 停用词过滤 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都", "一", "一个", "上", "也", "很", "到", "说", "要", "去", "你", "会", "着", "没有", "看", "好", "自己", "这", "那", "之", "与", "及", "等", "或", "但", "而", "因为", "所以", "如果", "虽然", "the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must", "shall", "can", "need", "dare", "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by", "from", "as", "into", "through", "during", "before", "after", "above", "below", "between", "under", "and", "but", "or", "yet", "so", "if", "because", "although", "though", "while", "where", "when", "that", "which", "who", "whom", "whose", "what", "this", "these", "those", "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
  ]);

  // 中文：按字/词提取（简单按 2-4 字滑动窗口）
  const chineseWords: string[] = [];
  const chineseChars = text.match(/[\u4e00-\u9fa5]+/g) || [];
  for (const chars of chineseChars) {
    for (let i = 0; i < chars.length - 1; i++) {
      chineseWords.push(chars.slice(i, i + 2));
      if (i < chars.length - 2) chineseWords.push(chars.slice(i, i + 3));
    }
  }

  // 英文：按单词提取
  const englishWords = text
    .toLowerCase()
    .match(/[a-z]+/g)
    ?.filter((w) => w.length > 2) || [];

  const allWords = [...chineseWords, ...englishWords];
  return [...new Set(allWords.filter((w) => !stopWords.has(w)))];
}

/** 计算查询与文档的相关性分数 */
function scoreQuery(query: string, chunk: DocumentChunk): number {
  const queryKeywords = extractKeywords(query);
  if (queryKeywords.length === 0) return 0;

  let score = 0;
  for (const qk of queryKeywords) {
    // 精确匹配
    if (chunk.keywords.includes(qk)) {
      score += 3;
    }
    // 部分匹配
    for (const ck of chunk.keywords) {
      if (ck.includes(qk) || qk.includes(ck)) {
        score += 1;
      }
    }
    // 内容中出现
    if (chunk.content.toLowerCase().includes(qk.toLowerCase())) {
      score += 0.5;
    }
  }

  // 归一化
  return score / queryKeywords.length;
}

/** 关键词检索（回退方案） */
function keywordRetrieve(query: string, topK: number = 3): RetrievalResult[] {
  const allChunks = loadDocuments();
  const scored = allChunks.map((chunk) => ({
    chunk,
    score: scoreQuery(query, chunk),
  }));

  // 按分数降序，过滤低分
  return scored
    .filter((r) => r.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/** 检索相关文档（优先向量检索，失败回退关键词） */
export async function retrieveDocuments(query: string, topK: number = 3): Promise<RetrievalResult[]> {
  // 尝试向量检索
  try {
    const vectorResults = await queryVectorStore(query, topK);
    if (vectorResults.length > 0) {
      return vectorResults;
    }
  } catch (err) {
    console.warn("⚠️ 向量检索失败，回退到关键词检索:", err instanceof Error ? err.message : String(err));
  }

  // 回退到关键词检索
  return keywordRetrieve(query, topK);
}

/** 格式化检索结果为上下文文本 */
export function formatRetrievalContext(results: RetrievalResult[]): string {
  if (results.length === 0) {
    return "【知识库】\n未找到相关文档。";
  }

  const parts = results.map((r, i) => {
    const source = `${r.chunk.docTitle} > ${r.chunk.content.split("\n")[0].replace("## ", "")}`;
    return `[${i + 1}] ${source}\n${r.chunk.content.slice(0, 800)}${r.chunk.content.length > 800 ? "..." : ""}`;
  });

  return `【知识库检索结果】\n\n${parts.join("\n\n---\n\n")}`;
}

/** 判断是否需要检索知识库 */
export function shouldRetrieve(query: string): boolean {
  const knowledgeKeywords = [
    "补给", "胶", "水", "吃", "喝", "早餐",
    "心率", "区间", "zone", "强度", "有氧", "无氧", "阈值",
    "伤病", "痛", "伤", "恢复", "拉伸", "膝盖", "小腿", "足底", "跟腱",
    "预防", "治疗", "医生", "休息",
    "怎么", "如何", "什么", "为什么", "建议",
  ];
  return knowledgeKeywords.some((k) => query.toLowerCase().includes(k));
}
