// @ts-check
import { emitIntent, INTENT_TYPES } from './intents.js';

/**
 * Initializes mouse and keyboard input handlers.
 * Emits abstract intents so camera logic remains decoupled.
 *
 * @param {HTMLElement} element
 */
export function initMouseInput(element) {
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  element.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // Left click
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    emitIntent(INTENT_TYPES.ROTATE, { dx, dy });
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  element.addEventListener('wheel', (e) => {
    e.preventDefault();
    emitIntent(INTENT_TYPES.ZOOM, { dz: e.deltaY });
  }, { passive: false });

  element.addEventListener('dblclick', (e) => {
    emitIntent(INTENT_TYPES.FLY_TO, { clientX: e.clientX, clientY: e.clientY });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') {
      emitIntent(INTENT_TYPES.NEXT_MODE);
    }
  });
}
