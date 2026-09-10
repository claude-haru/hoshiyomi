/**
 * 四柱推命の基礎：十干・十二支・六十干支・五行・陰陽。
 */

/** 五行。インデックス: 木0 火1 土2 金3 水4 */
export type WuXing = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
export const WU_XING: WuXing[] = ['wood', 'fire', 'earth', 'metal', 'water'];
export const WU_XING_JA: Record<WuXing, string> = {
  wood: '木', fire: '火', earth: '土', metal: '金', water: '水',
};

export type YinYang = 'yang' | 'yin';

// ---- 十干 ----
export interface Stem {
  index: number; // 0..9
  ja: string;
  yomi: string;
  element: WuXing;
  yin: YinYang;
}
const STEM_JA = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const STEM_YOMI = ['きのえ', 'きのと', 'ひのえ', 'ひのと', 'つちのえ', 'つちのと', 'かのえ', 'かのと', 'みずのえ', 'みずのと'];
export const STEMS: Stem[] = STEM_JA.map((ja, i) => ({
  index: i,
  ja,
  yomi: STEM_YOMI[i],
  element: WU_XING[Math.floor(i / 2)],
  yin: i % 2 === 0 ? 'yang' : 'yin',
}));

// ---- 十二支 ----
export interface Branch {
  index: number; // 0..11
  ja: string;
  yomi: string;
  animal: string;
  element: WuXing;
  yin: YinYang;
}
const BRANCH_JA = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const BRANCH_YOMI = ['ね', 'うし', 'とら', 'う', 'たつ', 'み', 'うま', 'ひつじ', 'さる', 'とり', 'いぬ', 'い'];
const BRANCH_ANIMAL = ['鼠', '牛', '虎', '兎', '龍', '蛇', '馬', '羊', '猿', '鶏', '犬', '猪'];
// 子=水 丑=土 寅=木 卯=木 辰=土 巳=火 午=火 未=土 申=金 酉=金 戌=土 亥=水
const BRANCH_ELEMENT: WuXing[] = [
  'water', 'earth', 'wood', 'wood', 'earth', 'fire',
  'fire', 'earth', 'metal', 'metal', 'earth', 'water',
];
export const BRANCHES: Branch[] = BRANCH_JA.map((ja, i) => ({
  index: i,
  ja,
  yomi: BRANCH_YOMI[i],
  animal: BRANCH_ANIMAL[i],
  element: BRANCH_ELEMENT[i],
  yin: i % 2 === 0 ? 'yang' : 'yin',
}));

// ---- 六十干支 ----
export interface GanZhi {
  index: number; // 0..59（甲子=0）
  stem: Stem;
  branch: Branch;
  ja: string;
}
export function ganZhi(index: number): GanZhi {
  const i = ((index % 60) + 60) % 60;
  const stem = STEMS[i % 10];
  const branch = BRANCHES[i % 12];
  return { index: i, stem, branch, ja: stem.ja + branch.ja };
}

/** 干支名（甲子など）→ index。見つからなければ -1 */
export function ganZhiIndexByName(name: string): number {
  for (let i = 0; i < 60; i++) if (ganZhi(i).ja === name) return i;
  return -1;
}

// ---- 五行の相互関係 ----
export function elementIndex(e: WuXing): number {
  return WU_XING.indexOf(e);
}
/** a が b を生じる（木→火→土→金→水→木） */
export function generates(a: WuXing, b: WuXing): boolean {
  return (elementIndex(a) + 1) % 5 === elementIndex(b);
}
/** a が b を剋する（木剋土・土剋水・水剋火・火剋金・金剋木） */
export function controls(a: WuXing, b: WuXing): boolean {
  return (elementIndex(a) + 2) % 5 === elementIndex(b);
}
