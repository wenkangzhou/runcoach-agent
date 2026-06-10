# 🏃 RunCoach Agent v1.0

《学习 Agent，10 天从入门到精通》完整实战项目。

> **Agent = LLM + 工具 + 状态 + 决策循环 + 约束 + 评估**

## 项目结构

```
runcoach-agent/
├── src/
│   ├── core/                    # Agent 核心
│   │   ├── types.ts             # 核心类型定义
│   │   ├── llm.ts               # LLM 封装 (OpenAI API + 模拟模式)
│   │   └── agent.ts             # Agent Loop 主循环
│   ├── tools/                   # 工具层
│   │   ├── registry.ts          # 工具注册表 (本地 + MCP)
│   │   ├── weather.ts           # 天气工具
│   │   ├── training.ts          # 训练工具 (calculate, parseRunLog)
│   │   ├── coach.ts             # 训练建议工具
│   │   ├── rag.ts               # 知识库检索工具
│   │   └── mcp-tools.ts         # MCP 工具封装
│   ├── memory/                  # 记忆系统
│   │   ├── store.ts             # JSON 存储 (profile + runs)
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
├── docs/                        # 知识库
│   ├── running-zones.md
│   ├── marathon-fueling.md
│   └── injury-prevention.md
├── data/                        # 用户数据
│   ├── profile.json
│   └── recent_runs.json
└── package.json
```

## 快速开始

```bash
cd runcoach-agent
npm install

# 配置真实 LLM (可选，模拟模式也能跑)
cp .env.example .env
# 编辑 .env 填入 OPENAI_API_KEY
```

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

## 技术栈

- **Runtime**: Node.js 20+ + TypeScript (ESM)
- **LLM**: OpenAI API (gpt-4o-mini) / 模拟模式
- **Memory**: 本地 JSON (预留 SQLite/向量库接口)
- **RAG**: 关键词 BM25-like 检索 (预留向量库接口)
- **Workflow**: 自研状态机引擎
- **Multi-Agent**: 轮次调度编排器
- **MCP**: @modelcontextprotocol/sdk
- **Eval**: 关键词 + 工具调用检查

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

1. **接入真实 LLM**: 配置 `OPENAI_API_KEY`，预期评测通过率 80%+
2. **向量数据库**: 替换 RAG 为 Chroma/Pinecone
3. **持久化存储**: 替换 JSON 为 SQLite/PostgreSQL
4. **Web 界面**: Next.js + API 路由
5. **更多 MCP Server**: 连接 Strava、Garmin、Notion
6. **Eval 增强**: 添加语义相似度评分 (embedding-based)

## License

MIT
