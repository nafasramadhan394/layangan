import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, getToken, onUnauthorized, setToken } from './api';
import type { Heartbeat, Me } from './types';
import { audio } from './audio';

interface SessionCtx {
  me: Me | null;
  loading: boolean;
  hb: Heartbeat | null;
  refresh: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setCoins: (c: number) => void;
  pollNow: () => void;
}

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [hb, setHb] = useState<Heartbeat | null>(null);
  const hbTimer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setMe(null);
      setLoading(false);
      return;
    }
    try {
      const m = await api<Me>('me');
      setMe(m);
      audio.configure(m.settings);
    } catch (e: any) {
      if (e?.status === 401 || e?.status === 403) {
        setToken(null);
        setMe(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return onUnauthorized(() => {
      setToken(null);
      setMe(null);
    }) as unknown as () => void;
  }, [refresh]);

  const beat = useCallback(async () => {
    if (!getToken()) return;
    try {
      const h = await api<Heartbeat>('me/heartbeat');
      setHb(h);
      setMe((m) => (m ? { ...m, coins: h.coins, wins: h.wins, losses: h.losses } : m));
    } catch {
      /* transient */
    }
  }, []);

  useEffect(() => {
    if (!me) return;
    beat();
    hbTimer.current = window.setInterval(beat, 4000);
    return () => {
      if (hbTimer.current) window.clearInterval(hbTimer.current);
    };
  }, [me?.id, beat]); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (username: string, password: string) => {
    const r = await api<{ token: string }>('auth/login', { username, password });
    setToken(r.token);
    await refresh();
  };
  const register = async (username: string, password: string) => {
    const r = await api<{ token: string }>('auth/register', { username, password });
    setToken(r.token);
    await refresh();
  };
  const logout = async () => {
    try {
      await api('auth/logout');
    } catch {
      /* ignore */
    }
    setToken(null);
    setMe(null);
    setHb(null);
  };

  return (
    <Ctx.Provider
      value={{
        me,
        loading,
        hb,
        refresh,
        login,
        register,
        logout,
        setCoins: (c) => setMe((m) => (m ? { ...m, coins: c } : m)),
        pollNow: beat,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSession() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSession outside provider');
  return c;
}
