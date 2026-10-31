// @ts-check
import * as satellite from 'satellite.js';

/**
 * SGP4 Satellite Propagation Worker
 * Propagates orbits off the main thread to guarantee smooth 30+ FPS rendering.
 * Supports batch propagation under 8ms and real-time geodetic telemetry for selected satellites.
 */

/** @type {Map<number, {id: number, name: string, group: string, satrec: any, item: any}>} */
const satelliteMap = new Map();
let satelliteList = [];
let propagationTimer = null;

self.onmessage = (event) => {
  const { type, payload } = event.data;

  if (type === 'INIT_SATELLITES') {
    satelliteMap.clear();
    satelliteList = [];

    for (let i = 0; i < payload.length; i++) {
      const item = payload[i];
      try {
        const satrec = satellite.twoline2satrec(item.line1, item.line2);
        if (satrec && !satrec.error) {
          const entry = {
            id: item.norad_cat_id,
            name: item.name,
            group: item.group || 'science',
            satrec,
            item,
          };
          satelliteMap.set(item.norad_cat_id, entry);
          satelliteList.push(entry);
        }
      } catch (err) {
        // Skip malformed TLE
      }
    }

    if (!propagationTimer) {
      propagateAll();
      propagationTimer = setInterval(propagateAll, 500);
    }
  } else if (type === 'GET_TELEMETRY') {
    const sat = satelliteMap.get(payload.id);
    if (!sat) return;

    const now = new Date();
    const gmst = satellite.gstime(now);
    const posAndVel = satellite.propagate(sat.satrec, now);

    if (posAndVel.position && typeof posAndVel.position !== 'boolean' && posAndVel.velocity && typeof posAndVel.velocity !== 'boolean') {
      const geodetic = satellite.eciToGeodetic(posAndVel.position, gmst);
      const vel = posAndVel.velocity;
      const speedKmS = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);

      // Current Julian Date for element age calculation
      const currentJd = satellite.jday(
        now.getUTCFullYear(),
        now.getUTCMonth() + 1,
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds()
      );
      const elementAgeDays = Math.max(0, currentJd - sat.satrec.jdsatepoch);

      // @ts-ignore
      self.postMessage({
        type: 'TELEMETRY_UPDATED',
        telemetry: {
          id: sat.id,
          name: sat.name,
          group: sat.group,
          latDeg: satellite.degreesLat(geodetic.latitude),
          lonDeg: satellite.degreesLong(geodetic.longitude),
          altKm: geodetic.height,
          speedKmS: speedKmS,
          inclinationDeg: sat.item.inclination || (sat.satrec.inclo * 180 / Math.PI),
          periodMin: sat.item.period_min || (sat.satrec.no > 0 ? (2 * Math.PI / sat.satrec.no) : 90),
          elementAgeDays: elementAgeDays.toFixed(1),
        },
      });
    }
  } else if (type === 'STOP') {
    if (propagationTimer) {
      clearInterval(propagationTimer);
      propagationTimer = null;
    }
  }
};

function propagateAll() {
  if (satelliteList.length === 0) return;

  const tStart = performance.now();
  const now = new Date();
  const gmst = satellite.gstime(now);

  const count = satelliteList.length;
  const positions = new Float32Array(count * 3);
  const ids = new Int32Array(count);
  let validCount = 0;

  for (let i = 0; i < count; i++) {
    const sat = satelliteList[i];
    const posAndVel = satellite.propagate(sat.satrec, now);
    const positionEci = posAndVel.position;

    if (positionEci && typeof positionEci !== 'boolean') {
      const ecf = satellite.eciToEcf(positionEci, gmst);
      const baseIdx = validCount * 3;
      // Convert km to metres for Cesium Cartesian3
      positions[baseIdx] = ecf.x * 1000;
      positions[baseIdx + 1] = ecf.y * 1000;
      positions[baseIdx + 2] = ecf.z * 1000;
      ids[validCount] = sat.id;
      validCount++;
    }
  }

  const durationMs = performance.now() - tStart;

  // Transfer buffers to main thread without cloning overhead
  // @ts-ignore
  self.postMessage({
    type: 'POSITIONS_UPDATED',
    count: validCount,
    positions: positions.buffer,
    ids: ids.buffer,
    batchDurationMs: durationMs,
  }, [positions.buffer, ids.buffer]);
}
