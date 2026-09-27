import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Trophy, Skull, Swords, Scissors, Lock, UserPlus, Award } from 'lucide-react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import type { Avatar, Kite } from '../lib/types';
import { ACHIEVEMENTS, AVATAR_COLORS, AVATAR_HATS, AVATAR_SKINS } from '../shared/gameData';
import { AvatarBadge } from '../components/AvatarBadge';
import { KiteCanvas } from '../components/KiteCanvas';
import { Btn, Card, Modal, Screen, Spinner, useToast, errMsg } from '../components/ui';

interface Prof {
  id: number;
  username: string;
  avatar: Avatar;
  wins: number;
  losses: number;
  matches: number;
  cuts: number;
  selectedKite: number | null;
  kites: Kite[];
  achievements: { code: string; unlocked_at: string }[];
  online: boolean;
  isSelf: boolean;
  createdAt: string;
}

const HAT_LABEL: Record<string, string> = { none: 'Tanpa', caping: 'Caping', peci: 'Peci', cap: 'Topi', bandana: 'Bandana' };

export default function ProfilePage() {
  const { username } = useParams();
  const toast = useToast();
  const { refresh } = useSession();
  const [p, setP] = useState<Prof | null>(null);
  const [err, setErr] = useState('');
  const [editAv, setEditAv] = useState<Avatar | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    api<Prof>('profile', username ? { username } : {})
      .then(setP)
      .catch((e) => setErr(errMsg(e)));
  useEffect(() => {
    setP(null);
    setErr('');
    load();
  }, [username]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveAvatar = async () => {
    if (!editAv) return;
    setSaving(true);
    try {
      await api('me/avatar', { avatar: editAv });
      setEditAv(null);
      await load();
      refresh();
    } catch (e) {
      toast(errMsg(e), 'bad');
    } finally {
      setSaving(false);
    }
  };

  const addFriend = async () => {
    try {
      await api('friends/request', { username: p?.username });
      toast('Permintaan pertemanan dikirim', 'good');
    } catch (e) {
      toast(errMsg(e), 'bad');
    }
  };
  const challenge = async () => {
    try {
      await api('invites/send', { playerId: p?.id, mapId: 'any' });
      toast('Tantangan dikirim!', 'good');
    } catch (e) {
      toast(errMsg(e), 'bad');
    }
  };

  if (err)
    return (
      <Screen title="Profile">
        <Card className="p-6 text-center font-bold">{err}</Card>
      </Screen>
    );
  if (!p)
    return (
      <Screen title="Profile">
        <Spinner />
      </Screen>
    );

  const have = new Set(p.achievements.map((a) => a.code));
  const stats = [
    { icon: Trophy, label: 'Total Wins', value: p.wins, color: 'text-sun' },
    { icon: Skull, label: 'Total Losses', value: p.losses, color: 'text-kite' },
    { icon: Swords, label: 'Total Matches', value: p.matches, color: 'text-ink' },
    { icon: Scissors, label: 'Tali Diputus', value: p.cuts, color: 'text-sea' },
  ];

  return (
    <Screen title="Profile" back={username ? '/friends' : '/'}>
      <Card className="mb-5 flex flex-wrap items-center gap-4 p-5">
        <AvatarBadge avatar={p.avatar} size={84} online={p.isSelf ? undefined : p.online} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-3xl font-extrabold">{p.username}</div>
          <div className="text-sm font-semibold text-muted">Bergabung {new Date(p.createdAt).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</div>
        </div>
        {p.isSelf ? (
          <Btn onClick={() => setEditAv({ ...p.avatar })}>Ubah Avatar</Btn>
        ) : (
          <div className="flex gap-2">
            <Btn onClick={addFriend}>
              <UserPlus className="size-4" /> Add
            </Btn>
            <Btn variant="primary" disabled={!p.online} onClick={challenge}>
              <Swords className="size-4" /> Tantang
            </Btn>
          </div>
        )}
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border-2 border-ink bg-white p-3 text-center shadow-[var(--shadow-hard-sm)]">
            <s.icon className={`mx-auto size-6 ${s.color}`} />
            <div className="font-display text-3xl font-extrabold">{s.value}</div>
            <div className="text-xs font-bold uppercase text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <h2 className="mb-2 font-display text-xl font-bold">Layangan dimiliki ({p.kites.length})</h2>
      <div className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {p.kites.map((k) => (
          <div key={k.id} className={`overflow-hidden rounded-xl border-2 border-ink bg-white ${p.selectedKite === k.id ? 'ring-4 ring-kite/40' : ''}`}>
            <KiteCanvas kite={k} width={140} height={110} sky string={false} className="block w-full" />
            <div className="truncate px-2 py-1 text-xs font-bold">{k.name}</div>
          </div>
        ))}
      </div>

      <h2 className="mb-2 font-display text-xl font-bold">
        Achievement ({have.size}/{ACHIEVEMENTS.length})
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {ACHIEVEMENTS.map((a) => {
          const ok = have.has(a.code);
          return (
            <div key={a.code} className={`flex items-center gap-3 rounded-xl border-2 p-3 ${ok ? 'border-ink bg-white shadow-[var(--shadow-hard-sm)]' : 'border-ink/20 bg-white/50'}`}>
              <div className={`grid size-11 shrink-0 place-items-center rounded-full border-2 ${ok ? 'border-ink bg-sun' : 'border-ink/20 bg-paper text-muted'}`}>
                {ok ? <Award className="size-6" /> : <Lock className="size-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className={`font-bold ${ok ? '' : 'text-muted'}`}>{a.name}</div>
                <div className="text-xs text-muted">
                  {a.desc} · +{a.reward} Coins
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={!!editAv} onClose={() => setEditAv(null)} title="Ubah Avatar">
        {editAv && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <AvatarBadge avatar={editAv} size={110} />
            </div>
            <div>
              <div className="mb-1 text-sm font-bold">Warna baju</div>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((c) => (
                  <button key={c} onClick={() => setEditAv({ ...editAv, color: c })} className={`size-9 rounded-full border-2 ${editAv.color === c ? 'border-ink ring-2 ring-kite' : 'border-ink/30'}`} style={{ background: c }} aria-label={c} />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-sm font-bold">Warna kulit</div>
              <div className="flex gap-2">
                {AVATAR_SKINS.map((c) => (
                  <button key={c} onClick={() => setEditAv({ ...editAv, skin: c })} className={`size-9 rounded-full border-2 ${editAv.skin === c ? 'border-ink ring-2 ring-kite' : 'border-ink/30'}`} style={{ background: c }} aria-label={c} />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-sm font-bold">Topi</div>
              <div className="flex flex-wrap gap-2">
                {AVATAR_HATS.map((h) => (
                  <button key={h} onClick={() => setEditAv({ ...editAv, hat: h })} className={`rounded-lg border-2 px-3 py-1.5 text-sm font-bold ${editAv.hat === h ? 'border-ink bg-ink text-white' : 'border-ink/30 bg-white'}`}>
                    {HAT_LABEL[h]}
                  </button>
                ))}
              </div>
            </div>
            <Btn variant="primary" className="w-full" loading={saving} onClick={saveAvatar}>
              Simpan Avatar
            </Btn>
          </div>
        )}
      </Modal>
    </Screen>
  );
}
