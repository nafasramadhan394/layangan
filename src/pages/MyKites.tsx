import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import type { Kite } from '../lib/types';
import { KiteCanvas } from '../components/KiteCanvas';
import { Btn, Field, Modal, Screen, Spinner, inputCls, useToast, errMsg } from '../components/ui';

export default function MyKitesPage() {
  const toast = useToast();
  const { refresh } = useSession();
  const [kites, setKites] = useState<Kite[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [edit, setEdit] = useState<Kite | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    api<{ kites: Kite[]; selected: number }>('kites/list')
      .then((r) => {
        setKites(r.kites);
        setSelected(r.selected);
      })
      .catch((e) => toast(errMsg(e), 'bad'));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const select = async (id: number) => {
    try {
      await api('kites/select', { id });
      setSelected(id);
      refresh();
      toast('Layangan dipakai!', 'good');
    } catch (e) {
      toast(errMsg(e), 'bad');
    }
  };
  const del = async (k: Kite) => {
    if (!confirm(`Hapus layangan "${k.name}"?`)) return;
    try {
      await api('kites/delete', { id: k.id });
      await load();
      refresh();
    } catch (e) {
      toast(errMsg(e), 'bad');
    }
  };
  const saveEdit = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      await api('kites/update', { id: edit.id, name: edit.name, size: edit.size });
      setEdit(null);
      await load();
      refresh();
    } catch (e) {
      toast(errMsg(e), 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title="My Kites"
      right={
        <Link to="/create" className="hidden items-center gap-1 rounded-xl border-2 border-ink bg-sun px-3 py-2 text-sm font-bold shadow-[var(--shadow-hard-sm)] sm:flex">
          <Plus className="size-4" /> Buat
        </Link>
      }
    >
      {!kites ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {kites.map((k) => (
            <div key={k.id} className={`overflow-hidden rounded-2xl border-2 border-ink bg-white ${selected === k.id ? 'shadow-[var(--shadow-hard)] ring-4 ring-kite/40' : 'shadow-[var(--shadow-hard-sm)]'}`}>
              <KiteCanvas kite={k} width={200} height={150} sky className="block w-full" />
              <div className="p-3">
                <div className="truncate font-display text-lg font-bold">{k.name}</div>
                <div className="text-xs text-muted">
                  Ukuran {Math.round(k.size * 100)}% · {k.custom ? 'Dari galeri' : 'Template'}
                </div>
                <div className="mt-2 flex gap-1.5">
                  {selected === k.id ? (
                    <span className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-ink py-1.5 text-xs font-bold text-white">
                      <Check className="size-3.5" /> Dipakai
                    </span>
                  ) : (
                    <Btn size="sm" variant="primary" className="flex-1" onClick={() => select(k.id)}>
                      Pakai
                    </Btn>
                  )}
                  <Btn size="sm" onClick={() => setEdit({ ...k })} aria-label="Edit">
                    <Pencil className="size-3.5" />
                  </Btn>
                  <Btn size="sm" variant="danger" onClick={() => del(k)} aria-label="Hapus">
                    <Trash2 className="size-3.5" />
                  </Btn>
                </div>
              </div>
            </div>
          ))}
          <Link to="/create" className="flex min-h-[240px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink bg-white/60 font-bold">
            <Plus className="size-8" /> Buat dari Galeri
          </Link>
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Edit layangan">
        {edit && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl border-2 border-ink">
              <KiteCanvas kite={edit} width={380} height={180} sky className="block w-full" />
            </div>
            <Field label="Nama">
              <input className={inputCls} value={edit.name} maxLength={24} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label={`Ukuran: ${Math.round(edit.size * 100)}%`}>
              <input type="range" min={0.7} max={1.4} step={0.05} value={edit.size} onChange={(e) => setEdit({ ...edit, size: +e.target.value })} className="w-full" />
            </Field>
            <Btn variant="primary" className="w-full" loading={busy} onClick={saveEdit}>
              Simpan
            </Btn>
          </div>
        )}
      </Modal>
    </Screen>
  );
}
