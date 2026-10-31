// @ts-check
import * as Cesium from 'cesium';
import { events } from '../core/events.js';
import { haversineDistance } from '../geo/haversine.js';
import { calculateElevationDeg } from '../geo/scan.js';
import { ScanIrisLayer } from '../layers/scanIris.js';

const CITIES = [
  { name: 'Delhi NCR', lat: 28.6139, lon: 77.2090 }, { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946 }, { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { name: 'Singapore', lat: 1.3521, lon: 103.8198 }, { name: 'London', lat: 51.5074, lon: -0.1278 },
  { name: 'New York', lat: 40.7128, lon: -74.0060 }, { name: 'Dubai', lat: 25.2048, lon: 55.2708 },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
];

/**
 * Scan Iris HUD Panel Controller (REQ SCN-01, SCN-02)
 */
export class ScanMode {
  /**
   * @param {HTMLElement} root
   * @param {import('cesium').Viewer} viewer
   * @param {import('../geo/geofence.js').GeofenceManager} geofenceManager
   */
  constructor(root, viewer, geofenceManager) {
    this.root = root;
    this.viewer = viewer;
    this.geofenceManager = geofenceManager;

    this.isOpen = false;
    this.centerMode = 'reticle';
    this.center = { lat: 28.6139, lon: 77.2090, name: 'Delhi NCR' };
    this.radiusKm = 250;
    this.updateInterval = null;

    this.irisLayer = new ScanIrisLayer(viewer);

    this.currentData = {
      aircraft: [],
      satellites: [],
      quakes: [],
      fires: [],
    };

    this.element = document.createElement('div');
    this.element.className = 'hud-scan-panel';
    this.element.id = 'hudScanPanel';
    this.element.style.display = 'none';

    this.render();
    this.root.appendChild(this.element);

    this.setupEvents();
  }

  render() {
    this.element.innerHTML = `
      <div class="scan-panel-header">
        <div class="scan-title">
          <span class="scan-icon">📡</span>
          <span>NETRA SCAN IRIS</span>
          <span class="scan-coords" id="scanCoords">${this.center.lat.toFixed(2)}°N, ${this.center.lon.toFixed(2)}°E</span>
        </div>
        <button class="scan-close-btn" id="btnScanClose" title="Close iris (Esc)">✕ ESC</button>
      </div>

      <div class="scan-panel-grid">
        <div class="scan-setup-col">
          <div class="scan-section-title">SCAN SETUP</div>
          <div class="scan-control-group">
            <label class="control-label">CENTER POSITION</label>
            <div class="radio-options">
              <label><input type="radio" name="scanCenter" value="reticle" ${this.centerMode === 'reticle' ? 'checked' : ''}> Reticle</label>
              <label><input type="radio" name="scanCenter" value="city" ${this.centerMode === 'city' ? 'checked' : ''}> Named City</label>
            </div>
            <select class="scan-select" id="scanCitySelect" ${this.centerMode !== 'city' ? 'disabled' : ''}>
              ${CITIES.map((c) => `<option value="${c.name}">${c.name}</option>`).join('')}
            </select>
          </div>

          <div class="scan-control-group">
            <div class="slider-header">
              <label class="control-label">RADIUS</label>
              <span class="slider-val" id="scanRadiusVal">${this.radiusKm} km</span>
            </div>
            <input type="range" class="scan-slider" id="scanRadiusSlider" min="50" max="500" step="10" value="${this.radiusKm}">
          </div>

          <div class="scan-actions">
            <button class="scan-btn primary" id="btnSaveZone">⌖ SAVE AS ZONE</button>
            <button class="scan-btn secondary" id="btnExportHits">EXPORT HITS</button>
          </div>
        </div>

        <div class="scan-hits-col">
          <div class="scan-section-title">LIVE HITS (2s cycle)</div>
          <div class="scan-hits-metrics">
            <div class="hit-metric"><span class="lbl air">AIRCRAFT</span><span class="val" id="hitCountAir">0</span></div>
            <div class="hit-metric"><span class="lbl sat">SATELLITES (&gt;10°)</span><span class="val" id="hitCountSat">0</span></div>
            <div class="hit-metric"><span class="lbl quake">QUAKES</span><span class="val" id="hitCountQuake">0</span></div>
            <div class="hit-metric"><span class="lbl fire">FIRES</span><span class="val" id="hitCountFire">0</span></div>
          </div>
          <div class="scan-nearest-section">
            <div class="nearest-item"><span class="nearest-lbl">NEAREST AIRCRAFT:</span><span class="nearest-val" id="nearestAir">None in radius</span></div>
            <div class="nearest-item"><span class="nearest-lbl">NEAREST SATELLITE:</span><span class="nearest-val" id="nearestSat">None overhead</span></div>
          </div>
        </div>
      </div>
    `;
  }

  setupEvents() {
    events.subscribe('scan:toggle', () => this.toggle());

    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 's' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) {
        this.toggle();
      } else if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    const btnClose = this.element.querySelector('#btnScanClose');
    if (btnClose) btnClose.addEventListener('click', () => this.close());

    const centerRadios = this.element.querySelectorAll('input[name="scanCenter"]');
    const citySelect = /** @type {HTMLSelectElement} */ (this.element.querySelector('#scanCitySelect'));

    centerRadios.forEach((r) => {
      r.addEventListener('change', (e) => {
        // @ts-ignore
        this.centerMode = e.target.value;
        if (citySelect) citySelect.disabled = this.centerMode !== 'city';
        if (this.centerMode === 'reticle') this.updateCenterFromReticle();
        else if (this.centerMode === 'city') this.setCityCenter(citySelect.value);
      });
    });

    if (citySelect) {
      citySelect.addEventListener('change', () => this.setCityCenter(citySelect.value));
    }

    const radiusSlider = /** @type {HTMLInputElement} */ (this.element.querySelector('#scanRadiusSlider'));
    const radiusVal = this.element.querySelector('#scanRadiusVal');
    if (radiusSlider && radiusVal) {
      radiusSlider.addEventListener('input', () => {
        this.radiusKm = parseInt(radiusSlider.value, 10);
        radiusVal.textContent = `${this.radiusKm} km`;
        if (this.isOpen) this.irisLayer.render(this.center.lat, this.center.lon, this.radiusKm);
        this.evaluateHits();
      });
    }

    const btnSaveZone = this.element.querySelector('#btnSaveZone');
    if (btnSaveZone) {
      btnSaveZone.addEventListener('click', () => {
        const zoneName = `${this.center.name || 'Scan Area'} (${this.radiusKm}km)`;
        const zone = this.geofenceManager.addCircularZone(zoneName, this.center.lat, this.center.lon, this.radiusKm * 1000);
        if (zone) {
          events.emit('feed:alert', { type: 'zone', level: 'info', text: `ZONE CREATED: ${zone.name}`, lat: this.center.lat, lon: this.center.lon });
          btnSaveZone.textContent = '✓ ZONE ACTIVE';
          setTimeout(() => { if (btnSaveZone) btnSaveZone.textContent = '⌖ SAVE AS ZONE'; }, 2000);
        } else {
          alert('Maximum 5 active geofence zones reached.');
        }
      });
    }

    const btnExport = this.element.querySelector('#btnExportHits');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(this.collectCurrentHits(), null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `netra_scan_hits_${Date.now()}.json`;
        a.click();
      });
    }

    events.subscribe('aircraft:updated', (items) => { this.currentData.aircraft = items || []; });
    events.subscribe('satellites:telemetry-batch', (items) => { this.currentData.satellites = items || []; });
    events.subscribe('quakes:updated', (items) => { this.currentData.quakes = items || []; });
    events.subscribe('fires:updated', (items) => { this.currentData.fires = items || []; });
  }

  toggle() { this.isOpen ? this.close() : this.open(); }

  open() {
    this.isOpen = true;
    this.element.style.display = 'block';
    if (this.centerMode === 'reticle') this.updateCenterFromReticle();

    this.irisLayer.render(this.center.lat, this.center.lon, this.radiusKm);
    this.evaluateHits();

    if (!this.updateInterval) {
      this.updateInterval = setInterval(() => { if (this.isOpen) this.evaluateHits(); }, 2000);
    }

    events.emit('feed:alert', {
      type: 'scan',
      level: 'info',
      text: `SCAN START center=${this.center.name || 'Reticle'} r=${this.radiusKm}km`,
      lat: this.center.lat,
      lon: this.center.lon,
    });
  }

  close() {
    this.isOpen = false;
    this.element.style.display = 'none';
    this.irisLayer.clear();
    if (this.updateInterval) { clearInterval(this.updateInterval); this.updateInterval = null; }
  }

  updateCenterFromReticle() {
    const ray = this.viewer.camera.getPickRay(
      new Cesium.Cartesian2(this.viewer.canvas.clientWidth / 2, this.viewer.canvas.clientHeight / 2)
    );
    const cartesian = this.viewer.scene.globe.pick(ray, this.viewer.scene);
    if (cartesian) {
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      this.center = {
        lat: Cesium.Math.toDegrees(cartographic.latitude),
        lon: Cesium.Math.toDegrees(cartographic.longitude),
        name: 'Reticle Center',
      };
    }
    this.updateCoordsDisplay();
    if (this.isOpen) this.irisLayer.render(this.center.lat, this.center.lon, this.radiusKm);
  }

  setCityCenter(cityName) {
    const city = CITIES.find((c) => c.name === cityName);
    if (city) {
      this.center = { lat: city.lat, lon: city.lon, name: city.name };
      this.updateCoordsDisplay();
      if (this.isOpen) this.irisLayer.render(this.center.lat, this.center.lon, this.radiusKm);
      this.evaluateHits();
    }
  }

  updateCoordsDisplay() {
    const el = this.element.querySelector('#scanCoords');
    if (el) el.textContent = `${this.center.lat.toFixed(2)}°N, ${this.center.lon.toFixed(2)}°E (${this.center.name})`;
  }

  evaluateHits() {
    const hits = this.collectCurrentHits();
    const elAir = this.element.querySelector('#hitCountAir');
    const elSat = this.element.querySelector('#hitCountSat');
    const elQuake = this.element.querySelector('#hitCountQuake');
    const elFire = this.element.querySelector('#hitCountFire');
    if (elAir) elAir.textContent = String(hits.aircraft.length);
    if (elSat) elSat.textContent = String(hits.satellites.length);
    if (elQuake) elQuake.textContent = String(hits.quakes.length);
    if (elFire) elFire.textContent = String(hits.fires.length);

    const elNearestAir = this.element.querySelector('#nearestAir');
    if (elNearestAir) elNearestAir.textContent = hits.nearestAir ? `${hits.nearestAir.callsign} (${Math.round(hits.nearestAir.distanceKm)} km)` : 'None in radius';
    const elNearestSat = this.element.querySelector('#nearestSat');
    if (elNearestSat) elNearestSat.textContent = hits.nearestSat ? `${hits.nearestSat.name} (el ${hits.nearestSat.elevation.toFixed(1)}°)` : 'None overhead';
  }

  collectCurrentHits() {
    const radiusM = this.radiusKm * 1000.0;
    const { lat, lon } = this.center;
    const airHits = [];
    let nearestAir = null, minAirDist = Infinity;

    for (const ac of this.currentData.aircraft) {
      if (typeof ac.lat === 'number' && typeof ac.lon === 'number') {
        const distM = haversineDistance(lat, lon, ac.lat, ac.lon);
        if (distM <= radiusM) {
          const hit = { ...ac, distanceKm: distM / 1000.0 };
          airHits.push(hit);
          if (distM < minAirDist) { minAirDist = distM; nearestAir = hit; }
        }
      }
    }

    const satHits = [];
    let nearestSat = null, maxSatEl = -Infinity;
    for (const sat of this.currentData.satellites) {
      if (typeof sat.latDeg === 'number' && typeof sat.lonDeg === 'number') {
        const el = calculateElevationDeg(lat, lon, 0, sat.latDeg, sat.lonDeg, sat.altKm || 400);
        if (el >= 10.0) {
          const hit = { ...sat, elevation: el };
          satHits.push(hit);
          if (el > maxSatEl) { maxSatEl = el; nearestSat = hit; }
        }
      }
    }

    const quakeHits = this.currentData.quakes.filter((q) => typeof q.lat === 'number' && haversineDistance(lat, lon, q.lat, q.lon) <= radiusM);
    const fireHits = this.currentData.fires.filter((f) => typeof f.lat === 'number' && haversineDistance(lat, lon, f.lat, f.lon) <= radiusM);
    return { center: this.center, radiusKm: this.radiusKm, aircraft: airHits, satellites: satHits, quakes: quakeHits, fires: fireHits, nearestAir, nearestSat };
  }
}
