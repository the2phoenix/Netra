// @ts-check
import * as Cesium from 'cesium';
import { emitIntent, INTENT_TYPES } from './intents.js';

/**
 * Initializes mouse and keyboard input handlers using Cesium ScreenSpaceEventHandler.
 * Supports smooth 3D globe panning (Left Drag) and free 3D tilt & rotation (Right Drag / Middle Drag).
 *
 * @param {Cesium.Viewer} viewer
 */
export function initMouseInput(viewer) {
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

  let isLeftDragging = false;
  let isRightDragging = false;
  let lastX = 0;
  let lastY = 0;

  // 1. Left Mouse Down -> Begin Pan/Rotate
  handler.setInputAction((click) => {
    isLeftDragging = true;
    lastX = click.position.x;
    lastY = click.position.y;
  }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

  // 2. Right Mouse Down -> Begin 3D Tilt/Heading Orbit
  handler.setInputAction((click) => {
    isRightDragging = true;
    lastX = click.position.x;
    lastY = click.position.y;
  }, Cesium.ScreenSpaceEventType.RIGHT_DOWN);

  // Middle Click Down -> Also enables 3D Tilt
  handler.setInputAction((click) => {
    isRightDragging = true;
    lastX = click.position.x;
    lastY = click.position.y;
  }, Cesium.ScreenSpaceEventType.MIDDLE_DOWN);

  // 3. Mouse Move -> Emit ROTATE or TILT intent
  handler.setInputAction((movement) => {
    if (!movement.endPosition) return;
    const currentX = movement.endPosition.x;
    const currentY = movement.endPosition.y;
    const dx = currentX - lastX;
    const dy = currentY - lastY;
    lastX = currentX;
    lastY = currentY;

    if (isRightDragging) {
      if (dx !== 0 || dy !== 0) {
        emitIntent(INTENT_TYPES.TILT, { dx, dy });
      }
    } else if (isLeftDragging) {
      if (dx !== 0 || dy !== 0) {
        emitIntent(INTENT_TYPES.ROTATE, { dx, dy });
      }
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  // 4. Mouse Up -> End drags
  handler.setInputAction(() => {
    isLeftDragging = false;
  }, Cesium.ScreenSpaceEventType.LEFT_UP);

  handler.setInputAction(() => {
    isRightDragging = false;
  }, Cesium.ScreenSpaceEventType.RIGHT_UP);

  handler.setInputAction(() => {
    isRightDragging = false;
  }, Cesium.ScreenSpaceEventType.MIDDLE_UP);

  // Catch pointer releases outside the canvas
  window.addEventListener('mouseup', () => {
    isLeftDragging = false;
    isRightDragging = false;
  });
  window.addEventListener('pointerup', () => {
    isLeftDragging = false;
    isRightDragging = false;
  });

  // 5. Scroll Wheel -> Emit ZOOM intent
  handler.setInputAction((delta) => {
    emitIntent(INTENT_TYPES.ZOOM, { dz: -delta });
  }, Cesium.ScreenSpaceEventType.WHEEL);

  // 6. Double Click -> Emit FLY_TO intent
  handler.setInputAction((click) => {
    emitIntent(INTENT_TYPES.FLY_TO, {
      clientX: click.position.x,
      clientY: click.position.y,
    });
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  // 7. Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;
    if (e.key === 'm' || e.key === 'M') {
      emitIntent(INTENT_TYPES.NEXT_MODE);
    }
  });

  return handler;
}
