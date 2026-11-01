// @ts-check
import { events } from '../core/events.js';

/**
 * About & Architectural Credits Modal
 * Acknowledges inspirations, open data feeds, and project provenance per Phase 7 & Viva readiness.
 *
 * @param {HTMLElement} root
 */
export function initAboutModal(root) {
  const modal = document.createElement('div');
  modal.className = 'about-modal';
  modal.id = 'aboutModal';
  modal.style.display = 'none';

  modal.innerHTML = `
    <div class="about-backdrop"></div>
    <div class="about-card">
      <div class="about-header">
        <div class="about-title">
          <span class="brand-sanskrit">नेत्र</span>
          <span>NETRA COMMAND CENTER</span>
        </div>
        <button class="about-close-btn" id="aboutCloseBtn">✕</button>
      </div>

      <div class="about-body">
        <div class="about-section">
          <h3>PROJECT ARCHITECTURE</h3>
          <p>
            NETRA (Real-time Earth 3D Observation & Tactical Intelligence) is an open-architecture,
            zero-budget spatial command center rendering live orbital satellites, commercial & military aircraft,
            and planetary hazard telemetry on an interactive 3D virtual globe with hand gesture tracking.
          </p>
        </div>

        <div class="about-section">
          <h3>TACTICAL SENSOR PIPELINE</h3>
          <p>
            Real-time multi-source data fusion engine incorporating commercial and military ADS-B transponder telemetry,
            SGP4 satellite orbital propagation, and real-time seismic hazard detection.
          </p>
        </div>

        <div class="about-section">
          <h3>OPEN & KEYLESS DATA FEEDS</h3>
          <div class="credits-grid">
            <div class="credit-item">
              <span class="credit-src">CelesTrak</span>
              <span class="credit-desc">Live NORAD two-line orbital elements (TLE / SGP4)</span>
            </div>
            <div class="credit-item">
              <span class="credit-src">adsb.lol & OpenSky</span>
              <span class="credit-desc">Live commercial and military transponder feeds (ADS-B / Mode S)</span>
            </div>
            <div class="credit-item">
              <span class="credit-src">adsbdb.com</span>
              <span class="credit-desc">Keyless airline, flight number, and origin/destination routing</span>
            </div>
            <div class="credit-item">
              <span class="credit-src">USGS Hazards</span>
              <span class="credit-desc">Real-time global earthquake seismic GeoJSON feeds</span>
            </div>
            <div class="credit-item">
              <span class="credit-src">NASA GIBS & FIRMS</span>
              <span class="credit-desc">MODIS / VIIRS thermal anomaly hotspots & Blue Marble tiles</span>
            </div>
            <div class="credit-item">
              <span class="credit-src">Google MediaPipe</span>
              <span class="credit-desc">On-device edge AI hand landmark detection (100% offline Wasm)</span>
            </div>
          </div>
        </div>

        <div class="about-footer">
          <span>NETRA v1.0 • Built with CesiumJS & FastAPI • $0 Budget Production Build</span>
        </div>
      </div>
    </div>
  `;
  root.appendChild(modal);

  const closeBtn = modal.querySelector('#aboutCloseBtn');
  const backdrop = modal.querySelector('.about-backdrop');

  function openModal() {
    modal.style.display = 'flex';
  }

  function closeModal() {
    modal.style.display = 'none';
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display !== 'none') {
      closeModal();
    }
  });

  events.subscribe('about:open', openModal);
}

