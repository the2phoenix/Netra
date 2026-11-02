// @ts-check
import * as Cesium from 'cesium';
import { emitIntent, INTENT_TYPES } from './intents.js';

/**
 * Initializes mouse and keyboard input handlers using Cesium ScreenSpaceEventHandler.
 * Smooth 3D globe panning, inertial momentum, and 3D tilting are handled by Cesium's native controller.
 * This handler manages high-level actions: Double-Click Fly-To and Tactical Keyboard Shortcuts.
 *
 * @param {Cesium.Viewer} viewer
 */
export function initMouseInput(viewer) {
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

  // 1. Double Click -> Emit FLY_TO intent (Smooth sweep to clicked point)
  handler.setInputAction((click) => {
    emitIntent(INTENT_TYPES.FLY_TO, {
      clientX: click.position.x,
      clientY: click.position.y,
    });
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  // 2. Keyboard Shortcuts (Tactical HUD controls)
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;
    if (e.key === 'm' || e.key === 'M') {
      emitIntent(INTENT_TYPES.NEXT_MODE);
    } else if (e.key === 'c' || e.key === 'C') {
      emitIntent(INTENT_TYPES.TOGGLE_COCKPIT);
    }
  });

  return handler;
}
