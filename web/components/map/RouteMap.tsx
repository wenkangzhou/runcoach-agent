"use client";

import { useEffect, useRef, useState } from "react";
import type { RouteCluster } from "@/lib/map/cluster";

interface RouteMapProps {
  clusters: RouteCluster[];
}

/**
 * 路线聚类地图组件
 * 使用 Leaflet + CartoDB Dark Matter 底图
 * 像素风样式
 */
export default function RouteMap({ clusters }: RouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const [selectedCluster, setSelectedCluster] = useState<RouteCluster | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;
    if (clusters.length === 0) return;

    let isMounted = true;

    const initMap = async () => {
      const L = await import("leaflet");

      if (!isMounted || !mapRef.current) return;

      // 如果地图已初始化，先移除
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }

      // 计算地图中心（所有聚类的平均中心）
      const avgLat = clusters.reduce((s, c) => s + c.centerLat, 0) / clusters.length;
      const avgLng = clusters.reduce((s, c) => s + c.centerLng, 0) / clusters.length;

      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([avgLat, avgLng], 13);

      leafletMapRef.current = map;

      // CartoDB Dark Matter 底图（像素风深色）
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
          subdomains: "abcd",
        }
      ).addTo(map);

      // 添加聚类标记
      const maxCount = Math.max(...clusters.map((c) => c.count), 1);

      clusters.forEach((cluster) => {
        const intensity = cluster.count / maxCount;
        const radius = 8 + cluster.count * 4;
        const color = getHeatColor(intensity);

        const circle = L.circleMarker([cluster.centerLat, cluster.centerLng], {
          radius,
          fillColor: color,
          color: "#f97316",
          weight: 2,
          opacity: 0.8,
          fillOpacity: 0.6 + intensity * 0.3,
        }).addTo(map);

        // 弹出信息
        const popupContent = `
          <div style="font-family: 'Courier New', monospace; min-width: 180px;">
            <div style="font-weight: bold; color: #f97316; margin-bottom: 6px; font-size: 14px;">
              ${cluster.name}
            </div>
            <div style="color: #ccc; font-size: 12px; line-height: 1.6;">
              <div>🏃 跑过 ${cluster.count} 次</div>
              <div>📏 总距离 ${cluster.totalDistance} km</div>
              <div>📍 ${cluster.runs.length} 条记录</div>
            </div>
          </div>
        `;

        circle.bindPopup(popupContent);

        circle.on("click", () => {
          setSelectedCluster(cluster);
        });
      });

      setMapLoaded(true);
    };

    initMap();

    return () => {
      isMounted = false;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [clusters]);

  if (clusters.length === 0) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>🗺️</div>
        <div style={styles.emptyText}>暂无路线数据</div>
        <div style={styles.emptySub}>同步 Strava 后查看路线聚类</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.mapWrapper}>
        <div ref={mapRef} style={styles.map} />
        {!mapLoaded && (
          <div style={styles.mapLoading}>
            <span style={styles.loadingDot}>▌</span> 地图加载中...
          </div>
        )}
      </div>

      {/* 选中路线详情 */}
      {selectedCluster && (
        <div style={styles.detailPanel}>
          <div style={styles.detailHeader}>
            <span style={styles.detailName}>{selectedCluster.name}</span>
            <button
              style={styles.closeBtn}
              onClick={() => setSelectedCluster(null)}
            >
              ✕
            </button>
          </div>
          <div style={styles.detailStats}>
            <div style={styles.statItem}>
              <span style={styles.statValue}>{selectedCluster.count}</span>
              <span style={styles.statLabel}>次</span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statValue}>{selectedCluster.totalDistance}</span>
              <span style={styles.statLabel}>km</span>
            </div>
          </div>
          <div style={styles.runList}>
            {selectedCluster.runs.slice(0, 5).map((run, i) => (
              <div key={i} style={styles.runItem}>
                <span style={styles.runDate}>{run.date}</span>
                <span style={styles.runDistance}>{run.distance}km</span>
                <span style={styles.runPace}>{run.pace}</span>
              </div>
            ))}
            {selectedCluster.runs.length > 5 && (
              <div style={styles.moreRuns}>
                +{selectedCluster.runs.length - 5} 条更多记录
              </div>
            )}
          </div>
        </div>
      )}

      {/* 图例 */}
      <div style={styles.legend}>
        <div style={styles.legendTitle}>跑过次数</div>
        <div style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: "#f97316" }} />
          <span style={styles.legendText}>高频</span>
        </div>
        <div style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: "#ea580c" }} />
          <span style={styles.legendText}>中频</span>
        </div>
        <div style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: "#9a3412" }} />
          <span style={styles.legendText}>低频</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 根据强度获取热力颜色（橙色渐变）
 */
function getHeatColor(intensity: number): string {
  if (intensity > 0.7) return "#f97316"; // bright orange
  if (intensity > 0.4) return "#ea580c"; // medium orange
  if (intensity > 0.2) return "#c2410c"; // dark orange
  return "#9a3412"; // deep brown-orange
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "relative",
    width: "100%",
    height: "100%",
    minHeight: "400px",
    display: "flex",
    flexDirection: "column",
  },
  mapWrapper: {
    position: "relative",
    flex: 1,
    minHeight: "300px",
    borderRadius: "4px",
    overflow: "hidden",
    border: "1px solid var(--border)",
  },
  map: {
    width: "100%",
    height: "100%",
    minHeight: "300px",
  },
  mapLoading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg-secondary)",
    color: "var(--accent)",
    fontSize: "14px",
    fontFamily: "'Courier New', monospace",
  },
  loadingDot: {
    animation: "blink 1s infinite",
    marginRight: "8px",
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
    color: "var(--text-secondary)",
    gap: "8px",
  },
  emptyIcon: {
    fontSize: "32px",
    opacity: 0.6,
  },
  emptyText: {
    fontSize: "14px",
    fontWeight: "bold",
  },
  emptySub: {
    fontSize: "12px",
    opacity: 0.7,
  },
  detailPanel: {
    marginTop: "12px",
    padding: "12px",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    fontFamily: "'Courier New', monospace",
  },
  detailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  detailName: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "var(--accent)",
  },
  closeBtn: {
    padding: "2px 6px",
    background: "var(--bg-tertiary)",
    color: "var(--text-secondary)",
    borderRadius: "4px",
    fontSize: "12px",
    cursor: "pointer",
    minHeight: "24px",
  },
  detailStats: {
    display: "flex",
    gap: "16px",
    marginBottom: "10px",
    paddingBottom: "10px",
    borderBottom: "1px solid var(--border)",
  },
  statItem: {
    display: "flex",
    alignItems: "baseline",
    gap: "4px",
  },
  statValue: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "var(--accent)",
  },
  statLabel: {
    fontSize: "12px",
    color: "var(--text-secondary)",
  },
  runList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  runItem: {
    display: "flex",
    gap: "12px",
    fontSize: "12px",
    color: "var(--text-secondary)",
  },
  runDate: {
    minWidth: "80px",
  },
  runDistance: {
    minWidth: "50px",
    color: "var(--text-primary)",
  },
  runPace: {
    color: "var(--accent)",
  },
  moreRuns: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    fontStyle: "italic",
    paddingTop: "4px",
  },
  legend: {
    position: "absolute",
    bottom: "12px",
    right: "12px",
    background: "rgba(24, 24, 27, 0.9)",
    padding: "8px 12px",
    borderRadius: "4px",
    border: "1px solid var(--border)",
    fontSize: "11px",
    fontFamily: "'Courier New', monospace",
    zIndex: 1000,
  },
  legendTitle: {
    fontWeight: "bold",
    color: "var(--text-primary)",
    marginBottom: "4px",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginTop: "2px",
  },
  legendDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    display: "inline-block",
  },
  legendText: {
    color: "var(--text-secondary)",
  },
};
