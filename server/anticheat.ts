import { bad, HttpError } from './http.js';
import { MAX_KITE_IMAGE_CHARS } from './config.js';
import type { Input } from '../src/shared/sim.js';

// Best-effort per-instance rate limiter (defence in depth; the real protection
// is that every economic action is validated inside DB transactions).
const buckets = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    }
    return;
  }
  b.n += 1;
  if (b.n > max) throw new HttpError(429, 'Terlalu banyak permintaan, coba lagi sebentar.');
}

export function int(v: unknown, name: string, min: number, max: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw bad(`${name} tidak valid`);
  if (n < min || n > max) throw bad(`${name} harus di antara ${min} dan ${max}`);
  return n;
}

export function num(v: unknown, name: string, min: number, max: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) throw bad(`${name} tidak valid`);
  if (n < min || n > max) throw bad(`${name} harus di antara ${min} dan ${max}`);
  return n;
}

export function str(v: unknown, name: string, min: number, max: number): string {
  if (typeof v !== 'string') throw bad(`${name} wajib diisi`);
  const s = v.trim();
  if (s.length < min || s.length > max) throw bad(`${name} harus ${min}-${max} karakter`);
  return s;
}

export function cleanText(v: unknown, name: string, min: number, max: number) {
  return str(v, name, min, max).replace(/[<>]/g, '');
}

export const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
export function color(v: unknown, fallback: string) {
  return typeof v === 'string' && COLOR_RE.test(v) ? v : fallback;
}

/** Client input is only ever a control intent — clamp it hard. */
export function sanitizeInput(raw: any): Input {
  const mx = Number(raw?.mx);
  const st = Number(raw?.st);
  return {
    mx: Number.isFinite(mx) ? Math.max(-1, Math.min(1, Math.round(mx))) : 0,
    st: Number.isFinite(st) ? Math.max(-1, Math.min(1, Math.round(st * 10) / 10)) : 0,
    pull: raw?.pull === true,
  };
}

/** Validate a kite image data URL: format by magic bytes, size and dimensions. */
export function validateKiteImage(dataUrl: unknown): string {
  if (typeof dataUrl !== 'string') throw bad('Gambar tidak valid');
  if (dataUrl.length > MAX_KITE_IMAGE_CHARS) throw bad('Ukuran gambar terlalu besar');
  const m = /^data:image\/(png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw bad('Format gambar harus PNG atau WebP transparan');
  const buf = Buffer.from(m[2], 'base64');
  if (m[1] === 'png') {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (!sig.every((b, i) => buf[i] === b)) throw bad('File PNG rusak');
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    if (w < 16 || h < 16 || w > 1024 || h > 1024) throw bad('Dimensi gambar tidak valid');
  } else {
    if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') throw bad('File WebP rusak');
  }
  return dataUrl;
}

export function sanitizeDesign(d: any) {
  const styles = ['diamond', 'bebek', 'stripe', 'star', 'butterfly', 'image'];
  const colors = Array.isArray(d?.colors) ? d.colors.slice(0, 3) : [];
  return {
    style: styles.includes(d?.style) ? d.style : 'diamond',
    colors: [color(colors[0], '#e63946'), color(colors[1], '#ffffff'), color(colors[2], '#1d3557')],
    tail: d?.tail !== false,
    tailColor: color(d?.tailColor, '#ffb703'),
  };
}
