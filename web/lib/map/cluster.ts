/**
 * 路线聚类算法
 * 基于起点/终点相似度将跑步路线分组
 */

import type { NormalizedRun } from "../strava/types.js";
import { getStartEndPoints, type LatLng } from "../map/polyline.js";

/** 聚类结果 */
export interface RouteCluster {
  clusterId: string;
  runs: NormalizedRun[];
  centerLat: number;
  centerLng: number;
  totalDistance: number;
  count: number;
  name: string;
}

/** 带地理信息的路线 */
interface GeoRun {
  run: NormalizedRun;
  start: LatLng;
  end: LatLng;
}

/** 地球半径（米） */
const EARTH_RADIUS = 6371000;

/** 相似度阈值（米） */
const SIMILARITY_THRESHOLD = 500;

/**
 * Haversine 公式计算两点间距离（米）
 */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat2 = Math.sin(dLat / 2);
  const sinDLng2 = Math.sin(dLng / 2);

  const c = 2 * Math.asin(
    Math.sqrt(
      sinDLat2 * sinDLat2 +
      Math.cos(lat1) * Math.cos(lat2) * sinDLng2 * sinDLng2
    )
  );

  return EARTH_RADIUS * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * 判断两条路线是否相似（起点和终点距离都 < 阈值）
 */
function isSameRoute(a: GeoRun, b: GeoRun): boolean {
  const startDist = haversineDistance(a.start, b.start);
  const endDist = haversineDistance(a.end, b.end);
  return startDist < SIMILARITY_THRESHOLD && endDist < SIMILARITY_THRESHOLD;
}

/**
 * 对路线进行聚类
 */
export function clusterRoutes(runs: NormalizedRun[]): RouteCluster[] {
  // 1. 过滤出有路线数据的记录
  const geoRuns: GeoRun[] = [];
  for (const run of runs) {
    if (!run.route) continue;
    const se = getStartEndPoints(run.route);
    if (se.start && se.end) {
      geoRuns.push({ run, start: se.start, end: se.end });
    }
  }

  if (geoRuns.length === 0) return [];

  // 2. 简化聚类：基于起点+终点相似度
  const clusters: GeoRun[][] = [];
  const visited = new Set<number>();

  for (let i = 0; i < geoRuns.length; i++) {
    if (visited.has(i)) continue;

    const cluster: GeoRun[] = [geoRuns[i]];
    visited.add(i);

    for (let j = i + 1; j < geoRuns.length; j++) {
      if (visited.has(j)) continue;
      if (isSameRoute(geoRuns[i], geoRuns[j])) {
        cluster.push(geoRuns[j]);
        visited.add(j);
      }
    }

    clusters.push(cluster);
  }

  // 3. 生成聚类结果
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return clusters.map((cluster, index) => {
    const name = index < alphabet.length
      ? `路线 ${alphabet[index]}`
      : `路线 ${index + 1}`;

    // 计算中心点（所有起点和终点的平均）
    let sumLat = 0;
    let sumLng = 0;
    let totalDistance = 0;

    for (const g of cluster) {
      sumLat += g.start.lat;
      sumLng += g.start.lng;
      totalDistance += g.run.distance;
    }

    const count = cluster.length;
    const centerLat = sumLat / count;
    const centerLng = sumLng / count;

    return {
      clusterId: `cluster_${index}`,
      runs: cluster.map((g) => g.run),
      centerLat,
      centerLng,
      totalDistance: Math.round(totalDistance * 10) / 10,
      count,
      name,
    };
  });
}

/**
 * 获取聚类统计摘要
 */
export function getClusterSummary(clusters: RouteCluster[]): {
  totalClusters: number;
  totalRunsWithRoute: number;
  mostFrequentRoute: string | null;
  mostFrequentCount: number;
} {
  if (clusters.length === 0) {
    return {
      totalClusters: 0,
      totalRunsWithRoute: 0,
      mostFrequentRoute: null,
      mostFrequentCount: 0,
    };
  }

  const totalRunsWithRoute = clusters.reduce((sum, c) => sum + c.count, 0);
  const sorted = [...clusters].sort((a, b) => b.count - a.count);
  const mostFrequent = sorted[0];

  return {
    totalClusters: clusters.length,
    totalRunsWithRoute,
    mostFrequentRoute: mostFrequent.name,
    mostFrequentCount: mostFrequent.count,
  };
}
