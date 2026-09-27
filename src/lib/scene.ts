import { GROUND_Y, WORLD_H, type MapDef } from '../shared/sim';

function rng(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r + amt * 255)));
  g = Math.max(0, Math.min(255, Math.round(g + amt * 255)));
  b = Math.max(0, Math.min(255, Math.round(b + amt * 255)));
  return `rgb(${r},${g},${b})`;
}

function hills(ctx: CanvasRenderingContext2D, W: number, baseY: number, amp: number, color: string, r: () => number, freq = 0.004) {
  const ph = r() * 10;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 5);
  for (let x = 0; x <= W; x += 20) {
    const y = baseY - Math.sin(x * freq + ph) * amp - Math.sin(x * freq * 2.7 + ph * 2) * amp * 0.35;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, GROUND_Y + 5);
  ctx.closePath();
  ctx.fill();
}

function palm(ctx: CanvasRenderingContext2D, x: number, h: number, lean: number) {
  const baseY = GROUND_Y;
  ctx.strokeStyle = '#8b5e34';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + lean * 0.4, baseY - h * 0.6, x + lean, baseY - h);
  ctx.stroke();
  ctx.strokeStyle = '#2f7d32';
  ctx.lineWidth = 5;
  const tx = x + lean;
  const ty = baseY - h;
  for (let i = 0; i < 7; i++) {
    const an = -Math.PI + (i / 6) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + Math.cos(an) * 30, ty + Math.sin(an) * 30 - 12, tx + Math.cos(an) * 55, ty + Math.sin(an) * 20 + 18);
    ctx.stroke();
  }
}

function tree(ctx: CanvasRenderingContext2D, x: number, h: number, color: string) {
  ctx.fillStyle = '#6d4c33';
  ctx.fillRect(x - 4, GROUND_Y - h * 0.45, 8, h * 0.45);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, GROUND_Y - h * 0.62, h * 0.3, 0, Math.PI * 2);
  ctx.arc(x - h * 0.2, GROUND_Y - h * 0.5, h * 0.22, 0, Math.PI * 2);
  ctx.arc(x + h * 0.2, GROUND_Y - h * 0.5, h * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

function pine(ctx: CanvasRenderingContext2D, x: number, h: number, color: string) {
  ctx.fillStyle = color;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x - h * 0.28 + i * 4, GROUND_Y - h * 0.2 - i * h * 0.25);
    ctx.lineTo(x, GROUND_Y - h * 0.55 - i * h * 0.25);
    ctx.lineTo(x + h * 0.28 - i * 4, GROUND_Y - h * 0.2 - i * h * 0.25);
    ctx.fill();
  }
  ctx.fillStyle = '#5b3b24';
  ctx.fillRect(x - 3, GROUND_Y - h * 0.2, 6, h * 0.2);
}

function house(ctx: CanvasRenderingContext2D, x: number, w: number, h: number, wall: string, roof: string) {
  const y = GROUND_Y - h;
  ctx.fillStyle = wall;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x - 10, y + 2);
  ctx.lineTo(x + w * 0.25, y - h * 0.55);
  ctx.lineTo(x + w * 0.75, y - h * 0.55);
  ctx.lineTo(x + w + 10, y + 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(40,25,15,0.7)';
  ctx.fillRect(x + w * 0.4, y + h * 0.35, w * 0.2, h * 0.65);
  ctx.fillStyle = '#ffe8a3';
  ctx.fillRect(x + w * 0.12, y + h * 0.3, w * 0.16, h * 0.22);
  ctx.fillRect(x + w * 0.72, y + h * 0.3, w * 0.16, h * 0.22);
}

/** Pre-render the static background for a map (sky, scenery, ground). */
export function buildBackground(map: MapDef, res: number): HTMLCanvasElement {
  const W = map.width;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(W * res);
  cv.height = Math.ceil(WORLD_H * res);
  const ctx = cv.getContext('2d')!;
  ctx.scale(res, res);
  const r = rng(map.id + map.theme);

  // sky
  const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  g.addColorStop(0, map.sky[0]);
  g.addColorStop(1, map.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, WORLD_H);

  // sun
  const sunset = map.weather === 'sunset';
  const sx = W * (sunset ? 0.62 : 0.78);
  const sy = sunset ? GROUND_Y - 190 : 150;
  const sg = ctx.createRadialGradient(sx, sy, 10, sx, sy, sunset ? 260 : 160);
  sg.addColorStop(0, sunset ? 'rgba(255,240,180,1)' : 'rgba(255,255,230,0.95)');
  sg.addColorStop(0.25, sunset ? 'rgba(255,200,120,0.7)' : 'rgba(255,250,200,0.45)');
  sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(sx - 300, sy - 300, 600, 600);
  ctx.fillStyle = sunset ? '#fff1c1' : '#fffbe0';
  ctx.beginPath();
  ctx.arc(sx, sy, sunset ? 60 : 42, 0, Math.PI * 2);
  ctx.fill();

  const theme = map.theme;
  const gnd = map.ground;

  if (theme === 'mountain') {
    for (let layer = 0; layer < 3; layer++) {
      const col = ['#8fa9c9', '#6f8fb3', '#4d6f5a'][layer];
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      let x = -100;
      while (x < W + 200) {
        const pw = 260 + r() * 260 - layer * 40;
        const ph = 380 - layer * 90 + r() * 120;
        ctx.lineTo(x + pw / 2, GROUND_Y - ph);
        ctx.lineTo(x + pw, GROUND_Y - 60 - layer * 20);
        if (layer < 2) {
          // snow cap
          ctx.save();
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.beginPath();
          ctx.moveTo(x + pw / 2, GROUND_Y - ph);
          ctx.lineTo(x + pw / 2 - 40, GROUND_Y - ph + 60);
          ctx.lineTo(x + pw / 2 + 40, GROUND_Y - ph + 60);
          ctx.fill();
          ctx.restore();
          ctx.fillStyle = col;
        }
        x += pw * 0.8;
      }
      ctx.lineTo(W, GROUND_Y);
      ctx.closePath();
      ctx.fill();
    }
    for (let i = 0; i < 26; i++) pine(ctx, r() * W, 70 + r() * 70, i % 2 ? '#2e5d3a' : '#24503a');
  } else if (theme === 'city') {
    for (let layer = 0; layer < 2; layer++) {
      let x = 0;
      while (x < W) {
        const bw = 60 + r() * 90;
        const bh = (layer === 0 ? 260 : 150) + r() * (layer === 0 ? 260 : 200);
        ctx.fillStyle = layer === 0 ? '#9aa9bb' : '#6c7a8c';
        ctx.fillRect(x, GROUND_Y - bh, bw, bh);
        ctx.fillStyle = layer === 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,236,160,0.65)';
        for (let wy = GROUND_Y - bh + 14; wy < GROUND_Y - 20; wy += 22) {
          for (let wx = x + 8; wx < x + bw - 12; wx += 16) if (r() > 0.35) ctx.fillRect(wx, wy, 8, 10);
        }
        x += bw + (layer === 0 ? 4 : 30 + r() * 40);
      }
    }
    ctx.fillStyle = '#4a5260';
    ctx.fillRect(0, GROUND_Y - 14, W, 14);
  } else if (theme === 'beach') {
    const sea = ctx.createLinearGradient(0, 640, 0, GROUND_Y);
    sea.addColorStop(0, '#1b8fd1');
    sea.addColorStop(1, '#5fd0e6');
    ctx.fillStyle = sea;
    ctx.fillRect(0, 640, W, GROUND_Y - 640);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 70; i++) {
      const x = r() * W;
      const y = 660 + r() * (GROUND_Y - 680);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 15, y - 4, x + 30, y);
      ctx.stroke();
    }
    // boat
    const bx = W * 0.3;
    ctx.fillStyle = '#8b4513';
    ctx.beginPath();
    ctx.moveTo(bx - 40, 700);
    ctx.lineTo(bx + 40, 700);
    ctx.lineTo(bx + 28, 715);
    ctx.lineTo(bx - 28, 715);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(bx, 640);
    ctx.lineTo(bx, 698);
    ctx.lineTo(bx + 32, 698);
    ctx.fill();
    for (let i = 0; i < 9; i++) palm(ctx, (i + 0.5) * (W / 9) + (r() - 0.5) * 80, 150 + r() * 80, (r() - 0.5) * 70);
  } else if (theme === 'rice') {
    hills(ctx, W, 640, 60, '#9ccc65', r);
    for (let i = 0; i < 6; i++) {
      const y = 690 + i * 32;
      ctx.fillStyle = i % 2 ? '#8bc34a' : '#7cb342';
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      for (let x = 0; x <= W; x += 30) ctx.lineTo(x, y + Math.sin(x * 0.006 + i) * 14);
      ctx.lineTo(W, GROUND_Y);
      ctx.fill();
      ctx.strokeStyle = 'rgba(210,240,255,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 30) ctx.lineTo(x, y + 3 + Math.sin(x * 0.006 + i) * 14);
      ctx.stroke();
    }
    // saung (hut)
    const hx = W * 0.72;
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(hx - 30, GROUND_Y - 70, 6, 70);
    ctx.fillRect(hx + 24, GROUND_Y - 70, 6, 70);
    ctx.fillStyle = '#c9a26b';
    ctx.beginPath();
    ctx.moveTo(hx - 55, GROUND_Y - 66);
    ctx.lineTo(hx, GROUND_Y - 118);
    ctx.lineTo(hx + 55, GROUND_Y - 66);
    ctx.fill();
    for (let i = 0; i < 8; i++) palm(ctx, r() * W, 130 + r() * 70, (r() - 0.5) * 50);
  } else if (theme === 'hill') {
    hills(ctx, W, 700, 90, '#7b4b6a', r, 0.003);
    hills(ctx, W, 790, 60, '#4e2f47', r, 0.005);
    // lone tree silhouette
    const tx = W * 0.2;
    ctx.fillStyle = '#2d1b2a';
    ctx.fillRect(tx - 5, GROUND_Y - 150, 10, 150);
    ctx.beginPath();
    ctx.arc(tx, GROUND_Y - 170, 60, 0, Math.PI * 2);
    ctx.arc(tx - 50, GROUND_Y - 140, 40, 0, Math.PI * 2);
    ctx.arc(tx + 50, GROUND_Y - 140, 40, 0, Math.PI * 2);
    ctx.fill();
  } else if (theme === 'festival') {
    hills(ctx, W, 720, 50, '#a5d6a7', r);
    // tents
    const tentCols = ['#e63946', '#ffb703', '#2a9d8f', '#3a86ff', '#ff006e'];
    for (let x = 60; x < W; x += 220 + r() * 120) {
      const c = tentCols[Math.floor(r() * tentCols.length)];
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x - 60, GROUND_Y - 50);
      ctx.lineTo(x, GROUND_Y - 120);
      ctx.lineTo(x + 60, GROUND_Y - 50);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 50, GROUND_Y - 50, 100, 50);
      ctx.fillStyle = c;
      for (let s = 0; s < 5; s++) ctx.fillRect(x - 50 + s * 20, GROUND_Y - 50, 10, 50);
    }
    // umbul-umbul poles
    for (let x = 150; x < W; x += 300) {
      ctx.strokeStyle = '#5d4037';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y);
      ctx.quadraticCurveTo(x + 10, GROUND_Y - 150, x + 30, GROUND_Y - 280);
      ctx.stroke();
      ctx.fillStyle = tentCols[Math.floor(r() * tentCols.length)];
      ctx.beginPath();
      ctx.moveTo(x + 28, GROUND_Y - 270);
      ctx.quadraticCurveTo(x + 36, GROUND_Y - 190, x + 20, GROUND_Y - 110);
      ctx.lineTo(x + 10, GROUND_Y - 140);
      ctx.fill();
    }
    // bunting
    for (let b = 0; b < 2; b++) {
      const by = 560 + b * 70;
      ctx.strokeStyle = 'rgba(60,40,30,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 10) ctx.lineTo(x, by + Math.sin((x / W) * Math.PI * 6) * 20);
      ctx.stroke();
      for (let x = 10; x < W; x += 36) {
        const y = by + Math.sin((x / W) * Math.PI * 6) * 20;
        ctx.fillStyle = tentCols[(x / 36 + b) % tentCols.length | 0];
        ctx.beginPath();
        ctx.moveTo(x - 10, y);
        ctx.lineTo(x + 10, y);
        ctx.lineTo(x, y + 20);
        ctx.fill();
      }
    }
    // crowd
    for (let x = 0; x < W; x += 14) {
      if (r() > 0.55) continue;
      ctx.fillStyle = `hsl(${Math.floor(r() * 360)},45%,40%)`;
      ctx.beginPath();
      ctx.arc(x, GROUND_Y - 10 - r() * 6, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme === 'field') {
    hills(ctx, W, 720, 45, '#8fbf6a', r);
    for (let i = 0; i < 18; i++) tree(ctx, r() * W, 90 + r() * 70, i % 2 ? '#3f7d3a' : '#4f8f42');
    // goals
    for (const gx of [120, W - 120]) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 5;
      ctx.strokeRect(gx - 40, GROUND_Y - 70, 80, 70);
    }
  } else {
    // village
    hills(ctx, W, 680, 70, '#8bc48a', r);
    for (let i = 0; i < 10; i++) palm(ctx, r() * W, 140 + r() * 90, (r() - 0.5) * 60);
    let x = 80;
    while (x < W - 100) {
      const w = 80 + r() * 50;
      house(ctx, x, w, 60 + r() * 25, ['#f1e3c6', '#e8d2a6', '#f5f0e6'][Math.floor(r() * 3)], ['#b5452b', '#8e3b2a', '#a0522d'][Math.floor(r() * 3)]);
      x += w + 120 + r() * 200;
    }
    for (let i = 0; i < 10; i++) tree(ctx, r() * W, 70 + r() * 50, '#4f8f42');
  }

  // ground
  ctx.fillStyle = gnd;
  ctx.fillRect(0, GROUND_Y, W, WORLD_H - GROUND_Y);
  ctx.fillStyle = shade(gnd, -0.08);
  ctx.fillRect(0, GROUND_Y, W, 8);
  ctx.fillStyle = shade(gnd, 0.06);
  for (let i = 0; i < W / 8; i++) ctx.fillRect(r() * W, GROUND_Y + 12 + r() * (WORLD_H - GROUND_Y - 16), 3, 2);

  // arena boundary posts
  ctx.fillStyle = 'rgba(230,57,70,0.8)';
  ctx.fillRect(8, GROUND_Y - 60, 6, 60);
  ctx.fillRect(W - 14, GROUND_Y - 60, 6, 60);

  if (sunset) {
    ctx.fillStyle = 'rgba(255,120,60,0.12)';
    ctx.fillRect(0, 0, W, WORLD_H);
  }
  return cv;
}

export function buildCloudSprite(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 220;
  c.height = 100;
  const x = c.getContext('2d')!;
  x.fillStyle = 'rgba(255,255,255,0.9)';
  for (const [cx, cy, r] of [
    [60, 62, 32],
    [100, 48, 40],
    [145, 60, 34],
    [175, 70, 22],
    [35, 74, 20],
  ]) {
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fill();
  }
  x.fillRect(35, 70, 150, 24);
  return c;
}
