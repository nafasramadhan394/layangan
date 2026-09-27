import crypto from 'node:crypto';
import { q, one, tx } from './db.js';
import { bad, HttpError, sha256, type Ctx, requireUser } from './http.js';
import { rateLimit, str } from './anticheat.js';
import { SESSION_DAYS } from './config.js';
import { DEFAULT_AVATAR, DEFAULT_SETTINGS } from '../src/shared/gameData.js';
import { getRewards } from './economy.js';

export function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const h = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `scrypt$${salt}$${h}`;
}

export function verifyPassword(pw: string, stored: string) {
  const [alg, salt, hex] = stored.split('$');
  if (alg !== 'scrypt' || !salt || !hex) return false;
  const h = crypto.scryptSync(pw, salt, 64);
  const ref = Buffer.from(hex, 'hex');
  return ref.length === h.length && crypto.timingSafeEqual(ref, h);
}

async function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString('hex');
  await q(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + ($3 || ' days')::interval)`, [
    sha256(token),
    userId,
    String(SESSION_DAYS),
  ]);
  q(`DELETE FROM sessions WHERE user_id = $1 AND expires_at < now()`, [userId]).catch(() => {});
  return token;
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,16}$/;

export async function register(ctx: Ctx) {
  rateLimit(`reg:${ctx.ip}`, 8, 60 * 60 * 1000);
  const username = str(ctx.body.username, 'Username', 3, 16);
  const password = str(ctx.body.password, 'Password', 6, 72);
  if (!USERNAME_RE.test(username)) throw bad('Username hanya boleh huruf, angka, dan _ (3-16 karakter)');
  if (/^pilot\d+$/i.test(username) || /^(admin|owner|moderator|system)/i.test(username)) throw bad('Username tidak tersedia');
  const exists = await one('SELECT 1 FROM users WHERE username_lc = $1', [username.toLowerCase()]);
  if (exists) throw bad('Username sudah dipakai');
  const rewards = await getRewards();
  const userId = await tx(async (c) => {
    const r = await c.query(
      `INSERT INTO users (username, username_lc, pass_hash, coins, avatar, settings)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (username_lc) DO NOTHING RETURNING id`,
      [username, username.toLowerCase(), hashPassword(password), rewards.startCoins, DEFAULT_AVATAR, DEFAULT_SETTINGS],
    );
    if (!r.rows[0]) throw bad('Username sudah dipakai');
    const id = r.rows[0].id as number;
    const k = await c.query(
      `INSERT INTO kites (user_id, name, design, size) VALUES ($1, 'Layangan Pertamaku', $2, 1) RETURNING id`,
      [id, { style: 'diamond', colors: ['#e63946', '#ffffff', '#1d3557'], tail: true, tailColor: '#ffb703' }],
    );
    await c.query('UPDATE users SET selected_kite = $1 WHERE id = $2', [k.rows[0].id, id]);
    await c.query(`INSERT INTO inventory (user_id, item_id, qty) VALUES ($1, 'basic', 3)`, [id]);
    return id;
  });
  const token = await createSession(userId);
  return { token };
}

export async function login(ctx: Ctx) {
  rateLimit(`login:${ctx.ip}`, 20, 10 * 60 * 1000);
  const username = str(ctx.body.username, 'Username', 1, 32);
  const password = str(ctx.body.password, 'Password', 1, 72);
  const u = await one<{ id: number; pass_hash: string; banned: boolean; ban_reason: string | null; locked: boolean }>(
    `SELECT id, pass_hash, banned, ban_reason, (lock_until IS NOT NULL AND lock_until > now()) AS locked
     FROM users WHERE username_lc = $1`,
    [username.toLowerCase()],
  );
  if (!u) {
    crypto.scryptSync(password, 'dummy-salt-for-timing', 64);
    throw new HttpError(401, 'Username atau password salah');
  }
  if (u.locked) throw new HttpError(429, 'Terlalu banyak percobaan gagal. Coba lagi dalam 10 menit.');
  if (!verifyPassword(password, u.pass_hash)) {
    await q(
      `UPDATE users SET
        lock_until = CASE WHEN failed_logins + 1 >= 8 THEN now() + interval '10 minutes' ELSE lock_until END,
        failed_logins = CASE WHEN failed_logins + 1 >= 8 THEN 0 ELSE failed_logins + 1 END
       WHERE id = $1`,
      [u.id],
    );
    throw new HttpError(401, 'Username atau password salah');
  }
  if (u.banned) throw new HttpError(403, `Akun diblokir${u.ban_reason ? ': ' + u.ban_reason : ''}`);
  await q('UPDATE users SET failed_logins = 0, lock_until = NULL, last_seen = now() WHERE id = $1', [u.id]);
  const token = await createSession(u.id);
  return { token };
}

export async function logout(ctx: Ctx) {
  if (ctx.token) await q('DELETE FROM sessions WHERE token_hash = $1', [sha256(ctx.token)]);
  return { ok: true };
}

export async function changePassword(ctx: Ctx) {
  const u = await requireUser(ctx);
  rateLimit(`pw:${u.id}`, 5, 10 * 60 * 1000);
  const oldPw = str(ctx.body.oldPassword, 'Password lama', 1, 72);
  const newPw = str(ctx.body.newPassword, 'Password baru', 6, 72);
  const row = await one<{ pass_hash: string }>('SELECT pass_hash FROM users WHERE id = $1', [u.id]);
  if (!row || !verifyPassword(oldPw, row.pass_hash)) throw bad('Password lama salah');
  await q('UPDATE users SET pass_hash = $1 WHERE id = $2', [hashPassword(newPw), u.id]);
  await q('DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2', [u.id, sha256(ctx.token || '')]);
  return { ok: true };
}
