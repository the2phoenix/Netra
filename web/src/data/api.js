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

  /**
   * Fetch live aircraft positions merged across international hubs
   */
  async fetchFlights() {
    try {
      const res = await fetch(`${API_BASE}/flights?limit=3000`);
      if (!res.ok) throw new Error(`Flights HTTP ${res.status}`);
      const data = await res.json();
      if (data.replay) {
        state.set('replay', true);
      }
      return data;
    } catch (err) {
      console.warn('Failed to fetch live flights:', err);
      return null;
    }
  },

  /**
   * Fetch hub definitions
   */
  async fetchHubs() {
    try {
      const res = await fetch(`${API_BASE}/meta/hubs`);
      if (!res.ok) throw new Error(`Hubs HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Failed to fetch hubs:', err);
      return null;
    }
  },

  /**
   * Fetch live earthquakes from USGS
   * @param {number} [minMag=2.5]
   * @param {string} [window='day']
   */
  async fetchQuakes(minMag = 2.5, window = 'day') {
    try {
      const res = await fetch(`${API_BASE}/quakes?min_mag=${minMag}&window=${window}`);
      if (!res.ok) throw new Error(`Quakes HTTP ${res.status}`);
      const data = await res.json();
      if (data.replay) {
        state.set('replay', true);
      }
      return data;
    } catch (err) {
      console.warn('Failed to fetch quakes:', err);
      return null;
    }
  },

  /**
   * Fetch active fire hotspots from NASA FIRMS
   * @param {number} [dayRange=1]
   */
  async fetchFires(dayRange = 1) {
    try {
      const res = await fetch(`${API_BASE}/fires?day_range=${dayRange}`);
      if (!res.ok) {
        // 503 means FIRMS key is disabled
        return null;
      }
      const data = await res.json();
      if (data.replay) {
        state.set('replay', true);
      }
      return data;
    } catch (err) {
      console.warn('Failed to fetch fires:', err);
      return null;
    }
  },
};
