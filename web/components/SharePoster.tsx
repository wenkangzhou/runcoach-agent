"use client";

import { useRef, useCallback, useState } from "react";
import { toPng } from "html-to-image";
import type { PosterData } from "@/app/api/share/poster/route";

interface SharePosterProps {
  data: PosterData;
  onClose: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  轻松跑: "#22c55e",
  间歇跑: "#ef4444",
  长距离: "#3b82f6",
  节奏跑: "#eab308",
  恢复跑: "#a855f7",
  其他: "#71717a",
};

/**
 * 像素风分享海报组件
 * 固定尺寸 1200x630，使用 html-to-image 导出 PNG
 */
export default function SharePoster({ data, onClose }: SharePosterProps) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [copying, setCopying] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!posterRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(posterRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `runcoach-poster-${data.period}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("导出海报失败:", err);
      alert("导出失败，请重试");
    } finally {
      setDownloading(false);
    }
  }, [data.period]);

  const handleCopy = useCallback(async () => {
    if (!posterRef.current) return;
    setCopying(true);
    try {
      const dataUrl = await toPng(posterRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      alert("海报已复制到剪贴板");
    } catch (err) {
      console.error("复制海报失败:", err);
      alert("复制失败，请使用下载功能");
    } finally {
      setCopying(false);
    }
  }, []);

  const handleCopyText = useCallback(() => {
    const text = `${data.title}
🏃 跑蓝 RunCoach

📊 数据统计
• 总跑量: ${data.totalDistance} km
• 平均配速: ${data.avgPace} /km
• 训练次数: ${data.runsCount} 次
• 总时长: ${data.totalDuration} 分钟
• 最长单次: ${data.longestRun} km
• 休息天数: ${data.restDays} 天

💬 AI 点评
${data.comment}

${data.appUrl}`;
    navigator.clipboard.writeText(text).then(
      () => alert("文字版周报已复制"),
      () => alert("复制失败")
    );
  }, [data]);

  const typeEntries = Object.entries(data.typeDistribution);
  const maxTypeValue = typeEntries.length > 0
    ? Math.max(...typeEntries.map(([, v]) => v))
    : 1;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* 海报预览区域 */}
        <div style={styles.previewArea}>
          <div ref={posterRef} style={styles.poster}>
            {/* 顶部：Logo + 标题 */}
            <div style={styles.header}>
              <div style={styles.logoRow}>
                <span style={styles.logoIcon}>🏃</span>
                <span style={styles.logoText}>跑蓝 RunCoach</span>
              </div>
              <span style={styles.headerTitle}>{data.title}</span>
            </div>

            {/* 中间大数字 */}
            <div style={styles.statsRow}>
              <div style={styles.statBox}>
                <div style={styles.statValue}>{data.totalDistance}</div>
                <div style={styles.statUnit}>km</div>
                <div style={styles.statLabel}>总跑量</div>
              </div>
              <div style={styles.statBox}>
                <div style={styles.statValue}>{data.avgPace}</div>
                <div style={styles.statUnit}>/km</div>
                <div style={styles.statLabel}>平均配速</div>
              </div>
              <div style={styles.statBox}>
                <div style={styles.statValue}>{data.runsCount}</div>
                <div style={styles.statUnit}>次</div>
                <div style={styles.statLabel}>训练次数</div>
              </div>
            </div>

            {/* 训练类型分布 */}
            {typeEntries.length > 0 && (
              <div style={styles.typesSection}>
                <div style={styles.typesTitle}>训练类型分布</div>
                <div style={styles.typesGrid}>
                  {typeEntries.map(([type, distance]) => {
                    const blocks = Math.max(1, Math.round((distance / maxTypeValue) * 8));
                    return (
                      <div key={type} style={styles.typeItem}>
                        <div style={styles.typeBlocks}>
                          {Array.from({ length: 8 }).map((_, i) => (
                            <div
                              key={i}
                              style={{
                                ...styles.typeBlock,
                                background: i < blocks ? (TYPE_COLORS[type] || "#71717a") : "#3f3f46",
                              }}
                            />
                          ))}
                        </div>
                        <span style={styles.typeLabel}>{type}</span>
                        <span style={styles.typeValue}>{Math.round(distance * 10) / 10}km</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AI 点评 */}
            <div style={styles.commentSection}>
              <div style={styles.commentQuote}>"</div>
              <div style={styles.commentText}>{data.comment}</div>
            </div>

            {/* 底部 */}
            <div style={styles.footer}>
              <span style={styles.footerText}>{data.appUrl}</span>
              <span style={styles.footerDate}>
                {new Date(data.generatedAt).toLocaleDateString("zh-CN")}
              </span>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div style={styles.actions}>
          <button
            style={styles.actionBtn}
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? "⏳ 导出中..." : "📥 下载 PNG"}
          </button>
          <button
            style={styles.actionBtn}
            onClick={handleCopy}
            disabled={copying}
          >
            {copying ? "⏳ 复制中..." : "📋 复制图片"}
          </button>
          <button style={styles.actionBtn} onClick={handleCopyText}>
            📝 复制文字版
          </button>
          <button style={{ ...styles.actionBtn, ...styles.closeBtn }} onClick={onClose}>
            ❌ 关闭
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "rgba(0, 0, 0, 0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10000,
    padding: "20px",
  },
  modal: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    maxWidth: "90vw",
    maxHeight: "90vh",
  },
  previewArea: {
    display: "flex",
    justifyContent: "center",
    overflow: "auto",
  },
  poster: {
    width: "1200px",
    height: "630px",
    background: "#18181b",
    color: "#f4f4f5",
    fontFamily: "'Courier New', 'SF Mono', 'Fira Code', monospace",
    display: "flex",
    flexDirection: "column",
    padding: "48px 56px",
    gap: "32px",
    boxSizing: "border-box",
    flexShrink: 0,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "2px solid #3f3f46",
    paddingBottom: "16px",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  logoIcon: {
    fontSize: "32px",
  },
  logoText: {
    fontSize: "24px",
    fontWeight: "bold",
    color: "#f97316",
  },
  headerTitle: {
    fontSize: "20px",
    color: "#a1a1aa",
  },
  statsRow: {
    display: "flex",
    justifyContent: "center",
    gap: "48px",
    flex: 1,
    alignItems: "center",
  },
  statBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    padding: "24px 32px",
    border: "2px solid #3f3f46",
    borderRadius: "4px",
    minWidth: "160px",
  },
  statValue: {
    fontSize: "56px",
    fontWeight: "bold",
    color: "#f97316",
    lineHeight: 1,
  },
  statUnit: {
    fontSize: "18px",
    color: "#a1a1aa",
  },
  statLabel: {
    fontSize: "14px",
    color: "#71717a",
    marginTop: "4px",
  },
  typesSection: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  typesTitle: {
    fontSize: "14px",
    color: "#a1a1aa",
    fontWeight: "bold",
  },
  typesGrid: {
    display: "flex",
    gap: "32px",
    flexWrap: "wrap",
  },
  typeItem: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  typeBlocks: {
    display: "flex",
    gap: "3px",
  },
  typeBlock: {
    width: "16px",
    height: "16px",
    borderRadius: "2px",
  },
  typeLabel: {
    fontSize: "12px",
    color: "#a1a1aa",
  },
  typeValue: {
    fontSize: "12px",
    color: "#f4f4f5",
    fontWeight: "bold",
  },
  commentSection: {
    display: "flex",
    gap: "8px",
    alignItems: "flex-start",
    background: "#27272a",
    padding: "16px 20px",
    borderRadius: "4px",
    border: "2px solid #3f3f46",
  },
  commentQuote: {
    fontSize: "32px",
    color: "#f97316",
    lineHeight: 1,
    fontFamily: "serif",
  },
  commentText: {
    fontSize: "18px",
    color: "#f4f4f5",
    lineHeight: 1.5,
    flex: 1,
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: "2px solid #3f3f46",
    paddingTop: "12px",
  },
  footerText: {
    fontSize: "14px",
    color: "#71717a",
  },
  footerDate: {
    fontSize: "12px",
    color: "#52525b",
  },
  actions: {
    display: "flex",
    gap: "8px",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  actionBtn: {
    padding: "10px 20px",
    background: "#27272a",
    color: "#f4f4f5",
    border: "2px solid #3f3f46",
    borderRadius: "4px",
    fontSize: "14px",
    fontWeight: "bold",
    cursor: "pointer",
    fontFamily: "'Courier New', monospace",
    minHeight: "44px",
  },
  closeBtn: {
    background: "#3f3f46",
    color: "#a1a1aa",
  },
};
