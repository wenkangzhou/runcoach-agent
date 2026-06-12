"use client";

import { useState } from "react";
import type { TrainingPlan, DayPlan, WeekPlan } from "@/lib/training/plan-types";

interface TrainingCalendarProps {
  plan: TrainingPlan;
  onUpdate?: () => void;
}

const WEEK_DAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "轻松跑": { bg: "rgba(6, 78, 59, 0.3)", border: "#047857", text: "#34d399" },
  "恢复跑": { bg: "rgba(6, 78, 59, 0.3)", border: "#047857", text: "#34d399" },
  "间歇跑": { bg: "rgba(127, 29, 29, 0.3)", border: "#b91c1c", text: "#f87171" },
  "节奏跑": { bg: "rgba(127, 29, 29, 0.3)", border: "#b91c1c", text: "#f87171" },
  "长距离": { bg: "rgba(30, 58, 138, 0.3)", border: "#1d4ed8", text: "#60a5fa" },
  "比赛": { bg: "rgba(30, 58, 138, 0.3)", border: "#1d4ed8", text: "#60a5fa" },
  "休息": { bg: "#27272a", border: "#3f3f46", text: "#71717a" },
};

function getTypeColors(type: string) {
  return TYPE_COLORS[type] || { bg: "#27272a", border: "#3f3f46", text: "#71717a" };
}

function StatusIcon({ status }: { status?: string }) {
  if (status === "completed") return <span style={{ color: "#f97316", fontWeight: "bold" }}>✓</span>;
  if (status === "skipped") return <span style={{ color: "#71717a", fontWeight: "bold" }}>✗</span>;
  if (status === "partial") return <span style={{ color: "#f97316", fontWeight: "bold" }}>◐</span>;
  return <span style={{ color: "#52525b" }}>○</span>;
}

function getDayDate(startDate: string, weekIndex: number, dayIndex: number): string {
  const start = new Date(startDate);
  const date = new Date(start);
  date.setDate(start.getDate() + weekIndex * 7 + dayIndex);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function TrainingCalendar({ plan, onUpdate }: TrainingCalendarProps) {
  const [activeWeek, setActiveWeek] = useState(() => {
    const start = new Date(plan.startDate);
    const today = new Date();
    const diffDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(plan.weeks.length - 1, Math.floor(diffDays / 7)));
  });
  const [modalDay, setModalDay] = useState<{
    weekIndex: number;
    dayIndex: number;
    day: DayPlan;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const week = plan.weeks[activeWeek];
  if (!week) return null;

  const handleTrack = async (status: "completed" | "skipped" | "partial") => {
    if (!modalDay) return;
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        weekIndex: modalDay.weekIndex,
        dayIndex: modalDay.dayIndex,
        status,
      };

      if (status === "completed" || status === "partial") {
        const form = document.getElementById("track-form") as HTMLFormElement | null;
        if (form) {
          const fd = new FormData(form);
          const actualDistance = fd.get("actualDistance");
          const actualPace = fd.get("actualPace");
          const actualDuration = fd.get("actualDuration");
          const actualHr = fd.get("actualHr");
          const feeling = fd.get("feeling");
          if (actualDistance) body.actualDistance = Number(actualDistance);
          if (actualPace) body.actualPace = String(actualPace);
          if (actualDuration) body.actualDuration = String(actualDuration);
          if (actualHr) body.actualHr = Number(actualHr);
          if (feeling) body.feeling = String(feeling);
        }
      }

      const res = await fetch("/api/plan/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setModalDay(null);
        onUpdate?.();
      } else {
        alert(data.error || "更新失败");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "网络错误");
    } finally {
      setLoading(false);
    }
  };

  // 周完成率
  const weekTotal = week.days.filter((d) => d.type !== "休息").length;
  const weekCompleted = week.days.filter((d) => d.status === "completed" || d.status === "partial").length;
  const weekRate = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;

  return (
    <div style={styles.container}>
      {/* 周选择器 */}
      <div style={styles.weekHeader}>
        <button
          style={styles.weekBtn}
          onClick={() => setActiveWeek((w) => Math.max(0, w - 1))}
          disabled={activeWeek === 0}
        >
          ←
        </button>
        <div style={styles.weekInfo}>
          <span style={styles.weekTitle}>第 {week.weekNumber} 周</span>
          <span style={styles.weekPhase}>{week.phase}</span>
        </div>
        <button
          style={styles.weekBtn}
          onClick={() => setActiveWeek((w) => Math.min(plan.weeks.length - 1, w + 1))}
          disabled={activeWeek === plan.weeks.length - 1}
        >
          →
        </button>
      </div>

      {/* 周进度条 */}
      <div style={styles.progressBarContainer}>
        <div style={styles.progressBarTrack}>
          <div
            style={{
              ...styles.progressBarFill,
              width: `${weekRate}%`,
            }}
          />
        </div>
        <span style={styles.progressText}>{weekRate}%</span>
      </div>

      {/* 日历网格 */}
      <div style={styles.grid}>
        {week.days.map((day, dayIndex) => {
          const colors = getTypeColors(day.type);
          const dateStr = getDayDate(plan.startDate, activeWeek, dayIndex);
          return (
            <button
              key={dayIndex}
              style={{
                ...styles.dayCard,
                backgroundColor: colors.bg,
                borderColor: colors.border,
              }}
              onClick={() =>
                day.type !== "休息" &&
                setModalDay({ weekIndex: activeWeek, dayIndex, day })
              }
            >
              <div style={styles.dayHeader}>
                <span style={styles.dayName}>{WEEK_DAYS[dayIndex]}</span>
                <span style={styles.dayDate}>{dateStr}</span>
              </div>
              <div style={{ ...styles.dayType, color: colors.text }}>
                {day.type}
              </div>
              <div style={styles.dayBody}>
                {day.distance > 0 && (
                  <span style={styles.dayDistance}>{day.distance}km</span>
                )}
                <span style={styles.dayPace}>{day.pace}</span>
              </div>
              <div style={styles.dayFooter}>
                <StatusIcon status={day.status} />
                {day.actualDistance != null && (
                  <span style={styles.actualTag}>实{day.actualDistance}km</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 编辑模态框 */}
      {modalDay && (
        <div style={styles.modalOverlay} onClick={() => setModalDay(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>
              {modalDay.day.type} {modalDay.day.distance}km
            </h3>
            <p style={styles.modalSubtitle}>
              目标配速: {modalDay.day.pace} · 预计时长: {modalDay.day.duration}
            </p>

            <form id="track-form" style={styles.form}>
              <div style={styles.formRow}>
                <label style={styles.label}>实际距离 (km)</label>
                <input
                  name="actualDistance"
                  type="number"
                  step="0.1"
                  defaultValue={modalDay.day.actualDistance ?? ""}
                  style={styles.input}
                  placeholder={String(modalDay.day.distance)}
                />
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>实际配速</label>
                <input
                  name="actualPace"
                  type="text"
                  defaultValue={modalDay.day.actualPace ?? ""}
                  style={styles.input}
                  placeholder={modalDay.day.pace}
                />
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>实际时长</label>
                <input
                  name="actualDuration"
                  type="text"
                  defaultValue={modalDay.day.actualDuration ?? ""}
                  style={styles.input}
                  placeholder={modalDay.day.duration}
                />
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>平均心率</label>
                <input
                  name="actualHr"
                  type="number"
                  defaultValue={modalDay.day.actualHr ?? ""}
                  style={styles.input}
                />
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>体感</label>
                <input
                  name="feeling"
                  type="text"
                  defaultValue={modalDay.day.feeling ?? ""}
                  style={styles.input}
                  placeholder="轻松 / 舒适 / 有点累 / 很累"
                />
              </div>
            </form>

            <div style={styles.modalActions}>
              <button
                style={{ ...styles.actionBtn, ...styles.completeBtn }}
                onClick={() => handleTrack("completed")}
                disabled={loading}
              >
                {loading ? "..." : "✓ 完成"}
              </button>
              <button
                style={{ ...styles.actionBtn, ...styles.partialBtn }}
                onClick={() => handleTrack("partial")}
                disabled={loading}
              >
                ◐ 部分完成
              </button>
              <button
                style={{ ...styles.actionBtn, ...styles.skipBtn }}
                onClick={() => handleTrack("skipped")}
                disabled={loading}
              >
                ✗ 跳过
              </button>
              <button
                style={{ ...styles.actionBtn, ...styles.cancelBtn }}
                onClick={() => setModalDay(null)}
                disabled={loading}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  weekHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 0",
  },
  weekBtn: {
    padding: "6px 12px",
    background: "var(--bg-tertiary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    fontSize: "14px",
    cursor: "pointer",
    minHeight: "36px",
    fontFamily: "'Courier New', monospace",
  },
  weekInfo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
  },
  weekTitle: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "var(--accent)",
    fontFamily: "'Courier New', monospace",
  },
  weekPhase: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    fontFamily: "'Courier New', monospace",
  },
  progressBarContainer: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  progressBarTrack: {
    flex: 1,
    height: "12px",
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "2px",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    background: "var(--accent)",
    transition: "width 0.3s ease",
  },
  progressText: {
    fontSize: "12px",
    color: "var(--accent)",
    fontWeight: "bold",
    fontFamily: "'Courier New', monospace",
    minWidth: "36px",
    textAlign: "right",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "6px",
  },
  dayCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "8px 4px",
    gap: "4px",
    cursor: "pointer",
    minHeight: "80px",
    background: "transparent",
    fontFamily: "'Courier New', monospace",
    border: "2px solid transparent",
    borderRadius: "4px",
  },
  dayHeader: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1px",
  },
  dayName: {
    fontSize: "11px",
    color: "var(--text-secondary)",
  },
  dayDate: {
    fontSize: "10px",
    color: "var(--text-secondary)",
    opacity: 0.7,
  },
  dayType: {
    fontSize: "12px",
    fontWeight: "bold",
    textAlign: "center",
  },
  dayBody: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1px",
  },
  dayDistance: {
    fontSize: "11px",
    color: "var(--text-primary)",
  },
  dayPace: {
    fontSize: "10px",
    color: "var(--text-secondary)",
  },
  dayFooter: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    marginTop: "auto",
  },
  actualTag: {
    fontSize: "9px",
    color: "var(--accent)",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10000,
    padding: "16px",
  },
  modal: {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    padding: "20px",
    width: "100%",
    maxWidth: "360px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  modalTitle: {
    fontSize: "16px",
    fontWeight: "bold",
    color: "var(--accent)",
    margin: 0,
    fontFamily: "'Courier New', monospace",
  },
  modalSubtitle: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    margin: 0,
    fontFamily: "'Courier New', monospace",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  formRow: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  label: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    fontFamily: "'Courier New', monospace",
  },
  input: {
    padding: "8px 10px",
    fontSize: "13px",
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    fontFamily: "'Courier New', monospace",
  },
  modalActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    marginTop: "4px",
  },
  actionBtn: {
    padding: "10px",
    fontSize: "13px",
    fontWeight: "bold",
    borderRadius: "4px",
    cursor: "pointer",
    fontFamily: "'Courier New', monospace",
    minHeight: "44px",
    border: "1px solid var(--border)",
  },
  completeBtn: {
    background: "rgba(34, 197, 94, 0.15)",
    color: "#22c55e",
    borderColor: "rgba(34, 197, 94, 0.4)",
  },
  partialBtn: {
    background: "rgba(249, 115, 22, 0.15)",
    color: "var(--accent)",
    borderColor: "rgba(249, 115, 22, 0.4)",
  },
  skipBtn: {
    background: "rgba(239, 68, 68, 0.15)",
    color: "#ef4444",
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  cancelBtn: {
    background: "var(--bg-tertiary)",
    color: "var(--text-secondary)",
  },
};
