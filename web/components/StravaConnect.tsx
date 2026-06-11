/**
 * Strava 连接组件
 * 显示连接状态、同步按钮
 */

"use client";

import { useState, useEffect } from "react";

interface StravaStatus {
  connected: boolean;
  athleteName?: string;
  profileImage?: string;
  lastSyncAt?: string;
  totalActivities?: number;
}

export default function StravaConnect() {
  const [status, setStatus] = useState<StravaStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    try {
      const res = await fetch("/api/strava/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // 静默失败
    }
  }

  async function handleSync() {
    setSyncing(true);
    setMessage("");
    try {
      const res = await fetch("/api/strava/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ ${data.message}`);
        // 刷新页面以显示新数据
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setMessage(`❌ ${data.error || "同步失败"}`);
      }
    } catch {
      setMessage("❌ 网络错误");
    } finally {
      setSyncing(false);
    }
  }

  function handleConnect() {
    setLoading(true);
    window.location.href = "/api/strava/auth";
  }

  function handleDisconnect() {
    // 简化版：刷新页面后状态会重置（因为 token 在 Redis 中）
    // 实际应该调用断开 API
    setMessage("请重新连接以更新");
  }

  if (!status) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>检查 Strava 连接...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {status.connected ? (
        <div style={styles.connected}>
          <div style={styles.header}>
            {status.profileImage && (
              <img
                src={status.profileImage}
                alt={status.athleteName}
                style={styles.avatar}
              />
            )}
            <div style={styles.info}>
              <div style={styles.name}>{status.athleteName}</div>
              <div style={styles.meta}>
                {status.totalActivities != null
                  ? `${status.totalActivities} 条记录`
                  : "未同步"}
                {status.lastSyncAt && (
                  <span> · 上次同步 {formatTime(status.lastSyncAt)}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              ...styles.button,
              ...(syncing ? styles.buttonDisabled : styles.buttonPrimary),
            }}
          >
            {syncing ? "同步中..." : "🔄 同步 Strava 数据"}
          </button>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          disabled={loading}
          style={{
            ...styles.button,
            ...(loading ? styles.buttonDisabled : styles.buttonStrava),
          }}
        >
          {loading ? "跳转中..." : "🔗 连接 Strava"}
        </button>
      )}
      {message && <div style={styles.message}>{message}</div>}
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "未知时间";
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diff < 1) return "刚刚";
  if (diff < 60) return `${diff} 分钟前`;
  if (diff < 1440) return `${Math.floor(diff / 60)} 小时前`;
  return `${Math.floor(diff / 1440)} 天前`;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "12px 16px",
    borderBottom: "1px solid var(--border)",
  },
  loading: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    textAlign: "center",
  },
  connected: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  avatar: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    border: "2px solid var(--accent)",
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: "13px",
    fontWeight: "bold",
    color: "var(--text-primary)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  meta: {
    fontSize: "11px",
    color: "var(--text-secondary)",
  },
  button: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: "6px",
    border: "none",
    fontSize: "12px",
    fontWeight: "bold",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "opacity 0.2s",
  },
  buttonPrimary: {
    background: "var(--accent)",
    color: "#000",
  },
  buttonStrava: {
    background: "#fc4c02",
    color: "#fff",
  },
  buttonDisabled: {
    background: "var(--border)",
    color: "var(--text-secondary)",
    cursor: "not-allowed",
  },
  message: {
    fontSize: "11px",
    marginTop: "6px",
    textAlign: "center",
  },
};
