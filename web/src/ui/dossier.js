// @ts-check
import { events } from '../core/events.js';

/**
 * Unified Object Dossier Panel (Right Rail HUD)
 * Renders live telemetry for the selected satellite (SAT-02), aircraft (FLT-02),
 * earthquake (HAZ-01), or fire hotspot (HAZ-02).
 */
export class DossierPanel {
  /**
   * @param {HTMLElement} root
   */
  constructor(root) {
    this.root = root;
    this.element = document.createElement('aside');
    this.element.className = 'hud-dossier';
    this.element.id = 'hudDossier';
    this.element.style.display = 'none';

    this.element.innerHTML = `
      <div class="dossier-header">
        <div class="dossier-title">
          <span class="dossier-badge sat" id="dossierBadge">SATELLITE</span>
          <span class="dossier-id" id="dossierSubId">NORAD -----</span>
        </div>
        <button class="dossier-close-btn" id="dossierClose" title="Close (Esc)">✕</button>
      </div>

      <div class="dossier-body">
        <div class="dossier-name" id="dossierName">--------</div>

        <div class="dossier-grid" id="dossierGrid">
          <!-- Dynamically populated rows -->
        </div>

        <div class="dossier-actions">
          <button class="dossier-action-btn primary" id="btnDossierFlyTo">
            <span>⌖</span> FLY TO
          </button>
          <button class="dossier-action-btn secondary" id="btnDossierTrack" style="display:none">
            TRACK
          </button>
          <button class="dossier-action-btn secondary" id="btnDossierCockpit" style="display:none">
            ✈ COCKPIT [C]
          </button>
          <button class="dossier-action-btn secondary" id="btnDossierClear">
            CLEAR
          </button>
        </div>
      </div>
    `;

    this.root.appendChild(this.element);

    this.elBadge = this.element.querySelector('#dossierBadge');
    this.elSubId = this.element.querySelector('#dossierSubId');
    this.elName = this.element.querySelector('#dossierName');
    this.elGrid = this.element.querySelector('#dossierGrid');

    this.currentType = null;
    this.currentId = null;

    this.setupEvents();
  }

  setupEvents() {
    // Satellite telemetry
    events.subscribe('satellite:telemetry', (t) => {
      this.renderSatellite(t);
    });
    events.subscribe('satellite:deselected', () => {
      if (this.currentType === 'sat') this.close();
    });

    // Aircraft telemetry
    events.subscribe('aircraft:selected', (ac) => {
      this.renderAircraft(ac);
    });
    events.subscribe('aircraft:telemetry', (ac) => {
      if (this.currentType === 'air' && this.currentId === ac.hex) {
        this.renderAircraft(ac);
      }
    });
    events.subscribe('aircraft:deselected', () => {
      if (this.currentType === 'air') this.close();
    });

    // Earthquake events
    events.subscribe('quake:selected', (q) => {
      this.renderQuake(q);
    });
    events.subscribe('quake:deselected', () => {
      if (this.currentType === 'quake') this.close();
    });

    // Fire hotspot events
    events.subscribe('fire:selected', (f) => {
      this.renderFire(f);
    });
    events.subscribe('fire:deselected', () => {
      if (this.currentType === 'fire') this.close();
    });

    // Action buttons
    const btnClose = this.element.querySelector('#dossierClose');
    const btnClear = this.element.querySelector('#btnDossierClear');
    const btnFlyTo = this.element.querySelector('#btnDossierFlyTo');
    const btnTrack = this.element.querySelector('#btnDossierTrack');
    const btnCockpit = this.element.querySelector('#btnDossierCockpit');

    if (btnClose) btnClose.addEventListener('click', () => this.handleClear());
    if (btnClear) btnClear.addEventListener('click', () => this.handleClear());
    if (btnFlyTo) btnFlyTo.addEventListener('click', () => this.handleFlyTo());
    if (btnTrack) {
      btnTrack.addEventListener('click', () => {
        if (this.currentType === 'sat') {
          events.emit('satellite:toggle-track', this.currentId);
        }
      });
    }
    if (btnCockpit) {
      btnCockpit.addEventListener('click', () => {
        events.emit('intent:TOGGLE_COCKPIT', null);
      });
    }

    events.subscribe('cockpit:state', ({ active }) => {
      if (btnCockpit) {
        btnCockpit.textContent = active ? '✕ EXIT CHASE [C]' : '✈ COCKPIT [C]';
        btnCockpit.className = active ? 'dossier-action-btn primary' : 'dossier-action-btn secondary';
      }
    });

    // Cache for flight routes
    this.routeCache = new Map();

    // Keyboard shortcut Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.element.style.display !== 'none') {
        this.handleClear();
      }
    });
  }

  /**
   * Render satellite telemetry
   * @param {Record<string, any>} t
   */
  renderSatellite(t) {
    this.currentType = 'sat';
    this.currentId = t.id;

    if (this.elBadge) {
      this.elBadge.className = 'dossier-badge sat';
      this.elBadge.textContent = 'SATELLITE';
    }
    if (this.elSubId) this.elSubId.textContent = `NORAD ${t.id}`;
    if (this.elName) this.elName.textContent = t.name;

    if (this.elGrid) {
      this.elGrid.innerHTML = `
        <div class="dossier-row">
          <span class="lbl">GROUP</span>
          <span class="val">${(t.group || 'science').toUpperCase()}</span>
        </div>
        <div class="dossier-row">
          <span class="lbl">ALTITUDE</span>
          <span class="val highlight">${Math.round(t.altKm)} km</span>
        </div>
        <div class="dossier-row">
          <span class="lbl">SPEED</span>
          <span class="val">${t.speedKmS.toFixed(2)} km/s</span>
        </div>
        <div class="dossier-row">
          <span class="lbl">INCLINATION</span>
          <span class="val">${Number(t.inclinationDeg).toFixed(1)}°</span>
        </div>
        <div class="dossier-row">
          <span class="lbl">PERIOD</span>
          <span class="val">${Number(t.periodMin).toFixed(1)} min</span>
        </div>
        <div class="dossier-row">
          <span class="lbl">ELEMENT AGE</span>
          <span class="val">${t.elementAgeDays} days</span>
        </div>
      `;
    }

    const btnTrack = /** @type {HTMLElement|null} */ (this.element.querySelector('#btnDossierTrack'));
    if (btnTrack) {
      btnTrack.style.display = 'flex';
      btnTrack.textContent = 'GROUND TRACK';
    }

    this.element.style.display = 'flex';
  }

  /**
   * Render aircraft telemetry per FLT-02 & wireframe W2
   * @param {Record<string, any>} ac
   */
  renderAircraft(ac) {
    this.currentType = 'air';
    this.currentId = ac.hex;

    const isEmergency = ['7700', '7600', '7500'].includes(ac.squawk);
    const isMil = Boolean(ac.is_military);

    if (this.elBadge) {
      if (isEmergency) {
        this.elBadge.className = 'dossier-badge alert';
        this.elBadge.textContent = 'EMERGENCY';
      } else if (isMil) {
        this.elBadge.className = 'dossier-badge mil';
        this.elBadge.textContent = 'MILITARY';
      } else {
        this.elBadge.className = 'dossier-badge air';
        this.elBadge.textContent = 'AIRCRAFT';
      }
    }
    if (this.elSubId) this.elSubId.textContent = `ICAO ${ac.hex.toUpperCase()}`;
    if (this.elName) this.elName.textContent = `${ac.callsign || 'UNKNOWN'}  ${ac.type || ''}`;

    const squawkDisplay = isEmergency
      ? `<span class="val alert">${ac.squawk} [EMERGENCY]</span>`
      : `<span class="val">${ac.squawk || '----'}</span>`;

    // Fetch and display route enrichment
    let routeHtml = '';
    const cachedRoute = ac.callsign ? this.routeCache.get(ac.callsign) : null;
    if (cachedRoute) {
      routeHtml = `
        <div class="dossier-row route-row" style="background: rgba(56, 189, 248, 0.12); padding: 4px 6px; border-radius: 4px;">
          <span class="lbl" style="color:#38BDF8; font-weight:bold;">ROUTE</span>
          <span class="val highlight" style="color:#38BDF8; font-weight:bold;">${cachedRoute.origin?.iata || 'DEP'} ➔ ${cachedRoute.destination?.iata || 'ARR'}</span>
        </div>
        <div class="dossier-row">
          <span class="lbl">AIRLINE</span>
          <span class="val">${cachedRoute.airline?.name || 'Commercial'}</span>
        </div>
        <div class="dossier-row">
          <span class="lbl">AIRWAY DIST</span>
          <span class="val">${cachedRoute.distance_km ? Math.round(cachedRoute.distance_km) + ' km' : '---'}</span>
        </div>
      `;
    } else if (ac.callsign && !this.routeCache.has(ac.callsign)) {
      // Trigger async fetch
      this.routeCache.set(ac.callsign, null); // mark in flight
      fetch(`/api/route/${encodeURIComponent(ac.callsign)}`)
        .then((r) => r.json())
        .then((routeData) => {
          if (routeData && !routeData.error) {
            this.routeCache.set(ac.callsign, routeData);
            events.emit('aircraft:routeLoaded', routeData);
            if (this.currentType === 'air' && this.currentId === ac.hex) {
              this.renderAircraft(ac);
            }
          }
        })
        .catch(() => {});
    }

    if (this.elGrid) {
      this.elGrid.innerHTML = `
        ${routeHtml}
        <div class="dossier-row">
          <span class="lbl">ALTITUDE</span>
          <span class="val highlight">${(ac.alt_ft || 0).toLocaleString()} ft</span>
        </div>
        <div class="dossier-row">
          <span class="lbl">GROUND SPEED</span>
          <span class="val">${Math.round(ac.gs_kt || 0)} kt</span>
        </div>
        <div class="dossier-row">
          <span class="lbl">HEADING</span>
          <span class="val">${Math.round(ac.track_deg || 0)}°</span>
        </div>
        <div class="dossier-row">
          <span class="lbl">VERT RATE</span>
          <span class="val">${ac.vs_fpm || 0} fpm</span>
        </div>
        <div class="dossier-row">
          <span class="lbl">SQUAWK</span>
          ${squawkDisplay}
        </div>
        <div class="dossier-row">
          <span class="lbl">STATUS</span>
          <span class="val">${ac.on_ground ? 'ON GROUND' : (isMil ? 'TACTICAL PATROL' : 'AIRBORNE')}</span>
        </div>
      `;
    }

    const btnTrack = /** @type {HTMLElement|null} */ (this.element.querySelector('#btnDossierTrack'));
    const btnCockpit = /** @type {HTMLElement|null} */ (this.element.querySelector('#btnDossierCockpit'));
    if (btnTrack) btnTrack.style.display = 'none';
    if (btnCockpit) btnCockpit.style.display = 'flex';

    this.element.style.display = 'flex';
  }

  /**
   * Render earthquake event per HAZ-01 & wireframe W2
   * @param {Record<string, any>} q
   */
  renderQuake(q) {
    this.currentType = 'quake';
    this.currentId = q.id;

    if (this.elBadge) {
      this.elBadge.className = 'dossier-badge quake';
      this.elBadge.textContent = 'EARTHQUAKE';
    }
    if (this.elSubId) this.elSubId.textContent = `USGS ${q.id}`;
    if (this.elName) this.elName.textContent = `MAGNITUDE ${q.mag.toFixed(1)}`;

    const dateStr = q.time ? new Date(q.time).toUTCString().slice(17, 25) + ' UTC' : '--:--:-- UTC';

    if (this.elGrid) {
      this.elGrid.innerHTML = `
        <div class="dossier-row">
          <span class="lbl">LOCATION</span>
          <span class="val highlight">${q.place}</span>
        </div>
        <div class="dossier-row">
          <span class="lbl">MAGNITUDE</span>
          <span class="val highlight" style="color:var(--quake)">M ${q.mag.toFixed(1)}</span>
        </div>
        <div class="dossier-row">
          <span class="lbl">DEPTH</span>
          <span class="val">${q.depth_km} km</span>
        </div>
        <div class="dossier-row">
          <span class="lbl">ORIGIN TIME</span>
          <span class="val">${dateStr}</span>
        </div>
        <div class="dossier-row">
          <span class="lbl">COORDINATES</span>
          <span class="val">${q.lat.toFixed(2)}°, ${q.lon.toFixed(2)}°</span>
        </div>
      `;
    }

    const btnTrack = /** @type {HTMLElement|null} */ (this.element.querySelector('#btnDossierTrack'));
    if (btnTrack) {
      btnTrack.style.display = 'flex';
      btnTrack.textContent = 'GROUND TRACK';
    }

    this.element.style.display = 'flex';
  }

  /**
   * Render active fire hotspot per HAZ-02
   * @param {Record<string, any>} f
   */
  renderFire(f) {
    this.currentType = 'fire';
    this.currentId = `${f.lat}_${f.lon}`;

    if (this.elBadge) {
      this.elBadge.className = 'dossier-badge fire';
      this.elBadge.textContent = 'FIRE HOTSPOT';
    }
    if (this.elSubId) this.elSubId.textContent = f.satellite || 'VIIRS SNPP';
    if (this.elName) this.elName.textContent = `FRP ${f.frp || 0} MW`;

    if (this.elGrid) {
      this.elGrid.innerHTML = `
        <div class="dossier-row">
          <span class="lbl">POWER (FRP)</span>
          <span class="val highlight" style="color:var(--fire)">${f.frp} MW</span>
        </div>
        <div class="dossier-row">
          <span class="lbl">CONFIDENCE</span>
          <span class="val">${(f.confidence || 'nominal').toUpperCase()}</span>
        </div>
        <div class="dossier-row">
          <span class="lbl">ACQUISITION</span>
          <span class="val">${f.acq_time || 'N/A'}</span>
        </div>
        <div class="dossier-row">
          <span class="lbl">COORDINATES</span>
          <span class="val">${f.lat.toFixed(2)}°, ${f.lon.toFixed(2)}°</span>
        </div>
      `;
    }

    const btnTrack = /** @type {HTMLElement|null} */ (this.element.querySelector('#btnDossierTrack'));
    if (btnTrack) {
      btnTrack.style.display = 'flex';
      btnTrack.textContent = 'GROUND TRACK';
    }

    this.element.style.display = 'flex';
  }

  handleFlyTo() {
    if (!this.currentId) return;
    if (this.currentType === 'sat') {
      events.emit('dossier:flyTo', this.currentId);
    } else if (this.currentType === 'air') {
      events.emit('dossier:flyToAircraft', this.currentId);
    } else if (this.currentType === 'quake') {
      events.emit('dossier:flyToQuake', this.currentId);
    } else if (this.currentType === 'fire') {
      events.emit('dossier:flyToFire', this.currentId);
    }
  }

  handleClear() {
    if (this.currentType === 'sat') {
      events.emit('dossier:clear', null);
    } else if (this.currentType === 'air') {
      events.emit('dossier:clearAircraft', null);
    } else if (this.currentType === 'quake') {
      events.emit('dossier:clearQuake', null);
    } else if (this.currentType === 'fire') {
      events.emit('dossier:clearFire', null);
    }
    this.close();
  }

  close() {
    this.element.style.display = 'none';
    this.currentType = null;
    this.currentId = null;
  }
}
