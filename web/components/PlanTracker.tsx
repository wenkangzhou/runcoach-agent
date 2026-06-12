"use client";

import { useState, useEffect } from "react";
import type { TrainingPlan, WeekStats } from "@/lib/training/plan-types";

interface PlanTrackerProps {
  plan?: TrainingPlan | null;
}

interface StatsData {
  overallCompletionRate: number;
  currentWeek: number;
  weekStats: WeekStats[];
  streakDays: number;
  totalPlanned: number;
  totalActual: number;
  totalScheduledDays: number;
  totalCompletedDays: number;
  totalSkippedDays: number;
}

export default function PlanTracker({ plan }: PlanTrackerProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/plan/stats");
      const data = await res.json();
      if (data.success && data.hasPlan) {
        setStats(data);
      } else {
        setStats(null);
      }
    } catch (err) {
      console.error("获取统计失败:", err);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [plan]);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>加载统计中...</div>
      </div>
    );
  }

  if (!stats || !plan) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>暂无活跃训练计划</div>
      </div>
    );
  }

  const currentWeekStats = stats.weekStats.find((w) => w.weekNumber === stats.currentWeek);

  return (
    <div style={styles.container}>
      {/* 大数字：总完成率 */}
      <div style={styles.bigNumberSection}>
        <div style={styles.bigNumber}>{stats.overallCompletionRate}%</div>
        <div style={styles.bigNumberLabel}>计划完成率</div>
        <div style={styles.bigNumberSub}>
          {stats.totalCompletedDays} / {stats.totalScheduledDays} 次训练
        </div>
      </div>

      {/* 关键指标行 */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>🔥 {stats.streakDays}</div>
          <div style={styles.statLabel}>连续训练天数</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.totalActual}km</div>
          <div style={styles.statLabel}>实际跑量</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.totalPlanned}km</div>
          <div style={styles.statLabel}>计划跑量</div>
        </div>
      </div>

      {/* 本周概览 */}
      {currentWeekStats && (
        <div style={styles.weekSection}>
          <h4 style={styles.sectionTitle}>📅 本周 (第 {stats.currentWeek} 周)</h4>
          <div style={styles.weekBarContainer}>
            <div style={styles.weekBarTrack}>
              <div
                style={{
                  ...styles.weekBarFill,
                  width: `${currentWeekStats.completionRate}%`,
                }}
              />
            </div>
            <span style={styles.weekBarText}>{currentWeekStats.completionRate}%</span>
          </div>
          <div style={styles.weekDetails}>
            <span>计划 {currentWeekStats.plannedDistance}km</span>
            <span>实际 {currentWeekStats.actualDistance}km</span>
            <span>完成 {currentWeekStats.completedDays} 天</span>
            {currentWeekStats.skippedDays > 0 && (
              <span style={styles.skippedText}>跳过 {currentWeekStats.skippedDays} 天</span>
            )}
          </div>
        </div>
      )}

      {/* 周历史 */}
      <div style={styles.weekSection}>
        <h4 style={styles.sectionTitle}>📈 各周完成率</h4>
        <div style={styles.weekList}>
          {stats.weekStats.map((w) => (
            <div key={w.weekNumber} style={styles.weekItem}>
              <span style={styles.weekItemLabel}>W{w.weekNumber}</span>
              <div style={styles.weekItemBarTrack}>
                <div
                  style={{
                    ...styles.weekItemBarFill,
                    width: `${w.completionRate}%`,
                    background:
                      w.weekNumber === stats.currentWeek
                        ? "var(--accent)"
                        : w.completionRate >= 80
                        ? "#22c55e"
                        : w.completionRate >= 50
                        ? "#eab308"
                        : "#ef4444",
                  }}
                />
              </div>
              <span style={styles.weekItemValue}>{w.completionRate}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "12px 0",
  },
  loading: {
    textAlign: "center",
    color: "var(--text-secondary)",
    fontSize: "14px",
    padding: "20px",
    fontFamily: "'Courier New', monospace",
  },
  empty: {
    textAlign: "center",
    color: "var(--text-secondary)",
    fontSize: "14px",
    padding: "20px",
    fontFamily: "'Courier New', monospace",
  },
  bigNumberSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "16px",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    gap: "4px",
  },
  bigNumber: {
    fontSize: "48px",
    fontWeight: "bold",
    color: "var(--accent)",
    fontFamily: "'Courier New', monospace",
    lineHeight: 1,
  },
  bigNumberLabel: {
    fontSize: "14px",
    color: "var(--text-secondary)",
    fontFamily: "'Courier New', monospace",
  },
  bigNumberSub: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    opacity: 0.7,
    fontFamily: "'Courier New', monospace",
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "8px",
  },
  statCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "12px 8px",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    gap: "4px",
  },
  statValue: {
    fontSize: "16px",
    fontWeight: "bold",
    color: "var(--text-primary)",
    fontFamily: "'Courier New', monospace",
  },
  statLabel: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    fontFamily: "'Courier New', monospace",
    textAlign: "center",
  },
  weekSection: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  sectionTitle: {
    fontSize: "13px",
    fontWeight: "bold",
    color: "var(--accent)",
    margin: 0,
    fontFamily: "'Courier New', monospace",
  },
  weekBarContainer: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  weekBarTrack: {
    flex: 1,
    height: "10px",
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "2px",
    overflow: "hidden",
  },
  weekBarFill: {
    height: "100%",
    background: "var(--accent)",
    transition: "width 0.3s ease",
  },
  weekBarText: {
    fontSize: "12px",
    color: "var(--accent)",
    fontWeight: "bold",
    fontFamily: "'Courier New', monospace",
    minWidth: "36px",
    textAlign: "right",
  },
  weekDetails: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    fontSize: "12px",
    color: "var(--text-secondary)",
    fontFamily: "'Courier New', monospace",
  },
  skippedText: {
    color: "#ef4444",
  },
  weekList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  weekItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  weekItemLabel: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    fontFamily: "'Courier New', monospace",
    minWidth: "32px",
  },
  weekItemBarTrack: {
    flex: 1,
    height: "8px",
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "2px",
    overflow: "hidden",
  },
  weekItemBarFill: {
    height: "100%",
    transition: "width 0.3s ease",
  },
  weekItemValue: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    fontFamily: "'Courier New', monospace",
    minWidth: "32px",
    textAlign: "right",
  },
};
