import { q, one, type Db } from './db.js';
import { DEFAULT_REWARDS, DEFAULT_THREAD, ACHIEVEMENTS, type ItemDef, type Rewards } from '../src/shared/gameData.js';
import type { MapDef, ThreadStats } from '../src/shared/sim.js';

export async function getRewards(db?: Db): Promise<Rewards> {
  const r = await one<{ value: Rewards }>(`SELECT value FROM config WHERE key = 'rewards'`, [], db);
  return { ...DEFAULT_REWARDS, ...(r?.value || {}) };
}

export async function getItems(db?: Db, includeDisabled = false): Promise<ItemDef[]> {
  const rows = await q<{ data: ItemDef }>('SELECT data FROM items ORDER BY sort, id', [], db);
  return rows.map((r) => r.data).filter((i) => includeDisabled || i.enabled);
}

export async function getItem(id: string, db?: Db): Promise<ItemDef | null> {
  const r = await one<{ data: ItemDef }>('SELECT data FROM items WHERE id = $1', [id], db);
  return r?.data ?? null;
}

export async function getMaps(db?: Db, includeDisabled = false): Promise<MapDef[]> {
  const rows = await q<{ data: MapDef }>('SELECT data FROM maps ORDER BY sort, id', [], db);
  return rows.map((r) => r.data).filter((m) => includeDisabled || m.enabled);
}

export async function getMap(id: string, db?: Db): Promise<MapDef | null> {
  const r = await one<{ data: MapDef }>('SELECT data FROM maps WHERE id = $1', [id], db);
  return r?.data && r.data.enabled ? r.data : null;
}

export async function activeEvents(db?: Db) {
  return q<{ id: number; name: string; description: string; coin_mul: number; wind_mul: number; claim_bonus: number; ends_at: string }>(
    `SELECT id, name, description, coin_mul, wind_mul, claim_bonus, ends_at FROM events
     WHERE active AND starts_at <= now() AND ends_at > now() ORDER BY ends_at`,
    [],
    db,
  );
}

export async function eventMultipliers(db?: Db) {
  const ev = await activeEvents(db);
  let coin = 1;
  let wind = 1;
  for (const e of ev) {
    coin *= Math.max(0.1, Math.min(5, e.coin_mul));
    wind *= Math.max(0.3, Math.min(2.5, e.wind_mul));
  }
  return { coin: Math.min(coin, 5), wind: Math.min(Math.max(wind, 0.3), 2.5) };
}

/** Resolve the thread a player will use — stats always come from server config. */
export async function resolveThread(db: Db, userId: number, equipped: string, consume: boolean) {
  const item = equipped && equipped !== DEFAULT_THREAD.id ? await getItem(equipped, db) : null;
  if (item) {
    const inv = await one<{ qty: number }>('SELECT qty FROM inventory WHERE user_id = $1 AND item_id = $2', [userId, item.id], db);
    if (inv && inv.qty > 0) {
      if (consume) await q('UPDATE inventory SET qty = qty - 1 WHERE user_id = $1 AND item_id = $2 AND qty > 0', [userId, item.id], db);
      const stats: ThreadStats = { durability: item.durability, cutting: item.cutting, control: item.control };
      return { id: item.id, name: item.name, color: item.color, stats };
    }
  }
  const d = DEFAULT_THREAD;
  return { id: d.id, name: d.name, color: d.color, stats: { durability: d.durability, cutting: d.cutting, control: d.control } };
}

/** Check & grant achievements (server side). Returns newly unlocked codes. */
export async function checkAchievements(db: Db | undefined, userId: number) {
  const u = await one<{ wins: number; matches: number; cuts: number; coins: number }>(
    'SELECT wins, matches, cuts, coins FROM users WHERE id = $1',
    [userId],
    db,
  );
  if (!u) return [];
  const have = new Set((await q<{ code: string }>('SELECT code FROM achievements WHERE user_id = $1', [userId], db)).map((r) => r.code));
  const friends = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM friendships WHERE status = 'accepted' AND (requester = $1 OR addressee = $1)`,
    [userId],
    db,
  );
  const custom = await one<{ n: number }>('SELECT count(*)::int AS n FROM kites WHERE user_id = $1 AND custom', [userId], db);
  const cond: Record<string, boolean> = {
    first_match: u.matches >= 1,
    first_win: u.wins >= 1,
    wins_10: u.wins >= 10,
    matches_25: u.matches >= 25,
    cuts_10: u.cuts >= 10,
    creator: (custom?.n || 0) >= 1,
    social: (friends?.n || 0) >= 3,
    rich: u.coins >= 5000,
  };
  const unlocked: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (have.has(a.code) || !cond[a.code]) continue;
    const r = await q('INSERT INTO achievements (user_id, code) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING code', [userId, a.code], db);
    if (r.length) {
      await q('UPDATE users SET coins = coins + $1 WHERE id = $2', [a.reward, userId], db);
      unlocked.push(a.code);
    }
  }
  return unlocked;
}

export function wibDay(d = new Date()) {
  return Math.floor((d.getTime() + 7 * 3600_000) / 86_400_000);
}
