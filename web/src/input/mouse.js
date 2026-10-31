// @ts-check
import * as Cesium from 'cesium';
import { emitIntent, INTENT_TYPES } from './intents.js';

/**
 * Initializes mouse and keyboard input handlers using Cesium ScreenSpaceEventHandler.
 * Guarantees reliable event capture across devices while emitting decoupled abstract intents.
 *
 * @param {Cesium.Viewer} viewer
 */
export function initMouseInput(viewer) {
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  // 1. Left Mouse Down -> Begin drag
  handler.setInputAction((click) => {
    isDragging = true;
    lastX = click.position.x;
    lastY = click.position.y;
  }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

  // 2. Mouse Move -> Emit ROTATE intent
  handler.setInputAction((movement) => {
    if (!isDragging || !movement.endPosition) return;

    const currentX = movement.endPosition.x;
    const currentY = movement.endPosition.y;
    const dx = currentX - lastX;
    const dy = currentY - lastY;
    lastX = currentX;
    lastY = currentY;

    if (dx !== 0 || dy !== 0) {
      emitIntent(INTENT_TYPES.ROTATE, { dx, dy });
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  // 3. Left Mouse Up -> End drag
  handler.setInputAction(() => {
    isDragging = false;
  }, Cesium.ScreenSpaceEventType.LEFT_UP);

  // Catch pointer releases outside the canvas
  window.addEventListener('mouseup', () => {
    isDragging = false;
  });
  window.addEventListener('pointerup', () => {
    isDragging = false;
  });

  // 4. Scroll Wheel -> Emit ZOOM intent
  handler.setInputAction((delta) => {
    emitIntent(INTENT_TYPES.ZOOM, { dz: -delta });
  }, Cesium.ScreenSpaceEventType.WHEEL);

  // 5. Double Click -> Emit FLY_TO intent
  handler.setInputAction((click) => {
    emitIntent(INTENT_TYPES.FLY_TO, {
      clientX: click.position.x,
      clientY: click.position.y,
    });
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  // 6. Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') {
      emitIntent(INTENT_TYPES.NEXT_MODE);
    }
  });

  return handler;
}
