import { describe, it, expect } from 'vitest';
import { predictPosition, easePosition } from '../src/geo/deadReckoning.js';

describe('T-GEO-07..10 & T-GEO-13 Dead Reckoning & Motion Prediction', () => {
  it('T-GEO-07: equator, heading east (90 deg), 250 m/s, 100 s -> lon +0.2248 deg, lat unchanged', () => {
    const result = predictPosition({
      lat: 0.0,
      lon: 0.0,
      altM: 10000,
      gsMps: 250,
      trackDeg: 90,
      vsMps: 0,
      dtSeconds: 100,
      clampDt: 100, // allow 100s for pure formula check
    });

    expect(result.lat).toBeCloseTo(0.0, 3);
    expect(result.lon).toBeCloseTo(0.2248, 3);
  });

  it('T-GEO-08: heading north from equator (0 deg), 250 m/s, 100 s -> lat +0.2248 deg', () => {
    const result = predictPosition({
      lat: 0.0,
      lon: 0.0,
      altM: 10000,
      gsMps: 250,
      trackDeg: 0,
      vsMps: 0,
      dtSeconds: 100,
      clampDt: 100,
    });

    expect(result.lat).toBeCloseTo(0.2248, 3);
    expect(result.lon).toBeCloseTo(0.0, 3);
  });

  it('T-GEO-09: dead reckoning near pole does not return NaN', () => {
    const result = predictPosition({
      lat: 89.5,
      lon: 45.0,
      altM: 11000,
      gsMps: 240,
      trackDeg: 15,
      vsMps: 0,
      dtSeconds: 60,
    });

    expect(Number.isNaN(result.lat)).toBe(false);
    expect(Number.isNaN(result.lon)).toBe(false);
    expect(Number.isFinite(result.lat)).toBe(true);
    expect(Number.isFinite(result.lon)).toBe(true);
  });

  it('T-GEO-10: clamps dt to 90 s and altitude to [0, 20,000] m', () => {
    // Test dt clamping to 90s
    const resultLongDt = predictPosition({
      lat: 0.0,
      lon: 0.0,
      altM: 10000,
      gsMps: 250,
      trackDeg: 90,
      vsMps: 0,
      dtSeconds: 300, // 300s should clamp to 90s
    });

    // 250 m/s * 90 s = 22500 m => 22500 / 6371008.8 * 180 / PI = ~0.2023 deg
    expect(resultLongDt.lon).toBeCloseTo(0.2023, 3);

    // Test altitude clamp to 20,000 m
    const resultHighAlt = predictPosition({
      lat: 0.0,
      lon: 0.0,
      altM: 19500,
      gsMps: 200,
      trackDeg: 0,
      vsMps: 50, // climbing at 50 m/s for 90 s = +4500m => 24,000m -> clamped to 20,000m
      dtSeconds: 90,
    });
    expect(resultHighAlt.altM).toBe(20000);

    // Test altitude clamp to 0 m (no subterranean aircraft)
    const resultLowAlt = predictPosition({
      lat: 0.0,
      lon: 0.0,
      altM: 200,
      gsMps: 100,
      trackDeg: 0,
      vsMps: -50,
      dtSeconds: 50,
    });
    expect(resultLowAlt.altM).toBe(0);
  });

  it('T-GEO-13: easing blend over 500 ms smoothly transitions position', () => {
    const current = { lat: 10.0, lon: 20.0, altM: 10000 };
    const target = { lat: 10.5, lon: 20.5, altM: 10500 };

    // At dt = 0.25 s (halfway)
    const mid = easePosition(current, target, 0.25, 0.5);
    expect(mid.lat).toBeCloseTo(10.25, 2);
    expect(mid.lon).toBeCloseTo(20.25, 2);
    expect(mid.altM).toBeCloseTo(10250, 0);

    // At dt >= 0.5 s (complete)
    const end = easePosition(current, target, 0.5, 0.5);
    expect(end.lat).toBeCloseTo(10.5, 4);
    expect(end.lon).toBeCloseTo(20.5, 4);
    expect(end.altM).toBeCloseTo(10500, 0);
  });
});
