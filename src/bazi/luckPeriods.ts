/**
 * 大運（10 年ごとの運気の柱）と流年（その年の干支）。
 *
 * 大運の方向：
 *   陽年生まれの男性／陰年生まれの女性 → 順行（月柱の次の干支へ）
 *   陰年生まれの男性／陽年生まれの女性 → 逆行（月柱の前の干支へ）
 * 起運数（大運の始まる年齢）：
 *   順行 → 出生から「次の節」までの日数、逆行 → 出生から「前の節」までの日数。
 *   3 日 = 1 歳 で換算。
 */
import { ganZhi, type GanZhi, type Stem } from './ganzhi.ts';
import { tenGod, type TenGod } from './tenGods.ts';
import { twelveStage, type TwelveStage } from './twelveStages.ts';
import { hiddenStemsOf } from './hiddenStems.ts';
import type { FourPillars } from './pillars.ts';

export type LuckDirection = 'forward' | 'backward';

export interface LuckPeriod {
  index: number; // 0 起点
  ganZhi: GanZhi;
  /** この大運に入る年齢（満年齢、小数） */
  startAge: number;
  endAge: number;
  /** 西暦のおおよその開始・終了年 */
  startYear: number;
  endYear: number;
  stemTenGod: TenGod;
  /** 日主から見た、この大運の地支の十二運 */
  twelveStage: TwelveStage;
}

export interface LuckCycle {
  direction: LuckDirection;
  directionJa: string;
  /** 起運年齢（歳・月） */
  startAge: number;
  startAgeLabel: string;
  periods: LuckPeriod[];
}

const YANG_STEMS = new Set([0, 2, 4, 6, 8]); // 甲丙戊庚壬

export function computeLuckCycle(
  fp: FourPillars,
  gender: 'male' | 'female',
  birthInstant: Date,
  count = 9,
): LuckCycle {
  const yearStemIndex = fp.year.ganZhi.stem.index;
  const yangYear = YANG_STEMS.has(yearStemIndex);
  const forward = (yangYear && gender === 'male') || (!yangYear && gender === 'female');
  const direction: LuckDirection = forward ? 'forward' : 'backward';

  // 起運数：節までの日数 ÷ 3
  const targetTerm = forward ? fp.termNext.date : fp.termPrev.date;
  const days = Math.abs(targetTerm.getTime() - birthInstant.getTime()) / 86400000;
  const startAge = days / 3;

  const dayMaster = fp.day.ganZhi.stem;
  const monthIndex = fp.month.ganZhi.index;
  const birthYear = birthInstant.getUTCFullYear();

  const periods: LuckPeriod[] = [];
  for (let n = 0; n < count; n++) {
    const gzIndex = forward ? monthIndex + (n + 1) : monthIndex - (n + 1);
    const gz = ganZhi(gzIndex);
    const a0 = startAge + n * 10;
    periods.push({
      index: n,
      ganZhi: gz,
      startAge: a0,
      endAge: a0 + 10,
      startYear: Math.round(birthYear + a0),
      endYear: Math.round(birthYear + a0 + 10),
      stemTenGod: tenGod(dayMaster, gz.stem),
      twelveStage: twelveStage(dayMaster, gz.branch.index),
    });
  }

  const y = Math.floor(startAge);
  const m = Math.round((startAge - y) * 12);
  return {
    direction,
    directionJa: forward ? '順行' : '逆行',
    startAge,
    startAgeLabel: m > 0 ? `${y}歳${m}ヶ月` : `${y}歳`,
    periods,
  };
}

/** ある大運サイクルで、指定年齢のときに効いている大運 */
export function activeLuckPeriod(cycle: LuckCycle, age: number): LuckPeriod | null {
  for (const p of cycle.periods) {
    if (age >= p.startAge && age < p.endAge) return p;
  }
  return null;
}

// ---- 流年 ----

export interface AnnualPillar {
  year: number;
  ganZhi: GanZhi;
  stemTenGod: TenGod;
  branchHiddenTenGod: TenGod; // 地支本気の十神
  twelveStage: TwelveStage;
}

/** 指定西暦の流年（立春基準。1〜2月上旬は前年扱いになりうる点は呼び出し側で考慮） */
export function annualPillar(year: number, dayMaster: Stem): AnnualPillar {
  const gz = ganZhi(((year - 4) % 60 + 60) % 60);
  const primaryHidden = hiddenStemsOf(gz.branch.index)[0].stem;
  return {
    year,
    ganZhi: gz,
    stemTenGod: tenGod(dayMaster, gz.stem),
    branchHiddenTenGod: tenGod(dayMaster, primaryHidden),
    twelveStage: twelveStage(dayMaster, gz.branch.index),
  };
}
