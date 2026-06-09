# 🏃 RunCoach Agent v0.1

《学习 Agent，10 天从入门到精通》的实战项目骨架。

> **Agent = LLM + 工具 + 状态 + 决策循环 + 约束 + 评估**

## 项目结构

```
runcoach-agent/
├── src/
│   ├── core/
│   │   ├── types.ts         # 核心类型定义 (Agent/Tool/Memory)
│   │   ├── llm.ts           # LLM 调用封装 (真实 API + 模拟模式)
│   │   └── agent.ts         # ⭐ Agent 核心循环
│   ├── tools/
│   │   ├── registry.ts      # 工具注册表
│   │   ├── weather.ts       # 天气工具 (getWeather)
│   │   └── training.ts      # 训练工具 (calculate, parseRunLog)
│   ├── memory/
│   │   └── store.ts         # 本地 JSON 记忆存储
│   └── index.ts             # CLI 入口
├── data/
│   ├── profile.json         # 用户画像
│   └── recent_runs.json     # 最近训练记录
├── package.json
└── tsconfig.json
```

## 快速开始

```bash
cd runcoach-agent
npm install

# 方式 1: 使用模拟 LLM (无需 API Key，测试结构)
npm run dev

# 方式 2: 配置真实 API
# cp .env.example .env
# 编辑 .env 填入 OPENAI_API_KEY
# npm run dev

# 方式 3: 直接提问
npm run dev -- "上海明天适合跑步吗？"
npm run dev -- "帮我计算 5:40 配速跑 10km 需要多少分钟"
```

## 10 天路线图与当前进度

| 天数 | 主题 | 状态 | 文件 |
|------|------|------|------|
| Day 1 | Agent 基本概念 + 最小 Loop | ✅ | `src/core/agent.ts` |
| Day 2 | Tool Calling | ✅ | `src/tools/*.ts` |
| Day 3 | 单 Agent 实战 (跑步助手) | 🔄 | 基于现有结构扩展 |
| Day 4 | Memory | ✅ 基础版 | `src/memory/store.ts` |
| Day 5 | RAG | ⏳ | 待添加 `src/rag/` |
| Day 6 | Workflow | ⏳ | 待添加节点编排 |
| Day 7 | Multi-Agent | ⏳ | 待拆分角色 |
| Day 8 | MCP | ⏳ | 待接入 MCP Server |
| Day 9 | Eval | ⏳ | 待添加测试用例 |
| Day 10 | 项目整合 | ⏳ | v0.1 完整版 |

## Agent Loop 流程图

```
用户输入
  ↓
创建上下文 (加载 Memory)
  ↓
LLM 判断意图 (decideNextAction)
  ↓
是否需要工具？
  ├─ 是 → 调用工具 → 观察结果 → 继续推理
  └─ 否 → 直接回答 / 澄清问题
  ↓
返回最终回答
```

## 核心代码片段

**Agent 循环** (`src/core/agent.ts`):

```typescript
while (context.iteration < context.maxIterations) {
  const action = await decideNextAction(context.messages, tools);
  
  if (action.type === "tool") {
    const result = await executeTool(action.toolCall.tool, action.toolCall.args);
    context.messages.push({ role: "tool", content: JSON.stringify(result) });
  } else if (action.type === "answer") {
    return action.content;
  }
}
```

## 技术栈

- **Runtime**: Node.js + TypeScript (ESM)
- **LLM**: OpenAI API (gpt-4o-mini) / 模拟模式
- **Memory**: 本地 JSON (后续可换 SQLite/向量库)
- **工具**: 自研 Tool Registry (后续可接 MCP)

## 下一步

1. **接入真实 LLM**: 配置 `OPENAI_API_KEY` 测试真实工具选择能力
2. **扩展工具**: 添加 `suggestNextWorkout`、`checkInjuryRisk` 等训练专用工具
3. **Day 3 目标**: 让 Agent 能根据用户输入的跑步数据，给出真正的训练建议
