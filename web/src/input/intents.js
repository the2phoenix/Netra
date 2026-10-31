// @ts-check
import { events } from '../core/events.js';

/**
 * Standard intent types decoupling input hardware from camera manipulation.
 */
export const INTENT_TYPES = {
  ROTATE: 'ROTATE',
  ZOOM: 'ZOOM',
  FLY_TO: 'FLY_TO',
  NEXT_MODE: 'NEXT_MODE',
};

/**
 * Dispatch an intent across the event bus
 * @param {string} type - INTENT_TYPES
 * @param {any} [payload]
 */
export function emitIntent(type, payload) {
  events.emit(`intent:${type}`, payload);
}
