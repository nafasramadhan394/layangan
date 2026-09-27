const TOKEN_KEY = 'lb_token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, msg: string) {
    super(msg);
    this.status = status;
  }
}

type Listener = () => void;
const unauthListeners = new Set<Listener>();
export function onUnauthorized(l: Listener) {
  unauthListeners.add(l);
  return () => unauthListeners.delete(l);
}

export async function api<T = any>(path: string, body: Record<string, unknown> = {}, opts: { signal?: AbortSignal } = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`/api/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'Koneksi terputus. Periksa internet kamu.');
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    if (res.status === 401 && token && path !== 'auth/login') unauthListeners.forEach((l) => l());
    throw new ApiError(res.status, data?.error || `Error ${res.status}`);
  }
  return data as T;
}
