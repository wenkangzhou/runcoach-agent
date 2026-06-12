"use client";

import { useState } from "react";

interface PhaseAssessment {
  distance: number;
  pace: string;
  assessment: string;
}

interface RunAnalysis {
  quality: number;
  fatigue: number;
  structure: {
    warmup: PhaseAssessment;
    main: PhaseAssessment;
    cooldown: PhaseAssessment;
  };
  highlights: string[];
  concerns: string[];
  suggestions: string[];
  comparison: string;
}

interface ClassificationInfo {
  category: string;
  paceZone: string | null;
  confidence: number;
  reasons: string[];
}

interface RunInfo {
  date: string;
  name: string;
  distance: number;
  pace: string;
  hr?: number;
}

interface RunAnalysisProps {
  run?: RunInfo;
  classification?: ClassificationInfo;
  analysis?: RunAnalysis;
  loading?: boolean;
  error?: string;
}

/**
 * 单次训练分析展示组件
 * 像素风样式，与现有 UI 一致
 */
export default function RunAnalysis({
  run,
  classification,
  analysis,
  loading,
  error,
}: RunAnalysisProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "structure" | "suggestions">("overview");

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>⏳ 分析中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>❌ {error}</div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>选择一次训练以查看 AI 分析</div>
      </div>
    );
  }

  const { quality, fatigue, structure, highlights, concerns, suggestions, comparison } = analysis;

  // 质量评分颜色
  const qualityColor = quality >= 8 ? "var(--success)" : quality >= 5 ? "var(--warning)" : "var(--error)";
  const qualityLabel = quality >= 8 ? "优秀" : quality >= 6 ? "良好" : quality >= 4 ? "一般" : "需改进";

  // 疲劳度颜色
  const fatigueColor = fatigue >= 8 ? "var(--error)" : fatigue >= 5 ? "var(--warning)" : "var(--success)";

  return (
    <div style={styles.container}>
      {/* 头部 */}
      <div style={styles.header}>
        <span style={styles.title}>🧠 AI 训练分析</span>
        {run && (
          <span style={styles.subtitle}>
            {run.date} · {run.name} · {run.distance}km
          </span>
        )}
      </div>

      {/* 标签切换 */}
      <div style={styles.tabs}>
        {(["overview", "structure", "suggestions"] as const).map((tab) => (
          <button
            key={tab}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "overview" ? "总览" : tab === "structure" ? "结构" : "建议"}
          </button>
        ))}
      </div>

      {/* 总览页 */}
      {activeTab === "overview" && (
        <div style={styles.panel}>
          {/* 评分卡片 */}
          <div style={styles.scoreGrid}>
            <div style={styles.scoreCard}>
              <div style={styles.scoreLabel}>质量评分</div>
              <div style={{ ...styles.scoreValue, color: qualityColor }}>{quality}</div>
              <div style={{ ...styles.scoreSub, color: qualityColor }}>{qualityLabel}</div>
            </div>
            <div style={styles.scoreCard}>
              <div style={styles.scoreLabel}>疲劳度</div>
              <div style={{ ...styles.scoreValue, color: fatigueColor }}>{fatigue}</div>
              <div style={{ ...styles.scoreSub, color: fatigueColor }}>/ 10</div>
            </div>
            {classification && (
              <div style={styles.scoreCard}>
                <div style={styles.scoreLabel}>训练类型</div>
                <div style={{ ...styles.scoreValue, fontSize: "16px" }}>{classification.category}</div>
                <div style={styles.scoreSub}>置信度 {Math.round(classification.confidence * 100)}%</div>
              </div>
            )}
          </div>

          {/* 对比 */}
          <div style={styles.comparisonBox}>
            <div style={styles.comparisonTitle}>📊 与近期对比</div>
            <p style={styles.comparisonText}>{comparison}</p>
          </div>

          {/* 亮点 */}
          {highlights.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>✨ 亮点</div>
              {highlights.map((h, i) => (
                <div key={i} style={styles.highlightItem}>▸ {h}</div>
              ))}
            </div>
          )}

          {/* 注意事项 */}
          {concerns.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>⚠️ 注意事项</div>
              {concerns.map((c, i) => (
                <div key={i} style={styles.concernItem}>▸ {c}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 结构页 */}
      {activeTab === "structure" && (
        <div style={styles.panel}>
          <div style={styles.structureGrid}>
            <PhaseCard label="🔥 热身" phase={structure.warmup} color="#f97316" />
            <PhaseCard label="⚡ 主课" phase={structure.main} color="#22c55e" />
            <PhaseCard label="🧊 放松" phase={structure.cooldown} color="#3b82f6" />
          </div>

          {classification && classification.reasons.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>🎯 分类依据</div>
              {classification.reasons.map((r, i) => (
                <div key={i} style={styles.reasonItem}>▸ {r}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 建议页 */}
      {activeTab === "suggestions" && (
        <div style={styles.panel}>
          {suggestions.length > 0 ? (
            <div style={styles.suggestionList}>
              {suggestions.map((s, i) => (
                <div key={i} style={styles.suggestionCard}>
                  <div style={styles.suggestionNum}>{String(i + 1).padStart(2, "0")}</div>
                  <div style={styles.suggestionText}>{s}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.empty}>暂无建议</div>
          )}
        </div>
      )}
    </div>
  );
}

/** 阶段卡片子组件 */
function PhaseCard({
  label,
  phase,
  color,
}: {
  label: string;
  phase: PhaseAssessment;
  color: string;
}) {
  const hasData = phase.distance > 0;
  return (
    <div style={{ ...styles.phaseCard, borderColor: color }}>
      <div style={{ ...styles.phaseLabel, color }}>{label}</div>
      {hasData ? (
        <>
          <div style={styles.phaseValue}>{phase.distance} km</div>
          <div style={styles.phasePace}>{phase.pace} /km</div>
          <div style={styles.phaseAssessment}>{phase.assessment}</div>
        </>
      ) : (
        <div style={styles.phaseEmpty}>未检测到</div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "16px",
    background: "var(--bg-secondary)",
    border: "2px solid var(--border)",
    borderRadius: "4px",
    minHeight: "300px",
  },
  header: {
    marginBottom: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  title: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "var(--accent)",
  },
  subtitle: {
    fontSize: "12px",
    color: "var(--text-secondary)",
  },
  tabs: {
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
  },
  tab: {
    padding: "6px 14px",
    background: "var(--bg-primary)",
    color: "var(--text-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    fontSize: "12px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  tabActive: {
    background: "var(--accent)",
    color: "var(--bg-primary)",
    borderColor: "var(--accent)",
    fontWeight: "bold",
  },
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  scoreGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "12px",
  },
  scoreCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "14px 10px",
    background: "var(--bg-primary)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    gap: "4px",
  },
  scoreLabel: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  scoreValue: {
    fontSize: "28px",
    fontWeight: "bold",
    fontFamily: "'Courier New', monospace",
  },
  scoreSub: {
    fontSize: "11px",
  },
  comparisonBox: {
    padding: "12px",
    background: "var(--bg-primary)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
  },
  comparisonTitle: {
    fontSize: "12px",
    color: "var(--accent)",
    marginBottom: "6px",
    fontWeight: "bold",
  },
  comparisonText: {
    fontSize: "13px",
    color: "var(--text-secondary)",
    lineHeight: 1.6,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  sectionTitle: {
    fontSize: "12px",
    fontWeight: "bold",
    color: "var(--text-primary)",
    marginBottom: "4px",
  },
  highlightItem: {
    fontSize: "13px",
    color: "var(--success)",
    padding: "6px 10px",
    background: "rgba(34, 197, 94, 0.08)",
    borderRadius: "3px",
    borderLeft: "3px solid var(--success)",
  },
  concernItem: {
    fontSize: "13px",
    color: "var(--warning)",
    padding: "6px 10px",
    background: "rgba(234, 179, 8, 0.08)",
    borderRadius: "3px",
    borderLeft: "3px solid var(--warning)",
  },
  reasonItem: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    padding: "4px 0",
  },
  structureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: "12px",
  },
  phaseCard: {
    display: "flex",
    flexDirection: "column",
    padding: "14px",
    background: "var(--bg-primary)",
    border: "2px solid",
    borderRadius: "4px",
    gap: "6px",
  },
  phaseLabel: {
    fontSize: "12px",
    fontWeight: "bold",
  },
  phaseValue: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "var(--text-primary)",
    fontFamily: "'Courier New', monospace",
  },
  phasePace: {
    fontSize: "13px",
    color: "var(--text-secondary)",
    fontFamily: "'Courier New', monospace",
  },
  phaseAssessment: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    lineHeight: 1.5,
    marginTop: "4px",
  },
  phaseEmpty: {
    fontSize: "13px",
    color: "var(--text-secondary)",
    fontStyle: "italic",
  },
  suggestionList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  suggestionCard: {
    display: "flex",
    gap: "12px",
    padding: "12px",
    background: "var(--bg-primary)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    alignItems: "flex-start",
  },
  suggestionNum: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "var(--accent)",
    fontFamily: "'Courier New', monospace",
    minWidth: "24px",
  },
  suggestionText: {
    fontSize: "13px",
    color: "var(--text-primary)",
    lineHeight: 1.5,
  },
  loading: {
    textAlign: "center",
    padding: "40px",
    color: "var(--text-secondary)",
    fontSize: "14px",
  },
  error: {
    textAlign: "center",
    padding: "20px",
    color: "var(--error)",
    fontSize: "14px",
    background: "rgba(239, 68, 68, 0.1)",
    borderRadius: "4px",
  },
  empty: {
    textAlign: "center",
    padding: "40px",
    color: "var(--text-secondary)",
    fontSize: "14px",
  },
};
