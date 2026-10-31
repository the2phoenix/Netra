// @ts-check
import * as Cesium from 'cesium';
import { state } from '../core/state.js';
import { events } from '../core/events.js';

/**
 * Earthquakes Layer (REQ HAZ-01)
 * Renders seismic events from USGS past 24h scaled by magnitude with interactive picking and ripple focus.
 */
export class QuakesLayer {
  /**
   * @param {Cesium.Viewer} viewer
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.collection = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());

    // Highlight target marker for selected quake
    this.selectionCollection = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());
    this.highlightPoint = this.selectionCollection.add({
      position: Cesium.Cartesian3.ZERO,
      color: Cesium.Color.fromCssColorString('#EF4444').withAlpha(0.6),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      pixelSize: 22,
      show: false,
    });

    /** @type {Map<string, any>} */
    this.quakeMap = new Map();
    /** @type {string|null} */
    this.selectedId = null;

    // Color ramp by magnitude
    this.colorLow = Cesium.Color.fromCssColorString('#FBBF24');  // M < 4.5
    this.colorMid = Cesium.Color.fromCssColorString('#FB923C');  // M 4.5 - 6.0
    this.colorHigh = Cesium.Color.fromCssColorString('#EF4444'); // M 6.0+

    this.setupPicking();

    // Layer visibility subscription
    events.subscribe('state:layers', (layers) => {
      this.collection.show = layers.quakes;
      this.selectionCollection.show = layers.quakes;
      if (!layers.quakes && this.selectedId) {
        this.clearSelection();
      }
    });

    // Dossier actions
    events.subscribe('dossier:flyToQuake', (id) => {
      if (this.selectedId === id) {
        this.flyToSelected();
      }
    });

    events.subscribe('dossier:clearQuake', () => {
      this.clearSelection();
    });
  }

  setupPicking() {
    const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas);
    handler.setInputAction((movement) => {
      if (!this.collection.show) return;

      const picked = this.viewer.scene.pick(movement.position);
      if (Cesium.defined(picked) && picked.primitive && picked.id && this.quakeMap.has(picked.id)) {
        this.selectQuake(picked.id);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    this.pickHandler = handler;
  }

  /**
   * Load quakes from API payload
   * @param {Array<any>} items
   */
  loadQuakes(items) {
    this.collection.removeAll();
    this.quakeMap.clear();

    for (let i = 0; i < items.length; i++) {
      const q = items[i];
      const pos = Cesium.Cartesian3.fromDegrees(q.lon, q.lat, 100);

      let color = this.colorLow;
      let size = 6;
      if (q.mag >= 6.0) {
        color = this.colorHigh;
        size = 14;
      } else if (q.mag >= 4.5) {
        color = this.colorMid;
        size = 9;
      }

      const point = this.collection.add({
        position: pos,
        color: color,
        pixelSize: size,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1.5,
        id: q.id,
      });

      this.quakeMap.set(q.id, { item: q, point });
    }

    state.setCount('quake', items.length);
  }

  selectQuake(id) {
    const entry = this.quakeMap.get(id);
    if (!entry) return;

    this.selectedId = id;
    state.set('selected', { type: 'quake', id });

    this.highlightPoint.position = entry.point.position;
    this.highlightPoint.show = true;

    events.emit('quake:selected', entry.item);
  }

  clearSelection() {
    this.selectedId = null;
    this.highlightPoint.show = false;
    state.set('selected', null);
    events.emit('quake:deselected', null);
  }

  flyToSelected() {
    if (!this.selectedId) return;
    const entry = this.quakeMap.get(this.selectedId);
    if (!entry) return;

    this.viewer.camera.flyToBoundingSphere(
      new Cesium.BoundingSphere(entry.point.position, 350000), // 350 km framing
      { duration: 1.8 }
    );
  }

  destroy() {
    if (this.pickHandler) this.pickHandler.destroy();
    this.viewer.scene.primitives.remove(this.collection);
    this.viewer.scene.primitives.remove(this.selectionCollection);
  }
}
