// @ts-check
import { events } from '../core/events.js';

/**
 * Satellite Dossier Panel (Right Rail HUD)
 * Renders telemetry for the selected satellite within 200ms per SAT-02.
 * Displays: Name, NORAD ID, Group, Altitude, Speed, Inclination, Period, Element Age.
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
          <span class="dossier-badge sat">SATELLITE</span>
          <span class="dossier-id" id="dossierNorad">NORAD -----</span>
        </div>
        <button class="dossier-close-btn" id="dossierClose" title="Close (Esc)">✕</button>
      </div>

      <div class="dossier-body">
        <div class="dossier-name" id="dossierName">--------</div>

        <div class="dossier-grid">
          <div class="dossier-row">
            <span class="lbl">GROUP</span>
            <span class="val" id="dossierGroup">--</span>
          </div>
          <div class="dossier-row">
            <span class="lbl">ALTITUDE</span>
            <span class="val highlight" id="dossierAlt">-- km</span>
          </div>
          <div class="dossier-row">
            <span class="lbl">SPEED</span>
            <span class="val" id="dossierSpeed">-- km/s</span>
          </div>
          <div class="dossier-row">
            <span class="lbl">INCLINATION</span>
            <span class="val" id="dossierIncl">--°</span>
          </div>
          <div class="dossier-row">
            <span class="lbl">PERIOD</span>
            <span class="val" id="dossierPeriod">-- min</span>
          </div>
          <div class="dossier-row">
            <span class="lbl">ELEMENT AGE</span>
            <span class="val" id="dossierAge">-- days</span>
          </div>
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

    // Cache elements
    this.elNorad = this.element.querySelector('#dossierNorad');
    this.elName = this.element.querySelector('#dossierName');
    this.elGroup = this.element.querySelector('#dossierGroup');
    this.elAlt = this.element.querySelector('#dossierAlt');
    this.elSpeed = this.element.querySelector('#dossierSpeed');
    this.elIncl = this.element.querySelector('#dossierIncl');
    this.elPeriod = this.element.querySelector('#dossierPeriod');
    this.elAge = this.element.querySelector('#dossierAge');

    this.currentId = null;

    this.setupEvents();
  }

  setupEvents() {
    // Telemetry updates
    events.subscribe('satellite:telemetry', (telemetry) => {
      this.renderTelemetry(telemetry);
    });

    events.subscribe('satellite:deselected', () => {
      this.close();
    });

    // Close buttons
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
   * Render telemetry data into dossier
   * @param {Record<string, any>} t
   */
  renderTelemetry(t) {
    this.currentId = t.id;
    if (this.elNorad) this.elNorad.textContent = `NORAD ${t.id}`;
    if (this.elName) this.elName.textContent = t.name;
    if (this.elGroup) this.elGroup.textContent = (t.group || 'science').toUpperCase();
    if (this.elAlt) this.elAlt.textContent = `${Math.round(t.altKm)} km`;
    if (this.elSpeed) this.elSpeed.textContent = `${t.speedKmS.toFixed(2)} km/s`;
    if (this.elIncl) this.elIncl.textContent = `${Number(t.inclinationDeg).toFixed(1)}°`;
    if (this.elPeriod) this.elPeriod.textContent = `${Number(t.periodMin).toFixed(1)} min`;
    if (this.elAge) this.elAge.textContent = `${t.elementAgeDays} days`;

    this.element.style.display = 'flex';
  }

  handleFlyTo() {
    if (this.currentId) {
      events.emit('dossier:flyTo', this.currentId);
    }
  }

  handleClear() {
    this.close();
    events.emit('dossier:clear', null);
  }

  close() {
    this.element.style.display = 'none';
    this.currentId = null;
  }
}
