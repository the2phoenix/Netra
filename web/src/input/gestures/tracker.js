// @ts-check
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { GestureClassifier } from './classifier.js';
import { GestureStateMachine } from './machine.js';
import { events } from '../../core/events.js';
import { state } from '../../core/state.js';

/**
 * Real-time MediaPipe HandLandmarker camera tracker.
 * Per trd.md sections 10.1, 10.6 and testing.md T-E2E-09.
 */
export class GestureTracker {
  /**
   * @param {Object} [options]
   * @param {string} [options.wasmPath]
   * @param {string} [options.modelPath]
   * @param {Function} [options.cameraHeightFn]
   */
  constructor(options = {}) {
    this.wasmPath = options.wasmPath || '/wasm';
    this.modelPath = options.modelPath || '/models/hand_landmarker.task';
    this.cameraHeightFn = options.cameraHeightFn || (() => (state.camera?.altKm ? state.camera.altKm * 1000 : 20000000));

    this.classifier = new GestureClassifier();
    this.machine = new GestureStateMachine({
      cameraHeightFn: this.cameraHeightFn,
    });

    /** @type {HandLandmarker|null} */
    this.landmarker = null;
    /** @type {HTMLVideoElement|null} */
    this.videoElement = null;
    /** @type {MediaStream|null} */
    this.stream = null;

    this.isRunning = false;
    this.isInitializing = false;
    this.lastFrameTime = 0;
    this.lastProcessDuration = 0;

    // Toggle on 'M' key
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey) {
        this.toggle();
      }
    });
  }

  /**
   * Initialize MediaPipe HandLandmarker from local offline assets
   */
  async initModel() {
    if (this.landmarker) return this.landmarker;

    const vision = await FilesetResolver.forVisionTasks(this.wasmPath);
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: this.modelPath,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    return this.landmarker;
  }

  /**
   * Start camera video capture and hand tracking
   */
  async start() {
    if (this.isRunning || this.isInitializing) return;
    this.isInitializing = true;
    events.emit('gesture:status', { status: 'INITIALIZING' });

    try {
      await this.initModel();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam mediaDevices API not supported on this browser.');
      }

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          facingMode: 'user',
        },
        audio: false,
      });

      this.videoElement = document.createElement('video');
      this.videoElement.autoplay = true;
      this.videoElement.playsInline = true;
      this.videoElement.muted = true;
      this.videoElement.srcObject = this.stream;

      await new Promise((resolve) => {
        if (!this.videoElement) return resolve(null);
        this.videoElement.onloadedmetadata = () => {
          this.videoElement?.play();
          resolve(null);
        };
      });

      this.isRunning = true;
      this.isInitializing = false;
      events.emit('gesture:status', { status: 'TRACKING', video: this.videoElement });

      this.scheduleNextFrame();
    } catch (err) {
      console.warn('Gesture tracking start failed, falling back to mouse mode:', err);
      this.isRunning = false;
      this.isInitializing = false;
      events.emit('gesture:status', { status: 'MOUSE_ONLY', error: err.message });
      // Mouse parity (REQ GES-05, T-E2E-09)
      state.set('inputMode', 'mouse');
    }
  }

  scheduleNextFrame() {
    if (!this.isRunning) return;

    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype && this.videoElement) {
      // @ts-ignore
      this.videoElement.requestVideoFrameCallback(this.onFrame.bind(this));
    } else {
      requestAnimationFrame(this.onFrame.bind(this));
    }
  }

  /**
   * Frame processing loop (target ~30 Hz, drops frame if duration > 33 ms per trd.md 9)
   */
  onFrame() {
    if (!this.isRunning || !this.videoElement || !this.landmarker) return;

    const t0 = performance.now();
    const now = performance.now();

    // Check if video has fresh frame
    if (this.videoElement.readyState >= 2 && now - this.lastFrameTime >= 28) {
      this.lastFrameTime = now;

      try {
        const results = this.landmarker.detectForVideo(this.videoElement, now);

        if (results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0];
          const { gesture, rawGesture, features } = this.classifier.classify(landmarks);
          const { state: machineState, flyProgress } = this.machine.process(
            gesture,
            features.palmCenter
          );

          events.emit('gesture:frame', {
            landmarks,
            gesture,
            rawGesture,
            machineState,
            flyProgress,
            features,
          });
        } else {
          const { state: machineState } = this.machine.process('NONE', null);
          events.emit('gesture:frame', {
            landmarks: null,
            gesture: 'NONE',
            rawGesture: 'NONE',
            machineState,
            flyProgress: 0,
            features: null,
          });
        }
      } catch (err) {
        // Skip transient inference frame error
      }
    }

    this.lastProcessDuration = performance.now() - t0;
    this.scheduleNextFrame();
  }

  stop() {
    this.isRunning = false;
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
    this.classifier.reset();
    this.machine.reset();
    events.emit('gesture:status', { status: 'STOPPED' });
  }

  toggle() {
    if (this.isRunning) {
      this.stop();
    } else {
      this.start();
    }
  }
}

