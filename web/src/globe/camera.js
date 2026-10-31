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
    const factor = Math.max(0.0008, Math.min(0.0035, (height / 15000000) * 0.003));

    // Horizontal rotation (longitude orbit)
    camera.rotateRight(-dx * factor);

    // Vertical rotation (latitude orbit) - clamp near poles to prevent gimbal flipping
    const currentLat = camera.positionCartographic.latitude;
    const maxLat = Cesium.Math.toRadians(85);
    if ((dy > 0 && currentLat > -maxLat) || (dy < 0 && currentLat < maxLat)) {
      camera.rotateUp(-dy * factor);
    }
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
}
