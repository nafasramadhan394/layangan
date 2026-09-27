// Client-side image pipeline for Create Kite: validation, crop, background removal, trimming, export.

export const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

export async function validateFile(file: File): Promise<string | null> {
  if (file.size > 12 * 1024 * 1024) return 'Ukuran file maksimal 12 MB';
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  const isJpg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const isWebp =
    String.fromCharCode(head[0], head[1], head[2], head[3]) === 'RIFF' && String.fromCharCode(head[8], head[9], head[10], head[11]) === 'WEBP';
  if (!isPng && !isJpg && !isWebp) return 'Format tidak didukung. Gunakan PNG, JPG/JPEG, atau WebP.';
  return null;
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gambar tidak bisa dibaca'));
    };
    img.src = url;
  });
}

export function imageToCanvas(img: HTMLImageElement | HTMLCanvasElement, maxDim = 900) {
  const w0 = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  const h0 = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
  const k = Math.min(1, maxDim / Math.max(w0, h0));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w0 * k));
  c.height = Math.max(1, Math.round(h0 * k));
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

export function cropCanvas(src: HTMLCanvasElement, r: { x: number; y: number; w: number; h: number }) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(r.w));
  c.height = Math.max(1, Math.round(r.h));
  c.getContext('2d')!.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
  return c;
}

export function cloneCanvas(src: HTMLCanvasElement) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d')!.drawImage(src, 0, 0);
  return c;
}

/** Fraction of pixels already transparent (alpha < 20). */
export function transparencyRatio(c: HTMLCanvasElement) {
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 20) n++;
  return n / (d.length / 4);
}

/**
 * Automatic background removal: estimate background colours from the image border,
 * flood-fill from the edges through similar colours, soften the edge, and optionally
 * keep only the main object.
 */
export function removeBackground(src: HTMLCanvasElement, tolerance = 38, keepMain = true) {
  const c = cloneCanvas(src);
  const ctx = c.getContext('2d')!;
  const W = c.width;
  const H = c.height;
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;

  // 1. background palette from border pixels (coarse quantisation)
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  const sample = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    if (d[i + 3] < 20) return;
    const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    const b = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
    b.r += d[i];
    b.g += d[i + 1];
    b.b += d[i + 2];
    b.n++;
    buckets.set(key, b);
  };
  for (let x = 0; x < W; x += 1) {
    sample(x, 0);
    sample(x, H - 1);
    sample(x, Math.min(H - 1, 2));
    sample(x, Math.max(0, H - 3));
  }
  for (let y = 0; y < H; y += 1) {
    sample(0, y);
    sample(W - 1, y);
    sample(Math.min(W - 1, 2), y);
    sample(Math.max(0, W - 3), y);
  }
  const total = [...buckets.values()].reduce((s, b) => s + b.n, 0) || 1;
  const palette = [...buckets.values()]
    .filter((b) => b.n / total > 0.02)
    .sort((a, b) => b.n - a.n)
    .slice(0, 6)
    .map((b) => [b.r / b.n, b.g / b.n, b.b / b.n]);

  const dist = (i: number) => {
    let best = 1e9;
    for (const p of palette) {
      const dr = d[i] - p[0];
      const dg = d[i + 1] - p[1];
      const db = d[i + 2] - p[2];
      const v = Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11) * 1.7;
      if (v < best) best = v;
    }
    return best;
  };

  // 2. flood fill from borders
  const bg = new Uint8Array(W * H);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const k = y * W + x;
    if (bg[k]) return;
    const i = k * 4;
    if (d[i + 3] < 20 || (palette.length && dist(i) < tolerance)) {
      bg[k] = 1;
      stack.push(k);
    }
  };
  for (let x = 0; x < W; x++) {
    push(x, 0);
    push(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    push(0, y);
    push(W - 1, y);
  }
  while (stack.length) {
    const k = stack.pop()!;
    const x = k % W;
    const y = (k / W) | 0;
    if (x > 0) push(x - 1, y);
    if (x < W - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < H - 1) push(x, y + 1);
  }

  // 3. apply alpha with soft edge
  for (let k = 0; k < W * H; k++) {
    const i = k * 4;
    if (bg[k]) {
      d[i + 3] = 0;
      continue;
    }
    const x = k % W;
    const y = (k / W) | 0;
    const edge = (x > 0 && bg[k - 1]) || (x < W - 1 && bg[k + 1]) || (y > 0 && bg[k - W]) || (y < H - 1 && bg[k + W]);
    if (edge && palette.length) {
      const v = dist(i);
      const a = Math.max(0, Math.min(1, (v - tolerance * 0.6) / (tolerance * 0.9)));
      d[i + 3] = Math.round(d[i + 3] * Math.max(0.35, a));
    }
  }

  // 4. keep main object(s)
  if (keepMain) {
    const label = new Int32Array(W * H).fill(-1);
    const sizes: number[] = [];
    for (let k = 0; k < W * H; k++) {
      if (label[k] !== -1 || d[k * 4 + 3] < 30) continue;
      const id = sizes.length;
      let n = 0;
      stack.push(k);
      label[k] = id;
      while (stack.length) {
        const q = stack.pop()!;
        n++;
        const x = q % W;
        const y = (q / W) | 0;
        const nb = [x > 0 ? q - 1 : -1, x < W - 1 ? q + 1 : -1, y > 0 ? q - W : -1, y < H - 1 ? q + W : -1];
        for (const m of nb) {
          if (m >= 0 && label[m] === -1 && d[m * 4 + 3] >= 30) {
            label[m] = id;
            stack.push(m);
          }
        }
      }
      sizes.push(n);
    }
    const max = Math.max(0, ...sizes);
    for (let k = 0; k < W * H; k++) {
      const l = label[k];
      if (l >= 0 && sizes[l] < max * 0.04) d[k * 4 + 3] = 0;
    }
  }

  ctx.putImageData(img, 0, 0);
  return c;
}

/** Manual eraser / restore brush. */
export function brush(target: HTMLCanvasElement, original: HTMLCanvasElement, x: number, y: number, r: number, mode: 'erase' | 'restore') {
  const ctx = target.getContext('2d')!;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  if (mode === 'erase') ctx.clearRect(x - r, y - r, r * 2, r * 2);
  else {
    ctx.clearRect(x - r, y - r, r * 2, r * 2);
    ctx.drawImage(original, 0, 0);
  }
  ctx.restore();
}

/** Trim transparent margins. */
export function trim(src: HTMLCanvasElement, pad = 4) {
  const d = src.getContext('2d')!.getImageData(0, 0, src.width, src.height).data;
  let x0 = src.width;
  let y0 = src.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      if (d[(y * src.width + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(src.width - 1, x1 + pad);
  y1 = Math.min(src.height - 1, y1 + pad);
  return cropCanvas(src, { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
}

export interface ShapeReport {
  score: number;
  fill: number;
  aspect: number;
  symmetry: number;
  opaque: number;
  components: number;
  reasons: string[];
}

/** Shape heuristics for a kite-like cut-out (single object, compact, roughly symmetric). */
export function analyseShape(c: HTMLCanvasElement): ShapeReport {
  const W = c.width;
  const H = c.height;
  const d = c.getContext('2d')!.getImageData(0, 0, W, H).data;
  let opaque = 0;
  let sym = 0;
  let symTotal = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = d[(y * W + x) * 4 + 3] > 40;
      if (a) opaque++;
      if (x < W / 2) {
        const b = d[(y * W + (W - 1 - x)) * 4 + 3] > 40;
        if (a || b) {
          symTotal++;
          if (a && b) sym++;
        }
      }
    }
  }
  const fill = opaque / (W * H);
  const aspect = W / H;
  const symmetry = symTotal ? sym / symTotal : 0;
  const reasons: string[] = [];
  let score = 0;
  if (fill > 0.2 && fill < 0.93) score += 0.35;
  else reasons.push(fill >= 0.93 ? 'Background belum terhapus (gambar masih kotak penuh)' : 'Objek terlalu tipis/kecil');
  if (aspect > 0.45 && aspect < 2.2) score += 0.25;
  else reasons.push('Proporsi gambar tidak seperti layangan');
  if (symmetry > 0.55) score += 0.4 * Math.min(1, (symmetry - 0.55) / 0.3 + 0.4);
  else reasons.push('Bentuk tidak simetris seperti layangan');
  return { score, fill, aspect, symmetry, opaque, components: 1, reasons };
}

/** Export to a compact transparent PNG (or WebP) data URL for upload. */
export function exportKite(c: HTMLCanvasElement, maxDim = 320) {
  const k = Math.min(1, maxDim / Math.max(c.width, c.height));
  const out = document.createElement('canvas');
  out.width = Math.max(16, Math.round(c.width * k));
  out.height = Math.max(16, Math.round(c.height * k));
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(c, 0, 0, out.width, out.height);
  let url = out.toDataURL('image/png');
  if (url.length > 450_000) {
    const webp = out.toDataURL('image/webp', 0.9);
    if (webp.startsWith('data:image/webp')) url = webp;
  }
  if (url.length > 580_000) return exportKite(c, Math.round(maxDim * 0.75));
  return url;
}
