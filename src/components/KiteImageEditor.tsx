import { useEffect, useRef, useState } from 'react';
import { ImagePlus, ShieldCheck, Crop, Eraser, Paintbrush, Hand, Wand2, RefreshCcw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { ACCEPTED, analyseShape, brush, cloneCanvas, cropCanvas, exportKite, imageToCanvas, loadImageFromFile, removeBackground, transparencyRatio, trim, validateFile, type ShapeReport } from '../lib/imageTools';
import { detectKite, type DetectResult } from '../lib/kiteDetect';
import { Btn, Card } from './ui';

export interface EditorResult {
  dataUrl: string;
  accepted: boolean;
  reason: string;
}

type Step = 'pick' | 'crop' | 'bg' | 'check';
type Rect = { x: number; y: number; w: number; h: number };

const PERMISSION_KEY = 'lb_gallery_ok';

export function KiteImageEditor({ onResult }: { onResult: (r: EditorResult | null) => void }) {
  const [step, setStep] = useState<Step>('pick');
  const [err, setErr] = useState('');
  const [askPerm, setAskPerm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const baseRef = useRef<HTMLCanvasElement | null>(null); // original (downscaled)
  const [baseUrl, setBaseUrl] = useState('');
  const [crop, setCrop] = useState<Rect>({ x: 0, y: 0, w: 1, h: 1 });

  const croppedRef = useRef<HTMLCanvasElement | null>(null);
  const workRef = useRef<HTMLCanvasElement | null>(null);
  const displayRef = useRef<HTMLCanvasElement>(null);
  const [tol, setTol] = useState(38);
  const [keepMain, setKeepMain] = useState(true);
  const [removeBg, setRemoveBg] = useState(true);
  const [tool, setTool] = useState<'none' | 'erase' | 'restore'>('none');
  const [brushSize, setBrushSize] = useState(18);
  const [hadAlpha, setHadAlpha] = useState(false);

  const [checking, setChecking] = useState(false);
  const [report, setReport] = useState<{ shape: ShapeReport; det: DetectResult; accepted: boolean; reason: string; url: string } | null>(null);

  // ---------------------------------------------------------------- pick
  const openGallery = () => {
    let ok = false;
    try {
      ok = localStorage.getItem(PERMISSION_KEY) === '1';
    } catch {
      ok = false;
    }
    if (!ok) setAskPerm(true);
    else fileRef.current?.click();
  };

  const onFile = async (f: File | undefined) => {
    setErr('');
    if (!f) return;
    const bad = await validateFile(f);
    if (bad) {
      setErr(bad);
      return;
    }
    try {
      const img = await loadImageFromFile(f);
      const c = imageToCanvas(img, 900);
      URL.revokeObjectURL(img.src);
      baseRef.current = c;
      setBaseUrl(c.toDataURL('image/png'));
      const m = Math.round(Math.min(c.width, c.height) * 0.04);
      setCrop({ x: m, y: m, w: c.width - m * 2, h: c.height - m * 2 });
      setReport(null);
      onResult(null);
      setStep('crop');
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  // ---------------------------------------------------------------- crop interactions
  const imgBox = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: string; sx: number; sy: number; start: Rect } | null>(null);
  const onCropDown = (mode: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, sx: e.clientX, sy: e.clientY, start: { ...crop } };
  };
  const onCropMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const base = baseRef.current;
    const box = imgBox.current;
    if (!d || !base || !box) return;
    const k = base.width / box.getBoundingClientRect().width;
    const dx = (e.clientX - d.sx) * k;
    const dy = (e.clientY - d.sy) * k;
    const W = base.width;
    const H = base.height;
    const min = 24;
    let { x, y, w, h } = d.start;
    if (d.mode === 'move') {
      x = Math.max(0, Math.min(W - w, x + dx));
      y = Math.max(0, Math.min(H - h, y + dy));
    } else {
      if (d.mode.includes('l')) {
        const nx = Math.max(0, Math.min(x + w - min, x + dx));
        w += x - nx;
        x = nx;
      }
      if (d.mode.includes('r')) w = Math.max(min, Math.min(W - x, w + dx));
      if (d.mode.includes('t')) {
        const ny = Math.max(0, Math.min(y + h - min, y + dy));
        h += y - ny;
        y = ny;
      }
      if (d.mode.includes('b')) h = Math.max(min, Math.min(H - y, h + dy));
    }
    setCrop({ x, y, w, h });
  };
  const onCropUp = () => (drag.current = null);

  const applyCrop = () => {
    if (!baseRef.current) return;
    const c = cropCanvas(baseRef.current, crop);
    croppedRef.current = c;
    const alpha = transparencyRatio(c) > 0.05;
    setHadAlpha(alpha);
    setRemoveBg(!alpha);
    setTool('none');
    setStep('bg');
  };

  // ---------------------------------------------------------------- background removal
  useEffect(() => {
    if (step !== 'bg' || !croppedRef.current) return;
    const t = window.setTimeout(() => {
      const src = croppedRef.current!;
      workRef.current = removeBg ? removeBackground(src, tol, keepMain) : cloneCanvas(src);
      paint();
    }, 120);
    return () => window.clearTimeout(t);
  }, [step, tol, keepMain, removeBg]); // eslint-disable-line react-hooks/exhaustive-deps

  const paint = () => {
    const d = displayRef.current;
    const w = workRef.current;
    if (!d || !w) return;
    d.width = w.width;
    d.height = w.height;
    const ctx = d.getContext('2d')!;
    ctx.clearRect(0, 0, d.width, d.height);
    ctx.drawImage(w, 0, 0);
  };

  const brushing = useRef(false);
  const onBrush = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === 'none' || !workRef.current || !croppedRef.current) return;
    if (e.type === 'pointerdown') {
      brushing.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (!brushing.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const k = workRef.current.width / r.width;
    brush(workRef.current, croppedRef.current, (e.clientX - r.left) * k, (e.clientY - r.top) * k, brushSize * k, tool);
    paint();
  };

  // ---------------------------------------------------------------- validation
  const runCheck = async () => {
    if (!workRef.current) return;
    setStep('check');
    setChecking(true);
    setReport(null);
    const trimmed = trim(workRef.current, 3);
    if (!trimmed) {
      setChecking(false);
      setReport({ shape: analyseShape(workRef.current), det: { available: false, kite: 0, top: null }, accepted: false, reason: 'Gambar kosong setelah background dihapus. Turunkan toleransi.', url: '' });
      return;
    }
    const shape = analyseShape(trimmed);
    const det = await detectKite(trimmed);
    const bgGone = transparencyRatio(trimmed) > 0.04;
    let accepted = false;
    let reason = '';
    if (!bgGone) {
      reason = 'Background masih ada. Aktifkan Remove Background agar layangan bisa terbang tanpa kotak.';
    } else if (det.available && det.kite >= 0.2) {
      accepted = true;
      reason = `AI mendeteksi layangan (${Math.round(det.kite * 100)}% yakin).`;
    } else if (shape.score >= 0.72 && !(det.available && det.top && det.top.score >= 0.55)) {
      accepted = true;
      reason = 'Bentuk gambar sesuai pola layangan (simetris & kompak).';
    } else {
      reason =
        det.available && det.top && det.top.score >= 0.55
          ? `Gambar terdeteksi sebagai \u201c${det.top.label}\u201d, bukan layangan.`
          : shape.reasons[0] || 'Gambar tidak dikenali sebagai layangan.';
    }
    const url = exportKite(trimmed, 320);
    setReport({ shape, det, accepted, reason, url });
    setChecking(false);
    onResult({ dataUrl: url, accepted, reason });
  };

  const reset = () => {
    setStep('pick');
    setReport(null);
    onResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const base = baseRef.current;
  const pct = (v: number, t: number) => `${(v / t) * 100}%`;
  const StepPill = ({ id, n, label }: { id: Step; n: number; label: string }) => (
    <div className={`flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-xs font-bold ${step === id ? 'border-ink bg-ink text-white' : 'border-ink/20 text-muted'}`}>
      <span>{n}</span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  );

  return (
    <div>
      <input ref={fileRef} type="file" accept={ACCEPTED.join(',')} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <div className="mb-4 flex flex-wrap gap-2">
        <StepPill id="pick" n={1} label="Pilih gambar" />
        <StepPill id="crop" n={2} label="Crop" />
        <StepPill id="bg" n={3} label="Hapus background" />
        <StepPill id="check" n={4} label="Validasi" />
      </div>

      {step === 'pick' && (
        <Card className="p-6 text-center">
          <div className="mx-auto mb-3 grid size-20 place-items-center rounded-2xl border-2 border-ink bg-sun">
            <ImagePlus className="size-10" />
          </div>
          <h3 className="font-display text-2xl font-extrabold">Pilih gambar layangan dari galeri</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">Format didukung: PNG, JPG/JPEG, WebP. Foto layangan dengan background polos (langit/dinding) memberi hasil terbaik.</p>
          <Btn variant="primary" size="lg" className="mt-4" onClick={openGallery}>
            <ImagePlus className="size-5" /> Buka Galeri
          </Btn>
          {err && <div className="mt-3 rounded-lg border-2 border-bad bg-[#ffe0e3] px-3 py-2 text-sm font-semibold text-bad">{err}</div>}
        </Card>
      )}

      {askPerm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border-2 border-ink bg-paper p-5 shadow-[var(--shadow-hard)]">
            <ShieldCheck className="mb-2 size-10 text-sea" />
            <h3 className="font-display text-2xl font-extrabold">Izin akses foto</h3>
            <p className="mt-1 text-sm text-ink-soft">
              Layangan Battle perlu mengakses <b>foto yang kamu pilih</b> dari galeri untuk dijadikan layangan. Kami tidak meminta akses kamera, lokasi, kontak, atau seluruh galeri — hanya
              gambar yang kamu pilih sendiri, dan gambar diproses di perangkatmu.
            </p>
            <div className="mt-4 flex gap-2">
              <Btn className="flex-1" onClick={() => setAskPerm(false)}>
                Tolak
              </Btn>
              <Btn
                variant="primary"
                className="flex-1"
                onClick={() => {
                  try {
                    localStorage.setItem(PERMISSION_KEY, '1');
                  } catch {
                    /* ignore */
                  }
                  setAskPerm(false);
                  fileRef.current?.click();
                }}
              >
                Izinkan
              </Btn>
            </div>
          </div>
        </div>
      )}

      {step === 'crop' && base && (
        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2 font-bold">
            <Crop className="size-5" /> Geser kotak & tarik sudutnya untuk crop layangan
          </div>
          <div className="flex justify-center">
            <div ref={imgBox} className="relative max-w-full touch-none select-none" style={{ width: `min(100%, ${(base.width / base.height) * 55}vh)` }} onPointerMove={onCropMove} onPointerUp={onCropUp} onPointerCancel={onCropUp}>
              <img src={baseUrl} alt="Pratinjau" className="block w-full rounded-lg" draggable={false} />
              <div className="absolute inset-0 rounded-lg bg-ink/45" style={{ clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 ${pct(crop.y, base.height)},${pct(crop.x, base.width)} ${pct(crop.y, base.height)},${pct(crop.x, base.width)} ${pct(crop.y + crop.h, base.height)},${pct(crop.x + crop.w, base.width)} ${pct(crop.y + crop.h, base.height)},${pct(crop.x + crop.w, base.width)} ${pct(crop.y, base.height)},0 ${pct(crop.y, base.height)})` }} />
              <div
                onPointerDown={onCropDown('move')}
                className="absolute cursor-move border-2 border-dashed border-white outline outline-2 outline-ink"
                style={{ left: pct(crop.x, base.width), top: pct(crop.y, base.height), width: pct(crop.w, base.width), height: pct(crop.h, base.height) }}
              >
                {['tl', 'tr', 'bl', 'br'].map((c) => (
                  <span
                    key={c}
                    onPointerDown={onCropDown(c)}
                    className="absolute size-6 rounded-full border-2 border-ink bg-sun"
                    style={{ [c.includes('t') ? 'top' : 'bottom']: -12, [c.includes('l') ? 'left' : 'right']: -12, cursor: c === 'tl' || c === 'br' ? 'nwse-resize' : 'nesw-resize' }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Btn onClick={reset}>Ganti gambar</Btn>
            <Btn onClick={() => setCrop({ x: 0, y: 0, w: base.width, h: base.height })}>
              <RefreshCcw className="size-4" /> Reset crop
            </Btn>
            <Btn variant="primary" className="ml-auto" onClick={applyCrop}>
              Lanjut
            </Btn>
          </div>
        </Card>
      )}

      {step === 'bg' && (
        <Card className="p-4">
          <div className="grid gap-4 md:grid-cols-[1fr_260px]">
            <div className="checker flex min-h-[260px] items-center justify-center overflow-hidden rounded-xl border-2 border-ink p-2">
              <canvas
                ref={displayRef}
                className={`max-h-[55vh] max-w-full touch-none ${tool !== 'none' ? 'cursor-crosshair' : ''}`}
                onPointerDown={onBrush}
                onPointerMove={onBrush}
                onPointerUp={() => (brushing.current = false)}
                onPointerCancel={() => (brushing.current = false)}
              />
            </div>
            <div className="space-y-3">
              {hadAlpha && <div className="rounded-lg bg-[#d8f5e3] px-3 py-2 text-xs font-bold text-good">Gambar sudah transparan — background tidak perlu dihapus.</div>}
              <label className="flex items-center justify-between rounded-xl border-2 border-ink bg-paper px-3 py-2 font-bold">
                <span className="flex items-center gap-2">
                  <Wand2 className="size-4" /> Remove Background
                </span>
                <input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} className="size-5 accent-[var(--color-kite)]" />
              </label>
              {removeBg && (
                <>
                  <label className="block text-sm font-bold">
                    Toleransi warna: {tol}
                    <input type="range" min={8} max={110} value={tol} onChange={(e) => setTol(+e.target.value)} className="w-full" />
                  </label>
                  <label className="flex items-center gap-2 text-sm font-bold">
                    <input type="checkbox" checked={keepMain} onChange={(e) => setKeepMain(e.target.checked)} className="size-4 accent-[var(--color-kite)]" />
                    Hanya objek utama (buang noda kecil)
                  </label>
                </>
              )}
              <div>
                <div className="mb-1 text-sm font-bold">Kuas manual</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ['none', Hand, 'Lihat'],
                      ['erase', Eraser, 'Hapus'],
                      ['restore', Paintbrush, 'Pulihkan'],
                    ] as const
                  ).map(([id, Icon, label]) => (
                    <button key={id} onClick={() => setTool(id)} className={`flex flex-col items-center rounded-lg border-2 py-1.5 text-xs font-bold ${tool === id ? 'border-ink bg-ink text-white' : 'border-ink/20 bg-white'}`}>
                      <Icon className="size-4" /> {label}
                    </button>
                  ))}
                </div>
                {tool !== 'none' && (
                  <label className="mt-2 block text-xs font-bold">
                    Ukuran kuas: {brushSize}px
                    <input type="range" min={4} max={60} value={brushSize} onChange={(e) => setBrushSize(+e.target.value)} className="w-full" />
                  </label>
                )}
              </div>
              <div className="flex gap-2">
                <Btn onClick={() => setStep('crop')}>Kembali</Btn>
                <Btn variant="primary" className="flex-1" onClick={runCheck}>
                  Periksa & Lanjut
                </Btn>
              </div>
            </div>
          </div>
        </Card>
      )}

      {step === 'check' && (
        <Card className="p-4">
          {checking ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Loader2 className="size-8 animate-spin text-kite" />
              <div className="font-bold">Memeriksa apakah gambar adalah layangan…</div>
              <div className="text-xs text-muted">Deteksi objek AI berjalan di perangkatmu (pertama kali bisa beberapa detik).</div>
            </div>
          ) : (
            report && (
              <div className="flex flex-col items-center gap-3 sm:flex-row">
                <div className="checker grid size-40 shrink-0 place-items-center rounded-xl border-2 border-ink">
                  {report.url && <img src={report.url} alt="Hasil" className="max-h-36 max-w-36" />}
                </div>
                <div className="flex-1">
                  <div className={`flex items-center gap-2 font-display text-2xl font-extrabold ${report.accepted ? 'text-good' : 'text-bad'}`}>
                    {report.accepted ? <CheckCircle2 className="size-7" /> : <XCircle className="size-7" />}
                    {report.accepted ? 'Layangan diterima!' : 'Gambar ditolak'}
                  </div>
                  <p className="text-sm font-semibold text-ink-soft">{report.reason}</p>
                  <div className="mt-1 text-xs text-muted">
                    Simetri {Math.round(report.shape.symmetry * 100)}% · Isi {Math.round(report.shape.fill * 100)}% · AI {report.det.available ? `${Math.round(report.det.kite * 100)}% layangan` : 'tidak tersedia (pakai analisis bentuk)'}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn size="sm" onClick={() => setStep('bg')}>
                      Edit background
                    </Btn>
                    <Btn size="sm" onClick={() => setStep('crop')}>
                      Crop ulang
                    </Btn>
                    <Btn size="sm" onClick={reset}>
                      Ganti gambar
                    </Btn>
                  </div>
                </div>
              </div>
            )
          )}
        </Card>
      )}
    </div>
  );
}
