import { buildBackground } from './scene';
import type { MapDef } from '../shared/sim';

const cache = new Map<string, string>();

export function mapThumb(map: MapDef): string {
  const key = map.id + map.theme + map.weather + map.sky.join() + map.ground + map.width;
  const hit = cache.get(key);
  if (hit) return hit;
  const res = 320 / map.width;
  const cv = buildBackground(map, res);
  const url = cv.toDataURL('image/jpeg', 0.8);
  cache.set(key, url);
  return url;
}
