/**
 * トランジット（現在の天体の運行）とネイタル（出生図）の関係を計算する。
 * 「時期運」の土台。動きの遅い天体（木星〜冥王星）を中心に、
 * ネイタルの天体・感受点へのアスペクトと、ネイタルハウス通過を求める。
 */
import { computePosition, bodyLongitude, type BodyId, type BodyPosition } from './ephemeris.ts';
import { angularSeparation, deltaAngle, norm360 } from './zodiac.ts';
import { houseOf, type Houses } from './houses.ts';
import type { Chart } from './chart.ts';
import { ASPECT_DEFS, type AspectType } from './aspects.ts';

/** トランジットで見る動天体（太陽・火星＝短期、木星以遠＝時期運の主役） */
export const TRANSIT_BODIES: BodyId[] = ['sun', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

/** 動天体ごとの最大オーブ（度） */
const TRANSIT_ORB: Partial<Record<BodyId, number>> = {
  sun: 2, mars: 2, jupiter: 2.5, saturn: 2.5, uranus: 1.8, neptune: 1.8, pluto: 1.8,
};

/** その天体が「遅い（時期運の主役）」か */
export function isSlow(id: BodyId): boolean {
  return id === 'jupiter' || id === 'saturn' || id === 'uranus' || id === 'neptune' || id === 'pluto';
}

const TRANSIT_ASPECTS: AspectType[] = ['conjunction', 'opposition', 'square', 'trine', 'sextile'];

export interface NatalPoint {
  id: string; // 'sun'..'pluto','northNode','ascendant','mc'
  ja: string;
  longitude: number;
}

export interface TransitAspect {
  transiting: BodyId;
  transitingJa: string;
  natal: NatalPoint;
  type: AspectType;
  ja: string;
  glyph: string;
  nature: 'harmonious' | 'tense' | 'neutral';
  aspectAngle: number;
  orb: number;
  applying: boolean;
  phase: 'applying' | 'exact' | 'separating';
  /** 最も近い正確化の日付（前後 ~1.5 年内） */
  exactDate: Date | null;
  transitingRetro: boolean;
  slow: boolean;
  /** 0..1（1 = ぴったり）× 遅さ補正。並べ替え用 */
  weight: number;
}

export interface HouseTransit {
  transiting: BodyId;
  transitingJa: string;
  house: number;
  /** 出入り関連のハウス番号。無ければ null */
  ingressHouse: number | null;
  /** entering: まもなく次のハウスへ / justEntered: 現ハウスに入ったばかり */
  ingress: 'entering' | 'justEntered' | null;
}

export interface TransitReport {
  date: Date;
  positions: BodyPosition[];
  aspects: TransitAspect[];
  houseTransits: HouseTransit[];
}

const JA: Record<string, string> = {
  sun: '太陽', moon: '月', mercury: '水星', venus: '金星', mars: '火星',
  jupiter: '木星', saturn: '土星', uranus: '天王星', neptune: '海王星', pluto: '冥王星',
  northNode: 'ドラゴンヘッド', southNode: 'ドラゴンテイル', ascendant: 'アセンダント', mc: 'MC',
};

function natalPoints(chart: Chart): NatalPoint[] {
  const pts: NatalPoint[] = chart.bodies
    .filter((b) => b.id !== 'southNode')
    .map((b) => ({ id: b.id, ja: b.ja, longitude: b.longitude }));
  pts.push({ id: 'ascendant', ja: 'アセンダント', longitude: chart.houses.ascendant });
  pts.push({ id: 'mc', ja: 'MC', longitude: chart.houses.mc });
  return pts;
}

/** 指定日の transit 天体黄経（キャッシュ付き） */
function makeLongitudeFn(id: BodyId) {
  const cache = new Map<number, number>();
  return (t: Date): number => {
    const k = Math.round(t.getTime() / 3600000); // 1時間粒度
    const hit = cache.get(k);
    if (hit !== undefined) return hit;
    const lon = bodyLongitude(id, t);
    cache.set(k, lon);
    return lon;
  };
}

/** transitLon(t) と natalLon の差が target になる最も近い日を探す（±windowDays） */
function findExactDate(
  lonFn: (t: Date) => number,
  natalLon: number,
  target: number,
  around: Date,
  windowDays: number,
): Date | null {
  const g = (t: Date) => deltaAngle(target, norm360(lonFn(t) - natalLon)); // [-180,180], 0 が正確化
  const stepDays = 6;
  let best: { t: number; abs: number } | null = null;
  let prevT = around.getTime() - windowDays * 86400000;
  let prevG = g(new Date(prevT));
  for (let d = -windowDays + stepDays; d <= windowDays; d += stepDays) {
    const curT = around.getTime() + d * 86400000;
    const curG = g(new Date(curT));
    if (prevG === 0 || (prevG < 0) !== (curG < 0)) {
      // [prevT, curT] に符号変化 → 二分
      let lo = prevT;
      let hi = curT;
      let glo = prevG;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        const gm = g(new Date(mid));
        if ((glo < 0) !== (gm < 0)) hi = mid;
        else {
          lo = mid;
          glo = gm;
        }
      }
      const root = (lo + hi) / 2;
      const absDist = Math.abs(root - around.getTime());
      if (!best || absDist < best.abs) best = { t: root, abs: absDist };
    }
    prevT = curT;
    prevG = curG;
  }
  return best ? new Date(best.t) : null;
}

export function computeTransits(chart: Chart, date: Date): TransitReport {
  const points = natalPoints(chart);
  const positions: BodyPosition[] = TRANSIT_BODIES.map((id) => computePosition(id, date));
  const aspects: TransitAspect[] = [];

  for (const pos of positions) {
    const id = pos.id;
    const maxOrb = TRANSIT_ORB[id] ?? 2;
    const lonFn = makeLongitudeFn(id);
    const lonNow = pos.longitude;
    const lonSoon = lonFn(new Date(date.getTime() + 2 * 86400000));

    for (const np of points) {
      // 自分自身（transit X と natal X）も conj/opp などとして意味があるので許可
      let bestAspect: TransitAspect | null = null;
      const sep = angularSeparation(lonNow, np.longitude);
      for (const type of TRANSIT_ASPECTS) {
        const def = ASPECT_DEFS.find((d) => d.type === type)!;
        const orb = Math.abs(sep - def.angle);
        if (orb > maxOrb) continue;

        // applying / separating（オーブが縮んでいるか）
        const sepSoon = angularSeparation(lonSoon, np.longitude);
        const orbSoon = Math.abs(sepSoon - def.angle);
        const applying = orbSoon < orb;
        const phase: TransitAspect['phase'] = orb < 0.15 ? 'exact' : applying ? 'applying' : 'separating';

        // 正確化日を探す target（現在の差に最も近い理論オフセット）
        const curOffset = norm360(lonNow - np.longitude);
        const candidates =
          def.angle === 0 ? [0] : def.angle === 180 ? [180] : [def.angle, 360 - def.angle];
        let target = candidates[0];
        let td = 999;
        for (const c of candidates) {
          const dd = Math.abs(deltaAngle(c, curOffset));
          if (dd < td) {
            td = dd;
            target = c;
          }
        }
        const windowDays = isSlow(id) ? 550 : 220;
        const exactDate = findExactDate(lonFn, np.longitude, target, date, windowDays);

        const slow = isSlow(id);
        const weight = (1 - orb / maxOrb) * (slow ? 1.6 : id === 'saturn' ? 1.4 : 1) + (phase === 'applying' ? 0.15 : 0);
        const cand: TransitAspect = {
          transiting: id,
          transitingJa: JA[id] ?? id,
          natal: np,
          type,
          ja: def.ja,
          glyph: def.glyph,
          nature: def.nature,
          aspectAngle: def.angle,
          orb,
          applying,
          phase,
          exactDate,
          transitingRetro: pos.retrograde,
          slow,
          weight,
        };
        if (!bestAspect || cand.orb < bestAspect.orb) bestAspect = cand;
      }
      if (bestAspect) aspects.push(bestAspect);
    }
  }

  aspects.sort((a, b) => b.weight - a.weight);

  // ハウス通過（遅い天体のみ）
  const houseTransits: HouseTransit[] = [];
  for (const pos of positions) {
    if (!isSlow(pos.id)) continue;
    const house = houseOf(pos.longitude, chart.houses.cusps);
    const { ingressHouse, ingress } = detectIngress(pos.longitude, chart.houses);
    houseTransits.push({
      transiting: pos.id,
      transitingJa: JA[pos.id] ?? pos.id,
      house,
      ingressHouse,
      ingress,
    });
  }

  return { date, positions, aspects, houseTransits };
}

function detectIngress(
  lon: number,
  houses: Houses,
): { ingressHouse: number | null; ingress: 'entering' | 'justEntered' | null } {
  const house = houseOf(lon, houses.cusps);
  const nextCusp = houses.cusps[house % 12]; // 現ハウスの次のカスプ
  if (norm360(nextCusp - lon) < 2) {
    return { ingressHouse: (house % 12) + 1, ingress: 'entering' };
  }
  const prevCusp = houses.cusps[house - 1]; // 現ハウスの入口
  if (norm360(lon - prevCusp) < 2) {
    return { ingressHouse: house, ingress: 'justEntered' };
  }
  return { ingressHouse: null, ingress: null };
}
