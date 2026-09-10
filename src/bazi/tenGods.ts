/**
 * 十神（通変星）：日干（日主）から見た、ある天干の関係。
 *   同五行  同陰陽 → 比肩 / 異陰陽 → 劫財
 *   日主が生じる  同 → 食神 / 異 → 傷官
 *   日主が剋す    同 → 偏財 / 異 → 正財
 *   日主を剋す    同 → 偏官(七殺) / 異 → 正官
 *   日主を生じる  同 → 偏印 / 異 → 印綬
 */
import { elementIndex, type Stem } from './ganzhi.ts';

export type TenGod =
  | 'bijian' | 'jiecai'
  | 'shishen' | 'shangguan'
  | 'piancai' | 'zhengcai'
  | 'pianguan' | 'zhengguan'
  | 'pianyin' | 'zhengyin';

export const TEN_GOD_JA: Record<TenGod, string> = {
  bijian: '比肩', jiecai: '劫財',
  shishen: '食神', shangguan: '傷官',
  piancai: '偏財', zhengcai: '正財',
  pianguan: '偏官', zhengguan: '正官',
  pianyin: '偏印', zhengyin: '印綬',
};

/** 十神の大分類 */
export type TenGodGroup = 'peer' | 'output' | 'wealth' | 'officer' | 'resource';
export const TEN_GOD_GROUP: Record<TenGod, TenGodGroup> = {
  bijian: 'peer', jiecai: 'peer',
  shishen: 'output', shangguan: 'output',
  piancai: 'wealth', zhengcai: 'wealth',
  pianguan: 'officer', zhengguan: 'officer',
  pianyin: 'resource', zhengyin: 'resource',
};
export const TEN_GOD_GROUP_JA: Record<TenGodGroup, string> = {
  peer: '比劫（自我）', output: '食傷（表現）', wealth: '財（財・現実）',
  officer: '官殺（規律・責任）', resource: '印（学び・支え）',
};

export function tenGod(dayMaster: Stem, target: Stem): TenGod {
  const d = elementIndex(dayMaster.element);
  const x = elementIndex(target.element);
  const same = dayMaster.yin === target.yin;
  const rel = ((x - d) % 5 + 5) % 5;
  switch (rel) {
    case 0: return same ? 'bijian' : 'jiecai';
    case 1: return same ? 'shishen' : 'shangguan'; // 日主が生じる
    case 2: return same ? 'piancai' : 'zhengcai'; // 日主が剋す
    case 3: return same ? 'pianguan' : 'zhengguan'; // 日主を剋す
    default: return same ? 'pianyin' : 'zhengyin'; // 日主を生じる
  }
}

/** 日主を強める十神か（比劫・印）／弱める十神か（食傷・財・官殺） */
export function strengthensDayMaster(g: TenGod): boolean {
  const grp = TEN_GOD_GROUP[g];
  return grp === 'peer' || grp === 'resource';
}
