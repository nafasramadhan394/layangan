import crypto from 'node:crypto';
import { one, q } from './db.js';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const bad = (msg: string) => new HttpError(400, msg);

export interface UserRow {
  id: number;
  username: string;
  role: string;
  coins: number;
  wins: number;
  losses: number;
  matches: number;
  cuts: number;
  avatar: Record<string, string>;
  settings: Record<string, unknown>;
  selected_kite: number | null;
  equipped_thread: string;
  banned: boolean;
  ban_reason: string | null;
  last_seen: string | null;
  last_daily_day: number | null;
  active_match: string | null;
  created_at: string;
}

export interface Ctx {
  body: Record<string, any>;
  token: string | null;
  ip: string;
  user: UserRow | null;
}

export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

// Never select pass_hash along with user data returned to handlers.
export const USER_COLS = `u.id, u.username, u.role, u.coins, u.wins, u.losses, u.matches, u.cuts, u.avatar, u.settings,
  u.selected_kite, u.equipped_thread, u.banned, u.ban_reason, u.last_seen, u.last_daily_day, u.active_match, u.created_at`;

export async function loadUser(ctx: Ctx): Promise<UserRow | null> {
  if (ctx.user) return ctx.user;
  if (!ctx.token || ctx.token.length < 20 || ctx.token.length > 200) return null;
  const u = await one<UserRow & { stale: boolean }>(
    `SELECT ${USER_COLS}, (u.last_seen IS NULL OR u.last_seen < now() - interval '10 seconds') AS stale
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(ctx.token)],
  );
  if (!u) return null;
  if (u.stale) {
    q('UPDATE users SET last_seen = now() WHERE id = $1', [u.id]).catch(() => {});
  }
  ctx.user = u;
  return u;
}

export async function requireUser(ctx: Ctx): Promise<UserRow> {
  const u = await loadUser(ctx);
  if (!u) throw new HttpError(401, 'Sesi berakhir, silakan login kembali.');
  if (u.banned) throw new HttpError(403, `Akun diblokir${u.ban_reason ? ': ' + u.ban_reason : ''}`);
  return u;
}

/** Permission check happens on the server for every owner endpoint. */
export async function requireOwner(ctx: Ctx): Promise<UserRow> {
  const u = await requireUser(ctx);
  if (u.role !== 'owner' && u.role !== 'admin') throw new HttpError(403, 'Tidak diizinkan.');
  return u;
}

/** Public-facing display name. The owner's real username is never exposed publicly. */
export function pubName(u: { id: number; username: string; role: string }) {
  return u.role === 'owner' ? `Pilot${1000 + u.id}` : u.username;
}
