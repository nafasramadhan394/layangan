import { q, one, tx } from './db.js';
import { bad, HttpError, pubName, requireUser, type Ctx } from './http.js';
import { rateLimit } from './anticheat.js';
import { checkAchievements } from './economy.js';
import { findUser } from './users.js';
import { ONLINE_WINDOW_S } from './config.js';
import { DEFAULT_AVATAR } from '../src/shared/gameData.js';

export async function listFriends(ctx: Ctx) {
  const u = await requireUser(ctx);
  const rows = await q(
    `SELECT f.id AS fid, f.status, f.requester, o.id, o.username, o.role, o.avatar, o.last_seen, o.active_match, o.wins, o.losses,
            m.mode AS match_mode, m.phase AS match_phase, m.map_id AS match_map
     FROM friendships f
     JOIN users o ON o.id = CASE WHEN f.requester = $1 THEN f.addressee ELSE f.requester END
     LEFT JOIN matches m ON m.id = o.active_match
     WHERE (f.requester = $1 OR f.addressee = $1)
     ORDER BY o.last_seen DESC NULLS LAST`,
    [u.id],
  );
  const now = Date.now();
  const map = (r: any) => {
    const online = !!r.last_seen && now - new Date(r.last_seen).getTime() < ONLINE_WINDOW_S * 1000;
    const inMatch = online && r.active_match && r.match_phase && r.match_phase !== 'ended';
    return {
      friendshipId: r.fid,
      id: r.id,
      username: pubName(r),
      avatar: { ...DEFAULT_AVATAR, ...r.avatar },
      online,
      wins: r.wins,
      losses: r.losses,
      status: inMatch ? (r.match_mode === 'free' ? 'free' : 'battle') : online ? 'online' : 'offline',
      room: inMatch && r.match_mode === 'free' ? r.active_match : null,
      roomMap: inMatch ? r.match_map : null,
    };
  };
  return {
    friends: rows.filter((r: any) => r.status === 'accepted').map(map),
    incoming: rows.filter((r: any) => r.status === 'pending' && r.requester !== u.id).map(map),
    outgoing: rows.filter((r: any) => r.status === 'pending' && r.requester === u.id).map(map),
  };
}

export async function requestFriend(ctx: Ctx) {
  const u = await requireUser(ctx);
  rateLimit(`fr:${u.id}`, 20, 60 * 60 * 1000);
  const target = await findUser(ctx.body.username);
  if (!target || target.role === 'owner') throw new HttpError(404, 'Pemain tidak ditemukan');
  if (target.id === u.id) throw bad('Tidak bisa menambahkan diri sendiri');
  const existing = await one<{ id: number; status: string; requester: number }>(
    `SELECT id, status, requester FROM friendships WHERE (requester = $1 AND addressee = $2) OR (requester = $2 AND addressee = $1)`,
    [u.id, target.id],
  );
  if (existing) {
    if (existing.status === 'accepted') throw bad('Kalian sudah berteman');
    if (existing.requester === u.id) throw bad('Permintaan sudah dikirim');
    // they already requested me -> accept
    await q(`UPDATE friendships SET status = 'accepted' WHERE id = $1`, [existing.id]);
    await checkAchievements(undefined, u.id).catch(() => {});
    return { ok: true, accepted: true };
  }
  const count = await one<{ n: number }>(`SELECT count(*)::int AS n FROM friendships WHERE requester = $1 AND status = 'pending'`, [u.id]);
  if ((count?.n || 0) >= 30) throw bad('Terlalu banyak permintaan tertunda');
  await q('INSERT INTO friendships (requester, addressee) VALUES ($1, $2) ON CONFLICT DO NOTHING', [u.id, target.id]);
  return { ok: true, accepted: false };
}

export async function respondFriend(ctx: Ctx) {
  const u = await requireUser(ctx);
  const id = Number(ctx.body.friendshipId);
  const accept = ctx.body.accept === true;
  return tx(async (c) => {
    const f = (await c.query(`SELECT * FROM friendships WHERE id = $1 AND addressee = $2 AND status = 'pending' FOR UPDATE`, [id, u.id]))
      .rows[0];
    if (!f) throw bad('Permintaan tidak ditemukan');
    if (accept) {
      await c.query(`UPDATE friendships SET status = 'accepted' WHERE id = $1`, [id]);
      await checkAchievements(c, u.id);
      await checkAchievements(c, f.requester);
    } else {
      await c.query('DELETE FROM friendships WHERE id = $1', [id]);
    }
    return { ok: true };
  });
}

export async function removeFriend(ctx: Ctx) {
  const u = await requireUser(ctx);
  const id = Number(ctx.body.friendshipId);
  await q('DELETE FROM friendships WHERE id = $1 AND (requester = $2 OR addressee = $2)', [id, u.id]);
  return { ok: true };
}
