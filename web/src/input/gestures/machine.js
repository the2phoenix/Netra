// @ts-check
import { GESTURE_TYPES } from './classifier.js';
import { emitIntent, INTENT_TYPES } from '../intents.js';
import { events } from '../../core/events.js';

export const MACHINE_STATES = {
  IDLE: 'IDLE',
  PAN: 'PAN',
  ZOOM: 'ZOOM',
  FLY_ARMED: 'FLY_ARMED',
};

const GAIN_PAN = 800.0;
const GAIN_ZOOM = 5.0;
const DEAD_ZONE = 0.004; // Minimum movement to ignore resting hand jitter (T-GES-09)
const EMA_ALPHA = 0.35;  // Smoothing factor per trd.md section 10.5

/**
 * Gesture State Machine driving camera intents from classified gestures.
 * Per trd.md sections 10.5, 10.7 and testing.md T-GES-06..T-GES-11.
 */
export class GestureStateMachine {
  /**
   * @param {Object} [options]
   * @param {Function} [options.nowFn] - Injected time function for deterministic testing
   * @param {Function} [options.emitFn] - Custom intent emitter for testing
   * @param {Function} [options.cameraHeightFn] - Injected camera height supplier
   */
  constructor(options = {}) {
    this.nowFn = options.nowFn || (() => Date.now());
    this.emitFn = options.emitFn || emitIntent;
    this.cameraHeightFn = options.cameraHeightFn || (() => 20000000); // Default 20,000 km

    this.state = MACHINE_STATES.IDLE;
    this.prevPalmCenter = null;
    this.smoothedDelta = { dx: 0, dy: 0 };
    this.lastTrackingTime = 0;
    this.fistStartTime = 0;
    this.lastFlyTime = 0;
    this.thumbsStartTime = 0;
    this.lastModeTime = 0;
  }

  reset() {
    this.state = MACHINE_STATES.IDLE;
    this.prevPalmCenter = null;
    this.smoothedDelta = { dx: 0, dy: 0 };
    this.fistStartTime = 0;
    this.thumbsStartTime = 0;
  }

  /**
   * Process a classified gesture frame.
   *
   * @param {string} gesture - One of GESTURE_TYPES
   * @param {{x: number, y: number}|null} palmCenter - Normalized coordinates [0, 1]
   * @param {number} [targetClientX] - Center reticle X
   * @param {number} [targetClientY] - Center reticle Y
   * @returns {{
   *   state: string,
   *   flyProgress: number
   * }}
   */
  process(gesture, palmCenter, targetClientX = 0, targetClientY = 0) {
    const now = this.nowFn();
    let flyProgress = 0;

    // 1. Handle tracking loss with 300 ms tolerance window (T-GES-08)
    if (!palmCenter || gesture === GESTURE_TYPES.NONE) {
      if (this.lastTrackingTime > 0 && now - this.lastTrackingTime > 300) {
        this.reset();
      }
      return { state: this.state, flyProgress: 0 };
    }

    this.lastTrackingTime = now;

    // 2. Thumbs Up visual mode cycling (GES-04: held 500 ms with 1 s debounce)
    if (gesture === GESTURE_TYPES.THUMBS_UP) {
      if (this.thumbsStartTime === 0) {
        this.thumbsStartTime = now;
      } else if (now - this.thumbsStartTime >= 500 && now - this.lastModeTime > 1000) {
        this.emitFn(INTENT_TYPES.NEXT_MODE);
        this.lastModeTime = now;
        this.thumbsStartTime = 0;
      }
    } else {
      this.thumbsStartTime = 0;
    }

    // 3. Finite State Machine Transitions (T-GES-06)
    switch (this.state) {
      case MACHINE_STATES.IDLE:
        if (gesture === GESTURE_TYPES.OPEN_PALM) {
          this.state = MACHINE_STATES.PAN;
          this.prevPalmCenter = { ...palmCenter };
          this.smoothedDelta = { dx: 0, dy: 0 };
        } else if (gesture === GESTURE_TYPES.PINCH) {
          this.state = MACHINE_STATES.ZOOM;
          this.prevPalmCenter = { ...palmCenter };
          this.smoothedDelta = { dx: 0, dy: 0 };
        } else if (gesture === GESTURE_TYPES.FIST) {
          this.state = MACHINE_STATES.FLY_ARMED;
          this.fistStartTime = now;
        }
        break;

      case MACHINE_STATES.PAN:
        if (gesture === GESTURE_TYPES.PINCH) {
          this.state = MACHINE_STATES.ZOOM;
          this.prevPalmCenter = { ...palmCenter };
          this.smoothedDelta = { dx: 0, dy: 0 };
        } else if (gesture === GESTURE_TYPES.FIST) {
          this.state = MACHINE_STATES.FLY_ARMED;
          this.fistStartTime = now;
        } else if (gesture === GESTURE_TYPES.OPEN_PALM) {
          this.handlePanMovement(palmCenter);
        } else {
          this.state = MACHINE_STATES.IDLE;
        }
        break;

      case MACHINE_STATES.ZOOM:
        if (gesture === GESTURE_TYPES.OPEN_PALM) {
          this.state = MACHINE_STATES.PAN;
          this.prevPalmCenter = { ...palmCenter };
          this.smoothedDelta = { dx: 0, dy: 0 };
        } else if (gesture === GESTURE_TYPES.PINCH) {
          this.handleZoomMovement(palmCenter);
        } else {
          this.state = MACHINE_STATES.IDLE;
        }
        break;

      case MACHINE_STATES.FLY_ARMED:
        if (gesture === GESTURE_TYPES.FIST) {
          const elapsed = now - this.fistStartTime;
          flyProgress = Math.min(1.0, elapsed / 800);
          events.emit('gesture:flyProgress', flyProgress);

          // Held 800 ms with 1 s lockout (T-GES-07)
          if (elapsed >= 800) {
            if (now - this.lastFlyTime > 1000) {
              const cx = targetClientX || (typeof window !== 'undefined' ? window.innerWidth / 2 : 500);
              const cy = targetClientY || (typeof window !== 'undefined' ? window.innerHeight / 2 : 500);
              this.emitFn(INTENT_TYPES.FLY_TO, { clientX: cx, clientY: cy });
              this.lastFlyTime = now;
            }
            this.state = MACHINE_STATES.IDLE;
            this.fistStartTime = 0;
            flyProgress = 0;
            events.emit('gesture:flyProgress', 0);
          }
        } else {
          this.state = MACHINE_STATES.IDLE;
          this.fistStartTime = 0;
          events.emit('gesture:flyProgress', 0);
        }
        break;
    }

    return { state: this.state, flyProgress };
  }

  /**
   * Handle PAN rotation calculation with mirrored X-axis and dead zone
   * @param {{x: number, y: number}} palmCenter
   */
  handlePanMovement(palmCenter) {
    if (!this.prevPalmCenter) {
      this.prevPalmCenter = { ...palmCenter };
      return;
    }

    const rawDx = palmCenter.x - this.prevPalmCenter.x;
    const rawDy = palmCenter.y - this.prevPalmCenter.y;
    this.prevPalmCenter = { ...palmCenter };

    // Dead zone check: ignore resting hand jitter (T-GES-09)
    const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
    if (dist < DEAD_ZONE) {
      return;
    }

    // Exponential moving average smoothing
    this.smoothedDelta.dx = EMA_ALPHA * rawDx + (1 - EMA_ALPHA) * this.smoothedDelta.dx;
    this.smoothedDelta.dy = EMA_ALPHA * rawDy + (1 - EMA_ALPHA) * this.smoothedDelta.dy;

    // Mirrored X-axis: in a mirrored camera feed, moving hand physically RIGHT
    // moves raw X in negative direction. Inverting it makes dx positive, rotating globe RIGHT (T-GES-10).
    const dx = -this.smoothedDelta.dx * GAIN_PAN;
    const dy = this.smoothedDelta.dy * GAIN_PAN;

    this.emitFn(INTENT_TYPES.ROTATE, { dx, dy });
  }

  /**
   * Handle ZOOM calculation scaled by camera altitude (T-GES-11)
   * @param {{x: number, y: number}} palmCenter
   */
  handleZoomMovement(palmCenter) {
    if (!this.prevPalmCenter) {
      this.prevPalmCenter = { ...palmCenter };
      return;
    }

    const rawDy = palmCenter.y - this.prevPalmCenter.y;
    this.prevPalmCenter = { ...palmCenter };

    if (Math.abs(rawDy) < DEAD_ZONE) {
      return;
    }

    this.smoothedDelta.dy = EMA_ALPHA * rawDy + (1 - EMA_ALPHA) * this.smoothedDelta.dy;

    // Hand moving UP (decreasing y in video coords) zooms in (dz < 0)
    // Scale by camera altitude: dz at 10,000 km is ~1,000x dz at 10 km (T-GES-11)
    const cameraHeight = this.cameraHeightFn();
    const dz = this.smoothedDelta.dy * GAIN_ZOOM * (cameraHeight / 1000);

    this.emitFn(INTENT_TYPES.ZOOM, { dz });
  }
}
