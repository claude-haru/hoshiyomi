/**
 * ネイタルチャート（出生図）の組み立て。
 * 出生の瞬間（UTC）と緯度経度から、天体位置・ハウス・アスペクトをまとめる。
 */
import type { BirthData, BirthMoment } from '../domain/birthData.ts';
import { resolveBirthMoment } from '../geo/timezone.ts';
import { BODIES, toSignPosition, type SignPosition } from './zodiac.ts';
import { computePositions, DEFAULT_BODIES, type BodyId, type BodyPosition } from './ephemeris.ts';
import { computeHouses, houseOf, type Houses } from './houses.ts';
import { detectAspects, type Aspect, type AspectOptions } from './aspects.ts';

export interface PlacedBody extends BodyPosition {
  ja: string;
  glyph: string;
  sign: SignPosition;
  /** 所属ハウス（1..12）。出生時刻不明時も暫定値を返す */
  house: number;
}

export interface AnglePoint {
  id: 'ascendant' | 'mc';
  ja: string;
  glyph: string;
  longitude: number;
  sign: SignPosition;
}

export interface Chart {
  birth: BirthData;
  moment: BirthMoment;
  warnings: string[];
  bodies: PlacedBody[];
  angles: AnglePoint[];
  houses: Houses;
  aspects: Aspect[];
  /** 主要 3 点の手早い参照 */
  summary: {
    sun: SignPosition;
    moon: SignPosition;
    ascendant: SignPosition;
  };
}

export interface ChartOptions {
  bodies?: BodyId[];
  aspects?: AspectOptions;
}

export function buildChart(birth: BirthData, opts: ChartOptions = {}): Chart {
  const resolved = resolveBirthMoment(birth);
  if (!resolved.moment) {
    throw new Error(resolved.error ?? '出生の瞬間を計算できませんでした。');
  }
  const moment = resolved.moment;
  const warnings = [...resolved.warnings];

  const bodyIds = opts.bodies ?? DEFAULT_BODIES;
  const rawPositions = computePositions(moment.date, bodyIds);
  const houses = computeHouses(moment.date, moment.latitude, moment.longitude);
  warnings.push(...houses.warnings);

  const bodies: PlacedBody[] = rawPositions.map((p) => ({
    ...p,
    ja: BODIES[p.id]?.ja ?? p.id,
    glyph: BODIES[p.id]?.glyph ?? '?',
    sign: toSignPosition(p.longitude),
    house: houseOf(p.longitude, houses.cusps),
  }));

  const angles: AnglePoint[] = [
    {
      id: 'ascendant',
      ja: BODIES.ascendant.ja,
      glyph: 'ASC',
      longitude: houses.ascendant,
      sign: toSignPosition(houses.ascendant),
    },
    {
      id: 'mc',
      ja: BODIES.mc.ja,
      glyph: 'MC',
      longitude: houses.mc,
      sign: toSignPosition(houses.mc),
    },
  ];

  // アスペクトは天体＋ASC/MC を含めて検出
  const aspectInput: BodyPosition[] = [
    ...rawPositions,
    { id: 'ascendant' as BodyId, longitude: houses.ascendant, latitude: 0, distanceAU: NaN, speed: 0, retrograde: false },
    { id: 'mc' as BodyId, longitude: houses.mc, latitude: 0, distanceAU: NaN, speed: 0, retrograde: false },
  ];
  const aspects = detectAspects(aspectInput, opts.aspects);

  const sun = bodies.find((b) => b.id === 'sun')!;
  const moon = bodies.find((b) => b.id === 'moon')!;

  return {
    birth,
    moment,
    warnings,
    bodies,
    angles,
    houses,
    aspects,
    summary: {
      sun: sun.sign,
      moon: moon.sign,
      ascendant: toSignPosition(houses.ascendant),
    },
  };
}
