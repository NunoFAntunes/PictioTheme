/**
 * A player's avatar until Doodle Tower has its own avatar pad: a doodled face under a bobble hat,
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
  // A bobble hat: a dome, a folded brim and a pompom on top.
  ctx.fillStyle = hat;
  ctx.beginPath();
  ctx.moveTo(30, 56);
  ctx.quadraticCurveTo(32, 18, 64, 18);
  ctx.quadraticCurveTo(96, 18, 98, 56);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(26, 50, 76, 14, 7);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(64, 15, 9, 0, Math.PI * 2);
  ctx.fillStyle = '#fbf7ee';
  ctx.fill();
  ctx.stroke();
  return canvas.toDataURL('image/png');
}
