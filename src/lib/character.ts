import type { Avatar } from './types';

/** Draw the player character standing on the ground at (x, groundY). */
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  av: Avatar,
  t: number,
  walking: number,
  handTo: { x: number; y: number },
  pulling: boolean,
  facing: number,
) {
  const s = 1;
  const legSwing = walking ? Math.sin(t * 10) * 7 : 0;
  ctx.save();
  ctx.translate(x, groundY);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineCap = 'round';
  // legs
  ctx.strokeStyle = '#2b2d42';
  ctx.lineWidth = 6 * s;
  ctx.beginPath();
  ctx.moveTo(-4, -26);
  ctx.lineTo(-5 + legSwing, -2);
  ctx.moveTo(4, -26);
  ctx.lineTo(5 - legSwing, -2);
  ctx.stroke();
  // body
  ctx.fillStyle = av.color;
  ctx.beginPath();
  ctx.roundRect(-11, -56, 22, 32, 7);
  ctx.fill();
  // arms toward the string/hand point
  const hx = handTo.x - x;
  const hy = handTo.y - groundY;
  const pullBack = pulling ? -6 * facing : 0;
  ctx.strokeStyle = av.skin;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-7, -50);
  ctx.lineTo(hx - 4 + pullBack, hy + 2);
  ctx.moveTo(7, -50);
  ctx.lineTo(hx + 3 + pullBack, hy);
  ctx.stroke();
  // reel (kaleng benang)
  ctx.fillStyle = '#c9a26b';
  ctx.beginPath();
  ctx.arc(-12 * facing, -30, 6, 0, Math.PI * 2);
  ctx.fill();
  // head
  ctx.fillStyle = av.skin;
  ctx.beginPath();
  ctx.arc(0, -68, 11, 0, Math.PI * 2);
  ctx.fill();
  // eyes look up
  ctx.fillStyle = '#1f1a3d';
  ctx.beginPath();
  ctx.arc(-4 + facing * 2, -71, 1.6, 0, Math.PI * 2);
  ctx.arc(4 + facing * 2, -71, 1.6, 0, Math.PI * 2);
  ctx.fill();
  drawHat(ctx, av.hat, 0, -68);
  ctx.restore();
}

function drawHat(ctx: CanvasRenderingContext2D, hat: string, x: number, y: number) {
  if (hat === 'caping') {
    ctx.fillStyle = '#d9b36c';
    ctx.beginPath();
    ctx.moveTo(x - 22, y - 4);
    ctx.lineTo(x, y - 22);
    ctx.lineTo(x + 22, y - 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#a07a3a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (hat === 'peci') {
    ctx.fillStyle = '#1b1b1b';
    ctx.beginPath();
    ctx.roundRect(x - 10, y - 18, 20, 9, 2);
    ctx.fill();
  } else if (hat === 'cap') {
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.arc(x, y - 6, 11, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x, y - 8, 16, 4);
  } else if (hat === 'bandana') {
    ctx.fillStyle = '#e63946';
    ctx.fillRect(x - 11, y - 12, 22, 5);
    ctx.beginPath();
    ctx.moveTo(x - 11, y - 10);
    ctx.lineTo(x - 19, y - 4);
    ctx.lineTo(x - 16, y - 12);
    ctx.fill();
  }
}
