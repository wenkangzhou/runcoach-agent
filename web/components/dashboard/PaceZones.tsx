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

interface PaceZonesProps {
  runs: RunLog[];
}

/** 配速区间分类 */
type ZoneType = "E" | "T" | "I" | "R" | "未知";

interface ZoneInfo {
  type: ZoneType;
  label: string;
  color: string;
  description: string;
}

const ZONE_CONFIG: Record<ZoneType, ZoneInfo> = {
  E: { type: "E", label: "轻松跑 E", color: "#22c55e", description: "有氧基础" },
  T: { type: "T", label: "节奏跑 T", color: "#eab308", description: "乳酸阈值" },
  I: { type: "I", label: "间歇跑 I", color: "#ef4444", description: "VO2max" },
  R: { type: "R", label: "重复跑 R", color: "#f97316", description: "速度训练" },
  "未知": { type: "未知", label: "未分类", color: "#71717a", description: "数据不足" },
};

/**
 * 配速区间分布 - 像素风饼图（CSS conic-gradient）
 * 基于心率/配速自动分类（E/T/I/R）
 */
export default function PaceZones({ runs }: PaceZonesProps) {
  const zoneData = useMemo(() => {
    if (!runs || runs.length === 0) return [];

    const zones: Record<ZoneType, number> = { E: 0, T: 0, I: 0, R: 0, "未知": 0 };

    runs.forEach((run) => {
      const zone = classifyRun(run);
      zones[zone] += run.distance;
    });

    const total = Object.values(zones).reduce((a, b) => a + b, 0);
    if (total === 0) return [];

    let currentAngle = 0;
    return (Object.entries(zones) as [ZoneType, number][])
      .filter(([, dist]) => dist > 0)
      .map(([type, distance]) => {
        const percentage = (distance / total) * 100;
        const angle = (distance / total) * 360;
        const startAngle = currentAngle;
        currentAngle += angle;
        return {
          type,
          distance,
          percentage: Math.round(percentage * 10) / 10,
          startAngle,
          endAngle: currentAngle,
          color: ZONE_CONFIG[type].color,
          label: ZONE_CONFIG[type].label,
          description: ZONE_CONFIG[type].description,
        };
      });
  }, [runs]);

  if (zoneData.length === 0) {
    return (
      <div style={styles.empty}>
        <p>暂无数据</p>
      </div>
    );
  }

  // 构建 conic-gradient
  const gradientStops = zoneData
    .map((z) => `${z.color} ${z.startAngle}deg ${z.endAngle}deg`)
    .join(", ");

  const pieStyle: React.CSSProperties = {
    width: "120px",
    height: "120px",
    borderRadius: "50%",
    background: `conic-gradient(${gradientStops})`,
    imageRendering: "pixelated",
    boxShadow: "0 0 0 3px var(--border), inset 0 0 0 2px var(--bg-secondary)",
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>配速区间分布</span>
      </div>

      <div style={styles.content}>
        {/* 像素风饼图 */}
        <div style={styles.pieWrapper}>
          <div style={pieStyle} />
          {/* 中心空洞（甜甜圈效果） */}
          <div style={styles.pieCenter}>
            <span style={styles.pieCenterText}>{runs.length}次</span>
          </div>
        </div>

        {/* 图例 */}
        <div style={styles.legend}>
          {zoneData.map((zone) => (
            <div key={zone.type} style={styles.legendItem}>
              <div
                style={{
                  ...styles.legendColor,
                  background: zone.color,
                }}
              />
              <div style={styles.legendInfo}>
                <span style={styles.legendLabel}>{zone.label}</span>
                <span style={styles.legendValue}>
                  {Math.round(zone.distance * 10) / 10}km ({zone.percentage}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 基于配速和心率自动分类训练区间
 * 简化版 Jack Daniels 分类
 */
function classifyRun(run: RunLog): ZoneType {
  // 优先使用心率
  if (run.hr && run.hr > 0) {
    if (run.hr >= 170) return "I";
    if (run.hr >= 160) return "T";
    if (run.hr >= 150) return "E";
    return "R"; // 心率低但跑了，可能是恢复跑
  }

  // 回退到配速分类（基于常见配速区间）
  const paceSec = parsePace(run.pace);
  if (paceSec === 0) return "未知";

  if (paceSec <= 240) return "R";      // < 4:00
  if (paceSec <= 270) return "I";      // 4:00-4:30
  if (paceSec <= 300) return "T";      // 4:30-5:00
  if (paceSec <= 360) return "E";      // 5:00-6:00
  return "R";                          // > 6:00 恢复跑
}

function parsePace(pace: string): number {
  const match = pace.match(/(\d+)[：:](\d+)/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
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
  content: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
    flexWrap: "wrap",
  },
  pieWrapper: {
    position: "relative",
    width: "120px",
    height: "120px",
    flexShrink: 0,
  },
  pieCenter: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    background: "var(--bg-secondary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  pieCenterText: {
    fontSize: "12px",
    fontWeight: "bold",
    color: "var(--text-primary)",
  },
  legend: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    flex: 1,
    minWidth: "140px",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  legendColor: {
    width: "12px",
    height: "12px",
    borderRadius: "2px",
    flexShrink: 0,
  },
  legendInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  legendLabel: {
    fontSize: "12px",
    color: "var(--text-primary)",
    fontWeight: "bold",
  },
  legendValue: {
    fontSize: "11px",
    color: "var(--text-secondary)",
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
