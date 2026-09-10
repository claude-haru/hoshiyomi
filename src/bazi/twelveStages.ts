/**
 * 十二運星（十二運）：ある天干が、ある地支においてどの「気の強さの段階」にあるか。
 * 長生・沐浴・冠帯・臨官・帝旺・衰・病・死・墓・絶・胎・養 の 12 段階。
 *
 * 陽干は地支を順行、陰干は逆行して段階が進む。
 * 長生の起点（地支）は五行と陰陽で決まる。
 */
import type { Stem } from './ganzhi.ts';

export type TwelveStage =
  | 'changsheng' | 'muyu' | 'guandai' | 'linguan' | 'diwang' | 'shuai'
  | 'bing' | 'si' | 'mu' | 'jue' | 'tai' | 'yang';

export const TWELVE_STAGE_JA: Record<TwelveStage, string> = {
  changsheng: '長生', muyu: '沐浴', guandai: '冠帯', linguan: '建禄', diwang: '帝旺', shuai: '衰',
  bing: '病', si: '死', mu: '墓', jue: '絶', tai: '胎', yang: '養',
};

const ORDER: TwelveStage[] = [
  'changsheng', 'muyu', 'guandai', 'linguan', 'diwang', 'shuai',
  'bing', 'si', 'mu', 'jue', 'tai', 'yang',
];

/** 表示順の十二運一覧 */
export const TWELVE_STAGES_ALL: TwelveStage[] = ORDER;

// 各天干の「長生」の地支 index（子=0）
// 甲亥 乙午 丙寅 丁酉 戊寅 己酉 庚巳 辛子 壬申 癸卯
const CHANGSHENG_BRANCH: Record<number, number> = {
  0: 11, 1: 6, 2: 2, 3: 9, 4: 2, 5: 9, 6: 5, 7: 0, 8: 8, 9: 3,
};

/** 天干 stem が 地支 branchIndex にあるときの十二運 */
export function twelveStage(stem: Stem, branchIndex: number): TwelveStage {
  const start = CHANGSHENG_BRANCH[stem.index];
  const forward = stem.yin === 'yang';
  const b = ((branchIndex % 12) + 12) % 12;
  const step = forward ? (b - start + 12) % 12 : (start - b + 12) % 12;
  return ORDER[step];
}
