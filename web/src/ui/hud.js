// @ts-check
import { events } from '../core/events.js';
import { state } from '../core/state.js';

/**
 * Initializes and manages HUD overlays (Top bar, bottom status, reticle).
 *
 * @param {HTMLElement} root
 */
export function initHUD(root) {
  // Top bar container
  const topbar = document.createElement('header');
  topbar.className = 'hud-topbar';
  topbar.innerHTML = `
    <div class="hud-left">
      <div class="brand">
        <span class="brand-sanskrit">नेत्र</span>
        <span>NETRA</span>
      </div>
      <div class="utc-clock" id="hudClock">UTC --:--:--</div>
      <div class="hud-metrics">
        <div class="metric-item sat">
          <span>SAT</span>
          <span class="val" id="hudCountSat">0</span>
        </div>
        <div class="metric-item air">
          <span>AIR</span>
          <span class="val" id="hudCountAir">0</span>
        </div>
        <div class="metric-item quake">
          <span>QUAKE</span>
          <span class="val" id="hudCountQuake">0</span>
        </div>
        <div class="metric-item fire">
          <span>FIRE</span>
          <span class="val" id="hudCountFire">0</span>
        </div>
      </div>
    </div>
    <div class="hud-feeds" id="hudFeeds">
      <div class="feed-badge off" id="badgeCelestrak">
        <span class="badge-dot"></span>
        <span>CELESTRAK</span>
      </div>
      <div class="feed-badge off" id="badgeAdsb">
        <span class="badge-dot"></span>
        <span>ADSB</span>
      </div>
      <div class="feed-badge off" id="badgeUsgs">
        <span class="badge-dot"></span>
        <span>USGS</span>
      </div>
      <div class="feed-badge off" id="badgeFirms">
        <span class="badge-dot"></span>
        <span>FIRMS</span>
      </div>
    </div>
    <div class="hud-controls">
      <button class="hud-ctrl-btn" id="btnSurveillanceCam" title="Live Surveillance Feeds & Recon Optics (K)">
        <span>📹</span> CAMS [K]
      </button>
      <button class="hud-ctrl-btn" id="btnQuickSearch" title="Quick Search City or Coordinates (/)">
        <span>🔍</span> SEARCH [/]
      </button>
      <button class="hud-ctrl-btn" id="btnHorizonTilt" title="Toggle 35° Oblique Horizon Tilt (T)">
        <span>🌐</span> TILT [T]
      </button>
      <button class="hud-ctrl-btn" id="btnAboutModal" title="System Architecture & Credits">
        <span>ℹ</span> ABOUT
      </button>
    </div>
  `;
  root.appendChild(topbar);

  // Floating Altitude & Classification Legend Pill
  const legendPill = document.createElement('div');
  legendPill.className = 'hud-legend-pill';
  legendPill.id = 'hudLegendPill';
  legendPill.innerHTML = `
    <span class="legend-item"><span class="legend-dot white"></span> >30k ft</span>
    <span class="legend-item"><span class="legend-dot cyan"></span> 10-30k ft</span>
    <span class="legend-item"><span class="legend-dot teal"></span> &lt;10k ft</span>
    <span class="legend-item"><span class="legend-dot amber"></span> MILITARY</span>
    <span class="legend-item"><span class="legend-dot red"></span> 7700 ALERT</span>
  `;
  root.appendChild(legendPill);

  // Reticle
  const reticle = document.createElement('div');
  reticle.className = 'screen-reticle';
  reticle.innerHTML = `<div class="reticle-cross"></div>`;
  root.appendChild(reticle);

  // Bottom coordinates and altitude status
  const bottomStatus = document.createElement('div');
  bottomStatus.className = 'bottom-status';
  bottomStatus.id = 'bottomStatus';
  bottomStatus.textContent = `LAT: 0.00°  LON: 0.00°  ALT: 20000 km`;
  root.appendChild(bottomStatus);

  // Replay banner (hidden by default)
  const replayBanner = document.createElement('div');
  replayBanner.className = 'replay-banner';
  replayBanner.id = 'replayBanner';
  replayBanner.style.display = 'none';
  replayBanner.textContent = '● REPLAY MODE — RECORDED DATA';
  root.appendChild(replayBanner);

  // Elements
  const elClock = document.getElementById('hudClock');
  const elSat = document.getElementById('hudCountSat');
  const elAir = document.getElementById('hudCountAir');
  const elQuake = document.getElementById('hudCountQuake');
  const elFire = document.getElementById('hudCountFire');
  const badgeCelestrak = document.getElementById('badgeCelestrak');
  const badgeAdsb = document.getElementById('badgeAdsb');
  const badgeUsgs = document.getElementById('badgeUsgs');
  const badgeFirms = document.getElementById('badgeFirms');
  const btnCam = document.getElementById('btnSurveillanceCam');
  const btnSearch = document.getElementById('btnQuickSearch');
  const btnTilt = document.getElementById('btnHorizonTilt');
  const btnAbout = document.getElementById('btnAboutModal');

  if (btnCam) {
    btnCam.addEventListener('click', () => events.emit('surveillance:toggle', null));
  }
  if (btnSearch) {
    btnSearch.addEventListener('click', () => events.emit('quicksearch:open', null));
  }
  if (btnTilt) {
    btnTilt.addEventListener('click', () => events.emit('camera:toggleTilt', null));
  }
  if (btnAbout) {
    btnAbout.addEventListener('click', () => events.emit('about:open', null));
  }

  // Layer visibility updates legend
  events.subscribe('state:layers', (layers) => {
    if (legendPill) {
      legendPill.style.display = layers.aircraft ? 'flex' : 'none';
    }
  });

  // Event subscriptions
  events.subscribe('clock:tick', ({ utcString }) => {
    if (elClock) elClock.textContent = `UTC ${utcString}`;
  });

  events.subscribe('counts:updated', (counts) => {
    if (elSat) elSat.textContent = counts.sat.toLocaleString();
    if (elAir) elAir.textContent = counts.air.toLocaleString();
    if (elQuake) elQuake.textContent = counts.quake.toLocaleString();
    if (elFire) elFire.textContent = counts.fire.toLocaleString();
  });

  events.subscribe('feeds:updated', (feeds) => {
    if (badgeCelestrak && feeds.celestrak) {
      badgeCelestrak.className = `feed-badge ${feeds.celestrak.state || 'off'}`;
    }
    if (badgeAdsb && feeds.adsb) {
      badgeAdsb.className = `feed-badge ${feeds.adsb.state || 'off'}`;
    }
    if (badgeUsgs && feeds.usgs) {
      badgeUsgs.className = `feed-badge ${feeds.usgs.state || 'off'}`;
    }
    if (badgeFirms && feeds.firms) {
      badgeFirms.className = `feed-badge ${feeds.firms.state || 'off'}`;
    }
  });

  events.subscribe('camera:updated', (cam) => {
    if (bottomStatus) {
      const latStr = `${Math.abs(cam.lat).toFixed(2)}°${cam.lat >= 0 ? 'N' : 'S'}`;
      const lonStr = `${Math.abs(cam.lon).toFixed(2)}°${cam.lon >= 0 ? 'E' : 'W'}`;
      bottomStatus.textContent = `POS: ${latStr} ${lonStr} | ALT: ${cam.altKm.toLocaleString()} km`;
    }
  });

  events.subscribe('state:replay', (isReplay) => {
    if (replayBanner) {
      replayBanner.style.display = isReplay ? 'block' : 'none';
    }
  });
}
