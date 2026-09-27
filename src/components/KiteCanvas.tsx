import { useEffect, useRef } from 'react';
import { drawKite, KITE_BASE } from '../lib/kiteArt';
import type { Kite } from '../lib/types';

/** Small animated kite preview (flying, swaying, with a string). */
export function KiteCanvas({
  kite,
  width = 160,
  height = 160,
  string = true,
  sky = false,
  className = '',
}: {
  kite: Pick<Kite, 'image' | 'design' | 'size'> | null;
  width?: number;
  height?: number;
  string?: boolean;
  sky?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const kiteRef = useRef(kite);
  kiteRef.current = kite;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = width * dpr;
    cv.height = height * dpr;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver((e) => (visible = e[0]?.isIntersecting ?? true));
    io.observe(cv);
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      const t = ts / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (sky) {
        const g = ctx.createLinearGradient(0, 0, 0, height);
        g.addColorStop(0, '#8fd3ff');
        g.addColorStop(1, '#e6f6ff');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
      }
      const k = kiteRef.current;
      if (!k) return;
      const scale = Math.min(width, height) / (KITE_BASE * 2.6);
      const cx = width * 0.52 + Math.sin(t * 0.9) * width * 0.06;
      const cy = height * 0.38 + Math.sin(t * 1.3) * height * 0.05;
      if (string) {
        ctx.strokeStyle = 'rgba(31,26,61,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy + 6);
        ctx.quadraticCurveTo(width * 0.4, height * 0.8, width * 0.18, height + 4);
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      drawKite(ctx, k, 0, 0, Math.sin(t * 1.1) * 0.18, t, Math.sin(t * 0.5) * 0.6);
      ctx.restore();
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [width, height, string, sky]);

  return <canvas ref={ref} style={{ width, height }} className={className} />;
}
