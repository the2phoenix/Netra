// @ts-check
import * as Cesium from 'cesium';
import { state } from '../core/state.js';
import { events } from '../core/events.js';
import {
  predictPosition,
  easePosition,
  FT_TO_M,
  KT_TO_MPS,
  FPM_TO_MPS,
} from '../geo/deadReckoning.js';
import { SquawkAlertManager } from '../geo/scan.js';

/**
 * Creates an oriented aircraft silhouette sprite on a 24x24 canvas.
 * @returns {HTMLCanvasElement}
 */
function createAircraftCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 28;
  canvas.height = 28;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  // Sleek aircraft silhouette pointing straight UP (0° heading)
  ctx.moveTo(14, 2);   // Nose
  ctx.lineTo(16, 9);   // Cockpit right
  ctx.lineTo(26, 17);  // Right wingtip
  ctx.lineTo(26, 19);  // Wing edge
  ctx.lineTo(16, 16);  // Wing root right
  ctx.lineTo(16, 23);  // Fuselage aft
  ctx.lineTo(20, 26);  // Right horizontal stabilizer
  ctx.lineTo(20, 27);
  ctx.lineTo(14, 25);  // Tail aft center
  ctx.lineTo(8, 27);   // Left horizontal stabilizer
  ctx.lineTo(8, 26);
  ctx.lineTo(12, 23);
  ctx.lineTo(12, 16);
  ctx.lineTo(2, 19);   // Wing edge left
  ctx.lineTo(2, 17);   // Left wingtip
  ctx.lineTo(12, 9);
  ctx.closePath();
  ctx.fill();

  return canvas;
}

/**
 * High-performance GPU-instanced live aircraft layer.
 * Updates dead reckoning every animation frame to ensure silky 60 FPS motion without stuttering.
 */
export class AircraftLayer {
  /**
   * @param {Cesium.Viewer} viewer
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.collection = viewer.scene.primitives.add(new Cesium.BillboardCollection());
    this.spriteCanvas = createAircraftCanvas();

    // Selection ring / marker
    this.selectionCollection = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());
    this.highlightPoint = this.selectionCollection.add({
      position: Cesium.Cartesian3.ZERO,
      color: Cesium.Color.fromCssColorString('#35D0E8').withAlpha(0.8),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      pixelSize: 18,
      show: false,
    });

    // Trail polyline for selected aircraft
    this.polylineCollection = viewer.scene.primitives.add(new Cesium.PolylineCollection());
    this.trailPolyline = this.polylineCollection.add({
      positions: [],
      width: 2.0,
      material: Cesium.Material.fromType('Color', {
        color: Cesium.Color.fromCssColorString('#35D0E8').withAlpha(0.6),
      }),
      show: false,
    });

    /** @type {Map<string, any>} */
    this.aircraftMap = new Map();
    /** @type {string|null} */
    this.selectedHex = null;
    /** @type {Array<Cesium.Cartesian3>} */
    this.trailPositions = [];

    // Pre-allocated scratch Cartesian3 to prevent per-frame garbage collection
    this.scratchCartesian = new Cesium.Cartesian3();

    // Altitude color palette
    this.colorTeal = Cesium.Color.fromCssColorString('#2DD4BF'); // < 10k ft
    this.colorCyan = Cesium.Color.fromCssColorString('#35D0E8'); // 10k - 30k ft
    this.colorWhite = Cesium.Color.WHITE;                       // > 30k ft
    this.colorAlert = Cesium.Color.fromCssColorString('#EF4444'); // Squawk 7700 / 7600 / 7500
    this.squawkManager = new SquawkAlertManager();

    // Hook frame render loop
    this.removePreRender = viewer.scene.preRender.addEventListener(this.onPreRender.bind(this));

    // Setup picking
    this.setupPicking();

    // Layer visibility subscription
    events.subscribe('state:layers', (layers) => {
      this.collection.show = layers.aircraft;
      this.selectionCollection.show = layers.aircraft;
      this.polylineCollection.show = layers.aircraft;
      if (!layers.aircraft && this.selectedHex) {
        this.clearSelection();
      }
    });

    // Dossier actions
    events.subscribe('dossier:flyToAircraft', (hex) => {
      if (this.selectedHex === hex) {
        this.flyToSelected();
      }
    });

    events.subscribe('dossier:clearAircraft', () => {
      this.clearSelection();
    });
  }

  setupPicking() {
    const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas);
    handler.setInputAction((movement) => {
      if (!this.collection.show) return;

      const picked = this.viewer.scene.pick(movement.position);
      if (Cesium.defined(picked) && picked.primitive && picked.id && this.aircraftMap.has(picked.id)) {
        this.selectAircraft(picked.id);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    this.pickHandler = handler;
  }

  /**
   * Update layer with new batch from API
   * @param {Array<any>} items
   */
  updateFlights(items) {
    const now = Date.now();
    const seenHexes = new Set();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const hex = item.hex;
      seenHexes.add(hex);

      const altM = item.alt_ft * FT_TO_M;
      const gsMps = item.gs_kt * KT_TO_MPS;
      const vsMps = (item.vs_fpm || 0) * FPM_TO_MPS;

      // Color based on emergency squawk or altitude
      let color = this.colorCyan;
      if (['7700', '7600', '7500'].includes(item.squawk)) {
        color = this.colorAlert;
      } else if (item.alt_ft < 10000) {
        color = this.colorTeal;
      } else if (item.alt_ft > 30000) {
        color = this.colorWhite;
      }

      let entry = this.aircraftMap.get(hex);
      if (entry) {
        // Blend in new fix over 500 ms (REQ FLT-01, T-GEO-13)
        entry.prevDisplayPos = { ...entry.displayPos };
        entry.targetPos = { lat: item.lat, lon: item.lon, altM };
        entry.item = item;
        entry.gsMps = gsMps;
        entry.vsMps = vsMps;
        entry.trackDeg = item.track_deg;
        entry.t0 = now;
        entry.easeStartTime = now;
        entry.billboard.color = color;
      } else {
        // Create new billboard primitive
        const pos = Cesium.Cartesian3.fromDegrees(item.lon, item.lat, altM);
        const billboard = this.collection.add({
          position: pos,
          image: this.spriteCanvas,
          scale: 0.75,
          color: color,
          rotation: Cesium.Math.toRadians(item.track_deg),
          id: hex,
        });

        entry = {
          hex,
          item,
          billboard,
          t0: now,
          easeStartTime: 0,
          displayPos: { lat: item.lat, lon: item.lon, altM },
          targetPos: { lat: item.lat, lon: item.lon, altM },
          prevDisplayPos: { lat: item.lat, lon: item.lon, altM },
          gsMps,
          vsMps,
          trackDeg: item.track_deg,
        };
        this.aircraftMap.set(hex, entry);
      }
    }

    // Cleanup aircraft older than 60s
    for (const [hex, entry] of this.aircraftMap.entries()) {
      if (!seenHexes.has(hex) && now - entry.t0 > 60000) {
        this.collection.remove(entry.billboard);
        this.aircraftMap.delete(hex);
        if (this.selectedHex === hex) {
          this.clearSelection();
        }
      }
    }

    // Process emergency squawks (FLT-03, single-fire)
    const emergencyAlerts = this.squawkManager.processAircraft(items);
    for (let i = 0; i < emergencyAlerts.length; i++) {
      events.emit('squawk:alert', emergencyAlerts[i]);
    }

    // Emit live aircraft array for scan mode and geofence monitoring
    events.emit('aircraft:updated', items);

    state.setCount('air', this.aircraftMap.size);
  }

  /**
   * Per-frame dead reckoning update loop
   */
  onPreRender() {
    if (!this.collection.show || this.aircraftMap.size === 0) return;

    const now = Date.now();

    for (const [, entry] of this.aircraftMap.entries()) {
      const dt = (now - entry.t0) / 1000;

      // Predict dead-reckoned forward position
      const predicted = predictPosition({
        lat: entry.targetPos.lat,
        lon: entry.targetPos.lon,
        altM: entry.targetPos.altM,
        gsMps: entry.gsMps,
        trackDeg: entry.trackDeg,
        vsMps: entry.vsMps,
        dtSeconds: dt,
        clampDt: 90,
        onGround: entry.item.on_ground,
      });

      // Easing blend over 500 ms if fresh fix arrived
      if (entry.easeStartTime > 0 && now - entry.easeStartTime < 500) {
        const easeDt = (now - entry.easeStartTime) / 1000;
        entry.displayPos = easePosition(entry.prevDisplayPos, predicted, easeDt, 0.5);
      } else {
        entry.displayPos = predicted;
      }

      // Convert to Cesium Cartesian3
      const pos = Cesium.Cartesian3.fromDegrees(
        entry.displayPos.lon,
        entry.displayPos.lat,
        entry.displayPos.altM,
        Cesium.Ellipsoid.WGS84,
        this.scratchCartesian
      );

      entry.billboard.position = pos;
      entry.billboard.rotation = Cesium.Math.toRadians(entry.trackDeg);

      // Selected aircraft tracking
      if (this.selectedHex === entry.hex) {
        this.highlightPoint.position = pos;

        // Append to breadcrumb trail periodically
        if (!this.lastTrailTime || now - this.lastTrailTime > 2000) {
          this.lastTrailTime = now;
          this.trailPositions.push(Cesium.Cartesian3.clone(pos));
          if (this.trailPositions.length > 150) {
            this.trailPositions.shift();
          }
          this.trailPolyline.positions = this.trailPositions;
        }

        // Live telemetry update to dossier
        events.emit('aircraft:telemetry', {
          ...entry.item,
          lat: entry.displayPos.lat,
          lon: entry.displayPos.lon,
          alt_ft: Math.round(entry.displayPos.altM / FT_TO_M),
        });
      }
    }
  }

  /**
   * Select aircraft by hex code
   * @param {string} hex
   */
  selectAircraft(hex) {
    const entry = this.aircraftMap.get(hex);
    if (!entry) return;

    this.selectedHex = hex;
    state.set('selected', { type: 'air', id: hex });

    this.highlightPoint.position = entry.billboard.position;
    this.highlightPoint.show = true;

    // Reset trail
    this.trailPositions = [Cesium.Cartesian3.clone(entry.billboard.position)];
    this.trailPolyline.positions = this.trailPositions;
    this.trailPolyline.show = true;
    this.lastTrailTime = Date.now();

    events.emit('aircraft:selected', entry.item);
  }

  clearSelection() {
    this.selectedHex = null;
    this.highlightPoint.show = false;
    this.trailPolyline.show = false;
    this.trailPositions = [];
    state.set('selected', null);
    events.emit('aircraft:deselected', null);
  }

  flyToSelected() {
    if (!this.selectedHex) return;
    const entry = this.aircraftMap.get(this.selectedHex);
    if (!entry) return;

    this.viewer.camera.flyToBoundingSphere(
      new Cesium.BoundingSphere(entry.billboard.position, 60000), // 60 km framing
      { duration: 1.8 }
    );
  }

  destroy() {
    if (this.removePreRender) this.removePreRender();
    if (this.pickHandler) this.pickHandler.destroy();
    this.viewer.scene.primitives.remove(this.collection);
    this.viewer.scene.primitives.remove(this.selectionCollection);
    this.viewer.scene.primitives.remove(this.polylineCollection);
  }
}

