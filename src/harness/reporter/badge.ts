/**
 * Badge 生成器 — 生成 SVG 通过率徽章，可贴到 README
 *
 * 使用方式:
 *   运行 harness 后自动生成 badge.svg
 *   在 README 中引用: ![Harness](harness-runs/badge.svg)
 */

import * as fs from "fs";
import * as path from "path";

export function generateBadge(
  passRate: number,
  avgScore: number,
  totalCases: number
): string {
  const color = passRate >= 80 ? "#22c55e" : passRate >= 50 ? "#eab308" : "#ef4444";
  const label = passRate >= 80 ? "passing" : passRate >= 50 ? "warning" : "failing";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="20">
    <linearGradient id="bg" x2="0" y2="100%">
      <stop offset="0" stop-color="#333" stop-opacity="0.1"/>
      <stop offset="1" stop-opacity="0.1"/>
    </linearGradient>
    <rect width="120" height="20" fill="#555" rx="3"/>
    <rect x="120" width="120" height="20" fill="${color}" rx="3"/>
    <rect width="240" height="20" fill="url(#bg)" rx="3"/>
    <text x="60" y="14" fill="#fff" font-family="monospace" font-size="11" text-anchor="middle">HARNESS</text>
    <text x="180" y="14" fill="#fff" font-family="monospace" font-size="11" text-anchor="middle">${passRate}% ${label}</text>
  </svg>`;
}

export function saveBadge(outputDir: string, passRate: number, avgScore: number, totalCases: number): string {
  const dir = path.resolve(outputDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, "badge.svg");
  fs.writeFileSync(p, generateBadge(passRate, avgScore, totalCases), "utf-8");
  return p;
}
