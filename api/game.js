// server/http.ts
import crypto from "node:crypto";

// server/db.ts
import pg from "pg";

// server/config.ts
var DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || "postgresql://neondb_owner:npg_8AJFTun0aZXM@ep-curly-flower-b52q2m9s-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";
var OWNER_USERNAME = process.env.OWNER_USERNAME || "fasszk";
var OWNER_PASS_HASH = process.env.OWNER_PASS_HASH || "scrypt$5aee51618695da6543c53f68f912474c$23074d4ca1cbf11d35325e4aa5c9bb15348070571e872e9b6fed83a570a82362155e5e959e9b6a1199771315d6c0a360e9e2ff7705fe75bb4291e04d65ff9d62";
var SESSION_DAYS = 30;
var ONLINE_WINDOW_S = 30;
var INVITE_TTL_S = 60;
var MAX_KITES_PER_USER = 30;
var MAX_KITE_IMAGE_CHARS = 6e5;
var SCHEMA_VERSION = "v3";

// src/shared/gameData.ts
var DEFAULT_THREAD = {
  id: "kasur",
  name: "Benang Kasur",
  color: "#e9e4d8",
  durability: 0.8,
  cutting: 0.8,
  control: 0.9
};
var DEFAULT_ITEMS = [
  {
    id: "basic",
    kind: "thread",
    name: "Benang Basic",
    description: "Benang gelasan standar. Seimbang untuk pemula.",
    price: 100,
    qty: 3,
    durability: 1,
    cutting: 1,
    control: 1,
    color: "#f4f1ea",
    enabled: true,
    sort: 1
  },
  {
    id: "strong",
    kind: "thread",
    name: "Benang Strong",
    description: "Serat lebih tebal, lebih tahan gesekan.",
    price: 500,
    qty: 3,
    durability: 1.4,
    cutting: 1.25,
    control: 1.05,
    color: "#ffb703",
    enabled: true,
    sort: 2
  },
  {
    id: "premium",
    kind: "thread",
    name: "Benang Premium",
    description: "Gelasan kaca halus. Tajam, kuat, dan responsif.",
    price: 1500,
    qty: 3,
    durability: 1.8,
    cutting: 1.6,
    control: 1.2,
    color: "#e63946",
    enabled: true,
    sort: 3
  }
];
var DEFAULT_REWARDS = {
  win: 150,
  participation: 30,
  perCut: 40,
  daily: 200,
  startCoins: 500
};
var DEFAULT_MAPS = [
  { id: "desa", name: "Desa", description: "Rumah joglo & pohon kelapa, angin sepoi.", theme: "village", weather: "clear", width: 2e3, windBase: 90, windDir: 1, gust: 0.5, sky: ["#6ec6ff", "#e8f7ff"], ground: "#6aa84f", spawn: [500, 1500], maxLen: 780, enabled: true, sort: 1 },
  { id: "kota", name: "Kota", description: "Gedung tinggi, angin berputar & gerimis.", theme: "city", weather: "drizzle", width: 2200, windBase: 110, windDir: -1, gust: 0.7, sky: ["#8aa4bf", "#dfe7ef"], ground: "#7d8590", spawn: [600, 1600], maxLen: 800, enabled: true, sort: 2 },
  { id: "pantai", name: "Pantai", description: "Angin laut kencang dari samudra.", theme: "beach", weather: "clear", width: 2400, windBase: 140, windDir: -1, gust: 0.6, sky: ["#38b6ff", "#d6f4ff"], ground: "#f2d49b", spawn: [600, 1800], maxLen: 840, enabled: true, sort: 3 },
  { id: "pegunungan", name: "Pegunungan", description: "Berkabut, hembusan liar di ketinggian.", theme: "mountain", weather: "mist", width: 2e3, windBase: 160, windDir: 1, gust: 0.9, sky: ["#5f8fc4", "#dde7f2"], ground: "#4f7a4a", spawn: [500, 1500], maxLen: 820, enabled: true, sort: 4 },
  { id: "sawah", name: "Sawah", description: "Terasering hijau, angin tenang & stabil.", theme: "rice", weather: "clear", width: 2200, windBase: 80, windDir: 1, gust: 0.35, sky: ["#8ed3ff", "#f4fbff"], ground: "#7cb342", spawn: [600, 1600], maxLen: 760, enabled: true, sort: 5 },
  { id: "lapangan", name: "Lapangan", description: "Lapangan bola kampung, berawan.", theme: "field", weather: "cloudy", width: 1800, windBase: 100, windDir: 1, gust: 0.5, sky: ["#9cc9ea", "#eef5fa"], ground: "#5d9c3b", spawn: [450, 1350], maxLen: 760, enabled: true, sort: 6 },
  { id: "sunset", name: "Sunset Hill", description: "Bukit senja keemasan, angin berubah arah.", theme: "hill", weather: "sunset", width: 2e3, windBase: 120, windDir: -1, gust: 0.6, sky: ["#ff7e5f", "#ffd29d"], ground: "#6b4f3a", spawn: [500, 1500], maxLen: 800, enabled: true, sort: 7 },
  { id: "festival", name: "Festival Layangan", description: "Umbul-umbul, tenda & sorak penonton.", theme: "festival", weather: "festive", width: 2600, windBase: 115, windDir: 1, gust: 0.55, sky: ["#3fa9f5", "#c9efff"], ground: "#88b04b", spawn: [700, 1900], maxLen: 860, enabled: true, sort: 8 }
];
var THEMES = ["village", "city", "beach", "mountain", "rice", "field", "hill", "festival"];
var WEATHERS = ["clear", "cloudy", "drizzle", "mist", "sunset", "festive", "windy"];
var ACHIEVEMENTS = [
  { code: "first_match", name: "Terbang Perdana", desc: "Selesaikan 1 pertandingan", reward: 50 },
  { code: "first_win", name: "Juara Kampung", desc: "Menangkan adu layangan pertama", reward: 100 },
  { code: "wins_10", name: "Raja Angin", desc: "Menangkan 10 adu layangan", reward: 500 },
  { code: "matches_25", name: "Veteran Langit", desc: "Mainkan 25 pertandingan", reward: 300 },
  { code: "cuts_10", name: "Tukang Putus", desc: "Putuskan 10 tali lawan", reward: 300 },
  { code: "creator", name: "Seniman Layangan", desc: "Buat layangan sendiri dari galeri", reward: 100 },
  { code: "social", name: "Kawan Main", desc: "Punya 3 teman", reward: 150 },
  { code: "rich", name: "Juragan Benang", desc: "Kumpulkan 5.000 Coins", reward: 250 }
];
var AVATAR_HATS = ["none", "caping", "peci", "cap", "bandana"];
var DEFAULT_AVATAR = { color: "#e63946", skin: "#e0ac69", hat: "caping" };
var DEFAULT_SETTINGS = { volume: 0.7, sfx: true, windSound: true, quality: "auto", leftHanded: false };

// server/db.ts
var pool = null;
function getPool() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: DATABASE_URL.replace(/[?&]channel_binding=require/, ""),
      ssl: { rejectUnauthorized: false },
      max: 4,
      idleTimeoutMillis: 15e3,
      connectionTimeoutMillis: 1e4
    });
    pool.on("error", () => {
    });
  }
  return pool;
}
var SCHEMA = `
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
var TEMPLATE_SEED = [
  { name: "Merah Putih", design: { style: "diamond", colors: ["#e63946", "#ffffff", "#1d3557"], tail: true }, size: 1, price: 0 },
  { name: "Bebek Hijau", design: { style: "bebek", colors: ["#2a9d8f", "#e9c46a", "#264653"], tail: true }, size: 1.1, price: 250 },
  { name: "Garis Senja", design: { style: "stripe", colors: ["#f4a261", "#e76f51", "#2b2d42"], tail: true }, size: 1, price: 400 },
  { name: "Bintang Malam", design: { style: "star", colors: ["#3a0ca3", "#ffd60a", "#f72585"], tail: true }, size: 1.05, price: 800 },
  { name: "Kupu Biru", design: { style: "butterfly", colors: ["#3a86ff", "#8ecae6", "#023047"], tail: false }, size: 1.15, price: 1200 }
];
var ready = null;
async function init() {
  const p = getPool();
  await p.query(SCHEMA);
  const seeded = await p.query(`SELECT value FROM config WHERE key = 'seeded'`);
  if (seeded.rows[0]?.value === SCHEMA_VERSION) return;
  const c = await p.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(918274)");
    const again = await c.query(`SELECT value FROM config WHERE key = 'seeded'`);
    if (again.rows[0]?.value !== SCHEMA_VERSION) {
      for (const it of DEFAULT_ITEMS) {
        await c.query("INSERT INTO items (id, data, sort) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING", [it.id, it, it.sort]);
      }
      for (const m of DEFAULT_MAPS) {
        await c.query("INSERT INTO maps (id, data, sort) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING", [m.id, m, m.sort]);
      }
      const t = await c.query("SELECT count(*)::int AS n FROM kite_templates");
      if (t.rows[0].n === 0) {
        for (const k of TEMPLATE_SEED) {
          await c.query("INSERT INTO kite_templates (name, design, size, price) VALUES ($1, $2, $3, $4)", [k.name, k.design, k.size, k.price]);
        }
      }
      await c.query(`INSERT INTO config (key, value) VALUES ('rewards', $1) ON CONFLICT (key) DO NOTHING`, [JSON.stringify(DEFAULT_REWARDS)]);
      await c.query(
        `INSERT INTO users (username, username_lc, pass_hash, role, coins, avatar, settings)
         VALUES ($1, $2, $3, 'owner', 10000, '{"color":"#1d3557","skin":"#e0ac69","hat":"peci"}', '{}')
         ON CONFLICT (username_lc) DO UPDATE SET role = 'owner', pass_hash = EXCLUDED.pass_hash`,
        [OWNER_USERNAME, OWNER_USERNAME.toLowerCase(), OWNER_PASS_HASH]
      );
      await c.query(
        `INSERT INTO config (key, value) VALUES ('seeded', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [JSON.stringify(SCHEMA_VERSION)]
      );
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {
    });
    throw e;
  } finally {
    c.release();
  }
}
function ensureSchema() {
  if (!ready) {
    ready = init().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}
async function q(text, params = [], db) {
  await ensureSchema();
  const r = await (db || getPool()).query(text, params);
  return r.rows;
}
async function one(text, params = [], db) {
  const rows = await q(text, params, db);
  return rows[0] ?? null;
}
async function tx(fn) {
  await ensureSchema();
  const c = await getPool().connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {
    });
    throw e;
  } finally {
    c.release();
  }
}

// server/http.ts
var HttpError = class extends Error {
  status;
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
var bad = (msg) => new HttpError(400, msg);
var sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
var USER_COLS = `u.id, u.username, u.role, u.coins, u.wins, u.losses, u.matches, u.cuts, u.avatar, u.settings,
  u.selected_kite, u.equipped_thread, u.banned, u.ban_reason, u.last_seen, u.last_daily_day, u.active_match, u.created_at`;
async function loadUser(ctx) {
  if (ctx.user) return ctx.user;
  if (!ctx.token || ctx.token.length < 20 || ctx.token.length > 200) return null;
  const u = await one(
    `SELECT ${USER_COLS}, (u.last_seen IS NULL OR u.last_seen < now() - interval '10 seconds') AS stale
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(ctx.token)]
  );
  if (!u) return null;
  if (u.stale) {
    q("UPDATE users SET last_seen = now() WHERE id = $1", [u.id]).catch(() => {
    });
  }
  ctx.user = u;
  return u;
}
async function requireUser(ctx) {
  const u = await loadUser(ctx);
  if (!u) throw new HttpError(401, "Sesi berakhir, silakan login kembali.");
  if (u.banned) throw new HttpError(403, `Akun diblokir${u.ban_reason ? ": " + u.ban_reason : ""}`);
  return u;
}
async function requireOwner(ctx) {
  const u = await requireUser(ctx);
  if (u.role !== "owner" && u.role !== "admin") throw new HttpError(403, "Tidak diizinkan.");
  return u;
}
function pubName(u) {
  return u.role === "owner" ? `Pilot${1e3 + u.id}` : u.username;
}

// server/auth.ts
import crypto2 from "node:crypto";

// server/anticheat.ts
var buckets = /* @__PURE__ */ new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    if (buckets.size > 5e3) {
      for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    }
    return;
  }
  b.n += 1;
  if (b.n > max) throw new HttpError(429, "Terlalu banyak permintaan, coba lagi sebentar.");
}
function int(v, name, min, max) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw bad(`${name} tidak valid`);
  if (n < min || n > max) throw bad(`${name} harus di antara ${min} dan ${max}`);
  return n;
}
function num(v, name, min, max) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw bad(`${name} tidak valid`);
  if (n < min || n > max) throw bad(`${name} harus di antara ${min} dan ${max}`);
  return n;
}
function str(v, name, min, max) {
  if (typeof v !== "string") throw bad(`${name} wajib diisi`);
  const s = v.trim();
  if (s.length < min || s.length > max) throw bad(`${name} harus ${min}-${max} karakter`);
  return s;
}
function cleanText(v, name, min, max) {
  return str(v, name, min, max).replace(/[<>]/g, "");
}
var COLOR_RE = /^#[0-9a-fA-F]{6}$/;
function color(v, fallback) {
  return typeof v === "string" && COLOR_RE.test(v) ? v : fallback;
}
function sanitizeInput(raw) {
  const mx = Number(raw?.mx);
  const st = Number(raw?.st);
  return {
    mx: Number.isFinite(mx) ? Math.max(-1, Math.min(1, Math.round(mx))) : 0,
    st: Number.isFinite(st) ? Math.max(-1, Math.min(1, Math.round(st * 10) / 10)) : 0,
    pull: raw?.pull === true
  };
}
function validateKiteImage(dataUrl) {
  if (typeof dataUrl !== "string") throw bad("Gambar tidak valid");
  if (dataUrl.length > MAX_KITE_IMAGE_CHARS) throw bad("Ukuran gambar terlalu besar");
  const m = /^data:image\/(png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw bad("Format gambar harus PNG atau WebP transparan");
  const buf = Buffer.from(m[2], "base64");
  if (m[1] === "png") {
    const sig = [137, 80, 78, 71, 13, 10, 26, 10];
    if (!sig.every((b, i) => buf[i] === b)) throw bad("File PNG rusak");
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    if (w < 16 || h < 16 || w > 1024 || h > 1024) throw bad("Dimensi gambar tidak valid");
  } else {
    if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") throw bad("File WebP rusak");
  }
  return dataUrl;
}
function sanitizeDesign(d) {
  const styles = ["diamond", "bebek", "stripe", "star", "butterfly", "image"];
  const colors = Array.isArray(d?.colors) ? d.colors.slice(0, 3) : [];
  return {
    style: styles.includes(d?.style) ? d.style : "diamond",
    colors: [color(colors[0], "#e63946"), color(colors[1], "#ffffff"), color(colors[2], "#1d3557")],
    tail: d?.tail !== false,
    tailColor: color(d?.tailColor, "#ffb703")
  };
}

// server/economy.ts
async function getRewards(db) {
  const r = await one(`SELECT value FROM config WHERE key = 'rewards'`, [], db);
  return { ...DEFAULT_REWARDS, ...r?.value || {} };
}
async function getItems(db, includeDisabled = false) {
  const rows = await q("SELECT data FROM items ORDER BY sort, id", [], db);
  return rows.map((r) => r.data).filter((i) => includeDisabled || i.enabled);
}
async function getItem(id, db) {
  const r = await one("SELECT data FROM items WHERE id = $1", [id], db);
  return r?.data ?? null;
}
async function getMaps(db, includeDisabled = false) {
  const rows = await q("SELECT data FROM maps ORDER BY sort, id", [], db);
  return rows.map((r) => r.data).filter((m) => includeDisabled || m.enabled);
}
async function getMap(id, db) {
  const r = await one("SELECT data FROM maps WHERE id = $1", [id], db);
  return r?.data && r.data.enabled ? r.data : null;
}
async function activeEvents(db) {
  return q(
    `SELECT id, name, description, coin_mul, wind_mul, claim_bonus, ends_at FROM events
     WHERE active AND starts_at <= now() AND ends_at > now() ORDER BY ends_at`,
    [],
    db
  );
}
async function eventMultipliers(db) {
  const ev = await activeEvents(db);
  let coin = 1;
  let wind = 1;
  for (const e of ev) {
    coin *= Math.max(0.1, Math.min(5, e.coin_mul));
    wind *= Math.max(0.3, Math.min(2.5, e.wind_mul));
  }
  return { coin: Math.min(coin, 5), wind: Math.min(Math.max(wind, 0.3), 2.5) };
}
async function resolveThread(db, userId, equipped, consume) {
  const item = equipped && equipped !== DEFAULT_THREAD.id ? await getItem(equipped, db) : null;
  if (item) {
    const inv = await one("SELECT qty FROM inventory WHERE user_id = $1 AND item_id = $2", [userId, item.id], db);
    if (inv && inv.qty > 0) {
      if (consume) await q("UPDATE inventory SET qty = qty - 1 WHERE user_id = $1 AND item_id = $2 AND qty > 0", [userId, item.id], db);
      const stats = { durability: item.durability, cutting: item.cutting, control: item.control };
      return { id: item.id, name: item.name, color: item.color, stats };
    }
  }
  const d = DEFAULT_THREAD;
  return { id: d.id, name: d.name, color: d.color, stats: { durability: d.durability, cutting: d.cutting, control: d.control } };
}
async function checkAchievements(db, userId) {
  const u = await one(
    "SELECT wins, matches, cuts, coins FROM users WHERE id = $1",
    [userId],
    db
  );
  if (!u) return [];
  const have = new Set((await q("SELECT code FROM achievements WHERE user_id = $1", [userId], db)).map((r) => r.code));
  const friends = await one(
    `SELECT count(*)::int AS n FROM friendships WHERE status = 'accepted' AND (requester = $1 OR addressee = $1)`,
    [userId],
    db
  );
  const custom = await one("SELECT count(*)::int AS n FROM kites WHERE user_id = $1 AND custom", [userId], db);
  const cond = {
    first_match: u.matches >= 1,
    first_win: u.wins >= 1,
    wins_10: u.wins >= 10,
    matches_25: u.matches >= 25,
    cuts_10: u.cuts >= 10,
    creator: (custom?.n || 0) >= 1,
    social: (friends?.n || 0) >= 3,
    rich: u.coins >= 5e3
  };
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (have.has(a.code) || !cond[a.code]) continue;
    const r = await q("INSERT INTO achievements (user_id, code) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING code", [userId, a.code], db);
    if (r.length) {
      await q("UPDATE users SET coins = coins + $1 WHERE id = $2", [a.reward, userId], db);
      unlocked.push(a.code);
    }
  }
  return unlocked;
}
function wibDay(d = /* @__PURE__ */ new Date()) {
  return Math.floor((d.getTime() + 7 * 36e5) / 864e5);
}

// server/auth.ts
function hashPassword(pw) {
  const salt = crypto2.randomBytes(16).toString("hex");
  const h = crypto2.scryptSync(pw, salt, 64).toString("hex");
  return `scrypt$${salt}$${h}`;
}
function verifyPassword(pw, stored) {
  const [alg, salt, hex] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hex) return false;
  const h = crypto2.scryptSync(pw, salt, 64);
  const ref = Buffer.from(hex, "hex");
  return ref.length === h.length && crypto2.timingSafeEqual(ref, h);
}
async function createSession(userId) {
  const token = crypto2.randomBytes(32).toString("hex");
  await q(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + ($3 || ' days')::interval)`, [
    sha256(token),
    userId,
    String(SESSION_DAYS)
  ]);
  q(`DELETE FROM sessions WHERE user_id = $1 AND expires_at < now()`, [userId]).catch(() => {
  });
  return token;
}
var USERNAME_RE = /^[a-zA-Z0-9_]{3,16}$/;
async function register(ctx) {
  rateLimit(`reg:${ctx.ip}`, 8, 60 * 60 * 1e3);
  const username = str(ctx.body.username, "Username", 3, 16);
  const password = str(ctx.body.password, "Password", 6, 72);
  if (!USERNAME_RE.test(username)) throw bad("Username hanya boleh huruf, angka, dan _ (3-16 karakter)");
  if (/^pilot\d+$/i.test(username) || /^(admin|owner|moderator|system)/i.test(username)) throw bad("Username tidak tersedia");
  const exists = await one("SELECT 1 FROM users WHERE username_lc = $1", [username.toLowerCase()]);
  if (exists) throw bad("Username sudah dipakai");
  const rewards = await getRewards();
  const userId = await tx(async (c) => {
    const r = await c.query(
      `INSERT INTO users (username, username_lc, pass_hash, coins, avatar, settings)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (username_lc) DO NOTHING RETURNING id`,
      [username, username.toLowerCase(), hashPassword(password), rewards.startCoins, DEFAULT_AVATAR, DEFAULT_SETTINGS]
    );
    if (!r.rows[0]) throw bad("Username sudah dipakai");
    const id = r.rows[0].id;
    const k = await c.query(
      `INSERT INTO kites (user_id, name, design, size) VALUES ($1, 'Layangan Pertamaku', $2, 1) RETURNING id`,
      [id, { style: "diamond", colors: ["#e63946", "#ffffff", "#1d3557"], tail: true, tailColor: "#ffb703" }]
    );
    await c.query("UPDATE users SET selected_kite = $1 WHERE id = $2", [k.rows[0].id, id]);
    await c.query(`INSERT INTO inventory (user_id, item_id, qty) VALUES ($1, 'basic', 3)`, [id]);
    return id;
  });
  const token = await createSession(userId);
  return { token };
}
async function login(ctx) {
  rateLimit(`login:${ctx.ip}`, 20, 10 * 60 * 1e3);
  const username = str(ctx.body.username, "Username", 1, 32);
  const password = str(ctx.body.password, "Password", 1, 72);
  const u = await one(
    `SELECT id, pass_hash, banned, ban_reason, (lock_until IS NOT NULL AND lock_until > now()) AS locked
     FROM users WHERE username_lc = $1`,
    [username.toLowerCase()]
  );
  if (!u) {
    crypto2.scryptSync(password, "dummy-salt-for-timing", 64);
    throw new HttpError(401, "Username atau password salah");
  }
  if (u.locked) throw new HttpError(429, "Terlalu banyak percobaan gagal. Coba lagi dalam 10 menit.");
  if (!verifyPassword(password, u.pass_hash)) {
    await q(
      `UPDATE users SET
        lock_until = CASE WHEN failed_logins + 1 >= 8 THEN now() + interval '10 minutes' ELSE lock_until END,
        failed_logins = CASE WHEN failed_logins + 1 >= 8 THEN 0 ELSE failed_logins + 1 END
       WHERE id = $1`,
      [u.id]
    );
    throw new HttpError(401, "Username atau password salah");
  }
  if (u.banned) throw new HttpError(403, `Akun diblokir${u.ban_reason ? ": " + u.ban_reason : ""}`);
  await q("UPDATE users SET failed_logins = 0, lock_until = NULL, last_seen = now() WHERE id = $1", [u.id]);
  const token = await createSession(u.id);
  return { token };
}
async function logout(ctx) {
  if (ctx.token) await q("DELETE FROM sessions WHERE token_hash = $1", [sha256(ctx.token)]);
  return { ok: true };
}
async function changePassword(ctx) {
  const u = await requireUser(ctx);
  rateLimit(`pw:${u.id}`, 5, 10 * 60 * 1e3);
  const oldPw = str(ctx.body.oldPassword, "Password lama", 1, 72);
  const newPw = str(ctx.body.newPassword, "Password baru", 6, 72);
  const row = await one("SELECT pass_hash FROM users WHERE id = $1", [u.id]);
  if (!row || !verifyPassword(oldPw, row.pass_hash)) throw bad("Password lama salah");
  await q("UPDATE users SET pass_hash = $1 WHERE id = $2", [hashPassword(newPw), u.id]);
  await q("DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2", [u.id, sha256(ctx.token || "")]);
  return { ok: true };
}

// server/users.ts
async function me(ctx) {
  const u = await requireUser(ctx);
  const kite = u.selected_kite ? await one("SELECT id, name, image, design, size FROM kites WHERE id = $1 AND user_id = $2", [u.selected_kite, u.id]) : null;
  const inv = await q("SELECT item_id, qty FROM inventory WHERE user_id = $1 AND qty > 0", [u.id]);
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    isOwner: u.role === "owner" || u.role === "admin",
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
    createdAt: u.created_at
  };
}
async function heartbeat(ctx) {
  const u = await requireUser(ctx);
  await q("UPDATE users SET last_seen = now() WHERE id = $1", [u.id]);
  const invites = await q(
    `SELECT i.id, i.map_id, i.kind, i.created_at, f.id AS from_id, f.username, f.role, f.avatar
     FROM invites i JOIN users f ON f.id = i.from_user
     WHERE i.to_user = $1 AND i.status = 'pending' AND i.created_at > now() - ($2 || ' seconds')::interval
     ORDER BY i.created_at DESC LIMIT 5`,
    [u.id, String(INVITE_TTL_S)]
  );
  const outgoing = await q(
    `SELECT i.id, i.status, i.match_id, t.id AS to_id, t.username, t.role FROM invites i JOIN users t ON t.id = i.to_user
     WHERE i.from_user = $1 AND i.created_at > now() - ($2 || ' seconds')::interval ORDER BY i.created_at DESC LIMIT 5`,
    [u.id, String(INVITE_TTL_S)]
  );
  const fr = await one(`SELECT count(*)::int AS n FROM friendships WHERE addressee = $1 AND status = 'pending'`, [u.id]);
  const ann = await q("SELECT id, text, created_at FROM announcements WHERE active ORDER BY created_at DESC LIMIT 3");
  let activeMatch = null;
  if (u.active_match) {
    const m = await one("SELECT id, mode, phase FROM matches WHERE id = $1", [u.active_match]);
    if (m && m.phase !== "ended") activeMatch = m;
    else await q("UPDATE users SET active_match = NULL WHERE id = $1 AND active_match = $2", [u.id, u.active_match]);
  }
  return {
    coins: u.coins,
    wins: u.wins,
    losses: u.losses,
    invites: invites.map((i) => ({
      id: i.id,
      mapId: i.map_id,
      kind: i.kind,
      from: { id: i.from_id, name: pubName({ id: i.from_id, username: i.username, role: i.role }), avatar: i.avatar },
      createdAt: i.created_at
    })),
    outgoing: outgoing.map((o) => ({
      id: o.id,
      status: o.status,
      matchId: o.match_id,
      to: pubName({ id: o.to_id, username: o.username, role: o.role })
    })),
    friendRequests: fr?.n || 0,
    announcements: ann,
    events: await activeEvents(),
    activeMatch
  };
}
async function saveSettings(ctx) {
  const u = await requireUser(ctx);
  const s = ctx.body.settings || {};
  const settings = {
    volume: Math.max(0, Math.min(1, Number(s.volume) || 0)),
    sfx: s.sfx !== false,
    windSound: s.windSound !== false,
    quality: ["auto", "low", "high"].includes(s.quality) ? s.quality : "auto",
    leftHanded: s.leftHanded === true
  };
  await q("UPDATE users SET settings = $1 WHERE id = $2", [settings, u.id]);
  return { settings };
}
async function saveAvatar(ctx) {
  const u = await requireUser(ctx);
  const a = ctx.body.avatar || {};
  const avatar = {
    color: color(a.color, DEFAULT_AVATAR.color),
    skin: color(a.skin, DEFAULT_AVATAR.skin),
    hat: AVATAR_HATS.includes(a.hat) ? a.hat : "none"
  };
  await q("UPDATE users SET avatar = $1 WHERE id = $2", [avatar, u.id]);
  return { avatar };
}
async function claimDaily(ctx) {
  const u = await requireUser(ctx);
  const day = wibDay();
  const rewards = await getRewards();
  const mul = await eventMultipliers();
  const amount = Math.round(rewards.daily * mul.coin);
  return tx(async (c) => {
    const r = await c.query(
      `UPDATE users SET coins = coins + $1, last_daily_day = $2
       WHERE id = $3 AND (last_daily_day IS NULL OR last_daily_day <> $2) RETURNING coins`,
      [amount, day, u.id]
    );
    if (!r.rows[0]) throw bad("Daily reward sudah diklaim hari ini. Kembali besok!");
    const ach = await checkAchievements(c, u.id);
    return { amount, coins: r.rows[0].coins, achievements: ach };
  });
}
async function claimEvent(ctx) {
  const u = await requireUser(ctx);
  const id = Number(ctx.body.eventId);
  return tx(async (c) => {
    const ev = (await c.query(`SELECT id, claim_bonus FROM events WHERE id = $1 AND active AND starts_at <= now() AND ends_at > now()`, [id])).rows[0];
    if (!ev || ev.claim_bonus <= 0) throw bad("Event tidak tersedia");
    const ins = await c.query("INSERT INTO event_claims (event_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING event_id", [
      id,
      u.id
    ]);
    if (!ins.rows[0]) throw bad("Bonus event sudah diklaim");
    const r = await c.query("UPDATE users SET coins = coins + $1 WHERE id = $2 RETURNING coins", [ev.claim_bonus, u.id]);
    return { amount: ev.claim_bonus, coins: r.rows[0].coins };
  });
}
async function eventsList(ctx) {
  const u = await requireUser(ctx);
  const ev = await activeEvents();
  const claimed = await q("SELECT event_id FROM event_claims WHERE user_id = $1", [u.id]);
  const set = new Set(claimed.map((c) => c.event_id));
  return { events: ev.map((e) => ({ ...e, claimed: set.has(e.id) })) };
}
async function profile(ctx) {
  const me2 = await requireUser(ctx);
  const name = typeof ctx.body.username === "string" ? ctx.body.username.trim().toLowerCase() : "";
  let target;
  if (!name) target = me2;
  else {
    target = await one(
      `SELECT id, username, role, wins, losses, matches, cuts, avatar, selected_kite, last_seen, created_at FROM users WHERE username_lc = $1`,
      [name]
    );
    if (!target || target.role === "owner" && target.id !== me2.id) throw new HttpError(404, "Pemain tidak ditemukan");
  }
  const kites = await q("SELECT id, name, image, design, size FROM kites WHERE user_id = $1 ORDER BY id", [target.id]);
  const ach = await q("SELECT code, unlocked_at FROM achievements WHERE user_id = $1", [target.id]);
  const online = target.last_seen ? Date.now() - new Date(target.last_seen).getTime() < ONLINE_WINDOW_S * 1e3 : false;
  return {
    id: target.id,
    username: target.id === me2.id ? target.username : pubName(target),
    avatar: { ...DEFAULT_AVATAR, ...target.avatar },
    wins: target.wins,
    losses: target.losses,
    matches: target.matches,
    cuts: target.cuts,
    selectedKite: target.selected_kite,
    kites,
    achievements: ach,
    online,
    isSelf: target.id === me2.id,
    createdAt: target.created_at
  };
}
async function findUser(username) {
  const name = str(username, "Username", 1, 32).toLowerCase();
  return one(
    "SELECT id, username, role, banned, last_seen FROM users WHERE username_lc = $1",
    [name]
  );
}

// server/friends.ts
async function listFriends(ctx) {
  const u = await requireUser(ctx);
  const rows = await q(
    `SELECT f.id AS fid, f.status, f.requester, o.id, o.username, o.role, o.avatar, o.last_seen, o.active_match, o.wins, o.losses,
            m.mode AS match_mode, m.phase AS match_phase, m.map_id AS match_map
     FROM friendships f
     JOIN users o ON o.id = CASE WHEN f.requester = $1 THEN f.addressee ELSE f.requester END
     LEFT JOIN matches m ON m.id = o.active_match
     WHERE (f.requester = $1 OR f.addressee = $1)
     ORDER BY o.last_seen DESC NULLS LAST`,
    [u.id]
  );
  const now = Date.now();
  const map = (r) => {
    const online = !!r.last_seen && now - new Date(r.last_seen).getTime() < ONLINE_WINDOW_S * 1e3;
    const inMatch = online && r.active_match && r.match_phase && r.match_phase !== "ended";
    return {
      friendshipId: r.fid,
      id: r.id,
      username: pubName(r),
      avatar: { ...DEFAULT_AVATAR, ...r.avatar },
      online,
      wins: r.wins,
      losses: r.losses,
      status: inMatch ? r.match_mode === "free" ? "free" : "battle" : online ? "online" : "offline",
      room: inMatch && r.match_mode === "free" ? r.active_match : null,
      roomMap: inMatch ? r.match_map : null
    };
  };
  return {
    friends: rows.filter((r) => r.status === "accepted").map(map),
    incoming: rows.filter((r) => r.status === "pending" && r.requester !== u.id).map(map),
    outgoing: rows.filter((r) => r.status === "pending" && r.requester === u.id).map(map)
  };
}
async function requestFriend(ctx) {
  const u = await requireUser(ctx);
  rateLimit(`fr:${u.id}`, 20, 60 * 60 * 1e3);
  const target = await findUser(ctx.body.username);
  if (!target || target.role === "owner") throw new HttpError(404, "Pemain tidak ditemukan");
  if (target.id === u.id) throw bad("Tidak bisa menambahkan diri sendiri");
  const existing = await one(
    `SELECT id, status, requester FROM friendships WHERE (requester = $1 AND addressee = $2) OR (requester = $2 AND addressee = $1)`,
    [u.id, target.id]
  );
  if (existing) {
    if (existing.status === "accepted") throw bad("Kalian sudah berteman");
    if (existing.requester === u.id) throw bad("Permintaan sudah dikirim");
    await q(`UPDATE friendships SET status = 'accepted' WHERE id = $1`, [existing.id]);
    await checkAchievements(void 0, u.id).catch(() => {
    });
    return { ok: true, accepted: true };
  }
  const count = await one(`SELECT count(*)::int AS n FROM friendships WHERE requester = $1 AND status = 'pending'`, [u.id]);
  if ((count?.n || 0) >= 30) throw bad("Terlalu banyak permintaan tertunda");
  await q("INSERT INTO friendships (requester, addressee) VALUES ($1, $2) ON CONFLICT DO NOTHING", [u.id, target.id]);
  return { ok: true, accepted: false };
}
async function respondFriend(ctx) {
  const u = await requireUser(ctx);
  const id = Number(ctx.body.friendshipId);
  const accept = ctx.body.accept === true;
  return tx(async (c) => {
    const f = (await c.query(`SELECT * FROM friendships WHERE id = $1 AND addressee = $2 AND status = 'pending' FOR UPDATE`, [id, u.id])).rows[0];
    if (!f) throw bad("Permintaan tidak ditemukan");
    if (accept) {
      await c.query(`UPDATE friendships SET status = 'accepted' WHERE id = $1`, [id]);
      await checkAchievements(c, u.id);
      await checkAchievements(c, f.requester);
    } else {
      await c.query("DELETE FROM friendships WHERE id = $1", [id]);
    }
    return { ok: true };
  });
}
async function removeFriend(ctx) {
  const u = await requireUser(ctx);
  const id = Number(ctx.body.friendshipId);
  await q("DELETE FROM friendships WHERE id = $1 AND (requester = $2 OR addressee = $2)", [id, u.id]);
  return { ok: true };
}

// server/kites.ts
async function listKites(ctx) {
  const u = await requireUser(ctx);
  const kites = await q("SELECT id, name, image, design, size, custom, created_at FROM kites WHERE user_id = $1 ORDER BY id", [u.id]);
  return { kites, selected: u.selected_kite };
}
async function createKite(ctx) {
  const u = await requireUser(ctx);
  rateLimit(`kite:${u.id}`, 15, 60 * 60 * 1e3);
  const name = cleanText(ctx.body.name, "Nama layangan", 2, 24);
  const size = num(ctx.body.size, "Ukuran", 0.7, 1.4);
  const image = validateKiteImage(ctx.body.image);
  const design = { ...sanitizeDesign(ctx.body.design), style: "image" };
  return tx(async (c) => {
    const n = (await c.query("SELECT count(*)::int AS n FROM kites WHERE user_id = $1", [u.id])).rows[0].n;
    if (n >= MAX_KITES_PER_USER) throw bad(`Maksimal ${MAX_KITES_PER_USER} layangan`);
    const r = await c.query(
      `INSERT INTO kites (user_id, name, image, design, size, custom) VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
      [u.id, name, image, design, size]
    );
    if (ctx.body.select === true) await c.query("UPDATE users SET selected_kite = $1 WHERE id = $2", [r.rows[0].id, u.id]);
    const ach = await checkAchievements(c, u.id);
    return { id: r.rows[0].id, achievements: ach };
  });
}
async function updateKite(ctx) {
  const u = await requireUser(ctx);
  const id = Number(ctx.body.id);
  const name = cleanText(ctx.body.name, "Nama layangan", 2, 24);
  const size = num(ctx.body.size, "Ukuran", 0.7, 1.4);
  const r = await q("UPDATE kites SET name = $1, size = $2 WHERE id = $3 AND user_id = $4 RETURNING id", [name, size, id, u.id]);
  if (!r.length) throw bad("Layangan tidak ditemukan");
  return { ok: true };
}
async function selectKite(ctx) {
  const u = await requireUser(ctx);
  const id = Number(ctx.body.id);
  const k = await one("SELECT id FROM kites WHERE id = $1 AND user_id = $2", [id, u.id]);
  if (!k) throw bad("Layangan tidak ditemukan");
  await q("UPDATE users SET selected_kite = $1 WHERE id = $2", [id, u.id]);
  return { ok: true };
}
async function deleteKite(ctx) {
  const u = await requireUser(ctx);
  const id = Number(ctx.body.id);
  return tx(async (c) => {
    const n = (await c.query("SELECT count(*)::int AS n FROM kites WHERE user_id = $1", [u.id])).rows[0].n;
    if (n <= 1) throw bad("Kamu harus punya minimal 1 layangan");
    const r = await c.query("DELETE FROM kites WHERE id = $1 AND user_id = $2 RETURNING id", [id, u.id]);
    if (!r.rows[0]) throw bad("Layangan tidak ditemukan");
    await c.query(
      `UPDATE users SET selected_kite = (SELECT id FROM kites WHERE user_id = $1 ORDER BY id LIMIT 1)
       WHERE id = $1 AND (selected_kite = $2 OR selected_kite IS NULL)`,
      [u.id, id]
    );
    return { ok: true };
  });
}
async function publicKites(ctx) {
  await requireUser(ctx);
  const ids = (Array.isArray(ctx.body.ids) ? ctx.body.ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 12);
  if (!ids.length) return { kites: [] };
  const kites = await q("SELECT id, name, image, design, size FROM kites WHERE id = ANY($1::int[])", [ids]);
  return { kites };
}
async function listTemplates(ctx) {
  const u = await requireUser(ctx);
  const t = await q("SELECT id, name, image, design, size, price FROM kite_templates WHERE enabled ORDER BY price, id");
  const owned = await q("SELECT template_id FROM kites WHERE user_id = $1 AND template_id IS NOT NULL", [u.id]);
  const set = new Set(owned.map((o) => o.template_id));
  return { templates: t.map((x) => ({ ...x, owned: set.has(x.id) })) };
}
async function buyTemplate(ctx) {
  const u = await requireUser(ctx);
  const id = Number(ctx.body.id);
  return tx(async (c) => {
    const t = (await c.query("SELECT * FROM kite_templates WHERE id = $1 AND enabled", [id])).rows[0];
    if (!t) throw bad("Layangan tidak tersedia");
    const owned = (await c.query("SELECT 1 FROM kites WHERE user_id = $1 AND template_id = $2", [u.id, id])).rows[0];
    if (owned) throw bad("Kamu sudah memiliki layangan ini");
    const n = (await c.query("SELECT count(*)::int AS n FROM kites WHERE user_id = $1", [u.id])).rows[0].n;
    if (n >= MAX_KITES_PER_USER) throw bad(`Maksimal ${MAX_KITES_PER_USER} layangan`);
    const pay = await c.query("UPDATE users SET coins = coins - $1 WHERE id = $2 AND coins >= $1 RETURNING coins", [t.price, u.id]);
    if (!pay.rows[0]) throw bad("Coins tidak cukup");
    const k = await c.query(
      "INSERT INTO kites (user_id, name, image, design, size, template_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
      [u.id, t.name, t.image, t.design, t.size, t.id]
    );
    return { id: k.rows[0].id, coins: pay.rows[0].coins };
  });
}

// server/shop.ts
async function shopItems(ctx) {
  await requireUser(ctx);
  return { items: await getItems(), defaultThread: DEFAULT_THREAD };
}
async function buyItem(ctx) {
  const u = await requireUser(ctx);
  rateLimit(`buy:${u.id}`, 30, 60 * 1e3);
  const itemId = String(ctx.body.itemId || "");
  const count = int(ctx.body.count ?? 1, "Jumlah", 1, 10);
  return tx(async (c) => {
    const r = await c.query("SELECT data FROM items WHERE id = $1", [itemId]);
    const item = r.rows[0]?.data;
    if (!item || !item.enabled) throw bad("Item tidak tersedia");
    const cost = item.price * count;
    const pay = await c.query("UPDATE users SET coins = coins - $1 WHERE id = $2 AND coins >= $1 RETURNING coins", [cost, u.id]);
    if (!pay.rows[0]) throw bad("Coins tidak cukup");
    const inv = await c.query(
      `INSERT INTO inventory (user_id, item_id, qty) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, item_id) DO UPDATE SET qty = inventory.qty + EXCLUDED.qty RETURNING qty`,
      [u.id, item.id, item.qty * count]
    );
    await checkAchievements(c, u.id);
    return { coins: pay.rows[0].coins, qty: inv.rows[0].qty, added: item.qty * count };
  });
}
async function inventory(ctx) {
  const u = await requireUser(ctx);
  const inv = await q("SELECT item_id, qty FROM inventory WHERE user_id = $1 ORDER BY item_id", [u.id]);
  const items = await getItems(void 0, true);
  return {
    inventory: inv.map((i) => ({ ...i, item: items.find((x) => x.id === i.item_id) || null })).filter((i) => i.item),
    equipped: u.equipped_thread,
    defaultThread: DEFAULT_THREAD
  };
}
async function equipThread(ctx) {
  const u = await requireUser(ctx);
  const itemId = String(ctx.body.itemId || "");
  if (itemId !== DEFAULT_THREAD.id) {
    const r = await q("SELECT qty FROM inventory WHERE user_id = $1 AND item_id = $2 AND qty > 0", [u.id, itemId]);
    if (!r.length) throw bad("Kamu tidak memiliki benang ini");
  }
  await q("UPDATE users SET equipped_thread = $1 WHERE id = $2", [itemId, u.id]);
  return { ok: true };
}

// server/match.ts
import crypto3 from "node:crypto";

// src/shared/sim.ts
var DT = 1 / 30;
var GROUND_Y = 880;
var HAND_H = 44;
var MAX_BATTLE_PLAYERS = 4;
var MAX_FREE_PLAYERS = 8;
var BATTLE_TIME_MS = 18e4;
var COUNTDOWN_MS = 4e3;
var DISCONNECT_MS = 15e3;
var RESPAWN_MS = 3e3;
var STRING_SEGMENTS = 12;
var clamp = (v, a, b) => v < a ? a : v > b ? b : v;
var wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
var angDiff = (target, a) => wrapAngle(target - a);
function windAt(map, seed, tSec, mul = 1) {
  const b = map.windBase * mul;
  const g = map.gust;
  const t = tSec;
  const osc = 0.35 * Math.sin(t * 0.21 + seed) + 0.25 * Math.sin(t * 0.53 + seed * 1.7) + 0.12 * Math.sin(t * 1.9 + seed * 2.3);
  const gustPulse = Math.pow(Math.max(0, Math.sin(t * 0.11 + seed * 3.1)), 10);
  const speed = Math.max(b * 0.35, b * (1 + g * osc) + gustPulse * b * g * 1.2);
  const dirF = clamp(0.35 + 0.9 * Math.cos(t * 0.025 + seed * 0.37), -1, 1);
  const x = map.windDir * dirF * speed;
  const y = -Math.sin(t * 0.37 + seed) * b * 0.12;
  return { x, y, speed: Math.abs(x) * 0.7 + b * 0.3, gust: gustPulse > 0.35 && g > 0.2 };
}
function handPos(p) {
  return { x: p.px, y: GROUND_Y - HAND_H };
}
function placeKiteAtStart(p, map) {
  const dir = map.windDir;
  p.kx = clamp(p.px + dir * 160, 60, map.width - 60);
  p.ky = 470;
  p.vx = 0;
  p.vy = 0;
  p.a = 0;
  p.L = Math.hypot(p.kx - p.px, p.ky - (GROUND_Y - HAND_H)) + 10;
  p.hp = 100;
  p.tension = 0;
  p.eng = false;
}
function stepPlayer(p, map, w, dt) {
  const inp = p.input;
  p.px = clamp(p.px + clamp(inp.mx, -1, 1) * 150 * dt, 40, map.width - 40);
  if (!p.alive) {
    p.vx += (w.x * 1.3 - p.vx) * 0.8 * dt;
    p.vy += (28 - p.vy) * 0.6 * dt;
    p.kx += p.vx * dt;
    p.ky += p.vy * dt;
    p.a = wrapAngle(p.a + 2.2 * dt);
    if (p.ky > GROUND_Y - 20) {
      p.ky = GROUND_Y - 20;
      p.vy = 0;
    }
    p.tension = 0;
    return;
  }
  const s = p.stats;
  const ctrl = s.control / (0.85 + 0.15 * p.size);
  const turn = (inp.pull ? 1.5 : 4) * ctrl;
  const st = clamp(inp.st, -1, 1);
  p.a += st * turn * dt;
  if (!inp.pull && st === 0) {
    p.a += angDiff(clamp(w.x * 35e-4, -0.6, 0.6), p.a) * 0.9 * dt;
  }
  p.a = wrapAngle(p.a);
  const ws = w.speed;
  let ax = (w.x - p.vx) * 0.85;
  let ay = (w.y - p.vy) * 0.85 + 70 - (60 + ws * 1.1) * (0.9 + 0.1 * p.size);
  if (inp.pull) {
    const F = (170 + ws * 1.1) * ctrl;
    ax += Math.sin(p.a) * F;
    ay -= Math.cos(p.a) * F;
    p.L = Math.max(140, p.L - 60 * dt);
  } else {
    p.L = Math.min(map.maxLen, p.L + (35 + ws * 0.35) * dt);
  }
  p.vx += ax * dt;
  p.vy += ay * dt;
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > 480) {
    p.vx *= 480 / sp;
    p.vy *= 480 / sp;
  }
  p.kx += p.vx * dt;
  p.ky += p.vy * dt;
  const h = handPos(p);
  const dx = p.kx - h.x;
  const dy = p.ky - h.y;
  const d = Math.hypot(dx, dy) || 1;
  p.tension = Math.max(0, p.tension - dt * 2);
  if (d > p.L) {
    const nx = dx / d;
    const ny = dy / d;
    p.kx = h.x + nx * p.L;
    p.ky = h.y + ny * p.L;
    const rv = p.vx * nx + p.vy * ny;
    if (rv > 0) {
      p.vx -= rv * nx;
      p.vy -= rv * ny;
    }
    p.tension = clamp((d - p.L) / 30 + Math.max(rv, 0) / 300 + 0.25, 0, 1);
  }
  const floor = GROUND_Y - 36;
  if (p.ky > floor) {
    p.ky = floor;
    if (p.vy > 0) p.vy *= -0.3;
    p.a += angDiff(0, p.a) * 3 * dt;
  }
  if (p.ky < 30) {
    p.ky = 30;
    if (p.vy < 0) p.vy = 0;
  }
  if (p.kx < 20) {
    p.kx = 20;
    if (p.vx < 0) p.vx = 0;
  }
  if (p.kx > map.width - 20) {
    p.kx = map.width - 20;
    if (p.vx > 0) p.vx = 0;
  }
}
function stringPoints(p, w, n = STRING_SEGMENTS) {
  const h = handPos(p);
  const d = Math.hypot(p.kx - h.x, p.ky - h.y);
  const slack = clamp((p.L - d) / Math.max(p.L, 1), 0, 0.6);
  const cx = (h.x + p.kx) / 2 + w.x * 0.25 * (0.3 + slack);
  const cy = (h.y + p.ky) / 2 + d * (0.06 + slack * 0.55);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const x = u * u * h.x + 2 * u * t * cx + t * t * p.kx;
    const y = u * u * h.y + 2 * u * t * cy + t * t * p.ky;
    pts.push([x, Math.min(y, GROUND_Y - 2)]);
  }
  return pts;
}
function segInter(a, b, c, d) {
  const r0 = b[0] - a[0];
  const r12 = b[1] - a[1];
  const s0 = d[0] - c[0];
  const s1 = d[1] - c[1];
  const den = r0 * s1 - r12 * s0;
  if (Math.abs(den) < 1e-9) return null;
  const qx = c[0] - a[0];
  const qy = c[1] - a[1];
  const t = (qx * s1 - qy * s0) / den;
  const u = (qx * r12 - qy * r0) / den;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return [t, u];
  return null;
}
function findCrossing(pa, pb) {
  const n = pa.length - 1;
  for (let i = 2; i < n; i++) {
    for (let j = 2; j < pb.length - 1; j++) {
      const r = segInter(pa[i], pa[i + 1], pb[j], pb[j + 1]);
      if (r) {
        const sa = (i + r[0]) / n;
        const sb = (j + r[1]) / (pb.length - 1);
        const x = pa[i][0] + (pa[i + 1][0] - pa[i][0]) * r[0];
        const y = pa[i][1] + (pa[i + 1][1] - pa[i][1]) * r[0];
        return { sa, sb, x, y };
      }
    }
  }
  return null;
}
function pushEvent(s, e, now) {
  s.evn += 1;
  s.events.push({ ...e, n: s.evn, t: now });
  if (s.events.length > 16) s.events.splice(0, s.events.length - 16);
}
function makePlayer(base, px, map, now) {
  const p = {
    ...base,
    px,
    kx: 0,
    ky: 0,
    vx: 0,
    vy: 0,
    a: 0,
    L: 300,
    hp: 100,
    alive: true,
    respawnAt: 0,
    input: { mx: 0, st: 0, pull: false },
    lastSeen: now,
    kills: 0,
    tension: 0,
    eng: false,
    left: false
  };
  placeKiteAtStart(p, map);
  return p;
}
function spawnX(map, index, count) {
  const [a, b] = map.spawn;
  if (count <= 1) return (a + b) / 2;
  return a + (b - a) * index / (count - 1);
}
function stepMatch(s, now) {
  if (s.phase === "ended") return;
  for (const p of s.players) {
    if (now - p.lastSeen > DISCONNECT_MS && !p.left) {
      p.left = true;
      if (p.alive && s.mode === "battle" && s.phase === "live") {
        p.alive = false;
        s.cutOrder.push(p.id);
      }
      pushEvent(s, { type: "leave", a: p.id }, now);
    }
  }
  if (s.mode === "free") {
    s.players = s.players.filter((p) => !p.left);
    if (s.players.length === 0) {
      s.phase = "ended";
      s.endAt = now;
      return;
    }
  }
  if (s.phase === "countdown") {
    if (now < s.startAt) {
      s.t = now;
      const tt = now / 1e3;
      for (const p of s.players) {
        p.ky = 470 + Math.sin(tt * 1.3 + p.id) * 12;
        p.a = Math.sin(tt * 0.9 + p.id) * 0.12;
      }
      return;
    }
    s.phase = "live";
    s.t = s.startAt;
    pushEvent(s, { type: "start" }, now);
  }
  const stepMs = DT * 1e3;
  let steps = Math.floor((now - s.t) / stepMs);
  if (steps > 90) {
    s.t = now - 90 * stepMs;
    steps = 90;
  }
  for (let k = 0; k < steps; k++) {
    const tSec = (s.t - s.startAt) / 1e3;
    const w = windAt(s.map, s.seed, tSec, s.windMul);
    if (w.gust && !s.lastGust) pushEvent(s, { type: "gust" }, s.t);
    s.lastGust = w.gust;
    for (const p of s.players) {
      if (s.mode === "free" && !p.alive && p.respawnAt && s.t >= p.respawnAt) {
        p.alive = true;
        p.respawnAt = 0;
        placeKiteAtStart(p, s.map);
        pushEvent(s, { type: "respawn", a: p.id }, s.t);
      }
      stepPlayer(p, s.map, w, DT);
      p.eng = false;
    }
    const alive = s.players.filter((p) => p.alive && !p.left);
    const pts = alive.map((p) => stringPoints(p, w));
    const contacts = [];
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const A = alive[i];
        const B = alive[j];
        const hit = findCrossing(pts[i], pts[j]);
        if (!hit) continue;
        A.eng = true;
        B.eng = true;
        contacts.push({ x: hit.x, y: hit.y, a: A.id, b: B.id });
        const vax = A.vx * hit.sa;
        const vay = A.vy * hit.sa;
        const vbx = B.vx * hit.sb;
        const vby = B.vy * hit.sb;
        const vrel = Math.min(600, Math.hypot(vax - vbx, vay - vby));
        const base = 20 * (0.4 + vrel / 160) * DT;
        const dmgToB = base * A.stats.cutting * (A.input.pull ? 1.35 : 0.7) / B.stats.durability;
        const dmgToA = base * B.stats.cutting * (B.input.pull ? 1.35 : 0.7) / A.stats.durability;
        A.hp -= dmgToA;
        B.hp -= dmgToB;
        const aDead = A.hp <= 0;
        const bDead = B.hp <= 0;
        if (bDead) {
          B.hp = 0;
          B.alive = false;
          A.kills += 1;
          B.respawnAt = s.mode === "free" ? s.t + RESPAWN_MS : 0;
          s.cutOrder.push(B.id);
          pushEvent(s, { type: "cut", a: A.id, b: B.id }, s.t);
        }
        if (aDead) {
          A.hp = 0;
          A.alive = false;
          B.kills += 1;
          A.respawnAt = s.mode === "free" ? s.t + RESPAWN_MS : 0;
          s.cutOrder.push(A.id);
          pushEvent(s, { type: "cut", a: B.id, b: A.id }, s.t);
        }
      }
    }
    s.contacts = contacts;
    for (const p of s.players) {
      if (p.alive && !p.eng) p.hp = Math.min(100, p.hp + 3 * DT);
    }
    s.t += stepMs;
    if (s.mode === "battle") {
      const still = s.players.filter((p) => p.alive && !p.left);
      const timeUp = s.t - s.startAt >= BATTLE_TIME_MS;
      if (still.length <= 1 || timeUp) {
        let winner = null;
        if (still.length === 1) winner = still[0];
        else if (still.length > 1) winner = [...still].sort((x, y) => y.hp - x.hp)[0];
        s.winner = winner ? winner.id : null;
        s.phase = "ended";
        s.endAt = now;
        pushEvent(s, { type: "end", a: s.winner ?? void 0 }, now);
        break;
      }
    }
  }
}

// server/match.ts
var newId = (p) => p + crypto3.randomBytes(6).toString("hex");
async function playerBase(c, userId, consumeThread) {
  const u = (await c.query("SELECT id, username, role, avatar, selected_kite, equipped_thread FROM users WHERE id = $1", [userId])).rows[0];
  if (!u) throw bad("Pemain tidak ditemukan");
  let kiteId = 0;
  let size = 1;
  if (u.selected_kite) {
    const k = (await c.query("SELECT id, size FROM kites WHERE id = $1 AND user_id = $2", [u.selected_kite, userId])).rows[0];
    if (k) {
      kiteId = k.id;
      size = Math.max(0.7, Math.min(1.4, Number(k.size) || 1));
    }
  }
  const th = await resolveThread(c, userId, u.equipped_thread, consumeThread);
  return {
    id: u.id,
    name: pubName(u),
    avatar: { ...DEFAULT_AVATAR, ...u.avatar || {} },
    kiteId,
    size,
    thread: th.id,
    threadName: th.name,
    threadColor: th.color,
    stats: th.stats
  };
}
async function leaveCurrent(c, userId) {
  const u = (await c.query("SELECT active_match FROM users WHERE id = $1 FOR UPDATE", [userId])).rows[0];
  if (!u?.active_match) return;
  await leaveMatchTx(c, userId, u.active_match);
}
async function leaveMatchTx(c, userId, matchId) {
  const row = (await c.query("SELECT state, rewarded FROM matches WHERE id = $1 FOR UPDATE", [matchId])).rows[0];
  await c.query("UPDATE users SET active_match = NULL WHERE id = $1 AND active_match = $2", [userId, matchId]);
  if (!row) return;
  const s = row.state;
  if (s.phase === "ended") return;
  const now = Date.now();
  if (s.mode === "free") {
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
      s.events.push({ n: s.evn, t: now, type: "leave", a: p.id });
    }
  }
  stepMatch(s, now);
  const rewarded = await finalize(c, s, row.rewarded);
  await c.query("UPDATE matches SET state = $2, phase = $3, rewarded = $4, updated_at = now() WHERE id = $1", [
    matchId,
    s,
    s.phase,
    rewarded
  ]);
}
async function createBattle(c, userIds, map) {
  const now = Date.now();
  const mul = await eventMultipliers(c);
  const id = newId("b_");
  const players2 = [];
  for (let i = 0; i < userIds.length; i++) {
    await leaveCurrent(c, userIds[i]);
    const base = await playerBase(c, userIds[i], true);
    players2.push(makePlayer(base, spawnX(map, i, userIds.length), map, now));
  }
  const s = {
    id,
    mode: "battle",
    map,
    seed: Math.floor(Math.random() * 1e3) / 10,
    phase: "countdown",
    startAt: now + COUNTDOWN_MS,
    endAt: 0,
    t: now,
    windMul: mul.wind,
    players: players2,
    contacts: [],
    events: [],
    evn: 0,
    winner: null,
    result: null,
    cutOrder: [],
    lastGust: false
  };
  await c.query("INSERT INTO matches (id, mode, map_id, phase, state, player_ids) VALUES ($1, $2, $3, $4, $5, $6)", [
    id,
    "battle",
    map.id,
    s.phase,
    s,
    userIds
  ]);
  await c.query("UPDATE users SET active_match = $1 WHERE id = ANY($2::int[])", [id, userIds]);
  await c.query("DELETE FROM queue WHERE user_id = ANY($1::int[])", [userIds]);
  return id;
}
async function finalize(c, s, rewarded) {
  if (s.phase !== "ended" || rewarded) return rewarded;
  if (s.mode === "free") return true;
  const rewards = await getRewards(c);
  const mul = await eventMultipliers(c);
  const liveMs = Math.max(0, s.endAt - s.startAt);
  const order = [...s.cutOrder].reverse();
  const result = [];
  const ranked = [
    ...s.winner != null ? [s.winner] : [],
    ...order.filter((id) => id !== s.winner),
    ...s.players.map((p) => p.id).filter((id) => id !== s.winner && !order.includes(id))
  ];
  for (let i = 0; i < ranked.length; i++) {
    const p = s.players.find((x) => x.id === ranked[i]);
    if (!p) continue;
    const win = p.id === s.winner;
    const contested = p.kills > 0 || liveMs >= 3e4;
    let coins = p.left ? 0 : rewards.participation;
    coins += rewards.perCut * p.kills;
    if (win && contested) coins += rewards.win;
    coins = Math.round(coins * mul.coin);
    await c.query(
      `UPDATE users SET coins = coins + $2, wins = wins + $3, losses = losses + $4, matches = matches + 1, cuts = cuts + $5,
        active_match = CASE WHEN active_match = $6 THEN NULL ELSE active_match END WHERE id = $1`,
      [p.id, coins, win ? 1 : 0, win ? 0 : 1, p.kills, s.id]
    );
    await checkAchievements(c, p.id);
    result.push({ id: p.id, name: p.name, place: i + 1, win, coins, cuts: p.kills });
  }
  s.result = result;
  return true;
}
function r1(n) {
  return Math.round(n * 10) / 10;
}
function publicState(s, userId) {
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
      a: Math.round(p.a * 1e3) / 1e3,
      L: r1(p.L),
      hp: r1(p.hp),
      alive: p.alive,
      left: p.left,
      respawnAt: p.respawnAt,
      input: p.input,
      kills: p.kills,
      tension: r1(p.tension),
      eng: p.eng
    })),
    contacts: s.contacts,
    events: s.events,
    winner: s.winner,
    result: s.result
  };
}
async function sync(ctx) {
  const u = await requireUser(ctx);
  const matchId = String(ctx.body.matchId || "");
  const input = sanitizeInput(ctx.body.input);
  return tx(async (c) => {
    const row = (await c.query("SELECT state, rewarded FROM matches WHERE id = $1 FOR UPDATE", [matchId])).rows[0];
    if (!row) throw new HttpError(404, "Pertandingan tidak ditemukan");
    const s = row.state;
    const p = s.players.find((x) => x.id === u.id);
    if (!p) throw new HttpError(403, "Kamu bukan peserta pertandingan ini");
    const now = Date.now();
    if (!p.left) {
      p.input = input;
      p.lastSeen = now;
    }
    const before = s.phase;
    stepMatch(s, now);
    const rewarded = await finalize(c, s, row.rewarded);
    await c.query("UPDATE matches SET state = $2, phase = $3, rewarded = $4, updated_at = now() WHERE id = $1", [
      matchId,
      s,
      s.phase,
      rewarded
    ]);
    if (before !== "ended" && s.phase === "ended") {
      await c.query("UPDATE users SET active_match = NULL WHERE active_match = $1", [matchId]);
    }
    return publicState(s, u.id);
  });
}
async function leave(ctx) {
  const u = await requireUser(ctx);
  const matchId = String(ctx.body.matchId || "");
  await tx(async (c) => {
    const s = (await c.query("SELECT state FROM matches WHERE id = $1", [matchId])).rows[0]?.state;
    if (!s || !s.players.some((p) => p.id === u.id)) {
      await c.query("UPDATE users SET active_match = NULL WHERE id = $1 AND active_match = $2", [u.id, matchId]);
      return;
    }
    await leaveMatchTx(c, u.id, matchId);
  });
  return { ok: true };
}
async function joinFree(ctx) {
  const u = await requireUser(ctx);
  const roomId = typeof ctx.body.roomId === "string" ? ctx.body.roomId : "";
  let mapId = typeof ctx.body.mapId === "string" ? ctx.body.mapId : "";
  return tx(async (c) => {
    const me2 = (await c.query("SELECT active_match FROM users WHERE id = $1 FOR UPDATE", [u.id])).rows[0];
    if (me2?.active_match) {
      const cur = (await c.query("SELECT mode, phase FROM matches WHERE id = $1", [me2.active_match])).rows[0];
      if (cur && cur.mode === "battle" && cur.phase !== "ended") throw bad("Kamu sedang dalam pertandingan");
      if (cur && cur.mode === "free" && cur.phase !== "ended" && (!roomId || roomId === me2.active_match)) {
        return { matchId: me2.active_match };
      }
      await leaveMatchTx(c, u.id, me2.active_match);
    }
    await c.query("DELETE FROM queue WHERE user_id = $1", [u.id]);
    let targetId = null;
    if (roomId) {
      const r = (await c.query(`SELECT id, state FROM matches WHERE id = $1 AND mode = 'free' AND phase <> 'ended'`, [roomId])).rows[0];
      if (!r) throw bad("Room sudah tidak aktif");
      if (r.state.players.length >= MAX_FREE_PLAYERS) throw bad("Room penuh");
      targetId = r.id;
    } else {
      if (!mapId) mapId = (await getMaps(c))[0]?.id || "desa";
      const r = (await c.query(
        `SELECT id FROM matches WHERE mode = 'free' AND phase <> 'ended' AND map_id = $1 AND updated_at > now() - interval '30 seconds'
           AND jsonb_array_length(state->'players') < $2 ORDER BY created_at LIMIT 1`,
        [mapId, MAX_FREE_PLAYERS]
      )).rows[0];
      targetId = r?.id || null;
    }
    const now = Date.now();
    const base = await playerBase(c, u.id, false);
    if (!targetId) {
      const map = await getMap(mapId, c);
      if (!map) throw bad("Map tidak tersedia");
      const mul = await eventMultipliers(c);
      const id = newId("f_");
      const s2 = {
        id,
        mode: "free",
        map,
        seed: Math.floor(Math.random() * 1e3) / 10,
        phase: "live",
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
        lastGust: false
      };
      await c.query("INSERT INTO matches (id, mode, map_id, phase, state, player_ids) VALUES ($1, $2, $3, $4, $5, $6)", [
        id,
        "free",
        map.id,
        "live",
        s2,
        [u.id]
      ]);
      await c.query("UPDATE users SET active_match = $1 WHERE id = $2", [id, u.id]);
      return { matchId: id };
    }
    const row = (await c.query("SELECT state FROM matches WHERE id = $1 FOR UPDATE", [targetId])).rows[0];
    const s = row.state;
    stepMatch(s, now);
    if (s.phase === "ended") throw bad("Room sudah tidak aktif, coba lagi");
    s.players = s.players.filter((p) => p.id !== u.id);
    const x = s.map.spawn[0] + Math.random() * (s.map.spawn[1] - s.map.spawn[0]);
    s.players.push(makePlayer(base, x, s.map, now));
    s.evn += 1;
    s.events.push({ n: s.evn, t: now, type: "join", a: u.id });
    await c.query(
      "UPDATE matches SET state = $2, player_ids = array_append(array_remove(player_ids, $3), $3), updated_at = now() WHERE id = $1",
      [targetId, s, u.id]
    );
    await c.query("UPDATE users SET active_match = $1 WHERE id = $2", [targetId, u.id]);
    return { matchId: targetId };
  });
}
async function freeRooms(ctx) {
  await requireUser(ctx);
  const rows = await q(
    `SELECT id, map_id, jsonb_array_length(state->'players') AS n FROM matches
     WHERE mode = 'free' AND phase <> 'ended' AND updated_at > now() - interval '30 seconds' ORDER BY created_at DESC LIMIT 20`
  );
  return { rooms: rows };
}
async function matchInfo(ctx) {
  const u = await requireUser(ctx);
  const m = await one("SELECT state FROM matches WHERE id = $1", [String(ctx.body.matchId || "")]);
  if (!m || !m.state.players.some((p) => p.id === u.id)) throw new HttpError(404, "Pertandingan tidak ditemukan");
  return publicState(m.state, u.id);
}

// server/matchmaking.ts
async function assertNotInBattle(c, userId) {
  const u = (await c.query("SELECT active_match FROM users WHERE id = $1", [userId])).rows[0];
  if (!u?.active_match) return;
  const m = (await c.query("SELECT mode, phase FROM matches WHERE id = $1", [u.active_match])).rows[0];
  if (m && m.mode === "battle" && m.phase !== "ended") throw bad("Sedang dalam pertandingan");
}
async function joinQueue(ctx) {
  const u = await requireUser(ctx);
  const mapId = String(ctx.body.mapId || "any");
  if (mapId !== "any" && !await getMap(mapId)) throw bad("Map tidak tersedia");
  await tx(async (c) => {
    await assertNotInBattle(c, u.id);
    await leaveCurrent(c, u.id);
    await c.query(
      `INSERT INTO queue (user_id, map_id) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET map_id = EXCLUDED.map_id, joined_at = now(), last_poll = now()`,
      [u.id, mapId]
    );
  });
  return pollQueue(ctx);
}
async function leaveQueue(ctx) {
  const u = await requireUser(ctx);
  await q("DELETE FROM queue WHERE user_id = $1", [u.id]);
  return { ok: true };
}
async function pollQueue(ctx) {
  const u = await requireUser(ctx);
  return tx(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(55501)");
    const mine = (await c.query("SELECT active_match FROM users WHERE id = $1", [u.id])).rows[0];
    if (mine?.active_match) {
      const m = (await c.query("SELECT mode, phase FROM matches WHERE id = $1", [mine.active_match])).rows[0];
      if (m && m.mode === "battle" && m.phase !== "ended") {
        await c.query("DELETE FROM queue WHERE user_id = $1", [u.id]);
        return { matched: mine.active_match };
      }
    }
    const upd = await c.query("UPDATE queue SET last_poll = now() WHERE user_id = $1 RETURNING map_id", [u.id]);
    if (!upd.rows[0]) return { matched: null, inQueue: false, searching: 0 };
    await c.query(`DELETE FROM queue WHERE last_poll < now() - interval '8 seconds'`);
    const rows = (await c.query(`SELECT user_id, map_id, extract(epoch from (now() - joined_at)) AS waited FROM queue ORDER BY joined_at`)).rows;
    const used = /* @__PURE__ */ new Set();
    for (const head of rows) {
      if (used.has(head.user_id)) continue;
      let mapPref = head.map_id;
      const group = [head];
      for (const o of rows) {
        if (o === head || used.has(o.user_id) || group.length >= MAX_BATTLE_PLAYERS) continue;
        if (mapPref === "any" || o.map_id === "any" || o.map_id === mapPref) {
          group.push(o);
          if (mapPref === "any" && o.map_id !== "any") mapPref = o.map_id;
        }
      }
      const ready2 = group.length >= MAX_BATTLE_PLAYERS || group.length >= 2 && Number(head.waited) >= 4;
      if (!ready2) continue;
      let map = mapPref !== "any" ? await getMap(mapPref, c) : null;
      if (!map) {
        const maps = await getMaps(c);
        map = maps[Math.floor(Math.random() * maps.length)];
      }
      if (!map) continue;
      group.forEach((g) => used.add(g.user_id));
      await createBattle(
        c,
        group.map((g) => g.user_id),
        map
      );
    }
    const me2 = (await c.query("SELECT active_match FROM users WHERE id = $1", [u.id])).rows[0];
    const stillQueued = rows.some((r) => r.user_id === u.id) && !used.has(u.id);
    if (used.has(u.id)) return { matched: me2?.active_match || null };
    return { matched: null, inQueue: stillQueued, searching: rows.length };
  });
}
async function sendInvite(ctx) {
  const u = await requireUser(ctx);
  rateLimit(`inv:${u.id}`, 20, 60 * 1e3);
  const mapId = String(ctx.body.mapId || "");
  const map = mapId && mapId !== "any" ? await getMap(mapId) : (await getMaps())[0];
  if (!map) throw bad("Map tidak tersedia");
  let target = null;
  let kind = "challenge";
  if (ctx.body.friendId) {
    const fid = Number(ctx.body.friendId);
    const f = await q(
      `SELECT 1 FROM friendships WHERE status = 'accepted' AND ((requester = $1 AND addressee = $2) OR (requester = $2 AND addressee = $1))`,
      [u.id, fid]
    );
    if (!f.length) throw bad("Hanya bisa mengundang teman");
    target = (await q("SELECT id, role, banned, last_seen FROM users WHERE id = $1", [fid]))[0] || null;
    kind = "friend";
  } else if (ctx.body.playerId) {
    target = (await q("SELECT id, role, banned, last_seen FROM users WHERE id = $1", [Number(ctx.body.playerId)]))[0] || null;
  } else {
    const f = await findUser(ctx.body.username);
    target = f && f.role !== "owner" ? f : null;
  }
  if (!target || target.banned) throw new HttpError(404, "Pemain tidak ditemukan");
  if (target.id === u.id) throw bad("Tidak bisa menantang diri sendiri");
  const online = target.last_seen && Date.now() - new Date(target.last_seen).getTime() < ONLINE_WINDOW_S * 1e3;
  if (!online) throw bad("Pemain sedang offline");
  const pending = await q(
    `SELECT id FROM invites WHERE from_user = $1 AND to_user = $2 AND status = 'pending' AND created_at > now() - ($3 || ' seconds')::interval`,
    [u.id, target.id, String(INVITE_TTL_S)]
  );
  if (pending.length) throw bad("Undangan sudah dikirim, tunggu jawaban");
  const r = await q("INSERT INTO invites (from_user, to_user, map_id, kind) VALUES ($1, $2, $3, $4) RETURNING id", [
    u.id,
    target.id,
    map.id,
    kind
  ]);
  return { inviteId: r[0].id };
}
async function respondInvite(ctx) {
  const u = await requireUser(ctx);
  const id = Number(ctx.body.inviteId);
  const accept = ctx.body.accept === true;
  return tx(async (c) => {
    const inv = (await c.query(
      `SELECT * FROM invites WHERE id = $1 AND to_user = $2 AND status = 'pending'
         AND created_at > now() - ($3 || ' seconds')::interval FOR UPDATE`,
      [id, u.id, String(INVITE_TTL_S)]
    )).rows[0];
    if (!inv) throw bad("Undangan sudah kedaluwarsa");
    if (!accept) {
      await c.query(`UPDATE invites SET status = 'rejected' WHERE id = $1`, [id]);
      return { matchId: null };
    }
    const ids = [inv.from_user, u.id].sort((a, b) => a - b);
    await c.query("SELECT id FROM users WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE", [ids]);
    await assertNotInBattle(c, inv.from_user).catch(() => {
      throw bad("Pengirim sedang dalam pertandingan lain");
    });
    await assertNotInBattle(c, u.id);
    const map = await getMap(inv.map_id, c) || (await getMaps(c))[0];
    const matchId = await createBattle(c, [inv.from_user, u.id], map);
    await c.query(`UPDATE invites SET status = 'accepted', match_id = $2 WHERE id = $1`, [id, matchId]);
    return { matchId };
  });
}
async function cancelInvite(ctx) {
  const u = await requireUser(ctx);
  await q(`UPDATE invites SET status = 'cancelled' WHERE id = $1 AND from_user = $2 AND status = 'pending'`, [Number(ctx.body.inviteId), u.id]);
  return { ok: true };
}

// server/admin.ts
async function overview(ctx) {
  await requireOwner(ctx);
  const stats = await one(
    `SELECT (SELECT count(*)::int FROM users) AS users,
            (SELECT count(*)::int FROM users WHERE last_seen > now() - interval '30 seconds') AS online,
            (SELECT count(*)::int FROM users WHERE banned) AS banned,
            (SELECT count(*)::int FROM queue) AS queue,
            (SELECT count(*)::int FROM matches WHERE phase = 'ended' AND mode = 'battle') AS finished`
  );
  const rows = await q(
    `SELECT id, mode, map_id, phase, state, created_at, updated_at FROM matches
     WHERE phase <> 'ended' AND updated_at > now() - interval '60 seconds' ORDER BY created_at DESC LIMIT 50`
  );
  const ids = [...new Set(rows.flatMap((r) => r.state.players.map((p) => p.id)))];
  const names = ids.length ? await q("SELECT id, username FROM users WHERE id = ANY($1::int[])", [ids]) : [];
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
      players: r.state.players.map((p) => ({ id: p.id, username: nm.get(p.id) || p.name, alive: p.alive, hp: Math.round(p.hp) }))
    }))
  };
}
async function endMatch(ctx) {
  await requireOwner(ctx);
  const id = String(ctx.body.matchId || "");
  await tx(async (c) => {
    const row = (await c.query("SELECT state FROM matches WHERE id = $1 FOR UPDATE", [id])).rows[0];
    if (!row) throw bad("Server tidak ditemukan");
    const s = row.state;
    s.phase = "ended";
    s.endAt = Date.now();
    s.result = s.result || [];
    await c.query(`UPDATE matches SET state = $2, phase = 'ended', rewarded = true, updated_at = now() WHERE id = $1`, [id, s]);
    await c.query("UPDATE users SET active_match = NULL WHERE active_match = $1", [id]);
  });
  return { ok: true };
}
async function players(ctx) {
  await requireOwner(ctx);
  const search = typeof ctx.body.search === "string" ? ctx.body.search.trim().toLowerCase() : "";
  const rows = await q(
    `SELECT id, username, role, coins, wins, losses, matches, cuts, banned, ban_reason, last_seen, created_at
     FROM users WHERE ($1 = '' OR username_lc LIKE '%' || $1 || '%') ORDER BY last_seen DESC NULLS LAST LIMIT 100`,
    [search]
  );
  return { players: rows };
}
async function setCoins(ctx) {
  await requireOwner(ctx);
  const userId = int(ctx.body.userId, "User", 1, 1e9);
  const mode = ctx.body.mode === "set" ? "set" : "add";
  const amount = int(ctx.body.amount, "Jumlah", mode === "set" ? 0 : -1e7, 1e7);
  const r = mode === "set" ? await q("UPDATE users SET coins = $1 WHERE id = $2 RETURNING coins", [amount, userId]) : await q("UPDATE users SET coins = GREATEST(0, coins + $1) WHERE id = $2 RETURNING coins", [amount, userId]);
  if (!r.length) throw bad("Pemain tidak ditemukan");
  return { coins: r[0].coins };
}
async function setBan(ctx) {
  const me2 = await requireOwner(ctx);
  const userId = int(ctx.body.userId, "User", 1, 1e9);
  const banned = ctx.body.banned === true;
  const reason = banned ? cleanText(ctx.body.reason || "Melanggar aturan", "Alasan", 1, 120) : null;
  if (userId === me2.id) throw bad("Tidak bisa memblokir diri sendiri");
  const target = await one("SELECT role FROM users WHERE id = $1", [userId]);
  if (!target) throw bad("Pemain tidak ditemukan");
  if (target.role === "owner") throw bad("Tidak bisa memblokir owner");
  await q("UPDATE users SET banned = $1, ban_reason = $2 WHERE id = $3", [banned, reason, userId]);
  if (banned) {
    await q("DELETE FROM sessions WHERE user_id = $1", [userId]);
    await q("DELETE FROM queue WHERE user_id = $1", [userId]);
  }
  return { ok: true };
}
async function listMaps(ctx) {
  await requireOwner(ctx);
  return { maps: await getMaps(void 0, true), themes: THEMES, weathers: WEATHERS };
}
async function saveMap(ctx) {
  await requireOwner(ctx);
  const m = ctx.body.map || {};
  const id = str(m.id, "ID map", 2, 24).toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(id)) throw bad("ID map hanya huruf kecil/angka");
  const width = int(m.width, "Lebar arena", 1200, 4e3);
  const s0 = num(m.spawn?.[0], "Spawn kiri", 60, width - 60);
  const s1 = num(m.spawn?.[1], "Spawn kanan", s0, width - 60);
  const map = {
    id,
    name: cleanText(m.name, "Nama", 2, 32),
    description: cleanText(m.description || "-", "Deskripsi", 1, 120),
    theme: THEMES.includes(m.theme) ? m.theme : "field",
    weather: WEATHERS.includes(m.weather) ? m.weather : "clear",
    width,
    windBase: num(m.windBase, "Kecepatan angin", 30, 260),
    windDir: Number(m.windDir) < 0 ? -1 : 1,
    gust: num(m.gust, "Gust", 0, 1),
    sky: [color(m.sky?.[0], "#6ec6ff"), color(m.sky?.[1], "#e8f7ff")],
    ground: color(m.ground, "#6aa84f"),
    spawn: [s0, s1],
    maxLen: int(m.maxLen, "Panjang tali max", 400, 1e3),
    enabled: m.enabled !== false,
    sort: int(m.sort ?? 99, "Urutan", 0, 999)
  };
  await q("INSERT INTO maps (id, data, sort) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, sort = EXCLUDED.sort", [
    id,
    map,
    map.sort
  ]);
  return { map };
}
async function listItems(ctx) {
  await requireOwner(ctx);
  return { items: await getItems(void 0, true) };
}
async function saveItem(ctx) {
  await requireOwner(ctx);
  const i = ctx.body.item || {};
  const id = str(i.id, "ID item", 2, 24).toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(id) || id === "kasur") throw bad("ID item tidak valid");
  const item = {
    id,
    kind: "thread",
    name: cleanText(i.name, "Nama", 2, 32),
    description: cleanText(i.description || "-", "Deskripsi", 1, 140),
    price: int(i.price, "Harga", 0, 1e6),
    qty: int(i.qty, "Jumlah per beli", 1, 100),
    durability: num(i.durability, "Durability", 0.3, 5),
    cutting: num(i.cutting, "Cutting power", 0.3, 5),
    control: num(i.control, "Control", 0.3, 3),
    color: color(i.color, "#ffffff"),
    enabled: i.enabled !== false,
    sort: int(i.sort ?? 9, "Urutan", 0, 999)
  };
  await q("INSERT INTO items (id, data, sort) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, sort = EXCLUDED.sort", [
    id,
    item,
    item.sort
  ]);
  return { item };
}
async function listTemplatesAdmin(ctx) {
  await requireOwner(ctx);
  return { templates: await q("SELECT id, name, image, design, size, price, enabled FROM kite_templates ORDER BY id") };
}
async function saveTemplate(ctx) {
  await requireOwner(ctx);
  const t = ctx.body.template || {};
  const name = cleanText(t.name, "Nama", 2, 24);
  const price = int(t.price, "Harga", 0, 1e6);
  const size = num(t.size ?? 1, "Ukuran", 0.7, 1.4);
  const image = t.image ? validateKiteImage(t.image) : null;
  const design = sanitizeDesign(image ? { ...t.design, style: "image" } : t.design);
  if (image) design.style = "image";
  const enabled = t.enabled !== false;
  if (t.id) {
    await q(
      "UPDATE kite_templates SET name = $1, price = $2, size = $3, design = $4, enabled = $5, image = COALESCE($6, image) WHERE id = $7",
      [name, price, size, design, enabled, image, Number(t.id)]
    );
    return { ok: true };
  }
  const r = await q("INSERT INTO kite_templates (name, image, design, size, price, enabled) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id", [
    name,
    image,
    design,
    size,
    price,
    enabled
  ]);
  return { id: r[0].id };
}
async function deleteTemplate(ctx) {
  await requireOwner(ctx);
  await q("DELETE FROM kite_templates WHERE id = $1", [Number(ctx.body.id)]);
  return { ok: true };
}
async function getRewardsAdmin(ctx) {
  await requireOwner(ctx);
  return { rewards: await getRewards() };
}
async function saveRewards(ctx) {
  await requireOwner(ctx);
  const r = ctx.body.rewards || {};
  const rewards = {
    win: int(r.win ?? DEFAULT_REWARDS.win, "Menang", 0, 1e5),
    participation: int(r.participation ?? DEFAULT_REWARDS.participation, "Partisipasi", 0, 1e5),
    perCut: int(r.perCut ?? DEFAULT_REWARDS.perCut, "Per potong", 0, 1e5),
    daily: int(r.daily ?? DEFAULT_REWARDS.daily, "Daily", 0, 1e5),
    startCoins: int(r.startCoins ?? DEFAULT_REWARDS.startCoins, "Coins awal", 0, 1e5)
  };
  await q(`INSERT INTO config (key, value) VALUES ('rewards', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [
    JSON.stringify(rewards)
  ]);
  return { rewards };
}
async function listAnnouncements(ctx) {
  await requireOwner(ctx);
  return { announcements: await q("SELECT id, text, active, created_at FROM announcements ORDER BY created_at DESC LIMIT 50") };
}
async function saveAnnouncement(ctx) {
  await requireOwner(ctx);
  if (ctx.body.id) {
    await q("UPDATE announcements SET active = $1 WHERE id = $2", [ctx.body.active === true, Number(ctx.body.id)]);
    return { ok: true };
  }
  const text = cleanText(ctx.body.text, "Pengumuman", 3, 240);
  await q("INSERT INTO announcements (text) VALUES ($1)", [text]);
  return { ok: true };
}
async function deleteAnnouncement(ctx) {
  await requireOwner(ctx);
  await q("DELETE FROM announcements WHERE id = $1", [Number(ctx.body.id)]);
  return { ok: true };
}
async function listEventsAdmin(ctx) {
  await requireOwner(ctx);
  return { events: await q("SELECT * FROM events ORDER BY starts_at DESC LIMIT 50") };
}
async function saveEvent(ctx) {
  await requireOwner(ctx);
  const e = ctx.body.event || {};
  if (e.id && e.toggle) {
    await q("UPDATE events SET active = NOT active WHERE id = $1", [Number(e.id)]);
    return { ok: true };
  }
  const name = cleanText(e.name, "Nama event", 3, 48);
  const description = cleanText(e.description || "-", "Deskripsi", 1, 200);
  const coinMul = num(e.coinMul ?? 1, "Pengali coins", 0.1, 5);
  const windMul = num(e.windMul ?? 1, "Pengali angin", 0.3, 2.5);
  const claimBonus = int(e.claimBonus ?? 0, "Bonus klaim", 0, 1e5);
  const hours = num(e.hours ?? 24, "Durasi (jam)", 0.1, 24 * 60);
  await q(
    `INSERT INTO events (name, description, coin_mul, wind_mul, claim_bonus, starts_at, ends_at)
     VALUES ($1, $2, $3, $4, $5, now(), now() + ($6 || ' hours')::interval)`,
    [name, description, coinMul, windMul, claimBonus, String(hours)]
  );
  return { ok: true };
}
async function deleteEvent(ctx) {
  await requireOwner(ctx);
  await q("DELETE FROM events WHERE id = $1", [Number(ctx.body.id)]);
  return { ok: true };
}

// server/router.ts
var routes = {
  // Authentication
  "auth/register": register,
  "auth/login": login,
  "auth/logout": logout,
  "auth/password": changePassword,
  // Account / currency
  me,
  "me/heartbeat": heartbeat,
  "me/settings": saveSettings,
  "me/avatar": saveAvatar,
  "daily/claim": claimDaily,
  "events/list": eventsList,
  "events/claim": claimEvent,
  profile,
  // Friends
  "friends/list": listFriends,
  "friends/request": requestFriend,
  "friends/respond": respondFriend,
  "friends/remove": removeFriend,
  // Kites
  "kites/list": listKites,
  "kites/create": createKite,
  "kites/update": updateKite,
  "kites/select": selectKite,
  "kites/delete": deleteKite,
  "kites/public": publicKites,
  "kites/templates": listTemplates,
  "kites/buy-template": buyTemplate,
  // Shop & inventory
  "shop/items": shopItems,
  "shop/buy": buyItem,
  "inventory/list": inventory,
  "inventory/equip": equipThread,
  // Maps
  "maps/list": async (ctx) => {
    await requireUser(ctx);
    return { maps: await getMaps() };
  },
  // Matchmaking / multiplayer
  "mm/join": joinQueue,
  "mm/poll": pollQueue,
  "mm/leave": leaveQueue,
  "invites/send": sendInvite,
  "invites/respond": respondInvite,
  "invites/cancel": cancelInvite,
  "match/sync": sync,
  "match/leave": leave,
  "match/info": matchInfo,
  "free/join": joinFree,
  "free/rooms": freeRooms,
  // Owner panel (all server-side permission checked)
  "admin/overview": overview,
  "admin/match/end": endMatch,
  "admin/players": players,
  "admin/player/coins": setCoins,
  "admin/player/ban": setBan,
  "admin/maps": listMaps,
  "admin/maps/save": saveMap,
  "admin/items": listItems,
  "admin/items/save": saveItem,
  "admin/templates": listTemplatesAdmin,
  "admin/templates/save": saveTemplate,
  "admin/templates/delete": deleteTemplate,
  "admin/rewards": getRewardsAdmin,
  "admin/rewards/save": saveRewards,
  "admin/announcements": listAnnouncements,
  "admin/announcements/save": saveAnnouncement,
  "admin/announcements/delete": deleteAnnouncement,
  "admin/events": listEventsAdmin,
  "admin/events/save": saveEvent,
  "admin/events/delete": deleteEvent,
  health: async () => {
    await ensureSchema();
    return { ok: true, time: Date.now() };
  }
};
async function dispatch(path, ctx) {
  const h = routes[path];
  if (!h) return { status: 404, body: { error: "Endpoint tidak ditemukan" } };
  try {
    const body = await h(ctx);
    return { status: 200, body };
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, body: { error: e.message } };
    if (e?.code === "23514") return { status: 400, body: { error: "Coins tidak cukup" } };
    console.error("API error", path, e?.message);
    return { status: 500, body: { error: "Terjadi kesalahan server, coba lagi." } };
  }
}

// server/entry.ts
var config = { maxDuration: 15 };
async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  const raw = req.query?.p;
  const path = (Array.isArray(raw) ? raw.join("/") : String(raw || "")).replace(/^\/+|\/+$/g, "");
  let body = {};
  if (req.body && typeof req.body === "object") body = req.body;
  else if (typeof req.body === "string" && req.body) {
    try {
      body = JSON.parse(req.body);
    } catch {
      body = {};
    }
  }
  const authz = String(req.headers?.authorization || "");
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : null;
  const ip = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const r = await dispatch(path, { body, token, ip, user: null });
  res.status(r.status).json(r.body);
}
export {
  config,
  handler as default
};
