/**
 * 蔵干（地支に内蔵される天干）。
 * - 固定蔵干：各支の 本気／中気／余気
 * - 月令：月支については、節入りからの経過日数で「今どの蔵干が司令しているか」が変わる
 *
 * ※ 蔵干・月令の日数配分は流派により差がある。ここでは日本の四柱推命で
 *    比較的よく使われる配分を採用。`src/bazi/hiddenStems.ts` で調整可能。
 */
import { STEMS, type Stem } from './ganzhi.ts';

export type HiddenRole = 'primary' | 'middle' | 'residual'; // 本気・中気・余気

export interface HiddenStem {
  stem: Stem;
  role: HiddenRole;
}

const S = (ja: string) => STEMS.find((s) => s.ja === ja)!;

// 支 index 0..11（子丑寅卯辰巳午未申酉戌亥）ごとの固定蔵干
export const HIDDEN_STEMS: HiddenStem[][] = [
  [{ stem: S('癸'), role: 'primary' }], // 子
  [{ stem: S('己'), role: 'primary' }, { stem: S('癸'), role: 'middle' }, { stem: S('辛'), role: 'residual' }], // 丑
  [{ stem: S('甲'), role: 'primary' }, { stem: S('丙'), role: 'middle' }, { stem: S('戊'), role: 'residual' }], // 寅
  [{ stem: S('乙'), role: 'primary' }], // 卯
  [{ stem: S('戊'), role: 'primary' }, { stem: S('乙'), role: 'middle' }, { stem: S('癸'), role: 'residual' }], // 辰
  [{ stem: S('丙'), role: 'primary' }, { stem: S('庚'), role: 'middle' }, { stem: S('戊'), role: 'residual' }], // 巳
  [{ stem: S('丁'), role: 'primary' }, { stem: S('己'), role: 'middle' }], // 午
  [{ stem: S('己'), role: 'primary' }, { stem: S('乙'), role: 'middle' }, { stem: S('丁'), role: 'residual' }], // 未
  [{ stem: S('庚'), role: 'primary' }, { stem: S('壬'), role: 'middle' }, { stem: S('戊'), role: 'residual' }], // 申
  [{ stem: S('辛'), role: 'primary' }], // 酉
  [{ stem: S('戊'), role: 'primary' }, { stem: S('辛'), role: 'middle' }, { stem: S('丁'), role: 'residual' }], // 戌
  [{ stem: S('壬'), role: 'primary' }, { stem: S('甲'), role: 'middle' }], // 亥
];

export function hiddenStemsOf(branchIndex: number): HiddenStem[] {
  return HIDDEN_STEMS[((branchIndex % 12) + 12) % 12];
}

// 月令：節入りからの経過日数 → 司令する天干（支 index → [{stem, days}...]）
const MONTH_COMMAND: Record<number, Array<{ ja: string; days: number }>> = {
  2: [{ ja: '戊', days: 7 }, { ja: '丙', days: 7 }, { ja: '甲', days: 16 }], // 寅
  3: [{ ja: '甲', days: 10 }, { ja: '乙', days: 20 }], // 卯
  4: [{ ja: '乙', days: 9 }, { ja: '癸', days: 3 }, { ja: '戊', days: 18 }], // 辰
  5: [{ ja: '戊', days: 5 }, { ja: '庚', days: 9 }, { ja: '丙', days: 16 }], // 巳
  6: [{ ja: '丙', days: 10 }, { ja: '己', days: 9 }, { ja: '丁', days: 11 }], // 午
  7: [{ ja: '丁', days: 9 }, { ja: '乙', days: 3 }, { ja: '己', days: 18 }], // 未
  8: [{ ja: '戊', days: 7 }, { ja: '壬', days: 7 }, { ja: '庚', days: 16 }], // 申
  9: [{ ja: '庚', days: 10 }, { ja: '辛', days: 20 }], // 酉
  10: [{ ja: '辛', days: 9 }, { ja: '丁', days: 3 }, { ja: '戊', days: 18 }], // 戌
  11: [{ ja: '戊', days: 7 }, { ja: '甲', days: 5 }, { ja: '壬', days: 18 }], // 亥
  0: [{ ja: '壬', days: 10 }, { ja: '癸', days: 20 }], // 子
  1: [{ ja: '癸', days: 9 }, { ja: '辛', days: 3 }, { ja: '己', days: 18 }], // 丑
};

/** 月支の司令蔵干（節入りからの経過日数で決定） */
export function monthCommandStem(monthBranchIndex: number, daysSinceTerm: number): Stem {
  const table = MONTH_COMMAND[((monthBranchIndex % 12) + 12) % 12];
  let acc = 0;
  for (const seg of table) {
    acc += seg.days;
    if (daysSinceTerm < acc) return S(seg.ja);
  }
  return S(table[table.length - 1].ja);
}
