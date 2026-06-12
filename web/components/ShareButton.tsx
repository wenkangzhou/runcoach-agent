"use client";

import { useState, useCallback } from "react";
import SharePoster from "./SharePoster";
import type { PosterData } from "@/app/api/share/poster/route";

/**
 * 分享按钮组件
 * 点击后弹出模态框展示海报预览
 */
export default function ShareButton() {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [posterData, setPosterData] = useState<PosterData | null>(null);
  const [error, setError] = useState("");

  const fetchPosterData = useCallback(async (weeks: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/share/poster?weeks=${weeks}`);
      const data = await res.json();
      if (data.success && data.data) {
        setPosterData(data.data);
        setShowModal(true);
      } else {
        setError(data.error || "获取海报数据失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <>
      <div style={styles.container}>
        <button
          style={styles.mainBtn}
          onClick={() => fetchPosterData("1")}
          disabled={loading}
        >
          {loading ? "⏳ 加载中..." : "📤 生成分享海报"}
        </button>
        <div style={styles.dropdown}>
          <button
            style={styles.dropBtn}
            onClick={() => fetchPosterData("1")}
            disabled={loading}
          >
            本周周报
          </button>
          <button
            style={styles.dropBtn}
            onClick={() => fetchPosterData("4")}
            disabled={loading}
          >
            最近 4 周
          </button>
          <button
            style={styles.dropBtn}
            onClick={() => fetchPosterData("all")}
            disabled={loading}
          >
            全部记录
          </button>
        </div>
        {error && <span style={styles.error}>{error}</span>}
      </div>

      {showModal && posterData && (
        <SharePoster data={posterData} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "relative",
    display: "inline-block",
  },
  mainBtn: {
    padding: "8px 16px",
    background: "var(--accent)",
    color: "var(--bg-primary)",
    borderRadius: "4px",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer",
    fontFamily: "'Courier New', monospace",
    minHeight: "44px",
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    marginTop: "4px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    background: "var(--bg-secondary)",
    border: "2px solid var(--border)",
    borderRadius: "4px",
    padding: "4px",
    zIndex: 100,
    minWidth: "120px",
  },
  dropBtn: {
    padding: "8px 12px",
    background: "transparent",
    color: "var(--text-primary)",
    fontSize: "12px",
    textAlign: "left",
    cursor: "pointer",
    borderRadius: "2px",
    fontFamily: "'Courier New', monospace",
    minHeight: "36px",
  },
  error: {
    fontSize: "11px",
    color: "var(--error)",
    marginTop: "4px",
  },
};
