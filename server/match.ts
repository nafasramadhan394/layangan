import crypto from 'node:crypto';
import type pg from 'pg';
import { q, one, tx } from './db.js';
import { bad, HttpError, pubName, requireUser, type Ctx } from './http.js';
import { sanitizeInput } from './anticheat.js';
import { checkAchievements, eventMultipliers, getMap, getMaps, getRewards, resolveThread } from './economy.js';
import {
  COUNTDOWN_MS,
  MAX_FREE_PLAYERS,
  makePlayer,
  spawnX,
  stepMatch,
  type MapDef,
  type MatchState,
  type PState,
  type ResultEntry,
} from '../src/shared/sim.js';
import { DEFAULT_AVATAR } from '../src/shared/gameData.js';

const newId = (p: string) => p + crypto.randomBytes(6).toString('hex');

async function playerBase(c: pg.PoolClient, userId: number, consumeThread: boolean) {
  const u = (
    await c.query('SELECT id, username, role, avatar, selected_kite, equipped_thread FROM users WHERE id = $1', [userId])
  ).rows[0];
  if (!u) throw bad('Pemain tidak ditemukan');
  let kiteId = 0;
  let size = 1;
  if (u.selected_kite) {
    const k = (await c.query('SELECT id, size FROM kites WHERE id = $1 AND user_id = $2', [u.selected_kite, userId])).rows[0];
    if (k) {
      kiteId = k.id;
      size = Math.max(0.7, Math.min(1.4, Number(k.size) || 1));
    }
  }
  const th = await resolveThread(c, userId, u.equipped_thread, consumeThread);
  return {
    id: u.id as number,
    name: pubName(u),
    avatar: { ...DEFAULT_AVATAR, ...(u.avatar || {}) },
    kiteId,
    size,
    thread: th.id,
    threadName: th.name,
    threadColor: th.color,
    stats: th.stats,
  };
}

/** Remove a user from whatever match they're in (forfeit if in a live battle). */
export async function leaveCurrent(c: pg.PoolClient, userId: number) {
  const u = (await c.query('SELECT active_match FROM users WHERE id = $1 FOR UPDATE', [userId])).rows[0];
  if (!u?.active_match) return;
  await leaveMatchTx(c, userId, u.active_match);
}

async function leaveMatchTx(c: pg.PoolClient, userId: number, matchId: string) {
  const row = (await c.query('SELECT state, rewarded FROM matches WHERE id = $1 FOR UPDATE', [matchId])).rows[0];
  await c.query('UPDATE users SET active_match = NULL WHERE id = $1 AND active_match = $2', [userId, matchId]);
  if (!row) return;
  const s: MatchState = row.state;
  if (s.phase === 'ended') return;
  const now = Date.now();
  if (s.mode === 'free') {
    s.players = s.players.filter((p) => p.id !== userId);
  } else {
    const p = s.players.find((x) => x.id === userId);
    if (p && !p.left) {
      p.left = true;
      if (p.alive) {
        p.alive = false;
        s.cutOrder.push(p.id);
      }
      s.evn += 1;
      s.events.push({ n: s.evn, t: now, type: 'leave', a: p.id });
    }
  }
  stepMatch(s, now);
  const rewarded = await finalize(c, s, row.rewarded);
  await c.query('UPDATE matches SET state = $2, phase = $3, rewarded = $4, updated_at = now() WHERE id = $1', [
    matchId,
    s,
    s.phase,
    rewarded,
  ]);
}

export async function createBattle(c: pg.PoolClient, userIds: number[], map: MapDef) {
  const now = Date.now();
  const mul = await eventMultipliers(c);
  const id = newId('b_');
  const players: PState[] = [];
  for (let i = 0; i < userIds.length; i++) {
    await leaveCurrent(c, userIds[i]);
    const base = await playerBase(c, userIds[i], true);
    players.push(makePlayer(base, spawnX(map, i, userIds.length), map, now));
  }
  const s: MatchState = {
    id,
    mode: 'battle',
    map,
    seed: Math.floor(Math.random() * 1000) / 10,
    phase: 'countdown',
    startAt: now + COUNTDOWN_MS,
    endAt: 0,
    t: now,
    windMul: mul.wind,
    players,
    contacts: [],
    events: [],
    evn: 0,
    winner: null,
    result: null,
    cutOrder: [],
    lastGust: false,
  };
  await c.query('INSERT INTO matches (id, mode, map_id, phase, state, player_ids) VALUES ($1, $2, $3, $4, $5, $6)', [
    id,
    'battle',
    map.id,
    s.phase,
    s,
    userIds,
  ]);
  await c.query('UPDATE users SET active_match = $1 WHERE id = ANY($2::int[])', [id, userIds]);
  await c.query('DELETE FROM queue WHERE user_id = ANY($1::int[])', [userIds]);
  return id;
}

/** Server-side reward distribution. Runs exactly once per match (rewarded flag, row-locked). */
async function finalize(c: pg.PoolClient, s: MatchState, rewarded: boolean): Promise<boolean> {
  if (s.phase !== 'ended' || rewarded) return rewarded;
  if (s.mode === 'free') return true;
  const rewards = await getRewards(c);
  const mul = await eventMultipliers(c);
  const liveMs = Math.max(0, s.endAt - s.startAt);
  const order = [...s.cutOrder].reverse();
  const result: ResultEntry[] = [];
  const ranked = [
    ...(s.winner != null ? [s.winner] : []),
    ...order.filter((id) => id !== s.winner),
    ...s.players.map((p) => p.id).filter((id) => id !== s.winner && !order.includes(id)),
  ];
  for (let i = 0; i < ranked.length; i++) {
    const p = s.players.find((x) => x.id === ranked[i]);
    if (!p) continue;
    const win = p.id === s.winner;
    // anti-farming: a win only pays the win bonus if the match was actually contested
    const contested = p.kills > 0 || liveMs >= 30_000;
    let coins = p.left ? 0 : rewards.participation;
    coins += rewards.perCut * p.kills;
    if (win && contested) coins += rewards.win;
    coins = Math.round(coins * mul.coin);
    await c.query(
      `UPDATE users SET coins = coins + $2, wins = wins + $3, losses = losses + $4, matches = matches + 1, cuts = cuts + $5,
        active_match = CASE WHEN active_match = $6 THEN NULL ELSE active_match END WHERE id = $1`,
      [p.id, coins, win ? 1 : 0, win ? 0 : 1, p.kills, s.id],
    );
    await checkAchievements(c, p.id);
    result.push({ id: p.id, name: p.name, place: i + 1, win, coins, cuts: p.kills });
  }
  s.result = result;
  return true;
}

function r1(n: number) {
  return Math.round(n * 10) / 10;
}

export function publicState(s: MatchState, userId: number) {
  return {
    id: s.id,
    mode: s.mode,
    map: s.map,
    seed: s.seed,
    phase: s.phase,
    startAt: s.startAt,
    endAt: s.endAt,
    t: s.t,
    windMul: s.windMul,
    now: Date.now(),
    you: userId,
    players: s.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      kiteId: p.kiteId,
      size: p.size,
      thread: p.thread,
      threadName: p.threadName,
      threadColor: p.threadColor,
      stats: p.stats,
      px: r1(p.px),
      kx: r1(p.kx),
      ky: r1(p.ky),
      vx: r1(p.vx),
      vy: r1(p.vy),
      a: Math.round(p.a * 1000) / 1000,
      L: r1(p.L),
      hp: r1(p.hp),
      alive: p.alive,
      left: p.left,
      respawnAt: p.respawnAt,
      input: p.input,
      kills: p.kills,
      tension: r1(p.tension),
      eng: p.eng,
    })),
    contacts: s.contacts,
    events: s.events,
    winner: s.winner,
    result: s.result,
  };
}

/** The realtime tick endpoint: apply this player's input, advance the
 *  authoritative simulation to "now", persist and return the snapshot. */
export async function sync(ctx: Ctx) {
  const u = await requireUser(ctx);
  const matchId = String(ctx.body.matchId || '');
  const input = sanitizeInput(ctx.body.input);
  return tx(async (c) => {
    const row = (await c.query('SELECT state, rewarded FROM matches WHERE id = $1 FOR UPDATE', [matchId])).rows[0];
    if (!row) throw new HttpError(404, 'Pertandingan tidak ditemukan');
    const s: MatchState = row.state;
    const p = s.players.find((x) => x.id === u.id);
    if (!p) throw new HttpError(403, 'Kamu bukan peserta pertandingan ini');
    const now = Date.now();
    if (!p.left) {
      p.input = input;
      p.lastSeen = now;
    }
    const before = s.phase;
    stepMatch(s, now);
    const rewarded = await finalize(c, s, row.rewarded);
    await c.query('UPDATE matches SET state = $2, phase = $3, rewarded = $4, updated_at = now() WHERE id = $1', [
      matchId,
      s,
      s.phase,
      rewarded,
    ]);
    if (before !== 'ended' && s.phase === 'ended') {
      await c.query('UPDATE users SET active_match = NULL WHERE active_match = $1', [matchId]);
    }
    return publicState(s, u.id);
  });
}

export async function leave(ctx: Ctx) {
  const u = await requireUser(ctx);
  const matchId = String(ctx.body.matchId || '');
  await tx(async (c) => {
    const s = (await c.query('SELECT state FROM matches WHERE id = $1', [matchId])).rows[0]?.state as MatchState | undefined;
    if (!s || !s.players.some((p) => p.id === u.id)) {
      await c.query('UPDATE users SET active_match = NULL WHERE id = $1 AND active_match = $2', [u.id, matchId]);
      return;
    }
    await leaveMatchTx(c, u.id, matchId);
  });
  return { ok: true };
}

/** Join (or auto-create) a public free-flight room. Friends can join the same room by id. */
export async function joinFree(ctx: Ctx) {
  const u = await requireUser(ctx);
  const roomId = typeof ctx.body.roomId === 'string' ? ctx.body.roomId : '';
  let mapId = typeof ctx.body.mapId === 'string' ? ctx.body.mapId : '';
  return tx(async (c) => {
    const me = (await c.query('SELECT active_match FROM users WHERE id = $1 FOR UPDATE', [u.id])).rows[0];
    if (me?.active_match) {
      const cur = (await c.query('SELECT mode, phase FROM matches WHERE id = $1', [me.active_match])).rows[0];
      if (cur && cur.mode === 'battle' && cur.phase !== 'ended') throw bad('Kamu sedang dalam pertandingan');
      if (cur && cur.mode === 'free' && cur.phase !== 'ended' && (!roomId || roomId === me.active_match)) {
        return { matchId: me.active_match };
      }
      await leaveMatchTx(c, u.id, me.active_match);
    }
    await c.query('DELETE FROM queue WHERE user_id = $1', [u.id]);
    let targetId: string | null = null;
    if (roomId) {
      const r = (await c.query(`SELECT id, state FROM matches WHERE id = $1 AND mode = 'free' AND phase <> 'ended'`, [roomId])).rows[0];
      if (!r) throw bad('Room sudah tidak aktif');
      if (r.state.players.length >= MAX_FREE_PLAYERS) throw bad('Room penuh');
      targetId = r.id;
    } else {
      if (!mapId) mapId = (await getMaps(c))[0]?.id || 'desa';
      const r = (
        await c.query(
          `SELECT id FROM matches WHERE mode = 'free' AND phase <> 'ended' AND map_id = $1 AND updated_at > now() - interval '30 seconds'
           AND jsonb_array_length(state->'players') < $2 ORDER BY created_at LIMIT 1`,
          [mapId, MAX_FREE_PLAYERS],
        )
      ).rows[0];
      targetId = r?.id || null;
    }
    const now = Date.now();
    const base = await playerBase(c, u.id, false);
    if (!targetId) {
      const map = await getMap(mapId, c);
      if (!map) throw bad('Map tidak tersedia');
      const mul = await eventMultipliers(c);
      const id = newId('f_');
      const s: MatchState = {
        id,
        mode: 'free',
        map,
        seed: Math.floor(Math.random() * 1000) / 10,
        phase: 'live',
        startAt: now,
        endAt: 0,
        t: now,
        windMul: mul.wind,
        players: [makePlayer(base, spawnX(map, 1, 3), map, now)],
        contacts: [],
        events: [],
        evn: 0,
        winner: null,
        result: null,
        cutOrder: [],
        lastGust: false,
      };
      await c.query('INSERT INTO matches (id, mode, map_id, phase, state, player_ids) VALUES ($1, $2, $3, $4, $5, $6)', [
        id,
        'free',
        map.id,
        'live',
        s,
        [u.id],
      ]);
      await c.query('UPDATE users SET active_match = $1 WHERE id = $2', [id, u.id]);
      return { matchId: id };
    }
    const row = (await c.query('SELECT state FROM matches WHERE id = $1 FOR UPDATE', [targetId])).rows[0];
    const s: MatchState = row.state;
    stepMatch(s, now);
    if (s.phase === 'ended') throw bad('Room sudah tidak aktif, coba lagi');
    s.players = s.players.filter((p) => p.id !== u.id);
    const x = s.map.spawn[0] + Math.random() * (s.map.spawn[1] - s.map.spawn[0]);
    s.players.push(makePlayer(base, x, s.map, now));
    s.evn += 1;
    s.events.push({ n: s.evn, t: now, type: 'join', a: u.id });
    await c.query(
      'UPDATE matches SET state = $2, player_ids = array_append(array_remove(player_ids, $3), $3), updated_at = now() WHERE id = $1',
      [targetId, s, u.id],
    );
    await c.query('UPDATE users SET active_match = $1 WHERE id = $2', [targetId, u.id]);
    return { matchId: targetId };
  });
}

export async function freeRooms(ctx: Ctx) {
  await requireUser(ctx);
  const rows = await q(
    `SELECT id, map_id, jsonb_array_length(state->'players') AS n FROM matches
     WHERE mode = 'free' AND phase <> 'ended' AND updated_at > now() - interval '30 seconds' ORDER BY created_at DESC LIMIT 20`,
  );
  return { rooms: rows };
}

export async function matchInfo(ctx: Ctx) {
  const u = await requireUser(ctx);
  const m = await one<{ state: MatchState }>('SELECT state FROM matches WHERE id = $1', [String(ctx.body.matchId || '')]);
  if (!m || !m.state.players.some((p) => p.id === u.id)) throw new HttpError(404, 'Pertandingan tidak ditemukan');
  return publicState(m.state, u.id);
}
