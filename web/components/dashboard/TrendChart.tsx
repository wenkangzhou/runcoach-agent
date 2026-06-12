"use client";

import { useMemo } from "react";

interface RunLog {
  date: string;
  distance: number;
  pace: string;
  hr?: number;
  feeling: string;
  notes?: string;
}

interface TrendChartProps {
  runs: RunLog[];
  period?: "week" | "month";
}

/**
 * 像素风柱状图 - 纯 CSS + div 实现
 * 输入: RunLog[]
 * 输出: 像素风柱状图（CSS grid）
 */
export default function TrendChart({ runs, period = "week" }: TrendChartProps) {
  const data = useMemo(() => {
    if (!runs || runs.length === 0) return [];

    const sorted = [...runs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (period === "week") {
      // 按周聚合
      const weeks: Record<string, number> = {};
      sorted.forEach((run) => {
        const d = new Date(run.date);
        const weekKey = `${d.getFullYear()}-W${getWeekNumber(d)}`;
        weeks[weekKey] = (weeks[weekKey] || 0) + run.distance;
      });
      return Object.entries(weeks).map(([label, value]) => ({ label, value }));
    }

    // 按月聚合
    const months: Record<string, number> = {};
    sorted.forEach((run) => {
      const d = new Date(run.date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months[monthKey] = (months[monthKey] || 0) + run.distance;
    });
    return Object.entries(months).map(([label, value]) => ({ label, value }));
  }, [runs, period]);

  const maxValue = useMemo(() => {
    if (data.length === 0) return 1;
    return Math.max(...data.map((d) => d.value));
  }, [data]);

  if (data.length === 0) {
    return (
      <div style={styles.empty}>
        <p>暂无数据</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>{period === "week" ? "周" : "月"}跑量趋势</span>
        <span style={styles.unit}>单位: km</span>
      </div>

      <div style={styles.chartArea}>
        {/* Y轴刻度 */}
        <div style={styles.yAxis}>
          {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
            <div key={ratio} style={styles.yTick}>
              <span style={styles.yLabel}>{Math.round(maxValue * ratio)}</span>
              <div style={styles.gridLine} />
            </div>
          ))}
        </div>

        {/* 柱状图区域 */}
        <div style={styles.barsArea}>
          <div style={styles.barsRow}>
            {data.map((item, i) => {
              const heightPercent = (item.value / maxValue) * 100;
              const pixelHeight = Math.max(4, Math.round(heightPercent / 4) * 4); // 4px 像素对齐

              return (
                <div key={i} style={styles.barColumn}>
                  <div style={styles.barWrapper}>
                    <div
                      style={{
                        ...styles.bar,
                        height: `${pixelHeight}%`,
                        background:
                          i === data.length - 1
                            ? "var(--accent)"
                            : `linear-gradient(180deg, var(--accent-dim) 0%, var(--accent) 100%)`,
                      }}
                    />
                  </div>
                  <div style={styles.barLabel}>{item.label.slice(-2)}</div>
                  <div style={styles.barValue}>{Math.round(item.value * 10) / 10}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 获取周数 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "16px",
    background: "var(--bg-secondary)",
    border: "2px solid var(--border)",
    borderRadius: "4px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  title: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "var(--accent)",
  },
  unit: {
    fontSize: "11px",
    color: "var(--text-secondary)",
  },
  chartArea: {
    display: "flex",
    gap: "8px",
    height: "200px",
  },
  yAxis: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "flex-end",
    width: "36px",
    flexShrink: 0,
    height: "100%",
    paddingBottom: "28px",
  },
  yTick: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    position: "relative",
    width: "100%",
  },
  yLabel: {
    fontSize: "10px",
    color: "var(--text-secondary)",
    width: "24px",
    textAlign: "right",
    flexShrink: 0,
  },
  gridLine: {
    position: "absolute",
    left: "32px",
    right: "-8px",
    height: "1px",
    background: "var(--border)",
    opacity: 0.5,
  },
  barsArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    height: "100%",
    paddingBottom: "28px",
  },
  barsRow: {
    flex: 1,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-around",
    gap: "4px",
    borderBottom: "2px solid var(--border)",
    paddingBottom: "4px",
  },
  barColumn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flex: 1,
    minWidth: "24px",
    maxWidth: "48px",
  },
  barWrapper: {
    flex: 1,
    width: "100%",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  bar: {
    width: "100%",
    maxWidth: "28px",
    borderRadius: "2px 2px 0 0",
    transition: "height 0.3s ease",
    imageRendering: "pixelated",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
  },
  barLabel: {
    fontSize: "10px",
    color: "var(--text-secondary)",
    marginTop: "4px",
    textAlign: "center",
  },
  barValue: {
    fontSize: "10px",
    color: "var(--accent)",
    fontWeight: "bold",
    marginTop: "2px",
  },
  empty: {
    padding: "40px",
    textAlign: "center",
    color: "var(--text-secondary)",
    fontSize: "14px",
    background: "var(--bg-secondary)",
    border: "2px solid var(--border)",
    borderRadius: "4px",
  },
};
