// @ts-check
import { describe, it, expect } from 'vitest';
import { extractFeatures, distance } from '../src/input/gestures/features.js';
import { GestureClassifier, GESTURE_TYPES } from '../src/input/gestures/classifier.js';
import { GestureStateMachine, MACHINE_STATES } from '../src/input/gestures/machine.js';
import { INTENT_TYPES } from '../src/input/intents.js';

/**
 * Helper to generate synthetic 21-point MediaPipe hand landmarks.
 * @param {'OPEN_PALM' | 'FIST' | 'PINCH' | 'THUMBS_UP'} type
 * @param {number} [scale=1.0]
 * @param {number} [jitter=0.0]
 * @returns {Array<{x: number, y: number, z: number}>}
 */
function createSyntheticLandmarks(type, scale = 1.0, jitter = 0.0) {
  const origin = { x: 0.5, y: 0.7, z: 0 };
  const landmarks = [];

  // Default finger layout offsets relative to wrist
  let tipOffsets = {
    thumb: { x: -0.12 * scale, y: -0.15 * scale },
    index: { x: -0.06 * scale, y: -0.35 * scale },
    middle: { x: 0.0 * scale, y: -0.38 * scale },
    ring: { x: 0.06 * scale, y: -0.35 * scale },
    pinky: { x: 0.12 * scale, y: -0.30 * scale },
  };

  if (type === 'FIST') {
    tipOffsets = {
      thumb: { x: -0.05 * scale, y: -0.10 * scale },
      index: { x: -0.03 * scale, y: -0.12 * scale },
      middle: { x: 0.0 * scale, y: -0.12 * scale },
      ring: { x: 0.03 * scale, y: -0.12 * scale },
      pinky: { x: 0.06 * scale, y: -0.10 * scale },
    };
  } else if (type === 'PINCH') {
    // Thumb tip and index tip touch
    const pinchPoint = { x: -0.04 * scale, y: -0.22 * scale };
    tipOffsets.thumb = { ...pinchPoint };
    tipOffsets.index = { ...pinchPoint };
  } else if (type === 'THUMBS_UP') {
    // Thumb points UP high, other fingers curled
    tipOffsets = {
      thumb: { x: -0.10 * scale, y: -0.28 * scale },
      index: { x: -0.03 * scale, y: -0.10 * scale },
      middle: { x: 0.0 * scale, y: -0.10 * scale },
      ring: { x: 0.03 * scale, y: -0.10 * scale },
      pinky: { x: 0.06 * scale, y: -0.09 * scale },
    };
  }

  // 0: Wrist
  landmarks.push({ x: origin.x, y: origin.y, z: 0 });

  // 1..4: Thumb
  landmarks.push({ x: origin.x - 0.04 * scale, y: origin.y - 0.05 * scale, z: 0 });
  landmarks.push({ x: origin.x - 0.07 * scale, y: origin.y - 0.09 * scale, z: 0 }); // base 2
  landmarks.push({ x: origin.x - 0.10 * scale, y: origin.y - 0.12 * scale, z: 0 });
  landmarks.push({ x: origin.x + tipOffsets.thumb.x, y: origin.y + tipOffsets.thumb.y, z: 0 }); // tip 4

  // 5..8: Index
  landmarks.push({ x: origin.x - 0.05 * scale, y: origin.y - 0.18 * scale, z: 0 }); // MCP 5
  landmarks.push({ x: origin.x - 0.05 * scale, y: origin.y - 0.23 * scale, z: 0 });
  landmarks.push({ x: origin.x - 0.05 * scale, y: origin.y - 0.28 * scale, z: 0 });
  landmarks.push({ x: origin.x + tipOffsets.index.x, y: origin.y + tipOffsets.index.y, z: 0 }); // tip 8

  // 9..12: Middle
  landmarks.push({ x: origin.x, y: origin.y - 0.20 * scale, z: 0 }); // MCP 9
  landmarks.push({ x: origin.x, y: origin.y - 0.26 * scale, z: 0 });
  landmarks.push({ x: origin.x, y: origin.y - 0.32 * scale, z: 0 });
  landmarks.push({ x: origin.x + tipOffsets.middle.x, y: origin.y + tipOffsets.middle.y, z: 0 }); // tip 12

  // 13..16: Ring
  landmarks.push({ x: origin.x + 0.05 * scale, y: origin.y - 0.18 * scale, z: 0 }); // MCP 13
  landmarks.push({ x: origin.x + 0.05 * scale, y: origin.y - 0.23 * scale, z: 0 });
  landmarks.push({ x: origin.x + 0.05 * scale, y: origin.y - 0.28 * scale, z: 0 });
  landmarks.push({ x: origin.x + tipOffsets.ring.x, y: origin.y + tipOffsets.ring.y, z: 0 }); // tip 16

  // 17..20: Pinky
  landmarks.push({ x: origin.x + 0.09 * scale, y: origin.y - 0.15 * scale, z: 0 }); // MCP 17
  landmarks.push({ x: origin.x + 0.09 * scale, y: origin.y - 0.19 * scale, z: 0 });
  landmarks.push({ x: origin.x + 0.09 * scale, y: origin.y - 0.23 * scale, z: 0 });
  landmarks.push({ x: origin.x + tipOffsets.pinky.x, y: origin.y + tipOffsets.pinky.y, z: 0 }); // tip 20

  // Apply jitter if requested
  if (jitter > 0) {
    const palm = distance(landmarks[0], landmarks[9]);
    for (let i = 0; i < landmarks.length; i++) {
      landmarks[i].x += (Math.random() - 0.5) * jitter * palm;
      landmarks[i].y += (Math.random() - 0.5) * jitter * palm;
    }
  }

  return landmarks;
}

describe('Gesture Classification & Mathematics (T-GES-01..T-GES-11)', () => {
  it('T-GES-01: Classifies clean synthetic landmarks (OPEN_PALM, FIST, PINCH, THUMBS_UP)', () => {
    const classifier = new GestureClassifier();

    // Debounce requires 3 frames
    for (let i = 0; i < 3; i++) classifier.classify(createSyntheticLandmarks('OPEN_PALM'));
    expect(classifier.activeGesture).toBe(GESTURE_TYPES.OPEN_PALM);

    classifier.reset();
    for (let i = 0; i < 3; i++) classifier.classify(createSyntheticLandmarks('FIST'));
    expect(classifier.activeGesture).toBe(GESTURE_TYPES.FIST);

    classifier.reset();
    for (let i = 0; i < 3; i++) classifier.classify(createSyntheticLandmarks('PINCH'));
    expect(classifier.activeGesture).toBe(GESTURE_TYPES.PINCH);

    classifier.reset();
    for (let i = 0; i < 3; i++) classifier.classify(createSyntheticLandmarks('THUMBS_UP'));
    expect(classifier.activeGesture).toBe(GESTURE_TYPES.THUMBS_UP);
  });

  it('T-GES-02: Accurate classification under 1.5% Gaussian jitter (>98% of 1000 samples)', () => {
    const classifier = new GestureClassifier();
    const gestureTypes = ['OPEN_PALM', 'FIST', 'PINCH', 'THUMBS_UP'];
    let correct = 0;
    const total = 1000;

    for (let i = 0; i < total; i++) {
      const type = gestureTypes[i % 4];
      const lm = createSyntheticLandmarks(/** @type {any} */ (type), 1.0, 0.015);
      const features = extractFeatures(lm);
      const predicted = classifier.classifyRaw(features);
      if (predicted === type) {
        correct++;
      }
    }

    const accuracy = correct / total;
    expect(accuracy).toBeGreaterThanOrEqual(0.98);
  });

  it('T-GES-03: Scale-invariant features (0.5x vs 2.0x within 1%)', () => {
    const lmSmall = createSyntheticLandmarks('OPEN_PALM', 0.5);
    const lmLarge = createSyntheticLandmarks('OPEN_PALM', 2.0);

    const featSmall = extractFeatures(lmSmall);
    const featLarge = extractFeatures(lmLarge);

    expect(Math.abs(featSmall.pinchRatio - featLarge.pinchRatio)).toBeLessThan(0.01);
    expect(Math.abs(featSmall.fistScore - featLarge.fistScore)).toBeLessThan(0.01);
  });

  it('T-GES-04: Hysteresis: pinch oscillating between 0.28 and 0.32 does not toggle', () => {
    const classifier = new GestureClassifier();

    // 1. Enter pinch: pinch < 0.25
    classifier.classifyRaw({ palmSize: 1, pinchRatio: 0.20, fistScore: 1.5, extensions: [1.5, 1.5, 1.5, 1.5], thumbUp: false, thumbExtended: 0.5 });
    expect(classifier.isPinching).toBe(true);

    // 2. Oscillate inside the deadband [0.28, 0.32]
    classifier.classifyRaw({ palmSize: 1, pinchRatio: 0.28, fistScore: 1.5, extensions: [1.5, 1.5, 1.5, 1.5], thumbUp: false, thumbExtended: 0.5 });
    expect(classifier.isPinching).toBe(true);

    classifier.classifyRaw({ palmSize: 1, pinchRatio: 0.32, fistScore: 1.5, extensions: [1.5, 1.5, 1.5, 1.5], thumbUp: false, thumbExtended: 0.5 });
    expect(classifier.isPinching).toBe(true);

    // 3. Exit pinch: pinch > 0.35
    classifier.classifyRaw({ palmSize: 1, pinchRatio: 0.38, fistScore: 1.5, extensions: [1.5, 1.5, 1.5, 1.5], thumbUp: false, thumbExtended: 0.5 });
    expect(classifier.isPinching).toBe(false);
  });

  it('T-GES-05: Debounce: 1-frame blip of FIST during OPEN_PALM stays PAN', () => {
    const classifier = new GestureClassifier();
    const palm = createSyntheticLandmarks('OPEN_PALM');
    const fist = createSyntheticLandmarks('FIST');

    // Establish OPEN_PALM
    for (let i = 0; i < 3; i++) classifier.classify(palm);
    expect(classifier.activeGesture).toBe(GESTURE_TYPES.OPEN_PALM);

    // Single frame blip of FIST
    classifier.classify(fist);
    // Active gesture must remain OPEN_PALM
    expect(classifier.activeGesture).toBe(GESTURE_TYPES.OPEN_PALM);

    // Back to OPEN_PALM
    classifier.classify(palm);
    expect(classifier.activeGesture).toBe(GESTURE_TYPES.OPEN_PALM);
  });

  it('T-GES-06: State machine: OPEN_PALM -> PINCH -> release produces PAN, ZOOM, PAN', () => {
    const machine = new GestureStateMachine();
    const palm = { x: 0.5, y: 0.5 };

    const res1 = machine.process(GESTURE_TYPES.OPEN_PALM, palm);
    expect(res1.state).toBe(MACHINE_STATES.PAN);

    const res2 = machine.process(GESTURE_TYPES.PINCH, palm);
    expect(res2.state).toBe(MACHINE_STATES.ZOOM);

    const res3 = machine.process(GESTURE_TYPES.OPEN_PALM, palm);
    expect(res3.state).toBe(MACHINE_STATES.PAN);
  });

  it('T-GES-07: Fist held 800 ms emits one FLY_TO, held 700 ms emits none, 1s lockout', () => {
    let now = 1000;
    const emitted = [];
    const machine = new GestureStateMachine({
      nowFn: () => now,
      emitFn: (type, payload) => emitted.push({ type, payload }),
    });

    const palm = { x: 0.5, y: 0.5 };

    // 1. Fist held 700 ms -> no emit
    machine.process(GESTURE_TYPES.FIST, palm);
    now += 700;
    machine.process(GESTURE_TYPES.FIST, palm);
    expect(emitted.length).toBe(0);

    // 2. Fist reaches 800 ms -> emits FLY_TO
    now += 100; // Total 800 ms
    machine.process(GESTURE_TYPES.FIST, palm);
    expect(emitted.length).toBe(1);
    expect(emitted[0].type).toBe(INTENT_TYPES.FLY_TO);

    // 3. Immediate next fist (within 1s lockout) -> should not emit
    machine.process(GESTURE_TYPES.FIST, palm);
    now += 800;
    machine.process(GESTURE_TYPES.FIST, palm);
    expect(emitted.length).toBe(1); // Still 1 due to lockout
  });

  it('T-GES-08: Tracking lost for 200 ms keeps state; lost for 400 ms returns to IDLE', () => {
    let now = 1000;
    const machine = new GestureStateMachine({ nowFn: () => now });
    const palm = { x: 0.5, y: 0.5 };

    machine.process(GESTURE_TYPES.OPEN_PALM, palm);
    expect(machine.state).toBe(MACHINE_STATES.PAN);

    // Lost for 200 ms -> maintains state
    now += 200;
    const res200 = machine.process(GESTURE_TYPES.NONE, null);
    expect(res200.state).toBe(MACHINE_STATES.PAN);

    // Lost for 400 ms total -> resets to IDLE
    now += 200; // now is 1400 (400ms since last tracking)
    const res400 = machine.process(GESTURE_TYPES.NONE, null);
    expect(res400.state).toBe(MACHINE_STATES.IDLE);
  });

  it('T-GES-09: Resting hand with jitter under dead zone (0.004) emits zero ROTATE intents', () => {
    const emitted = [];
    const machine = new GestureStateMachine({
      emitFn: (type, payload) => emitted.push({ type, payload }),
    });

    // Start PAN
    machine.process(GESTURE_TYPES.OPEN_PALM, { x: 0.5, y: 0.5 });

    // Jitter under 0.004
    for (let i = 0; i < 50; i++) {
      const jitterX = 0.5 + (Math.random() - 0.5) * 0.002;
      const jitterY = 0.5 + (Math.random() - 0.5) * 0.002;
      machine.process(GESTURE_TYPES.OPEN_PALM, { x: jitterX, y: jitterY });
    }

    expect(emitted.filter((e) => e.type === INTENT_TYPES.ROTATE).length).toBe(0);
  });

  it('T-GES-10: Mirrored x axis: hand moving right turns globe right', () => {
    const emitted = [];
    const machine = new GestureStateMachine({
      emitFn: (type, payload) => emitted.push({ type, payload }),
    });

    machine.process(GESTURE_TYPES.OPEN_PALM, { x: 0.5, y: 0.5 });

    // In a mirrored webcam view, moving your hand physically RIGHT causes the image coordinate to decrease (e.g. from 0.50 to 0.45)
    // The machine inverts dx so dx becomes POSITIVE, rotating the globe right
    machine.process(GESTURE_TYPES.OPEN_PALM, { x: 0.45, y: 0.5 });

    const rotateIntent = emitted.find((e) => e.type === INTENT_TYPES.ROTATE);
    expect(rotateIntent).toBeDefined();
    expect(rotateIntent.payload.dx).toBeGreaterThan(0);
  });

  it('T-GES-11: Zoom gain scales with camera height (10,000 km is ~1,000x of 10 km)', () => {
    const emittedOrbit = [];
    const machineOrbit = new GestureStateMachine({
      cameraHeightFn: () => 10000000, // 10,000 km
      emitFn: (type, payload) => emittedOrbit.push({ type, payload }),
    });

    machineOrbit.process(GESTURE_TYPES.PINCH, { x: 0.5, y: 0.5 });
    machineOrbit.process(GESTURE_TYPES.PINCH, { x: 0.5, y: 0.55 });
    const orbitDz = emittedOrbit[0]?.payload.dz;

    const emittedLow = [];
    const machineLow = new GestureStateMachine({
      cameraHeightFn: () => 10000, // 10 km
      emitFn: (type, payload) => emittedLow.push({ type, payload }),
    });

    machineLow.process(GESTURE_TYPES.PINCH, { x: 0.5, y: 0.5 });
    machineLow.process(GESTURE_TYPES.PINCH, { x: 0.5, y: 0.55 });
    const lowDz = emittedLow[0]?.payload.dz;

    expect(orbitDz).toBeDefined();
    expect(lowDz).toBeDefined();
    expect(orbitDz / lowDz).toBeCloseTo(1000, 0);
  });
});
