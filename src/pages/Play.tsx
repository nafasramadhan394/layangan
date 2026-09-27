import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Wind, Users, Send, Feather, Loader2, ArrowRight, ArrowLeft as ArrowL, Shuffle } from 'lucide-react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { mapThumb } from '../lib/mapThumbs';
import type { MapDef } from '../lib/types';
import { Btn, Card, Screen, Spinner, inputCls, useToast, errMsg } from '../components/ui';

export default function PlayPage() {
  const nav = useNavigate();
  const toast = useToast();
  const { hb } = useSession();
  const [maps, setMaps] = useState<MapDef[] | null>(null);
  const [sel, setSel] = useState<string>('any');
  const [searching, setSearching] = useState(false);
  const [searchCount, setSearchCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [rooms, setRooms] = useState<{ id: string; map_id: string; n: number }[]>([]);
  const [challenge, setChallenge] = useState('');
  const [busy, setBusy] = useState('');
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    api<{ maps: MapDef[] }>('maps/list')
      .then((r) => setMaps(r.maps))
      .catch((e) => toast(errMsg(e), 'bad'));
    const loadRooms = () => api<{ rooms: typeof rooms }>('free/rooms').then((r) => setRooms(r.rooms)).catch(() => {});
    loadRooms();
    const t = window.setInterval(loadRooms, 6000);
    return () => window.clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!searching) return;
    const started = Date.now();
    const tick = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    const poll = async () => {
      try {
        const r = await api<{ matched: string | null; searching?: number; inQueue?: boolean }>('mm/poll');
        if (r.matched) {
          setSearching(false);
          nav(`/arena/${r.matched}`);
          return;
        }
        setSearchCount(r.searching || 0);
        if (r.inQueue === false) {
          await api('mm/join', { mapId: sel });
        }
      } catch (e) {
        toast(errMsg(e), 'bad');
      }
      pollRef.current = window.setTimeout(poll, 1500);
    };
    pollRef.current = window.setTimeout(poll, 800);
    return () => {
      window.clearInterval(tick);
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, [searching]); // eslint-disable-line react-hooks/exhaustive-deps

  const startSearch = async () => {
    setBusy('mm');
    try {
      const r = await api<{ matched: string | null; searching?: number }>('mm/join', { mapId: sel });
      if (r.matched) return nav(`/arena/${r.matched}`);
      setSearchCount(r.searching || 1);
      setElapsed(0);
      setSearching(true);
    } catch (e) {
      toast(errMsg(e), 'bad');
    } finally {
      setBusy('');
    }
  };

  const cancelSearch = async () => {
    setSearching(false);
    await api('mm/leave').catch(() => {});
  };

  const joinFree = async (roomId?: string) => {
    setBusy(roomId || 'free');
    try {
      const mapId = sel === 'any' ? maps?.[Math.floor(Math.random() * (maps?.length || 1))]?.id : sel;
      const r = await api<{ matchId: string }>('free/join', roomId ? { roomId } : { mapId });
      nav(`/arena/${r.matchId}`);
    } catch (e) {
      toast(errMsg(e), 'bad');
    } finally {
      setBusy('');
    }
  };

  const sendChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge.trim()) return;
    setBusy('ch');
    try {
      await api('invites/send', { username: challenge.trim(), mapId: sel });
      toast(`Tantangan dikirim ke ${challenge.trim()}. Menunggu jawaban…`, 'good');
      setChallenge('');
    } catch (e) {
      toast(errMsg(e), 'bad');
    } finally {
      setBusy('');
    }
  };

  const selMap = maps?.find((m) => m.id === sel);
  const mapName = (id: string) => maps?.find((m) => m.id === id)?.name || id;

  return (
    <Screen title="Play" wide>
      <h2 className="mb-2 font-display text-xl font-bold">1. Pilih map</h2>
      {!maps ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <button
            onClick={() => setSel('any')}
            className={`flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-ink bg-white p-3 text-center transition ${sel === 'any' ? 'shadow-[var(--shadow-hard)] ring-4 ring-kite/40' : 'opacity-80'}`}
          >
            <Shuffle className="size-8" />
            <span className="font-display text-lg font-bold">Acak</span>
            <span className="text-xs text-muted">Lebih cepat dapat lawan</span>
          </button>
          {maps.map((m) => (
            <button
              key={m.id}
              onClick={() => setSel(m.id)}
              className={`overflow-hidden rounded-2xl border-2 border-ink bg-white text-left transition ${sel === m.id ? 'shadow-[var(--shadow-hard)] ring-4 ring-kite/40' : 'opacity-85 hover:opacity-100'}`}
            >
              <img src={mapThumb(m)} alt={m.name} className="aspect-[16/7] w-full object-cover object-bottom" />
              <div className="p-2">
                <div className="font-display text-base font-bold leading-tight">{m.name}</div>
                <div className="flex items-center gap-1 text-xs font-semibold text-muted">
                  <Wind className="size-3" /> {Math.round(m.windBase / 10)} km/j
                  {m.windDir > 0 ? <ArrowRight className="size-3" /> : <ArrowL className="size-3" />}
                  · gust {Math.round(m.gust * 100)}%
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {selMap && <p className="mt-2 text-sm font-semibold text-ink-soft">{selMap.description}</p>}

      <h2 className="mb-2 mt-6 font-display text-xl font-bold">2. Pilih mode</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-kite">
            <Swords className="size-6" />
            <h3 className="font-display text-2xl font-extrabold text-ink">Adu Layangan</h3>
          </div>
          <p className="mb-4 mt-1 text-sm text-ink-soft">
            Matchmaking otomatis 2–4 pemain. Potong tali lawan dengan gesekan benangmu. Pemain terakhir yang bertahan menang & dapat Coins.
          </p>
          <Btn variant="primary" size="lg" className="w-full" loading={busy === 'mm'} onClick={startSearch}>
            Cari Lawan
          </Btn>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sea">
            <Feather className="size-6" />
            <h3 className="font-display text-2xl font-extrabold text-ink">Terbang Bebas</h3>
          </div>
          <p className="mb-4 mt-1 text-sm text-ink-soft">Room publik hingga 8 pemain. Latihan, ngobrol lewat layangan, dan tantang pemain di room.</p>
          <Btn variant="sea" size="lg" className="w-full" loading={busy === 'free'} onClick={() => joinFree()}>
            Masuk Room {sel === 'any' ? '' : mapName(sel)}
          </Btn>
          {rooms.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="text-xs font-bold uppercase text-muted">Room aktif</div>
              {rooms.slice(0, 5).map((r) => (
                <button key={r.id} onClick={() => joinFree(r.id)} className="flex w-full items-center justify-between rounded-lg border-2 border-ink/20 bg-paper px-3 py-1.5 text-sm font-semibold hover:border-ink">
                  <span>{mapName(r.map_id)}</span>
                  <span className="flex items-center gap-1 text-muted">
                    {busy === r.id ? <Loader2 className="size-3.5 animate-spin" /> : <Users className="size-3.5" />} {r.n}/8
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="font-display text-xl font-extrabold">Tantang Pemain</h3>
          <p className="mb-3 text-sm text-ink-soft">Kirim tantangan langsung ke pemain yang sedang online.</p>
          <form onSubmit={sendChallenge} className="flex gap-2">
            <input className={inputCls} placeholder="username lawan" value={challenge} onChange={(e) => setChallenge(e.target.value)} maxLength={16} />
            <Btn variant="dark" loading={busy === 'ch'} type="submit">
              <Send className="size-4" />
            </Btn>
          </form>
          {(hb?.outgoing || []).slice(0, 3).map((o) => (
            <div key={o.id} className="mt-2 flex items-center justify-between rounded-lg bg-paper px-3 py-1.5 text-sm">
              <span className="font-semibold">{o.to}</span>
              <span className={`text-xs font-bold uppercase ${o.status === 'rejected' ? 'text-bad' : o.status === 'accepted' ? 'text-good' : 'text-muted'}`}>
                {o.status === 'pending' ? 'menunggu…' : o.status === 'rejected' ? 'ditolak' : o.status === 'accepted' ? 'diterima' : o.status}
              </span>
            </div>
          ))}
        </Card>
        <Card className="p-5">
          <h3 className="font-display text-xl font-extrabold">Main dengan Teman</h3>
          <p className="mb-3 text-sm text-ink-soft">Undang teman ke adu layangan, atau gabung ke room tempat temanmu sedang terbang.</p>
          <Link to="/friends" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-ink bg-sun px-4 py-2.5 font-bold shadow-[var(--shadow-hard-sm)]">
            <Users className="size-4" /> Buka Friends & Invite
          </Link>
        </Card>
      </div>

      <AnimatePresence>
        {searching && (
          <motion.div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="w-full max-w-sm rounded-3xl border-2 border-ink bg-paper p-6 text-center shadow-[var(--shadow-hard)]">
              <div className="mx-auto mb-3 grid size-20 place-items-center rounded-full border-2 border-ink bg-sky">
                <Wind className="size-10 animate-pulse text-sky-deep" />
              </div>
              <div className="font-display text-3xl font-extrabold">Mencari lawan…</div>
              <div className="mt-1 text-sm font-semibold text-ink-soft">
                Map: {sel === 'any' ? 'Acak' : mapName(sel)} · {elapsed}s
              </div>
              <div className="mt-1 text-sm text-muted">{searchCount} pemain sedang mencari pertandingan</div>
              <p className="mt-3 text-xs text-muted">Tip: ajak teman lewat menu Friends agar langsung satu arena.</p>
              <Btn className="mt-4 w-full" onClick={cancelSearch}>
                Batal
              </Btn>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Screen>
  );
}
