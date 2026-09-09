/** アスペクト（天体間の角度関係）の検出 */
import { angularSeparation, deltaAngle } from './zodiac.ts';
import type { BodyPosition } from './ephemeris.ts';

export type AspectType =
  | 'conjunction'
  | 'opposition'
  | 'trine'
  | 'square'
  | 'sextile'
  | 'quincunx'
  | 'semisextile';

export interface AspectDef {
  type: AspectType;
  ja: string;
  angle: number;
  /** 標準オーブ（度） */
  orb: number;
  /** 調和/緊張/中立 */
  nature: 'harmonious' | 'tense' | 'neutral';
  glyph: string;
}

export const ASPECT_DEFS: AspectDef[] = [
  { type: 'conjunction', ja: 'コンジャンクション', angle: 0, orb: 8, nature: 'neutral', glyph: '☌' },
  { type: 'opposition', ja: 'オポジション', angle: 180, orb: 8, nature: 'tense', glyph: '☍' },
  { type: 'trine', ja: 'トライン', angle: 120, orb: 7, nature: 'harmonious', glyph: '△' },
  { type: 'square', ja: 'スクエア', angle: 90, orb: 7, nature: 'tense', glyph: '□' },
  { type: 'sextile', ja: 'セクスタイル', angle: 60, orb: 5, nature: 'harmonious', glyph: '⚹' },
  { type: 'quincunx', ja: 'インコンジャンクト', angle: 150, orb: 3, nature: 'tense', glyph: '⚻' },
  { type: 'semisextile', ja: 'セミセクスタイル', angle: 30, orb: 2, nature: 'neutral', glyph: '⚺' },
];

/** 光度体（太陽・月）が絡むときのオーブ加算 */
const LUMINARY_BONUS = 2;
const LUMINARIES = new Set(['sun', 'moon']);

export interface Aspect {
  a: string;
  b: string;
  type: AspectType;
  def: AspectDef;
  /** 実際の離角（度） */
  separation: number;
  /** 正確な角度からのズレ（度、絶対値） */
  orb: number;
  /** 接近中か離反中か（速度から判定） */
  applying: boolean;
  /** 0..1（1 = ぴったり） */
  strength: number;
}

export interface AspectOptions {
  /** 使用するアスペクト種別。省略時は主要 5 種＋クインカンクス */
  types?: AspectType[];
  /** マイナーアスペクト（セミセクスタイル等）も含めるか */
  includeMinor?: boolean;
  /** オーブ倍率 */
  orbFactor?: number;
}

export function detectAspects(positions: BodyPosition[], opts: AspectOptions = {}): Aspect[] {
  const defs = ASPECT_DEFS.filter((d) => {
    if (opts.types) return opts.types.includes(d.type);
    if (!opts.includeMinor && (d.type === 'semisextile' || d.type === 'quincunx')) return false;
    return true;
  });
  const orbFactor = opts.orbFactor ?? 1;
  const out: Aspect[] = [];

  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const p1 = positions[i];
      const p2 = positions[j];
      // ノード同士やヘッド-テイルの自明なオポジションは除外
      if (
        (p1.id === 'northNode' && p2.id === 'southNode') ||
        (p1.id === 'southNode' && p2.id === 'northNode')
      )
        continue;

      const sep = angularSeparation(p1.longitude, p2.longitude);
      const lumBonus = LUMINARIES.has(p1.id) || LUMINARIES.has(p2.id) ? LUMINARY_BONUS : 0;

      for (const def of defs) {
        const allowedOrb = (def.orb + lumBonus) * orbFactor;
        const orb = Math.abs(sep - def.angle);
        if (orb <= allowedOrb) {
          // 接近/離反：相対速度で判定
          const rel = deltaAngle(p1.longitude, p2.longitude); // p1→p2
          const relSpeed = p2.speed - p1.speed;
          const closing = rel * relSpeed < 0;
          out.push({
            a: p1.id,
            b: p2.id,
            type: def.type,
            def,
            separation: sep,
            orb,
            applying: closing,
            strength: 1 - orb / allowedOrb,
          });
          break; // 1 ペアにつき最も近い 1 アスペクト
        }
      }
    }
  }
  out.sort((x, y) => y.strength - x.strength);
  return out;
}
