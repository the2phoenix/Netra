// @ts-check
import * as Cesium from 'cesium';
import * as satellite from 'satellite.js';
import { computeFootprintRadius, splitGroundTrackAtAntimeridian, calculateElevationDeg } from '../geo/scan.js';

/**
 * Satellite Ground Track and Footprint Visualization (REQ SAT-03, SAT-04)
 * - Renders a 90-minute projected ground track polyline clamped to the globe.
 * - Breaks polylines cleanly at the antimeridian (+/-180 lon).
 * - Renders a coverage footprint circle around the satellite sub-point.
 * - Computes next pass over an observer city (SAT-04).
 */
export class GroundTrackLayer {
  /**
   * @param {import('cesium').Viewer} viewer
   */
  constructor(viewer) {
    this.viewer = viewer;

    /** @type {any[]} Active Cesium entities */
    this.activeEntities = [];

    this.currentSatrec = null;
    this.currentAltKm = 400;
  }

  /**
   * Sets the active satellite to visualize ground track and footprint.
   *
   * @param {any} satrec - satellite.js satrec object
   * @param {number} [altKm] - current altitude in km
   */
  setSatellite(satrec, altKm = 400) {
    this.clear();
    if (!satrec) return;

    this.currentSatrec = satrec;
    this.currentAltKm = altKm;

    this.renderTrackAndFootprint();
  }

  /**
   * Clears active ground track and footprint entities from the globe.
   */
  clear() {
    for (const entity of this.activeEntities) {
      this.viewer.entities.remove(entity);
    }
    this.activeEntities = [];
    this.currentSatrec = null;
  }

  /**
   * Calculates and draws the 90-minute projected ground track and footprint.
   */
  renderTrackAndFootprint() {
    if (!this.currentSatrec) return;

    const now = new Date();
    const trackPoints = [];
    let currentSubPoint = null;

    // Propagate 90 minutes into future at 30-second intervals (180 points)
    const stepSeconds = 30;
    const totalSteps = 180; // 90 min * 2 steps/min

    for (let step = 0; step < totalSteps; step++) {
      const stepTime = new Date(now.getTime() + step * stepSeconds * 1000);
      const posAndVel = satellite.propagate(this.currentSatrec, stepTime);

      if (posAndVel.position && typeof posAndVel.position !== 'boolean') {
        const gmst = satellite.gstime(stepTime);
        const geodetic = satellite.eciToGeodetic(posAndVel.position, gmst);
        const latDeg = satellite.degreesLat(geodetic.latitude);
        const lonDeg = satellite.degreesLong(geodetic.longitude);

        if (step === 0) {
          currentSubPoint = {
            lat: latDeg,
            lon: lonDeg,
            altKm: geodetic.height,
          };
        }

        trackPoints.push({ lat: latDeg, lon: lonDeg });
      }
    }

    if (trackPoints.length === 0) return;

    // Split ground track at antimeridian to prevent wrap-around visual glitches
    const segments = splitGroundTrackAtAntimeridian(trackPoints);

    // Draw track polyline segments
    for (let s = 0; s < segments.length; s++) {
      const seg = segments[s];
      const positions = seg.map((p) => Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 1000));

      const polylineEntity = this.viewer.entities.add({
        polyline: {
          positions,
          width: 2.0,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.15,
            color: Cesium.Color.fromCssColorString('#35D0E8').withAlpha(0.7),
          }),
          clampToGround: true,
        },
      });
      this.activeEntities.push(polylineEntity);
    }

    // Draw footprint circle around current sub-point (SAT-03)
    if (currentSubPoint) {
      const footprintRadiusKm = computeFootprintRadius(currentSubPoint.altKm || this.currentAltKm, 10);
      const footprintRadiusM = footprintRadiusKm * 1000.0;

      const footprintEntity = this.viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(currentSubPoint.lon, currentSubPoint.lat),
        ellipse: {
          semiMinorAxis: footprintRadiusM,
          semiMajorAxis: footprintRadiusM,
          material: Cesium.Color.fromCssColorString('#35D0E8').withAlpha(0.08),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('#35D0E8').withAlpha(0.5),
          outlineWidth: 2,
          height: 0,
        },
      });
      this.activeEntities.push(footprintEntity);
    }
  }

  /**
   * Calculates the next pass over an observer city (SAT-04).
   * Steps forward in 30 s intervals for up to 24 hours.
   *
   * @param {number} obsLat - Observer latitude
   * @param {number} obsLon - Observer longitude
   * @param {number} [minElevationDeg=10]
   * @returns {{riseTime: Date, setTime: Date, maxElevationDeg: number, durationMin: number} | null}
   */
  computeNextPass(obsLat, obsLon, minElevationDeg = 10) {
    if (!this.currentSatrec) return null;

    const now = new Date();
    const maxSteps = 2880; // 24 hours at 30 s steps
    let inPass = false;
    let riseTime = null;
    let maxElevation = 0;

    for (let i = 0; i < maxSteps; i++) {
      const t = new Date(now.getTime() + i * 30 * 1000);
      const posAndVel = satellite.propagate(this.currentSatrec, t);

      if (posAndVel.position && typeof posAndVel.position !== 'boolean') {
        const gmst = satellite.gstime(t);
        const geodetic = satellite.eciToGeodetic(posAndVel.position, gmst);
        const satLat = satellite.degreesLat(geodetic.latitude);
        const satLon = satellite.degreesLong(geodetic.longitude);
        const satAltKm = geodetic.height;

        const elevation = calculateElevationDeg(obsLat, obsLon, 0, satLat, satLon, satAltKm);

        if (!inPass && elevation >= minElevationDeg) {
          inPass = true;
          riseTime = t;
          maxElevation = elevation;
        } else if (inPass) {
          if (elevation > maxElevation) {
            maxElevation = elevation;
          }
          if (elevation < minElevationDeg) {
            // Pass ended
            const setTime = t;
            const durationMin = (setTime.getTime() - riseTime.getTime()) / 60000;
            return {
              riseTime,
              setTime,
              maxElevationDeg: Math.round(maxElevation * 10) / 10,
              durationMin: Math.round(durationMin * 10) / 10,
            };
          }
        }
      }
    }

    return null;
  }
}

