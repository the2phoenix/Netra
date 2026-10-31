// @ts-check
import { events } from '../core/events.js';
import { state } from '../core/state.js';

const STORAGE_KEY = 'netra_layer_prefs';

/**
 * Layer Panel (Left Rail HUD)
 * Controls visibility of satellite groups, aircraft, hazards, and imagery layers.
 * State survives page reload via localStorage (REQ HUD-02).
 */
export class LayerPanel {
  /**
   * @param {HTMLElement} root
   */
  constructor(root) {
    this.root = root;
    this.isOpen = true;

    // Load persisted preferences
    this.prefs = this.loadPreferences();

    this.element = document.createElement('aside');
    this.element.className = 'hud-layer-panel';
    this.element.id = 'hudLayerPanel';

    this.render();
    this.root.appendChild(this.element);

    this.setupEvents();
  }

  loadPreferences() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      // Fallback
    }
    return {
      aircraft: true,
      quakes: true,
      fires: false,
      satellites: {
        stations: true,
        'gps-ops': true,
        weather: true,
        science: true,
        geo: true,
        starlink: true,
      },
      imagery: {
        nightLights: true,
        clouds: true,
        borders: true,
      },
    };
  }

  savePreferences() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.prefs));
    } catch (e) {
      // Ignore storage errors
    }
  }

  render() {
    this.element.innerHTML = `
      <div class="panel-header">
        <div class="panel-title">
          <span class="panel-icon">☰</span>
          <span>LAYERS</span>
        </div>
        <button class="panel-toggle-btn" id="btnToggleLayers" title="Toggle panel ([)">[</button>
      </div>

      <div class="panel-content" id="layerPanelContent">
        <!-- Live Aircraft Section -->
        <div class="layer-section">
          <div class="section-title">
            <span class="indicator air">●</span> LIVE AIRCRAFT
          </div>
          <div class="layer-items">
            <label class="layer-item">
              <input type="checkbox" id="chkLayerAircraft" ${this.prefs.aircraft !== false ? 'checked' : ''}>
              <span class="layer-dot" style="background:#2DD4BF"></span>
              <span class="layer-label">ADS-B Traffic (Sampled)</span>
            </label>
            <div class="layer-sub-legend" style="padding-left: 20px; font-size: 10px; color: #94A3B8; display: flex; flex-direction: column; gap: 3px; margin: 4px 0 6px 0;">
              <div><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#FFFFFF;margin-right:6px;"></span>White: Jet Cruise (&gt;30k ft)</div>
              <div><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#35D0E8;margin-right:6px;"></span>Cyan: Mid Cruise (10k–30k ft)</div>
              <div><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#2DD4BF;margin-right:6px;"></span>Teal: Low Alt / Climb (&lt;10k ft)</div>
              <div><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#EF4444;margin-right:6px;"></span>Red: Squawk 7700 (Alert)</div>
            </div>
          </div>
        </div>

        <!-- Natural Hazards Section -->
        <div class="layer-section">
          <div class="section-title">
            <span class="indicator alert" style="color:var(--fire)">●</span> NATURAL HAZARDS
          </div>
          <div class="layer-items">
            <label class="layer-item">
              <input type="checkbox" id="chkLayerQuakes" ${this.prefs.quakes !== false ? 'checked' : ''}>
              <span class="layer-dot" style="background:#EF4444"></span>
              <span class="layer-label">Earthquakes (USGS M2.5+)</span>
            </label>
            <label class="layer-item">
              <input type="checkbox" id="chkLayerFires" ${this.prefs.fires ? 'checked' : ''}>
              <span class="layer-dot" style="background:#FF6A1A"></span>
              <span class="layer-label">Fire Hotspots (NASA FIRMS)</span>
            </label>
          </div>
        </div>

        <!-- Satellites Section -->
        <div class="layer-section">
          <div class="section-title">
            <span class="indicator sat">●</span> SATELLITE GROUPS
          </div>
          <div class="layer-items">
            <label class="layer-item">
              <input type="checkbox" id="chkGroupStations" ${this.prefs.satellites.stations ? 'checked' : ''}>
              <span class="layer-dot" style="background:#FF6A1A"></span>
              <span class="layer-label">Space Stations</span>
            </label>
            <label class="layer-item">
              <input type="checkbox" id="chkGroupGps" ${this.prefs.satellites['gps-ops'] ? 'checked' : ''}>
              <span class="layer-dot" style="background:#35D0E8"></span>
              <span class="layer-label">GPS Constellation</span>
            </label>
            <label class="layer-item">
              <input type="checkbox" id="chkGroupWeather" ${this.prefs.satellites.weather ? 'checked' : ''}>
              <span class="layer-dot" style="background:#34D399"></span>
              <span class="layer-label">Weather Satellites</span>
            </label>
            <label class="layer-item">
              <input type="checkbox" id="chkGroupScience" ${this.prefs.satellites.science ? 'checked' : ''}>
              <span class="layer-dot" style="background:#A78BFA"></span>
              <span class="layer-label">Science & Earth Obs</span>
            </label>
            <label class="layer-item">
              <input type="checkbox" id="chkGroupGeo" ${this.prefs.satellites.geo ? 'checked' : ''}>
              <span class="layer-dot" style="background:#FBBF24"></span>
              <span class="layer-label">Geostationary Belt</span>
            </label>
            <label class="layer-item">
              <input type="checkbox" id="chkGroupStarlink" ${this.prefs.satellites.starlink ? 'checked' : ''}>
              <span class="layer-dot" style="background:#94A3B8"></span>
              <span class="layer-label">Starlink Constellation</span>
            </label>
          </div>
        </div>

        <!-- Imagery Overlays Section -->
        <div class="layer-section">
          <div class="section-title">
            <span class="indicator live">●</span> NASA IMAGERY
          </div>
          <div class="layer-items">
            <label class="layer-item">
              <input type="checkbox" id="chkImgNight" ${this.prefs.imagery.nightLights ? 'checked' : ''}>
              <span class="layer-dot" style="background:#FDE047"></span>
              <span class="layer-label">Night City Lights</span>
            </label>
            <label class="layer-item">
              <input type="checkbox" id="chkImgClouds" ${this.prefs.imagery.clouds ? 'checked' : ''}>
              <span class="layer-dot" style="background:#E2E8F0"></span>
              <span class="layer-label">Weather Clouds</span>
            </label>
            <label class="layer-item">
              <input type="checkbox" id="chkImgBorders" ${this.prefs.imagery.borders ? 'checked' : ''}>
              <span class="layer-dot" style="background:#60A5FA"></span>
              <span class="layer-label">Borders & Outlines</span>
            </label>
          </div>
        </div>

        <!-- Scan & Surveillance Section -->
        <div class="layer-section">
          <div class="section-title">
            <span class="indicator alert" style="color:var(--sat)">●</span> SURVEILLANCE & SCAN
          </div>
          <div class="layer-items">
            <button class="panel-action-btn" id="btnOpenScanIris" title="Toggle Scan Iris (S)">
              <span>📡</span> OPEN SCAN IRIS
            </button>
          </div>
        </div>
      </div>
    `;
  }

  setupEvents() {
    const btnToggle = this.element.querySelector('#btnToggleLayers');
    const content = this.element.querySelector('#layerPanelContent');

    const toggleOpen = () => {
      this.isOpen = !this.isOpen;
      if (content) {
        // @ts-ignore
        content.style.display = this.isOpen ? 'block' : 'none';
      }
      this.element.classList.toggle('collapsed', !this.isOpen);
    };

    if (btnToggle) btnToggle.addEventListener('click', toggleOpen);

    // Keyboard shortcut '[' toggles left rail
    window.addEventListener('keydown', (e) => {
      if (e.key === '[' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) {
        toggleOpen();
      }
    });

    // Aircraft checkbox
    const chkAircraft = /** @type {HTMLInputElement|null} */ (this.element.querySelector('#chkLayerAircraft'));
    if (chkAircraft) {
      chkAircraft.addEventListener('change', () => {
        const visible = chkAircraft.checked;
        this.prefs.aircraft = visible;
        this.savePreferences();
        state.layers.aircraft = visible;
        events.emit('state:layers', state.layers);
      });
    }

    // Quake checkbox
    const chkQuakes = /** @type {HTMLInputElement|null} */ (this.element.querySelector('#chkLayerQuakes'));
    if (chkQuakes) {
      chkQuakes.addEventListener('change', () => {
        const visible = chkQuakes.checked;
        this.prefs.quakes = visible;
        this.savePreferences();
        state.layers.quakes = visible;
        events.emit('state:layers', state.layers);
      });
    }

    // Fire checkbox
    const chkFires = /** @type {HTMLInputElement|null} */ (this.element.querySelector('#chkLayerFires'));
    if (chkFires) {
      chkFires.addEventListener('change', () => {
        const visible = chkFires.checked;
        this.prefs.fires = visible;
        this.savePreferences();
        state.layers.fires = visible;
        events.emit('state:layers', state.layers);
      });
    }

    // Satellite checkboxes
    const satGroupMap = [
      { id: 'chkGroupStations', group: 'stations' },
      { id: 'chkGroupGps', group: 'gps-ops' },
      { id: 'chkGroupWeather', group: 'weather' },
      { id: 'chkGroupScience', group: 'science' },
      { id: 'chkGroupGeo', group: 'geo' },
      { id: 'chkGroupStarlink', group: 'starlink' },
    ];

    satGroupMap.forEach(({ id, group }) => {
      const el = /** @type {HTMLInputElement|null} */ (this.element.querySelector(`#${id}`));
      if (el) {
        el.addEventListener('change', () => {
          const visible = el.checked;
          this.prefs.satellites[group] = visible;
          this.savePreferences();
          events.emit('satellites:toggleGroup', { group, visible });
        });
      }
    });

    // Imagery checkboxes
    const imgMap = [
      { id: 'chkImgNight', key: 'nightLights' },
      { id: 'chkImgClouds', key: 'clouds' },
      { id: 'chkImgBorders', key: 'borders' },
    ];

    imgMap.forEach(({ id, key }) => {
      const el = /** @type {HTMLInputElement|null} */ (this.element.querySelector(`#${id}`));
      if (el) {
        el.addEventListener('change', () => {
          const visible = el.checked;
          this.prefs.imagery[key] = visible;
          this.savePreferences();
          events.emit('imagery:toggle', { layer: key, visible });
        });
      }
    });

    // Scan Iris action button
    const btnScan = this.element.querySelector('#btnOpenScanIris');
    if (btnScan) {
      btnScan.addEventListener('click', () => {
        events.emit('scan:toggle');
      });
    }
  }
}

