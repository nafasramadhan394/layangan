import type { MapDef, ThreadStats } from '../shared/sim';
import type { ItemDef } from '../shared/gameData';

export interface Avatar {
  color: string;
  skin: string;
  hat: string;
}

export interface KiteDesign {
  style: string;
  colors: string[];
  tail: boolean;
  tailColor?: string;
}

export interface Kite {
  id: number;
  name: string;
  image: string | null;
  design: KiteDesign;
  size: number;
  custom?: boolean;
}

export interface Settings {
  volume: number;
  sfx: boolean;
  windSound: boolean;
  quality: 'auto' | 'low' | 'high';
  leftHanded: boolean;
}

export interface Me {
  id: number;
  username: string;
  role: string;
  isOwner: boolean;
  coins: number;
  wins: number;
  losses: number;
  matches: number;
  cuts: number;
  avatar: Avatar;
  settings: Settings;
  selectedKite: Kite | null;
  equippedThread: string;
  inventory: { item_id: string; qty: number }[];
  activeMatch: string | null;
  dailyAvailable: boolean;
  createdAt: string;
}

export interface Invite {
  id: number;
  mapId: string;
  kind: string;
  from: { id: number; name: string; avatar: Avatar };
  createdAt: string;
}

export interface Heartbeat {
  coins: number;
  wins: number;
  losses: number;
  invites: Invite[];
  outgoing: { id: number; status: string; matchId: string | null; to: string }[];
  friendRequests: number;
  announcements: { id: number; text: string; created_at: string }[];
  events: { id: number; name: string; description: string; coin_mul: number; wind_mul: number; claim_bonus: number; ends_at: string }[];
  activeMatch: { id: string; mode: string; phase: string } | null;
}

export interface NetPlayer {
  id: number;
  name: string;
  avatar: Avatar;
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
  left: boolean;
  respawnAt: number;
  input: { mx: number; st: number; pull: boolean };
  kills: number;
  tension: number;
  eng: boolean;
}

export interface NetState {
  id: string;
  mode: 'battle' | 'free';
  map: MapDef;
  seed: number;
  phase: 'countdown' | 'live' | 'ended';
  startAt: number;
  endAt: number;
  t: number;
  windMul: number;
  now: number;
  you: number;
  players: NetPlayer[];
  contacts: { x: number; y: number; a: number; b: number }[];
  events: { n: number; t: number; type: string; a?: number; b?: number }[];
  winner: number | null;
  result: { id: number; name: string; place: number; win: boolean; coins: number; cuts: number }[] | null;
}

export type { MapDef, ItemDef };
