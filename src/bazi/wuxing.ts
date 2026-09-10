/**
 * 五行バランスと日主（日干）の強弱の簡易判定。
 * ※ 強弱判定は流派・調候まで含めると複雑。ここでは
 *   「日主を強める気（比劫・印）と弱める気（食傷・財・官殺）の比」で
 *   ざっくり 5 段階に分ける簡易版。
 */
import { WU_XING, WU_XING_JA, generates, type Stem, type WuXing } from './ganzhi.ts';
import { hiddenStemsOf } from './hiddenStems.ts';
import type { FourPillars } from './pillars.ts';

export interface ElementScore {
  element: WuXing;
  ja: string;
  score: number;
  /** 全体に対する割合 0..1 */
  ratio: number;
}

export type DayMasterStrength =
  | 'very-strong' | 'strong' | 'balanced' | 'weak' | 'very-weak';

export const DAY_MASTER_STRENGTH_JA: Record<DayMasterStrength, string> = {
  'very-strong': '極身強', strong: '身強', balanced: '中和', weak: '身弱', 'very-weak': '極身弱',
};

export interface WuXingAnalysis {
  scores: ElementScore[];
  strongest: WuXing;
  weakest: WuXing;
  /** 命式に現れない五行 */
  missing: WuXing[];
  dayMasterElement: WuXing;
  strength: DayMasterStrength;
  strengthNote: string;
}

const HIDDEN_WEIGHT = { primary: 0.7, middle: 0.3, residual: 0.2 } as const;

export function analyzeWuXing(fp: FourPillars, monthCommand: Stem): WuXingAnalysis {
  const dm = fp.day.ganZhi.stem;
  const dmElem = dm.element;

  const raw: Record<WuXing, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  let support = 0; // 比劫＋印
  let drain = 0; // 食傷＋財＋官殺

  const add = (elem: WuXing, w: number, isMonth: boolean) => {
    const weight = isMonth ? w * 1.6 : w;
    raw[elem] += weight;
    if (elem === dmElem || generates(elem, dmElem)) support += weight;
    else drain += weight;
  };

  const pillars = [fp.year, fp.month, fp.day, fp.hour];
  for (const p of pillars) {
    const isMonth = p.kind === 'month';
    add(p.ganZhi.stem.element, 1, false); // 天干
    for (const h of hiddenStemsOf(p.ganZhi.branch.index)) {
      add(h.stem.element, HIDDEN_WEIGHT[h.role], isMonth);
    }
  }
  // 月令（司令蔵干）を強めに加点
  add(monthCommand.element, 1.4, true);

  const total = WU_XING.reduce((s, e) => s + raw[e], 0);
  const scores: ElementScore[] = WU_XING.map((element) => ({
    element,
    ja: WU_XING_JA[element],
    score: Math.round(raw[element] * 100) / 100,
    ratio: total ? raw[element] / total : 0,
  }));

  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const missing = scores.filter((s) => s.score < 0.01).map((s) => s.element);

  const ratio = support / (support + drain || 1);
  let strength: DayMasterStrength;
  if (ratio >= 0.6) strength = 'very-strong';
  else if (ratio >= 0.52) strength = 'strong';
  else if (ratio >= 0.44) strength = 'balanced';
  else if (ratio >= 0.36) strength = 'weak';
  else strength = 'very-weak';

  const commandSupportsDm =
    monthCommand.element === dmElem || generates(monthCommand.element, dmElem);

  return {
    scores,
    strongest: sorted[0].element,
    weakest: sorted[sorted.length - 1].element,
    missing,
    dayMasterElement: dmElem,
    strength,
    strengthNote:
      `日主 ${dm.ja}（${WU_XING_JA[dmElem]}）。月令は${commandSupportsDm ? '日主を助けています' : '日主を助けていません'}。` +
      `強める気と弱める気の比＝約 ${Math.round(ratio * 100)}%（簡易判定）。`,
  };
}
