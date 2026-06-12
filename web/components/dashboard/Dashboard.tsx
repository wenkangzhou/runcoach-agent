"use client";

import { useState, useEffect } from "react";
import TrendChart from "./TrendChart";
import PaceZones from "./PaceZones";
import StatsCards from "./StatsCards";

interface RunLog {
  date: string;
  distance: number;
  pace: string;
  hr?: number;
  feeling: string;
  notes?: string;
}

/**
 * 主仪表盘组件
 * - 周/月跑量趋势图（柱状图）
 * - 配速区间分布（饼图）
 * - 最近 7 次训练列表
 * - 总里程/总时长/最佳成绩卡片
 */
export default function Dashboard() {
  const [runs, setRuns] = useState<RunLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<"week" | "month">("week");

  const fetchRuns = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/runs");
      const data = await res.json();
      if (data.success) {
        setRuns(data.runs || []);
      } else {
        setError(data.error || "获取数据失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const recentRuns = runs.slice(0, 7);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>加载中...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>📊 训练仪表盘</h2>
        <button style={styles.refreshBtn} onClick={fetchRuns}>
          🔄 刷新
        </button>
      </div>

      {error && (
        <div style={styles.errorBanner}>
          ❌ {error}
        </div>
      )}

      {/* 统计卡片 */}
      <div style={styles.section}>
        <StatsCards runs={runs} />
      </div>

      {/* 趋势图 + 配速区间 */}
      <div style={styles.row}>
        <div style={styles.col}>
          <div style={styles.periodToggle}>
            <button
              style={{
                ...styles.periodBtn,
                ...(period === "week" ? styles.periodBtnActive : {}),
              }}
              onClick={() => setPeriod("week")}
            >
              周
            </button>
            <button
              style={{
                ...styles.periodBtn,
                ...(period === "month" ? styles.periodBtnActive : {}),
              }}
              onClick={() => setPeriod("month")}
            >
              月
            </button>
          </div>
          <TrendChart runs={runs} period={period} />
        </div>
        <div style={styles.col}>
          <PaceZones runs={runs} />
        </div>
      </div>

      {/* 最近训练列表 */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>最近训练</h3>
        <div style={styles.recentList}>
          {recentRuns.length === 0 ? (
            <p style={styles.emptyText}>暂无训练记录</p>
          ) : (
            recentRuns.map((run, i) => (
              <div key={i} style={styles.recentItem}>
                <div style={styles.recentMain}>
                  <span style={styles.recentDate}>{run.date}</span>
                  <span style={styles.recentType}>{getRunTypeEmoji(run)}</span>
                </div>
                <div style={styles.recentDetails}>
                  <span style={styles.recentDistance}>{run.distance}km</span>
                  {run.pace && run.pace !== "-" && (
                    <span style={styles.recentPace}>⏱ {run.pace}</span>
                  )}
                  {run.hr && (
                    <span style={styles.recentHr}>❤️ {run.hr}</span>
                  )}
                  <span style={styles.recentFeeling}>😊 {run.feeling}</span>
                </div>
                {run.notes && (
                  <p style={styles.recentNotes}>{run.notes}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function getRunTypeEmoji(run: RunLog): string {
  if (!run.hr) return "🏃";
  if (run.hr >= 170) return "🔥 间歇";
  if (run.hr >= 160) return "⚡ 节奏";
  if (run.hr >= 150) return "🍃 轻松";
  return "💤 恢复";
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    overflowY: "auto",
    height: "100%",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: "8px",
    borderBottom: "1px solid var(--border)",
  },
  title: {
    fontSize: "16px",
    fontWeight: "bold",
    color: "var(--accent)",
    margin: 0,
  },
  refreshBtn: {
    padding: "6px 12px",
    background: "var(--bg-tertiary)",
    color: "var(--text-primary)",
    borderRadius: "4px",
    fontSize: "12px",
    cursor: "pointer",
    minHeight: "44px",
  },
  errorBanner: {
    padding: "10px 16px",
    background: "rgba(239, 68, 68, 0.1)",
    color: "var(--error)",
    borderRadius: "4px",
    fontSize: "13px",
  },
  section: {
    width: "100%",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  },
  col: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  periodToggle: {
    display: "flex",
    gap: "4px",
    marginBottom: "4px",
  },
  periodBtn: {
    padding: "4px 12px",
    background: "var(--bg-tertiary)",
    color: "var(--text-secondary)",
    borderRadius: "4px",
    fontSize: "12px",
    cursor: "pointer",
    minHeight: "44px",
  },
  periodBtnActive: {
    background: "var(--accent)",
    color: "var(--bg-primary)",
    fontWeight: "bold",
  },
  sectionTitle: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "var(--accent)",
    marginBottom: "12px",
  },
  recentList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  recentItem: {
    padding: "12px",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
  },
  recentMain: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "6px",
  },
  recentDate: {
    fontSize: "12px",
    color: "var(--text-secondary)",
  },
  recentType: {
    fontSize: "12px",
    color: "var(--accent)",
  },
  recentDetails: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  recentDistance: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "var(--text-primary)",
  },
  recentPace: {
    fontSize: "12px",
    color: "var(--text-secondary)",
  },
  recentHr: {
    fontSize: "12px",
    color: "var(--error)",
  },
  recentFeeling: {
    fontSize: "12px",
    color: "var(--success)",
  },
  recentNotes: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    marginTop: "6px",
    fontStyle: "italic",
  },
  emptyText: {
    color: "var(--text-secondary)",
    fontSize: "14px",
    textAlign: "center",
    padding: "20px",
  },
  loading: {
    padding: "40px",
    textAlign: "center",
    color: "var(--text-secondary)",
    fontSize: "14px",
  },
};
