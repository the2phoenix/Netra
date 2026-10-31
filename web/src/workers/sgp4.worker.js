// @ts-check
import * as satellite from 'satellite.js';

/**
 * SGP4 Satellite Propagation Worker
 * Propagates orbits off the main thread to guarantee smooth 30+ FPS rendering.
 */

/** @type {Array<{id: number, name: string, satrec: any}>} */
let satellites = [];
let propagationTimer = null;

self.onmessage = (event) => {
  const { type, payload } = event.data;

  if (type === 'INIT_SATELLITES') {
    satellites = [];
    for (let i = 0; i < payload.length; i++) {
      const item = payload[i];
      try {
        const satrec = satellite.twoline2satrec(item.line1, item.line2);
        if (satrec && !satrec.error) {
          satellites.push({
            id: item.norad_cat_id,
            name: item.name,
            satrec,
          });
        }
      } catch (err) {
        // Skip malformed TLE
      }
    }

    if (!propagationTimer) {
      propagateAll();
      propagationTimer = setInterval(propagateAll, 500);
    }
  } else if (type === 'STOP') {
    if (propagationTimer) {
      clearInterval(propagationTimer);
      propagationTimer = null;
    }
  }
};

function propagateAll() {
  if (satellites.length === 0) return;

  const now = new Date();
  const gmst = satellite.gstime(now);

  // Each satellite takes 3 floats: x, y, z (metres in Earth-Centered Fixed frame)
  // Plus we collect active indices and count
  const count = satellites.length;
  const positions = new Float32Array(count * 3);
  const ids = new Int32Array(count);
  let validCount = 0;

  for (let i = 0; i < count; i++) {
    const sat = satellites[i];
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

  // Transfer buffers to main thread without cloning overhead
  // @ts-ignore
  self.postMessage({
    type: 'POSITIONS_UPDATED',
    count: validCount,
    positions: positions.buffer,
    ids: ids.buffer,
  }, [positions.buffer, ids.buffer]);
}
