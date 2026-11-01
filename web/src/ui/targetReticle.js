// @ts-check
import * as Cesium from 'cesium';
import { events } from '../core/events.js';

/**
 * High-Precision Tactical Screen-Space Targeting Brackets (60 FPS)
 * Locks animated military corner reticles around selected entities.
 *
 * @param {HTMLElement} root
 * @param {Cesium.Viewer} viewer
 */
export function initTargetReticle(root, viewer) {
  const reticle = document.createElement('div');
  reticle.className = 'tactical-target-bracket';
  reticle.id = 'targetBracket';
  reticle.style.display = 'none';

  reticle.innerHTML = `
    <div class="bracket-tl"></div>
    <div class="bracket-tr"></div>
    <div class="bracket-bl"></div>
    <div class="bracket-br"></div>
    <div class="bracket-telemetry" id="bracketTelemetry">
      <div class="bracket-id" id="bracketId">TARGET LOCK</div>
      <div class="bracket-stats" id="bracketStats">--- KT | FL---</div>
    </div>
  `;
  root.appendChild(reticle);

  const elId = reticle.querySelector('#bracketId');
  const elStats = reticle.querySelector('#bracketStats');

  /** @type {any} */
  let currentTarget = null;
  /** @type {'air'|'sat'|null} */
  let targetType = null;

  events.subscribe('aircraft:selected', (ac) => {
    currentTarget = ac;
    targetType = 'air';
    if (elId) elId.textContent = `${ac.callsign || ac.hex.toUpperCase()} [LOCKED]`;
    if (elStats) elStats.textContent = `${Math.round(ac.gs_kt || 0)} KT | FL${Math.round((ac.alt_ft || 0) / 100)}`;
    reticle.style.display = 'block';
  });

  events.subscribe('aircraft:telemetry', (ac) => {
    if (currentTarget && targetType === 'air' && currentTarget.hex === ac.hex) {
      currentTarget = ac;
      if (elStats) elStats.textContent = `${Math.round(ac.gs_kt || 0)} KT | FL${Math.round((ac.alt_ft || 0) / 100)}`;
    }
  });

  events.subscribe('aircraft:deselected', () => {
    if (targetType === 'air') {
      currentTarget = null;
      targetType = null;
      reticle.style.display = 'none';
    }
  });

  events.subscribe('satellite:selected-item', (sat) => {
    currentTarget = sat;
    targetType = 'sat';
    if (elId) elId.textContent = `${sat.name || 'SAT'} [NORAD ${sat.norad_cat_id}]`;
    if (elStats) elStats.textContent = `${Math.round(sat.alt_km || 400)} KM | ORBITAL LOCK`;
    reticle.style.display = 'block';
  });

  events.subscribe('satellite:deselected', () => {
    if (targetType === 'sat') {
      currentTarget = null;
      targetType = null;
      reticle.style.display = 'none';
    }
  });

  const scratchCartesian = new Cesium.Cartesian3();

  // 60 FPS screen-space projection loop
  viewer.scene.postRender.addEventListener(() => {
    if (!currentTarget) {
      reticle.style.display = 'none';
      return;
    }

    let worldPos = null;
    if (targetType === 'air' && typeof currentTarget.lat === 'number' && typeof currentTarget.lon === 'number') {
      const altM = (currentTarget.alt_ft || 0) * 0.3048;
      worldPos = Cesium.Cartesian3.fromDegrees(currentTarget.lon, currentTarget.lat, altM, Cesium.Ellipsoid.WGS84, scratchCartesian);
    } else if (targetType === 'sat' && currentTarget.cartesianPos) {
      worldPos = currentTarget.cartesianPos;
    }

    if (!worldPos) return;

    // Check if behind camera
    const camera = viewer.camera;
    const toTarget = Cesium.Cartesian3.subtract(worldPos, camera.position, new Cesium.Cartesian3());
    const dot = Cesium.Cartesian3.dot(camera.direction, toTarget);
    if (dot <= 0) {
      reticle.style.display = 'none';
      return;
    }

    // Convert WGS84 to 2D screen coordinates
    const windowCoord = Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, worldPos);
    if (!windowCoord) {
      reticle.style.display = 'none';
      return;
    }

    // Keep reticle on screen
    reticle.style.display = 'block';
    reticle.style.left = `${Math.round(windowCoord.x)}px`;
    reticle.style.top = `${Math.round(windowCoord.y)}px`;
  });
}
