import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Brush, Images, Users, Store, Backpack, UserRound, Settings, Crown, LogOut, Gift, Trophy, Skull, Megaphone, Sparkles } from 'lucide-react';
import { useSession } from '../lib/session';
import { api } from '../lib/api';
import { audio } from '../lib/audio';
import { AvatarBadge } from '../components/AvatarBadge';
import { KiteCanvas } from '../components/KiteCanvas';
import { Btn, CoinBadge, useToast, errMsg } from '../components/ui';

const MENU = [
  { to: '/create', label: 'Create Kite', icon: Brush, color: 'bg-sun' },
  { to: '/kites', label: 'My Kites', icon: Images, color: 'bg-[#ffd6c9]' },
  { to: '/friends', label: 'Friends', icon: Users, color: 'bg-[#cfeee9]' },
  { to: '/shop', label: 'Shop', icon: Store, color: 'bg-[#d8e6ff]' },
  { to: '/inventory', label: 'Inventory', icon: Backpack, color: 'bg-[#f1e0ff]' },
  { to: '/profile', label: 'Profile', icon: UserRound, color: 'bg-[#ffe7a8]' },
  { to: '/settings', label: 'Settings', icon: Settings, color: 'bg-white' },
];

export default function Lobby() {
  const { me, hb, logout, setCoins, refresh } = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const [claiming, setClaiming] = useState(false);
  if (!me) return null;

  const claimDaily = async () => {
    setClaiming(true);
    try {
      const r = await api<{ amount: number; coins: number }>('daily/claim');
      setCoins(r.coins);
      audio.coin();
      toast(`+${r.amount} Coins daily reward!`, 'good');
      refresh();
    } catch (e) {
      toast(errMsg(e), 'bad');
    } finally {
      setClaiming(false);
    }
  };

  const claimEvent = async (id: number) => {
    try {
      const r = await api<{ amount: number; coins: number }>('events/claim', { eventId: id });
      setCoins(r.coins);
      audio.coin();
      toast(`+${r.amount} Coins bonus event!`, 'good');
    } catch (e) {
      toast(errMsg(e), 'bad');
    }
  };

  const winRate = me.matches ? Math.round((me.wins / me.matches) * 100) : 0;
  const inv = me.inventory.find((i) => i.item_id === me.equippedThread);

  return (
    <div className="sky-bg min-h-full">
      <div className="bunting" />
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-4">
        {/* top bar */}
        <div className="mb-4 flex items-center gap-3">
          <h1 className="font-display text-3xl font-extrabold leading-none sm:text-4xl">
            Layangan<span className="text-kite"> Battle</span>
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <CoinBadge value={me.coins} />
            <button onClick={logout} className="grid size-10 place-items-center rounded-xl border-2 border-ink bg-white shadow-[var(--shadow-hard-sm)]" aria-label="Logout" title="Logout">
              <LogOut className="size-5" />
            </button>
          </div>
        </div>

        {hb?.announcements?.[0] && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border-2 border-ink bg-ink px-4 py-2.5 text-sm font-semibold text-white">
            <Megaphone className="mt-0.5 size-4 shrink-0 text-sun" />
            <span>{hb.announcements[0].text}</span>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr]">
          {/* player card */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl border-2 border-ink bg-white shadow-[var(--shadow-hard)]">
            <div className="relative h-56 overflow-hidden bg-gradient-to-b from-[#8fd3ff] to-[#e7f6ff] sm:h-64">
              <div className="absolute inset-x-0 bottom-0 h-10 bg-[#8bc48a]" />
              <div className="absolute inset-x-0 bottom-10 h-6 rounded-t-[50%] bg-[#a6d49a]" />
              <div className="absolute left-1/2 top-2 -translate-x-1/2">
                <KiteCanvas kite={me.selectedKite} width={260} height={220} />
              </div>
              <div className="absolute left-3 top-3 rounded-full border-2 border-ink bg-white/90 px-3 py-1 text-xs font-bold">
                Layangan aktif: {me.selectedKite?.name || '—'}
              </div>
            </div>
            <div className="flex items-center gap-4 p-4">
              <AvatarBadge avatar={me.avatar} size={64} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-2xl font-extrabold leading-tight">{me.username}</div>
                <div className="text-sm font-semibold text-muted">
                  Benang: {inv ? `${me.equippedThread} ×${inv.qty}` : 'Benang Kasur (gratis)'}
                </div>
              </div>
              {me.isOwner && (
                <Link to="/owner" className="flex items-center gap-1 rounded-xl border-2 border-ink bg-ink px-3 py-2 text-sm font-bold text-sun">
                  <Crown className="size-4" /> Owner Panel
                </Link>
              )}
            </div>
            <div className="grid grid-cols-3 border-t-2 border-ink text-center">
              <div className="p-3">
                <Trophy className="mx-auto size-5 text-sun" />
                <div className="font-display text-2xl font-extrabold">{me.wins}</div>
                <div className="text-xs font-bold uppercase text-muted">Menang</div>
              </div>
              <div className="border-x-2 border-ink p-3">
                <Skull className="mx-auto size-5 text-kite" />
                <div className="font-display text-2xl font-extrabold">{me.losses}</div>
                <div className="text-xs font-bold uppercase text-muted">Kalah</div>
              </div>
              <div className="p-3">
                <Sparkles className="mx-auto size-5 text-sea" />
                <div className="font-display text-2xl font-extrabold">{winRate}%</div>
                <div className="text-xs font-bold uppercase text-muted">Win rate</div>
              </div>
            </div>
          </motion.div>

          {/* menu */}
          <div className="flex flex-col gap-4">
            <motion.button
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              onClick={() => {
                audio.unlock();
                audio.click();
                nav('/play');
              }}
              className="group relative flex items-center gap-4 overflow-hidden rounded-3xl border-2 border-ink bg-kite px-6 py-6 text-left text-white shadow-[var(--shadow-hard)] transition active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
            >
              <span className="grid size-16 place-items-center rounded-2xl border-2 border-ink bg-white text-kite">
                <Play className="size-8 fill-current" />
              </span>
              <span>
                <span className="block font-display text-4xl font-extrabold leading-none">PLAY</span>
                <span className="text-sm font-semibold text-white/85">Cari lawan, terbang bebas, atau tantang teman</span>
              </span>
              <span className="absolute -right-6 -top-6 size-28 rotate-45 border-2 border-white/30" />
            </motion.button>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
              {MENU.map((m, i) => (
                <motion.div key={m.to} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.03 }}>
                  <Link
                    to={m.to}
                    onClick={() => audio.click()}
                    className={`relative flex h-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-ink p-3 text-center shadow-[var(--shadow-hard-sm)] transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${m.color}`}
                  >
                    <m.icon className="size-7" strokeWidth={2.2} />
                    <span className="text-xs font-extrabold uppercase tracking-wide">{m.label}</span>
                    {m.to === '/friends' && (hb?.friendRequests || 0) > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full border-2 border-ink bg-kite text-xs font-bold text-white">{hb?.friendRequests}</span>
                    )}
                  </Link>
                </motion.div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-white p-3 shadow-[var(--shadow-hard-sm)]">
                <Gift className="size-8 shrink-0 text-kite" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold">Daily Reward</div>
                  <div className="text-xs text-muted">Klaim Coins gratis setiap hari</div>
                </div>
                <Btn size="sm" variant={me.dailyAvailable ? 'primary' : 'paper'} disabled={!me.dailyAvailable} loading={claiming} onClick={claimDaily}>
                  {me.dailyAvailable ? 'Klaim' : 'Besok'}
                </Btn>
              </div>
              {(hb?.events || []).slice(0, 1).map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-sun p-3 shadow-[var(--shadow-hard-sm)]">
                  <Sparkles className="size-8 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{ev.name}</div>
                    <div className="truncate text-xs">
                      {ev.coin_mul !== 1 && `Coins ×${ev.coin_mul} `}
                      {ev.wind_mul !== 1 && `Angin ×${ev.wind_mul} `}
                      {ev.description}
                    </div>
                  </div>
                  {ev.claim_bonus > 0 && (
                    <Btn size="sm" variant="dark" onClick={() => claimEvent(ev.id)}>
                      +{ev.claim_bonus}
                    </Btn>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
