/**
 * 天体の黄経（その日の分点基準＝トロピカル）を天文学的に計算する。
 * astronomy-engine（VSOP87/ELP ベース、誤差 ~1 分角）を使用。
 *
 * - 太陽: SunPosition（黄道座標・of date）
 * - 月: EclipticGeoMoon（of date）
 * - 惑星: GeoVector → EQJ→ECT 回転 → 球面座標
 * - ノード（ドラゴンヘッド/テイル）: 月の位置・速度ベクトルから昇交点を算出（True Node）
 */
import * as Astronomy from 'astronomy-engine';
import { norm360, R2D } from './zodiac.ts';

export type BodyId =
  | 'sun'
  | 'moon'
  | 'mercury'
  | 'venus'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'pluto'
  | 'northNode'
  | 'southNode';

export interface BodyPosition {
  id: BodyId;
  /** 黄経 0..360（度） */
  longitude: number;
  /** 黄緯（度） */
  latitude: number;
  /** 地心距離（AU）。ノードは対象外で NaN */
  distanceAU: number;
  /** 1 日あたりの黄経速度（度/日、負なら逆行） */
  speed: number;
  retrograde: boolean;
}

const PLANET_BODY: Partial<Record<BodyId, Astronomy.Body>> = {
  mercury: Astronomy.Body.Mercury,
  venus: Astronomy.Body.Venus,
  mars: Astronomy.Body.Mars,
  jupiter: Astronomy.Body.Jupiter,
  saturn: Astronomy.Body.Saturn,
  uranus: Astronomy.Body.Uranus,
  neptune: Astronomy.Body.Neptune,
  pluto: Astronomy.Body.Pluto,
};

function eclipticOfDate(body: Astronomy.Body, date: Date): { lon: number; lat: number; dist: number } {
  const vec = Astronomy.GeoVector(body, date, true);
  const rot = Astronomy.Rotation_EQJ_ECT(date);
  const ect = Astronomy.RotateVector(rot, vec);
  const sph = Astronomy.SphereFromVector(ect);
  return { lon: norm360(sph.lon), lat: sph.lat, dist: sph.dist };
}

function sunLonLat(date: Date): { lon: number; lat: number; dist: number } {
  const s = Astronomy.SunPosition(date);
  return { lon: norm360(s.elon), lat: s.elat, dist: Math.hypot(s.vec.x, s.vec.y, s.vec.z) };
}

function moonLonLat(date: Date): { lon: number; lat: number; dist: number } {
  const m = Astronomy.EclipticGeoMoon(date);
  return { lon: norm360(m.lon), lat: m.lat, dist: m.dist };
}

/** 月の状態ベクトルから昇交点（True Node）の黄経を求める */
function trueNodeLongitude(date: Date): number {
  const state = Astronomy.GeoMoonState(date);
  const rot = Astronomy.Rotation_EQJ_ECT(date);
  const rs = Astronomy.RotateState(rot, state);
  // 角運動量 h = r × v
  const hx = rs.y * rs.vz - rs.z * rs.vy;
  const hy = rs.z * rs.vx - rs.x * rs.vz;
  // 昇交点方向 n = ẑ × h = (-hy, hx, 0)
  const nx = -hy;
  const ny = hx;
  return norm360(Math.atan2(ny, nx) * R2D);
}

function rawLongitude(id: BodyId, date: Date): number {
  if (id === 'sun') return sunLonLat(date).lon;
  if (id === 'moon') return moonLonLat(date).lon;
  if (id === 'northNode') return trueNodeLongitude(date);
  if (id === 'southNode') return norm360(trueNodeLongitude(date) + 180);
  const body = PLANET_BODY[id];
  if (!body) throw new Error(`unknown body: ${id}`);
  return eclipticOfDate(body, date).lon;
}

/** 黄経のみ（速度計算なし・軽量）。トランジットの正確化日探索などに使う */
export function bodyLongitude(id: BodyId, date: Date): number {
  return rawLongitude(id, date);
}

export const DEFAULT_BODIES: BodyId[] = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
  'northNode',
  'southNode',
];

export function computePosition(id: BodyId, date: Date): BodyPosition {
  let lon: number;
  let lat = 0;
  let dist = NaN;

  if (id === 'sun') {
    const r = sunLonLat(date);
    lon = r.lon;
    lat = r.lat;
    dist = r.dist;
  } else if (id === 'moon') {
    const r = moonLonLat(date);
    lon = r.lon;
    lat = r.lat;
    dist = r.dist;
  } else if (id === 'northNode' || id === 'southNode') {
    lon = rawLongitude(id, date);
  } else {
    const r = eclipticOfDate(PLANET_BODY[id]!, date);
    lon = r.lon;
    lat = r.lat;
    dist = r.dist;
  }

  // 速度（中央差分、±0.5 日）
  const dtMs = 12 * 3600 * 1000;
  const before = rawLongitude(id, new Date(date.getTime() - dtMs));
  const after = rawLongitude(id, new Date(date.getTime() + dtMs));
  let d = after - before;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  const speed = d; // 1 日あたり

  return {
    id,
    longitude: lon,
    latitude: lat,
    distanceAU: dist,
    speed,
    retrograde: speed < 0,
  };
}

export function computePositions(date: Date, bodies: BodyId[] = DEFAULT_BODIES): BodyPosition[] {
  return bodies.map((b) => computePosition(b, date));
}
