// @ts-check
import * as Cesium from 'cesium';
import { state } from '../core/state.js';
import { events } from '../core/events.js';

/**
 * High-performance satellite rendering using Cesium PointPrimitiveCollection.
 */
export class SatellitesLayer {
  /**
   * @param {Cesium.Viewer} viewer
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.collection = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());
    /** @type {Map<number, Cesium.PointPrimitive>} */
    this.pointMap = new Map();
    this.satColor = Cesium.Color.fromCssColorString('#35D0E8'); // --sat token
    this.issColor = Cesium.Color.fromCssColorString('#FF6A1A'); // --ember for ISS

    // Spawn SGP4 worker
    this.worker = new Worker(new URL('../workers/sgp4.worker.js', import.meta.url), {
      type: 'module',
    });

    this.worker.onmessage = this.handleWorkerMessage.bind(this);

    // React to layer visibility toggle
    events.subscribe('state:layers', (layers) => {
      this.collection.show = layers.satellites;
    });
  }

  /**
   * Initialize satellites from API payload
   * @param {Array<any>} items
   */
  loadSatellites(items) {
    // Clear existing
    this.collection.removeAll();
    this.pointMap.clear();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isIss = item.norad_cat_id === 25544;
      const point = this.collection.add({
        position: Cesium.Cartesian3.ZERO,
        color: isIss ? this.issColor : this.satColor,
        pixelSize: isIss ? 6 : 3,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
        id: item.norad_cat_id,
      });
      this.pointMap.set(item.norad_cat_id, point);
    }

    state.setCount('sat', items.length);

    // Send elements to worker for SGP4 propagation loop
    this.worker.postMessage({
      type: 'INIT_SATELLITES',
      payload: items,
    });
  }

  /**
   * Handle worker position update batch
   * @param {MessageEvent} event
   */
  handleWorkerMessage(event) {
    const { type, count, positions, ids } = event.data;
    if (type !== 'POSITIONS_UPDATED') return;

    const posFloats = new Float32Array(positions);
    const idInts = new Int32Array(ids);

    for (let i = 0; i < count; i++) {
      const id = idInts[i];
      const point = this.pointMap.get(id);
      if (point) {
        const base = i * 3;
        point.position = new Cesium.Cartesian3(
          posFloats[base],
          posFloats[base + 1],
          posFloats[base + 2]
        );
      }
    }
  }

  destroy() {
    this.worker.terminate();
    this.viewer.scene.primitives.remove(this.collection);
  }
}
