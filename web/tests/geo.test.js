import { describe, it, expect } from 'vitest';
import { haversineDistance, isPointInCircle, computeBoundingBox } from '../src/geo/haversine.js';

describe('Geo & Haversine Unit Tests (testing.md T-GEO-01..T-GEO-05)', () => {
  it('T-GEO-01: Haversine London to Paris is 344 km (+/- 2 km)', () => {
    // London: 51.5074, -0.1278 | Paris: 48.8566, 2.3522
    const distM = haversineDistance(51.5074, -0.1278, 48.8566, 2.3522);
    const distKm = distM / 1000.0;
    expect(distKm).toBeGreaterThanOrEqual(342);
    expect(distKm).toBeLessThanOrEqual(346);
  });

  it('T-GEO-02: Haversine of a point to itself is exactly 0', () => {
    const dist = haversineDistance(28.6139, 77.2090, 28.6139, 77.2090);
    expect(dist).toBe(0);
  });

  it('T-GEO-03: Haversine across the antimeridian (lon 179.9 to -179.9 at equator) is ~22 km', () => {
    const distM = haversineDistance(0, 179.9, 0, -179.9);
    const distKm = distM / 1000.0;
    // 0.2 deg at equator = ~22.2 km
    expect(distKm).toBeGreaterThan(20);
    expect(distKm).toBeLessThan(25);
    // Crucial check: must NOT wrap around the long way (~40,000 km)
    expect(distKm).toBeLessThan(100);
  });

  it('T-GEO-04: Point in circle behaves properly on boundary, inside, and outside', () => {
    const centerLat = 28.0;
    const centerLon = 77.0;
    const radiusM = 10000; // 10 km

    // Exactly center (inside)
    expect(isPointInCircle(centerLat, centerLon, radiusM, centerLat, centerLon)).toBe(true);

    // Just inside (~9.9 km north)
    // 1 deg lat is ~111 km, so 0.089 deg is ~9.9 km
    expect(isPointInCircle(centerLat, centerLon, radiusM, centerLat + 0.089, centerLon)).toBe(true);

    // Just outside (~12 km north)
    // 0.11 deg is ~12.2 km
    expect(isPointInCircle(centerLat, centerLon, radiusM, centerLat + 0.11, centerLon)).toBe(false);
  });

  it('T-GEO-05: Bounding box prefilter contains point within radius', () => {
    const bbox = computeBoundingBox(28.0, 77.0, 50000); // 50 km
    expect(bbox.minLat).toBeLessThan(28.0);
    expect(bbox.maxLat).toBeGreaterThan(28.0);
    expect(bbox.minLon).toBeLessThan(77.0);
    expect(bbox.maxLon).toBeGreaterThan(77.0);
  });
});
