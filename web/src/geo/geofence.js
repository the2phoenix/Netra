// @ts-check
import { isPointInCircle, computeBoundingBox } from './haversine.js';
import { isPointInPolygon } from './scan.js';

/**
 * Geofence Zone Manager (SCN-02)
 * Supports up to 5 user-defined zones (circles or polygons).
 * Tracks object containment and ensures single-fire alert events upon entry.
 */
export class GeofenceManager {
  constructor() {
    /** @type {Map<string, {id: string, name: string, type: 'circle'|'polygon', lat?: number, lon?: number, radiusM?: number, vertices?: Array<{lat: number, lon: number}>}>} */
    this.zones = new Map();

    /** @type {Set<string>} Set of `${zoneId}:${entityId}` currently inside */
    this.insideSet = new Set();
  }

  /**
   * Adds a circular geofence zone (max 5 zones total).
   *
   * @param {string} name
   * @param {number} lat
   * @param {number} lon
   * @param {number} radiusM
   * @returns {{id: string, name: string, type: 'circle', lat: number, lon: number, radiusM: number} | null}
   */
  addCircularZone(name, lat, lon, radiusM) {
    if (this.zones.size >= 5) {
      return null;
    }

    const id = `zone-${this.zones.size + 1}`;
    const zone = {
      id,
      name,
      type: /** @type {'circle'} */ ('circle'),
      lat,
      lon,
      radiusM,
    };

    this.zones.set(id, zone);
    return zone;
  }

  /**
   * Adds a polygon geofence zone (max 5 zones total).
   *
   * @param {string} name
   * @param {Array<{lat: number, lon: number}>} vertices
   * @returns {{id: string, name: string, type: 'polygon', vertices: Array<{lat: number, lon: number}>} | null}
   */
  addPolygonZone(name, vertices) {
    if (this.zones.size >= 5 || !vertices || vertices.length < 3) {
      return null;
    }

    const id = `zone-${this.zones.size + 1}`;
    const zone = {
      id,
      name,
      type: /** @type {'polygon'} */ ('polygon'),
      vertices,
    };

    this.zones.set(id, zone);
    return zone;
  }

  /**
   * Removes an existing geofence zone.
   * @param {string} id
   */
  removeZone(id) {
    this.zones.delete(id);
    // Remove all tracked inside states for this zone
    for (const key of Array.from(this.insideSet)) {
      if (key.startsWith(`${id}:`)) {
        this.insideSet.delete(key);
      }
    }
  }

  /**
   * @returns {Array<any>} List of active zones
   */
  getZones() {
    return Array.from(this.zones.values());
  }

  /**
   * Evaluates a collection of entities against all active geofence zones.
   * Returns alerts ONLY for entities that just transitioned from outside to inside.
   *
   * @param {Array<{id: string|number, callsign?: string, name?: string, lat: number, lon: number}>} entities
   * @param {'aircraft'|'satellite'|'hazard'} entityType
   * @returns {Array<{zoneId: string, zoneName: string, entityId: string|number, type: string, message: string, lat: number, lon: number, time: string}>}
   */
  evaluateEntities(entities, entityType) {
    if (this.zones.size === 0 || !entities || entities.length === 0) {
      return [];
    }

    const newAlerts = [];
    /** @type {Set<string>} Current active `${zoneId}:${entityId}` keys */
    const currentlyInside = new Set();

    for (const zone of this.zones.values()) {
      for (const entity of entities) {
        if (typeof entity.lat !== 'number' || typeof entity.lon !== 'number') continue;

        let isInside = false;
        if (zone.type === 'circle' && zone.lat !== undefined && zone.lon !== undefined && zone.radiusM !== undefined) {
          isInside = isPointInCircle(zone.lat, zone.lon, zone.radiusM, entity.lat, entity.lon);
        } else if (zone.type === 'polygon' && zone.vertices) {
          isInside = isPointInPolygon(zone.vertices, entity.lat, entity.lon);
        }

        const stateKey = `${zone.id}:${entity.id}`;

        if (isInside) {
          currentlyInside.add(stateKey);
          if (!this.insideSet.has(stateKey)) {
            // New entry transition!
            this.insideSet.add(stateKey);
            const displayName = entity.callsign || entity.name || String(entity.id);
            newAlerts.push({
              zoneId: zone.id,
              zoneName: zone.name,
              entityId: entity.id,
              type: entityType,
              message: `ENTER ZONE ${zone.name} ${displayName}`,
              lat: entity.lat,
              lon: entity.lon,
              time: new Date().toISOString(),
            });
          }
        }
      }
    }

    // Clean up entities that left the zone
    for (const stateKey of Array.from(this.insideSet)) {
      if (!currentlyInside.has(stateKey)) {
        this.insideSet.delete(stateKey);
      }
    }

    return newAlerts;
  }
}

