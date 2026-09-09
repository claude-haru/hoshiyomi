import type { SignKey } from '../../astro/zodiac.ts';

export interface SignText {
  /** 見出しに使う短いキーワード */
  keyword: string;
  /** 本文（2〜4文程度） */
  text: string;
}

export type SignTextMap = Record<SignKey, SignText>;
