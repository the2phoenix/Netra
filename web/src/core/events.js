// @ts-check
/**
 * Lightweight pub/sub event bus for decoupled NETRA components.
 */

/** @type {Record<string, Array<(payload: any) => void>>} */
const listeners = {};

export const events = {
  /**
   * @param {string} topic
   * @param {(payload: any) => void} fn
   * @returns {() => void} unsubscribe function
   */
  subscribe(topic, fn) {
    if (!listeners[topic]) {
      listeners[topic] = [];
    }
    listeners[topic].push(fn);
    return () => {
      listeners[topic] = listeners[topic].filter((cb) => cb !== fn);
    };
  },

  /**
   * @param {string} topic
   * @param {any} [payload]
   */
  emit(topic, payload) {
    const cbs = listeners[topic];
    if (cbs) {
      for (let i = 0; i < cbs.length; i++) {
        cbs[i](payload);
      }
    }
  },
};
