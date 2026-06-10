/**
 * RAG 检索工具
 * Day 5: 让 Agent 能查询知识库
 */

import type { RegisteredTool } from "../core/types.js";
import { retrieveDocuments, formatRetrievalContext } from "../rag/retriever.js";

export const retrieveKnowledgeTool: RegisteredTool = {
  description: {
    name: "retrieveKnowledge",
    description:
      "从跑步知识库中检索相关文档片段。适用于回答关于训练理论、补给策略、伤病预防等需要专业知识的问题。",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "检索查询，例如: '马拉松补给策略'、'心率区间怎么划分'、'膝盖痛怎么办'",
        required: true,
      },
      {
        name: "topK",
        type: "number",
        description: "返回最相关的片段数量，默认 3",
        required: false,
      },
    ],
  },
  execute: (args) => {
    const query = String(args.query || "");
    const topK = Number(args.topK || 3);

    if (!query) {
      throw new Error("查询内容不能为空");
    }

    const results = retrieveDocuments(query, topK);
    const context = formatRetrievalContext(results);

    return {
      query,
      topK,
      resultCount: results.length,
      context,
      sources: results.map((r) => ({
        doc: r.chunk.docTitle,
        section: r.chunk.content.split("\n")[0].replace("## ", ""),
        score: Math.round(r.score * 100) / 100,
      })),
    };
  },
};
