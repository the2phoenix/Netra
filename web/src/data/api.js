// @ts-check
import { state } from '../core/state.js';

const API_BASE = '/api';

export const api = {
  /**
   * Fetch backend and upstream health states
   */
  async fetchHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (!res.ok) throw new Error(`Health status ${res.status}`);
      const data = await res.json();
      state.setFeeds(data.feeds || {});
      if (data.offline || data.replay) {
        state.set('replay', true);
      }
      return data;
    } catch (err) {
      console.warn('Backend /api/health unreachable:', err);
      state.setFeeds({
        celestrak: { state: 'off', reason: 'api_unreachable' },
        adsb: { state: 'off', reason: 'api_unreachable' },
        usgs: { state: 'off', reason: 'api_unreachable' },
        firms: { state: 'off', reason: 'api_unreachable' },
      });
      return null;
    }
  },

  /**
   * Fetch satellite orbital elements
   * @param {string} [group='all']
   */
  async fetchSatellites(group = 'all') {
    try {
      const res = await fetch(`${API_BASE}/satellites?group=${encodeURIComponent(group)}&limit=3000`);
      if (!res.ok) throw new Error(`Satellites HTTP ${res.status}`);
      const data = await res.json();
      if (data.replay) {
        state.set('replay', true);
      }
      return data;
    } catch (err) {
      console.error(`Failed to fetch satellites for group '${group}':`, err);
      return null;
    }
  },
};
