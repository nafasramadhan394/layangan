import { q, tx } from './db.js';
import { bad, HttpError, requireUser, type Ctx } from './http.js';
import { rateLimit } from './anticheat.js';
import { getMap, getMaps } from './economy.js';
import { createBattle, leaveCurrent } from './match.js';
import { findUser } from './users.js';
import { INVITE_TTL_S, ONLINE_WINDOW_S } from './config.js';
import { MAX_BATTLE_PLAYERS } from '../src/shared/sim.js';

async function assertNotInBattle(c: any, userId: number) {
  const u = (await c.query('SELECT active_match FROM users WHERE id = $1', [userId])).rows[0];
  if (!u?.active_match) return;
  const m = (await c.query('SELECT mode, phase FROM matches WHERE id = $1', [u.active_match])).rows[0];
  if (m && m.mode === 'battle' && m.phase !== 'ended') throw bad('Sedang dalam pertandingan');
}

export async function joinQueue(ctx: Ctx) {
  const u = await requireUser(ctx);
  const mapId = String(ctx.body.mapId || 'any');
  if (mapId !== 'any' && !(await getMap(mapId))) throw bad('Map tidak tersedia');
  await tx(async (c) => {
    await assertNotInBattle(c, u.id);
    await leaveCurrent(c, u.id);
    await c.query(
      `INSERT INTO queue (user_id, map_id) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET map_id = EXCLUDED.map_id, joined_at = now(), last_poll = now()`,
      [u.id, mapId],
    );
  });
  return pollQueue(ctx);
}

export async function leaveQueue(ctx: Ctx) {
  const u = await requireUser(ctx);
  await q('DELETE FROM queue WHERE user_id = $1', [u.id]);
  return { ok: true };
}

/** Poll matchmaking. Pairing happens server-side under an advisory lock. */
export async function pollQueue(ctx: Ctx) {
  const u = await requireUser(ctx);
  return tx(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(55501)');
    const mine = (await c.query('SELECT active_match FROM users WHERE id = $1', [u.id])).rows[0];
    if (mine?.active_match) {
      const m = (await c.query('SELECT mode, phase FROM matches WHERE id = $1', [mine.active_match])).rows[0];
      if (m && m.mode === 'battle' && m.phase !== 'ended') {
        await c.query('DELETE FROM queue WHERE user_id = $1', [u.id]);
        return { matched: mine.active_match };
      }
    }
    const upd = await c.query('UPDATE queue SET last_poll = now() WHERE user_id = $1 RETURNING map_id', [u.id]);
    if (!upd.rows[0]) return { matched: null, inQueue: false, searching: 0 };
    await c.query(`DELETE FROM queue WHERE last_poll < now() - interval '8 seconds'`);
    const rows = (
      await c.query(`SELECT user_id, map_id, extract(epoch from (now() - joined_at)) AS waited FROM queue ORDER BY joined_at`)
    ).rows as { user_id: number; map_id: string; waited: number }[];

    const used = new Set<number>();
    for (const head of rows) {
      if (used.has(head.user_id)) continue;
      let mapPref = head.map_id;
      const group = [head];
      for (const o of rows) {
        if (o === head || used.has(o.user_id) || group.length >= MAX_BATTLE_PLAYERS) continue;
        if (mapPref === 'any' || o.map_id === 'any' || o.map_id === mapPref) {
          group.push(o);
          if (mapPref === 'any' && o.map_id !== 'any') mapPref = o.map_id;
        }
      }
      const ready = group.length >= MAX_BATTLE_PLAYERS || (group.length >= 2 && Number(head.waited) >= 4);
      if (!ready) continue;
      let map = mapPref !== 'any' ? await getMap(mapPref, c) : null;
      if (!map) {
        const maps = await getMaps(c);
        map = maps[Math.floor(Math.random() * maps.length)];
      }
      if (!map) continue;
      group.forEach((g) => used.add(g.user_id));
      await createBattle(
        c,
        group.map((g) => g.user_id),
        map,
      );
    }
    const me2 = (await c.query('SELECT active_match FROM users WHERE id = $1', [u.id])).rows[0];
    const stillQueued = rows.some((r) => r.user_id === u.id) && !used.has(u.id);
    if (used.has(u.id)) return { matched: me2?.active_match || null };
    return { matched: null, inQueue: stillQueued, searching: rows.length };
  });
}

/** Invite a friend (by id) or challenge any online player (by username). */
export async function sendInvite(ctx: Ctx) {
  const u = await requireUser(ctx);
  rateLimit(`inv:${u.id}`, 20, 60 * 1000);
  const mapId = String(ctx.body.mapId || '');
  const map = mapId && mapId !== 'any' ? await getMap(mapId) : (await getMaps())[0];
  if (!map) throw bad('Map tidak tersedia');
  let target: { id: number; role: string; banned: boolean; last_seen: string | null } | null = null;
  let kind = 'challenge';
  if (ctx.body.friendId) {
    const fid = Number(ctx.body.friendId);
    const f = await q(
      `SELECT 1 FROM friendships WHERE status = 'accepted' AND ((requester = $1 AND addressee = $2) OR (requester = $2 AND addressee = $1))`,
      [u.id, fid],
    );
    if (!f.length) throw bad('Hanya bisa mengundang teman');
    target = (await q('SELECT id, role, banned, last_seen FROM users WHERE id = $1', [fid]))[0] || null;
    kind = 'friend';
  } else if (ctx.body.playerId) {
    target = (await q('SELECT id, role, banned, last_seen FROM users WHERE id = $1', [Number(ctx.body.playerId)]))[0] || null;
  } else {
    const f = await findUser(ctx.body.username);
    target = f && f.role !== 'owner' ? f : null;
  }
  if (!target || target.banned) throw new HttpError(404, 'Pemain tidak ditemukan');
  if (target.id === u.id) throw bad('Tidak bisa menantang diri sendiri');
  const online = target.last_seen && Date.now() - new Date(target.last_seen).getTime() < ONLINE_WINDOW_S * 1000;
  if (!online) throw bad('Pemain sedang offline');
  const pending = await q(
    `SELECT id FROM invites WHERE from_user = $1 AND to_user = $2 AND status = 'pending' AND created_at > now() - ($3 || ' seconds')::interval`,
    [u.id, target.id, String(INVITE_TTL_S)],
  );
  if (pending.length) throw bad('Undangan sudah dikirim, tunggu jawaban');
  const r = await q('INSERT INTO invites (from_user, to_user, map_id, kind) VALUES ($1, $2, $3, $4) RETURNING id', [
    u.id,
    target.id,
    map.id,
    kind,
  ]);
  return { inviteId: r[0].id };
}

export async function respondInvite(ctx: Ctx) {
  const u = await requireUser(ctx);
  const id = Number(ctx.body.inviteId);
  const accept = ctx.body.accept === true;
  return tx(async (c) => {
    const inv = (
      await c.query(
        `SELECT * FROM invites WHERE id = $1 AND to_user = $2 AND status = 'pending'
         AND created_at > now() - ($3 || ' seconds')::interval FOR UPDATE`,
        [id, u.id, String(INVITE_TTL_S)],
      )
    ).rows[0];
    if (!inv) throw bad('Undangan sudah kedaluwarsa');
    if (!accept) {
      await c.query(`UPDATE invites SET status = 'rejected' WHERE id = $1`, [id]);
      return { matchId: null };
    }
    // lock both players in a stable order to avoid deadlocks
    const ids = [inv.from_user, u.id].sort((a: number, b: number) => a - b);
    await c.query('SELECT id FROM users WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE', [ids]);
    await assertNotInBattle(c, inv.from_user).catch(() => {
      throw bad('Pengirim sedang dalam pertandingan lain');
    });
    await assertNotInBattle(c, u.id);
    const map = (await getMap(inv.map_id, c)) || (await getMaps(c))[0];
    const matchId = await createBattle(c, [inv.from_user, u.id], map);
    await c.query(`UPDATE invites SET status = 'accepted', match_id = $2 WHERE id = $1`, [id, matchId]);
    return { matchId };
  });
}

export async function cancelInvite(ctx: Ctx) {
  const u = await requireUser(ctx);
  await q(`UPDATE invites SET status = 'cancelled' WHERE id = $1 AND from_user = $2 AND status = 'pending'`, [Number(ctx.body.inviteId), u.id]);
  return { ok: true };
}
