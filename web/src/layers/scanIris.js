// @ts-check
import * as Cesium from 'cesium';

/**
 * Cesium 3D visual renderer for the Scan Iris (SCN-01).
 * Renders outer coverage circle, concentric range ring, and an animated 4-second sweep line.
 */
export class ScanIrisLayer {
  /**
   * @param {import('cesium').Viewer} viewer
   */
  constructor(viewer) {
    this.viewer = viewer;
    /** @type {any[]} Active Cesium entities */
    this.irisEntities = [];
    this.sweepHeading = 0.0;
  }

  /**
   * Renders or updates the iris visual rings and animated sweep beam.
   *
   * @param {number} lat
   * @param {number} lon
   * @param {number} radiusKm
   */
  render(lat, lon, radiusKm) {
    this.clear();

    const centerCartesian = Cesium.Cartesian3.fromDegrees(lon, lat);
    const radiusM = radiusKm * 1000.0;

    // 1. Outer coverage circle
    const outerCircle = this.viewer.entities.add({
      position: centerCartesian,
      ellipse: {
        semiMinorAxis: radiusM,
        semiMajorAxis: radiusM,
        material: Cesium.Color.fromCssColorString('#35D0E8').withAlpha(0.06),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#35D0E8').withAlpha(0.6),
        outlineWidth: 2,
      },
    });
    this.irisEntities.push(outerCircle);

    // 2. Concentric inner range ring (50% radius)
    const midRing = this.viewer.entities.add({
      position: centerCartesian,
      ellipse: {
        semiMinorAxis: radiusM * 0.5,
        semiMajorAxis: radiusM * 0.5,
        material: Cesium.Color.TRANSPARENT,
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#35D0E8').withAlpha(0.3),
        outlineWidth: 1,
      },
    });
    this.irisEntities.push(midRing);

    // 3. Center reticle crosshair
    const centerPoint = this.viewer.entities.add({
      position: centerCartesian,
      point: {
        pixelSize: 6,
        color: Cesium.Color.fromCssColorString('#FF6A1A'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1,
      },
    });
    this.irisEntities.push(centerPoint);

    // 4. Rotating sweep beam (4 seconds per rev = 360 deg / 4s = 90 deg/s)
    let lastTime = performance.now();
    this.sweepHeading = 0.0;

    const sweepEntity = this.viewer.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const now = performance.now();
          const dt = (now - lastTime) / 1000.0;
          lastTime = now;
          this.sweepHeading = (this.sweepHeading + dt * 90.0) % 360.0;

          // Tip of sweep line offset
          const headingRad = Cesium.Math.toRadians(this.sweepHeading);
          const deltaLat = (radiusM / 6371000.0) * Math.cos(headingRad) * (180 / Math.PI);
          const cosLat = Math.cos(Cesium.Math.toRadians(lat));
          const deltaLon = cosLat !== 0
            ? ((radiusM / 6371000.0) * Math.sin(headingRad) * (180 / Math.PI)) / cosLat
            : 0;

          const tipCartesian = Cesium.Cartesian3.fromDegrees(lon + deltaLon, lat + deltaLat, 500);
          return [centerCartesian, tipCartesian];
        }, false),
        width: 2.0,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.25,
          color: Cesium.Color.fromCssColorString('#FF6A1A').withAlpha(0.8),
        }),
      },
    });
    this.irisEntities.push(sweepEntity);
  }

  /**
   * Clears active iris visual entities from the globe.
   */
  clear() {
    for (const ent of this.irisEntities) {
      this.viewer.entities.remove(ent);
    }
    this.irisEntities = [];
  }
}

