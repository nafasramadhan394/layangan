import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import type { ItemDef } from '../lib/types';
import { StatBar } from './Shop';
import { KiteCanvas } from '../components/KiteCanvas';
import { Btn, Card, Screen, Spinner, useToast, errMsg } from '../components/ui';

interface Inv {
  inventory: { item_id: string; qty: number; item: ItemDef }[];
  equipped: string;
  defaultThread: { id: string; name: string; color: string; durability: number; cutting: number; control: number };
}

export default function InventoryPage() {
  const toast = useToast();
  const { me, refresh } = useSession();
  const [data, setData] = useState<Inv | null>(null);

  const load = () => api<Inv>('inventory/list').then(setData).catch((e) => toast(errMsg(e), 'bad'));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const equip = async (id: string) => {
    try {
      await api('inventory/equip', { itemId: id });
      await load();
      refresh();
      toast('Benang dipasang', 'good');
    } catch (e) {
      toast(errMsg(e), 'bad');
    }
  };

  const rows = data
    ? [
        { id: data.defaultThread.id, name: data.defaultThread.name, qty: Infinity, color: data.defaultThread.color, durability: data.defaultThread.durability, cutting: data.defaultThread.cutting, control: data.defaultThread.control },
        ...data.inventory.filter((i) => i.qty > 0).map((i) => ({ id: i.item_id, name: i.item.name, qty: i.qty, color: i.item.color, durability: i.item.durability, cutting: i.item.cutting, control: i.item.control })),
      ]
    : [];
  const equippedValid = rows.some((r) => r.id === data?.equipped);

  return (
    <Screen title="Inventory">
      <div className="grid gap-5 md:grid-cols-[1fr_280px]">
        <section>
          <h2 className="mb-2 font-display text-xl font-bold">Benang</h2>
          {!data ? (
            <Spinner />
          ) : (
            <div className="space-y-3">
              {rows.map((r) => {
                const active = data.equipped === r.id || (!equippedValid && r.id === data.defaultThread.id);
                return (
                  <div key={r.id} className={`flex flex-wrap items-center gap-4 rounded-2xl border-2 border-ink bg-white p-4 ${active ? 'shadow-[var(--shadow-hard)] ring-4 ring-kite/30' : 'shadow-[var(--shadow-hard-sm)]'}`}>
                    <div className="size-12 shrink-0 rounded-full border-2 border-ink" style={{ background: `repeating-conic-gradient(${r.color} 0 20deg, #c9a26b 20deg 40deg)` }} />
                    <div className="min-w-[140px] flex-1">
                      <div className="font-display text-lg font-extrabold">{r.name}</div>
                      <div className="text-xs font-bold text-muted">{r.qty === Infinity ? 'Gratis · tak terbatas' : `${r.qty} gulung`}</div>
                    </div>
                    <div className="w-full space-y-1 sm:w-48">
                      <StatBar label="Durability" value={r.durability} />
                      <StatBar label="Cutting" value={r.cutting} />
                      <StatBar label="Control" value={r.control} />
                    </div>
                    {active ? (
                      <span className="flex items-center gap-1 rounded-lg bg-ink px-3 py-1.5 text-sm font-bold text-white">
                        <Check className="size-4" /> Terpasang
                      </span>
                    ) : (
                      <Btn size="sm" variant="primary" onClick={() => equip(r.id)}>
                        Pasang
                      </Btn>
                    )}
                  </div>
                );
              })}
              <Link to="/shop" className="block text-center text-sm font-bold text-kite underline">
                Beli benang di Shop
              </Link>
            </div>
          )}
        </section>
        <section>
          <h2 className="mb-2 font-display text-xl font-bold">Layangan aktif</h2>
          <Card className="overflow-hidden">
            <KiteCanvas kite={me?.selectedKite || null} width={276} height={200} sky className="block w-full" />
            <div className="p-3">
              <div className="font-display text-lg font-bold">{me?.selectedKite?.name}</div>
              <Link to="/kites" className="text-sm font-bold text-kite underline">
                Ganti layangan
              </Link>
            </div>
          </Card>
        </section>
      </div>
    </Screen>
  );
}
