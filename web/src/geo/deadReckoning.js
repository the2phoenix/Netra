// @ts-check
import { EARTH_RADIUS_M, normalizeLongitude } from './haversine.js';

export const FT_TO_M = 0.3048;
export const KT_TO_MPS = 0.514444;
export const FPM_TO_MPS = 0.00508;

/**
 * Predicts the dead-reckoned position of an aircraft given its state and elapsed time.
 * Per TRD section 8.2 and REQ FLT-01.
 *
 * @param {Object} params
 * @param {number} params.lat - Initial latitude in degrees [-90, 90]
 * @param {number} params.lon - Initial longitude in degrees [-180, 180]
 * @param {number} params.altM - Altitude in metres
 * @param {number} params.gsMps - Ground speed in m/s
 * @param {number} params.trackDeg - True track heading in degrees [0, 360]
 * @param {number} [params.vsMps=0] - Vertical speed in m/s
 * @param {number} params.dtSeconds - Elapsed time in seconds
 * @param {number} [params.clampDt=90] - Maximum allowed dead-reckoning window in seconds
 * @param {boolean} [params.onGround=false] - Whether aircraft is on ground
 * @returns {{lat: number, lon: number, altM: number}}
 */
export function predictPosition({
  lat,
  lon,
  altM,
  gsMps,
  trackDeg,
  vsMps = 0,
  dtSeconds,
  clampDt = 90,
  onGround = false,
}) {
  if (onGround) {
    return { lat, lon, altM: 0 };
  }

  const dt = Math.max(0, Math.min(dtSeconds, clampDt));

  // Angular distance traveled: δ = v * dt / R
  const delta = (gsMps * dt) / EARTH_RADIUS_M;

  const phi1 = (lat * Math.PI) / 180;
  const lambda1 = (lon * Math.PI) / 180;
  const theta = (trackDeg * Math.PI) / 180;

  // Great circle forward projection equations
  // sin(φ2) = sin(φ1)*cos(δ) + cos(φ1)*sin(δ)*cos(θ)
  const sinPhi2 = Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta);
  const phi2 = Math.asin(Math.max(-1, Math.min(1, sinPhi2)));

  // λ2 = λ1 + atan2(sin(θ)*sin(δ)*cos(φ1), cos(δ) - sin(φ1)*sin(φ2))
  const y = Math.sin(theta) * Math.sin(delta) * Math.cos(phi1);
  const x = Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2);
  const lambda2 = lambda1 + Math.atan2(y, x);

  const latDeg = (phi2 * 180) / Math.PI;
  const lonDeg = normalizeLongitude((lambda2 * 180) / Math.PI);

  // Clamp altitude to [0, 20,000] m
  const alt2 = Math.max(0, Math.min(20000, altM + vsMps * dt));

  return {
    lat: latDeg,
    lon: lonDeg,
    altM: alt2,
  };
}

/**
 * Easing blend to smoothly transition displayed position toward target fix without teleportation.
 * Formula: display += (target - display) * min(1, dt / blendDuration)
 *
 * @param {{lat: number, lon: number, altM: number}} current
 * @param {{lat: number, lon: number, altM: number}} target
 * @param {number} elapsedSeconds
 * @param {number} [blendDuration=0.5]
 * @returns {{lat: number, lon: number, altM: number}}
 */
export function easePosition(current, target, elapsedSeconds, blendDuration = 0.5) {
  const factor = Math.min(1, Math.max(0, elapsedSeconds / blendDuration));
  return {
    lat: current.lat + (target.lat - current.lat) * factor,
    lon: current.lon + (target.lon - current.lon) * factor,
    altM: current.altM + (target.altM - current.altM) * factor,
  };
}
