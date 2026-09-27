import { useEffect, useState } from 'react';
import { Coins, Package, Check } from 'lucide-react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { audio } from '../lib/audio';
import type { ItemDef, Kite } from '../lib/types';
import { KiteCanvas } from '../components/KiteCanvas';
import { Btn, Screen, Spinner, useToast, errMsg } from '../components/ui';

export function StatBar({ label, value, max = 2 }: { label: string; value: number; max?: number }) {
  return (
    <div className="text-xs font-bold">
      <div className="flex justify-between">
        <span>{label}</span>
        <span>{value.toFixed(2)}</span>
      </div>
      <div className="mt-0.5 h-2 overflow-hidden rounded-full border border-ink/30 bg-paper">
        <div className="h-full rounded-full bg-kite" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
    </div>
  );
}

export default function ShopPage() {
  const toast = useToast();
  const { me, setCoins, refresh } = useSession();
  const [tab, setTab] = useState<'thread' | 'kite'>('thread');
  const [items, setItems] = useState<ItemDef[] | null>(null);
  const [templates, setTemplates] = useState<(Kite & { price: number; owned: boolean })[] | null>(null);
  const [busy, setBusy] = useState('');

  const load = () => {
    api<{ items: ItemDef[] }>('shop/items').then((r) => setItems(r.items)).catch((e) => toast(errMsg(e), 'bad'));
    api<{ templates: (Kite & { price: number; owned: boolean })[] }>('kites/templates').then((r) => setTemplates(r.templates)).catch(() => {});
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const buy = async (it: ItemDef) => {
    setBusy(it.id);
    try {
      const r = await api<{ coins: number; qty: number; added: number }>('shop/buy', { itemId: it.id, count: 1 });
      setCoins(r.coins);
      audio.coin();
      toast(`+${r.added} gulung ${it.name} (total ${r.qty})`, 'good');
      refresh();
    } catch (e) {
      toast(errMsg(e), 'bad');
    } finally {
      setBusy('');
    }
  };

  const buyKite = async (t: Kite & { price: number }) => {
    setBusy('k' + t.id);
    try {
      const r = await api<{ coins: number }>('kites/buy-template', { id: t.id });
      setCoins(r.coins);
      audio.coin();
      toast(`${t.name} masuk ke My Kites!`, 'good');
      load();
    } catch (e) {
      toast(errMsg(e), 'bad');
    } finally {
      setBusy('');
    }
  };

  return (
    <Screen title="Shop">
      <div className="mb-4 inline-grid grid-cols-2 rounded-xl border-2 border-ink bg-white p-1">
        {(
          [
            ['thread', 'Benang'],
            ['kite', 'Layangan'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`rounded-lg px-5 py-1.5 font-display text-lg font-bold ${tab === id ? 'bg-ink text-white' : 'text-ink-soft'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'thread' &&
        (!items ? (
          <Spinner />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => {
              const owned = me?.inventory.find((i) => i.item_id === it.id)?.qty || 0;
              return (
                <div key={it.id} className="flex flex-col rounded-2xl border-2 border-ink bg-white p-4 shadow-[var(--shadow-hard)]">
                  <div className="flex items-center gap-3">
                    <div className="grid size-14 place-items-center rounded-full border-2 border-ink" style={{ background: `repeating-conic-gradient(${it.color} 0 20deg, #c9a26b 20deg 40deg)` }}>
                      <div className="size-5 rounded-full border-2 border-ink bg-paper" />
                    </div>
                    <div>
                      <div className="font-display text-xl font-extrabold leading-tight">{it.name}</div>
                      <div className="flex items-center gap-1 text-xs font-bold text-muted">
                        <Package className="size-3" /> {it.qty} gulung / beli · punya {owned}
                      </div>
                    </div>
                  </div>
                  <p className="my-3 text-sm text-ink-soft">{it.description}</p>
                  <div className="space-y-1.5">
                    <StatBar label="Durability" value={it.durability} />
                    <StatBar label="Cutting Power" value={it.cutting} />
                    <StatBar label="Control" value={it.control} />
                  </div>
                  <Btn variant="primary" className="mt-4 w-full" loading={busy === it.id} disabled={(me?.coins || 0) < it.price} onClick={() => buy(it)}>
                    <Coins className="size-4" /> {it.price.toLocaleString('id-ID')} Coins
                  </Btn>
                </div>
              );
            })}
          </div>
        ))}
      {tab === 'thread' && <p className="mt-4 text-xs text-muted">1 gulung benang terpakai setiap adu layangan. Tanpa benang, kamu memakai Benang Kasur gratis (statistik lebih rendah).</p>}

      {tab === 'kite' &&
        (!templates ? (
          <Spinner />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {templates.map((t) => (
              <div key={t.id} className="overflow-hidden rounded-2xl border-2 border-ink bg-white shadow-[var(--shadow-hard-sm)]">
                <KiteCanvas kite={t} width={220} height={150} sky className="block w-full" />
                <div className="p-3">
                  <div className="truncate font-display text-lg font-bold">{t.name}</div>
                  {t.owned ? (
                    <div className="mt-2 flex items-center justify-center gap-1 rounded-lg bg-ink py-1.5 text-sm font-bold text-white">
                      <Check className="size-4" /> Dimiliki
                    </div>
                  ) : (
                    <Btn size="sm" variant="primary" className="mt-2 w-full" loading={busy === 'k' + t.id} disabled={(me?.coins || 0) < t.price} onClick={() => buyKite(t)}>
                      {t.price === 0 ? 'Gratis' : `${t.price.toLocaleString('id-ID')} Coins`}
                    </Btn>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
    </Screen>
  );
}
