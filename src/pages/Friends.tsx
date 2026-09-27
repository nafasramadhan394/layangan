import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Check, X, Swords, LogIn, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import type { Avatar, MapDef } from '../lib/types';
import { AvatarBadge } from '../components/AvatarBadge';
import { Btn, Card, Modal, Screen, Spinner, inputCls, useToast, errMsg } from '../components/ui';

interface Friend {
  friendshipId: number;
  id: number;
  username: string;
  avatar: Avatar;
  online: boolean;
  wins: number;
  losses: number;
  status: 'online' | 'offline' | 'free' | 'battle';
  room: string | null;
  roomMap: string | null;
}

const STATUS: Record<Friend['status'], string> = { online: 'Online', offline: 'Offline', free: 'Terbang bebas', battle: 'Sedang bertanding' };

export default function FriendsPage() {
  const toast = useToast();
  const nav = useNavigate();
  const { hb } = useSession();
  const [data, setData] = useState<{ friends: Friend[]; incoming: Friend[]; outgoing: Friend[] } | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');
  const [inviteTo, setInviteTo] = useState<Friend | null>(null);
  const [maps, setMaps] = useState<MapDef[]>([]);

  const load = () => api('friends/list').then(setData).catch((e) => toast(errMsg(e), 'bad'));
  useEffect(() => {
    load();
    api<{ maps: MapDef[] }>('maps/list').then((r) => setMaps(r.maps)).catch(() => {});
    const t = window.setInterval(load, 5000);
    return () => window.clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy('add');
    try {
      const r = await api<{ accepted: boolean }>('friends/request', { username: name.trim() });
      toast(r.accepted ? 'Kalian sekarang berteman!' : 'Permintaan pertemanan dikirim', 'good');
      setName('');
      load();
    } catch (e) {
      toast(errMsg(e), 'bad');
    } finally {
      setBusy('');
    }
  };

  const respond = async (f: Friend, accept: boolean) => {
    setBusy('r' + f.friendshipId);
    try {
      await api('friends/respond', { friendshipId: f.friendshipId, accept });
      load();
    } catch (e) {
      toast(errMsg(e), 'bad');
    } finally {
      setBusy('');
    }
  };

  const remove = async (f: Friend) => {
    if (!confirm(`Hapus ${f.username} dari daftar teman?`)) return;
    await api('friends/remove', { friendshipId: f.friendshipId }).catch((e) => toast(errMsg(e), 'bad'));
    load();
  };

  const invite = async (mapId: string) => {
    if (!inviteTo) return;
    setBusy('inv');
    try {
      await api('invites/send', { friendId: inviteTo.id, mapId });
      toast(`Undangan dikirim ke ${inviteTo.username}. Kamu akan masuk arena otomatis saat diterima.`, 'good');
      setInviteTo(null);
    } catch (e) {
      toast(errMsg(e), 'bad');
    } finally {
      setBusy('');
    }
  };

  const joinRoom = async (f: Friend) => {
    setBusy('j' + f.id);
    try {
      const r = await api<{ matchId: string }>('free/join', { roomId: f.room });
      nav(`/arena/${r.matchId}`);
    } catch (e) {
      toast(errMsg(e), 'bad');
    } finally {
      setBusy('');
    }
  };

  const sorted = [...(data?.friends || [])].sort((a, b) => Number(b.online) - Number(a.online));
  const pendingOut = (hb?.outgoing || []).filter((o) => o.status === 'pending');

  return (
    <Screen title="Friends">
      <Card className="mb-5 p-4">
        <form onSubmit={add} className="flex gap-2">
          <input className={inputCls} placeholder="Tambah teman dengan username" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
          <Btn variant="primary" type="submit" loading={busy === 'add'}>
            <UserPlus className="size-4" /> <span className="hidden sm:inline">Add Friend</span>
          </Btn>
        </form>
        {pendingOut.length > 0 && <div className="mt-2 text-xs font-semibold text-muted">Undangan menunggu jawaban: {pendingOut.map((o) => o.to).join(', ')}</div>}
      </Card>

      {!data ? (
        <Spinner />
      ) : (
        <div className="space-y-5">
          {data.incoming.length > 0 && (
            <section>
              <h2 className="mb-2 font-display text-xl font-bold">Permintaan masuk</h2>
              <div className="space-y-2">
                {data.incoming.map((f) => (
                  <div key={f.friendshipId} className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-white p-3 shadow-[var(--shadow-hard-sm)]">
                    <AvatarBadge avatar={f.avatar} size={44} />
                    <div className="flex-1 font-bold">{f.username}</div>
                    <Btn size="sm" variant="primary" loading={busy === 'r' + f.friendshipId} onClick={() => respond(f, true)}>
                      <Check className="size-4" /> Terima
                    </Btn>
                    <Btn size="sm" onClick={() => respond(f, false)}>
                      <X className="size-4" />
                    </Btn>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-2 font-display text-xl font-bold">
              Teman ({sorted.length}) · <span className="text-good">{sorted.filter((f) => f.online).length} online</span>
            </h2>
            {sorted.length === 0 && <div className="rounded-2xl border-2 border-dashed border-ink/40 p-6 text-center text-sm text-muted">Belum ada teman. Tambahkan dengan username di atas!</div>}
            <div className="space-y-2">
              {sorted.map((f) => (
                <div key={f.friendshipId} className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-ink bg-white p-3 shadow-[var(--shadow-hard-sm)]">
                  <AvatarBadge avatar={f.avatar} size={44} online={f.online} />
                  <Link to={`/profile/${f.username}`} className="min-w-0 flex-1">
                    <div className="truncate font-bold hover:underline">{f.username}</div>
                    <div className={`text-xs font-semibold ${f.online ? 'text-good' : 'text-muted'}`}>
                      {STATUS[f.status]}
                      {f.roomMap ? ` · ${f.roomMap}` : ''} · {f.wins}W/{f.losses}L
                    </div>
                  </Link>
                  <div className="flex gap-1.5">
                    {f.room && (
                      <Btn size="sm" variant="sea" loading={busy === 'j' + f.id} onClick={() => joinRoom(f)}>
                        <LogIn className="size-4" /> Gabung
                      </Btn>
                    )}
                    <Btn size="sm" variant="primary" disabled={!f.online || f.status === 'battle'} onClick={() => setInviteTo(f)}>
                      <Swords className="size-4" /> Invite
                    </Btn>
                    <Btn size="sm" variant="ghost" onClick={() => remove(f)} aria-label="Hapus teman">
                      <Trash2 className="size-4" />
                    </Btn>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {data.outgoing.length > 0 && (
            <section>
              <h2 className="mb-2 font-display text-lg font-bold text-ink-soft">Permintaan terkirim</h2>
              <div className="flex flex-wrap gap-2">
                {data.outgoing.map((f) => (
                  <span key={f.friendshipId} className="rounded-full border-2 border-ink/30 bg-white px-3 py-1 text-sm font-semibold">
                    {f.username} · menunggu
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <Modal open={!!inviteTo} onClose={() => setInviteTo(null)} title={`Invite ${inviteTo?.username || ''}`}>
        <p className="mb-3 text-sm text-ink-soft">Pilih arena untuk adu layangan:</p>
        <div className="grid grid-cols-2 gap-2">
          {maps.map((m) => (
            <Btn key={m.id} disabled={busy === 'inv'} onClick={() => invite(m.id)}>
              {m.name}
            </Btn>
          ))}
        </div>
      </Modal>
    </Screen>
  );
}
