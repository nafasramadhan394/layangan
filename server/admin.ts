import { q, one, tx } from './db.js';
import { bad, requireOwner, type Ctx } from './http.js';
import { cleanText, color, int, num, sanitizeDesign, str, validateKiteImage } from './anticheat.js';
import { getItems, getMaps, getRewards } from './economy.js';
import { DEFAULT_REWARDS, THEMES, WEATHERS, type ItemDef } from '../src/shared/gameData.js';
import type { MapDef, MatchState } from '../src/shared/sim.js';

// Every function here calls requireOwner() first — permission is enforced on the server.

export async function overview(ctx: Ctx) {
  await requireOwner(ctx);
  const stats = await one(
    `SELECT (SELECT count(*)::int FROM users) AS users,
            (SELECT count(*)::int FROM users WHERE last_seen > now() - interval '30 seconds') AS online,
            (SELECT count(*)::int FROM users WHERE banned) AS banned,
            (SELECT count(*)::int FROM queue) AS queue,
            (SELECT count(*)::int FROM matches WHERE phase = 'ended' AND mode = 'battle') AS finished`,
  );
  const rows = await q<{ id: string; mode: string; map_id: string; phase: string; state: MatchState; created_at: string; updated_at: string }>(
    `SELECT id, mode, map_id, phase, state, created_at, updated_at FROM matches
     WHERE phase <> 'ended' AND updated_at > now() - interval '60 seconds' ORDER BY created_at DESC LIMIT 50`,
  );
  const ids = [...new Set(rows.flatMap((r) => r.state.players.map((p) => p.id)))];
  const names = ids.length ? await q<{ id: number; username: string }>('SELECT id, username FROM users WHERE id = ANY($1::int[])', [ids]) : [];
  const nm = new Map(names.map((n) => [n.id, n.username]));
  return {
    stats,
    servers: rows.map((r) => ({
      id: r.id,
      mode: r.mode,
      map: r.state.map.name,
      phase: r.phase,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      players: r.state.players.map((p) => ({ id: p.id, username: nm.get(p.id) || p.name, alive: p.alive, hp: Math.round(p.hp) })),
    })),
  };
}

export async function endMatch(ctx: Ctx) {
  await requireOwner(ctx);
  const id = String(ctx.body.matchId || '');
  await tx(async (c) => {
    const row = (await c.query('SELECT state FROM matches WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!row) throw bad('Server tidak ditemukan');
    const s: MatchState = row.state;
    s.phase = 'ended';
    s.endAt = Date.now();
    s.result = s.result || [];
    await c.query(`UPDATE matches SET state = $2, phase = 'ended', rewarded = true, updated_at = now() WHERE id = $1`, [id, s]);
    await c.query('UPDATE users SET active_match = NULL WHERE active_match = $1', [id]);
  });
  return { ok: true };
}

export async function players(ctx: Ctx) {
  await requireOwner(ctx);
  const search = typeof ctx.body.search === 'string' ? ctx.body.search.trim().toLowerCase() : '';
  const rows = await q(
    `SELECT id, username, role, coins, wins, losses, matches, cuts, banned, ban_reason, last_seen, created_at
     FROM users WHERE ($1 = '' OR username_lc LIKE '%' || $1 || '%') ORDER BY last_seen DESC NULLS LAST LIMIT 100`,
    [search],
  );
  return { players: rows };
}

export async function setCoins(ctx: Ctx) {
  await requireOwner(ctx);
  const userId = int(ctx.body.userId, 'User', 1, 1e9);
  const mode = ctx.body.mode === 'set' ? 'set' : 'add';
  const amount = int(ctx.body.amount, 'Jumlah', mode === 'set' ? 0 : -10_000_000, 10_000_000);
  const r =
    mode === 'set'
      ? await q('UPDATE users SET coins = $1 WHERE id = $2 RETURNING coins', [amount, userId])
      : await q('UPDATE users SET coins = GREATEST(0, coins + $1) WHERE id = $2 RETURNING coins', [amount, userId]);
  if (!r.length) throw bad('Pemain tidak ditemukan');
  return { coins: r[0].coins };
}

export async function setBan(ctx: Ctx) {
  const me = await requireOwner(ctx);
  const userId = int(ctx.body.userId, 'User', 1, 1e9);
  const banned = ctx.body.banned === true;
  const reason = banned ? cleanText(ctx.body.reason || 'Melanggar aturan', 'Alasan', 1, 120) : null;
  if (userId === me.id) throw bad('Tidak bisa memblokir diri sendiri');
  const target = await one<{ role: string }>('SELECT role FROM users WHERE id = $1', [userId]);
  if (!target) throw bad('Pemain tidak ditemukan');
  if (target.role === 'owner') throw bad('Tidak bisa memblokir owner');
  await q('UPDATE users SET banned = $1, ban_reason = $2 WHERE id = $3', [banned, reason, userId]);
  if (banned) {
    await q('DELETE FROM sessions WHERE user_id = $1', [userId]);
    await q('DELETE FROM queue WHERE user_id = $1', [userId]);
  }
  return { ok: true };
}

export async function listMaps(ctx: Ctx) {
  await requireOwner(ctx);
  return { maps: await getMaps(undefined, true), themes: THEMES, weathers: WEATHERS };
}

export async function saveMap(ctx: Ctx) {
  await requireOwner(ctx);
  const m = ctx.body.map || {};
  const id = str(m.id, 'ID map', 2, 24).toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(id)) throw bad('ID map hanya huruf kecil/angka');
  const width = int(m.width, 'Lebar arena', 1200, 4000);
  const s0 = num(m.spawn?.[0], 'Spawn kiri', 60, width - 60);
  const s1 = num(m.spawn?.[1], 'Spawn kanan', s0, width - 60);
  const map: MapDef = {
    id,
    name: cleanText(m.name, 'Nama', 2, 32),
    description: cleanText(m.description || '-', 'Deskripsi', 1, 120),
    theme: THEMES.includes(m.theme) ? m.theme : 'field',
    weather: WEATHERS.includes(m.weather) ? m.weather : 'clear',
    width,
    windBase: num(m.windBase, 'Kecepatan angin', 30, 260),
    windDir: Number(m.windDir) < 0 ? -1 : 1,
    gust: num(m.gust, 'Gust', 0, 1),
    sky: [color(m.sky?.[0], '#6ec6ff'), color(m.sky?.[1], '#e8f7ff')],
    ground: color(m.ground, '#6aa84f'),
    spawn: [s0, s1],
    maxLen: int(m.maxLen, 'Panjang tali max', 400, 1000),
    enabled: m.enabled !== false,
    sort: int(m.sort ?? 99, 'Urutan', 0, 999),
  };
  await q('INSERT INTO maps (id, data, sort) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, sort = EXCLUDED.sort', [
    id,
    map,
    map.sort,
  ]);
  return { map };
}

export async function listItems(ctx: Ctx) {
  await requireOwner(ctx);
  return { items: await getItems(undefined, true) };
}

export async function saveItem(ctx: Ctx) {
  await requireOwner(ctx);
  const i = ctx.body.item || {};
  const id = str(i.id, 'ID item', 2, 24).toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(id) || id === 'kasur') throw bad('ID item tidak valid');
  const item: ItemDef = {
    id,
    kind: 'thread',
    name: cleanText(i.name, 'Nama', 2, 32),
    description: cleanText(i.description || '-', 'Deskripsi', 1, 140),
    price: int(i.price, 'Harga', 0, 1_000_000),
    qty: int(i.qty, 'Jumlah per beli', 1, 100),
    durability: num(i.durability, 'Durability', 0.3, 5),
    cutting: num(i.cutting, 'Cutting power', 0.3, 5),
    control: num(i.control, 'Control', 0.3, 3),
    color: color(i.color, '#ffffff'),
    enabled: i.enabled !== false,
    sort: int(i.sort ?? 9, 'Urutan', 0, 999),
  };
  await q('INSERT INTO items (id, data, sort) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, sort = EXCLUDED.sort', [
    id,
    item,
    item.sort,
  ]);
  return { item };
}

export async function listTemplatesAdmin(ctx: Ctx) {
  await requireOwner(ctx);
  return { templates: await q('SELECT id, name, image, design, size, price, enabled FROM kite_templates ORDER BY id') };
}

export async function saveTemplate(ctx: Ctx) {
  await requireOwner(ctx);
  const t = ctx.body.template || {};
  const name = cleanText(t.name, 'Nama', 2, 24);
  const price = int(t.price, 'Harga', 0, 1_000_000);
  const size = num(t.size ?? 1, 'Ukuran', 0.7, 1.4);
  const image = t.image ? validateKiteImage(t.image) : null;
  const design = sanitizeDesign(image ? { ...t.design, style: 'image' } : t.design);
  if (image) design.style = 'image';
  const enabled = t.enabled !== false;
  if (t.id) {
    await q(
      'UPDATE kite_templates SET name = $1, price = $2, size = $3, design = $4, enabled = $5, image = COALESCE($6, image) WHERE id = $7',
      [name, price, size, design, enabled, image, Number(t.id)],
    );
    return { ok: true };
  }
  const r = await q('INSERT INTO kite_templates (name, image, design, size, price, enabled) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [
    name,
    image,
    design,
    size,
    price,
    enabled,
  ]);
  return { id: r[0].id };
}

export async function deleteTemplate(ctx: Ctx) {
  await requireOwner(ctx);
  await q('DELETE FROM kite_templates WHERE id = $1', [Number(ctx.body.id)]);
  return { ok: true };
}

export async function getRewardsAdmin(ctx: Ctx) {
  await requireOwner(ctx);
  return { rewards: await getRewards() };
}

export async function saveRewards(ctx: Ctx) {
  await requireOwner(ctx);
  const r = ctx.body.rewards || {};
  const rewards = {
    win: int(r.win ?? DEFAULT_REWARDS.win, 'Menang', 0, 100000),
    participation: int(r.participation ?? DEFAULT_REWARDS.participation, 'Partisipasi', 0, 100000),
    perCut: int(r.perCut ?? DEFAULT_REWARDS.perCut, 'Per potong', 0, 100000),
    daily: int(r.daily ?? DEFAULT_REWARDS.daily, 'Daily', 0, 100000),
    startCoins: int(r.startCoins ?? DEFAULT_REWARDS.startCoins, 'Coins awal', 0, 100000),
  };
  await q(`INSERT INTO config (key, value) VALUES ('rewards', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [
    JSON.stringify(rewards),
  ]);
  return { rewards };
}

export async function listAnnouncements(ctx: Ctx) {
  await requireOwner(ctx);
  return { announcements: await q('SELECT id, text, active, created_at FROM announcements ORDER BY created_at DESC LIMIT 50') };
}

export async function saveAnnouncement(ctx: Ctx) {
  await requireOwner(ctx);
  if (ctx.body.id) {
    await q('UPDATE announcements SET active = $1 WHERE id = $2', [ctx.body.active === true, Number(ctx.body.id)]);
    return { ok: true };
  }
  const text = cleanText(ctx.body.text, 'Pengumuman', 3, 240);
  await q('INSERT INTO announcements (text) VALUES ($1)', [text]);
  return { ok: true };
}

export async function deleteAnnouncement(ctx: Ctx) {
  await requireOwner(ctx);
  await q('DELETE FROM announcements WHERE id = $1', [Number(ctx.body.id)]);
  return { ok: true };
}

export async function listEventsAdmin(ctx: Ctx) {
  await requireOwner(ctx);
  return { events: await q('SELECT * FROM events ORDER BY starts_at DESC LIMIT 50') };
}

export async function saveEvent(ctx: Ctx) {
  await requireOwner(ctx);
  const e = ctx.body.event || {};
  if (e.id && e.toggle) {
    await q('UPDATE events SET active = NOT active WHERE id = $1', [Number(e.id)]);
    return { ok: true };
  }
  const name = cleanText(e.name, 'Nama event', 3, 48);
  const description = cleanText(e.description || '-', 'Deskripsi', 1, 200);
  const coinMul = num(e.coinMul ?? 1, 'Pengali coins', 0.1, 5);
  const windMul = num(e.windMul ?? 1, 'Pengali angin', 0.3, 2.5);
  const claimBonus = int(e.claimBonus ?? 0, 'Bonus klaim', 0, 100000);
  const hours = num(e.hours ?? 24, 'Durasi (jam)', 0.1, 24 * 60);
  await q(
    `INSERT INTO events (name, description, coin_mul, wind_mul, claim_bonus, starts_at, ends_at)
     VALUES ($1, $2, $3, $4, $5, now(), now() + ($6 || ' hours')::interval)`,
    [name, description, coinMul, windMul, claimBonus, String(hours)],
  );
  return { ok: true };
}

export async function deleteEvent(ctx: Ctx) {
  await requireOwner(ctx);
  await q('DELETE FROM events WHERE id = $1', [Number(ctx.body.id)]);
  return { ok: true };
}
