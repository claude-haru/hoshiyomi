/**
 * 命式（四柱推命のチャート）の組み立て。
 * 出生の瞬間（UTC）＋緯度経度から、四柱・蔵干・十神・十二運・五行バランス・空亡・大運をまとめる。
 * カテゴリ別解釈はフェーズCで追加する。
 */
import type { BirthData, BirthMoment } from '../domain/birthData.ts';
import { resolveBirthMoment } from '../geo/timezone.ts';
import type { Branch, GanZhi, Stem } from './ganzhi.ts';
import { computeFourPillars, type FourPillars, type Pillar } from './pillars.ts';
import { hiddenStemsOf, monthCommandStem, type HiddenRole } from './hiddenStems.ts';
import { tenGod, type TenGod } from './tenGods.ts';
import { twelveStage, type TwelveStage } from './twelveStages.ts';
import { analyzeWuXing, type WuXingAnalysis } from './wuxing.ts';
import { voidBranchesOf, type VoidBranches } from './voidBranches.ts';
import { computeLuckCycle, type LuckCycle } from './luckPeriods.ts';

export interface HiddenStemDetail {
  stem: Stem;
  role: HiddenRole;
  tenGod: TenGod;
  /** 月支の場合、いま司令している蔵干か */
  isCommand: boolean;
}

export interface PillarDetail {
  kind: Pillar['kind'];
  ja: string; // 年柱 / 月柱 / 日柱 / 時柱
  ganZhi: GanZhi;
  /** 天干の十神（日柱の天干＝日主なので null） */
  stemTenGod: TenGod | null;
  hidden: HiddenStemDetail[];
  branch: Branch;
  /** 地支が空亡にあたるか */
  isVoid: boolean;
  /** 日主から見た、この柱の地支の十二運 */
  twelveStage: TwelveStage;
}

export interface BaziChart {
  birth: BirthData;
  moment: BirthMoment;
  pillars: FourPillars;
  dayMaster: Stem;
  monthCommand: Stem;
  daysSinceTerm: number;
  details: PillarDetail[];
  wuxing: WuXingAnalysis;
  voids: VoidBranches;
  /** 性別が指定されていれば大運サイクル */
  luck: LuckCycle | null;
  warnings: string[];
}

const PILLAR_JA: Record<Pillar['kind'], string> = {
  year: '年柱', month: '月柱', day: '日柱', hour: '時柱',
};

export function buildBaziChart(birth: BirthData): BaziChart {
  const resolved = resolveBirthMoment(birth);
  if (!resolved.moment) {
    throw new Error(resolved.error ?? '出生の瞬間を計算できませんでした。');
  }
  const moment = resolved.moment;
  const warnings = [...resolved.warnings];
  if (birth.timeUnknown) {
    warnings.push('出生時刻が不明のため、時柱は正午（真太陽時）での暫定値です。日柱も境界付近では変わりえます。');
  }

  const pillars = computeFourPillars(moment);
  const dayMaster = pillars.day.ganZhi.stem;

  const daysSinceTerm = (moment.date.getTime() - pillars.termPrev.date.getTime()) / 86400000;
  const monthCommand = monthCommandStem(pillars.month.ganZhi.branch.index, daysSinceTerm);

  const voids = voidBranchesOf(pillars.day.ganZhi.index);
  const voidSet = new Set(voids.branches.map((b) => b.index));

  const details: PillarDetail[] = ([pillars.year, pillars.month, pillars.day, pillars.hour] as Pillar[]).map((p) => {
    const branch = p.ganZhi.branch;
    const isMonth = p.kind === 'month';
    const hidden: HiddenStemDetail[] = hiddenStemsOf(branch.index).map((h) => ({
      stem: h.stem,
      role: h.role,
      tenGod: tenGod(dayMaster, h.stem),
      isCommand: isMonth && h.stem.index === monthCommand.index,
    }));
    // 月令の司令蔵干が標準蔵干に含まれない場合（午の丙など）は余気として補う
    if (isMonth && !hidden.some((h) => h.stem.index === monthCommand.index)) {
      hidden.unshift({
        stem: monthCommand,
        role: 'residual',
        tenGod: tenGod(dayMaster, monthCommand),
        isCommand: true,
      });
    }
    return {
      kind: p.kind,
      ja: PILLAR_JA[p.kind],
      ganZhi: p.ganZhi,
      stemTenGod: p.kind === 'day' ? null : tenGod(dayMaster, p.ganZhi.stem),
      branch,
      isVoid: voidSet.has(branch.index),
      hidden,
      twelveStage: twelveStage(dayMaster, branch.index),
    };
  });

  const wuxing = analyzeWuXing(pillars, monthCommand);
  const luck =
    birth.gender === 'male' || birth.gender === 'female'
      ? computeLuckCycle(pillars, birth.gender, moment.date)
      : null;

  return { birth, moment, pillars, dayMaster, monthCommand, daysSinceTerm, details, wuxing, voids, luck, warnings };
}
