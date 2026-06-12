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

interface StatsCardsProps {
  runs: RunLog[];
}

/**
 * 统计卡片
 * 总里程、总时长、平均配速、最佳成绩
 */
export default function StatsCards({ runs }: StatsCardsProps) {
  const stats = useMemo(() => {
    if (!runs || runs.length === 0) {
      return {
        totalDistance: 0,
        totalDuration: 0,
        avgPace: "-",
        bestPace: "-",
        totalRuns: 0,
        longestRun: 0,
      };
    }

    const totalDistance = runs.reduce((sum, r) => sum + r.distance, 0);
    const totalRuns = runs.length;

    // 估算总时长（距离 * 平均配速）
    const totalDuration = runs.reduce((sum, r) => {
      const paceSec = parsePace(r.pace);
      return sum + (paceSec > 0 ? r.distance * (paceSec / 60) : r.distance * 6);
    }, 0);

    // 平均配速
    const validPaces = runs.filter((r) => parsePace(r.pace) > 0);
    const avgPaceSec =
      validPaces.length > 0
        ? validPaces.reduce((sum, r) => sum + parsePace(r.pace), 0) / validPaces.length
        : 0;

    // 最佳（最快）配速
    const bestPaceSec =
      validPaces.length > 0
        ? Math.min(...validPaces.map((r) => parsePace(r.pace)))
        : 0;

    // 最长单次
    const longestRun = Math.max(...runs.map((r) => r.distance));

    return {
      totalDistance: Math.round(totalDistance * 10) / 10,
      totalDuration: Math.round(totalDuration),
      avgPace: avgPaceSec > 0 ? formatPace(avgPaceSec) : "-",
      bestPace: bestPaceSec > 0 ? formatPace(bestPaceSec) : "-",
      totalRuns,
      longestRun: Math.round(longestRun * 10) / 10,
    };
  }, [runs]);

  const cards = [
    {
      icon: "📏",
      label: "总里程",
      value: `${stats.totalDistance} km`,
      sub: `${stats.totalRuns} 次训练`,
    },
    {
      icon: "⏱️",
      label: "总时长",
      value: `${stats.totalDuration} min`,
      sub: `≈ ${Math.round(stats.totalDuration / 60 * 10) / 10} 小时`,
    },
    {
      icon: "🏃",
      label: "平均配速",
      value: stats.avgPace,
      sub: `/km`,
    },
    {
      icon: "⚡",
      label: "最佳配速",
      value: stats.bestPace,
      sub: `/km`,
    },
    {
      icon: "🎯",
      label: "最长单次",
      value: `${stats.longestRun} km`,
      sub: "单次最长距离",
    },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>训练统计</span>
      </div>
      <div style={styles.grid}>
        {cards.map((card, i) => (
          <div key={i} style={styles.card}>
            <div style={styles.cardIcon}>{card.icon}</div>
            <div style={styles.cardLabel}>{card.label}</div>
            <div style={styles.cardValue}>{card.value}</div>
            <div style={styles.cardSub}>{card.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function parsePace(pace: string): number {
  const match = pace.match(/(\d+)[：:](\d+)/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function formatPace(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "16px",
    background: "var(--bg-secondary)",
    border: "2px solid var(--border)",
    borderRadius: "4px",
  },
  header: {
    marginBottom: "16px",
  },
  title: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "var(--accent)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
    gap: "12px",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "16px 12px",
    background: "var(--bg-primary)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    gap: "4px",
  },
  cardIcon: {
    fontSize: "20px",
    marginBottom: "4px",
  },
  cardLabel: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  cardValue: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "var(--text-primary)",
    fontFamily: "'Courier New', monospace",
  },
  cardSub: {
    fontSize: "10px",
    color: "var(--text-secondary)",
  },
};
