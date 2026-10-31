// @ts-check
import * as Cesium from 'cesium';
import { state } from '../core/state.js';
import { events } from '../core/events.js';

/**
 * High-performance satellite rendering using Cesium PointPrimitiveCollection.
 * Supports multi-group styling, category toggling, raycast picking, and real-time telemetry.
 */
export class SatellitesLayer {
  /**
   * @param {Cesium.Viewer} viewer
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.collection = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());

    // Highlight ring for selected satellite
    this.selectionCollection = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());
    this.highlightPoint = this.selectionCollection.add({
      position: Cesium.Cartesian3.ZERO,
      color: Cesium.Color.fromCssColorString('#FF6A1A').withAlpha(0.8),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      pixelSize: 14,
      show: false,
    });

    /** @type {Map<number, Cesium.PointPrimitive>} */
    this.pointMap = new Map();
    /** @type {Map<number, any>} */
    this.itemMap = new Map();

    /** @type {number|null} */
    this.selectedId = null;
    this.telemetryInterval = null;

    // Constellation styling palette
    this.colors = {
      stations: Cesium.Color.fromCssColorString('#FF6A1A'),
      'gps-ops': Cesium.Color.fromCssColorString('#35D0E8'),
      weather: Cesium.Color.fromCssColorString('#34D399'),
      science: Cesium.Color.fromCssColorString('#A78BFA'),
      geo: Cesium.Color.fromCssColorString('#FBBF24'),
      starlink: Cesium.Color.fromCssColorString('#94A3B8'),
    };

    // Category visibility state
    this.groupVisibility = {
      stations: true,
      'gps-ops': true,
      weather: true,
      science: true,
      geo: true,
      starlink: true,
    };

    // Spawn SGP4 worker
    this.worker = new Worker(new URL('../workers/sgp4.worker.js', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = this.handleWorkerMessage.bind(this);

    // Setup raycast primitive picking
    this.setupPicking();

    // React to global layer toggle
    events.subscribe('state:layers', (layers) => {
      this.collection.show = layers.satellites;
      this.selectionCollection.show = layers.satellites;
      if (!layers.satellites && this.selectedId) {
        this.clearSelection();
      }
    });

    // React to category toggles from layer panel
    events.subscribe('satellites:toggleGroup', ({ group, visible }) => {
      this.setGroupVisibility(group, visible);
    });

    // React to dossier fly-to intent
    events.subscribe('dossier:flyTo', (id) => {
      if (this.selectedId === id) {
        this.flyToSelected();
      }
    });

    events.subscribe('dossier:clear', () => {
      this.clearSelection();
    });
  }

  /**
   * Set up raycast primitive picking on viewer canvas
   */
  setupPicking() {
    const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas);
    handler.setInputAction((movement) => {
      if (!this.collection.show) return;

      const picked = this.viewer.scene.pick(movement.position);
      if (Cesium.defined(picked) && picked.primitive && picked.id && this.itemMap.has(picked.id)) {
        this.selectSatellite(picked.id);
      } else {
        // If clicked on empty space (not a satellite), deselect
        if (this.selectedId) {
          this.clearSelection();
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    this.pickHandler = handler;
  }

  /**
   * Initialize satellites from API payload
   * @param {Array<any>} items
   */
  loadSatellites(items) {
    this.collection.removeAll();
    this.pointMap.clear();
    this.itemMap.clear();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const grp = item.group || 'science';
      const isIss = item.norad_cat_id === 25544;

      const color = isIss
        ? this.colors.stations
        : this.colors[grp] || this.colors.science;

      let pixelSize = 3;
      if (isIss) pixelSize = 7;
      else if (grp === 'stations') pixelSize = 6;
      else if (grp === 'gps-ops') pixelSize = 4;
      else if (grp === 'starlink') pixelSize = 2;

      const point = this.collection.add({
        position: Cesium.Cartesian3.ZERO,
        color: color,
        pixelSize: pixelSize,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
        id: item.norad_cat_id,
        show: this.groupVisibility[grp] !== false,
      });

      this.pointMap.set(item.norad_cat_id, point);
      this.itemMap.set(item.norad_cat_id, item);
    }

    this.updateActiveCount();

    // Send elements to worker for SGP4 propagation loop
    this.worker.postMessage({
      type: 'INIT_SATELLITES',
      payload: items,
    });
  }

  /**
   * Toggle visibility of a specific satellite constellation group
   * @param {string} group
   * @param {boolean} visible
   */
  setGroupVisibility(group, visible) {
    this.groupVisibility[group] = visible;

    for (const [id, item] of this.itemMap.entries()) {
      if ((item.group || 'science') === group) {
        const point = this.pointMap.get(id);
        if (point) {
          point.show = visible;
        }
      }
    }

    if (this.selectedId) {
      const selItem = this.itemMap.get(this.selectedId);
      if (selItem && selItem.group === group && !visible) {
        this.clearSelection();
      }
    }

    this.updateActiveCount();
  }

  updateActiveCount() {
    let count = 0;
    for (const [, point] of this.pointMap.entries()) {
      if (point.show) count++;
    }
    state.setCount('sat', count);
  }

  /**
   * Select a satellite and open its dossier
   * @param {number} noradId
   */
  selectSatellite(noradId) {
    this.selectedId = noradId;
    state.set('selected', { type: 'sat', id: noradId });

    const point = this.pointMap.get(noradId);
    if (point) {
      this.highlightPoint.position = point.position;
      this.highlightPoint.show = true;
    }

    // Request immediate telemetry
    this.requestTelemetry(noradId);

    // Poll live telemetry every second
    if (this.telemetryInterval) clearInterval(this.telemetryInterval);
    this.telemetryInterval = setInterval(() => {
      if (this.selectedId === noradId) {
        this.requestTelemetry(noradId);
      }
    }, 1000);
  }

  requestTelemetry(noradId) {
    this.worker.postMessage({
      type: 'GET_TELEMETRY',
      payload: { id: noradId },
    });
  }

  clearSelection() {
    this.selectedId = null;
    this.highlightPoint.show = false;
    state.set('selected', null);
    if (this.telemetryInterval) {
      clearInterval(this.telemetryInterval);
      this.telemetryInterval = null;
    }
    events.emit('satellite:deselected', null);
  }

  /**
   * Smoothly fly camera to selected satellite
   */
  flyToSelected() {
    if (!this.selectedId) return;
    const point = this.pointMap.get(this.selectedId);
    if (!point || Cesium.Cartesian3.equals(point.position, Cesium.Cartesian3.ZERO)) return;

    this.viewer.camera.flyToBoundingSphere(
      new Cesium.BoundingSphere(point.position, 1200000), // 1200 km framing distance
      { duration: 2.0 }
    );
  }

  /**
   * Handle worker position update batch and telemetry results
   * @param {MessageEvent} event
   */
  handleWorkerMessage(event) {
    const { type, count, positions, ids, telemetry } = event.data;

    if (type === 'POSITIONS_UPDATED') {
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

          // Update highlight ring position if this is the selected satellite
          if (this.selectedId === id) {
            this.highlightPoint.position = point.position;
          }
        }
      }
    } else if (type === 'TELEMETRY_UPDATED' && telemetry) {
      if (this.selectedId === telemetry.id) {
        events.emit('satellite:telemetry', telemetry);
      }
    }
  }

  destroy() {
    if (this.telemetryInterval) clearInterval(this.telemetryInterval);
    if (this.pickHandler) this.pickHandler.destroy();
    this.worker.terminate();
    this.viewer.scene.primitives.remove(this.collection);
    this.viewer.scene.primitives.remove(this.selectionCollection);
  }
}
