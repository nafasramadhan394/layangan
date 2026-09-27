import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { audio } from '../lib/audio';
import { KiteImageEditor, type EditorResult } from '../components/KiteImageEditor';
import { KiteCanvas } from '../components/KiteCanvas';
import { Btn, Card, Field, Screen, inputCls, useToast, errMsg } from '../components/ui';

const TAIL_COLORS = ['#ffb703', '#e63946', '#1a9e8f', '#3a86ff', '#ffffff', '#1f1a3d'];

export default function CreateKitePage() {
  const nav = useNavigate();
  const toast = useToast();
  const { refresh } = useSession();
  const [res, setRes] = useState<EditorResult | null>(null);
  const [name, setName] = useState('');
  const [size, setSize] = useState(1);
  const [tail, setTail] = useState(true);
  const [tailColor, setTailColor] = useState('#ffb703');
  const [select, setSelect] = useState(true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!res?.accepted) return;
    setSaving(true);
    try {
      await api('kites/create', { name: name.trim(), size, image: res.dataUrl, design: { style: 'image', tail, tailColor }, select });
      audio.coin();
      toast('Layangan tersimpan ke akunmu!', 'good');
      await refresh();
      nav('/kites');
    } catch (e) {
      toast(errMsg(e), 'bad');
    } finally {
      setSaving(false);
    }
  };

  const preview = res ? { image: res.dataUrl, size, design: { style: 'image', colors: [], tail, tailColor } } : null;

  return (
    <Screen title="Create Kite" wide>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <KiteImageEditor onResult={setRes} />
        <Card className="h-fit p-4">
          <h3 className="mb-2 font-display text-xl font-extrabold">Detail Layangan</h3>
          <div className="mb-3 overflow-hidden rounded-xl border-2 border-ink">
            <KiteCanvas kite={preview} width={300} height={220} sky className="mx-auto block w-full" />
          </div>
          {!res && <p className="mb-3 text-sm text-muted">Pratinjau terbang muncul setelah gambar divalidasi.</p>}
          <div className="space-y-3">
            <Field label="Nama layangan">
              <input className={inputCls} value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="mis. Garuda Merah" />
            </Field>
            <Field label={`Ukuran: ${Math.round(size * 100)}%`} hint="Besar = lebih stabil & kuat angkat, kecil = lebih lincah.">
              <input type="range" min={0.7} max={1.4} step={0.05} value={size} onChange={(e) => setSize(+e.target.value)} className="w-full" />
            </Field>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={tail} onChange={(e) => setTail(e.target.checked)} className="size-4 accent-[var(--color-kite)]" /> Tambahkan ekor/buntut
            </label>
            {tail && (
              <div className="flex gap-2">
                {TAIL_COLORS.map((c) => (
                  <button key={c} onClick={() => setTailColor(c)} className={`size-8 rounded-full border-2 ${tailColor === c ? 'border-ink ring-2 ring-kite' : 'border-ink/30'}`} style={{ background: c }} aria-label={c} />
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={select} onChange={(e) => setSelect(e.target.checked)} className="size-4 accent-[var(--color-kite)]" /> Langsung pakai layangan ini
            </label>
            <Btn variant="primary" size="lg" className="w-full" disabled={!res?.accepted || name.trim().length < 2} loading={saving} onClick={save}>
              <Save className="size-5" /> Simpan ke Akun
            </Btn>
            {res && !res.accepted && <p className="text-xs font-semibold text-bad">Hanya gambar layangan yang bisa disimpan.</p>}
          </div>
        </Card>
      </div>
    </Screen>
  );
}
