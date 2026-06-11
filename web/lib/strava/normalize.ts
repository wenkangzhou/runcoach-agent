/**
 * Strava 数据清洗 & 标准化
 * 将 Strava 原始活动转换为跑蓝内部 RunLog 格式
 */

import type { StravaActivity, NormalizedRun, StravaSplit } from "./types.js";

/** 秒数 → mm:ss 配速字符串 */
function formatPace(secondsPerKm: number): string {
  if (!isFinite(secondsPerKm) || secondsPerKm <= 0) return "-";
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.floor(secondsPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** 根据 RPE / suffer_score 推断感受 */
function inferFeeling(activity: StravaActivity): string {
  const rpe = activity.perceived_exertion;
  const suffer = activity.suffer_score;

  if (rpe != null) {
    if (rpe <= 3) return "轻松";
    if (rpe <= 5) return "舒适";
    if (rpe <= 7) return "有点累";
    return "很累";
  }

  if (suffer != null) {
    if (suffer < 50) return "轻松";
    if (suffer < 100) return "舒适";
    if (suffer < 200) return "有点累";
    return "很累";
  }

  // 根据配速和心率推断
  const avgHr = activity.average_heartrate;
  if (avgHr != null) {
    // 假设最大心率 180，Z1<108, Z2<126, Z3<144, Z4<162, Z5>=162
    if (avgHr < 126) return "轻松";
    if (avgHr < 144) return "舒适";
    if (avgHr < 162) return "有点累";
    return "很累";
  }

  return "-";
}

/** 清洗单个 Strava 活动 */
export function normalizeActivity(activity: StravaActivity): NormalizedRun {
  const distanceKm = activity.distance / 1000;
  const durationMin = activity.elapsed_time / 60;
  const movingMin = activity.moving_time / 60;
  const paceSecPerKm = activity.moving_time / distanceKm;

  const notesParts: string[] = [];
  if (activity.name) notesParts.push(activity.name);
  if (activity.description) notesParts.push(activity.description);
  if (activity.total_elevation_gain > 0) {
    notesParts.push(`爬升 ${Math.round(activity.total_elevation_gain)}m`);
  }
  if (activity.device_name) notesParts.push(`设备: ${activity.device_name}`);

  return {
    stravaId: activity.id,
    date: activity.start_date_local.split("T")[0],
    name: activity.name,
    distance: Math.round(distanceKm * 10) / 10,
    duration: Math.round(durationMin * 10) / 10,
    movingDuration: Math.round(movingMin * 10) / 10,
    pace: formatPace(paceSecPerKm),
    avgSpeed: Math.round(activity.average_speed * 100) / 100,
    maxSpeed: Math.round(activity.max_speed * 100) / 100,
    elevationGain: Math.round(activity.total_elevation_gain),
    avgHr: activity.average_heartrate,
    maxHr: activity.max_heartrate,
    avgCadence: activity.average_cadence,
    calories: activity.calories,
    sufferScore: activity.suffer_score,
    rpe: activity.perceived_exertion,
    feeling: inferFeeling(activity),
    notes: notesParts.join(" · "),
    route: activity.map?.summary_polyline || undefined,
    splits: activity.splits_metric,
    laps: activity.laps,
    device: activity.device_name,
    isTreadmill: activity.trainer || false,
  };
}

/** 批量清洗 */
export function normalizeActivities(activities: StravaActivity[]): NormalizedRun[] {
  return activities.map(normalizeActivity);
}

/** 将 NormalizedRun 转换为内部 RunLog 格式 */
export function toRunLog(run: NormalizedRun): import("../core/types.js").RunLog {
  return {
    date: run.date,
    distance: run.distance,
    pace: run.pace,
    hr: run.avgHr,
    feeling: run.feeling,
    notes: run.notes,
  };
}

/** 计算训练类型（E/T/I/R/LSD/恢复） */
export function classifyRunType(run: NormalizedRun): string {
  const { distance, pace, avgHr, rpe, sufferScore } = run;

  // 恢复跑: <5km 且配速很慢
  if (distance < 5 && pace.startsWith("6:")) return "恢复跑";

  // 长距离: >15km
  if (distance >= 15) return "LSD";

  // 间歇: 高心率/高 RPE 且距离短
  if ((avgHr && avgHr > 165) || (rpe && rpe >= 8) || (sufferScore && sufferScore > 200)) {
    if (distance < 10) return "间歇跑";
    return "节奏跑";
  }

  // 轻松跑: 低心率
  if ((avgHr && avgHr < 140) || (rpe && rpe <= 4)) return "轻松跑";

  // 默认
  if (distance >= 10) return "有氧跑";
  return "日常跑";
}

/** 计算分段配速 */
export function calculateSplitPaces(splits: StravaSplit[]): { km: number; pace: string; hr?: number }[] {
  return splits.map((s, i) => ({
    km: i + 1,
    pace: formatPace(s.moving_time / (s.distance / 1000)),
    hr: undefined, // Strava split 没有心率
  }));
}
