// @ts-check
import { events } from './events.js';

/**
 * Central state store.
 * Holds summary counts, layer toggles, active selection, and feed statuses.
 * Raw high-frequency entity positions stay outside the reactive store.
 */
export const state = {
  counts: {
    sat: 0,
    air: 0,
    quake: 0,
    fire: 0,
  },
  feeds: {
    celestrak: { state: 'off', age_s: 0 },
    adsb: { state: 'off', age_s: 0 },
    usgs: { state: 'off', age_s: 0 },
    firms: { state: 'off', age_s: 0 },
  },
  layers: {
    satellites: true,
    aircraft: true,
    quakes: true,
    fires: false,
    cctv: true,
    nightLights: true,
  },
  mode: 'normal', // 'normal' | 'night-vision' | 'thermal'
  selected: null, // { type: 'sat' | 'air' | 'quake', id: string | number } | null
  replay: false,
  camera: {
    lat: 0,
    lon: 0,
    altKm: 20000,
    fps: 60,
  },

  /**
   * @param {string} key
   * @param {any} val
   */
  set(key, val) {
    // @ts-ignore
    state[key] = val;
    events.emit(`state:${key}`, val);
  },

  /**
   * Update layer count and broadcast
   * @param {'sat'|'air'|'quake'|'fire'} layer
   * @param {number} count
   */
  setCount(layer, count) {
    state.counts[layer] = count;
    events.emit('counts:updated', state.counts);
  },

  /**
   * Update feed health and broadcast
   * @param {Record<string, any>} feeds
   */
  setFeeds(feeds) {
    state.feeds = feeds;
    events.emit('feeds:updated', state.feeds);
  },
};
