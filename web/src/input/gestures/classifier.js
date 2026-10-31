// @ts-check
import { extractFeatures } from './features.js';

export const GESTURE_TYPES = {
  NONE: 'NONE',
  OPEN_PALM: 'OPEN_PALM',
  PINCH: 'PINCH',
  FIST: 'FIST',
  THUMBS_UP: 'THUMBS_UP',
};

/**
 * Gesture Classifier with hysteresis and debounce filter.
 * Per trd.md section 10.4 and testing.md T-GES-01..T-GES-05.
 */
export class GestureClassifier {
  constructor() {
    this.isPinching = false;
    this.activeGesture = GESTURE_TYPES.NONE;
    this.candidateGesture = GESTURE_TYPES.NONE;
    this.candidateCount = 0;
    this.disagreeCount = 0;
    this.debounceFrames = 3;
  }

  /**
   * Reset internal filter state
   */
  reset() {
    this.isPinching = false;
    this.activeGesture = GESTURE_TYPES.NONE;
    this.candidateGesture = GESTURE_TYPES.NONE;
    this.candidateCount = 0;
    this.disagreeCount = 0;
  }

  /**
   * Raw single-frame classification with pinch hysteresis.
   * @param {ReturnType<typeof extractFeatures>} features
   * @returns {string}
   */
  classifyRaw(features) {
    if (features.palmSize === 0) {
      return GESTURE_TYPES.NONE;
    }

    // 1. Thumbs Up: thumb points UP, thumb is extended, and all 4 other fingers are curled (checked before fist)
    if (
      features.thumbUp &&
      features.thumbExtended > 0.65 &&
      features.fistScore < 1.25 &&
      features.extensions.every((ext) => ext < 1.35)
    ) {
      this.isPinching = false;
      return GESTURE_TYPES.THUMBS_UP;
    }

    // 2. Fist: all fingers curled tightly
    if (features.fistScore < 1.1) {
      this.isPinching = false;
      return GESTURE_TYPES.FIST;
    }

    // 3. Pinch hysteresis: enter at < 0.25, exit at > 0.35 (T-GES-04)
    if (!this.isPinching && features.pinchRatio < 0.25) {
      this.isPinching = true;
    } else if (this.isPinching && features.pinchRatio > 0.35) {
      this.isPinching = false;
    }

    if (this.isPinching) {
      return GESTURE_TYPES.PINCH;
    }

    // 4. Open Palm: all four fingers extended away from wrist
    if (
      features.fistScore > 1.55 &&
      features.extensions.every((ext) => ext > 1.25)
    ) {
      return GESTURE_TYPES.OPEN_PALM;
    }

    return GESTURE_TYPES.NONE;
  }

  /**
   * Classifies landmarks with 3-frame debounce filtering.
   * @param {Array<{x: number, y: number, z?: number}>} landmarks
   * @returns {{
   *   gesture: string,
   *   rawGesture: string,
   *   features: ReturnType<typeof extractFeatures>
   * }}
   */
  classify(landmarks) {
    const features = extractFeatures(landmarks);
    const rawGesture = this.classifyRaw(features);

    // Debounce state machine (T-GES-05: 1-frame blip does not change active state)
    if (rawGesture === this.activeGesture) {
      this.disagreeCount = 0;
      this.candidateCount = 0;
      this.candidateGesture = rawGesture;
    } else {
      if (rawGesture === this.candidateGesture) {
        this.candidateCount++;
      } else {
        this.candidateGesture = rawGesture;
        this.candidateCount = 1;
      }

      this.disagreeCount++;

      // Require 3 consecutive matching frames to accept transition
      if (this.candidateCount >= this.debounceFrames) {
        this.activeGesture = this.candidateGesture;
        this.candidateCount = 0;
        this.disagreeCount = 0;
      }
    }

    return {
      gesture: this.activeGesture,
      rawGesture,
      features,
    };
  }
}
