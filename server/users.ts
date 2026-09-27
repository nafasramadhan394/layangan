import { q, one, tx } from './db.js';
import { bad, HttpError, pubName, requireUser, type Ctx } from './http.js';
import { color, str } from './anticheat.js';
import { activeEvents, checkAchievements, eventMultipliers, getRewards, wibDay } from './economy.js';
import { ONLINE_WINDOW_S, INVITE_TTL_S } from './config.js';
import { AVATAR_HATS, DEFAULT_AVATAR, DEFAULT_SETTINGS } from '../src/shared/gameData.js';

export async function me(ctx: Ctx) {
  const u = await requireUser(ctx);
  const kite = u.selected_kite
    ? await one('SELECT id, name, image, design, size FROM kites WHERE id = $1 AND user_id = $2', [u.selected_kite, u.id])
    : null;
  const inv = await q<{ item_id: string; qty: number }>('SELECT item_id, qty FROM inventory WHERE user_id = $1 AND qty > 0', [u.id]);
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    isOwner: u.role === 'owner' || u.role === 'admin',
    coins: u.coins,
    wins: u.wins,
    losses: u.losses,
    matches: u.matches,
    cuts: u.cuts,
    avatar: { ...DEFAULT_AVATAR, ...u.avatar },
    settings: { ...DEFAULT_SETTINGS, ...u.settings },
    selectedKite: kite,
    equippedThread: u.equipped_thread,
    inventory: inv,
    activeMatch: u.active_match,
    dailyAvailable: u.last_daily_day !== wibDay(),
    createdAt: u.created_at,
  };
}

export async function heartbeat(ctx: Ctx) {
  const u = await requireUser(ctx);
  await q('UPDATE users SET last_seen = now() WHERE id = $1', [u.id]);
  const invites = await q(
    `SELECT i.id, i.map_id, i.kind, i.created_at, f.id AS from_id, f.username, f.role, f.avatar
     FROM invites i JOIN users f ON f.id = i.from_user
     WHERE i.to_user = $1 AND i.status = 'pending' AND i.created_at > now() - ($2 || ' seconds')::interval
     ORDER BY i.created_at DESC LIMIT 5`,
    [u.id, String(INVITE_TTL_S)],
  );
  const outgoing = await q(
    `SELECT i.id, i.status, i.match_id, t.id AS to_id, t.username, t.role FROM invites i JOIN users t ON t.id = i.to_user
     WHERE i.from_user = $1 AND i.created_at > now() - ($2 || ' seconds')::interval ORDER BY i.created_at DESC LIMIT 5`,
    [u.id, String(INVITE_TTL_S)],
  );
  const fr = await one<{ n: number }>(`SELECT count(*)::int AS n FROM friendships WHERE addressee = $1 AND status = 'pending'`, [u.id]);
  const ann = await q('SELECT id, text, created_at FROM announcements WHERE active ORDER BY created_at DESC LIMIT 3');
  let activeMatch: { id: string; mode: string; phase: string } | null = null;
  if (u.active_match) {
    const m = await one<{ id: string; mode: string; phase: string }>('SELECT id, mode, phase FROM matches WHERE id = $1', [u.active_match]);
    if (m && m.phase !== 'ended') activeMatch = m;
    else await q('UPDATE users SET active_match = NULL WHERE id = $1 AND active_match = $2', [u.id, u.active_match]);
  }
  return {
    coins: u.coins,
    wins: u.wins,
    losses: u.losses,
    invites: invites.map((i: any) => ({
      id: i.id,
      mapId: i.map_id,
      kind: i.kind,
      from: { id: i.from_id, name: pubName({ id: i.from_id, username: i.username, role: i.role }), avatar: i.avatar },
      createdAt: i.created_at,
    })),
    outgoing: outgoing.map((o: any) => ({
      id: o.id,
      status: o.status,
      matchId: o.match_id,
      to: pubName({ id: o.to_id, username: o.username, role: o.role }),
    })),
    friendRequests: fr?.n || 0,
    announcements: ann,
    events: await activeEvents(),
    activeMatch,
  };
}

export async function saveSettings(ctx: Ctx) {
  const u = await requireUser(ctx);
  const s = ctx.body.settings || {};
  const settings = {
    volume: Math.max(0, Math.min(1, Number(s.volume) || 0)),
    sfx: s.sfx !== false,
    windSound: s.windSound !== false,
    quality: ['auto', 'low', 'high'].includes(s.quality) ? s.quality : 'auto',
    leftHanded: s.leftHanded === true,
  };
  await q('UPDATE users SET settings = $1 WHERE id = $2', [settings, u.id]);
  return { settings };
}

export async function saveAvatar(ctx: Ctx) {
  const u = await requireUser(ctx);
  const a = ctx.body.avatar || {};
  const avatar = {
    color: color(a.color, DEFAULT_AVATAR.color),
    skin: color(a.skin, DEFAULT_AVATAR.skin),
    hat: AVATAR_HATS.includes(a.hat) ? a.hat : 'none',
  };
  await q('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, u.id]);
  return { avatar };
}

export async function claimDaily(ctx: Ctx) {
  const u = await requireUser(ctx);
  const day = wibDay();
  const rewards = await getRewards();
  const mul = await eventMultipliers();
  const amount = Math.round(rewards.daily * mul.coin);
  return tx(async (c) => {
    const r = await c.query(
      `UPDATE users SET coins = coins + $1, last_daily_day = $2
       WHERE id = $3 AND (last_daily_day IS NULL OR last_daily_day <> $2) RETURNING coins`,
      [amount, day, u.id],
    );
    if (!r.rows[0]) throw bad('Daily reward sudah diklaim hari ini. Kembali besok!');
    const ach = await checkAchievements(c, u.id);
    return { amount, coins: r.rows[0].coins, achievements: ach };
  });
}

export async function claimEvent(ctx: Ctx) {
  const u = await requireUser(ctx);
  const id = Number(ctx.body.eventId);
  return tx(async (c) => {
    const ev = (
      await c.query(`SELECT id, claim_bonus FROM events WHERE id = $1 AND active AND starts_at <= now() AND ends_at > now()`, [id])
    ).rows[0];
    if (!ev || ev.claim_bonus <= 0) throw bad('Event tidak tersedia');
    const ins = await c.query('INSERT INTO event_claims (event_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING event_id', [
      id,
      u.id,
    ]);
    if (!ins.rows[0]) throw bad('Bonus event sudah diklaim');
    const r = await c.query('UPDATE users SET coins = coins + $1 WHERE id = $2 RETURNING coins', [ev.claim_bonus, u.id]);
    return { amount: ev.claim_bonus, coins: r.rows[0].coins };
  });
}

export async function eventsList(ctx: Ctx) {
  const u = await requireUser(ctx);
  const ev = await activeEvents();
  const claimed = await q<{ event_id: number }>('SELECT event_id FROM event_claims WHERE user_id = $1', [u.id]);
  const set = new Set(claimed.map((c) => c.event_id));
  return { events: ev.map((e) => ({ ...e, claimed: set.has(e.id) })) };
}

/** Public profile (own or other player). Never includes credentials. */
export async function profile(ctx: Ctx) {
  const me = await requireUser(ctx);
  const name = typeof ctx.body.username === 'string' ? ctx.body.username.trim().toLowerCase() : '';
  let target: any;
  if (!name) target = me;
  else {
    target = await one(
      `SELECT id, username, role, wins, losses, matches, cuts, avatar, selected_kite, last_seen, created_at FROM users WHERE username_lc = $1`,
      [name],
    );
    if (!target || (target.role === 'owner' && target.id !== me.id)) throw new HttpError(404, 'Pemain tidak ditemukan');
  }
  const kites = await q('SELECT id, name, image, design, size FROM kites WHERE user_id = $1 ORDER BY id', [target.id]);
  const ach = await q('SELECT code, unlocked_at FROM achievements WHERE user_id = $1', [target.id]);
  const online = target.last_seen ? Date.now() - new Date(target.last_seen).getTime() < ONLINE_WINDOW_S * 1000 : false;
  return {
    id: target.id,
    username: target.id === me.id ? target.username : pubName(target),
    avatar: { ...DEFAULT_AVATAR, ...target.avatar },
    wins: target.wins,
    losses: target.losses,
    matches: target.matches,
    cuts: target.cuts,
    selectedKite: target.selected_kite,
    kites,
    achievements: ach,
    online,
    isSelf: target.id === me.id,
    createdAt: target.created_at,
  };
}

export async function publicUserName(id: number) {
  const u = await one<{ id: number; username: string; role: string }>('SELECT id, username, role FROM users WHERE id = $1', [id]);
  return u ? pubName(u) : 'Pemain';
}

export async function findUser(username: string) {
  const name = str(username, 'Username', 1, 32).toLowerCase();
  return one<{ id: number; username: string; role: string; banned: boolean; last_seen: string | null }>(
    'SELECT id, username, role, banned, last_seen FROM users WHERE username_lc = $1',
    [name],
  );
}
