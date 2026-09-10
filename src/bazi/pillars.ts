/**
 * 四柱（年柱・月柱・日柱・時柱）の算出。
 * - 年柱：立春で切り替え
 * - 月柱：節入りで切り替え（地支）＋ 五虎遁（天干）
 * - 日柱：真太陽時の暦日 → ユリウス日 → 六十干支（甲子=0 は 1949-10-01）
 * - 時柱：真太陽時の 2 時間刻み（子=23〜1時）＋ 五鼠遁（天干）
 * - 「子の刻」の日跨ぎは 0:00 で切り替え
 */
import type { BirthMoment } from '../domain/birthData.ts';
import { ganZhi, type GanZhi } from './ganzhi.ts';
import { bracketingTerms, lichun, type SolarTermInstant } from './solarTerms.ts';
import { computeTrueSolarClock, type TrueSolarClock } from './trueSolarTime.ts';

export type PillarKind = 'year' | 'month' | 'day' | 'hour';

export interface Pillar {
  kind: PillarKind;
  ganZhi: GanZhi;
}

export interface FourPillars {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: Pillar;
  trueSolar: TrueSolarClock;
  /** 適用された立春（年柱の基準） */
  lichunUsed: Date;
  /** 出生直前・直後の節 */
  termPrev: SolarTermInstant;
  termNext: SolarTermInstant;
}

/** グレゴリオ暦 → ユリウス日（整数、正午基準の暦日番号） */
export function julianDayNumber(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

function yearPillar(instant: Date): { gz: GanZhi; lichunUsed: Date } {
  const gy = instant.getUTCFullYear();
  const lichunThisYear = lichun(gy);
  // 立春前なら前年の年柱
  const forYear = instant.getTime() < lichunThisYear.getTime() ? gy - 1 : gy;
  const lichunUsed = forYear === gy ? lichunThisYear : lichun(forYear);
  const idx = ((forYear - 4) % 60 + 60) % 60;
  return { gz: ganZhi(idx), lichunUsed };
}

function monthPillar(termPrev: SolarTermInstant, yearStemIndex: number): GanZhi {
  const branchIndex = termPrev.def.branch; // 立春→寅(2) …
  // 五虎遁：寅月の天干 = (年干%5)*2 + 2
  const baseStem = ((yearStemIndex % 5) * 2 + 2) % 10;
  const monthSeq = (branchIndex - 2 + 12) % 12; // 寅=0, 卯=1, …, 子=10, 丑=11
  const stemIndex = (baseStem + monthSeq) % 10;
  // index を stem/branch から復元（60 の中で一致するもの）
  return fromStemBranch(stemIndex, branchIndex);
}

function dayPillar(clock: TrueSolarClock): GanZhi {
  const jdn = julianDayNumber(clock.year, clock.month, clock.day);
  const idx = ((jdn + 49) % 60 + 60) % 60;
  return ganZhi(idx);
}

function hourPillar(clock: TrueSolarClock, dayStemIndex: number): GanZhi {
  const h = clock.hour + clock.minute / 60;
  const branchIndex = Math.floor((h + 1) / 2) % 12; // 23:00–01:00 → 子(0)
  // 五鼠遁：子時の天干 = (日干%5)*2
  const baseStem = ((dayStemIndex % 5) * 2) % 10;
  const stemIndex = (baseStem + branchIndex) % 10;
  return fromStemBranch(stemIndex, branchIndex);
}

/** 天干 index と地支 index から 60干支の GanZhi を得る（整合する index を探す） */
export function fromStemBranch(stemIndex: number, branchIndex: number): GanZhi {
  const s = ((stemIndex % 10) + 10) % 10;
  const b = ((branchIndex % 12) + 12) % 12;
  for (let i = 0; i < 60; i++) {
    if (i % 10 === s && i % 12 === b) return ganZhi(i);
  }
  throw new Error(`不整合な干支: stem ${s}, branch ${b}`);
}

export function computeFourPillars(moment: BirthMoment): FourPillars {
  const trueSolar = computeTrueSolarClock(moment);

  const { gz: yearGz, lichunUsed } = yearPillar(moment.date);
  const { prev: termPrev, next: termNext } = bracketingTerms(moment.date);
  const monthGz = monthPillar(termPrev, yearGz.stem.index);
  const dayGz = dayPillar(trueSolar);
  const hourGz = hourPillar(trueSolar, dayGz.stem.index);

  return {
    year: { kind: 'year', ganZhi: yearGz },
    month: { kind: 'month', ganZhi: monthGz },
    day: { kind: 'day', ganZhi: dayGz },
    hour: { kind: 'hour', ganZhi: hourGz },
    trueSolar,
    lichunUsed,
    termPrev,
    termNext,
  };
}
