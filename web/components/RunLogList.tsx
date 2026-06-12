"use client";

import { useState, useEffect } from "react";

interface RunLog {
  date: string;
  distance: number;
  pace: string;
  hr?: number;
  feeling: string;
  notes?: string;
}

export default function RunLogList() {
  const [runs, setRuns] = useState<RunLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    distance: "",
    pace: "",
    hr: "",
    feeling: "",
    notes: "",
  });

  const fetchRuns = async () => {
    try {
      setError("");
      const res = await fetch("/api/runs");
      const data = await res.json();
      if (data.success) {
        setRuns(data.runs || []);
      } else {
        setError(data.error || "获取记录失败");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "网络错误";
      setError(msg);
      console.error("获取记录失败:", err);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const addRun = async () => {
    if (!form.distance || !form.feeling) return;
    setLoading(true);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          distance: Number(form.distance),
          pace: form.pace,
          hr: form.hr ? Number(form.hr) : undefined,
          feeling: form.feeling,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRuns((prev) => [data.run, ...prev]);
        setForm({ distance: "", pace: "", hr: "", feeling: "", notes: "" });
      }
    } catch (err) {
      console.error("添加记录失败:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>📊 训练记录</h3>

      {/* 添加表单 */}
      <div style={styles.form}>
        <input
          style={styles.input}
          placeholder="距离 (km)"
          type="number"
          value={form.distance}
          onChange={(e) => setForm({ ...form, distance: e.target.value })}
        />
        <input
          style={styles.input}
          placeholder="配速 (如 5:40)"
          value={form.pace}
          onChange={(e) => setForm({ ...form, pace: e.target.value })}
        />
        <input
          style={styles.input}
          placeholder="心率 (可选)"
          type="number"
          value={form.hr}
          onChange={(e) => setForm({ ...form, hr: e.target.value })}
        />
        <input
          style={styles.input}
          placeholder="感受"
          value={form.feeling}
          onChange={(e) => setForm({ ...form, feeling: e.target.value })}
        />
        <input
          style={styles.input}
          placeholder="备注 (可选)"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <button
          style={{
            ...styles.button,
            ...(loading ? styles.buttonDisabled : {}),
          }}
          onClick={addRun}
          disabled={loading}
        >
          {loading ? "..." : "➕ 添加"}
        </button>
      </div>

      {/* 记录列表 */}
      <div style={styles.list}>
        {error && (
          <p style={styles.error}>❌ {error}</p>
        )}
        {!error && runs.length === 0 && (
          <p style={styles.empty}>暂无记录</p>
        )}
        {runs.map((run, i) => (
          <div key={i} style={styles.runItem}>
            <div style={styles.runHeader}>
              <span style={styles.runDate}>{run.date}</span>
              <span style={styles.runDistance}>{run.distance}km</span>
            </div>
            <div style={styles.runDetails}>
              {run.pace && run.pace !== "-" && (
                <span style={styles.runBadge}>⏱ {run.pace}</span>
              )}
              {run.hr && (
                <span style={styles.runBadge}>❤️ {run.hr}</span>
              )}
              <span style={styles.runBadge}>😊 {run.feeling}</span>
            </div>
            {run.notes && (
              <p style={styles.runNotes}>{run.notes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "16px",
  },
  title: {
    color: "var(--accent)",
    fontSize: "16px",
    marginBottom: "12px",
    borderBottom: "1px solid var(--border)",
    paddingBottom: "8px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "16px",
  },
  input: {
    fontSize: "14px",
    padding: "10px 12px",
    minHeight: "44px",
  },
  button: {
    padding: "10px",
    background: "var(--accent)",
    color: "var(--bg-primary)",
    borderRadius: "4px",
    fontSize: "14px",
    fontWeight: "bold",
    minHeight: "44px",
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  error: {
    color: "var(--error)",
    fontSize: "14px",
    textAlign: "center",
    padding: "12px",
    background: "rgba(239, 68, 68, 0.1)",
    borderRadius: "4px",
  },
  empty: {
    color: "var(--text-secondary)",
    fontSize: "14px",
    textAlign: "center",
    padding: "20px",
  },
  runItem: {
    padding: "12px",
    background: "var(--bg-secondary)",
    borderRadius: "6px",
    border: "1px solid var(--border)",
  },
  runHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "6px",
  },
  runDate: {
    fontSize: "14px",
    color: "var(--text-secondary)",
  },
  runDistance: {
    fontSize: "16px",
    fontWeight: "bold",
    color: "var(--accent)",
  },
  runDetails: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  },
  runBadge: {
    fontSize: "12px",
    padding: "4px 8px",
    background: "var(--bg-tertiary)",
    borderRadius: "3px",
    color: "var(--text-secondary)",
  },
  runNotes: {
    fontSize: "14px",
    color: "var(--text-secondary)",
    marginTop: "4px",
    fontStyle: "italic",
  },
};
