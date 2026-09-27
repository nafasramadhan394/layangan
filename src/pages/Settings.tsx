import { useState } from 'react';
import { Volume2, Wind, Sparkles, Hand, Gauge, KeyRound, LogOut } from 'lucide-react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { audio } from '../lib/audio';
import type { Settings } from '../lib/types';
import { Btn, Card, Field, Screen, inputCls, useToast, errMsg } from '../components/ui';

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className={`relative h-7 w-12 rounded-full border-2 border-ink transition ${on ? 'bg-kite' : 'bg-paper'}`} role="switch" aria-checked={on}>
      <span className={`absolute top-0.5 size-5 rounded-full border-2 border-ink bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

function Row({ icon: Icon, title, desc, children }: { icon: typeof Wind; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b-2 border-ink/10 py-3 last:border-0">
      <Icon className="size-6 shrink-0 text-ink-soft" />
      <div className="min-w-0 flex-1">
        <div className="font-bold">{title}</div>
        <div className="text-xs text-muted">{desc}</div>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { me, refresh, logout } = useSession();
  const toast = useToast();
  const [s, setS] = useState<Settings>(me!.settings);
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ old: '', next: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);

  const update = (patch: Partial<Settings>) => {
    const next = { ...s, ...patch };
    setS(next);
    audio.configure(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api('me/settings', { settings: s });
      await refresh();
      toast('Pengaturan tersimpan di akunmu', 'good');
    } catch (e) {
      toast(errMsg(e), 'bad');
    } finally {
      setSaving(false);
    }
  };

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next !== pw.confirm) return toast('Konfirmasi password tidak sama', 'bad');
    setPwBusy(true);
    try {
      await api('auth/password', { oldPassword: pw.old, newPassword: pw.next });
      toast('Password berhasil diganti', 'good');
      setPw({ old: '', next: '', confirm: '' });
    } catch (e) {
      toast(errMsg(e), 'bad');
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <Screen title="Settings">
      <Card className="mb-5 px-4 py-1">
        <Row icon={Volume2} title="Volume" desc={`${Math.round(s.volume * 100)}%`}>
          <input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => update({ volume: +e.target.value })} onPointerUp={() => audio.coin()} className="w-32" />
        </Row>
        <Row icon={Sparkles} title="Efek suara" desc="Tali, potong, menang/kalah">
          <Toggle on={s.sfx} onChange={(v) => update({ sfx: v })} />
        </Row>
        <Row icon={Wind} title="Suara angin" desc="Ambience angin realtime">
          <Toggle on={s.windSound} onChange={(v) => update({ windSound: v })} />
        </Row>
        <Row icon={Gauge} title="Kualitas grafis" desc="Low disarankan untuk HP Android lama">
          <select value={s.quality} onChange={(e) => update({ quality: e.target.value as Settings['quality'] })} className="rounded-lg border-2 border-ink bg-white px-2 py-1 font-bold">
            <option value="auto">Auto</option>
            <option value="low">Low</option>
            <option value="high">High</option>
          </select>
        </Row>
        <Row icon={Hand} title="Kontrol kidal" desc="Tukar posisi tombol kiri/kanan">
          <Toggle on={s.leftHanded} onChange={(v) => update({ leftHanded: v })} />
        </Row>
      </Card>
      <Btn variant="primary" size="lg" className="mb-8 w-full" loading={saving} onClick={save}>
        Simpan Pengaturan
      </Btn>

      <Card className="mb-5 p-4">
        <h3 className="mb-3 flex items-center gap-2 font-display text-xl font-extrabold">
          <KeyRound className="size-5" /> Ganti Password
        </h3>
        <form onSubmit={changePw} className="grid gap-3 sm:grid-cols-3">
          <Field label="Password lama">
            <input type="password" className={inputCls} value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} autoComplete="current-password" required />
          </Field>
          <Field label="Password baru">
            <input type="password" className={inputCls} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" minLength={6} required />
          </Field>
          <Field label="Ulangi">
            <input type="password" className={inputCls} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" minLength={6} required />
          </Field>
          <Btn type="submit" variant="dark" loading={pwBusy} className="sm:col-span-3">
            Ganti Password
          </Btn>
        </form>
      </Card>

      <Btn variant="danger" className="w-full" onClick={logout}>
        <LogOut className="size-4" /> Logout
      </Btn>
    </Screen>
  );
}
