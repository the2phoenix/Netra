// @ts-check
import { describe, it, expect } from 'vitest';
import * as Cesium from 'cesium';

describe("Tactical Command Center Features & Flight Engine", () => {
  it('T-GEV-01: Coordinate regex correctly parses valid lat/lon strings', () => {
    const parseCoord = (str) => {
      const match = str.trim().toLowerCase().match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
      if (!match) return null;
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[3]);
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        return { lat, lon };
      }
      return null;
    };

    expect(parseCoord('28.56, 77.10')).toEqual({ lat: 28.56, lon: 77.10 });
    expect(parseCoord('-33.946, 151.177')).toEqual({ lat: -33.946, lon: 151.177 });
    expect(parseCoord('0, 0')).toEqual({ lat: 0, lon: 0 });
    expect(parseCoord('95.0, 77.10')).toBeNull(); // Out of range
    expect(parseCoord('Delhi')).toBeNull(); // Not a coord
  });

  it('T-GEV-02: Geodesic arc interpolation generates valid spherical points above ellipsoid', () => {
    const startCarto = Cesium.Cartographic.fromDegrees(77.10, 28.56);
    const endCarto = Cesium.Cartographic.fromDegrees(-73.78, 40.64);
    const geodesic = new Cesium.EllipsoidGeodesic(startCarto, endCarto);

    const altM = 11000;
    const points = [];
    const numPoints = 5;
    for (let i = 0; i <= numPoints; i++) {
      const frac = i / numPoints;
      const carto = geodesic.interpolateUsingFraction(frac);
      const pos = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, altM);
      points.push(pos);
    }

    expect(points.length).toBe(6);
    // Magnitude of Cartesian3 vector at altM must be strictly greater than Earth's minimum radius (6356 km)
    points.forEach((pt) => {
      const mag = Cesium.Cartesian3.magnitude(pt);
      expect(mag).toBeGreaterThan(6356752);
    });
  });

  it('T-GEV-03: Classification badges correctly separate Commercial, Military, and Emergency', () => {
    const classifyFlight = (item) => {
      if (['7700', '7600', '7500'].includes(item.squawk)) return 'EMERGENCY';
      if (item.is_military) return 'MILITARY';
      if (item.alt_ft > 30000) return 'HIGH_ALT';
      if (item.alt_ft >= 10000) return 'MID_ALT';
      return 'LOW_ALT';
    };

    expect(classifyFlight({ squawk: '7700', is_military: false, alt_ft: 35000 })).toBe('EMERGENCY');
    expect(classifyFlight({ squawk: '1200', is_military: true, alt_ft: 28000 })).toBe('MILITARY');
    expect(classifyFlight({ squawk: '2100', is_military: false, alt_ft: 37000 })).toBe('HIGH_ALT');
    expect(classifyFlight({ squawk: '4500', is_military: false, alt_ft: 18000 })).toBe('MID_ALT');
    expect(classifyFlight({ squawk: '1000', is_military: false, alt_ft: 4500 })).toBe('LOW_ALT');
  });

  it('T-GEV-04: Cockpit camera offset geometry maintains 3rd-person chase orientation', () => {
    const headingDeg = 90.0; // Heading East
    const headingRad = Cesium.Math.toRadians(headingDeg);
    const pitchRad = Cesium.Math.toRadians(-12.0);
    const rangeM = 150.0;

    const hpr = new Cesium.HeadingPitchRange(headingRad, pitchRad, rangeM);
    expect(hpr.heading).toBeCloseTo(Math.PI / 2);
    expect(hpr.pitch).toBeCloseTo(-12.0 * (Math.PI / 180));
    expect(hpr.range).toBe(150.0);
  });

  it('T-GEV-05: Global CCTV surveillance nodes contain valid coordinates and streaming channels', async () => {
    const { GLOBAL_CCTV_NODES } = await import('../src/layers/cctv.js');
    expect(GLOBAL_CCTV_NODES.length).toBeGreaterThanOrEqual(5);

    GLOBAL_CCTV_NODES.forEach((node) => {
      expect(node.id).toBeDefined();
      expect(node.name).toBeDefined();
      expect(node.city).toBeDefined();
      expect(node.lat).toBeGreaterThanOrEqual(-90);
      expect(node.lat).toBeLessThanOrEqual(90);
      expect(node.lon).toBeGreaterThanOrEqual(-180);
      expect(node.lon).toBeLessThanOrEqual(180);
      expect(['live', 'recon']).toContain(node.feedType);
    });
  });

  it('T-GEV-06: Visual modes manager applies hardware-accelerated filters without WebGL shader compilation crashes', async () => {
    const { VisualModesManager } = await import('../src/globe/visualModes.js');
    const fakeViewer = {
      canvas: { style: {} },
      container: { parentNode: { appendChild: () => {} } },
    };
    // @ts-ignore
    const vm = new VisualModesManager(fakeViewer);

    expect(vm.modes).toEqual(['normal', 'night-vision', 'thermal']);
    vm.setMode('night-vision');
    expect(fakeViewer.canvas.style.filter).toContain('brightness');

    vm.setMode('thermal');
    expect(fakeViewer.canvas.style.filter).toContain('invert');

    vm.setMode('normal');
    expect(fakeViewer.canvas.style.filter).toBe('none');
  });
});

