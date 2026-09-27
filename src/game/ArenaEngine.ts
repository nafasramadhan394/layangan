import { api, ApiError } from '../lib/api';
import { audio } from '../lib/audio';
import { drawCharacter } from '../lib/character';
import { defaultKiteFor, drawKite, kiteDims } from '../lib/kiteArt';
import { buildBackground, buildCloudSprite } from '../lib/scene';
import type { Kite, NetPlayer, NetState, Settings } from '../lib/types';
import {
  DT,
  GROUND_Y,
  HAND_H,
  WORLD_H,
  BATTLE_TIME_MS,
  angDiff,
  clamp,
  stepPlayer,
  stringPoints,
  windAt,
  type PState,
  type Wind,
} from '../shared/sim';

export interface HudPlayer {
  id: number;
  name: string;
  hp: number;
  alive: boolean;
  kills: number;
  me: boolean;
  threadName: string;
  threadColor: string;
  left: boolean;
}

export interface Hud {
  phase: NetState['phase'] | 'connecting';
  mode: NetState['mode'];
  mapName: string;
  countdown: number;
  timeLeft: number;
  wind: { x: number; speed: number; gust: boolean };
  players: HudPlayer[];
  me: { hp: number; alive: boolean; respawnIn: number; L: number; maxLen: number; eng: boolean } | null;
  ping: number;
  result: NetState['result'];
  winner: number | null;
}

export interface EngineCallbacks {
  onHud: (h: Hud) => void;
  onToast: (msg: string, tone?: 'good' | 'bad' | 'info') => void;
  onEnd: (s: NetState) => void;
  onFatal: (msg: string) => void;
}

interface Snap {
  at: number;
  s: NetState;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class ArenaEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  matchId: string;
  myId: number;
  cb: EngineCallbacks;
  settings: Settings;

  input = { mx: 0, st: 0, pull: false };
  private keys = new Set<string>();
  private touch = { mx: 0, st: 0, pull: false };

  private snaps: Snap[] = [];
  private latest: NetState | null = null;
  private inflight = 0;
  private lastSend = 0;
  private stopped = false;
  private raf = 0;
  private netTimer = 0;
  private rtt = 200;
  private offset = 0; // serverNow - Date.now()
  private offsetInit = false;
  private lastEventN = 0;
  private errors = 0;
  private lastSeqRecv = 0;
  private seq = 0;
  private endNotified = false;
  private lastCountBeep = -1;

  private local: PState | null = null;
  private acc = 0;
  private lastFrame = 0;

  private bg: HTMLCanvasElement | null = null;
  private bgMapKey = '';
  private cloud: HTMLCanvasElement;
  private clouds: { x: number; y: number; s: number; sp: number }[] = [];
  private rain: { x: number; y: number }[] = [];
  private particles: Particle[] = [];
  private kites = new Map<number, Pick<Kite, 'image' | 'design' | 'size' | 'name'>>();
  private kiteFetch = new Set<number>();
  private camX = 0;
  private shake = 0;
  private gustUntil = 0;
  private hudAt = 0;
  private dpr = 1;
  private bgRes = 0.75;

  constructor(canvas: HTMLCanvasElement, matchId: string, myId: number, settings: Settings, cb: EngineCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.matchId = matchId;
    this.myId = myId;
    this.cb = cb;
    this.settings = settings;
    this.cloud = buildCloudSprite();
    const q = settings.quality;
    const devDpr = window.devicePixelRatio || 1;
    this.dpr = q === 'low' ? 1 : q === 'high' ? Math.min(devDpr, 2) : Math.min(devDpr, 1.5);
    this.bgRes = q === 'low' ? 0.5 : q === 'high' ? 1 : 0.75;
    for (let i = 0; i < 9; i++) this.clouds.push({ x: Math.random() * 3000, y: 60 + Math.random() * 360, s: 0.6 + Math.random() * 0.9, sp: 0.2 + Math.random() * 0.3 });
    for (let i = 0; i < 90; i++) this.rain.push({ x: Math.random(), y: Math.random() });
  }

  start() {
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('blur', this.onBlur);
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    this.netLoop();
  }

  stop() {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.netTimer);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('blur', this.onBlur);
    audio.stopLoops();
  }

  setTouch(p: Partial<{ mx: number; st: number; pull: boolean }>) {
    Object.assign(this.touch, p);
    this.recomputeInput();
  }

  private onBlur = () => {
    this.keys.clear();
    this.touch = { mx: 0, st: 0, pull: false };
    this.recomputeInput();
  };

  private onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    const tracked = ['a', 'd', 'arrowleft', 'arrowright', 'j', 'l', ' ', 'w', 'arrowup', 'k'];
    if (!tracked.includes(k)) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    if (e.type === 'keydown') this.keys.add(k);
    else this.keys.delete(k);
    audio.unlock();
    this.recomputeInput();
  };

  private recomputeInput() {
    const k = this.keys;
    const mx = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0) || this.touch.mx;
    const st = (k.has('arrowright') || k.has('l') ? 1 : 0) - (k.has('arrowleft') || k.has('j') ? 1 : 0) || this.touch.st;
    const pull = k.has(' ') || k.has('w') || k.has('arrowup') || k.has('k') || this.touch.pull;
    const changed = mx !== this.input.mx || st !== this.input.st || pull !== this.input.pull;
    this.input = { mx, st, pull };
    if (changed && pull && this.latest?.phase === 'live') audio.twang();
    // send promptly on input change
    if (changed && this.inflight < 2 && performance.now() - this.lastSend > 45) this.send();
  }

  serverNow() {
    return Date.now() + this.offset;
  }

  // ------------------------------------------------------------------ network
  private netLoop = () => {
    if (this.stopped) return;
    const ended = this.latest?.phase === 'ended' && this.latest.result;
    if (!ended) {
      const since = performance.now() - this.lastSend;
      if (this.inflight < 2 && since >= 110) this.send();
    }
    this.netTimer = window.setTimeout(this.netLoop, 30);
  };

  private async send() {
    if (this.stopped) return;
    this.inflight++;
    this.lastSend = performance.now();
    const seq = ++this.seq;
    const t0 = Date.now();
    try {
      const s = await api<NetState>('match/sync', { matchId: this.matchId, input: this.input, seq });
      const t1 = Date.now();
      this.errors = 0;
      const rtt = t1 - t0;
      this.rtt = this.rtt * 0.8 + rtt * 0.2;
      const off = s.now - (t0 + t1) / 2;
      if (!this.offsetInit) {
        this.offset = off;
        this.offsetInit = true;
      } else this.offset = this.offset * 0.9 + off * 0.1;
      if (seq > this.lastSeqRecv) {
        this.lastSeqRecv = seq;
        this.onSnapshot(s);
      }
    } catch (e) {
      if (this.stopped) return;
      const err = e as ApiError;
      if (err.status === 404 || err.status === 403 || err.status === 401) {
        this.cb.onFatal(err.message);
        this.stop();
        return;
      }
      this.errors++;
      if (this.errors === 5) this.cb.onToast('Koneksi tidak stabil\u2026', 'bad');
    } finally {
      this.inflight--;
    }
  }

  private onSnapshot(s: NetState) {
    const prev = this.latest;
    this.latest = s;
    this.snaps.push({ at: performance.now(), s });
    if (this.snaps.length > 30) this.snaps.shift();

    // kite visuals
    const missing = s.players.map((p) => p.kiteId).filter((id) => id > 0 && !this.kites.has(id) && !this.kiteFetch.has(id));
    if (missing.length) {
      missing.forEach((id) => this.kiteFetch.add(id));
      api<{ kites: Kite[] }>('kites/public', { ids: missing })
        .then((r) => r.kites.forEach((k) => this.kites.set(k.id, k)))
        .catch(() => missing.forEach((id) => this.kiteFetch.delete(id)));
    }

    // events
    for (const ev of s.events) {
      if (ev.n <= this.lastEventN) continue;
      if (this.lastEventN === 0 && prev === null && ev.type !== 'start') continue;
      this.handleEvent(ev, s);
    }
    this.lastEventN = Math.max(this.lastEventN, ...s.events.map((e) => e.n), 0);

    // own prediction reconciliation
    const me = s.players.find((p) => p.id === this.myId);
    if (me && s.phase === 'live' && me.alive) {
      const ahead = this.toPState(me);
      const steps = Math.min(15, Math.round(this.rtt / 2 / (DT * 1000)));
      const tBase = (s.t - s.startAt) / 1000;
      for (let i = 0; i < steps; i++) {
        ahead.input = { ...this.input };
        stepPlayer(ahead, s.map, windAt(s.map, s.seed, tBase + i * DT, s.windMul), DT);
      }
      if (!this.local) this.local = ahead;
      else {
        const L = this.local;
        const err = Math.hypot(ahead.kx - L.kx, ahead.ky - L.ky);
        if (err > 160 || Math.abs(ahead.px - L.px) > 120) this.local = ahead;
        else {
          const k = 0.25;
          L.kx = lerp(L.kx, ahead.kx, k);
          L.ky = lerp(L.ky, ahead.ky, k);
          L.vx = lerp(L.vx, ahead.vx, k);
          L.vy = lerp(L.vy, ahead.vy, k);
          L.px = lerp(L.px, ahead.px, k);
          L.L = lerp(L.L, ahead.L, 0.4);
          L.a = L.a + angDiff(ahead.a, L.a) * k;
          L.hp = me.hp;
          L.stats = me.stats;
          L.size = me.size;
        }
      }
    } else {
      this.local = null;
    }

    if (s.phase === 'ended' && s.result && !this.endNotified) {
      this.endNotified = true;
      audio.setRub(false);
      if (s.mode === 'battle') {
        if (s.winner === this.myId) audio.win();
        else audio.lose();
      }
      window.setTimeout(() => this.cb.onEnd(s), 1200);
    }
  }

  private handleEvent(ev: NetState['events'][number], s: NetState) {
    const name = (id?: number) => s.players.find((p) => p.id === id)?.name || 'Pemain';
    if (ev.type === 'start') {
      audio.start();
      this.cb.onToast('MULAI! Adu layangan dimulai', 'info');
    } else if (ev.type === 'cut') {
      audio.snap();
      const victim = s.players.find((p) => p.id === ev.b);
      if (victim) this.burst(victim.kx, victim.ky, 26, ['#fff', '#ffb703', '#e63946']);
      if (ev.b === this.myId) this.cb.onToast(`Talimu diputus oleh ${name(ev.a)}!`, 'bad');
      else if (ev.a === this.myId) this.cb.onToast(`Kamu memutus tali ${name(ev.b)}!`, 'good');
      else this.cb.onToast(`${name(ev.a)} memutus tali ${name(ev.b)}`, 'info');
      this.shake = 10;
    } else if (ev.type === 'gust') {
      audio.gust();
      this.gustUntil = performance.now() + 1800;
      this.shake = Math.max(this.shake, 4);
      this.cb.onToast('Angin kencang!', 'info');
    } else if (ev.type === 'join' && ev.a !== this.myId) {
      this.cb.onToast(`${name(ev.a)} bergabung`, 'info');
    } else if (ev.type === 'leave' && ev.a !== this.myId) {
      this.cb.onToast(`${name(ev.a)} keluar`, 'info');
    } else if (ev.type === 'respawn' && ev.a === this.myId) {
      this.cb.onToast('Layangan baru diterbangkan!', 'good');
    }
  }

  private toPState(p: NetPlayer): PState {
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar as unknown as Record<string, string>,
      kiteId: p.kiteId,
      size: p.size,
      thread: p.thread,
      threadName: p.threadName,
      threadColor: p.threadColor,
      stats: p.stats,
      px: p.px,
      kx: p.kx,
      ky: p.ky,
      vx: p.vx,
      vy: p.vy,
      a: p.a,
      L: p.L,
      hp: p.hp,
      alive: p.alive,
      respawnAt: p.respawnAt,
      input: { ...p.input },
      lastSeen: 0,
      kills: p.kills,
      tension: p.tension,
      eng: p.eng,
      left: p.left,
    };
  }

  // ------------------------------------------------------------------ interpolation
  private interpolated(): NetPlayer[] {
    if (!this.snaps.length) return [];
    const now = performance.now();
    let avgGap = 150;
    if (this.snaps.length > 3) {
      const n = this.snaps.length;
      avgGap = (this.snaps[n - 1].at - this.snaps[Math.max(0, n - 6)].at) / Math.min(5, n - 1);
    }
    const delay = clamp(avgGap * 1.7, 120, 600);
    const rt = now - delay;
    let a = this.snaps[0];
    let b = this.snaps[this.snaps.length - 1];
    for (let i = this.snaps.length - 1; i > 0; i--) {
      if (this.snaps[i - 1].at <= rt) {
        a = this.snaps[i - 1];
        b = this.snaps[i];
        break;
      }
    }
    const span = b.at - a.at;
    const t = span > 0 ? clamp((rt - a.at) / span, 0, 1) : 1;
    return b.s.players.map((pb) => {
      const pa = a.s.players.find((x) => x.id === pb.id);
      if (!pa || pa.alive !== pb.alive) return pb;
      return {
        ...pb,
        px: lerp(pa.px, pb.px, t),
        kx: lerp(pa.kx, pb.kx, t),
        ky: lerp(pa.ky, pb.ky, t),
        a: pa.a + angDiff(pb.a, pa.a) * t,
        L: lerp(pa.L, pb.L, t),
      };
    });
  }

  private burst(x: number, y: number, n: number, colors: string[]) {
    for (let i = 0; i < n; i++) {
      const an = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 220;
      this.particles.push({ x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 60, life: 1, color: colors[i % colors.length], size: 2 + Math.random() * 4 });
    }
  }

  // ------------------------------------------------------------------ render
  private frame = (ts: number) => {
    if (this.stopped) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (ts - this.lastFrame) / 1000);
    this.lastFrame = ts;
    const s = this.latest;
    const cv = this.canvas;
    const cw = cv.clientWidth;
    const ch = cv.clientHeight;
    if (cv.width !== Math.round(cw * this.dpr) || cv.height !== Math.round(ch * this.dpr)) {
      cv.width = Math.round(cw * this.dpr);
      cv.height = Math.round(ch * this.dpr);
    }
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!s) {
      ctx.fillStyle = '#bfe6ff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      this.pushHud(ts, null, [], { x: 0, y: 0, speed: 0, gust: false });
      return;
    }
    const map = s.map;
    const key = map.id + map.width + map.sky.join() + map.theme + map.weather;
    if (key !== this.bgMapKey) {
      this.bg = buildBackground(map, this.bgRes);
      this.bgMapKey = key;
    }
    const sNow = this.serverNow();
    const tSec = s.phase === 'countdown' ? 0 : (sNow - s.startAt) / 1000;
    const wind = windAt(map, s.seed, Math.max(0, tSec), s.windMul);

    // local prediction step
    if (this.local && s.phase === 'live') {
      this.acc += dt;
      let n = 0;
      while (this.acc >= DT && n < 6) {
        this.local.input = { ...this.input };
        stepPlayer(this.local, map, wind, DT);
        this.acc -= DT;
        n++;
      }
    }

    const players = this.interpolated().map((p) => {
      if (p.id === this.myId && this.local && p.alive) {
        return { ...p, px: this.local.px, kx: this.local.kx, ky: this.local.ky, a: this.local.a, L: this.local.L, input: { ...this.input } };
      }
      return p;
    });

    // camera
    const scale = Math.min(ch / WORLD_H, cw / 820);
    const viewW = cw / scale;
    const viewH = ch / scale;
    const me = players.find((p) => p.id === this.myId);
    let target = map.width / 2 - viewW / 2;
    if (me) {
      const focus = me.alive ? me.px * 0.45 + me.kx * 0.55 : me.px;
      target = focus - viewW / 2;
    }
    target = viewW >= map.width ? (map.width - viewW) / 2 : clamp(target, 0, map.width - viewW);
    this.camX = Math.abs(this.camX - target) > 800 ? target : lerp(this.camX, target, Math.min(1, dt * 4));
    const topPad = viewH - WORLD_H;

    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    this.shake = Math.max(0, this.shake - dt * 20);

    ctx.setTransform(scale * this.dpr, 0, 0, scale * this.dpr, 0, 0);
    ctx.fillStyle = map.sky[0];
    ctx.fillRect(0, 0, viewW + 2, viewH + 2);
    ctx.translate(-this.camX + shakeX, topPad + shakeY);

    if (this.bg) ctx.drawImage(this.bg, 0, 0, this.bg.width, this.bg.height, 0, 0, map.width, WORLD_H);

    // clouds drift with the wind
    const cloudCount = map.weather === 'cloudy' || map.weather === 'mist' ? 9 : map.weather === 'drizzle' ? 8 : 5;
    ctx.globalAlpha = map.weather === 'drizzle' ? 0.75 : 0.9;
    for (let i = 0; i < cloudCount; i++) {
      const c = this.clouds[i];
      c.x += wind.x * c.sp * dt;
      const span = map.width + 400;
      if (c.x > span) c.x -= span + 200;
      if (c.x < -300) c.x += span + 200;
      ctx.drawImage(this.cloud, c.x - 200, c.y, 220 * c.s, 100 * c.s);
    }
    ctx.globalAlpha = 1;

    const t = ts / 1000;

    // strings
    for (const p of players) {
      if (!p.alive || p.left) continue;
      const pts = stringPoints(p, wind);
      ctx.strokeStyle = p.threadColor || '#fff';
      ctx.lineWidth = p.id === this.myId ? 2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    // contact sparks
    let meEng = false;
    for (const c of s.contacts) {
      if (c.a === this.myId || c.b === this.myId) meEng = true;
      if (Math.random() < 0.7) this.burst(c.x, c.y, 2, ['#fff7ae', '#ffb703']);
    }
    if (s.phase === 'live') audio.setRub(meEng);

    // kites
    for (const p of players) {
      const vis = this.kites.get(p.kiteId) || defaultKiteFor(p.id);
      const kv = { ...vis, size: p.size };
      if (!p.alive) {
        // cut kite drifting away with a loose piece of string
        ctx.strokeStyle = p.threadColor;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.kx, p.ky);
        ctx.quadraticCurveTo(p.kx - wind.x * 0.3, p.ky + 60, p.kx - wind.x * 0.5 + Math.sin(t * 3) * 10, p.ky + 120);
        ctx.stroke();
        ctx.globalAlpha = 0.85;
      }
      drawKite(ctx, kv, p.kx, p.ky, p.a + Math.sin(t * 2.3 + p.id) * 0.04, t + p.id, clamp(wind.x / 150, -1, 1), wind.gust ? 1.8 : 1);
      ctx.globalAlpha = 1;
      if (p.id !== this.myId && p.alive) {
        const { h } = kiteDims(kv);
        ctx.font = '600 15px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(31,26,61,0.75)';
        ctx.fillText(p.name, p.kx, p.ky - h / 2 - 8);
      }
    }

    // characters
    for (const p of players) {
      if (p.left) continue;
      const hand = { x: p.px, y: GROUND_Y - HAND_H };
      const facing = p.kx >= p.px ? 1 : -1;
      drawCharacter(ctx, p.px, GROUND_Y + 2, p.avatar, t + p.id, p.input?.mx || 0, hand, !!p.input?.pull, facing);
      ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      const label = p.id === this.myId ? 'KAMU' : p.name;
      const tw = ctx.measureText(label).width + 14;
      ctx.fillStyle = p.id === this.myId ? '#e63946' : 'rgba(31,26,61,0.8)';
      ctx.beginPath();
      ctx.roundRect(p.px - tw / 2, GROUND_Y + 16, tw, 22, 11);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(label, p.px, GROUND_Y + 32);
    }

    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pa = this.particles[i];
      pa.life -= dt * 1.4;
      if (pa.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      pa.vy += 200 * dt;
      pa.x += pa.vx * dt;
      pa.y += pa.vy * dt;
      ctx.globalAlpha = pa.life;
      ctx.fillStyle = pa.color;
      ctx.fillRect(pa.x, pa.y, pa.size, pa.size);
    }
    ctx.globalAlpha = 1;
    if (this.particles.length > 300) this.particles.splice(0, this.particles.length - 300);

    // weather overlays (in screen space)
    ctx.setTransform(scale * this.dpr, 0, 0, scale * this.dpr, 0, 0);
    if (map.weather === 'drizzle') {
      ctx.strokeStyle = 'rgba(220,235,255,0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const r of this.rain) {
        r.y += dt * 1.4;
        r.x += (wind.x / 3000) * dt * 10;
        if (r.y > 1) r.y -= 1;
        if (r.x > 1) r.x -= 1;
        if (r.x < 0) r.x += 1;
        const x = r.x * viewW;
        const y = r.y * viewH;
        ctx.moveTo(x, y);
        ctx.lineTo(x + wind.x * 0.08, y + 18);
      }
      ctx.stroke();
    } else if (map.weather === 'mist') {
      const g = ctx.createLinearGradient(0, viewH * 0.35, 0, viewH);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.6, `rgba(240,245,250,${0.25 + Math.sin(t * 0.3) * 0.05})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, viewW, viewH);
    } else if (map.weather === 'festive' && Math.random() < 0.15) {
      this.particles.push({ x: this.camX + Math.random() * viewW, y: -topPad, vx: wind.x * 0.3, vy: 40, life: 3, color: ['#e63946', '#ffb703', '#2a9d8f', '#3a86ff'][Math.floor(Math.random() * 4)], size: 4 });
    }
    // gust streaks
    if (performance.now() < this.gustUntil || wind.gust) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 14; i++) {
        const y = ((i * 97 + t * 40) % viewH) * 0.8;
        const x = ((i * 233 + t * wind.x * 3) % (viewW + 200) + viewW + 200) % (viewW + 200) - 100;
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.sign(wind.x || 1) * 60, y);
      }
      ctx.stroke();
    }

    audio.setWind(clamp(wind.speed / 220, 0.08, 1));

    // countdown beeps
    if (s.phase === 'countdown') {
      const rem = Math.ceil((s.startAt - sNow) / 1000);
      if (rem !== this.lastCountBeep && rem >= 1 && rem <= 3) {
        this.lastCountBeep = rem;
        audio.beep();
      }
    }

    this.pushHud(ts, s, players, wind);
  };

  private pushHud(ts: number, s: NetState | null, players: NetPlayer[], wind: Wind) {
    if (ts - this.hudAt < 120) return;
    this.hudAt = ts;
    if (!s) {
      this.cb.onHud({ phase: 'connecting', mode: 'battle', mapName: '', countdown: 0, timeLeft: 0, wind, players: [], me: null, ping: 0, result: null, winner: null });
      return;
    }
    const sNow = this.serverNow();
    const me = players.find((p) => p.id === this.myId);
    this.cb.onHud({
      phase: s.phase,
      mode: s.mode,
      mapName: s.map.name,
      countdown: Math.max(0, Math.ceil((s.startAt - sNow) / 1000)),
      timeLeft: s.mode === 'battle' && s.phase === 'live' ? Math.max(0, Math.ceil((s.startAt + BATTLE_TIME_MS - sNow) / 1000)) : 0,
      wind: { x: wind.x, speed: wind.speed, gust: wind.gust },
      players: players.map((p) => ({ id: p.id, name: p.name, hp: p.hp, alive: p.alive, kills: p.kills, me: p.id === this.myId, threadName: p.threadName, threadColor: p.threadColor, left: p.left })),
      me: me
        ? {
            hp: me.hp,
            alive: me.alive,
            respawnIn: me.respawnAt ? Math.max(0, Math.ceil((me.respawnAt - sNow) / 1000)) : 0,
            L: me.L,
            maxLen: s.map.maxLen,
            eng: me.eng,
          }
        : null,
      ping: Math.round(this.rtt),
      result: s.result,
      winner: s.winner,
    });
  }
}
