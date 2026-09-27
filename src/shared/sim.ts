// Shared, deterministic kite physics. Used by the server (authoritative)
// and by the client (prediction + rendering only).

export const DT = 1 / 30;
export const WORLD_H = 1000;
export const GROUND_Y = 880;
export const HAND_H = 44;
export const MAX_BATTLE_PLAYERS = 4;
export const MAX_FREE_PLAYERS = 8;
export const BATTLE_TIME_MS = 180_000;
export const COUNTDOWN_MS = 4_000;
export const DISCONNECT_MS = 15_000;
export const RESPAWN_MS = 3_000;
export const STRING_SEGMENTS = 12;

export interface MapDef {
  id: string;
  name: string;
  description: string;
  theme: string; // village | city | beach | mountain | rice | field | hill | festival
  weather: string; // clear | cloudy | drizzle | mist | sunset | festive | windy
  width: number;
  windBase: number; // px/s
  windDir: number; // 1 = to the right, -1 = to the left
  gust: number; // 0..1
  sky: [string, string];
  ground: string;
  spawn: [number, number];
  maxLen: number;
  enabled: boolean;
  sort: number;
}

export interface ThreadStats {
  durability: number;
  cutting: number;
  control: number;
}

export interface Input {
  mx: number; // walk -1..1
  st: number; // steer -1..1
  pull: boolean; // tarik
}

export interface PState {
  id: number;
  name: string;
  avatar: Record<string, string>;
  kiteId: number;
  size: number;
  thread: string;
  threadName: string;
  threadColor: string;
  stats: ThreadStats;
  px: number;
  kx: number;
  ky: number;
  vx: number;
  vy: number;
  a: number;
  L: number;
  hp: number;
  alive: boolean;
  respawnAt: number;
  input: Input;
  lastSeen: number;
  kills: number;
  tension: number;
  eng: boolean;
  left: boolean;
}

export interface Contact {
  x: number;
  y: number;
  a: number;
  b: number;
}

export interface GameEvent {
  n: number;
  t: number;
  type: 'cut' | 'join' | 'leave' | 'respawn' | 'start' | 'end' | 'gust';
  a?: number;
  b?: number;
}

export interface ResultEntry {
  id: number;
  name: string;
  place: number;
  win: boolean;
  coins: number;
  cuts: number;
}

export interface MatchState {
  id: string;
  mode: 'battle' | 'free';
  map: MapDef;
  seed: number;
  phase: 'countdown' | 'live' | 'ended';
  startAt: number;
  endAt: number;
  t: number;
  windMul: number;
  players: PState[];
  contacts: Contact[];
  events: GameEvent[];
  evn: number;
  winner: number | null;
  result: ResultEntry[] | null;
  cutOrder: number[];
  lastGust: boolean;
}

export interface Wind {
  x: number;
  y: number;
  speed: number;
  gust: boolean;
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const wrapAngle = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
export const angDiff = (target: number, a: number) => wrapAngle(target - a);

/** Deterministic, smoothly-changing wind for a map. tSec = seconds since match start. */
export function windAt(map: MapDef, seed: number, tSec: number, mul = 1): Wind {
  const b = map.windBase * mul;
  const g = map.gust;
  const t = tSec;
  const osc =
    0.35 * Math.sin(t * 0.21 + seed) +
    0.25 * Math.sin(t * 0.53 + seed * 1.7) +
    0.12 * Math.sin(t * 1.9 + seed * 2.3);
  const gustPulse = Math.pow(Math.max(0, Math.sin(t * 0.11 + seed * 3.1)), 10);
  const speed = Math.max(b * 0.35, b * (1 + g * osc) + gustPulse * b * g * 1.2);
  // slow direction change (period ~4 min) — the wind can turn around
  const dirF = clamp(0.35 + 0.9 * Math.cos(t * 0.025 + seed * 0.37), -1, 1);
  const x = map.windDir * dirF * speed;
  const y = -Math.sin(t * 0.37 + seed) * b * 0.12;
  return { x, y, speed: Math.abs(x) * 0.7 + b * 0.3, gust: gustPulse > 0.35 && g > 0.2 };
}

export function handPos(p: { px: number }) {
  return { x: p.px, y: GROUND_Y - HAND_H };
}

export function placeKiteAtStart(p: PState, map: MapDef) {
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

export function stepPlayer(p: PState, map: MapDef, w: Wind, dt: number) {
  const inp = p.input;
  p.px = clamp(p.px + clamp(inp.mx, -1, 1) * 150 * dt, 40, map.width - 40);

  if (!p.alive) {
    // Kite has been cut — it drifts away with the wind, slowly sinking, spinning.
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
  const turn = (inp.pull ? 1.5 : 4.0) * ctrl;
  const st = clamp(inp.st, -1, 1);
  p.a += st * turn * dt;
  if (!inp.pull && st === 0) {
    // weather-vaning: an idle kite turns its nose up/into the wind
    p.a += angDiff(clamp(w.x * 0.0035, -0.6, 0.6), p.a) * 0.9 * dt;
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

  // string constraint
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

  // arena bounds — the kite never leaves the arena or falls through the ground
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

/** Points along the (sagging) kite string, from hand to kite. */
export function stringPoints(
  p: { px: number; kx: number; ky: number; L: number },
  w: { x: number },
  n = STRING_SEGMENTS,
): [number, number][] {
  const h = handPos(p);
  const d = Math.hypot(p.kx - h.x, p.ky - h.y);
  const slack = clamp((p.L - d) / Math.max(p.L, 1), 0, 0.6);
  const cx = (h.x + p.kx) / 2 + w.x * 0.25 * (0.3 + slack);
  const cy = (h.y + p.ky) / 2 + d * (0.06 + slack * 0.55);
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const x = u * u * h.x + 2 * u * t * cx + t * t * p.kx;
    const y = u * u * h.y + 2 * u * t * cy + t * t * p.ky;
    pts.push([x, Math.min(y, GROUND_Y - 2)]);
  }
  return pts;
}

function segInter(
  a: [number, number],
  b: [number, number],
  c: [number, number],
  d: [number, number],
): [number, number] | null {
  const r0 = b[0] - a[0];
  const r1 = b[1] - a[1];
  const s0 = d[0] - c[0];
  const s1 = d[1] - c[1];
  const den = r0 * s1 - r1 * s0;
  if (Math.abs(den) < 1e-9) return null;
  const qx = c[0] - a[0];
  const qy = c[1] - a[1];
  const t = (qx * s1 - qy * s0) / den;
  const u = (qx * r1 - qy * r0) / den;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return [t, u];
  return null;
}

export function findCrossing(pa: [number, number][], pb: [number, number][]) {
  const n = pa.length - 1;
  // skip the first two segments near the hands (strings touching at ground level don't count)
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

function pushEvent(s: MatchState, e: Omit<GameEvent, 'n' | 't'>, now: number) {
  s.evn += 1;
  s.events.push({ ...e, n: s.evn, t: now });
  if (s.events.length > 16) s.events.splice(0, s.events.length - 16);
}

export function makePlayer(
  base: Pick<PState, 'id' | 'name' | 'avatar' | 'kiteId' | 'size' | 'thread' | 'threadName' | 'threadColor' | 'stats'>,
  px: number,
  map: MapDef,
  now: number,
): PState {
  const p: PState = {
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
    left: false,
  };
  placeKiteAtStart(p, map);
  return p;
}

export function spawnX(map: MapDef, index: number, count: number) {
  const [a, b] = map.spawn;
  if (count <= 1) return (a + b) / 2;
  return a + ((b - a) * index) / (count - 1);
}

/** Advance an authoritative match state up to `now` (ms). Mutates `s`. */
export function stepMatch(s: MatchState, now: number) {
  if (s.phase === 'ended') return;

  // disconnect handling
  for (const p of s.players) {
    if (now - p.lastSeen > DISCONNECT_MS && !p.left) {
      p.left = true;
      if (p.alive && s.mode === 'battle' && s.phase === 'live') {
        p.alive = false;
        s.cutOrder.push(p.id);
      }
      pushEvent(s, { type: 'leave', a: p.id }, now);
    }
  }
  if (s.mode === 'free') {
    s.players = s.players.filter((p) => !p.left);
    if (s.players.length === 0) {
      s.phase = 'ended';
      s.endAt = now;
      return;
    }
  }

  if (s.phase === 'countdown') {
    if (now < s.startAt) {
      s.t = now;
      const tt = now / 1000;
      for (const p of s.players) {
        p.ky = 470 + Math.sin(tt * 1.3 + p.id) * 12;
        p.a = Math.sin(tt * 0.9 + p.id) * 0.12;
      }
      return;
    }
    s.phase = 'live';
    s.t = s.startAt;
    pushEvent(s, { type: 'start' }, now);
  }

  const stepMs = DT * 1000;
  let steps = Math.floor((now - s.t) / stepMs);
  if (steps > 90) {
    s.t = now - 90 * stepMs;
    steps = 90;
  }

  for (let k = 0; k < steps; k++) {
    const tSec = (s.t - s.startAt) / 1000;
    const w = windAt(s.map, s.seed, tSec, s.windMul);
    if (w.gust && !s.lastGust) pushEvent(s, { type: 'gust' }, s.t);
    s.lastGust = w.gust;

    for (const p of s.players) {
      if (s.mode === 'free' && !p.alive && p.respawnAt && s.t >= p.respawnAt) {
        p.alive = true;
        p.respawnAt = 0;
        placeKiteAtStart(p, s.map);
        pushEvent(s, { type: 'respawn', a: p.id }, s.t);
      }
      stepPlayer(p, s.map, w, DT);
      p.eng = false;
    }

    // string contact & cutting (server authoritative)
    const alive = s.players.filter((p) => p.alive && !p.left);
    const pts = alive.map((p) => stringPoints(p, w));
    const contacts: Contact[] = [];
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
        const dmgToB = (base * A.stats.cutting * (A.input.pull ? 1.35 : 0.7)) / B.stats.durability;
        const dmgToA = (base * B.stats.cutting * (B.input.pull ? 1.35 : 0.7)) / A.stats.durability;
        A.hp -= dmgToA;
        B.hp -= dmgToB;
        const aDead = A.hp <= 0;
        const bDead = B.hp <= 0;
        if (bDead) {
          B.hp = 0;
          B.alive = false;
          A.kills += 1;
          B.respawnAt = s.mode === 'free' ? s.t + RESPAWN_MS : 0;
          s.cutOrder.push(B.id);
          pushEvent(s, { type: 'cut', a: A.id, b: B.id }, s.t);
        }
        if (aDead) {
          A.hp = 0;
          A.alive = false;
          B.kills += 1;
          A.respawnAt = s.mode === 'free' ? s.t + RESPAWN_MS : 0;
          s.cutOrder.push(A.id);
          pushEvent(s, { type: 'cut', a: B.id, b: A.id }, s.t);
        }
      }
    }
    s.contacts = contacts;
    for (const p of s.players) {
      if (p.alive && !p.eng) p.hp = Math.min(100, p.hp + 3 * DT);
    }

    s.t += stepMs;

    if (s.mode === 'battle') {
      const still = s.players.filter((p) => p.alive && !p.left);
      const timeUp = s.t - s.startAt >= BATTLE_TIME_MS;
      if (still.length <= 1 || timeUp) {
        let winner: PState | null = null;
        if (still.length === 1) winner = still[0];
        else if (still.length > 1) winner = [...still].sort((x, y) => y.hp - x.hp)[0];
        s.winner = winner ? winner.id : null;
        s.phase = 'ended';
        s.endAt = now;
        pushEvent(s, { type: 'end', a: s.winner ?? undefined }, now);
        break;
      }
    }
  }
}
