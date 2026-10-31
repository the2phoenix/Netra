import { describe, it, expect } from 'vitest';
import {
  isPointInPolygon,
  computeFootprintRadius,
  splitGroundTrackAtAntimeridian,
  calculateElevationDeg,
  isSatelliteOverhead,
  SquawkAlertManager,
} from '../src/geo/scan.js';

describe('Phase 5 Scan & Geo Algorithms (T-GEO-06, T-GEO-11, T-GEO-12, T-SAT-07, FLT-03)', () => {
  describe('T-GEO-06: Point in Polygon', () => {
    // 1x1 degree square around (10, 10)
    const square = [
      { lat: 9, lon: 9 },
      { lat: 9, lon: 11 },
      { lat: 11, lon: 11 },
      { lat: 11, lon: 9 },
    ];

    it('contains center point (10, 10)', () => {
      expect(isPointInPolygon(square, 10, 10)).toBe(true);
    });

    it('excludes outside points', () => {
      expect(isPointInPolygon(square, 5, 5)).toBe(false);
      expect(isPointInPolygon(square, 12, 10)).toBe(false);
      expect(isPointInPolygon(square, 10, 12)).toBe(false);
    });

    it('handles points on or near edges consistently without errors', () => {
      // Points near the boundary
      const res1 = isPointInPolygon(square, 9.0001, 10);
      const res2 = isPointInPolygon(square, 8.9999, 10);
      expect(res1).toBe(true);
      expect(res2).toBe(false);
    });
  });

  describe('T-GEO-11 & T-GEO-12: Satellite Footprint Radius (SAT-03)', () => {
    it('T-GEO-11: Footprint radius at h = 400 km, elevation 0 is ~2,200 km (+/- 30 km)', () => {
      const radiusKm = computeFootprintRadius(400, 0);
      expect(radiusKm).toBeGreaterThanOrEqual(2170);
      expect(radiusKm).toBeLessThanOrEqual(2230);
    });

    it('T-GEO-12: Footprint radius grows with altitude and shrinks with minimum elevation (monotonic)', () => {
      const r400 = computeFootprintRadius(400, 0);
      const r800 = computeFootprintRadius(800, 0);
      const r1200 = computeFootprintRadius(1200, 0);

      expect(r800).toBeGreaterThan(r400);
      expect(r1200).toBeGreaterThan(r800);

      // Increasing minimum elevation angle shrinks visible coverage footprint
      const r400_el0 = computeFootprintRadius(400, 0);
      const r400_el10 = computeFootprintRadius(400, 10);
      const r400_el25 = computeFootprintRadius(400, 25);

      expect(r400_el10).toBeLessThan(r400_el0);
      expect(r400_el25).toBeLessThan(r400_el10);
    });
  });

  describe('T-SAT-07: Ground Track Antimeridian Splitting (SAT-03)', () => {
    it('breaks ground track polyline at the antimeridian', () => {
      const track = [
        { lat: 10, lon: 170 },
        { lat: 12, lon: 178 },
        { lat: 14, lon: -178 }, // crossed antimeridian
        { lat: 16, lon: -170 },
      ];

      const segments = splitGroundTrackAtAntimeridian(track);
      expect(segments.length).toBe(2);
      expect(segments[0].length).toBe(2);
      expect(segments[1].length).toBe(2);

      // No consecutive points in any segment should span > 180 degrees longitude
      for (const seg of segments) {
        for (let i = 0; i < seg.length - 1; i++) {
          const deltaLon = Math.abs(seg[i + 1].lon - seg[i].lon);
          expect(deltaLon).toBeLessThanOrEqual(180);
        }
      }
    });

    it('keeps continuous track intact when no antimeridian is crossed', () => {
      const track = [
        { lat: 10, lon: 10 },
        { lat: 12, lon: 15 },
        { lat: 14, lon: 20 },
      ];
      const segments = splitGroundTrackAtAntimeridian(track);
      expect(segments.length).toBe(1);
      expect(segments[0].length).toBe(3);
    });
  });

  describe('Satellite Look Angles & Overhead Elevation (SAT-04, SCN-01)', () => {
    it('computes elevation > 10 deg for directly overhead or near-zenith satellite', () => {
      // Observer at (28.61, 77.20), satellite directly overhead at 400 km
      const elevation = calculateElevationDeg(28.61, 77.20, 0, 28.61, 77.20, 400);
      expect(elevation).toBeCloseTo(90, 0);
      expect(isSatelliteOverhead(28.61, 77.20, 28.61, 77.20, 400, 10)).toBe(true);
    });

    it('computes elevation < 10 deg for satellite beyond horizon or low look angle', () => {
      // Observer in Delhi (28.61, 77.20), satellite over London (51.5, -0.12) at 400 km
      const elevation = calculateElevationDeg(28.61, 77.20, 0, 51.5, -0.12, 400);
      expect(elevation).toBeLessThan(10);
      expect(isSatelliteOverhead(28.61, 77.20, 51.5, -0.12, 400, 10)).toBe(false);
    });
  });

  describe('FLT-03: Emergency Squawk Alert Manager', () => {
    it('creates exactly one alert for squawk 7700 across multiple polls', () => {
      const manager = new SquawkAlertManager();
      const ac7700 = { hex: 'a1b2c3', callsign: 'EMERG1', squawk: '7700', lat: 28.5, lon: 77.1 };
      const acNormal = { hex: 'd4e5f6', callsign: 'NORM1', squawk: '1200', lat: 28.6, lon: 77.2 };

      // Poll 1: 7700 should trigger an alert
      const alerts1 = manager.processAircraft([ac7700, acNormal]);
      expect(alerts1.length).toBe(1);
      expect(alerts1[0].hex).toBe('a1b2c3');
      expect(alerts1[0].squawk).toBe('7700');

      // Poll 2: Same aircraft still squawking 7700 -> ZERO new alerts (deduplication)
      const alerts2 = manager.processAircraft([ac7700, acNormal]);
      expect(alerts2.length).toBe(0);

      // Poll 3: Still squawking 7700 -> ZERO new alerts
      const alerts3 = manager.processAircraft([ac7700, acNormal]);
      expect(alerts3.length).toBe(0);
    });

    it('triggers alerts for 7500 and 7600 emergency squawks', () => {
      const manager = new SquawkAlertManager();
      const hijack = { hex: 'h1j2k3', callsign: 'HIJACK', squawk: '7500', lat: 20, lon: 70 };
      const lostComm = { hex: 'l4c5m6', callsign: 'NOCOMM', squawk: '7600', lat: 22, lon: 72 };

      const alerts = manager.processAircraft([hijack, lostComm]);
      expect(alerts.length).toBe(2);
      expect(alerts.some((a) => a.squawk === '7500')).toBe(true);
      expect(alerts.some((a) => a.squawk === '7600')).toBe(true);
    });
  });
});

