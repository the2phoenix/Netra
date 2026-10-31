import { describe, it, expect } from 'vitest';
import { GeofenceManager } from '../src/geo/geofence.js';

describe('SCN-02: Geofence Zones & Single-Fire Alerts', () => {
  it('creates circular geofence zones up to 5 max', () => {
    const mgr = new GeofenceManager();

    for (let i = 1; i <= 5; i++) {
      const zone = mgr.addCircularZone(`Zone-${i}`, 28.0 + i, 77.0 + i, 50000);
      expect(zone).not.toBeNull();
      expect(zone.id).toBe(`zone-${i}`);
    }

    // 6th zone should be rejected because max is 5
    const zone6 = mgr.addCircularZone('Zone-6', 20, 70, 50000);
    expect(zone6).toBeNull();
    expect(mgr.getZones().length).toBe(5);
  });

  it('triggers exactly ONE alert upon object entry, not one per tick', () => {
    const mgr = new GeofenceManager();
    // Delhi NCR zone, 50 km radius (50,000 m)
    mgr.addCircularZone('Delhi NCR', 28.61, 77.21, 50000);

    const acInside = { id: 'ac1', callsign: 'AIC101', lat: 28.62, lon: 77.22 };
    const acOutside = { id: 'ac2', callsign: 'BAW202', lat: 35.00, lon: 70.00 };

    // Tick 1: acInside enters Delhi NCR
    const eventsTick1 = mgr.evaluateEntities([acInside, acOutside], 'aircraft');
    expect(eventsTick1.length).toBe(1);
    expect(eventsTick1[0].zoneName).toBe('Delhi NCR');
    expect(eventsTick1[0].entityId).toBe('ac1');
    expect(eventsTick1[0].message).toContain('ENTER ZONE Delhi NCR AIC101');

    // Tick 2: Both entities at same positions -> 0 new events (single-fire!)
    const eventsTick2 = mgr.evaluateEntities([acInside, acOutside], 'aircraft');
    expect(eventsTick2.length).toBe(0);

    // Tick 3: acInside moves slightly but stays inside -> 0 new events
    const acInsideMoved = { id: 'ac1', callsign: 'AIC101', lat: 28.63, lon: 77.23 };
    const eventsTick3 = mgr.evaluateEntities([acInsideMoved, acOutside], 'aircraft');
    expect(eventsTick3.length).toBe(0);
  });

  it('triggers a new alert if object leaves zone and later re-enters', () => {
    const mgr = new GeofenceManager();
    mgr.addCircularZone('Delhi NCR', 28.61, 77.21, 50000);

    const ac = { id: 'ac1', callsign: 'AIC101', lat: 28.62, lon: 77.22 };

    // 1. Enters zone
    const ev1 = mgr.evaluateEntities([ac], 'aircraft');
    expect(ev1.length).toBe(1);

    // 2. Moves outside zone
    const acFar = { id: 'ac1', callsign: 'AIC101', lat: 35.0, lon: 70.0 };
    mgr.evaluateEntities([acFar], 'aircraft');

    // 3. Re-enters zone -> should trigger new alert!
    const ev3 = mgr.evaluateEntities([ac], 'aircraft');
    expect(ev3.length).toBe(1);
    expect(ev3[0].entityId).toBe('ac1');
  });

  it('removes a zone cleanly and purges tracking state', () => {
    const mgr = new GeofenceManager();
    const zone = mgr.addCircularZone('Delhi NCR', 28.61, 77.21, 50000);
    expect(mgr.getZones().length).toBe(1);

    mgr.removeZone(zone.id);
    expect(mgr.getZones().length).toBe(0);
  });
});

