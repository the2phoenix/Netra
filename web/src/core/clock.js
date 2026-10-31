// @ts-check
import { events } from './events.js';

let intervalId = null;

export const clock = {
  start() {
    if (intervalId) return;
    const tick = () => {
      const now = new Date();
      const utcString = now.toISOString().substring(11, 19);
      events.emit('clock:tick', { now, utcString });
    };
    tick();
    intervalId = setInterval(tick, 1000);
  },

  stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  },
};
