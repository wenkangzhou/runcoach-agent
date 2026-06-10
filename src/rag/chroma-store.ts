/**
 * 内存向量数据库封装
 * 向量检索替换关键词检索
 *
 * 流程:
 * 1. 加载 docs/ 下所有 markdown
 * 2. 按二级标题分块
 * 3. 调用 Kimi/OpenAI Embedding API 生成向量
 * 4. 存入内存数组
 * 5. 查询时: query → embedding → 余弦相似度检索 → 返回 topK
 *
 * 注: 使用纯内存实现，无需外部 Chroma/Pinecone 服务器。
 *     如需切换到真实向量数据库，只需替换此文件的实现，保持接口不变。
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

/** 获取 embedding（Kimi / OpenAI 兼容） */
async function getEmbedding(text: string): Promise<number[]> {
  const provider = process.env.KIMI_API_KEY ? "kimi" : "openai";
  const apiKey = process.env.KIMI_API_KEY || process.env.OPENAI_API_KEY;
  const baseURL = provider === "kimi"
    ? "https://api.moonshot.cn/v1"
    : (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1");
  const model = provider === "kimi"
    ? "moonshot-v1-embedding"
    : "text-embedding-3-small";

  if (!apiKey) {
    throw new Error("未配置 KIMI_API_KEY 或 OPENAI_API_KEY，无法生成 embedding");
  }

  const { OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey, baseURL });

  const response = await client.embeddings.create({
    model,
    input: text,
  });

  return response.data[0].embedding;
}

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
        keywords: [], // 向量检索不需要关键词
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

  console.log(`📝 加载 ${chunks.length} 个文档片段，生成 embedding...`);

  // 批量生成 embedding（每批 5 个，避免 API 限流）
  const batchSize = 5;
  vectorStore = [];
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await Promise.all(
      batch.map((c) => getEmbedding(c.content.slice(0, 800)))
    );

    for (let j = 0; j < batch.length; j++) {
      vectorStore.push({
        chunk: batch[j],
        embedding: embeddings[j],
      });
    }

    console.log(`  已索引 ${Math.min(i + batchSize, chunks.length)}/${chunks.length}`);
  }

  isInitialized = true;
  console.log(`✅ 向量库就绪: ${vectorStore.length} 个片段`);
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

  const queryEmbedding = await getEmbedding(query);

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
