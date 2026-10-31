// @ts-check

/**
 * 2D/3D Euclidean distance between two landmarks.
 * @param {{x: number, y: number, z?: number}} p1
 * @param {{x: number, y: number, z?: number}} p2
 * @returns {number}
 */
export function distance(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = (p2.z || 0) - (p1.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Scale-invariant feature extraction from 21 MediaPipe hand landmarks.
 * Per trd.md section 10.3 and T-GES-03.
 *
 * Landmark indices:
 * 0: wrist
 * 1..4: thumb (4 is tip, 2 is MCP/base)
 * 5..8: index (8 is tip, 5 is MCP)
 * 9..12: middle (12 is tip, 9 is MCP)
 * 13..16: ring (16 is tip, 13 is MCP)
 * 17..20: pinky (20 is tip, 17 is MCP)
 *
 * @param {Array<{x: number, y: number, z?: number}>} landmarks - 21 normalized landmarks
 * @returns {{
 *   palmSize: number,
 *   pinchRatio: number,
 *   fistScore: number,
 *   extensions: number[],
 *   palmCenter: {x: number, y: number},
 *   thumbExtended: number,
 *   thumbUp: boolean
 * }}
 */
export function extractFeatures(landmarks) {
  if (!landmarks || landmarks.length < 21) {
    return {
      palmSize: 0,
      pinchRatio: 1,
      fistScore: 2,
      extensions: [2, 2, 2, 2],
      palmCenter: { x: 0.5, y: 0.5 },
      thumbExtended: 0,
      thumbUp: false,
    };
  }

  const wrist = landmarks[0];
  const middleMcp = landmarks[9];

  // Reference length: distance from wrist to middle finger base (MCP)
  const palmSize = Math.max(1e-5, distance(wrist, middleMcp));

  // Pinch distance: thumb tip (4) to index tip (8) normalized by palm size
  const pinchDist = distance(landmarks[4], landmarks[8]);
  const pinchRatio = pinchDist / palmSize;

  // Finger extension: distance from each finger tip to wrist normalized by palm size
  const ext8 = distance(landmarks[8], wrist) / palmSize;   // Index
  const ext12 = distance(landmarks[12], wrist) / palmSize; // Middle
  const ext16 = distance(landmarks[16], wrist) / palmSize; // Ring
  const ext20 = distance(landmarks[20], wrist) / palmSize; // Pinky

  const extensions = [ext8, ext12, ext16, ext20];
  const fistScore = (ext8 + ext12 + ext16 + ext20) / 4;

  // Palm center: centroid of wrist (0) and 4 MCPs (5, 9, 13, 17)
  const palmLandmarks = [landmarks[0], landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
  const palmCenterX = palmLandmarks.reduce((sum, p) => sum + p.x, 0) / palmLandmarks.length;
  const palmCenterY = palmLandmarks.reduce((sum, p) => sum + p.y, 0) / palmLandmarks.length;

  // Thumb features: thumb tip (4) relative to base (2)
  const thumbBase = landmarks[2];
  const thumbTip = landmarks[4];
  const thumbExtended = distance(thumbTip, thumbBase) / palmSize;
  // In video coordinates, y=0 is top, y=1 is bottom, so tip.y < base.y means pointing UP
  const thumbUp = thumbTip.y < thumbBase.y;

  return {
    palmSize,
    pinchRatio,
    fistScore,
    extensions,
    palmCenter: { x: palmCenterX, y: palmCenterY },
    thumbExtended,
    thumbUp,
  };
}
