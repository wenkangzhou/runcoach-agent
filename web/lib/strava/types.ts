/**
 * Strava API 类型定义
 */

/** Strava 活动原始数据 */
export interface StravaActivity {
  id: number;
  name: string;
  distance: number;           // 米
  moving_time: number;      // 秒
  elapsed_time: number;     // 秒
  total_elevation_gain: number; // 米
  type: string;
  sport_type: string;
  start_date: string;         // ISO 8601
  start_date_local: string;
  timezone: string;
  utc_offset: number;
  location_city: string | null;
  location_state: string | null;
  location_country: string | null;
  achievement_count: number;
  kudos_count: number;
  comment_count: number;
  athlete_count: number;
  photo_count: number;
  map: {
    id: string;
    summary_polyline: string | null;
    resource_state: number;
  };
  trainer: boolean;
  commute: boolean;
  manual: boolean;
  private: boolean;
  visibility: string;
  flagged: boolean;
  gear_id: string | null;
  start_latlng: [number, number] | null;
  end_latlng: [number, number] | null;
  average_speed: number;     // m/s
  max_speed: number;         // m/s
  average_cadence?: number;
  average_temp?: number;
  has_heartrate: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
  heartrate_opt_out: boolean;
  display_hide_heartrate_option: boolean;
  elev_high?: number;
  elev_low?: number;
  pr_count: number;
  total_photo_count: number;
  has_kudoed: boolean;
  suffer_score?: number;     // 训练负荷
  description?: string;
  calories?: number;
  perceived_exertion?: number; // RPE 1-10
  prefer_perceived_exertion?: boolean;
  segment_efforts?: unknown[];
  splits_metric?: StravaSplit[];
  splits_standard?: StravaSplit[];
  laps?: StravaLap[];
  best_efforts?: StravaBestEffort[];
  photos?: { primary: unknown | null; count: number };
  similar_activities?: unknown;
  device_name?: string;
  embed_token?: string;
  available_zones?: string[];
}

/** 分段数据 */
export interface StravaSplit {
  distance: number;
  elapsed_time: number;
  elevation_difference: number;
  moving_time: number;
  split: number;
  average_speed: number;
  pace_zone: number;
}

/** 圈数据 */
export interface StravaLap {
  id: number;
  resource_state: number;
  name: string;
  activity: { id: number; resource_state: number };
  athlete: { id: number; resource_state: number };
  elapsed_time: number;
  moving_time: number;
  start_date: string;
  start_date_local: string;
  distance: number;
  start_index: number;
  end_index: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed: number;
  average_cadence?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  lap_index: number;
  split: number;
}

/** 最佳成绩 */
export interface StravaBestEffort {
  name: string;
  elapsed_time: number;
  moving_time: number;
  start_date: string;
  start_date_local: string;
  distance: number;
  start_index: number;
  end_index: number;
  pr_rank: number | null;
  achievements: unknown[];
  activity: { id: number; resource_state: number };
  athlete: { id: number; resource_state: number };
}

/** Strava OAuth Token 响应 */
export interface StravaTokenResponse {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete: StravaAthlete;
}

/** Strava 运动员信息 */
export interface StravaAthlete {
  id: number;
  username: string | null;
  resource_state: number;
  firstname: string;
  lastname: string;
  bio: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  sex: string | null;
  premium: boolean;
  summit: boolean;
  created_at: string;
  updated_at: string;
  badge_type_id: number;
  weight: number;
  profile_medium: string;
  profile: string;
  friend: string | null;
  follower: string | null;
}

/** 清洗后的跑步记录 */
export interface NormalizedRun {
  stravaId: number;
  date: string;              // YYYY-MM-DD
  name: string;
  distance: number;          // km
  duration: number;          // 分钟
  movingDuration: number;    // 分钟
  pace: string;              // mm:ss /km
  avgSpeed: number;          // m/s
  maxSpeed: number;          // m/s
  elevationGain: number;     // m
  avgHr?: number;
  maxHr?: number;
  avgCadence?: number;
  calories?: number;
  sufferScore?: number;      // 训练负荷
  rpe?: number;              // 主观用力 1-10
  feeling: string;           // 基于 RPE/suffer_score 推断
  notes: string;             // 原始 name + description
  route?: string;            // summary_polyline
  splits?: StravaSplit[];
  laps?: StravaLap[];
  device?: string;
  isTreadmill: boolean;
}

/** Strava 连接状态 */
export interface StravaConnection {
  connected: boolean;
  athleteId?: number;
  athleteName?: string;
  profileImage?: string;
  lastSyncAt?: string;
  totalActivities?: number;
}
