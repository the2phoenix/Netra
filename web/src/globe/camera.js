// @ts-check
import * as Cesium from 'cesium';
import { events } from '../core/events.js';
import { state } from '../core/state.js';

/**
 * Connects abstract intents to Cesium camera movements.
 *
 * @param {Cesium.Viewer} viewer
 */
export function setupCameraControls(viewer) {
  const camera = viewer.camera;
  const scene = viewer.scene;

  // Lock camera orientation so North is always upright
  camera.constrainedAxis = Cesium.Cartesian3.UNIT_Z;

  // Handle ROTATE intent
  events.subscribe('intent:ROTATE', ({ dx, dy }) => {
    const height = camera.positionCartographic.height;
    // Scale sensitivity dynamically: responsive at orbit, precise when zoomed in
    const factor = Math.max(0.001, Math.min(0.004, (height / 15000000) * 0.0035));

    // 1. Horizontal rotation (longitude orbit around Earth's Z axis)
    camera.rotateRight(-dx * factor);

    // 2. Vertical rotation (latitude orbit)
    // In Cesium rotateUp:
    // deltaAngle > 0 moves camera SOUTH (towards -90°)
    // deltaAngle < 0 moves camera NORTH (towards +90°)
    const deltaAngle = -dy * factor;
    const currentLat = camera.positionCartographic.latitude;
    const maxLatRad = Cesium.Math.toRadians(82); // Clamp to +/- 82 degrees to prevent polar gimbal lock

    // Prevent pushing past the pole limits, but ALWAYS allow pulling back towards the equator
    if (deltaAngle > 0 && currentLat <= -maxLatRad) {
      return;
    }
    if (deltaAngle < 0 && currentLat >= maxLatRad) {
      return;
    }

    camera.rotateUp(deltaAngle);
  });

  // Handle ZOOM intent
  events.subscribe('intent:ZOOM', ({ dz }) => {
    const height = camera.positionCartographic.height;
    const amount = dz * (height / 2000);
    if (dz > 0) {
      camera.zoomOut(Math.abs(amount));
    } else {
      // Prevent zooming inside the Earth
      if (height > 10000) {
        camera.zoomIn(Math.abs(amount));
      }
    }
  });

  // Handle FLY_TO intent
  events.subscribe('intent:FLY_TO', ({ clientX, clientY }) => {
    const cartesian = viewer.camera.pickEllipsoid(
      new Cesium.Cartesian2(clientX, clientY),
      scene.globe.ellipsoid
    );
    if (cartesian) {
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const targetHeight = Math.max(1000000, camera.positionCartographic.height * 0.5);
      camera.flyTo({
        destination: Cesium.Cartesian3.fromRadians(
          cartographic.longitude,
          cartographic.latitude,
          targetHeight
        ),
        duration: 1.5,
      });
    }
  });

  // Track camera position for status display
  camera.changed.addEventListener(() => {
    const carto = camera.positionCartographic;
    state.camera.lat = Cesium.Math.toDegrees(carto.latitude);
    state.camera.lon = Cesium.Math.toDegrees(carto.longitude);
    state.camera.altKm = Math.round(carto.height / 1000);
    events.emit('camera:updated', state.camera);
  });

  // Cockpit chase mode state
  let cockpitTarget = null;
  let isOblique = false;

  // Pre-render loop to update cockpit chase camera at 60 FPS
  scene.preRender.addEventListener(() => {
    if (cockpitTarget && cockpitTarget.getPosition) {
      const pos = cockpitTarget.getPosition();
      const heading = cockpitTarget.getHeading ? cockpitTarget.getHeading() : 0;
      if (pos) {
        camera.lookAt(
          pos,
          new Cesium.HeadingPitchRange(
            Cesium.Math.toRadians(heading),
            Cesium.Math.toRadians(-12.0),
            150.0 // 150m chase distance
          )
        );
      }
    }
  });

  function clearCockpitChase() {
    if (cockpitTarget) {
      cockpitTarget = null;
      camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      events.emit('cockpit:state', { active: false });
    }
  }

  // Subscribe to cockpit chase trigger
  events.subscribe('cockpit:toggle', (target) => {
    if (cockpitTarget) {
      clearCockpitChase();
    } else if (target && target.getPosition) {
      cockpitTarget = target;
      events.emit('cockpit:state', { active: true, target });
    }
  });

  events.subscribe('cockpit:clear', () => {
    clearCockpitChase();
  });

  // Horizon tilt toggle (T key or event)
  function toggleTilt() {
    clearCockpitChase();
    const carto = camera.positionCartographic;
    const height = carto.height;
    isOblique = !isOblique;

    camera.flyTo({
      destination: Cesium.Cartesian3.fromRadians(
        carto.longitude,
        carto.latitude,
        height
      ),
      orientation: {
        heading: camera.heading,
        pitch: Cesium.Math.toRadians(isOblique ? -35.0 : -90.0),
        roll: 0.0,
      },
      duration: 1.2,
    });
    events.emit('camera:tiltChanged', { oblique: isOblique });
  }

  events.subscribe('camera:toggleTilt', toggleTilt);

  // Jump to location (city or coordinates)
  events.subscribe('camera:jumpTo', ({ lat, lon, heightM = 500000 }) => {
    clearCockpitChase();
    camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, heightM),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(isOblique ? -35.0 : -90.0),
        roll: 0.0,
      },
      duration: 1.6,
    });
  });

  // Keyboard shortcut listener: C for Cockpit, T for Tilt, Esc to reset
  window.addEventListener('keydown', (e) => {
    // Ignore if typing inside input / search bar
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;

    if (e.key === 'c' || e.key === 'C') {
      events.emit('intent:TOGGLE_COCKPIT', null);
    } else if (e.key === 't' || e.key === 'T') {
      toggleTilt();
    } else if (e.key === 'Escape') {
      clearCockpitChase();
    }
  });
}
