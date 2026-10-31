// @ts-check
import * as Cesium from 'cesium';
import { events } from '../core/events.js';
import { state } from '../core/state.js';

const NIGHT_VISION_SHADER = `
  uniform sampler2D colorTexture;
  varying vec2 v_textureCoordinates;

  void main() {
    vec4 color = texture2D(colorTexture, v_textureCoordinates);
    // Perceived luminance
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    
    // Green phosphor glow
    vec3 greenTint = vec3(0.15, 1.25, 0.35) * lum;
    
    // Subtle horizontal scanline effect
    float scanline = sin(v_textureCoordinates.y * 800.0) * 0.08;
    greenTint -= scanline;
    
    // Edge vignette
    vec2 uv = (v_textureCoordinates - 0.5) * 2.0;
    float vignette = 1.0 - dot(uv, uv) * 0.25;
    
    gl_FragColor = vec4(greenTint * vignette, color.a);
  }
`;

const THERMAL_SHADER = `
  uniform sampler2D colorTexture;
  varying vec2 v_textureCoordinates;

  // Ironbow FLIR false-color gradient mapping
  vec3 ironbow(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c0 = vec3(0.0, 0.0, 0.0);      // Black (coldest)
    vec3 c1 = vec3(0.1, 0.0, 0.6);      // Dark blue/purple
    vec3 c2 = vec3(0.8, 0.1, 0.4);      // Magenta
    vec3 c3 = vec3(1.0, 0.5, 0.0);      // Orange
    vec3 c4 = vec3(1.0, 1.0, 0.4);      // Yellow
    vec3 c5 = vec3(1.0, 1.0, 1.0);      // White (hottest)

    if (t < 0.2) return mix(c0, c1, t / 0.2);
    if (t < 0.4) return mix(c1, c2, (t - 0.2) / 0.2);
    if (t < 0.6) return mix(c2, c3, (t - 0.4) / 0.2);
    if (t < 0.8) return mix(c3, c4, (t - 0.6) / 0.2);
    return mix(c4, c5, (t - 0.8) / 0.2);
  }

  void main() {
    vec4 color = texture2D(colorTexture, v_textureCoordinates);
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    gl_FragColor = vec4(ironbow(lum), color.a);
  }
`;

/**
 * Visual Modes Manager (REQ VIS-01, GES-04)
 * Supports Normal, Night-Vision, and Thermal false-color modes.
 */
export class VisualModesManager {
  /**
   * @param {Cesium.Viewer} viewer
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.modes = ['normal', 'night-vision', 'thermal'];
    this.currentIndex = 0;

    // Check if postProcessStages are supported
    this.hasPostProcess = Boolean(viewer.scene.postProcessStages);

    if (this.hasPostProcess) {
      try {
        this.nightVisionStage = new Cesium.PostProcessStage({
          fragmentShader: NIGHT_VISION_SHADER,
        });
        this.thermalStage = new Cesium.PostProcessStage({
          fragmentShader: THERMAL_SHADER,
        });

        viewer.scene.postProcessStages.add(this.nightVisionStage);
        viewer.scene.postProcessStages.add(this.thermalStage);

        this.nightVisionStage.enabled = false;
        this.thermalStage.enabled = false;
      } catch (err) {
        console.warn('PostProcessStages not supported on this device/WebGL context:', err);
        this.hasPostProcess = false;
      }
    }

    // Subscribe to NEXT_MODE intent from gesture engine or keyboard
    events.subscribe('intent:NEXT_MODE', () => {
      this.cycleMode();
    });

    // Keyboard shortcut 'V' to cycle visual mode
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'v' || e.key === 'V') && !e.ctrlKey && !e.metaKey) {
        this.cycleMode();
      }
    });
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

    if (this.hasPostProcess) {
      if (this.nightVisionStage) this.nightVisionStage.enabled = (mode === 'night-vision');
      if (this.thermalStage) this.thermalStage.enabled = (mode === 'thermal');
    }

    state.set('mode', mode);
    events.emit('visualMode:changed', mode);
    console.log(`Visual mode set to: ${mode.toUpperCase()}`);
  }
}
