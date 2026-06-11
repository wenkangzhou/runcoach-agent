# 🏃 RunCoach Agent v1.0

《学习 Agent，10 天从入门到精通》完整实战项目。

> **Agent = LLM + 工具 + 状态 + 决策循环 + 约束 + 评估**

## 在线体验

**🌐 生产环境**: https://runcoach-agent-tau.vercel.app/

像素风 Web 界面，支持实时对话、训练记录持久化、AI 训练建议。

## 项目结构

```
runcoach-agent/
├── src/                         # CLI 核心（本地开发）
│   ├── core/                    # Agent 核心
│   │   ├── types.ts             # 核心类型定义
│   │   ├── llm.ts               # LLM 封装 (Kimi / OpenAI / 模拟)
│   │   └── agent.ts             # Agent Loop 主循环
│   ├── tools/                   # 工具层
│   │   ├── registry.ts          # 工具注册表 (本地 + MCP)
│   │   ├── weather.ts           # 天气工具
│   │   ├── training.ts          # 训练工具 (calculate, parseRunLog)
│   │   ├── coach.ts             # 训练建议工具
│   │   ├── rag.ts               # 知识库检索工具
│   │   └── mcp-tools.ts         # MCP 工具封装
│   ├── memory/                  # 记忆系统
│   │   ├── store.ts             # 存储抽象 (JSON / Redis)
│   │   ├── summary.ts           # 周/月训练摘要
│   │   ├── retrieval.ts         # 按需检索
│   │   └── update.ts            # 自动更新 profile
│   ├── rag/                     # RAG 知识库
│   │   └── retriever.ts         # 关键词检索引擎
│   ├── workflow/                # Workflow 编排
│   │   ├── types.ts             # WorkflowState
│   │   ├── engine.ts            # 状态机引擎
│   │   └── nodes.ts             # 7 个节点实现
│   ├── multi-agent/             # Multi-Agent 协作
│   │   ├── types.ts             # AgentMessage
│   │   ├── agents.ts            # 4 个角色实现
│   │   └── orchestrator.ts      # 编排器 + 轮次调度
│   ├── mcp/                     # MCP 协议
│   │   ├── server.ts            # MCP Server (5 个工具)
│   │   └── client.ts            # MCP Client (stdio/direct)
│   ├── eval/                    # 评测系统
│   │   ├── cases.ts             # 20 条测试用例
│   │   └── runner.ts            # 评测运行器
│   ├── index.ts                 # 主 CLI (三模式)
│   ├── workflow-agent.ts        # Workflow 入口
│   ├── mcp-demo.ts              # MCP 演示
│   └── eval-cli.ts              # 评测 CLI
│
├── web/                         # Next.js Web 应用
│   ├── app/                     # App Router
│   │   ├── page.tsx             # 主界面 (像素风聊天)
│   │   ├── layout.tsx           # 根布局
│   │   └── api/                 # API 路由
│   │       ├── chat/route.ts    # Agent 对话接口
│   │       ├── runs/route.ts    # 跑步记录 CRUD
│   │       └── profile/route.ts # 用户资料接口
│   ├── components/              # React 组件
│   │   ├── Chat.tsx             # 聊天界面
│   │   ├── Message.tsx          # 消息气泡
│   │   ├── ToolCall.tsx         # 工具调用展示
│   │   └── CRTOverlay.tsx       # CRT 扫描线效果
│   ├── lib/                     # 服务端逻辑
│   │   ├── core/agent.ts        # Web 版 Agent 入口
│   │   ├── memory/store.ts      # Async 存储层
│   │   ├── storage/upstash.ts   # Upstash Redis 封装
│   │   └── ...                  # 其他模块 (与 src/ 共享)
│   ├── public/                  # 静态资源
│   ├── docs/                    # 知识库 (同 src/docs/)
│   ├── data/                    # 本地开发数据
│   └── package.json
│
├── docs/                        # 知识库
│   ├── running-zones.md
│   ├── marathon-fueling.md
│   └── injury-prevention.md
├── data/                        # CLI 本地数据
└── package.json
```

## 快速开始

### CLI 模式（本地开发）

```bash
cd runcoach-agent
npm install

# 配置 LLM
cp .env.example .env
# 编辑 .env，填入 KIMI_API_KEY=sk-your-key

# 运行 Agent Loop
npm run dev -- "今天跑了 8km，明天怎么跑？"

# Workflow 模式
MODE=workflow npm run dev -- "今天跑了 8km，明天怎么跑？"

# Multi-Agent 模式
MODE=multi npm run dev -- "今天跑了 8km，明天怎么跑？"

# MCP 演示
npm run mcp

# 评测
npm run eval
```

### Web 模式（本地开发）

```bash
cd runcoach-agent/web
npm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local:
#   KIMI_API_KEY=sk-your-key
#   UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
#   UPSTASH_REDIS_REST_TOKEN=your-token

# 启动开发服务器
npm run dev
# 打开 http://localhost:3675
```

## 环境变量

### CLI 环境

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `LLM_PROVIDER` | 选择 provider: `kimi` / `openai` | 自动检测 |
| `KIMI_API_KEY` | Kimi API Key | - |
| `KIMI_MODEL` | Kimi 模型 | `moonshot-v1-8k` |
| `OPENAI_API_KEY` | OpenAI API Key | - |
| `OPENAI_MODEL` | OpenAI 模型 | `gpt-4o-mini` |

### Web 环境

| 变量 | 说明 | 必填 |
|------|------|------|
| `KIMI_API_KEY` | Kimi API Key | ✅ |
| `KIMI_MODEL` | Kimi 模型 | 否 (默认 `moonshot-v1-8k`) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL | ✅ 生产环境 |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST Token | ✅ 生产环境 |

**优先级**: 配置了 `KIMI_API_KEY` 自动用 Kimi；配置了 `OPENAI_API_KEY` 自动用 OpenAI；都没有则回退模拟模式。

## 四种运行模式

### 1. Agent Loop 模式 (v0.1)

```bash
npm run dev -- "今天跑了 8km，配速 5:40，心率 145，感觉有点累，明天该怎么跑？"
```

### 2. Workflow 编排模式 (v0.2)

```bash
MODE=workflow npm run dev -- "今天跑了 8km，明天怎么跑？"
```

节点路径：`InputNode → ParseRunNode → RiskCheckNode → PlanNode → ReviewNode → OutputNode`

### 3. Multi-Agent 协作模式 (v0.3)

```bash
MODE=multi npm run dev -- "今天跑了 8km，明天怎么跑？"
```

协作链：`ProductAgent → TrainingAgent → RiskAgent → ExpressionAgent`

### 4. MCP 演示

```bash
npm run mcp
```

## 评测

```bash
# 评测 Agent Loop 模式
npm run eval

# 评测 Workflow 模式
MODE=workflow npm run eval

# 评测 Multi-Agent 模式
MODE=multi npm run eval
```

## 10 天完整路线图

| 天数 | 主题 | 核心产出 | 文件 |
|------|------|---------|------|
| Day 1 | Agent 基本概念 | 心智模型 + 伪代码 | `src/core/types.ts` |
| Day 2 | Tool Calling | 3 个基础工具 | `src/tools/*.ts` |
| Day 3 | 单 Agent 实战 | suggestNextWorkout | `src/tools/coach.ts` |
| Day 4 | Memory | 自动更新 + 摘要 + 检索 | `src/memory/*.ts` |
| Day 5 | RAG | 知识库 + 关键词检索 | `src/rag/`, `docs/` |
| Day 6 | Workflow | 7 节点状态机 | `src/workflow/*.ts` |
| Day 7 | Multi-Agent | 4 角色协作 | `src/multi-agent/*.ts` |
| Day 8 | MCP | Server/Client + 5 工具 | `src/mcp/*.ts` |
| Day 9 | Eval | 20 条测试用例 | `src/eval/*.ts` |
| Day 10 | 项目整合 | 完整闭环 v1.0 | 全部 |
| **+** | **Web 界面** | **Next.js + 像素风 UI** | `web/` |
| **+** | **Vercel 部署** | **Serverless 生产环境** | `vercel.json` |
| **+** | **持久化存储** | **Upstash Redis** | `web/lib/storage/upstash.ts` |

## 核心架构

### Agent Loop

```
用户输入
  ↓
创建上下文 (Memory + RAG)
  ↓
LLM 判断意图 → 选择工具
  ↓
调用工具 → 观察结果 → 继续推理
  ↓
返回最终回答 + 保存记录
```

### Workflow 编排

```
InputNode → ParseRunNode → RiskCheckNode
                              ↓
                    高风险 → OutputNode (警告)
                    中/低 → PlanNode → ReviewNode
                                      ↓
                                不通过 → 回退修正
                                通过 → OutputNode
```

### Multi-Agent 协作

```
ProductAgent (提取诉求)
  ↓
TrainingAgent (生成方案)
  ↓
RiskAgent (审查风险)
  ↓
  ├─ 通过 → ExpressionAgent (输出)
  └─ 反对 → TrainingAgent (修正) → RiskAgent (再审)
```

### MCP 连接

```
Agent → MCP Client → MCP Server → 本地跑步数据
       (stdio/direct)   (JSON-RPC)    (JSON 文件)
```

### Web 架构

```
用户浏览器 ←→ Next.js App Router
                ├── /api/chat → Agent Loop (Kimi LLM)
                ├── /api/runs → Redis 持久化
                └── /api/profile → Redis 持久化
```

## 技术栈

| 层级 | 技术 |
|------|------|
| **Runtime** | Node.js 20+ + TypeScript (ESM) |
| **Web** | Next.js 14 (App Router) + React + Tailwind CSS |
| **LLM** | Kimi (Moonshot AI) / OpenAI API / 模拟模式 |
| **Memory** | Upstash Redis (生产) / JSON 文件 (本地) |
| **RAG** | 关键词 BM25-like 检索 (预留向量库接口) |
| **Workflow** | 自研状态机引擎 |
| **Multi-Agent** | 轮次调度编排器 |
| **MCP** | @modelcontextprotocol/sdk |
| **Eval** | 关键词 + 工具调用检查 |
| **部署** | Vercel (Serverless) |

## 部署指南

### Vercel 部署

1. 在 [Vercel Dashboard](https://vercel.com) 导入 GitHub 仓库
2. **Root Directory** 设置为 `web/`
3. 添加环境变量：
   - `KIMI_API_KEY`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. 自动部署完成

### Upstash Redis 配置

1. 在 [Upstash Console](https://console.upstash.com) 创建 Redis 数据库
2. 复制 **REST URL** 和 **REST TOKEN**
3. 填入 Vercel Environment Variables
4. 数据自动持久化，跨会话保留

## 验收标准

问 Agent：

```
我昨天跑了 12km，今天小腿有点紧，但我这周只跑了 20km，
明天想跑快一点，可以吗？
```

它应该能回答：

```
不建议直接跑快。
原因是你已经出现小腿紧，虽然周跑量不高，但局部疲劳优先级更高。
建议明天 30-40 分钟轻松跑，心率控制在 Z1-Z2。
如果跑 10 分钟后小腿仍紧，改为快走或休息。
后天如果恢复，再安排 20 分钟节奏跑。
```

## 后续扩展方向

1. **Strava 数据同步** — 接入真实跑步数据源
2. **训练计划生成** — 基于历史数据输出周期化课表
3. **数据可视化** — 跑量/配速趋势图表 (Recharts/D3)
4. **向量数据库** — 替换 RAG 为 Pinecone/Chroma
5. **更多 MCP Server** — 连接 Garmin、Notion、Apple Health
6. **Eval 增强** — 添加语义相似度评分 (embedding-based)
7. **用户认证** — NextAuth + 多用户隔离

## License

MIT
