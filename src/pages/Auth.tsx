import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Wind } from 'lucide-react';
import { useSession } from '../lib/session';
import { Btn, Card, Field, inputCls, errMsg } from '../components/ui';
import { KiteCanvas } from '../components/KiteCanvas';

export default function AuthPage() {
  const { login, register } = useSession();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (mode === 'register' && password !== confirm) {
      setErr('Konfirmasi password tidak sama');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') await login(username.trim(), password);
      else await register(username.trim(), password);
    } catch (e) {
      setErr(errMsg(e));
      setPassword('');
      setConfirm('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sky-bg relative min-h-full overflow-hidden">
      <div className="bunting" />
      <div className="pointer-events-none absolute -left-6 top-24 hidden opacity-90 md:block">
        <KiteCanvas kite={{ image: null, size: 1, design: { style: 'bebek', colors: ['#2a9d8f', '#e9c46a', '#264653'], tail: true, tailColor: '#e63946' } }} width={220} height={260} />
      </div>
      <div className="pointer-events-none absolute -right-4 top-40 hidden opacity-90 md:block">
        <KiteCanvas kite={{ image: null, size: 1, design: { style: 'star', colors: ['#3a0ca3', '#ffd60a', '#f72585'], tail: true, tailColor: '#ffb703' } }} width={220} height={260} />
      </div>
      <div className="mx-auto flex max-w-md flex-col items-center px-4 pb-10 pt-8">
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-6 text-center">
          <div className="floaty mx-auto mb-2 w-fit">
            <KiteCanvas kite={{ image: null, size: 1, design: { style: 'diamond', colors: ['#e63946', '#ffffff', '#1d3557'], tail: true, tailColor: '#ffb703' } }} width={130} height={130} string={false} />
          </div>
          <h1 className="font-display text-5xl font-extrabold leading-none tracking-tight text-ink sm:text-6xl">
            Layangan<span className="text-kite"> Battle</span>
          </h1>
          <p className="mt-2 flex items-center justify-center gap-1.5 font-semibold text-ink-soft">
            <Wind className="size-4" /> Adu layangan online bareng teman, realtime.
          </p>
        </motion.div>

        <Card className="w-full p-5">
          <div className="mb-4 grid grid-cols-2 rounded-xl border-2 border-ink bg-paper p-1">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setErr('');
                }}
                className={`rounded-lg py-2 font-display text-lg font-bold transition ${mode === m ? 'bg-ink text-white' : 'text-ink-soft'}`}
              >
                {m === 'login' ? 'Masuk' : 'Daftar'}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-3" autoComplete="on">
            <Field label="Username" hint={mode === 'register' ? '3–16 karakter: huruf, angka, _' : undefined}>
              <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" maxLength={16} required placeholder="contoh: jagoan_angin" />
            </Field>
            <Field label="Password" hint={mode === 'register' ? 'Minimal 6 karakter' : undefined}>
              <div className="relative">
                <input
                  className={inputCls + ' pr-11'}
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  maxLength={72}
                />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted" aria-label="Tampilkan password">
                  {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </Field>
            {mode === 'register' && (
              <Field label="Ulangi password">
                <input className={inputCls} type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required maxLength={72} />
              </Field>
            )}
            {err && <div className="rounded-lg border-2 border-bad bg-[#ffe0e3] px-3 py-2 text-sm font-semibold text-bad">{err}</div>}
            <Btn variant="primary" size="lg" className="w-full" loading={busy} type="submit">
              {mode === 'login' ? 'Masuk & Terbang' : 'Buat Akun'}
            </Btn>
          </form>
          <p className="mt-4 text-center text-xs text-muted">
            Akun tersimpan online — login dari HP, tablet, atau PC dengan akun yang sama. Password dienkripsi dan tidak pernah ditampilkan.
          </p>
        </Card>
      </div>
    </div>
  );
}
