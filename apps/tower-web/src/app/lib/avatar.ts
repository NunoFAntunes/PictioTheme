/**
 * A player's avatar until Doodle Tower has its own avatar pad: a doodled face under a hard hat,
 * in a colour picked from the name, as a 128×128 PNG data URL (DoodleWhirl's avatar format).
 */

const HAT_COLORS = ['#f6c93b', '#ff8a3d', '#4fc3c8', '#e8edf7', '#9ad05b', '#f27fa5'];
const SIZE = 128;

function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ (ch.codePointAt(0) ?? 0), 16777619);
  return h >>> 0;
}

export function makeAvatar(name: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');
  const h = hash(name.trim().toLowerCase());
  const hat = HAT_COLORS[h % HAT_COLORS.length] ?? '#f6c93b';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#14213d';

  // Face.
  ctx.fillStyle = '#fbf7ee';
  ctx.beginPath();
  ctx.arc(64, 74, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Eyes and a grin, slightly different per name.
  ctx.fillStyle = '#14213d';
  const eyeY = 74 + ((h >> 3) % 5);
  ctx.beginPath();
  ctx.arc(51, eyeY, 4, 0, Math.PI * 2);
  ctx.arc(77, eyeY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  const grin = 6 + ((h >> 6) % 8);
  ctx.moveTo(50, 92);
  ctx.quadraticCurveTo(64, 92 + grin, 78, 92);
  ctx.stroke();
  // The hard hat: a dome and a brim.
  ctx.fillStyle = hat;
  ctx.beginPath();
  ctx.moveTo(28, 58);
  ctx.quadraticCurveTo(30, 20, 64, 20);
  ctx.quadraticCurveTo(98, 20, 100, 58);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(18, 60);
  ctx.lineTo(110, 60);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(64, 22);
  ctx.lineTo(64, 56);
  ctx.stroke();
  return canvas.toDataURL('image/png');
}
