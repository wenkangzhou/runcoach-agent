/**
 * 内存向量数据库封装（本地轻量 Embedding）
 * 向量检索替换关键词检索
 *
 * 流程:
 * 1. 加载 docs/ 下所有 markdown
 * 2. 按二级标题分块
 * 3. 本地 TF-IDF 向量化（中文 2-gram + 英文单词）
 * 4. 存入内存数组
 * 5. 查询时: query → 向量化 → 余弦相似度检索 → 返回 topK
 *
 * 注: 使用纯内存实现，无需外部 API 或 Chroma/Pinecone 服务器。
 *     如需切换到神经网络 embedding，只需替换 getEmbedding 实现。
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { DocumentChunk, RetrievalResult } from "./retriever.js";

const DOCS_DIR = join(process.cwd(), "docs");

/** 内存中的向量存储 */
interface VectorDoc {
  chunk: DocumentChunk;
  embedding: number[];
}

let vectorStore: VectorDoc[] = [];
let isInitialized = false;

// ========== 本地轻量 Embedding ==========

/** 停用词 */
const STOP_WORDS = new Set([
  "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都", "一", "一个", "上", "也", "很", "到", "说", "要", "去", "你", "会", "着", "没有", "看", "好", "自己", "这", "那", "之", "与", "及", "等", "或", "但", "而", "因为", "所以", "如果", "虽然", "the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must", "shall", "can", "need", "to", "of", "in", "for", "on", "with", "at", "by", "from", "as", "into", "through", "during", "before", "after", "above", "below", "between", "under", "and", "but", "or", "yet", "so", "if", "because", "although", "though", "while", "where", "when", "that", "which", "who", "whom", "whose", "what", "this", "these", "those", "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
]);

/** 分词：中文 2-gram + 英文单词 */
function tokenize(text: string): string[] {
  const tokens: string[] = [];

  // 中文 2-gram
  const chineseChars = text.match(/[\u4e00-\u9fa5]+/g) || [];
  for (const chars of chineseChars) {
    for (let i = 0; i < chars.length - 1; i++) {
      tokens.push(chars.slice(i, i + 2));
    }
  }

  // 英文单词（长度 > 2）
  const englishWords = text
    .toLowerCase()
    .match(/[a-z]+/g)
    ?.filter((w) => w.length > 2) || [];
  tokens.push(...englishWords);

  // 数字组合
  const numbers = text.match(/\d+(?:\.\d+)?/g) || [];
  tokens.push(...numbers);

  return tokens.filter((t) => !STOP_WORDS.has(t));
}

/** 全局词表和 IDF */
let vocabulary: string[] = [];
let idfMap: Map<string, number> = new Map();

/** 计算 TF-IDF 向量 */
function computeTfidfVector(text: string, vocab: string[], idf: Map<string, number>): number[] {
  const tokens = tokenize(text);
  const tf: Map<string, number> = new Map();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) || 0) + 1);
  }

  const maxTf = Math.max(...tf.values(), 1);
  const vector = new Array(vocab.length).fill(0);

  for (let i = 0; i < vocab.length; i++) {
    const term = vocab[i];
    const termTf = (tf.get(term) || 0) / maxTf; // 归一化 TF
    const termIdf = idf.get(term) || 0;
    vector[i] = termTf * termIdf;
  }

  return vector;
}

/** 构建全局词表和 IDF */
function buildVocabulary(docs: string[]): { vocab: string[]; idf: Map<string, number> } {
  const docFreq: Map<string, number> = new Map();
  const allTokens: Set<string> = new Set();

  for (const doc of docs) {
    const tokens = new Set(tokenize(doc));
    for (const t of tokens) {
      docFreq.set(t, (docFreq.get(t) || 0) + 1);
      allTokens.add(t);
    }
  }

  const vocab = Array.from(allTokens);
  const idf = new Map<string, number>();

  for (const term of vocab) {
    const df = docFreq.get(term) || 1;
    // IDF = log(N / df) + 1 (平滑)
    idf.set(term, Math.log(docs.length / df) + 1);
  }

  return { vocab, idf };
}

/** 本地轻量 embedding（TF-IDF） */
function getLocalEmbedding(text: string): number[] {
  if (vocabulary.length === 0) {
    throw new Error("词表未构建，请先调用 initVectorStore()");
  }
  return computeTfidfVector(text, vocabulary, idfMap);
}

/** 获取 embedding（优先 API，回退本地 TF-IDF） */
async function getEmbedding(text: string): Promise<number[]> {
  // 尝试 API embedding
  const apiKey = process.env.KIMI_API_KEY || process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const provider = process.env.KIMI_API_KEY ? "kimi" : "openai";
      const baseURL = provider === "kimi"
        ? "https://api.moonshot.cn/v1"
        : (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1");
      const model = provider === "kimi"
        ? "moonshot-v3-embedding"
        : "text-embedding-3-small";

      const { OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey, baseURL });

      const response = await client.embeddings.create({
        model,
        input: text.slice(0, 800),
      });

      return response.data[0].embedding;
    } catch (err) {
      // API 失败时静默回退到本地 embedding
    }
  }

  // 本地 TF-IDF embedding
  return getLocalEmbedding(text);
}

// ========== 文档加载与向量存储 ==========

/** 加载所有文档并分块 */
function loadAndChunkDocuments(): DocumentChunk[] {
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

      chunks.push({
        docId,
        docTitle,
        chunkId: i,
        content: `## ${sectionTitle}\n\n${sectionContent}`,
        keywords: [],
      });
    }
  }

  return chunks;
}

/** 计算余弦相似度 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** 初始化向量库 */
export async function initVectorStore(): Promise<void> {
  if (isInitialized) return;

  console.log("📦 初始化向量库...");

  // 加载文档
  const chunks = loadAndChunkDocuments();
  if (chunks.length === 0) {
    console.log("⚠️ 未找到文档");
    isInitialized = true;
    return;
  }

  // 构建词表（基于所有文档内容）
  const allTexts = chunks.map((c) => c.content.slice(0, 800));
  const { vocab, idf } = buildVocabulary(allTexts);
  vocabulary = vocab;
  idfMap = idf;

  console.log(`📝 加载 ${chunks.length} 个文档片段，词表大小: ${vocab.length}，生成 embedding...`);

  // 生成 TF-IDF 向量
  vectorStore = [];
  for (const chunk of chunks) {
    const embedding = computeTfidfVector(chunk.content.slice(0, 800), vocabulary, idfMap);
    vectorStore.push({ chunk, embedding });
  }

  isInitialized = true;
  console.log(`✅ 向量库就绪: ${vectorStore.length} 个片段 (本地 TF-IDF)`);
}

/** 向量检索 */
export async function queryVectorStore(
  query: string,
  topK: number = 3
): Promise<RetrievalResult[]> {
  if (!isInitialized) {
    await initVectorStore();
  }

  if (vectorStore.length === 0) {
    return [];
  }

  const queryEmbedding = getLocalEmbedding(query);

  // 计算与所有文档的余弦相似度
  const scored = vectorStore.map((doc) => ({
    chunk: doc.chunk,
    score: cosineSimilarity(queryEmbedding, doc.embedding),
  }));

  // 按相似度降序，取 topK
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
