// @ts-check
import { events } from '../core/events.js';

const CHANNELS = [
  {
    id: 'ch-recon',
    name: 'CH 01 // OVERHEAD RECON SATELLITE (EO/IR)',
    location: 'GEO-ORBITAL // ACTIVE OVERHEAD INTERCEPT',
    feedType: 'recon',
    target: 'GROUND SURVEILLANCE SWATH',
  },
  {
    id: 'ch-shibuya',
    name: 'CH 02 // TOKYO // SHIBUYA METROPOLITAN',
    location: 'TOKYO, JAPAN [35.6595° N, 139.7005° E]',
    feedType: 'traffic',
    target: 'PEDESTRIAN CORRIDOR 04',
  },
  {
    id: 'ch-times-sq',
    name: 'CH 03 // NEW YORK // TIMES SQUARE HUB',
    location: 'NEW YORK, USA [40.7580° N, 73.9855° W]',
    feedType: 'traffic',
    target: 'MIDTOWN VEHICULAR SECTOR',
  },
  {
    id: 'ch-london',
    name: 'CH 04 // LONDON // WESTMINSTER TACTICAL',
    location: 'LONDON, UK [51.5014° N, 0.1419° W]',
    feedType: 'traffic',
    target: 'THAMES AIRWAY PASS',
  },
  {
    id: 'ch-mumbai',
    name: 'CH 05 // MUMBAI // COASTAL HARBOR RADAR',
    location: 'MUMBAI, INDIA [18.9220° N, 72.8347° E]',
    feedType: 'traffic',
    target: 'ARABIAN SEA CORRIDOR',
  },
];

/**
 * Tactical Surveillance Camera Feed PIP (Bottom-Left)
 * Provides classified overhead satellite optical feeds and city surveillance nodes.
 *
 * @param {HTMLElement} root
 */
export function initSurveillanceCamera(root) {
  const container = document.createElement('div');
  container.className = 'surveillance-cam-panel';
  container.id = 'surveillanceCamPanel';
  container.style.display = 'none';

  container.innerHTML = `
    <div class="cam-header">
      <div class="cam-title">
        <span class="cam-rec-dot"></span>
        <span id="camChannelTitle">CH 01 // OVERHEAD RECON (EO/IR)</span>
      </div>
      <div class="cam-actions">
        <button class="cam-btn-icon" id="camPrevBtn" title="Previous Channel">◀</button>
        <button class="cam-btn-icon" id="camNextBtn" title="Next Channel">▶</button>
        <button class="cam-btn-icon" id="camCloseBtn" title="Close Camera Feed">✕</button>
      </div>
    </div>

    <div class="cam-viewport" id="camViewport">
      <div class="cam-scanlines"></div>
      <div class="cam-crosshair"></div>
      <div class="cam-osd-top">
        <span id="camLocation">GEO-ORBITAL RECON SWATH</span>
        <span id="camTimecode">UTC 00:00:00.000</span>
      </div>
      <div class="cam-osd-bottom">
        <span class="cam-status-pill">SIGINT: ENCRYPTED // REC</span>
        <span id="camZoomIndicator">OPTICAL 4X</span>
      </div>
      <canvas class="cam-optical-canvas" id="camCanvas" width="340" height="200"></canvas>
    </div>

    <div class="cam-controls">
      <div class="cam-zoom-btns">
        <button class="cam-zoom-btn active" data-zoom="2">2X</button>
        <button class="cam-zoom-btn" data-zoom="4">4X</button>
        <button class="cam-zoom-btn" data-zoom="8">8X</button>
        <button class="cam-zoom-btn" data-zoom="16">16X</button>
      </div>
      <button class="cam-filter-btn" id="camFilterToggle">FILTER: EO</button>
    </div>
  `;
  root.appendChild(container);

  let currentChannelIndex = 0;
  let zoomLevel = 2;
  let currentFilter = 'EO'; // EO, IR, NVG
  let isPanelOpen = false;

  const titleEl = container.querySelector('#camChannelTitle');
  const locEl = container.querySelector('#camLocation');
  const timecodeEl = container.querySelector('#camTimecode');
  const zoomIndEl = container.querySelector('#camZoomIndicator');
  const filterBtn = container.querySelector('#camFilterToggle');
  const canvas = /** @type {HTMLCanvasElement} */ (container.querySelector('#camCanvas'));
  const ctx = canvas.getContext('2d');

  function openCam() {
    container.style.display = 'flex';
    isPanelOpen = true;
    updateChannel();
  }

  function closeCam() {
    container.style.display = 'none';
    isPanelOpen = false;
  }

  function toggleCam() {
    if (isPanelOpen) closeCam();
    else openCam();
  }

  function updateChannel() {
    const ch = CHANNELS[currentChannelIndex];
    if (titleEl) titleEl.textContent = ch.name;
    if (locEl) locEl.textContent = ch.location;
    if (zoomIndEl) zoomIndEl.textContent = `OPTICAL ${zoomLevel}X`;
  }

  container.querySelector('#camCloseBtn')?.addEventListener('click', closeCam);
  container.querySelector('#camPrevBtn')?.addEventListener('click', () => {
    currentChannelIndex = (currentChannelIndex - 1 + CHANNELS.length) % CHANNELS.length;
    updateChannel();
  });
  container.querySelector('#camNextBtn')?.addEventListener('click', () => {
    currentChannelIndex = (currentChannelIndex + 1) % CHANNELS.length;
    updateChannel();
  });

  // Zoom buttons
  container.querySelectorAll('.cam-zoom-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      container.querySelectorAll('.cam-zoom-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      zoomLevel = parseInt(btn.getAttribute('data-zoom') || '2', 10);
      if (zoomIndEl) zoomIndEl.textContent = `OPTICAL ${zoomLevel}X`;
    });
  });

  // Filter toggle (EO / IR / NVG)
  if (filterBtn) {
    filterBtn.addEventListener('click', () => {
      if (currentFilter === 'EO') currentFilter = 'IR';
      else if (currentFilter === 'IR') currentFilter = 'NVG';
      else currentFilter = 'EO';
      filterBtn.textContent = `FILTER: ${currentFilter}`;
    });
  }

  // Real-time canvas optical simulation loop (~20 FPS)
  let frame = 0;
  setInterval(() => {
    if (!isPanelOpen || !ctx) return;
    frame++;

    // Update timecode millisecond watermark
    const now = new Date();
    if (timecodeEl) {
      timecodeEl.textContent = `UTC ${now.toISOString().substring(11, 23)}`;
    }

    const w = canvas.width;
    const h = canvas.height;

    // Filter color schemes
    if (currentFilter === 'IR') {
      ctx.fillStyle = '#060B18'; // Deep IR base
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255, 90, 30, 0.25)';
      ctx.fillRect(20 + Math.sin(frame * 0.05) * 40, 40 + Math.cos(frame * 0.03) * 20, 60, 40);
      ctx.fillStyle = 'rgba(255, 230, 80, 0.45)';
      ctx.beginPath();
      ctx.arc(w / 2 + Math.sin(frame * 0.08) * 30, h / 2 + Math.cos(frame * 0.06) * 15, 18, 0, Math.PI * 2);
      ctx.fill();
    } else if (currentFilter === 'NVG') {
      ctx.fillStyle = '#021808'; // Phosphor green base
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(40, 240, 70, 0.35)';
      ctx.fillRect(15, 30, w - 30, h - 60);
      ctx.fillStyle = 'rgba(160, 255, 180, 0.6)';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 24, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // EO Natural Optics
      ctx.fillStyle = '#0B1528';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.fillRect(10, 20, w - 20, h - 40);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 20, 0, Math.PI * 2);
      ctx.fill();
    }

    // Grid coordinates lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2, 10);
    ctx.lineTo(w / 2, h - 10);
    ctx.moveTo(10, h / 2);
    ctx.lineTo(w - 10, h / 2);
    ctx.stroke();

    // Subtle sensor noise
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let i = 0; i < 40; i++) {
      const rx = Math.random() * w;
      const ry = Math.random() * h;
      ctx.fillRect(rx, ry, 2, 2);
    }
  }, 50);

  // Keyboard shortcut: K toggles surveillance cam
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;
    if (e.key === 'k' || e.key === 'K') {
      toggleCam();
    }
  });

  events.subscribe('surveillance:toggle', toggleCam);
}
