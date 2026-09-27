import pg from 'pg';
import { DATABASE_URL, OWNER_USERNAME, OWNER_PASS_HASH, SCHEMA_VERSION } from './config.js';
import { DEFAULT_ITEMS, DEFAULT_MAPS, DEFAULT_REWARDS } from '../src/shared/gameData.js';

let pool: pg.Pool | null = null;

export function getPool() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: DATABASE_URL.replace(/[?&]channel_binding=require/, ''),
      ssl: { rejectUnauthorized: false },
      max: 4,
      idleTimeoutMillis: 15_000,
      connectionTimeoutMillis: 10_000,
    });
    pool.on('error', () => {
      /* idle client errors are recovered automatically */
    });
  }
  return pool;
}

const SCHEMA = `
BEGIN;
SELECT pg_advisory_xact_lock(918273);
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  username_lc TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player',
  coins INTEGER NOT NULL DEFAULT 0 CHECK (coins >= 0),
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  matches INTEGER NOT NULL DEFAULT 0,
  cuts INTEGER NOT NULL DEFAULT 0,
  avatar JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  selected_kite INTEGER,
  equipped_thread TEXT NOT NULL DEFAULT 'basic',
  banned BOOLEAN NOT NULL DEFAULT false,
  ban_reason TEXT,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  lock_until TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  last_daily_day INTEGER,
  active_match TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS friendships (
  id SERIAL PRIMARY KEY,
  requester INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requester, addressee)
);
CREATE TABLE IF NOT EXISTS kites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image TEXT,
  design JSONB NOT NULL DEFAULT '{}'::jsonb,
  size REAL NOT NULL DEFAULT 1,
  custom BOOLEAN NOT NULL DEFAULT false,
  template_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kites_user ON kites(user_id);
CREATE TABLE IF NOT EXISTS inventory (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
  PRIMARY KEY (user_id, item_id)
);
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS maps (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS kite_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  image TEXT,
  design JSONB NOT NULL DEFAULT '{}'::jsonb,
  size REAL NOT NULL DEFAULT 1,
  price INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  map_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  state JSONB NOT NULL,
  rewarded BOOLEAN NOT NULL DEFAULT false,
  player_ids INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS matches_phase ON matches(phase, mode);
CREATE TABLE IF NOT EXISTS queue (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  map_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_poll TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS invites (
  id SERIAL PRIMARY KEY,
  from_user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  map_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'friend',
  status TEXT NOT NULL DEFAULT 'pending',
  match_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invites_to ON invites(to_user, status);
CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  coin_mul REAL NOT NULL DEFAULT 1,
  wind_mul REAL NOT NULL DEFAULT 1,
  claim_bonus INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS event_claims (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
CREATE TABLE IF NOT EXISTS achievements (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, code)
);
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
COMMIT;
`;

const TEMPLATE_SEED = [
  { name: 'Merah Putih', design: { style: 'diamond', colors: ['#e63946', '#ffffff', '#1d3557'], tail: true }, size: 1, price: 0 },
  { name: 'Bebek Hijau', design: { style: 'bebek', colors: ['#2a9d8f', '#e9c46a', '#264653'], tail: true }, size: 1.1, price: 250 },
  { name: 'Garis Senja', design: { style: 'stripe', colors: ['#f4a261', '#e76f51', '#2b2d42'], tail: true }, size: 1, price: 400 },
  { name: 'Bintang Malam', design: { style: 'star', colors: ['#3a0ca3', '#ffd60a', '#f72585'], tail: true }, size: 1.05, price: 800 },
  { name: 'Kupu Biru', design: { style: 'butterfly', colors: ['#3a86ff', '#8ecae6', '#023047'], tail: false }, size: 1.15, price: 1200 },
];

let ready: Promise<void> | null = null;

async function init() {
  const p = getPool();
  await p.query(SCHEMA);
  const seeded = await p.query(`SELECT value FROM config WHERE key = 'seeded'`);
  if (seeded.rows[0]?.value === SCHEMA_VERSION) return;
  const c = await p.connect();
  try {
    await c.query('BEGIN');
    await c.query('SELECT pg_advisory_xact_lock(918274)');
    const again = await c.query(`SELECT value FROM config WHERE key = 'seeded'`);
    if (again.rows[0]?.value !== SCHEMA_VERSION) {
      for (const it of DEFAULT_ITEMS) {
        await c.query('INSERT INTO items (id, data, sort) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING', [it.id, it, it.sort]);
      }
      for (const m of DEFAULT_MAPS) {
        await c.query('INSERT INTO maps (id, data, sort) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING', [m.id, m, m.sort]);
      }
      const t = await c.query('SELECT count(*)::int AS n FROM kite_templates');
      if (t.rows[0].n === 0) {
        for (const k of TEMPLATE_SEED) {
          await c.query('INSERT INTO kite_templates (name, design, size, price) VALUES ($1, $2, $3, $4)', [k.name, k.design, k.size, k.price]);
        }
      }
      await c.query(`INSERT INTO config (key, value) VALUES ('rewards', $1) ON CONFLICT (key) DO NOTHING`, [JSON.stringify(DEFAULT_REWARDS)]);
      // Owner account (role-based). Password is stored only as a scrypt hash.
      await c.query(
        `INSERT INTO users (username, username_lc, pass_hash, role, coins, avatar, settings)
         VALUES ($1, $2, $3, 'owner', 10000, '{"color":"#1d3557","skin":"#e0ac69","hat":"peci"}', '{}')
         ON CONFLICT (username_lc) DO UPDATE SET role = 'owner', pass_hash = EXCLUDED.pass_hash`,
        [OWNER_USERNAME, OWNER_USERNAME.toLowerCase(), OWNER_PASS_HASH],
      );
      await c.query(
        `INSERT INTO config (key, value) VALUES ('seeded', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [JSON.stringify(SCHEMA_VERSION)],
      );
    }
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

export function ensureSchema() {
  if (!ready) {
    ready = init().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

export type Db = pg.Pool | pg.PoolClient;

export async function q<T = any>(text: string, params: unknown[] = [], db?: Db): Promise<T[]> {
  await ensureSchema();
  const r = await (db || getPool()).query(text, params);
  return r.rows as T[];
}

export async function one<T = any>(text: string, params: unknown[] = [], db?: Db): Promise<T | null> {
  const rows = await q<T>(text, params, db);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const c = await getPool().connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
