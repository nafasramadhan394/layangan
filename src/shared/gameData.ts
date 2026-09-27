import type { MapDef } from './sim.js';

// Default server configuration. Seeded into the database on first boot and
// then editable at runtime from the Owner Panel (prices, stats, maps, rewards).

export interface ItemDef {
  id: string;
  kind: 'thread';
  name: string;
  description: string;
  price: number;
  qty: number; // rolls per purchase (1 roll = 1 battle)
  durability: number;
  cutting: number;
  control: number;
  color: string;
  enabled: boolean;
  sort: number;
}

export const DEFAULT_THREAD = {
  id: 'kasur',
  name: 'Benang Kasur',
  color: '#e9e4d8',
  durability: 0.8,
  cutting: 0.8,
  control: 0.9,
};

export const DEFAULT_ITEMS: ItemDef[] = [
  {
    id: 'basic',
    kind: 'thread',
    name: 'Benang Basic',
    description: 'Benang gelasan standar. Seimbang untuk pemula.',
    price: 100,
    qty: 3,
    durability: 1.0,
    cutting: 1.0,
    control: 1.0,
    color: '#f4f1ea',
    enabled: true,
    sort: 1,
  },
  {
    id: 'strong',
    kind: 'thread',
    name: 'Benang Strong',
    description: 'Serat lebih tebal, lebih tahan gesekan.',
    price: 500,
    qty: 3,
    durability: 1.4,
    cutting: 1.25,
    control: 1.05,
    color: '#ffb703',
    enabled: true,
    sort: 2,
  },
  {
    id: 'premium',
    kind: 'thread',
    name: 'Benang Premium',
    description: 'Gelasan kaca halus. Tajam, kuat, dan responsif.',
    price: 1500,
    qty: 3,
    durability: 1.8,
    cutting: 1.6,
    control: 1.2,
    color: '#e63946',
    enabled: true,
    sort: 3,
  },
];

export const DEFAULT_REWARDS = {
  win: 150,
  participation: 30,
  perCut: 40,
  daily: 200,
  startCoins: 500,
};
export type Rewards = typeof DEFAULT_REWARDS;

export const DEFAULT_MAPS: MapDef[] = [
  { id: 'desa', name: 'Desa', description: 'Rumah joglo & pohon kelapa, angin sepoi.', theme: 'village', weather: 'clear', width: 2000, windBase: 90, windDir: 1, gust: 0.5, sky: ['#6ec6ff', '#e8f7ff'], ground: '#6aa84f', spawn: [500, 1500], maxLen: 780, enabled: true, sort: 1 },
  { id: 'kota', name: 'Kota', description: 'Gedung tinggi, angin berputar & gerimis.', theme: 'city', weather: 'drizzle', width: 2200, windBase: 110, windDir: -1, gust: 0.7, sky: ['#8aa4bf', '#dfe7ef'], ground: '#7d8590', spawn: [600, 1600], maxLen: 800, enabled: true, sort: 2 },
  { id: 'pantai', name: 'Pantai', description: 'Angin laut kencang dari samudra.', theme: 'beach', weather: 'clear', width: 2400, windBase: 140, windDir: -1, gust: 0.6, sky: ['#38b6ff', '#d6f4ff'], ground: '#f2d49b', spawn: [600, 1800], maxLen: 840, enabled: true, sort: 3 },
  { id: 'pegunungan', name: 'Pegunungan', description: 'Berkabut, hembusan liar di ketinggian.', theme: 'mountain', weather: 'mist', width: 2000, windBase: 160, windDir: 1, gust: 0.9, sky: ['#5f8fc4', '#dde7f2'], ground: '#4f7a4a', spawn: [500, 1500], maxLen: 820, enabled: true, sort: 4 },
  { id: 'sawah', name: 'Sawah', description: 'Terasering hijau, angin tenang & stabil.', theme: 'rice', weather: 'clear', width: 2200, windBase: 80, windDir: 1, gust: 0.35, sky: ['#8ed3ff', '#f4fbff'], ground: '#7cb342', spawn: [600, 1600], maxLen: 760, enabled: true, sort: 5 },
  { id: 'lapangan', name: 'Lapangan', description: 'Lapangan bola kampung, berawan.', theme: 'field', weather: 'cloudy', width: 1800, windBase: 100, windDir: 1, gust: 0.5, sky: ['#9cc9ea', '#eef5fa'], ground: '#5d9c3b', spawn: [450, 1350], maxLen: 760, enabled: true, sort: 6 },
  { id: 'sunset', name: 'Sunset Hill', description: 'Bukit senja keemasan, angin berubah arah.', theme: 'hill', weather: 'sunset', width: 2000, windBase: 120, windDir: -1, gust: 0.6, sky: ['#ff7e5f', '#ffd29d'], ground: '#6b4f3a', spawn: [500, 1500], maxLen: 800, enabled: true, sort: 7 },
  { id: 'festival', name: 'Festival Layangan', description: 'Umbul-umbul, tenda & sorak penonton.', theme: 'festival', weather: 'festive', width: 2600, windBase: 115, windDir: 1, gust: 0.55, sky: ['#3fa9f5', '#c9efff'], ground: '#88b04b', spawn: [700, 1900], maxLen: 860, enabled: true, sort: 8 },
];

export const THEMES = ['village', 'city', 'beach', 'mountain', 'rice', 'field', 'hill', 'festival'];
export const WEATHERS = ['clear', 'cloudy', 'drizzle', 'mist', 'sunset', 'festive', 'windy'];

export interface AchievementDef {
  code: string;
  name: string;
  desc: string;
  reward: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { code: 'first_match', name: 'Terbang Perdana', desc: 'Selesaikan 1 pertandingan', reward: 50 },
  { code: 'first_win', name: 'Juara Kampung', desc: 'Menangkan adu layangan pertama', reward: 100 },
  { code: 'wins_10', name: 'Raja Angin', desc: 'Menangkan 10 adu layangan', reward: 500 },
  { code: 'matches_25', name: 'Veteran Langit', desc: 'Mainkan 25 pertandingan', reward: 300 },
  { code: 'cuts_10', name: 'Tukang Putus', desc: 'Putuskan 10 tali lawan', reward: 300 },
  { code: 'creator', name: 'Seniman Layangan', desc: 'Buat layangan sendiri dari galeri', reward: 100 },
  { code: 'social', name: 'Kawan Main', desc: 'Punya 3 teman', reward: 150 },
  { code: 'rich', name: 'Juragan Benang', desc: 'Kumpulkan 5.000 Coins', reward: 250 },
];

export const AVATAR_COLORS = ['#e63946', '#1d3557', '#2a9d8f', '#f4a261', '#8338ec', '#ff006e', '#3a86ff', '#588157'];
export const AVATAR_SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524'];
export const AVATAR_HATS = ['none', 'caping', 'peci', 'cap', 'bandana'];

export const DEFAULT_AVATAR = { color: '#e63946', skin: '#e0ac69', hat: 'caping' };
export const DEFAULT_SETTINGS = { volume: 0.7, sfx: true, windSound: true, quality: 'auto', leftHanded: false };
