/**
 * 空亡（天中殺 / 旬空）。日柱の干支から所属する「旬」を求め、その旬に含まれない 2 支。
 */
import { BRANCHES, ganZhi, type Branch } from './ganzhi.ts';

export interface VoidBranches {
  /** 旬の名前（例：甲子旬） */
  xunName: string;
  branches: [Branch, Branch];
}

export function voidBranchesOf(dayGanZhiIndex: number): VoidBranches {
  const idx = ((dayGanZhiIndex % 60) + 60) % 60;
  const xunStart = Math.floor(idx / 10) * 10; // 旬の先頭（甲=stem0）
  const startBranch = xunStart % 12;
  const b1 = BRANCHES[(startBranch + 10) % 12];
  const b2 = BRANCHES[(startBranch + 11) % 12];
  return {
    xunName: `${ganZhi(xunStart).ja}旬`,
    branches: [b1, b2],
  };
}
