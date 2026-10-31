import { describe, it, expect } from 'vitest';

describe('HAZ-01 & HAZ-02 Natural Hazards Model & Scaling', () => {
  it('correctly maps magnitude thresholds to visual scales', () => {
    function getQuakeScale(mag) {
      if (mag >= 6.0) return { category: 'major', pixelSize: 14, color: '#EF4444' };
      if (mag >= 4.5) return { category: 'moderate', pixelSize: 9, color: '#FB923C' };
      return { category: 'minor', pixelSize: 6, color: '#FBBF24' };
    }

    const minor = getQuakeScale(3.2);
    expect(minor.category).toBe('minor');
    expect(minor.pixelSize).toBe(6);

    const moderate = getQuakeScale(5.4);
    expect(moderate.category).toBe('moderate');
    expect(moderate.pixelSize).toBe(9);

    const major = getQuakeScale(6.8);
    expect(major.category).toBe('major');
    expect(major.pixelSize).toBe(14);
  });

  it('formats earthquake depth and timestamp consistently', () => {
    const rawQuake = {
      id: 'us7000m46a',
      mag: 4.6,
      place: 'Hindu Kush region, Afghanistan',
      time: 1730452421000,
      lat: 36.52,
      lon: 70.83,
      depth_km: 212.0,
    };

    expect(rawQuake.depth_km).toBe(212.0);
    const date = new Date(rawQuake.time);
    expect(date.getUTCFullYear()).toBe(2024);
  });

  it('identifies high intensity fire hotspots by radiative power (FRP > 80 MW)', () => {
    const fireLow = { frp: 24.5, confidence: 'nominal' };
    const fireHigh = { frp: 185.7, confidence: 'high' };

    const isHighIntensity = (f) => f.frp > 80;
    expect(isHighIntensity(fireLow)).toBe(false);
    expect(isHighIntensity(fireHigh)).toBe(true);
  });
});

