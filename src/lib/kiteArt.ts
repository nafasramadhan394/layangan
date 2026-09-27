import type { Kite, KiteDesign } from './types';

export const KITE_BASE = 92; // world px height at size 1

const imgCache = new Map<string, HTMLImageElement>();

export function getImage(src: string | null | undefined): HTMLImageElement | null {
  if (!src) return null;
  let img = imgCache.get(src);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = src;
    imgCache.set(src, img);
    if (imgCache.size > 60) {
      const first = imgCache.keys().next().value;
      if (first) imgCache.delete(first);
    }
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export const DEFAULT_DESIGN: KiteDesign = { style: 'diamond', colors: ['#e63946', '#ffffff', '#1d3557'], tail: true, tailColor: '#ffb703' };

export function defaultKiteFor(id: number): Pick<Kite, 'image' | 'design' | 'size'> {
  const palettes = [
    ['#e63946', '#ffffff', '#1d3557'],
    ['#2a9d8f', '#e9c46a', '#264653'],
    ['#f4a261', '#e76f51', '#2b2d42'],
    ['#3a86ff', '#ffbe0b', '#023047'],
  ];
  return { image: null, design: { ...DEFAULT_DESIGN, colors: palettes[Math.abs(id) % palettes.length] }, size: 1 };
}

function path(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function drawProcedural(ctx: CanvasRenderingContext2D, d: KiteDesign, h: number) {
  const [c0, c1, c2] = d.colors.length >= 3 ? d.colors : DEFAULT_DESIGN.colors;
  const w = h * 0.82;
  const top: [number, number] = [0, -h / 2];
  const right: [number, number] = [w / 2, -h * 0.12];
  const bottom: [number, number] = [0, h / 2];
  const left: [number, number] = [-w / 2, -h * 0.12];
  const center: [number, number] = [0, -h * 0.12];
  ctx.lineJoin = 'round';

  if (d.style === 'butterfly') {
    ctx.fillStyle = c0;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * w * 0.3, -h * 0.18, w * 0.32, h * 0.26, s * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c1;
      ctx.beginPath();
      ctx.ellipse(s * w * 0.24, h * 0.16, w * 0.22, h * 0.18, -s * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c0;
    }
    ctx.fillStyle = c2;
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.06, h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = c2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.4);
    ctx.quadraticCurveTo(-w * 0.15, -h * 0.62, -w * 0.22, -h * 0.6);
    ctx.moveTo(0, -h * 0.4);
    ctx.quadraticCurveTo(w * 0.15, -h * 0.62, w * 0.22, -h * 0.6);
    ctx.stroke();
    return;
  }

  // base diamond in 4 panels
  ctx.fillStyle = c0;
  path(ctx, [top, right, center]);
  ctx.fill();
  path(ctx, [center, left, bottom]);
  ctx.fill();
  ctx.fillStyle = c1;
  path(ctx, [top, center, left]);
  ctx.fill();
  path(ctx, [center, right, bottom]);
  ctx.fill();

  if (d.style === 'stripe') {
    ctx.save();
    path(ctx, [top, right, bottom, left]);
    ctx.clip();
    ctx.fillStyle = c2;
    for (let i = -3; i <= 3; i++) ctx.fillRect(-w, i * h * 0.16 - h * 0.03, w * 2, h * 0.06);
    ctx.restore();
  }
  if (d.style === 'star') {
    ctx.fillStyle = c1 === '#ffffff' ? c2 : c1;
    ctx.beginPath();
    const r1 = h * 0.18;
    const r2 = h * 0.08;
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? r1 : r2;
      const an = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(an) * r;
      const y = center[1] + Math.sin(an) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  if (d.style === 'bebek') {
    // side "ears" typical of the layangan bebek
    ctx.fillStyle = c2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * w * 0.5, -h * 0.12);
      ctx.quadraticCurveTo(s * w * 0.78, -h * 0.02, s * w * 0.62, h * 0.14);
      ctx.quadraticCurveTo(s * w * 0.55, h * 0.02, s * w * 0.38, -h * 0.02);
      ctx.closePath();
      ctx.fill();
    }
  }

  // bamboo frame
  ctx.strokeStyle = 'rgba(40,30,20,0.85)';
  ctx.lineWidth = Math.max(1.2, h * 0.022);
  ctx.beginPath();
  ctx.moveTo(top[0], top[1]);
  ctx.lineTo(bottom[0], bottom[1]);
  ctx.moveTo(left[0], left[1]);
  ctx.quadraticCurveTo(0, -h * 0.26, right[0], right[1]);
  ctx.stroke();
  ctx.strokeStyle = c2;
  ctx.lineWidth = Math.max(1, h * 0.018);
  path(ctx, [top, right, bottom, left]);
  ctx.stroke();
}

export function kiteDims(kite: Pick<Kite, 'image' | 'size'>) {
  const h = KITE_BASE * (kite.size || 1);
  const img = getImage(kite.image);
  const w = img ? (h * img.naturalWidth) / img.naturalHeight : h * 0.82;
  return { w, h, img };
}

/**
 * Draw a kite centered at (x,y) with rotation `angle` (0 = nose up).
 * `wind` (-1..1) bends the tail. `t` seconds for flutter animation.
 */
export function drawKite(
  ctx: CanvasRenderingContext2D,
  kite: Pick<Kite, 'image' | 'design' | 'size'>,
  x: number,
  y: number,
  angle: number,
  t: number,
  wind = 0,
  flutter = 1,
) {
  const { w, h, img } = kiteDims(kite);
  const design = kite.design || DEFAULT_DESIGN;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // subtle breathing/flex of the sail
  const flex = 1 + Math.sin(t * 7.3) * 0.025 * flutter;
  ctx.scale(flex, 1 / flex);

  if (design.tail !== false) {
    const tl = h * 1.25;
    const segs = 10;
    ctx.strokeStyle = design.tailColor || '#ffb703';
    ctx.lineCap = 'round';
    let px = 0;
    let py = h / 2 - 2;
    for (let i = 1; i <= segs; i++) {
      const k = i / segs;
      const nx = Math.sin(t * 6 - i * 0.7) * 10 * k * flutter - wind * 22 * k * k;
      const ny = h / 2 + k * tl;
      ctx.lineWidth = Math.max(1, (1 - k) * h * 0.09 + 1.5);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      px = nx;
      py = ny;
    }
  }

  if (img) {
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
  } else {
    drawProcedural(ctx, design, h);
  }
  ctx.restore();
}
