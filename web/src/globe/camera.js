// @ts-check
import * as Cesium from 'cesium';
import { events } from '../core/events.js';
import { state } from '../core/state.js';

/**
 * Connects abstract intents to Cesium camera movements.
 * Supports smooth 3D globe orbit, dynamic auto-pitch into 3D on zoom-in, and interactive 3D tilt.
 *
 * @param {Cesium.Viewer} viewer
 */
export function setupCameraControls(viewer) {
  const camera = viewer.camera;
  const scene = viewer.scene;

  // Lock camera roll so North remains upright during pan
  camera.constrainedAxis = Cesium.Cartesian3.UNIT_Z;

  // Handle ROTATE intent (Left mouse drag)
  events.subscribe('intent:ROTATE', ({ dx, dy }) => {
    const height = camera.positionCartographic.height;
    // Scale sensitivity dynamically: responsive at orbit, precise when zoomed in
    const factor = Math.max(0.0008, Math.min(0.004, (height / 15000000) * 0.0035));

    camera.rotateRight(-dx * factor);

    const deltaAngle = -dy * factor;
    const currentLat = camera.positionCartographic.latitude;
    const maxLatRad = Cesium.Math.toRadians(82);

    if (deltaAngle > 0 && currentLat <= -maxLatRad) return;
    if (deltaAngle < 0 && currentLat >= maxLatRad) return;

    camera.rotateUp(deltaAngle);
  });

  // Handle TILT intent (Right mouse drag / Middle mouse drag)
  events.subscribe('intent:TILT', ({ dx, dy }) => {
    const sensitivity = 0.0045;
    // 1. Tilt pitch up/down
    const currentPitch = camera.pitch;
    const targetPitch = Cesium.Math.clamp(
      currentPitch + dy * sensitivity,
      Cesium.Math.toRadians(-88), // near nadir
      Cesium.Math.toRadians(-12)  // near horizon
    );

    // 2. Rotate heading left/right
    const currentHeading = camera.heading;
    const targetHeading = currentHeading + dx * sensitivity;

    camera.setView({
      orientation: {
        heading: targetHeading,
        pitch: targetPitch,
        roll: 0.0,
      },
    });
  });

  // Handle ZOOM intent (Scroll wheel)
  events.subscribe('intent:ZOOM', ({ dz }) => {
    const height = camera.positionCartographic.height;
    const amount = dz * (height / 1800);

    if (dz > 0) {
      camera.zoomOut(Math.abs(amount));
      // As user zooms out into space, smoothly return towards nadir (-90°)
      if (height > 150000 && camera.pitch > Cesium.Math.toRadians(-85)) {
        const newPitch = Cesium.Math.clamp(
          camera.pitch - Cesium.Math.toRadians(2.0),
          Cesium.Math.toRadians(-90),
          Cesium.Math.toRadians(-35)
        );
        camera.setView({ orientation: { heading: camera.heading, pitch: newPitch, roll: 0.0 } });
      }
    } else {
      // Allow zooming close to ground (down to 150m)
      if (height > 150) {
        camera.zoomIn(Math.abs(amount));
        // Natural 3D Earth auto-tilt: as user zooms below 120km, dynamically pitch towards 3D oblique perspective (-38°)
        if (height < 120000 && camera.pitch < Cesium.Math.toRadians(-40)) {
          const newPitch = Cesium.Math.clamp(
            camera.pitch + Cesium.Math.toRadians(2.5),
            Cesium.Math.toRadians(-90),
            Cesium.Math.toRadians(-38)
          );
          camera.setView({ orientation: { heading: camera.heading, pitch: newPitch, roll: 0.0 } });
        }
      }
    }
  });

  // Handle FLY_TO intent (Double click)
  events.subscribe('intent:FLY_TO', ({ clientX, clientY }) => {
    const cartesian = viewer.camera.pickEllipsoid(
      new Cesium.Cartesian2(clientX, clientY),
      scene.globe.ellipsoid
    );
    if (cartesian) {
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const targetHeight = Math.max(1200, camera.positionCartographic.height * 0.4);
      camera.flyTo({
        destination: Cesium.Cartesian3.fromRadians(
          cartographic.longitude,
          cartographic.latitude,
          targetHeight
        ),
        orientation: {
          heading: camera.heading,
          pitch: Cesium.Math.toRadians(targetHeight < 50000 ? -38.0 : -90.0),
          roll: 0.0,
        },
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

  // Jump to location (monument, landmark, city or coordinates in 3D)
  events.subscribe('camera:jumpTo', ({ lat, lon, heightM = 500000, pitchDeg = -35.0, headingDeg = 0.0 }) => {
    clearCockpitChase();
    camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, heightM),
      orientation: {
        heading: Cesium.Math.toRadians(headingDeg),
        pitch: Cesium.Math.toRadians(heightM < 100000 ? pitchDeg : -90.0),
        roll: 0.0,
      },
      duration: 1.8,
    });
  });

  // Keyboard shortcut listener: C for Cockpit, T for Tilt, Esc to reset
  window.addEventListener('keydown', (e) => {
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
