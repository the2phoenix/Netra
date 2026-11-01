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
import { createAircraftCanvas } from './aircraftSprite.js';

/**
 * Generates an array of Cartesian3 points along a geodesic spherical arc at given altitude.
 * Prevents straight-chord clipping under Earth curvature.
 *
 * @param {number} startLat
 * @param {number} startLon
 * @param {number} endLat
 * @param {number} endLon
 * @param {number} altM
 * @param {number} [numPoints=5]
 * @returns {Array<Cesium.Cartesian3>}
 */
function computeGeodesicArcPoints(startLat, startLon, endLat, endLon, altM, numPoints = 5) {
  const startCarto = Cesium.Cartographic.fromDegrees(startLon, startLat);
  const endCarto = Cesium.Cartographic.fromDegrees(endLon, endLat);
  const geodesic = new Cesium.EllipsoidGeodesic(startCarto, endCarto);
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const frac = i / numPoints;
    const carto = geodesic.interpolateUsingFraction(frac);
    points.push(Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, altM));
  }
  return points;
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
      pixelSize: 24,
      show: false,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
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
    this.colorMilitary = Cesium.Color.fromCssColorString('#F59E0B'); // Military Amber / Gold
    this.routeColorTeal = Cesium.Color.fromCssColorString('#2DD4BF').withAlpha(0.40);
    this.routeColorCyan = Cesium.Color.fromCssColorString('#35D0E8').withAlpha(0.45);
    this.routeColorWhite = Cesium.Color.WHITE.withAlpha(0.35);
    this.routeColorAlert = Cesium.Color.fromCssColorString('#EF4444').withAlpha(0.95);
    this.routeColorMilitary = Cesium.Color.fromCssColorString('#F59E0B').withAlpha(0.60);
    this.squawkManager = new SquawkAlertManager();

    // Selected flight great-circle complete route arc (adsbdb.com)
    this.selectedRoutePolyline = this.polylineCollection.add({
      positions: [],
      width: 3.5,
      material: Cesium.Material.fromType('Color', {
        color: Cesium.Color.fromCssColorString('#38BDF8').withAlpha(0.85),
      }),
      show: false,
    });

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

    // Handle Cockpit Chase toggle from C key or Dossier button
    events.subscribe('intent:TOGGLE_COCKPIT', () => {
      if (this.selectedHex) {
        const entry = this.aircraftMap.get(this.selectedHex);
        if (entry) {
          events.emit('cockpit:toggle', {
            getPosition: () => entry.billboard.position,
            getHeading: () => entry.trackDeg,
          });
        }
      }
    });

    // Render complete great-circle route arc when enriched route arrives
    events.subscribe('aircraft:routeLoaded', (route) => {
      if (route && route.origin && route.destination && this.selectedHex) {
        const arcPoints = computeGeodesicArcPoints(
          route.origin.lat,
          route.origin.lon,
          route.destination.lat,
          route.destination.lon,
          36000 * FT_TO_M,
          28
        );
        this.selectedRoutePolyline.positions = arcPoints;
        this.selectedRoutePolyline.show = true;
      }
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
      if (item.on_ground) continue; // Parked/ground planes excluded to prevent terminal blobbing
      const hex = item.hex;
      seenHexes.add(hex);

      const altM = item.alt_ft * FT_TO_M;
      const gsMps = item.gs_kt * KT_TO_MPS;
      const vsMps = (item.vs_fpm || 0) * FPM_TO_MPS;

      // Color based on emergency squawk, military, or altitude band
      let color = this.colorCyan;
      let routeColor = this.routeColorCyan;
      if (['7700', '7600', '7500'].includes(item.squawk)) {
        color = this.colorAlert;
        routeColor = this.routeColorAlert;
      } else if (item.is_military) {
        color = this.colorMilitary;
        routeColor = this.routeColorMilitary;
      } else if (item.alt_ft < 10000) {
        color = this.colorTeal;
        routeColor = this.routeColorTeal;
      } else if (item.alt_ft > 30000) {
        color = this.colorWhite;
        routeColor = this.routeColorWhite;
      }

      let entry = this.aircraftMap.get(hex);
      if (entry) {
        // Blend in new fix over 500 ms only if target actually shifted
        const dLat = Math.abs(item.lat - entry.targetPos.lat);
        const dLon = Math.abs(item.lon - entry.targetPos.lon);
        if (dLat > 0.0005 || dLon > 0.0005) {
          entry.prevDisplayPos = { ...entry.displayPos };
          entry.targetPos = { lat: item.lat, lon: item.lon, altM };
          entry.easeStartTime = now;
        }
        entry.item = item;
        entry.gsMps = gsMps;
        entry.vsMps = vsMps;
        entry.trackDeg = item.track_deg;
        entry.t0 = now;
        entry.billboard.color = color;
        if (entry.routePolyline) {
          entry.routePolyline.material.uniforms.color = routeColor;
        }
      } else {
        // Create new billboard primitive with prominent scale and crisp visibility from space
        const pos = Cesium.Cartesian3.fromDegrees(item.lon, item.lat, altM);
        const billboard = this.collection.add({
          position: pos,
          image: this.spriteCanvas,
          scale: 1.25,
          scaleByDistance: new Cesium.NearFarScalar(1.0e4, 1.8, 3.5e7, 0.9),
          color: color,
          rotation: Cesium.Math.toRadians(item.track_deg),
          id: hex,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        });

        // 15-minute forward projected flight route vector (spherical geodesic arc)
        const forwardPred = predictPosition({
          lat: item.lat,
          lon: item.lon,
          altM,
          gsMps: Math.max(gsMps, 150),
          trackDeg: item.track_deg,
          dtSeconds: 900,
          clampDt: 1800,
        });
        const arcPositions = computeGeodesicArcPoints(
          item.lat,
          item.lon,
          forwardPred.lat,
          forwardPred.lon,
          altM,
          4
        );
        const routePolyline = this.polylineCollection.add({
          positions: arcPositions,
          width: ['7700', '7600', '7500'].includes(item.squawk) ? 2.8 : (item.is_military ? 2.0 : 1.4),
          material: Cesium.Material.fromType('Color', { color: routeColor }),
        });

        entry = {
          hex,
          item,
          billboard,
          routePolyline,
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
        if (entry.routePolyline) {
          this.polylineCollection.remove(entry.routePolyline);
        }
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
    const visualMultiplier = 12.0; // 12x perceptible smooth radar motion

    for (const [, entry] of this.aircraftMap.entries()) {
      const dt = ((now - entry.t0) / 1000) * visualMultiplier;

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

      // Dynamically update the forward flight route vector (geodesic spherical arc)
      if (entry.routePolyline) {
        const forward = predictPosition({
          lat: entry.displayPos.lat,
          lon: entry.displayPos.lon,
          altM: entry.displayPos.altM,
          gsMps: Math.max(entry.gsMps, 150),
          trackDeg: entry.trackDeg,
          vsMps: entry.vsMps,
          dtSeconds: 900,
          clampDt: 1800,
        });
        entry.routePolyline.positions = computeGeodesicArcPoints(
          entry.displayPos.lat,
          entry.displayPos.lon,
          forward.lat,
          forward.lon,
          entry.displayPos.altM,
          4
        );
      }

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
    this.selectedRoutePolyline.show = false;
    this.selectedRoutePolyline.positions = [];
    this.trailPositions = [];
    state.set('selected', null);
    events.emit('aircraft:deselected', null);
    events.emit('cockpit:clear', null);
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

