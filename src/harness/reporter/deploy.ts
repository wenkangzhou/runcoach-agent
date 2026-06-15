/**
 * 静态报告部署 — 生成 Vercel 可部署的静态站点
 *
 * 功能：
 * 1. 将所有报告（JSON / HTML / Markdown）复制到部署目录
 * 2. 生成索引页 index.html（像素风，与报告风格一致）
 * 3. 生成 vercel.json 配置
 * 4. 输出部署命令提示
 */

import * as fs from "fs";
import * as path from "path";
import type { HarnessResult } from "../types.js";

const DEPLOY_DIR = "./harness-deploy";

/** 生成部署包 */
export function generateDeployPackage(
  outputDir: string,
  result: HarnessResult
): string {
  const deployDir = path.resolve(DEPLOY_DIR);

  // 1. 清理并创建部署目录
  if (fs.existsSync(deployDir)) {
    fs.rmSync(deployDir, { recursive: true });
  }
  fs.mkdirSync(deployDir, { recursive: true });

  // 2. 复制所有报告文件
  const srcDir = path.resolve(outputDir);
  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    const src = path.join(srcDir, file);
    const dst = path.join(deployDir, file);
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      fs.cpSync(src, dst, { recursive: true });
    } else {
      fs.copyFileSync(src, dst);
    }
  }

  // 3. 生成索引页
  const indexHtml = generateIndexPage(result, files);
  fs.writeFileSync(path.join(deployDir, "index.html"), indexHtml, "utf-8");

  // 4. 生成 vercel.json
  const vercelConfig = {
    version: 2,
    public: true,
  };
  fs.writeFileSync(
    path.join(deployDir, "vercel.json"),
    JSON.stringify(vercelConfig, null, 2),
    "utf-8"
  );

  // 5. 生成 .gitignore（避免部署到 git）
  fs.writeFileSync(path.join(deployDir, ".gitignore"), "harness-db.json\n", "utf-8");

  return deployDir;
}

function generateIndexPage(result: HarnessResult, files: string[]): string {
  const { runId, timestamp, summaries, evaluated } = result;
  const summary = summaries[0];
  const passRate = summary?.passRate || 0;
  const color = passRate >= 80 ? "#22c55e" : passRate >= 50 ? "#eab308" : "#ef4444";

  const reportLinks = files
    .filter((f) => f.endsWith(".html") || f.endsWith(".md") || f.endsWith(".json"))
    .map((f) => {
      const icon = f.endsWith(".html") ? "🌐" : f.endsWith(".md") ? "📝" : "📊";
      return `<li><a href="${f}">${icon} ${f}</a></li>`;
    })
    .join("\n");

  const failedCases = evaluated
    .filter((e) => !e.passed)
    .map((e) => `<li>❌ ${e.run.caseId} — ${e.run.caseName} (${e.totalScore}分)</li>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RunCoach Harness · ${runId}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
:root{--bg:#09090b;--fg:#e4e4e7;--accent:${color};--dim:#52525b;--border:#27272a;}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'VT323',monospace;background:var(--bg);color:var(--fg);min-height:100vh;padding:2rem;}
.scanline{position:fixed;inset:0;pointer-events:none;z-index:9999;
background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.25) 2px,rgba(0,0,0,.25) 4px);}
header{border-bottom:2px solid var(--border);padding-bottom:1.5rem;margin-bottom:2rem;}
h1{font-size:2.5rem;text-transform:uppercase;letter-spacing:2px;color:var(--accent);}
.sub{color:var(--dim);font-size:1.1rem;margin-top:.5rem;}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;margin:2rem 0;}
.stat{background:var(--border);padding:1rem;text-align:center;border:1px solid var(--dim);}
.stat .num{font-size:2rem;color:var(--accent);}
.stat .label{font-size:.9rem;color:var(--dim);margin-top:.25rem;}
section{margin:2rem 0;}
h2{font-size:1.5rem;color:var(--accent);border-left:4px solid var(--accent);padding-left:.75rem;margin-bottom:1rem;}
ul{list-style:none;padding-left:0;}
li{padding:.5rem 0;border-bottom:1px solid var(--border);}
a{color:var(--accent);text-decoration:none;}
a:hover{text-decoration:underline;}
pre{background:var(--border);padding:1rem;overflow-x:auto;font-size:.9rem;}
.deploy-box{background:var(--border);border:1px solid var(--accent);padding:1.5rem;margin-top:2rem;}
.deploy-box code{background:#000;padding:.2rem .4rem;border-radius:3px;}
footer{margin-top:3rem;color:var(--dim);text-align:center;font-size:.9rem;}
</style>
</head>
<body>
<div class="scanline"></div>
<header>
  <h1>RunCoach Harness</h1>
  <div class="sub">Run: ${runId} · ${new Date(timestamp).toLocaleString("zh-CN")}</div>
</header>

<div class="stats">
  <div class="stat"><div class="num">${summary?.passed ?? 0}/${summary?.total ?? 0}</div><div class="label">PASSED</div></div>
  <div class="stat"><div class="num">${passRate}%</div><div class="label">PASS RATE</div></div>
  <div class="stat"><div class="num">${summary?.avgScore ?? 0}</div><div class="label">AVG SCORE</div></div>
  <div class="stat"><div class="num">${(result.totalDurationMs / 1000).toFixed(1)}s</div><div class="label">DURATION</div></div>
</div>

<section>
  <h2>📁 Reports</h2>
  <ul>${reportLinks}</ul>
</section>

<section>
  <h2>❌ Failed Cases</h2>
  <ul>${failedCases || "<li>All tests passed 🎉</li>"}</ul>
</section>

<div class="deploy-box">
  <h2>🚀 Deploy to Vercel</h2>
  <p>Install <a href="https://vercel.com/download" target="_blank">Vercel CLI</a> and run:</p>
  <pre><code>cd ${DEPLOY_DIR}
npx vercel --prod</code></pre>
  <p>Or link to Git repo and push:</p>
  <pre><code>cd ${DEPLOY_DIR}
git init
git add .
git commit -m "harness report ${runId}"
git remote add origin https://github.com/YOUR_NAME/harness-reports.git
git push -u origin main</code></pre>
</div>

<footer>
  <p>RunCoach Harness · v2 · Generated by Agent</p>
</footer>
</body>
</html>`;
}
