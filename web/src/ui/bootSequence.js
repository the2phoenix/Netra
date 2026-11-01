// @ts-check
import { events } from '../core/events.js';

/**
 * Cinematic Tactical Military Boot Sequence (Phase 7 Polish)
 * Displays hardware diagnostic checks and tactical loading before revealing the command center.
 * Spacebar or Click skips immediately.
 *
 * @param {HTMLElement} root
 * @returns {Promise<void>} Resolves when boot sequence is complete or skipped
 */
export function runBootSequence(root) {
  return new Promise((resolve) => {
    // If user already visited in this session, skip boot
    if (sessionStorage.getItem('netra_booted') === 'true') {
      resolve();
      return;
    }

    const bootOverlay = document.createElement('div');
    bootOverlay.className = 'boot-sequence-overlay';
    bootOverlay.id = 'bootSequence';

    bootOverlay.innerHTML = `
      <div class="boot-container">
        <div class="boot-header">
          <span class="boot-sanskrit">नेत्र</span>
          <span class="boot-title">NETRA // REAL-TIME SPATIAL INTELLIGENCE CORE</span>
        </div>

        <div class="boot-terminal" id="bootTerminal">
          <div class="boot-line">> INITIALIZING SYSTEM HARDWARE ABSTRACTION... <span class="ok">[OK]</span></div>
        </div>

        <div class="boot-progress-wrap">
          <div class="boot-progress-bar" id="bootProgressBar"></div>
        </div>

        <div class="boot-footer">
          <span class="boot-status" id="bootStatus">MOUNTING ORBITAL TELEMETRY...</span>
          <span class="boot-skip-hint">PRESS [SPACE] OR CLICK TO ENGAGE</span>
        </div>
      </div>
    `;

    root.appendChild(bootOverlay);

    const terminal = bootOverlay.querySelector('#bootTerminal');
    const progressBar = /** @type {HTMLElement|null} */ (bootOverlay.querySelector('#bootProgressBar'));
    const statusText = bootOverlay.querySelector('#bootStatus');

    const steps = [
      { text: '> CONNECTING CELESTRAK GP SATELLITE FEED...', status: 'CALIBRATING SGP4 PROPAGATOR', pct: 20 },
      { text: '> SYNCING ADS-B COMMERCIAL & MILITARY CORRIDORS...', status: 'POLLING GLOBAL TRANSPONDERS', pct: 45 },
      { text: '> CONNECTING USGS SEISMIC MONITORING NETWORK...', status: 'STREAMING TECTONIC FAULT ZONES', pct: 65 },
      { text: '> LOADING MEDIAPIPE NEURAL TENSORS (OFFLINE WASM)...', status: 'COMPILING SKELETON GRAPH', pct: 85 },
      { text: '> INITIALIZING CESIUM WEBGL 2.0 3D PLANETARY ENGINE...', status: 'ONLINE // READY', pct: 100 },
    ];

    let stepIndex = 0;
    let completed = false;

    function finish() {
      if (completed) return;
      completed = true;
      sessionStorage.setItem('netra_booted', 'true');
      bootOverlay.classList.add('fade-out');
      setTimeout(() => {
        bootOverlay.remove();
        events.emit('boot:complete', null);
        resolve();
      }, 400);
    }

    // Spacebar or Click skips
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.code === 'Space') {
          e.preventDefault();
          finish();
        }
      },
      { once: true }
    );
    bootOverlay.addEventListener('click', finish, { once: true });

    const interval = setInterval(() => {
      if (stepIndex >= steps.length) {
        clearInterval(interval);
        setTimeout(finish, 350);
        return;
      }

      const s = steps[stepIndex];
      if (terminal) {
        const line = document.createElement('div');
        line.className = 'boot-line';
        line.innerHTML = `${s.text} <span class="ok">[OK]</span>`;
        terminal.appendChild(line);
      }
      if (progressBar) progressBar.style.width = `${s.pct}%`;
      if (statusText) statusText.textContent = s.status;

      stepIndex++;
    }, 280);
  });
}

