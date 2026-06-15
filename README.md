# 🏃 跑蓝 RunCoach Agent

> **像展示作品一样展示你的跑步生涯**

基于 Strava 数据同步的 AI 跑步分析 Web 应用，集成 AI 训练解读、周期化课表、路线聚类与数据可视化。

像素风 UI · CRT 扫描线 · 橙色数据强调 · 复古终端美学

---

## 🌐 在线体验

**生产环境**: https://runcoach-agent-tau.vercel.app/

![像素风界面](web/public/icon-512.png)

---

## ✨ 功能特性

### 已上线

| 模块 | 功能 | 状态 |
|------|------|------|
| **Strava 同步** | OAuth 授权 + 活动拉取 + 数据清洗 | ✅ |
| **AI 对话** | Kimi k2.5 实时训练建议 | ✅ |
| **训练计划** | 周期化课表（基础→建设→巅峰→taper） | ✅ |
| **数据可视化** | 像素风仪表盘（趋势图/配速区间/统计卡片） | ✅ |
| **AI 训练分析** | 活动结构解析 + 训练类型分类 + 质量评分 1-10 | ✅ |
| **路线地图** | Leaflet 聚类地图 + 热力效果 | ✅ |
| **训练提醒** | Vercel Cron 每日 7 点提醒 | ✅ |
| **移动端** | 响应式布局 + PWA 基础 | ✅ |
| **持久化** | Upstash Redis 跨会话存储 | ✅ |

### 像素风设计

- `font-pixel` 像素字体
- CRT 扫描线叠加
- 故障文字动画
- zinc monochrome 基底 + orange 数据强调色

---

## 🚀 快速开始

### 环境变量

复制 `.env.local.example` 为 `.env.local`：

```bash
cd web
cp .env.local.example .env.local
```

填入以下变量：

| 变量 | 说明 | 必填 |
|------|------|------|
| `KIMI_API_KEY` | Kimi API Key | ✅ |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL | ✅ 生产 |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST Token | ✅ 生产 |
| `STRAVA_CLIENT_ID` | Strava OAuth Client ID | ✅ Strava 同步 |
| `STRAVA_CLIENT_SECRET` | Strava OAuth Client Secret | ✅ Strava 同步 |
| `NEXT_PUBLIC_STRAVA_CLIENT_ID` | Strava Client ID（前端用） | ✅ Strava 同步 |

### 本地开发

```bash
cd web
npm install
npm run dev -p 3675
# 打开 http://localhost:3675
```

### CLI 模式（Agent 核心调试）

```bash
cd runcoach-agent
npm install
npm run dev          # 运行一次 Agent 对话
npm run eval         # 快速评测（20条用例，默认模式）
npm run harness      # 完整回归测试（Harness v2）
npm run dashboard    # 启动本地 Dashboard（端口 7365）
```

### Vercel 部署

1. 在 [Vercel Dashboard](https://vercel.com) 导入 GitHub 仓库
2. **Root Directory** 设置为 `web/`
3. 添加上述环境变量
4. 自动部署完成

---

## 📁 项目结构

```
runcoach-agent/
├── web/                         # Next.js 14 App Router
│   ├── app/                     # 页面路由
│   │   ├── page.tsx             # 主界面（像素风聊天 + 仪表盘）
│   │   ├── layout.tsx           # 根布局（PWA + Leaflet）
│   │   └── api/                 # API 路由
│   │       ├── chat/route.ts    # Agent 对话（Kimi LLM）
│   │       ├── runs/route.ts    # 跑步记录 CRUD
│   │       ├── profile/route.ts # 用户资料
│   │       ├── strava/route.ts  # Strava OAuth + 同步
│   │       ├── plan/route.ts    # 训练计划生成
│   │       ├── analysis/route.ts# AI 训练分析
│   │       ├── routes/cluster/  # 路线聚类
│   │       ├── reminder/route.ts# 今日训练提醒
│   │       └── cron/training-reminder/  # Vercel Cron
│   ├── components/              # React 组件
│   │   ├── Chat.tsx             # 聊天界面
│   │   ├── Dashboard.tsx        # 数据仪表盘
│   │   ├── RouteMap.tsx         # 路线聚类地图
│   │   ├── TrainingPlan.tsx     # 训练计划展示
│   │   ├── CRTOverlay.tsx       # CRT 扫描线效果
│   │   └── ...
│   ├── lib/                     # 服务端逻辑
│   │   ├── core/                # Agent 核心
│   │   │   ├── agent.ts         # Web 版 Agent Loop
│   │   │   └── llm.ts           # Kimi LLM 封装（稳定性重试）
│   │   ├── storage/upstash.ts   # Upstash Redis 封装
│   │   ├── strava/              # Strava 同步
│   │   ├── training/            # 训练计划引擎
│   │   ├── analysis/            # AI 训练分析
│   │   │   ├── structure.ts     # 配速突变点检测
│   │   │   └── classify.ts      # 动态 E/M/T/I/R 区间
│   │   ├── map/                 # 路线聚类
│   │   └── ...
│   ├── public/                  # 静态资源
│   │   ├── icon-192.png         # PWA Icon
│   │   ├── icon-512.png
│   │   ├── apple-touch-icon.png
│   │   └── manifest.json        # PWA Manifest
│   └── package.json
│
├── src/                         # CLI 核心（本地开发）
│   ├── core/                    # Agent Loop + LLM
│   ├── tools/                   # 工具层
│   ├── memory/                  # 记忆系统
│   ├── rag/                     # RAG 知识库
│   ├── workflow/                # Workflow 编排
│   ├── multi-agent/             # Multi-Agent 协作
│   ├── mcp/                     # MCP 协议
│   ├── eval/                    # 评测系统（20 条用例）
│   └── harness/                 # Harness 回归测试系统
│       ├── config/              # 测试套件配置（JSON）
│       ├── evaluator/           # 可插拔评估器（rule / LLM judge / embedding）
│       ├── runner/              # 环境隔离执行器 + 多轮对话 Runner
│       ├── baseline/            # 基线管理（golden 回答）
│       ├── reporter/            # 报告生成（JSON / Markdown / HTML / 部署）
│       ├── db/                  # 历史数据库（JSON append-only）
│       └── recommender.ts       # LLM 自动用例推荐
│
├── docs/                        # 知识库
└── README.md
```

---

## 🧠 核心架构

### Agent Loop

```
用户输入
  ↓
创建上下文 (Memory + RAG + Strava 数据)
  ↓
LLM 判断意图 → 选择工具
  ↓
调用工具 → 观察结果 → 继续推理
  ↓
返回最终回答 + 保存记录
```

### AI 训练分析引擎

```
Strava Splits
  ↓
配速突变点检测（1.5σ 阈值）
  ↓
结构划分：warmup / main / cooldown
  ↓
动态配速区间（最近 10 次百分位）
  ↓
训练类型分类：E/M/T/I/R
  ↓
质量评分 1-10 + AI 训练解读
```

### 路线聚类

```
Strava Polyline
  ↓
解码起点/终点
  ↓
Haversine 距离 < 500m
  ↓
聚类命名：路线 A、路线 B...
  ↓
Leaflet 热力圆圈（大小=次数，颜色=距离）
```

---

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| **Runtime** | Node.js 20+ + TypeScript (ESM) |
| **Web** | Next.js 14 (App Router) + React + Tailwind CSS |
| **UI 风格** | 像素风 + CRT 扫描线 + zinc monochrome + orange accent |
| **LLM** | Kimi k2.5 (temperature 0.6) + SDK 自动重试 + 备用模型链 |
| **Memory** | Upstash Redis (生产) / JSON 文件 (本地) |
| **RAG** | TF-IDF 内存向量检索 |
| **数据同步** | Strava OAuth v3 API |
| **地图** | Leaflet + CartoDB Dark Matter |
| **图表** | Recharts |
| **部署** | Vercel Serverless + Vercel Cron |
| **PWA** | Web App Manifest + Service Worker |

---

## 📊 数据流

```
Strava API → normalize → Upstash Redis → Agent Context → Kimi LLM → Structured Response
                ↓                                              ↓
           数据清洗                                      训练计划/分析/建议
                ↓                                              ↓
           配速/心率/距离                                像素风 Dashboard
```

---

## 🎯 使用示例

### 同步 Strava 数据

1. 点击「连接 Strava」按钮
2. OAuth 授权
3. 自动拉取最近 30 条活动

### 查看训练分析

```
用户: 分析我上周的间歇训练
Agent: 检测到 6 组 800m 间歇，配速 4:05/km，组间恢复 2:30。
      质量评分: 8/10。建议：下次缩短恢复至 2:00，提升刺激强度。
```

### 生成训练计划

```
用户: 帮我制定一个全马 330 的计划
Agent: 生成 16 周周期化课表...
      基础期 4 周 → 建设期 6 周 → 巅峰期 4 周 → taper 2 周
```

### 路线聚类

```
用户: 我常跑的路线有哪些？
Agent: 发现 3 条主要路线：
      - 路线 A（滨江绿道）：跑过 12 次，总距离 156km
      - 路线 B（公园环线）：跑过 8 次，总距离 64km
      - 路线 C（操场间歇）：跑过 5 次，总距离 20km
```

---

## ⚠️ 已知问题

| 问题 | 状态 | 说明 |
|------|------|------|
| Kimi API 429 | 🟡 缓解 | SDK 自动重试 3 次 + 备用模型链，通常 30-60s 恢复 |
| Strava Token 过期 | 🔴 待修复 | 6 小时过期，刷新逻辑待实现 |
| 路线聚类空数据 | 🟡 正常 | 需 Strava 活动有 summary_polyline 才显示 |

---

## 🔮 后续扩展

- [ ] Strava Token 自动刷新
- [ ] 向量数据库（Pinecone/Chroma）替换 TF-IDF
- [ ] 更多 MCP Server（Garmin、Notion、Apple Health）
- [ ] Eval 增强（embedding-based 语义相似度）→ **已完成：Harness v2**
- [ ] 用户认证（NextAuth + 多用户隔离）
- [ ] 社交功能（跑团、排行榜）

---

## 🧪 Harness 回归测试系统

> **Harness v2 = 配置驱动测试套件 + 可插拔评估器 + 环境隔离 + 基线对比**

### 核心设计

```
Suite JSON → Loader → Case × Model × Matrix → Runner(隔离/多轮) → Evaluator(多维度) → Baseline(对比) → Reporter(HTML/MD/JSON) → Deploy(Vercel)
                                                                                                              ↓
                                                                                                         Recommender(LLM)
```

| 特性 | 说明 |
|------|------|
| **配置驱动** | 测试用例写在 `src/harness/config/default-suite.json`，不硬编码 |
| **可插拔评估器** | `rule` (关键词) + `llm-judge` (LLM裁判) + `embedding` (语义相似度) |
| **环境隔离** | 每个用例运行前自动备份/清空/恢复 `profile.json` + `recent_runs.json` |
| **参数矩阵** | 支持多组环境变量组合批量跑（如不同 temperature） |
| **基线管理** | `--save-baseline` 保存 golden 回答，`--compare` 对比退化 |
| **报告导出** | CLI 实时进度 + Markdown + JSON + HTML（可交互） |
| **多轮对话** | `turns` 数组定义多轮用例，测试 Agent 上下文保持能力 |
| **用例推荐** | `--recommend` 分析失败用例，LLM 自动生成新测试用例 |
| **静态托管** | `--deploy` 一键生成 Vercel 部署包 |

### 快速开始

```bash
# 1. 确保环境变量已配置（.env 或 .env.local）
KIMI_API_KEY=xxx

# 2. 运行完整回归测试（默认使用真实 Kimi，并发=1避免429）
npm run harness

# 3. 查看报告
open harness-runs/20260615-xxx.html    # 浏览器打开 HTML 报告
cat harness-runs/20260615-xxx.md       # 终端查看 Markdown
```

### 常用命令

```bash
# 快速抽样验证（只跑前 3 条用例，1 分钟出结果）
npm run harness -- --sample=3

# 分类过滤（只跑指定分类）
npm run harness -- --category=伤病风险 --model=mock

# 标签搜索（只跑带指定标签的用例）
npm run harness -- --tag=recovery,injury --model=mock

# 参数矩阵（传入 JSON 文件或内联配置）
npm run harness -- --matrix=./src/harness/config/matrix-temperature.json --model=mock

# 默认：自动检测可用模型（Kimi优先，没有则mock）
npm run harness

# 指定模型（mock 离线快速验证）
npm run harness -- --model=mock

# 多模型对比
npm run harness -- --model=mock,kimi

# 指定运行模式
npm run harness -- --mode=workflow
npm run harness -- --mode=multi

# 保存基线（后续对比用）
npm run harness -- --save-baseline

# 与上次基线对比（看哪些用例退化了）
npm run harness -- --compare

# 失败后自动推荐新用例
npm run harness -- --recommend

# 一键生成静态托管包
npm run harness -- --deploy

# 组合：跑完 + 推荐 + 部署
npm run harness -- --recommend --deploy

# 调整并发（Kimi 429 时降到 1）
npm run harness -- --concurrency=1

# 只输出 JSON（CI 场景）
npm run harness -- --no-md --no-html

# 只打印配置不执行
cd runcoach-agent && npm run harness -- --dry-run
```

### 测试套件配置

```json
// src/harness/config/default-suite.json
{
  "name": "RunCoach Core Suite",
  "version": "1.0.0",
  "cases": [
    {
      "id": "E001",
      "name": "高强度长距离后疲劳恢复",
      "category": "疲劳恢复",
      "input": "我今天跑了 15km，配速 5:30，心率 155，感觉很累，明天该怎么跑？",
      "tags": ["recovery", "high-load"],
      "expectedParams": {
        "mustInclude": ["恢复", "休息"],
        "mustNotInclude": ["间歇", "阈值", "高强度"],
        "expectedTool": "suggestNextWorkout",
        "minScore": 80
      }
    }
  ]
}
```

每个用例通过 `expectedParams` 定义评估规则，无需修改代码即可新增测试。

### 评估器配置

```json
// 在 harness 配置中指定多个评估器
{
  "evaluators": [
    { "type": "rule", "weight": 0.6, "config": {} },
    { "type": "llm-judge", "weight": 0.4, "config": { "criteria": "回答是否专业且安全" } }
  ]
}
```

| 评估器 | 适用场景 |
|--------|----------|
| `rule` | 硬性约束（关键词、工具调用、迭代次数） |
| `llm-judge` | 柔性质量（语义理解、逻辑正确性） |
| `embedding` | 语义相似度（与参考回答对比） |

### 输出报告

每次运行生成 3 份文件：

| 文件 | 用途 |
|------|------|
| `harness-runs/20260615-xxx.json` | 完整数据，CI 解析 |
| `harness-runs/20260615-xxx.md` | 人类可读，Git 提交 |
| `harness-runs/20260615-xxx.html` | 浏览器打开，可交互查看 |

### Dashboard 服务器

```bash
# 启动本地 Dashboard（默认端口 7365）
npm run dashboard

# 打开浏览器
open http://localhost:7365
```

功能：
- **趋势图表**：Chart.js 展示通过率、均分、耗时趋势
- **历史列表**：所有运行记录，点击查看详情
- **对比视图**：相邻两次运行的并排对比
- **像素风 UI**：与跑蓝 Web 应用一致的 CRT 扫描线风格

### 数据持久化

每次运行自动追加到 `harness-runs/harness-db.json`：

```json
[
  {
    "runId": "20260615-xxx",
    "timestamp": "2026-06-15T06:54:00Z",
    "passRate": 50,
    "avgScore": 80,
    "totalDurationMs": 8
  }
]
```

API 端点：
- `GET /api/records` — 所有历史记录
- `GET /api/trend` — 趋势数据（供 Chart.js 使用）

### Badge 徽章

每次运行自动生成 `harness-runs/badge.svg`：

```markdown
![Harness](harness-runs/badge.svg)
```

- 绿色 ≥ 80%：通过
- 黄色 50-80%：警告
- 红色 < 50%：失败

### 性能指标

每次运行自动收集性能数据：

| 指标 | 说明 |
|------|------|
| `avgLlmDecisionMs` | LLM 决策平均耗时 |
| `avgToolCallsMs` | 工具调用平均耗时 |
| `avgEvaluationMs` | 评估平均耗时 |
| `avgTokensPerCase` | 每用例平均 Token 消耗 |

在 Dashboard 的 `/run/:id` 页面查看详情。

### 多轮对话测试

测试 Agent 在多轮对话中保持上下文的能力。用例定义使用 `turns` 数组而非 `input`：

```json
{
  "id": "M001",
  "name": "多轮目标记忆",
  "category": "多轮对话",
  "tags": ["multi-turn", "memory"],
  "turns": [
    { "input": "我目标全马 3:20，麻烦记下来" },
    { "input": "明天该跑什么？", "expectedParams": { "mustInclude": ["3:20"] } }
  ]
}
```

特点：
- 多轮用例**不重置内存**，AgentContext 在轮次间传递
- 每轮有独立的 `expectedParams`，可覆盖或继承
- HTML 报告中用「M」标记多轮用例，展开查看每轮详情

### 用例自动推荐

Harness 运行后，分析失败用例并调用 LLM 推荐新测试用例：

```bash
# 跑完自动推荐
npm run harness -- --recommend

# 推荐结果保存至 harness-runs/harness-recommended-{runId}.json
```

LLM 会分析失败原因，生成 3-5 个针对性新用例，直接可用于下一轮测试。

### 报告静态托管

一键生成 Vercel 可部署的静态站点：

```bash
# 跑完自动生成部署包
npm run harness -- --deploy

# 部署到 Vercel
cd harness-deploy
npx vercel --prod
```

生成的 `harness-deploy/` 包含：
- 索引页（与报告一致的像素风 UI）
- 所有历史报告文件
- `vercel.json` 配置

### 已知限制

| 问题 | 状态 | 说明 |
|------|------|------|
| Kimi API 429 | 🟡 缓解 | 并发默认 1，SDK 自动重试 3 次；高峰期仍可能触发 |
| LLM-as-a-Judge | 🟡 部分 | 已接入真实 LLM，但 Token 消耗未完全追踪 |
| Embedding 评估 | 🔵 简单 | 当前使用 TF-IDF 分词，精度有限 |
| 参数矩阵 | 🟡 可用 | 配置层已支持，CLI 可传入 JSON 文件 |

---

## 📜 License

MIT

---

> **Agent = LLM + 工具 + 状态 + 决策循环 + 约束 + 评估**
>
> 《学习 Agent，10 天从入门到精通》完整实战项目。
