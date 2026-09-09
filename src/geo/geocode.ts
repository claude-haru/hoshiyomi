/**
 * 地名 → 緯度経度の検索。
 * 1. 内蔵の cities.json（オフライン・即時）
 * 2. 見つからなければ OpenStreetMap Nominatim でオンライン検索（APIキー不要）
 *    - 利用ポリシー順守のため 1 リクエスト/秒に制限し、結果は localStorage にキャッシュ
 */
import { lookupTimezone } from './timezone.ts';

export interface GeoCandidate {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string | null;
  source: 'builtin' | 'nominatim';
  /** 補足（国・地域名など） */
  detail?: string;
}

interface RawCity {
  n: string;
  k: string;
  r: string;
  c: string;
  lat: number;
  lon: number;
  tz: string;
}

let cityCache: RawCity[] | null = null;

async function loadCities(): Promise<RawCity[]> {
  if (cityCache) return cityCache;
  const url = `${import.meta.env.BASE_URL}data/cities.json`;
  try {
    const res = await fetch(url);
    const json = (await res.json()) as { cities: RawCity[] };
    cityCache = json.cities ?? [];
  } catch {
    cityCache = [];
  }
  return cityCache;
}

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    // ひらがな → カタカナ（かな表記のゆれを吸収）
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

export async function searchBuiltin(query: string): Promise<GeoCandidate[]> {
  const q = normalize(query);
  if (!q) return [];
  const cities = await loadCities();
  const scored: { c: RawCity; score: number }[] = [];
  for (const c of cities) {
    const hay = [c.n, c.k, c.r, c.c].map(normalize);
    let score = 0;
    for (const h of hay) {
      if (h === q) score = Math.max(score, 100);
      else if (h.startsWith(q)) score = Math.max(score, 70);
      else if (h.includes(q)) score = Math.max(score, 40);
    }
    if (score > 0) scored.push({ c, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 8).map(({ c }) => ({
    name: c.n,
    latitude: c.lat,
    longitude: c.lon,
    timezone: c.tz,
    source: 'builtin' as const,
    detail: c.c,
  }));
}

// ---- Nominatim ----

const NOMINATIM_CACHE_KEY = 'astro-app:geocode-cache:v1';
let lastNominatimCall = 0;

function readNominatimCache(): Record<string, GeoCandidate[]> {
  try {
    return JSON.parse(localStorage.getItem(NOMINATIM_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}
function writeNominatimCache(cache: Record<string, GeoCandidate[]>): void {
  try {
    localStorage.setItem(NOMINATIM_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* 容量超過などは無視 */
  }
}

export async function searchNominatim(query: string, signal?: AbortSignal): Promise<GeoCandidate[]> {
  const key = normalize(query);
  if (!key) return [];

  const cache = readNominatimCache();
  if (cache[key]) return cache[key];

  // 1 リクエスト/秒
  const wait = 1000 - (Date.now() - lastNominatimCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimCall = Date.now();

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '6');
  url.searchParams.set('accept-language', 'ja');

  const res = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const rows = (await res.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
    name?: string;
    type?: string;
  }>;

  const candidates: GeoCandidate[] = rows.map((row) => {
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    return {
      name: row.name || row.display_name.split(',')[0],
      latitude: lat,
      longitude: lon,
      timezone: lookupTimezone(lat, lon),
      source: 'nominatim' as const,
      detail: row.display_name,
    };
  });

  cache[key] = candidates;
  writeNominatimCache(cache);
  return candidates;
}

/**
 * 内蔵 → オンラインの順で検索。
 * onBuiltin で先に内蔵結果を返し、続けてオンライン結果を足せる。
 */
export async function search(
  query: string,
  opts: { online?: boolean; signal?: AbortSignal } = {},
): Promise<GeoCandidate[]> {
  const builtin = await searchBuiltin(query);
  if (!opts.online) return builtin;
  try {
    const online = await searchNominatim(query, opts.signal);
    // 重複（近い座標）を除去
    const merged = [...builtin];
    for (const o of online) {
      const dup = merged.some(
        (m) => Math.abs(m.latitude - o.latitude) < 0.05 && Math.abs(m.longitude - o.longitude) < 0.05,
      );
      if (!dup) merged.push(o);
    }
    return merged;
  } catch {
    return builtin;
  }
}
