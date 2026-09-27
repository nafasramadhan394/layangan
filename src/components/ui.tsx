import { createContext, useCallback, useContext, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Coins, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from '../lib/session';
import { audio } from '../lib/audio';

type Variant = 'primary' | 'paper' | 'dark' | 'ghost' | 'sea' | 'sun' | 'danger';

const variants: Record<Variant, string> = {
  primary: 'bg-kite text-white border-ink shadow-[var(--shadow-hard)] hover:bg-kite-dark',
  paper: 'bg-white text-ink border-ink shadow-[var(--shadow-hard-sm)] hover:bg-paper-2',
  dark: 'bg-ink text-white border-ink shadow-[var(--shadow-hard-sm)] hover:bg-ink-soft',
  ghost: 'bg-transparent text-ink border-transparent hover:bg-ink/5',
  sea: 'bg-sea text-white border-ink shadow-[var(--shadow-hard-sm)] hover:brightness-110',
  sun: 'bg-sun text-ink border-ink shadow-[var(--shadow-hard-sm)] hover:brightness-105',
  danger: 'bg-white text-bad border-bad shadow-[2px_2px_0_0_var(--color-bad)] hover:bg-bad/5',
};

export function Btn({
  variant = 'paper',
  size = 'md',
  loading,
  className = '',
  children,
  onClick,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  const sz = size === 'sm' ? 'px-3 py-1.5 text-sm rounded-lg' : size === 'lg' ? 'px-6 py-3.5 text-lg rounded-2xl' : 'px-4 py-2.5 rounded-xl';
  return (
    <button
      {...rest}
      onClick={(e) => {
        audio.unlock();
        audio.click();
        onClick?.(e);
      }}
      disabled={rest.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 border-2 font-bold transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${sz} ${className}`}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border-2 border-ink bg-white shadow-[var(--shadow-hard)] ${className}`}>{children}</div>;
}

export function CoinBadge({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-sun px-3 py-1 font-display text-lg font-bold leading-none ${className}`}>
      <Coins className="size-4" strokeWidth={2.5} />
      {value.toLocaleString('id-ID')}
    </span>
  );
}

export function Screen({ title, children, right, back = '/', wide }: { title: string; children: ReactNode; right?: ReactNode; back?: string; wide?: boolean }) {
  const { me } = useSession();
  return (
    <div className="sky-bg min-h-full">
      <div className="bunting opacity-90" />
      <div className={`mx-auto px-4 pb-16 pt-3 ${wide ? 'max-w-6xl' : 'max-w-4xl'}`}>
        <header className="mb-5 flex items-center gap-3">
          <Link to={back} onClick={() => audio.click()} className="grid size-11 place-items-center rounded-xl border-2 border-ink bg-white shadow-[var(--shadow-hard-sm)] active:translate-y-[2px] active:shadow-none" aria-label="Kembali">
            <ArrowLeft className="size-5" strokeWidth={2.5} />
          </Link>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
          <div className="ml-auto flex items-center gap-2">
            {right}
            {me && <CoinBadge value={me.coins} />}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; wide?: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className={`max-h-[90vh] w-full overflow-auto rounded-2xl border-2 border-ink bg-paper p-5 shadow-[var(--shadow-hard)] ${wide ? 'max-w-2xl' : 'max-w-md'}`}
          >
            <div className="mb-3 flex items-center">
              {title && <h3 className="font-display text-2xl font-extrabold">{title}</h3>}
              <button onClick={onClose} className="ml-auto grid size-9 place-items-center rounded-lg hover:bg-ink/10" aria-label="Tutup">
                <X className="size-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-ink-soft">
      <Loader2 className="size-5 animate-spin" />
      {label || 'Memuat…'}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'w-full rounded-xl border-2 border-ink bg-white px-3 py-2.5 font-semibold outline-none placeholder:text-muted/70 focus:shadow-[var(--shadow-hard-sm)]';

// ---------------- toasts
interface Toast {
  id: number;
  msg: string;
  tone: 'good' | 'bad' | 'info';
}
const ToastCtx = createContext<(msg: string, tone?: Toast['tone']) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((msg: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-3), { id, msg, tone }]);
    window.setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 px-3">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className={`rounded-xl border-2 border-ink px-4 py-2 text-sm font-bold shadow-[var(--shadow-hard-sm)] ${
                t.tone === 'good' ? 'bg-[#d8f5e3]' : t.tone === 'bad' ? 'bg-[#ffe0e3]' : 'bg-white'
              }`}
            >
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function errMsg(e: unknown) {
  return e instanceof Error ? e.message : 'Terjadi kesalahan';
}
