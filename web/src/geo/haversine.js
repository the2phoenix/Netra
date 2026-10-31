// @ts-check
/**
 * Geodesic and Great-Circle Calculations.
 * Per trd.md section 6, 8.3 and testing.md T-GEO-01..T-GEO-05.
 */

export const EARTH_RADIUS_M = 6371008.8;
const TO_RAD = Math.PI / 180.0;
const TO_DEG = 180.0 / Math.PI;

/**
 * Calculates the great-circle distance between two points in metres using the Haversine formula.
 *
 * @param {number} lat1 - Latitude of point 1 in degrees
 * @param {number} lon1 - Longitude of point 1 in degrees
 * @param {number} lat2 - Latitude of point 2 in degrees
 * @param {number} lon2 - Longitude of point 2 in degrees
 * @returns {number} Distance in metres
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const phi1 = lat1 * TO_RAD;
  const phi2 = lat2 * TO_RAD;
  const deltaPhi = (lat2 - lat1) * TO_RAD;

  // Handle antimeridian crossing: normalize difference to [-180, 180]
  let deltaLonDeg = lon2 - lon1;
  while (deltaLonDeg > 180) deltaLonDeg -= 360;
  while (deltaLonDeg < -180) deltaLonDeg += 360;
  const deltaLambda = deltaLonDeg * TO_RAD;

  const sinHalfDeltaPhi = Math.sin(deltaPhi / 2);
  const sinHalfDeltaLambda = Math.sin(deltaLambda / 2);

  const a =
    sinHalfDeltaPhi * sinHalfDeltaPhi +
    Math.cos(phi1) * Math.cos(phi2) * sinHalfDeltaLambda * sinHalfDeltaLambda;

  // Clamp a to [0, 1] to prevent floating point inaccuracies from yielding NaN in asin/sqrt
  const clampedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));

  return EARTH_RADIUS_M * c;
}

/**
 * Checks whether a point is within a given circular radius (in metres).
 *
 * @param {number} centerLat
 * @param {number} centerLon
 * @param {number} radiusM
 * @param {number} pointLat
 * @param {number} pointLon
 * @returns {boolean}
 */
export function isPointInCircle(centerLat, centerLon, radiusM, pointLat, pointLon) {
  const dist = haversineDistance(centerLat, centerLon, pointLat, pointLon);
  return dist <= radiusM;
}

/**
 * Computes an axis-aligned bounding box for fast pre-filtering.
 *
 * @param {number} centerLat
 * @param {number} centerLon
 * @param {number} radiusM
 * @returns {{minLat: number, maxLat: number, minLon: number, maxLon: number, crossesAntimeridian: boolean}}
 */
export function computeBoundingBox(centerLat, centerLon, radiusM) {
  const deltaLat = (radiusM / EARTH_RADIUS_M) * TO_DEG;
  const minLat = Math.max(-90, centerLat - deltaLat);
  const maxLat = Math.min(90, centerLat + deltaLat);

  // Near poles, bounding box longitude spans full globe
  if (minLat === -90 || maxLat === 90) {
    return { minLat, maxLat, minLon: -180, maxLon: 180, crossesAntimeridian: false };
  }

  // Adjust delta lon by cosine of maximum latitude reached
  const maxAbsLat = Math.max(Math.abs(minLat), Math.abs(maxLat));
  const cosLat = Math.cos(maxAbsLat * TO_RAD);
  const deltaLon = cosLat > 0.0001 ? (deltaLat / cosLat) : 180;

  let minLon = centerLon - deltaLon;
  let maxLon = centerLon + deltaLon;
  let crossesAntimeridian = false;

  if (minLon < -180 || maxLon > 180) {
    crossesAntimeridian = true;
  }

  return { minLat, maxLat, minLon, maxLon, crossesAntimeridian };
}
