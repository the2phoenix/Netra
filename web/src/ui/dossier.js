// @ts-check
import { events } from '../core/events.js';

/**
 * Unified Object Dossier Panel (Right Rail HUD)
 * Renders live telemetry for the selected satellite (SAT-02) or aircraft (FLT-02).
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
    // Satellite telemetry updates
    events.subscribe('satellite:telemetry', (t) => {
      this.renderSatellite(t);
    });

    events.subscribe('satellite:deselected', () => {
      if (this.currentType === 'sat') this.close();
    });

    // Aircraft telemetry updates
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

    // Action buttons
    const btnClose = this.element.querySelector('#dossierClose');
    const btnClear = this.element.querySelector('#btnDossierClear');
    const btnFlyTo = this.element.querySelector('#btnDossierFlyTo');

    if (btnClose) btnClose.addEventListener('click', () => this.handleClear());
    if (btnClear) btnClear.addEventListener('click', () => this.handleClear());
    if (btnFlyTo) btnFlyTo.addEventListener('click', () => this.handleFlyTo());

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

    this.element.style.display = 'flex';
  }

  /**
   * Render aircraft telemetry per FLT-02 & wireframe W2
   * Note: strictly omits registration & owner data per privacy / ethics rule.
   * @param {Record<string, any>} ac
   */
  renderAircraft(ac) {
    this.currentType = 'air';
    this.currentId = ac.hex;

    const isEmergency = ['7700', '7600', '7500'].includes(ac.squawk);

    if (this.elBadge) {
      this.elBadge.className = isEmergency ? 'dossier-badge alert' : 'dossier-badge air';
      this.elBadge.textContent = isEmergency ? 'EMERGENCY' : 'AIRCRAFT';
    }
    if (this.elSubId) this.elSubId.textContent = `ICAO ${ac.hex.toUpperCase()}`;
    if (this.elName) this.elName.textContent = `${ac.callsign || 'UNKNOWN'}  ${ac.type || ''}`;

    const squawkDisplay = isEmergency
      ? `<span class="val alert">${ac.squawk} [EMERGENCY]</span>`
      : `<span class="val">${ac.squawk || '----'}</span>`;

    if (this.elGrid) {
      this.elGrid.innerHTML = `
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
          <span class="val">${ac.on_ground ? 'ON GROUND' : 'AIRBORNE'}</span>
        </div>
      `;
    }

    this.element.style.display = 'flex';
  }

  handleFlyTo() {
    if (!this.currentId) return;
    if (this.currentType === 'sat') {
      events.emit('dossier:flyTo', this.currentId);
    } else if (this.currentType === 'air') {
      events.emit('dossier:flyToAircraft', this.currentId);
    }
  }

  handleClear() {
    if (this.currentType === 'sat') {
      events.emit('dossier:clear', null);
    } else if (this.currentType === 'air') {
      events.emit('dossier:clearAircraft', null);
    }
    this.close();
  }

  close() {
    this.element.style.display = 'none';
    this.currentType = null;
    this.currentId = null;
  }
}
