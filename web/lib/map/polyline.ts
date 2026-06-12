/**
 * Google Polyline Encoding 解码器
 * 参考: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * 解码 Google Polyline 字符串为经纬度数组
 */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;

    // 解码纬度
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    // 解码经度
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return points;
}

/**
 * 获取 polyline 的起点
 */
export function getStartPoint(encoded: string): LatLng | null {
  const points = decodePolyline(encoded);
  return points.length > 0 ? points[0] : null;
}

/**
 * 获取 polyline 的终点
 */
export function getEndPoint(encoded: string): LatLng | null {
  const points = decodePolyline(encoded);
  return points.length > 0 ? points[points.length - 1] : null;
}

/**
 * 获取 polyline 的起点和终点
 */
export function getStartEndPoints(encoded: string): { start: LatLng | null; end: LatLng | null } {
  const points = decodePolyline(encoded);
  if (points.length === 0) return { start: null, end: null };
  return { start: points[0], end: points[points.length - 1] };
}
