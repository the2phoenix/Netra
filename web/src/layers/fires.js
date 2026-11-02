// @ts-check
import * as Cesium from 'cesium';
import { state } from '../core/state.js';
import { events } from '../core/events.js';

/**
 * Active Fire Hotspots Layer (REQ HAZ-02)
 * Renders thermal anomaly hotspots from NASA FIRMS VIIRS/MODIS satellites.
 */
export class FiresLayer {
  /**
   * @param {Cesium.Viewer} viewer
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.collection = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());

    // Highlight target marker for selected hotspot
    this.selectionCollection = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());
    this.highlightPoint = this.selectionCollection.add({
      position: Cesium.Cartesian3.ZERO,
      color: Cesium.Color.fromCssColorString('#FF6A1A').withAlpha(0.7),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      pixelSize: 16,
      show: false,
    });

    /** @type {Map<string, any>} */
    this.fireMap = new Map();
    /** @type {string|null} */
    this.selectedKey = null;

    this.fireColor = Cesium.Color.fromCssColorString('#FF6A1A'); // --ember token
    this.highFrpColor = Cesium.Color.fromCssColorString('#EF4444'); // high intensity

    this.setupPicking();

    // Layer visibility subscription
    events.subscribe('state:layers', (layers) => {
      this.collection.show = layers.fires;
      this.selectionCollection.show = layers.fires;
      if (!layers.fires && this.selectedKey) {
        this.clearSelection();
      }
    });

    // Dossier actions
    events.subscribe('dossier:flyToFire', (key) => {
      if (this.selectedKey === key) {
        this.flyToSelected();
      }
    });

    events.subscribe('dossier:clearFire', () => {
      this.clearSelection();
    });
  }

  setupPicking() {
    const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas);
    handler.setInputAction((movement) => {
      if (!this.collection.show) return;

      const picked = this.viewer.scene.pick(movement.position);
      if (Cesium.defined(picked) && picked.primitive && picked.id && this.fireMap.has(picked.id)) {
        this.selectFire(picked.id);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    this.pickHandler = handler;
  }

  /**
   * Load fire hotspots from API payload
   * @param {Array<any>} items
   */
  loadFires(items) {
    this.collection.removeAll();
    this.fireMap.clear();

    for (let i = 0; i < items.length; i++) {
      const f = items[i];
      const key = `${f.lat}_${f.lon}_${i}`;
      const pos = Cesium.Cartesian3.fromDegrees(f.lon, f.lat, 50);

      const isHighFrp = (f.frp || 0) > 80;
      const point = this.collection.add({
        position: pos,
        color: isHighFrp ? this.highFrpColor : this.fireColor,
        pixelSize: isHighFrp ? 5 : 3,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
        id: key,
        disableDepthTestDistance: 25000.0,
      });

      this.fireMap.set(key, { item: f, point });
    }

    events.emit('fires:updated', items);
    state.setCount('fire', items.length);
  }

  selectFire(key) {
    const entry = this.fireMap.get(key);
    if (!entry) return;

    this.selectedKey = key;
    state.set('selected', { type: 'fire', id: key });

    this.highlightPoint.position = entry.point.position;
    this.highlightPoint.show = true;

    events.emit('fire:selected', entry.item);
  }

  clearSelection() {
    this.selectedKey = null;
    this.highlightPoint.show = false;
    state.set('selected', null);
    events.emit('fire:deselected', null);
  }

  flyToSelected() {
    if (!this.selectedKey) return;
    const entry = this.fireMap.get(this.selectedKey);
    if (!entry) return;

    this.viewer.camera.flyToBoundingSphere(
      new Cesium.BoundingSphere(entry.point.position, 120000), // 120 km framing
      { duration: 1.8 }
    );
  }

  destroy() {
    if (this.pickHandler) this.pickHandler.destroy();
    this.viewer.scene.primitives.remove(this.collection);
    this.viewer.scene.primitives.remove(this.selectionCollection);
  }
}

