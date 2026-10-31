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
    </div>
  `;
  root.appendChild(topbar);

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
