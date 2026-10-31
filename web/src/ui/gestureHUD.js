// @ts-check
import { events } from '../core/events.js';

/**
 * 21 Landmark connection pairs for hand skeleton rendering
 */
const HAND_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm base knuckles
  [5, 9], [9, 13], [13, 17],
];

/**
 * HUD Overlay for Gesture Tracking and Video PIP.
 * Shows mirrored hand skeleton, active gesture badge, and camera toggle.
 */
export class GestureHUD {
  /**
   * @param {HTMLElement} root
   * @param {import('../input/gestures/tracker.js').GestureTracker} tracker
   */
  constructor(root, tracker) {
    this.root = root;
    this.tracker = tracker;
    this.isMinimized = false;

    this.container = document.createElement('div');
    this.container.className = 'gesture-hud-container';
    this.container.id = 'gestureHud';

    this.render();
    this.root.appendChild(this.container);

    this.canvas = this.container.querySelector('#gestureCanvas');
    // @ts-ignore
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.badgeEl = this.container.querySelector('#gestureBadge');
    this.statusEl = this.container.querySelector('#gestureStatus');
    this.videoWrapper = this.container.querySelector('#gestureVideoWrapper');
    this.reticleRing = document.createElement('div');
    this.reticleRing.className = 'fly-progress-ring';
    this.root.appendChild(this.reticleRing);

    this.setupEvents();
  }

  render() {
    this.container.innerHTML = `
      <div class="gesture-hud-header">
        <div class="gesture-hud-title">
          <span class="hud-dot" id="gestureStatusDot"></span>
          <span id="gestureStatus">GESTURE: OFF (PRESS M)</span>
        </div>
        <div class="gesture-hud-actions">
          <button class="hud-mini-btn" id="btnToggleCam" title="Toggle Camera (M)">CAM</button>
          <button class="hud-mini-btn" id="btnMinimizeHud" title="Minimize/Expand">_</button>
        </div>
      </div>
      <div class="gesture-video-wrapper" id="gestureVideoWrapper">
        <div class="gesture-placeholder" id="gesturePlaceholder">
          <span>MOUSE PARITY MODE ACTIVE</span>
          <small>Click "CAM" or press "M" to enable hand tracking</small>
        </div>
        <canvas class="gesture-canvas" id="gestureCanvas" width="160" height="120"></canvas>
        <div class="gesture-active-badge" id="gestureBadge">IDLE</div>
      </div>
    `;
  }

  setupEvents() {
    const btnCam = this.container.querySelector('#btnToggleCam');
    const btnMin = this.container.querySelector('#btnMinimizeHud');

    if (btnCam) {
      btnCam.addEventListener('click', () => {
        this.tracker.toggle();
      });
    }

    if (btnMin) {
      btnMin.addEventListener('click', () => {
        this.isMinimized = !this.isMinimized;
        if (this.videoWrapper) {
          // @ts-ignore
          this.videoWrapper.style.display = this.isMinimized ? 'none' : 'block';
        }
      });
    }

    // Tracker status updates
    events.subscribe('gesture:status', ({ status }) => {
      const dot = this.container.querySelector('#gestureStatusDot');
      const placeholder = this.container.querySelector('#gesturePlaceholder');

      if (this.statusEl) {
        if (status === 'TRACKING') {
          this.statusEl.textContent = 'GESTURE ACTIVE';
          if (dot) dot.className = 'hud-dot active';
          if (placeholder) placeholder.style.display = 'none';
        } else if (status === 'INITIALIZING') {
          this.statusEl.textContent = 'STARTING CAMERA...';
          if (dot) dot.className = 'hud-dot pending';
        } else {
          this.statusEl.textContent = 'MOUSE MODE (PRESS M)';
          if (dot) dot.className = 'hud-dot';
          if (placeholder) placeholder.style.display = 'flex';
          this.clearCanvas();
        }
      }
    });

    // Real-time gesture frame updates
    events.subscribe('gesture:frame', ({ landmarks, gesture, machineState, flyProgress }) => {
      this.updateBadge(gesture, machineState, flyProgress);
      this.drawSkeleton(landmarks);
    });

    // Fly-to arming progress ring around center reticle
    events.subscribe('gesture:flyProgress', (progress) => {
      if (progress > 0) {
        this.reticleRing.style.display = 'block';
        this.reticleRing.style.transform = `translate(-50%, -50%) scale(${0.8 + progress * 0.4})`;
        this.reticleRing.style.opacity = `${progress}`;
      } else {
        this.reticleRing.style.display = 'none';
      }
    });
  }

  /**
   * @param {string} gesture
   * @param {string} machineState
   * @param {number} flyProgress
   */
  updateBadge(gesture, machineState, flyProgress) {
    if (!this.badgeEl) return;

    if (machineState === 'PAN') {
      this.badgeEl.textContent = '✋ PAN [OPEN PALM]';
      this.badgeEl.className = 'gesture-active-badge pan';
    } else if (machineState === 'ZOOM') {
      this.badgeEl.textContent = '🤏 ZOOM [PINCH]';
      this.badgeEl.className = 'gesture-active-badge zoom';
    } else if (machineState === 'FLY_ARMED') {
      const pct = Math.round(flyProgress * 100);
      this.badgeEl.textContent = `✊ FLY TO [${pct}%]`;
      this.badgeEl.className = 'gesture-active-badge fly';
    } else if (gesture === 'THUMBS_UP') {
      this.badgeEl.textContent = '👍 MODE [THUMBS]';
      this.badgeEl.className = 'gesture-active-badge mode';
    } else {
      this.badgeEl.textContent = 'IDLE';
      this.badgeEl.className = 'gesture-active-badge';
    }
  }

  /**
   * Draw neon hand skeleton on canvas
   * @param {Array<{x: number, y: number}>|null} landmarks
   */
  drawSkeleton(landmarks) {
    if (!this.ctx || !this.canvas) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!landmarks || landmarks.length < 21) return;

    const w = this.canvas.width;
    const h = this.canvas.height;

    // Mirrored display: x is flipped
    const pts = landmarks.map((p) => ({
      x: (1.0 - p.x) * w,
      y: p.y * h,
    }));

    // Draw connection lines
    this.ctx.strokeStyle = 'rgba(53, 208, 232, 0.75)'; // Cyan
    this.ctx.lineWidth = 1.8;
    this.ctx.beginPath();
    for (let i = 0; i < HAND_CONNECTIONS.length; i++) {
      const [i1, i2] = HAND_CONNECTIONS[i];
      this.ctx.moveTo(pts[i1].x, pts[i1].y);
      this.ctx.lineTo(pts[i2].x, pts[i2].y);
    }
    this.ctx.stroke();

    // Draw landmark joints
    this.ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < pts.length; i++) {
      this.ctx.beginPath();
      this.ctx.arc(pts[i].x, pts[i].y, i === 4 || i === 8 ? 3.0 : 2.0, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  clearCanvas() {
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}
