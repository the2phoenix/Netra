// @ts-check
import { events } from '../core/events.js';
import { state } from '../core/state.js';

/**
 * Visual Modes Manager (REQ VIS-01, GES-04)
 * Supports Normal, Night-Vision (Phosphor Green), and Thermal FLIR (Ironbow false-color) modes.
 * Uses high-performance, crash-free CSS/SVG hardware-accelerated rasterization.
 */
export class VisualModesManager {
  /**
   * @param {import('cesium').Viewer} viewer
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.modes = ['normal', 'night-vision', 'thermal'];
    this.currentIndex = 0;
    this.hasPostProcess = false;

    // Create CRT / Optical scanlines and phosphor vignette overlay
    if (typeof document !== 'undefined') {
      this._overlay = document.createElement('div');
      this._overlay.className = 'visual-mode-overlay';
      this._overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 2;
        display: none;
        transition: opacity 0.3s ease;
      `;
      const container = viewer.container;
      if (container && container.parentNode) {
        container.appendChild(this._overlay);
      }
    }

    // Subscribe to NEXT_MODE intent from gesture engine or keyboard
    events.subscribe('intent:NEXT_MODE', () => {
      this.cycleMode();
    });

    // Keyboard shortcut 'V' to cycle visual mode
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;
        if ((e.key === 'v' || e.key === 'V') && !e.ctrlKey && !e.metaKey) {
          this.cycleMode();
        }
      });
    }
  }

  cycleMode() {
    this.currentIndex = (this.currentIndex + 1) % this.modes.length;
    const mode = this.modes[this.currentIndex];
    this.setMode(mode);
  }

  /**
   * @param {'normal' | 'night-vision' | 'thermal'} mode
   */
  setMode(mode) {
    const idx = this.modes.indexOf(mode);
    if (idx !== -1) {
      this.currentIndex = idx;
    }

    const canvas = this.viewer.canvas;
    if (canvas) {
      if (mode === 'night-vision') {
        canvas.style.filter = 'brightness(1.25) contrast(1.4) hue-rotate(85deg) saturate(3.0)';
        if (this._overlay) {
          this._overlay.style.display = 'block';
          this._overlay.style.background = `
            radial-gradient(ellipse at center, transparent 65%, rgba(0, 30, 0, 0.7) 100%),
            repeating-linear-gradient(0deg, rgba(0, 255, 65, 0.05) 0px, rgba(0, 255, 65, 0.05) 1px, transparent 1px, transparent 2px)
          `;
        }
      } else if (mode === 'thermal') {
        canvas.style.filter = 'invert(1) hue-rotate(185deg) contrast(1.5) saturate(2.8)';
        if (this._overlay) {
          this._overlay.style.display = 'block';
          this._overlay.style.background = `
            radial-gradient(ellipse at center, transparent 70%, rgba(20, 0, 40, 0.6) 100%),
            repeating-linear-gradient(0deg, rgba(255, 100, 0, 0.04) 0px, rgba(255, 100, 0, 0.04) 1px, transparent 1px, transparent 3px)
          `;
        }
      } else {
        canvas.style.filter = 'none';
        if (this._overlay) {
          this._overlay.style.display = 'none';
        }
      }
    }

    state.set('mode', mode);
    events.emit('visualMode:changed', mode);
    console.log(`[NETRA] Visual mode set to: ${mode.toUpperCase()}`);
  }
}
