/**
 * Dashboard 服务器 — 本地 HTTP 展示所有历史 Harness 报告
 *
 * 使用方式:
 *   npm run dashboard
 *
 * 功能:
 *   - 列出所有历史运行
 *   - 趋势图表 (Chart.js)
 *   - 单条运行详情
 *   - 两个运行的对比视图
 */

import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { loadRecords, getTrendData, type HistoryRecord } from "./harness/db/store.js";

const PORT = 7365; // HARNESS on phone keypad: 4-2-7-7-3-7-6-5
const OUTPUT_DIR = "./harness-runs";

function serveHtml(res: http.ServerResponse, html: string): void {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function serveJson(res: http.ServerResponse, data: unknown): void {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function serve404(res: http.ServerResponse): void {
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
}

function serveStaticFile(res: http.ServerResponse, filePath: string): void {
  if (!fs.existsSync(filePath)) {
    serve404(res);
    return;
  }
  const ext = path.extname(filePath);
  const mimeTypes: Record<string, string> = {
    ".html": "text/html",
    ".json": "application/json",
    ".css": "text/css",
    ".js": "application/javascript",
  };
  res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
  res.end(fs.readFileSync(filePath, "utf-8"));
}

// ====== HTML 生成 ======

export function generateDashboard(records: HistoryRecord[]): string {
  const trend = getTrendData(OUTPUT_DIR, 30);

  const latest = records.length > 0 ? records[records.length - 1] : null;

  const rows = records
    .slice()
    .reverse()
    .map(
      (r) => `
    <tr>
      <td><a href="/run/${r.runId}">${r.runId}</a></td>
      <td>${r.timestamp.slice(0, 19)}</td>
      <td>${r.suite}</td>
      <td>${r.models.join(", ")}</td>
      <td class="${r.passRate >= 80 ? "pass" : r.passRate >= 50 ? "warn" : "fail"}">${r.passRate}%</td>
      <td>${r.avgScore}</td>
      <td>${r.totalCases}</td>
      <td>${r.passed}/${r.failed}</td>
      <td>${r.totalDurationMs}ms</td>
      <td><a href="/compare/${r.runId}">对比</a></td>
    </tr>`
    )
    .join("");

  return pixelHtml(`
    <h1 class="glitch">// DASHBOARD</h1>
    <div class="meta">Total runs: ${records.length} // Last updated: ${new Date().toISOString().slice(0, 19)}</div>

    <div class="summary">
      <div class="card">
        <div class="value">${records.length}</div>
        <div class="label">TOTAL RUNS</div>
      </div>
      <div class="card">
        <div class="value">${latest?.passRate ?? 0}%</div>
        <div class="label">LATEST PASS RATE</div>
      </div>
      <div class="card">
        <div class="value">${latest?.avgScore ?? 0}</div>
        <div class="label">LATEST AVG SCORE</div>
      </div>
      <div class="card">
        <div class="value">${latest?.totalDurationMs ?? 0}ms</div>
        <div class="label">LATEST DURATION</div>
      </div>
    </div>

    <div class="section">
      <h2>> TRENDS</h2>
      <div class="charts">
        <div class="chart-container">
          <canvas id="passRateChart"></canvas>
        </div>
        <div class="chart-container">
          <canvas id="avgScoreChart"></canvas>
        </div>
        <div class="chart-container">
          <canvas id="durationChart"></canvas>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>> HISTORY</h2>
      <table>
        <tr><th>RUN ID</th><th>TIME</th><th>SUITE</th><th>MODELS</th><th>PASS RATE</th><th>AVG SCORE</th><th>CASES</th><th>P/F</th><th>DURATION</th><th>COMPARE</th></tr>
        ${rows}
      </table>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
    const labels = ${JSON.stringify(trend.labels)};
    const passRates = ${JSON.stringify(trend.passRates)};
    const avgScores = ${JSON.stringify(trend.avgScores)};
    const durations = ${JSON.stringify(trend.durations)};

    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { font: { family: 'VT323', size: 14 } } } },
      scales: {
        x: { ticks: { font: { family: 'VT323', size: 12 } }, grid: { color: '#3f3f46' } },
        y: { ticks: { font: { family: 'VT323', size: 12 } }, grid: { color: '#3f3f46' } },
      },
    };

    new Chart(document.getElementById('passRateChart'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Pass Rate %',
          data: passRates,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.3,
        }]
      },
      options: commonOptions,
    });

    new Chart(document.getElementById('avgScoreChart'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Avg Score',
          data: avgScores,
          borderColor: '#f97316',
          backgroundColor: 'rgba(249, 115, 22, 0.1)',
          fill: true,
          tension: 0.3,
        }]
      },
      options: commonOptions,
    });

    new Chart(document.getElementById('durationChart'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Duration ms',
          data: durations,
          backgroundColor: '#3f3f46',
          borderColor: '#71717a',
        }]
      },
      options: commonOptions,
    });
    </script>
  `);
}

function generateRunDetail(runId: string): string {
  const filePath = path.join(OUTPUT_DIR, `${runId}.json`);
  if (!fs.existsSync(filePath)) {
    return pixelHtml(`<h1 class="glitch">// 404</h1><div class="meta">Run ${runId} not found</div>`);
  }
  const result = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  const caseRows = result.evaluated
    .map(
      (e: any) => `
    <tr class="${e.passed ? "passed" : "failed"}">
      <td>${e.run.caseId}</td>
      <td>${e.run.caseName}</td>
      <td>${e.run.category}</td>
      <td>${e.passed ? "✅" : "❌"}</td>
      <td>${e.totalScore}</td>
      <td>${e.run.durationMs}ms</td>
      <td><pre>${escapeHtml(e.run.answer.slice(0, 300))}</pre></td>
    </tr>`
    )
    .join("");

  return pixelHtml(`
    <h1 class="glitch">// RUN ${runId}</h1>
    <div class="meta">
      ${result.timestamp} // MODE: ${result.config.mode} // MODELS: ${result.config.models.join(", ")}
      <br><a href="/">← Dashboard</a>
    </div>
    <div class="summary">
      <div class="card pass"><div class="value">${result.summaries[0]?.passed || 0}</div><div class="label">PASSED</div></div>
      <div class="card fail"><div class="value">${result.summaries[0]?.failed || 0}</div><div class="label">FAILED</div></div>
      <div class="card"><div class="value">${result.summaries[0]?.passRate || 0}%</div><div class="label">RATE</div></div>
      <div class="card"><div class="value">${result.totalDurationMs}ms</div><div class="label">DURATION</div></div>
    </div>
    ${result.performanceMetrics ? `
    <div class="section">
      <h2>> PERFORMANCE</h2>
      <div class="summary">
        <div class="card"><div class="value">${result.performanceMetrics.avgLlmDecisionMs}ms</div><div class="label">LLM DECISION</div></div>
        <div class="card"><div class="value">${result.performanceMetrics.avgToolCallsMs}ms</div><div class="label">TOOL CALLS</div></div>
        <div class="card"><div class="value">${result.performanceMetrics.avgEvaluationMs}ms</div><div class="label">EVALUATION</div></div>
        <div class="card"><div class="value">${result.performanceMetrics.avgTokensPerCase}</div><div class="label">TOKENS/CASE</div></div>
      </div>
    </div>` : ""}
    <div class="section">
      <h2>> CASES</h2>
      <table><tr><th>ID</th><th>NAME</th><th>CATEGORY</th><th>STATUS</th><th>SCORE</th><th>DURATION</th><th>ANSWER</th></tr>${caseRows}</table>
    </div>
  `);
}

function generateCompare(runId: string): string {
  const records = loadRecords(OUTPUT_DIR);
  const current = records.find((r: HistoryRecord) => r.runId === runId);
  if (!current) {
    return pixelHtml(`<h1 class="glitch">// 404</h1><div class="meta">Run ${runId} not found</div>`);
  }
  const baseline = records[records.indexOf(current) - 1];
  if (!baseline) {
    return pixelHtml(`<h1 class="glitch">// COMPARE</h1><div class="meta">No previous run to compare with ${runId}</div><br><a href="/">← Dashboard</a>`);
  }

  return pixelHtml(`
    <h1 class="glitch">// COMPARE</h1>
    <div class="meta">
      <a href="/">← Dashboard</a>
    </div>
    <div class="summary">
      <div class="card">
        <div class="value" style="font-size:24px">${baseline.runId}</div>
        <div class="label">BASELINE</div>
        <div style="color:var(--muted);font-size:14px">${baseline.timestamp.slice(0, 10)}</div>
      </div>
      <div class="card">
        <div class="value" style="font-size:24px">${current.runId}</div>
        <div class="label">CURRENT</div>
        <div style="color:var(--muted);font-size:14px">${current.timestamp.slice(0, 10)}</div>
      </div>
    </div>
    <div class="section">
      <h2>> METRICS</h2>
      <table>
        <tr><th>METRIC</th><th>BASELINE</th><th>CURRENT</th><th>DELTA</th></tr>
        <tr><td>Pass Rate</td><td>${baseline.passRate}%</td><td class="score">${current.passRate}%</td><td class="${current.passRate >= baseline.passRate ? "pass" : "fail"}">${current.passRate - baseline.passRate > 0 ? "+" : ""}${current.passRate - baseline.passRate}%</td></tr>
        <tr><td>Avg Score</td><td>${baseline.avgScore}</td><td class="score">${current.avgScore}</td><td class="${current.avgScore >= baseline.avgScore ? "pass" : "fail"}">${current.avgScore - baseline.avgScore > 0 ? "+" : ""}${current.avgScore - baseline.avgScore}</td></tr>
        <tr><td>Cases</td><td>${baseline.totalCases}</td><td>${current.totalCases}</td><td>${current.totalCases - baseline.totalCases}</td></tr>
        <tr><td>Duration</td><td>${baseline.totalDurationMs}ms</td><td>${current.totalDurationMs}ms</td><td>${current.totalDurationMs - baseline.totalDurationMs > 0 ? "+" : ""}${current.totalDurationMs - baseline.totalDurationMs}ms</td></tr>
      </table>
    </div>
  `);
}

// ====== 像素风 HTML 模板 ======

function pixelHtml(body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Harness Dashboard</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
  :root { --bg: #18181b; --fg: #e4e4e7; --muted: #71717a; --accent: #f97316; --accent-dim: #c2410c; --pass: #22c55e; --warn: #eab308; --fail: #ef4444; --card: #27272a; --border: #3f3f46; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 40px 20px; background: var(--bg); color: var(--fg); font-family: 'VT323', monospace; font-size: 18px; line-height: 1.5; }
  .crt-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 2px); z-index: 9999; }
  .container { max-width: 1200px; margin: 0 auto; }
  h1 { font-size: 48px; margin: 0 0 8px 0; color: var(--accent); text-shadow: 2px 2px 0 var(--accent-dim); letter-spacing: 2px; }
  .meta { color: var(--muted); font-size: 16px; margin-bottom: 30px; border-bottom: 2px solid var(--border); padding-bottom: 15px; }
  .meta a { color: var(--accent); text-decoration: none; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 40px; }
  .card { background: var(--card); border: 2px solid var(--border); padding: 20px; text-align: center; position: relative; }
  .card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--accent); }
  .card .value { font-size: 48px; font-weight: 400; color: var(--fg); }
  .card .label { font-size: 16px; color: var(--muted); margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
  .pass { color: var(--pass) !important; }
  .warn { color: var(--warn) !important; }
  .fail { color: var(--fail) !important; }
  .score { color: var(--accent); font-weight: bold; }
  table { width: 100%; border-collapse: collapse; font-size: 16px; margin-top: 10px; }
  th { background: var(--card); padding: 12px; text-align: left; font-weight: 400; color: var(--accent); border-bottom: 2px solid var(--accent); text-transform: uppercase; letter-spacing: 1px; }
  td { padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
  tr:hover { background: rgba(249, 115, 22, 0.05); }
  tr.passed td { border-left: 3px solid var(--pass); }
  tr.failed td { border-left: 3px solid var(--fail); }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  pre { background: var(--card); padding: 8px; border: 1px solid var(--border); font-family: 'VT323', monospace; font-size: 14px; overflow: auto; max-width: 300px; white-space: pre-wrap; }
  .section { margin-top: 50px; }
  .section h2 { font-size: 28px; color: var(--accent); border-bottom: 2px solid var(--border); padding-bottom: 8px; text-transform: uppercase; letter-spacing: 2px; }
  .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; }
  .chart-container { background: var(--card); border: 2px solid var(--border); padding: 16px; height: 250px; position: relative; }
  .chart-container::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--accent); }
  .glitch { animation: glitch 1s linear infinite; }
  @keyframes glitch { 2%, 64% { transform: translate(2px,0) skew(0deg); } 4%, 60% { transform: translate(-2px,0) skew(0deg); } 62% { transform: translate(0,0) skew(5deg); } }
</style>
</head>
<body>
<div class="crt-overlay"></div>
<div class="container">
  ${body}
</div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ====== HTTP Server ======

function startServer(): void {
  const server = http.createServer((req, res) => {
    const url = req.url || "/";

    if (url === "/" || url === "/dashboard") {
      const records = loadRecords(OUTPUT_DIR);
      serveHtml(res, generateDashboard(records));
      return;
    }

    if (url.startsWith("/run/")) {
      const runId = url.slice(5);
      serveHtml(res, generateRunDetail(runId));
      return;
    }

    if (url.startsWith("/compare/")) {
      const runId = url.slice(9);
      serveHtml(res, generateCompare(runId));
      return;
    }

    if (url.startsWith("/api/records")) {
      serveJson(res, loadRecords(OUTPUT_DIR));
      return;
    }

    if (url.startsWith("/api/trend")) {
      serveJson(res, getTrendData(OUTPUT_DIR, 30));
      return;
    }

    if (url.startsWith("/harness-runs/")) {
      serveStaticFile(res, path.join(".", url));
      return;
    }

    serve404(res);
  });

  server.listen(PORT, () => {
    console.log("=".repeat(50));
    console.log("🏃 Harness Dashboard");
    console.log("=".repeat(50));
    console.log(`URL: http://localhost:${PORT}`);
    console.log(`Dir: ${path.resolve(OUTPUT_DIR)}`);
    console.log("=".repeat(50));
  });
}

startServer();
