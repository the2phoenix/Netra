// @ts-check
/**
 * Geospatial algorithms for Scan Mode, Alerts, Geofences, and Satellite Footprints.
 * Per trd.md section 8 (8.3 - 8.7), features.md (SCN-01, SCN-02, FLT-03, SAT-03, SAT-04).
 */

const EARTH_RADIUS_KM = 6371.0;
const TO_RAD = Math.PI / 180.0;
const TO_DEG = 180.0 / Math.PI;

/**
 * Point in polygon check using ray-casting (SCN-02, T-GEO-06).
 * Limitation: polygons crossing the antimeridian (+/-180 deg) or enclosing poles are unsupported.
 *
 * @param {Array<{lat: number, lon: number}>} polygon - Ordered vertices of polygon
 * @param {number} lat - Target point latitude
 * @param {number} lon - Target point longitude
 * @returns {boolean} True if point is inside polygon
 */
export function isPointInPolygon(polygon, lat, lon) {
  if (!polygon || polygon.length < 3) return false;

  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].lon;
    const yi = polygon[i].lat;
    const xj = polygon[j].lon;
    const yj = polygon[j].lat;

    // Check if the edge crosses the horizontal ray at y = lat
    const intersect =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Computes satellite footprint ground coverage radius in kilometres (SAT-03, T-GEO-11, T-GEO-12).
 * Formula: lambda = arccos( R * cos(eps) / (R + h) ) - eps; ground_radius = R * lambda.
 *
 * @param {number} altKm - Satellite altitude in km
 * @param {number} minElevationDeg - Minimum look-angle elevation in degrees (0 for horizon, 10 for operational)
 * @returns {number} Footprint radius in km
 */
export function computeFootprintRadius(altKm, minElevationDeg = 0) {
  if (altKm <= 0) return 0;

  const R = EARTH_RADIUS_KM;
  const eps = minElevationDeg * TO_RAD;
  const cosEps = Math.cos(eps);

  const ratio = (R * cosEps) / (R + altKm);
  const clampedRatio = Math.min(1.0, Math.max(-1.0, ratio));
  const lambda = Math.acos(clampedRatio) - eps;

  return R * Math.max(0, lambda);
}

/**
 * Splits a ground track into segments when crossing the antimeridian (+/-180 lon) (SAT-03, T-SAT-07).
 * Prevents Cesium polyline from drawing an erroneous wrap-around line across the globe.
 *
 * @param {Array<{lat: number, lon: number}>} track - Sequential list of ground points
 * @returns {Array<Array<{lat: number, lon: number}>>} Array of continuous segments
 */
export function splitGroundTrackAtAntimeridian(track) {
  if (!track || track.length === 0) return [];

  const segments = [];
  let currentSegment = [track[0]];

  for (let i = 1; i < track.length; i++) {
    const prev = track[i - 1];
    const curr = track[i];

    // Detect antimeridian crossing (jump > 180 degrees in longitude)
    if (Math.abs(curr.lon - prev.lon) > 180) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
      }
      currentSegment = [curr];
    } else {
      currentSegment.push(curr);
    }
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

/**
 * Calculates look-angle elevation in degrees from an observer to a satellite (SAT-04, SCN-01).
 *
 * @param {number} obsLat - Observer latitude in degrees
 * @param {number} obsLon - Observer longitude in degrees
 * @param {number} obsAltM - Observer altitude in metres
 * @param {number} satLat - Satellite latitude in degrees
 * @param {number} satLon - Satellite longitude in degrees
 * @param {number} satAltKm - Satellite altitude in kilometres
 * @returns {number} Elevation angle in degrees (-90 to +90)
 */
export function calculateElevationDeg(obsLat, obsLon, obsAltM, satLat, satLon, satAltKm) {
  const R_obs = EARTH_RADIUS_KM + obsAltM / 1000.0;
  const R_sat = EARTH_RADIUS_KM + satAltKm;

  const obsLatRad = obsLat * TO_RAD;
  const obsLonRad = obsLon * TO_RAD;
  const satLatRad = satLat * TO_RAD;
  const satLonRad = satLon * TO_RAD;

  // Observer 3D position vector
  const ox = R_obs * Math.cos(obsLatRad) * Math.cos(obsLonRad);
  const oy = R_obs * Math.cos(obsLatRad) * Math.sin(obsLonRad);
  const oz = R_obs * Math.sin(obsLatRad);

  // Observer Up (zenith) unit vector
  const ux = Math.cos(obsLatRad) * Math.cos(obsLonRad);
  const uy = Math.cos(obsLatRad) * Math.sin(obsLonRad);
  const uz = Math.sin(obsLatRad);

  // Satellite 3D position vector
  const sx = R_sat * Math.cos(satLatRad) * Math.cos(satLonRad);
  const sy = R_sat * Math.cos(satLatRad) * Math.sin(satLonRad);
  const sz = R_sat * Math.sin(satLatRad);

  // Vector from observer to satellite
  const rx = sx - ox;
  const ry = sy - oy;
  const rz = sz - oz;

  const range = Math.sqrt(rx * rx + ry * ry + rz * rz);
  if (range === 0) return 90.0;

  // Dot product with zenith vector gives sin(elevation)
  const dotUp = rx * ux + ry * uy + rz * uz;
  const sinEl = Math.min(1.0, Math.max(-1.0, dotUp / range));

  return Math.asin(sinEl) * TO_DEG;
}

/**
 * Checks if a satellite is considered "overhead" (> minElevationDeg from observer) (SCN-01).
 *
 * @param {number} obsLat
 * @param {number} obsLon
 * @param {number} satLat
 * @param {number} satLon
 * @param {number} satAltKm
 * @param {number} minElevationDeg
 * @returns {boolean}
 */
export function isSatelliteOverhead(obsLat, obsLon, satLat, satLon, satAltKm, minElevationDeg = 10) {
  const el = calculateElevationDeg(obsLat, obsLon, 0, satLat, satLon, satAltKm);
  return el >= minElevationDeg;
}

/**
 * Manages emergency squawk alerts (7500, 7600, 7700) with deduplication (FLT-03).
 * Ensures an aircraft triggers exactly one alert per emergency event, not one per poll.
 */
export class SquawkAlertManager {
  constructor() {
    /** @type {Map<string, string>} hex -> last alerted squawk */
    this.alertedMap = new Map();
  }

  /**
   * Processes a list of aircraft and returns newly triggered emergency alerts.
   *
   * @param {Array<{hex: string, callsign?: string, squawk?: string, lat: number, lon: number}>} aircraftList
   * @returns {Array<{hex: string, callsign: string, squawk: string, lat: number, lon: number, time: string}>}
   */
  processAircraft(aircraftList) {
    const newAlerts = [];
    const activeEmergencyHexes = new Set();
    const EMERGENCY_SQUAWKS = new Set(['7500', '7600', '7700']);

    for (const ac of aircraftList) {
      const squawk = (ac.squawk || '').trim();
      if (EMERGENCY_SQUAWKS.has(squawk)) {
        activeEmergencyHexes.add(ac.hex);

        const lastSquawk = this.alertedMap.get(ac.hex);
        if (lastSquawk !== squawk) {
          // New emergency squawk event
          this.alertedMap.set(ac.hex, squawk);
          newAlerts.push({
            hex: ac.hex,
            callsign: ac.callsign || ac.hex,
            squawk,
            lat: ac.lat,
            lon: ac.lon,
            time: new Date().toISOString(),
          });
        }
      }
    }

    // Clean up aircraft that stopped squawking emergency
    for (const hex of this.alertedMap.keys()) {
      if (!activeEmergencyHexes.has(hex)) {
        this.alertedMap.delete(hex);
      }
    }

    return newAlerts;
  }
}

