import { useEffect, useState } from 'react';
import { Crown, Server, Users, Coins, Store, Map as MapIcon, Image as ImageIcon, Megaphone, CalendarClock, RefreshCw, Ban, Trash2, Plus, Power } from 'lucide-react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import type { ItemDef, Kite, MapDef } from '../lib/types';
import { THEMES, WEATHERS } from '../shared/gameData';
import { mapThumb } from '../lib/mapThumbs';
import { KiteCanvas } from '../components/KiteCanvas';
import { KiteImageEditor, type EditorResult } from '../components/KiteImageEditor';
import { Btn, Card, Field, Modal, Screen, Spinner, inputCls, useToast, errMsg } from '../components/ui';

type Tab = 'servers' | 'players' | 'coins' | 'shop' | 'maps' | 'templates' | 'ann' | 'events';
const TABS: { id: Tab; label: string; icon: typeof Crown }[] = [
  { id: 'servers', label: 'Server Aktif', icon: Server },
  { id: 'players', label: 'Players', icon: Users },
  { id: 'coins', label: 'Coins & Reward', icon: Coins },
  { id: 'shop', label: 'Shop / Items', icon: Store },
  { id: 'maps', label: 'Maps', icon: MapIcon },
  { id: 'templates', label: 'Kite Templates', icon: ImageIcon },
  { id: 'ann', label: 'Pengumuman', icon: Megaphone },
  { id: 'events', label: 'Events', icon: CalendarClock },
];

const small = 'w-full rounded-lg border-2 border-ink bg-white px-2 py-1.5 text-sm font-semibold';

export default function OwnerPage() {
  const { me } = useSession();
  const [tab, setTab] = useState<Tab>('servers');
  if (!me?.isOwner) return null;
  return (
    <Screen title="Owner Panel" wide right={<Crown className="size-7 text-sun" />}>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-ink px-3 py-2 text-sm font-bold ${tab === t.id ? 'bg-ink text-white' : 'bg-white'}`}>
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'servers' && <Servers />}
      {tab === 'players' && <Players />}
      {tab === 'coins' && <Rewards />}
      {tab === 'shop' && <Items />}
      {tab === 'maps' && <Maps />}
      {tab === 'templates' && <Templates />}
      {tab === 'ann' && <Announcements />}
      {tab === 'events' && <Events />}
    </Screen>
  );
}

function Servers() {
  const toast = useToast();
  const [d, setD] = useState<any>(null);
  const load = () => api('admin/overview').then(setD).catch((e) => toast(errMsg(e), 'bad'));
  useEffect(() => {
    load();
    const t = window.setInterval(load, 5000);
    return () => window.clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <Spinner />;
  const end = async (id: string) => {
    if (!confirm('Hentikan server ini?')) return;
    await api('admin/match/end', { matchId: id }).catch((e) => toast(errMsg(e), 'bad'));
    load();
  };
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ['Total akun', d.stats.users],
          ['Online', d.stats.online],
          ['Antrian', d.stats.queue],
          ['Diblokir', d.stats.banned],
          ['Match selesai', d.stats.finished],
        ].map(([l, v]) => (
          <Card key={l as string} className="p-3 text-center">
            <div className="font-display text-3xl font-extrabold">{v}</div>
            <div className="text-xs font-bold uppercase text-muted">{l}</div>
          </Card>
        ))}
      </div>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="font-display text-xl font-bold">Server / Room aktif ({d.servers.length})</h3>
        <Btn size="sm" onClick={load}>
          <RefreshCw className="size-3.5" />
        </Btn>
      </div>
      <div className="space-y-2">
        {d.servers.length === 0 && <div className="text-sm text-muted">Tidak ada server aktif.</div>}
        {d.servers.map((s: any) => (
          <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-ink bg-white p-3">
            <span className={`rounded-md px-2 py-0.5 text-xs font-bold text-white ${s.mode === 'battle' ? 'bg-kite' : 'bg-sea'}`}>{s.mode}</span>
            <span className="font-bold">{s.map}</span>
            <span className="text-xs text-muted">
              {s.phase} · {s.id}
            </span>
            <span className="flex-1 text-sm">{s.players.map((p: any) => `${p.username}${p.alive ? '' : '✗'} (${p.hp}%)`).join(', ')}</span>
            <Btn size="sm" variant="danger" onClick={() => end(s.id)}>
              <Power className="size-3.5" /> Stop
            </Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

function Players() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<any[] | null>(null);
  const [coinFor, setCoinFor] = useState<any>(null);
  const [amount, setAmount] = useState(100);
  const [mode, setMode] = useState<'add' | 'set'>('add');
  const load = () =>
    api<{ players: any[] }>('admin/players', { search })
      .then((r) => setRows(r.players))
      .catch((e) => toast(errMsg(e), 'bad'));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const ban = async (p: any) => {
    const reason = p.banned ? '' : prompt('Alasan ban:', 'Melanggar aturan') || '';
    if (!p.banned && !reason) return;
    try {
      await api('admin/player/ban', { userId: p.id, banned: !p.banned, reason });
      load();
    } catch (e) {
      toast(errMsg(e), 'bad');
    }
  };
  const saveCoins = async () => {
    try {
      const r = await api<{ coins: number }>('admin/player/coins', { userId: coinFor.id, amount, mode });
      toast(`Coins ${coinFor.username}: ${r.coins}`, 'good');
      setCoinFor(null);
      load();
    } catch (e) {
      toast(errMsg(e), 'bad');
    }
  };
  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        className="mb-3 flex gap-2"
      >
        <input className={inputCls} placeholder="Cari username" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Btn type="submit" variant="dark">
          Cari
        </Btn>
      </form>
      {!rows ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto rounded-xl border-2 border-ink bg-white">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase">
              <tr>
                <th className="p-2">User</th>
                <th className="p-2">Coins</th>
                <th className="p-2">W/L/M</th>
                <th className="p-2">Last seen</th>
                <th className="p-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-ink/10">
                  <td className="p-2 font-bold">
                    {p.username} {p.role !== 'player' && <span className="rounded bg-sun px-1 text-[10px]">{p.role}</span>}
                    {p.banned && <span className="ml-1 rounded bg-bad px-1 text-[10px] text-white">BANNED</span>}
                    {p.banned && <div className="text-xs font-normal text-muted">{p.ban_reason}</div>}
                  </td>
                  <td className="p-2">{p.coins.toLocaleString('id-ID')}</td>
                  <td className="p-2">
                    {p.wins}/{p.losses}/{p.matches}
                  </td>
                  <td className="p-2 text-xs text-muted">{p.last_seen ? new Date(p.last_seen).toLocaleString('id-ID') : '—'}</td>
                  <td className="flex gap-1 p-2">
                    <Btn size="sm" onClick={() => setCoinFor(p)}>
                      <Coins className="size-3.5" />
                    </Btn>
                    {p.role !== 'owner' && (
                      <Btn size="sm" variant={p.banned ? 'sea' : 'danger'} onClick={() => ban(p)}>
                        <Ban className="size-3.5" /> {p.banned ? 'Unban' : 'Ban'}
                      </Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!coinFor} onClose={() => setCoinFor(null)} title={`Coins: ${coinFor?.username || ''}`}>
        <div className="space-y-3">
          <div className="text-sm">Saldo sekarang: {coinFor?.coins}</div>
          <div className="flex gap-2">
            <Btn size="sm" variant={mode === 'add' ? 'dark' : 'paper'} onClick={() => setMode('add')}>
              Tambah/Kurangi
            </Btn>
            <Btn size="sm" variant={mode === 'set' ? 'dark' : 'paper'} onClick={() => setMode('set')}>
              Set saldo
            </Btn>
          </div>
          <input type="number" className={inputCls} value={amount} onChange={(e) => setAmount(parseInt(e.target.value || '0'))} />
          <Btn variant="primary" className="w-full" onClick={saveCoins}>
            Simpan
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

function Rewards() {
  const toast = useToast();
  const [r, setR] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    api<{ rewards: Record<string, number> }>('admin/rewards').then((x) => setR(x.rewards)).catch((e) => toast(errMsg(e), 'bad'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!r) return <Spinner />;
  const labels: Record<string, string> = { win: 'Reward menang', participation: 'Reward menyelesaikan match', perCut: 'Bonus per tali diputus', daily: 'Daily reward', startCoins: 'Coins awal akun baru' };
  const save = async () => {
    try {
      const x = await api<{ rewards: Record<string, number> }>('admin/rewards/save', { rewards: r });
      setR(x.rewards);
      toast('Reward disimpan', 'good');
    } catch (e) {
      toast(errMsg(e), 'bad');
    }
  };
  return (
    <Card className="max-w-lg p-4">
      <div className="space-y-3">
        {Object.keys(labels).map((k) => (
          <Field key={k} label={labels[k]}>
            <input type="number" className={inputCls} value={r[k] ?? 0} onChange={(e) => setR({ ...r, [k]: parseInt(e.target.value || '0') })} />
          </Field>
        ))}
        <Btn variant="primary" className="w-full" onClick={save}>
          Simpan Konfigurasi
        </Btn>
        <p className="text-xs text-muted">Untuk menambah/mengurangi Coins pemain tertentu gunakan tab Players.</p>
      </div>
    </Card>
  );
}

const EMPTY_ITEM: ItemDef = { id: '', kind: 'thread', name: '', description: '', price: 100, qty: 3, durability: 1, cutting: 1, control: 1, color: '#ffffff', enabled: true, sort: 9 };

function Items() {
  const toast = useToast();
  const [items, setItems] = useState<ItemDef[] | null>(null);
  const [edit, setEdit] = useState<ItemDef | null>(null);
  const load = () => api<{ items: ItemDef[] }>('admin/items').then((r) => setItems(r.items)).catch((e) => toast(errMsg(e), 'bad'));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    try {
      await api('admin/items/save', { item: edit });
      setEdit(null);
      load();
      toast('Item disimpan', 'good');
    } catch (e) {
      toast(errMsg(e), 'bad');
    }
  };
  const num = (k: keyof ItemDef, step = 1) => (
    <Field label={k}>
      <input type="number" step={step} className={small} value={edit![k] as number} onChange={(e) => setEdit({ ...edit!, [k]: parseFloat(e.target.value || '0') })} />
    </Field>
  );
  return (
    <div>
      <Btn variant="primary" className="mb-3" onClick={() => setEdit({ ...EMPTY_ITEM })}>
        <Plus className="size-4" /> Item benang baru
      </Btn>
      {!items ? (
        <Spinner />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <Card key={it.id} className={`p-3 ${it.enabled ? '' : 'opacity-60'}`}>
              <div className="flex items-center gap-2">
                <span className="size-5 rounded-full border-2 border-ink" style={{ background: it.color }} />
                <span className="font-bold">{it.name}</span>
                <span className="ml-auto text-sm font-bold">{it.price} c</span>
              </div>
              <div className="mt-1 text-xs text-muted">
                id: {it.id} · qty {it.qty} · D {it.durability} · C {it.cutting} · Ctrl {it.control} {it.enabled ? '' : '· nonaktif'}
              </div>
              <Btn size="sm" className="mt-2" onClick={() => setEdit({ ...it })}>
                Edit
              </Btn>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Item benang" wide>
        {edit && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Field label="id">
              <input className={small} value={edit.id} onChange={(e) => setEdit({ ...edit, id: e.target.value })} />
            </Field>
            <Field label="name">
              <input className={small} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="color">
              <input type="color" className="h-9 w-full rounded-lg border-2 border-ink" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} />
            </Field>
            {num('price')}
            {num('qty')}
            {num('sort')}
            {num('durability', 0.05)}
            {num('cutting', 0.05)}
            {num('control', 0.05)}
            <div className="col-span-2 sm:col-span-3">
              <Field label="description">
                <input className={small} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
              </Field>
            </div>
            <label className="flex items-center gap-2 font-bold">
              <input type="checkbox" checked={edit.enabled} onChange={(e) => setEdit({ ...edit, enabled: e.target.checked })} /> Aktif di shop
            </label>
            <Btn variant="primary" className="col-span-2 sm:col-span-3" onClick={save}>
              Simpan
            </Btn>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Maps() {
  const toast = useToast();
  const [maps, setMaps] = useState<MapDef[] | null>(null);
  const [edit, setEdit] = useState<MapDef | null>(null);
  const load = () => api<{ maps: MapDef[] }>('admin/maps').then((r) => setMaps(r.maps)).catch((e) => toast(errMsg(e), 'bad'));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    try {
      await api('admin/maps/save', { map: edit });
      setEdit(null);
      load();
      toast('Map disimpan', 'good');
    } catch (e) {
      toast(errMsg(e), 'bad');
    }
  };
  const blank: MapDef = { id: '', name: '', description: '', theme: 'field', weather: 'clear', width: 2000, windBase: 100, windDir: 1, gust: 0.5, sky: ['#6ec6ff', '#e8f7ff'], ground: '#6aa84f', spawn: [500, 1500], maxLen: 800, enabled: true, sort: 20 };
  const n = (k: keyof MapDef, step = 1) => (
    <Field label={k}>
      <input type="number" step={step} className={small} value={edit![k] as number} onChange={(e) => setEdit({ ...edit!, [k]: parseFloat(e.target.value || '0') })} />
    </Field>
  );
  return (
    <div>
      <Btn variant="primary" className="mb-3" onClick={() => setEdit({ ...blank })}>
        <Plus className="size-4" /> Map baru
      </Btn>
      {!maps ? (
        <Spinner />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {maps.map((m) => (
            <Card key={m.id} className={`overflow-hidden ${m.enabled ? '' : 'opacity-60'}`}>
              <img src={mapThumb(m)} alt="" className="aspect-[16/7] w-full object-cover object-bottom" />
              <div className="p-3">
                <div className="font-bold">{m.name}</div>
                <div className="text-xs text-muted">
                  angin {m.windBase} · dir {m.windDir > 0 ? '→' : '←'} · gust {m.gust} · {m.weather}
                </div>
                <Btn size="sm" className="mt-2" onClick={() => setEdit({ ...m, sky: [...m.sky] as [string, string], spawn: [...m.spawn] as [number, number] })}>
                  Edit
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Map" wide>
        {edit && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Field label="id">
              <input className={small} value={edit.id} onChange={(e) => setEdit({ ...edit, id: e.target.value })} />
            </Field>
            <Field label="name">
              <input className={small} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="theme">
              <select className={small} value={edit.theme} onChange={(e) => setEdit({ ...edit, theme: e.target.value })}>
                {THEMES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="weather">
              <select className={small} value={edit.weather} onChange={(e) => setEdit({ ...edit, weather: e.target.value })}>
                {WEATHERS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            {n('width')}
            {n('windBase')}
            <Field label="windDir">
              <select className={small} value={edit.windDir} onChange={(e) => setEdit({ ...edit, windDir: +e.target.value })}>
                <option value={1}>→ kanan</option>
                <option value={-1}>← kiri</option>
              </select>
            </Field>
            {n('gust', 0.05)}
            {n('maxLen')}
            <Field label="spawn kiri">
              <input type="number" className={small} value={edit.spawn[0]} onChange={(e) => setEdit({ ...edit, spawn: [+e.target.value, edit.spawn[1]] })} />
            </Field>
            <Field label="spawn kanan">
              <input type="number" className={small} value={edit.spawn[1]} onChange={(e) => setEdit({ ...edit, spawn: [edit.spawn[0], +e.target.value] })} />
            </Field>
            {n('sort')}
            <Field label="langit atas">
              <input type="color" className="h-9 w-full rounded-lg border-2 border-ink" value={edit.sky[0]} onChange={(e) => setEdit({ ...edit, sky: [e.target.value, edit.sky[1]] })} />
            </Field>
            <Field label="langit bawah">
              <input type="color" className="h-9 w-full rounded-lg border-2 border-ink" value={edit.sky[1]} onChange={(e) => setEdit({ ...edit, sky: [edit.sky[0], e.target.value] })} />
            </Field>
            <Field label="tanah">
              <input type="color" className="h-9 w-full rounded-lg border-2 border-ink" value={edit.ground} onChange={(e) => setEdit({ ...edit, ground: e.target.value })} />
            </Field>
            <div className="col-span-2 sm:col-span-3">
              <Field label="description">
                <input className={small} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
              </Field>
            </div>
            <label className="flex items-center gap-2 font-bold">
              <input type="checkbox" checked={edit.enabled} onChange={(e) => setEdit({ ...edit, enabled: e.target.checked })} /> Aktif
            </label>
            <Btn variant="primary" className="col-span-2 sm:col-span-3" onClick={save}>
              Simpan Map
            </Btn>
          </div>
        )}
      </Modal>
    </div>
  );
}

type Tpl = Kite & { price: number; enabled: boolean };

function Templates() {
  const toast = useToast();
  const [list, setList] = useState<Tpl[] | null>(null);
  const [edit, setEdit] = useState<(Partial<Tpl> & { newImage?: string }) | null>(null);
  const [img, setImg] = useState<EditorResult | null>(null);
  const load = () => api<{ templates: Tpl[] }>('admin/templates').then((r) => setList(r.templates)).catch((e) => toast(errMsg(e), 'bad'));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    if (!edit) return;
    try {
      await api('admin/templates/save', {
        template: { id: edit.id, name: edit.name, price: edit.price, size: edit.size, enabled: edit.enabled, design: edit.design, image: img?.dataUrl || undefined },
      });
      setEdit(null);
      setImg(null);
      load();
      toast('Template disimpan', 'good');
    } catch (e) {
      toast(errMsg(e), 'bad');
    }
  };
  const del = async (id: number) => {
    if (!confirm('Hapus template?')) return;
    await api('admin/templates/delete', { id }).catch((e) => toast(errMsg(e), 'bad'));
    load();
  };
  const styles = ['diamond', 'bebek', 'stripe', 'star', 'butterfly'];
  return (
    <div>
      <Btn variant="primary" className="mb-3" onClick={() => setEdit({ name: '', price: 300, size: 1, enabled: true, design: { style: 'diamond', colors: ['#e63946', '#ffffff', '#1d3557'], tail: true, tailColor: '#ffb703' } })}>
        <Plus className="size-4" /> Template baru
      </Btn>
      {!list ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {list.map((t) => (
            <Card key={t.id} className={`overflow-hidden ${t.enabled ? '' : 'opacity-60'}`}>
              <KiteCanvas kite={t} width={200} height={130} sky className="block w-full" />
              <div className="p-2">
                <div className="font-bold">{t.name}</div>
                <div className="text-xs text-muted">{t.price} coins</div>
                <div className="mt-1 flex gap-1">
                  <Btn size="sm" onClick={() => setEdit({ ...t })}>
                    Edit
                  </Btn>
                  <Btn size="sm" variant="danger" onClick={() => del(t.id)}>
                    <Trash2 className="size-3.5" />
                  </Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal
        open={!!edit}
        onClose={() => {
          setEdit(null);
          setImg(null);
        }}
        title="Kite Template"
        wide
      >
        {edit && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Field label="Nama">
                <input className={small} value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </Field>
              <Field label="Harga">
                <input type="number" className={small} value={edit.price ?? 0} onChange={(e) => setEdit({ ...edit, price: parseInt(e.target.value || '0') })} />
              </Field>
              <Field label="Ukuran">
                <input type="number" step={0.05} className={small} value={edit.size ?? 1} onChange={(e) => setEdit({ ...edit, size: parseFloat(e.target.value || '1') })} />
              </Field>
            </div>
            {!edit.image && !img && edit.design && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <Field label="Gaya">
                  <select className={small} value={edit.design.style} onChange={(e) => setEdit({ ...edit, design: { ...edit.design!, style: e.target.value } })}>
                    {styles.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                {[0, 1, 2].map((i) => (
                  <Field key={i} label={`Warna ${i + 1}`}>
                    <input
                      type="color"
                      className="h-9 w-full rounded-lg border-2 border-ink"
                      value={edit.design!.colors[i]}
                      onChange={(e) => {
                        const colors = [...edit.design!.colors];
                        colors[i] = e.target.value;
                        setEdit({ ...edit, design: { ...edit.design!, colors } });
                      }}
                    />
                  </Field>
                ))}
                <Field label="Ekor">
                  <input type="color" className="h-9 w-full rounded-lg border-2 border-ink" value={edit.design.tailColor || '#ffb703'} onChange={(e) => setEdit({ ...edit, design: { ...edit.design!, tailColor: e.target.value } })} />
                </Field>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="overflow-hidden rounded-xl border-2 border-ink">
                <KiteCanvas kite={{ image: img?.dataUrl || edit.image || null, design: edit.design!, size: edit.size || 1 }} width={200} height={140} sky />
              </div>
              <label className="flex items-center gap-2 font-bold">
                <input type="checkbox" checked={edit.enabled !== false} onChange={(e) => setEdit({ ...edit, enabled: e.target.checked })} /> Aktif di shop
              </label>
            </div>
            <details className="rounded-xl border-2 border-ink/20 p-2">
              <summary className="cursor-pointer font-bold">Upload gambar layangan (opsional)</summary>
              <div className="mt-2">
                <KiteImageEditor onResult={setImg} />
              </div>
            </details>
            <Btn variant="primary" className="w-full" disabled={!!img && !img.accepted} onClick={save}>
              Simpan Template
            </Btn>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Announcements() {
  const toast = useToast();
  const [list, setList] = useState<any[] | null>(null);
  const [text, setText] = useState('');
  const load = () => api<{ announcements: any[] }>('admin/announcements').then((r) => setList(r.announcements)).catch((e) => toast(errMsg(e), 'bad'));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api('admin/announcements/save', { text });
      setText('');
      load();
    } catch (e) {
      toast(errMsg(e), 'bad');
    }
  };
  return (
    <div>
      <form onSubmit={add} className="mb-3 flex gap-2">
        <input className={inputCls} value={text} maxLength={240} onChange={(e) => setText(e.target.value)} placeholder="Tulis pengumuman untuk semua pemain" />
        <Btn variant="primary" type="submit">
          Kirim
        </Btn>
      </form>
      {!list ? (
        <Spinner />
      ) : (
        <div className="space-y-2">
          {list.map((a) => (
            <div key={a.id} className={`flex items-center gap-2 rounded-xl border-2 border-ink bg-white p-3 ${a.active ? '' : 'opacity-50'}`}>
              <span className="flex-1 text-sm font-semibold">{a.text}</span>
              <Btn size="sm" onClick={() => api('admin/announcements/save', { id: a.id, active: !a.active }).then(load)}>
                {a.active ? 'Sembunyikan' : 'Tampilkan'}
              </Btn>
              <Btn size="sm" variant="danger" onClick={() => api('admin/announcements/delete', { id: a.id }).then(load)}>
                <Trash2 className="size-3.5" />
              </Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Events() {
  const toast = useToast();
  const [list, setList] = useState<any[] | null>(null);
  const [ev, setEv] = useState({ name: '', description: '', coinMul: 2, windMul: 1, claimBonus: 0, hours: 24 });
  const load = () => api<{ events: any[] }>('admin/events').then((r) => setList(r.events)).catch((e) => toast(errMsg(e), 'bad'));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const create = async () => {
    try {
      await api('admin/events/save', { event: ev });
      toast('Event dibuat', 'good');
      load();
    } catch (e) {
      toast(errMsg(e), 'bad');
    }
  };
  const now = Date.now();
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card className="h-fit space-y-2 p-4">
        <h3 className="font-display text-xl font-bold">Event baru</h3>
        <Field label="Nama">
          <input className={small} value={ev.name} onChange={(e) => setEv({ ...ev, name: e.target.value })} placeholder="Festival Angin Kencang" />
        </Field>
        <Field label="Deskripsi">
          <input className={small} value={ev.description} onChange={(e) => setEv({ ...ev, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Pengali coins">
            <input type="number" step={0.1} className={small} value={ev.coinMul} onChange={(e) => setEv({ ...ev, coinMul: +e.target.value })} />
          </Field>
          <Field label="Pengali angin">
            <input type="number" step={0.1} className={small} value={ev.windMul} onChange={(e) => setEv({ ...ev, windMul: +e.target.value })} />
          </Field>
          <Field label="Bonus klaim (coins)">
            <input type="number" className={small} value={ev.claimBonus} onChange={(e) => setEv({ ...ev, claimBonus: +e.target.value })} />
          </Field>
          <Field label="Durasi (jam)">
            <input type="number" className={small} value={ev.hours} onChange={(e) => setEv({ ...ev, hours: +e.target.value })} />
          </Field>
        </div>
        <Btn variant="primary" className="w-full" onClick={create}>
          Mulai Event
        </Btn>
      </Card>
      <div className="space-y-2">
        {!list ? (
          <Spinner />
        ) : (
          list.map((e) => {
            const live = e.active && new Date(e.starts_at).getTime() <= now && new Date(e.ends_at).getTime() > now;
            return (
              <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-ink bg-white p-3">
                <span className={`rounded px-2 py-0.5 text-xs font-bold text-white ${live ? 'bg-good' : 'bg-muted'}`}>{live ? 'LIVE' : 'OFF'}</span>
                <span className="font-bold">{e.name}</span>
                <span className="flex-1 text-xs text-muted">
                  coins ×{e.coin_mul} · angin ×{e.wind_mul} · bonus {e.claim_bonus} · s/d {new Date(e.ends_at).toLocaleString('id-ID')}
                </span>
                <Btn size="sm" onClick={() => api('admin/events/save', { event: { id: e.id, toggle: true } }).then(load)}>
                  {e.active ? 'Nonaktifkan' : 'Aktifkan'}
                </Btn>
                <Btn size="sm" variant="danger" onClick={() => api('admin/events/delete', { id: e.id }).then(load)}>
                  <Trash2 className="size-3.5" />
                </Btn>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
