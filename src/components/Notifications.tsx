import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Check, X } from 'lucide-react';
import { useSession } from '../lib/session';
import { api } from '../lib/api';
import { audio } from '../lib/audio';
import { AvatarBadge } from './AvatarBadge';
import { useToast, errMsg } from './ui';

/** Global realtime notifications: invites/challenges + auto-join when a battle starts. */
export function Notifications() {
  const { hb, pollNow } = useSession();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<number | null>(null);
  const seen = useRef<Set<number>>(new Set());

  const inArena = loc.pathname.startsWith('/arena/');

  // Auto-join: a battle was created for me (e.g. my invite was accepted, or matchmaking paired me)
  useEffect(() => {
    const m = hb?.activeMatch;
    if (m && m.mode === 'battle' && m.phase !== 'ended' && !loc.pathname.startsWith(`/arena/${m.id}`)) {
      nav(`/arena/${m.id}`);
    }
  }, [hb?.activeMatch?.id, hb?.activeMatch?.phase, loc.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const invites = (hb?.invites || []).filter((i) => !dismissed.has(i.id));

  useEffect(() => {
    for (const i of invites) {
      if (!seen.current.has(i.id)) {
        seen.current.add(i.id);
        audio.coin();
      }
    }
  }, [invites]);

  const respond = async (id: number, accept: boolean) => {
    setBusy(id);
    try {
      const r = await api<{ matchId: string | null }>('invites/respond', { inviteId: id, accept });
      setDismissed((d) => new Set(d).add(id));
      if (r.matchId) nav(`/arena/${r.matchId}`);
      pollNow();
    } catch (e) {
      toast(errMsg(e), 'bad');
      setDismissed((d) => new Set(d).add(id));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`fixed z-[60] flex w-[min(360px,calc(100vw-24px))] flex-col gap-2 ${inArena ? 'left-3 top-16' : 'bottom-3 right-3'}`}>
      <AnimatePresence>
        {invites.map((i) => (
          <motion.div
            key={i.id}
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 60, opacity: 0 }}
            className="rounded-2xl border-2 border-ink bg-white p-3 shadow-[var(--shadow-hard)]"
          >
            <div className="flex items-center gap-3">
              <AvatarBadge avatar={i.from.avatar} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-kite">
                  <Swords className="size-3.5" /> {i.kind === 'friend' ? 'Undangan teman' : 'Tantangan'}
                </div>
                <div className="truncate font-bold">{i.from.name} mengajak adu layangan</div>
                <div className="text-xs text-muted">Map: {i.mapId}</div>
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                disabled={busy === i.id || inArena}
                onClick={() => respond(i.id, true)}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl border-2 border-ink bg-kite py-2 font-bold text-white disabled:opacity-50"
              >
                <Check className="size-4" /> Terima
              </button>
              <button
                disabled={busy === i.id}
                onClick={() => respond(i.id, false)}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl border-2 border-ink bg-white py-2 font-bold"
              >
                <X className="size-4" /> Tolak
              </button>
            </div>
            {inArena && <div className="mt-1 text-center text-xs text-muted">Keluar dari arena untuk menerima</div>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
