// @ts-check

/**
 * Creates an oriented aircraft silhouette sprite on a 32x32 canvas.
 * @returns {HTMLCanvasElement}
 */
export function createAircraftCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  // Sleek aircraft silhouette pointing straight UP (0° heading) on 32x32 canvas
  ctx.moveTo(16, 2);   // Nose tip
  ctx.lineTo(18, 10);  // Cockpit right
  ctx.lineTo(30, 20);  // Right wingtip
  ctx.lineTo(30, 22);  // Right wing trailing edge
  ctx.lineTo(18, 18);  // Wing root right
  ctx.lineTo(18, 26);  // Fuselage aft right
  ctx.lineTo(23, 29);  // Right horizontal stabilizer
  ctx.lineTo(23, 30);
  ctx.lineTo(16, 28);  // Tail aft center
  ctx.lineTo(9, 30);   // Left horizontal stabilizer
  ctx.lineTo(9, 29);
  ctx.lineTo(14, 26);  // Fuselage aft left
  ctx.lineTo(14, 18);  // Wing root left
  ctx.lineTo(2, 22);   // Left wing trailing edge
  ctx.lineTo(2, 20);   // Left wingtip
  ctx.lineTo(14, 10);  // Cockpit left
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  return canvas;
}

