import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, RotateCcw, RotateCw, LogOut, Wind, Trophy, Skull, Coins, Swords, Wifi, Users } from 'lucide-react';
import { ArenaEngine, type Hud } from '../game/ArenaEngine';
import { useSession } from '../lib/session';
import { api } from '../lib/api';
import { audio } from '../lib/audio';
import type { NetState } from '../lib/types';
import { Btn, useToast, errMsg } from '../components/ui';

function HoldButton({ onChange, children, className = '', label }: { onChange: (down: boolean) => void; children: ReactNode; className?: string; label: string }) {
  const [down, setDown] = useState(false);
  const set = (v: boolean) => {
    setDown(v);
    onChange(v);
  };
  return (
    <button
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        audio.unlock();
        set(true);
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onLostPointerCapture={() => down && set(false)}
      onContextMenu={(e) => e.preventDefault()}
      className={`no-select grid place-items-center rounded-full border-2 border-ink font-display font-extrabold shadow-[var(--shadow-hard-sm)] transition ${down ? 'translate-y-[2px] scale-95 shadow-none brightness-90' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 40 });
  const colors = ['#e63946', '#ffb703', '#1a9e8f', '#3a86ff', '#ff006e'];
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {pieces.map((_, i) => (
        <span
          key={i}
          className="absolute top-0 block h-3 w-2"
          style={{
            left: `${(i * 37) % 100}%`,
            background: colors[i % colors.length],
            animation: `confetti-fall ${2.5 + (i % 5) * 0.4}s linear ${(i % 10) * 0.15}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export default function ArenaPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { me, refresh } = useSession();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ArenaEngine | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [result, setResult] = useState<NetState | null>(null);
  const [banner, setBanner] = useState<{ msg: string; tone: string; k: number } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [showPlayers, setShowPlayers] = useState(false);
  const leftHanded = !!me?.settings.leftHanded;

  useEffect(() => {
    if (!canvasRef.current || !me) return;
    setResult(null);
    setHud(null);
    audio.unlock();
    const eng = new ArenaEngine(canvasRef.current, id, me.id, me.settings, {
      onHud: setHud,
      onToast: (msg, tone = 'info') => setBanner({ msg, tone, k: Date.now() }),
      onEnd: (s) => {
        setResult(s);
        refresh();
      },
      onFatal: (msg) => {
        toast(msg, 'bad');
        nav('/', { replace: true });
      },
    });
    engineRef.current = eng;
    eng.start();
    return () => {
      eng.stop();
      engineRef.current = null;
    };
  }, [id, me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), 2200);
    return () => window.clearTimeout(t);
  }, [banner]);

  const leave = async () => {
    engineRef.current?.stop();
    try {
      await api('match/leave', { matchId: id });
    } catch {
      /* ignore */
    }
    refresh();
    nav('/', { replace: true });
  };

  const onLeaveClick = () => {
    if (hud?.mode === 'battle' && (hud.phase === 'live' || hud.phase === 'countdown')) setConfirmLeave(true);
    else leave();
  };

  const challenge = async (playerId: number) => {
    try {
      await api('invites/send', { playerId, mapId: 'any' });
      toast('Tantangan dikirim!', 'good');
    } catch (e) {
      toast(errMsg(e), 'bad');
    }
  };

  const touch = (p: Partial<{ mx: number; st: number; pull: boolean }>) => engineRef.current?.setTouch(p);

  const windKmh = hud ? Math.round(Math.abs(hud.wind.x) / 10) : 0;
  const mine = result?.result?.find((r) => r.id === me?.id);
  const iWon = result?.winner === me?.id;

  const steerPad = (
    <div className="pointer-events-auto flex items-end gap-2">
      <HoldButton label="Putar kiri" onChange={(d) => touch({ st: d ? -1 : 0 })} className="size-16 bg-white text-ink sm:size-[72px]">
        <RotateCcw className="size-7" />
      </HoldButton>
      <HoldButton label="Putar kanan" onChange={(d) => touch({ st: d ? 1 : 0 })} className="size-16 bg-white text-ink sm:size-[72px]">
        <RotateCw className="size-7" />
      </HoldButton>
      <HoldButton label="Tarik" onChange={(d) => touch({ pull: d })} className="size-24 bg-kite text-xl text-white sm:size-28">
        TARIK
      </HoldButton>
    </div>
  );
  const walkPad = (
    <div className="pointer-events-auto flex items-end gap-2">
      <HoldButton label="Jalan kiri" onChange={(d) => touch({ mx: d ? -1 : 0 })} className="size-14 bg-paper text-ink sm:size-16">
        <ArrowLeft className="size-6" />
      </HoldButton>
      <HoldButton label="Jalan kanan" onChange={(d) => touch({ mx: d ? 1 : 0 })} className="size-14 bg-paper text-ink sm:size-16">
        <ArrowRight className="size-6" />
      </HoldButton>
    </div>
  );

  return (
    <div className="no-select fixed inset-0 overflow-hidden bg-sky">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />

      {/* top HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-2 p-2 sm:p-3" style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
        <div className="pointer-events-auto flex flex-col gap-1.5">
          <div className="flex items-center gap-2 rounded-xl border-2 border-ink bg-white/90 px-2.5 py-1.5 text-sm font-bold shadow-[var(--shadow-hard-sm)]">
            <Wind className={`size-4 ${hud?.wind.gust ? 'animate-pulse text-kite' : 'text-sky-deep'}`} />
            <span className="inline-block transition-transform" style={{ transform: `scaleX(${(hud?.wind.x ?? 1) >= 0 ? 1 : -1})` }}>
              <ArrowRight className="size-4" />
            </span>
            <span>{windKmh} km/j</span>
            <span className="hidden text-muted sm:inline">· {hud?.mapName}</span>
          </div>
          <div className="w-44 space-y-1 rounded-xl border-2 border-ink bg-white/90 p-2 shadow-[var(--shadow-hard-sm)] sm:w-52">
            {(hud?.players || []).slice(0, 8).map((p) => (
              <div key={p.id} className={`text-xs font-bold ${p.alive ? '' : 'opacity-50'}`}>
                <div className="flex items-center justify-between gap-1">
                  <span className={`truncate ${p.me ? 'text-kite' : ''}`}>
                    {p.me ? 'Kamu' : p.name}
                    {p.left ? ' (keluar)' : ''}
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5 text-muted">
                    {p.alive ? `${Math.round(p.hp)}%` : <Skull className="size-3" />} {p.kills > 0 && <span className="text-sea">✂{p.kills}</span>}
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-ink/10">
                  <div className="h-full rounded-full transition-all" style={{ width: `${p.alive ? p.hp : 0}%`, background: p.hp > 50 ? '#2a9d5c' : p.hp > 25 ? '#ffb703' : '#e63946' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto flex flex-col items-center gap-1">
          {hud?.mode === 'battle' && hud.phase === 'live' && (
            <div className="rounded-xl border-2 border-ink bg-ink px-3 py-1 font-display text-xl font-extrabold text-white tabular-nums shadow-[var(--shadow-hard-sm)]">
              {Math.floor(hud.timeLeft / 60)}:{String(hud.timeLeft % 60).padStart(2, '0')}
            </div>
          )}
          {hud?.mode === 'free' && (
            <div className="rounded-xl border-2 border-ink bg-sea px-3 py-1 text-sm font-bold text-white shadow-[var(--shadow-hard-sm)]">Terbang Bebas</div>
          )}
          <AnimatePresence>
            {banner && (
              <motion.div
                key={banner.k}
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`max-w-[60vw] rounded-xl border-2 border-ink px-3 py-1.5 text-center text-sm font-bold shadow-[var(--shadow-hard-sm)] ${banner.tone === 'good' ? 'bg-[#d8f5e3]' : banner.tone === 'bad' ? 'bg-[#ffe0e3]' : 'bg-white'}`}
              >
                {banner.msg}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-1.5">
          <div className="flex gap-1.5">
            {hud?.mode === 'free' && (
              <button onClick={() => setShowPlayers(true)} className="grid size-10 place-items-center rounded-xl border-2 border-ink bg-white shadow-[var(--shadow-hard-sm)]" aria-label="Pemain di room">
                <Users className="size-5" />
              </button>
            )}
            <button onClick={onLeaveClick} className="flex items-center gap-1 rounded-xl border-2 border-ink bg-white px-3 py-2 text-sm font-bold shadow-[var(--shadow-hard-sm)]">
              <LogOut className="size-4" /> Keluar
            </button>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-white/80 px-2 py-0.5 text-[11px] font-bold text-muted">
            <Wifi className="size-3" /> {hud?.ping || '—'} ms
          </div>
        </div>
      </div>

      {/* own status */}
      {hud?.me && hud.phase !== 'ended' && (
        <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+128px)] left-1/2 w-52 -translate-x-1/2 sm:bottom-6">
          <div className="rounded-xl border-2 border-ink bg-white/90 p-2 text-xs font-bold shadow-[var(--shadow-hard-sm)]">
            <div className="flex justify-between">
              <span>Benang {hud.me.eng && <span className="text-kite">· bergesekan!</span>}</span>
              <span>{Math.round(hud.me.hp)}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink/10">
              <div className={`h-full rounded-full ${hud.me.eng ? 'animate-pulse' : ''}`} style={{ width: `${hud.me.alive ? hud.me.hp : 0}%`, background: hud.me.hp > 50 ? '#2a9d5c' : hud.me.hp > 25 ? '#ffb703' : '#e63946' }} />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted">
              <span>Tali: {Math.round(hud.me.L)} / {hud.me.maxLen}</span>
              {!hud.me.alive && hud.mode === 'free' && <span className="text-kite">Respawn {hud.me.respawnIn}s</span>}
            </div>
          </div>
        </div>
      )}

      {/* controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        {leftHanded ? steerPad : walkPad}
        <div className="pointer-events-none mb-1 hidden text-center text-[11px] font-bold text-ink/60 lg:block">
          Keyboard: A/D jalan · ←/→ putar layangan · Spasi/W tarik
        </div>
        {leftHanded ? walkPad : steerPad}
      </div>

      {/* connecting / countdown */}
      <AnimatePresence>
        {(!hud || hud.phase === 'connecting') && (
          <motion.div exit={{ opacity: 0 }} className="absolute inset-0 grid place-items-center bg-sky/70">
            <div className="rounded-2xl border-2 border-ink bg-white px-6 py-4 font-display text-2xl font-bold shadow-[var(--shadow-hard)]">Menghubungkan ke server…</div>
          </motion.div>
        )}
        {hud?.phase === 'countdown' && (
          <motion.div exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="mb-2 rounded-xl border-2 border-ink bg-white px-4 py-1 font-bold shadow-[var(--shadow-hard-sm)]">
                <Swords className="mr-1 inline size-4" /> {hud.players.map((p) => (p.me ? 'Kamu' : p.name)).join(' vs ')}
              </div>
              <motion.div key={hud.countdown} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-[9rem] font-extrabold leading-none text-white [text-shadow:4px_4px_0_#1f1a3d]">
                {hud.countdown > 0 ? hud.countdown : 'GO!'}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* result */}
      {result && result.mode === 'battle' && iWon && <Confetti />}
      <AnimatePresence>
        {result && result.mode === 'battle' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 grid place-items-center bg-ink/60 p-4">
            <motion.div initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-md rounded-3xl border-2 border-ink bg-paper p-6 text-center shadow-[var(--shadow-hard)]">
              <div className={`mx-auto mb-2 grid size-20 place-items-center rounded-full border-2 border-ink ${iWon ? 'bg-sun' : 'bg-[#ffe0e3]'}`}>
                {iWon ? <Trophy className="size-10" /> : <Skull className="size-10 text-kite" />}
              </div>
              <div className="font-display text-5xl font-extrabold">{iWon ? 'MENANG!' : result.winner == null ? 'SERI' : 'KALAH'}</div>
              <div className="text-sm font-semibold text-ink-soft">
                {iWon ? 'Layanganmu bertahan paling akhir.' : result.winner != null ? `Pemenang: ${result.players.find((p) => p.id === result.winner)?.name}` : 'Tidak ada pemenang.'}
              </div>
              <div className="my-4 space-y-2 text-left">
                {(result.result || []).map((r) => (
                  <div key={r.id} className={`flex items-center gap-3 rounded-xl border-2 border-ink px-3 py-2 ${r.win ? 'bg-sun/40' : 'bg-white'}`}>
                    <span className="font-display text-xl font-extrabold">#{r.place}</span>
                    <span className="min-w-0 flex-1 truncate font-bold">
                      {r.id === me?.id ? 'Kamu' : r.name} <span className="text-xs font-semibold text-muted">{r.win ? 'Winner' : 'Loser'}</span>
                    </span>
                    <span className="text-xs text-muted">✂ {r.cuts}</span>
                    <span className="flex items-center gap-1 font-bold">
                      <Coins className="size-4 text-sun" />+{r.coins}
                    </span>
                  </div>
                ))}
              </div>
              {mine && <div className="mb-3 text-sm font-bold text-good">Reward +{mine.coins} Coins sudah masuk ke akunmu.</div>}
              <div className="flex gap-2">
                <Btn className="flex-1" onClick={() => nav('/', { replace: true })}>
                  Ke Lobby
                </Btn>
                <Btn variant="primary" className="flex-1" onClick={() => nav('/play', { replace: true })}>
                  Main Lagi
                </Btn>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* leave confirm */}
      {confirmLeave && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-ink/50 p-4" onClick={() => setConfirmLeave(false)}>
          <div className="w-full max-w-sm rounded-2xl border-2 border-ink bg-paper p-5 text-center shadow-[var(--shadow-hard)]" onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-2xl font-extrabold">Keluar dari pertandingan?</div>
            <p className="mt-1 text-sm text-ink-soft">Keluar saat pertandingan berlangsung dihitung sebagai kalah.</p>
            <div className="mt-4 flex gap-2">
              <Btn className="flex-1" onClick={() => setConfirmLeave(false)}>
                Lanjut main
              </Btn>
              <Btn variant="danger" className="flex-1" onClick={leave}>
                Keluar
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* free room players */}
      {showPlayers && hud && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-ink/50 p-4" onClick={() => setShowPlayers(false)}>
          <div className="w-full max-w-sm rounded-2xl border-2 border-ink bg-paper p-5 shadow-[var(--shadow-hard)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 font-display text-2xl font-extrabold">Pemain di room</div>
            <div className="space-y-2">
              {hud.players.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border-2 border-ink bg-white px-3 py-2">
                  <span className="font-bold">{p.me ? 'Kamu' : p.name}</span>
                  {!p.me && (
                    <Btn size="sm" variant="primary" onClick={() => challenge(p.id)}>
                      <Swords className="size-4" /> Tantang
                    </Btn>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">Tantangan yang diterima akan membawa kalian ke arena adu layangan.</p>
          </div>
        </div>
      )}
    </div>
  );
}
