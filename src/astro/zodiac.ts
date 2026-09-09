/** 12 星座・天体の基本メタデータと角度ユーティリティ */

export const SIGNS = [
  { key: 'aries', ja: 'おひつじ座', en: 'Aries', glyph: '♈', element: '火', quality: '活動' },
  { key: 'taurus', ja: 'おうし座', en: 'Taurus', glyph: '♉', element: '地', quality: '不動' },
  { key: 'gemini', ja: 'ふたご座', en: 'Gemini', glyph: '♊', element: '風', quality: '柔軟' },
  { key: 'cancer', ja: 'かに座', en: 'Cancer', glyph: '♋', element: '水', quality: '活動' },
  { key: 'leo', ja: 'しし座', en: 'Leo', glyph: '♌', element: '火', quality: '不動' },
  { key: 'virgo', ja: 'おとめ座', en: 'Virgo', glyph: '♍', element: '地', quality: '柔軟' },
  { key: 'libra', ja: 'てんびん座', en: 'Libra', glyph: '♎', element: '風', quality: '活動' },
  { key: 'scorpio', ja: 'さそり座', en: 'Scorpio', glyph: '♏', element: '水', quality: '不動' },
  { key: 'sagittarius', ja: 'いて座', en: 'Sagittarius', glyph: '♐', element: '火', quality: '柔軟' },
  { key: 'capricorn', ja: 'やぎ座', en: 'Capricorn', glyph: '♑', element: '地', quality: '活動' },
  { key: 'aquarius', ja: 'みずがめ座', en: 'Aquarius', glyph: '♒', element: '風', quality: '不動' },
  { key: 'pisces', ja: 'うお座', en: 'Pisces', glyph: '♓', element: '水', quality: '柔軟' },
] as const;

export type SignKey = (typeof SIGNS)[number]['key'];

export interface BodyMeta {
  key: string;
  ja: string;
  en: string;
  glyph: string;
  /** ホロスコープ描画やアスペクト計算での重み付け（光度体を大きく） */
  weight: number;
}

export const BODIES: Record<string, BodyMeta> = {
  sun: { key: 'sun', ja: '太陽', en: 'Sun', glyph: '☉', weight: 3 },
  moon: { key: 'moon', ja: '月', en: 'Moon', glyph: '☽', weight: 3 },
  mercury: { key: 'mercury', ja: '水星', en: 'Mercury', glyph: '☿', weight: 2 },
  venus: { key: 'venus', ja: '金星', en: 'Venus', glyph: '♀', weight: 2 },
  mars: { key: 'mars', ja: '火星', en: 'Mars', glyph: '♂', weight: 2 },
  jupiter: { key: 'jupiter', ja: '木星', en: 'Jupiter', glyph: '♃', weight: 2 },
  saturn: { key: 'saturn', ja: '土星', en: 'Saturn', glyph: '♄', weight: 2 },
  uranus: { key: 'uranus', ja: '天王星', en: 'Uranus', glyph: '♅', weight: 1 },
  neptune: { key: 'neptune', ja: '海王星', en: 'Neptune', glyph: '♆', weight: 1 },
  pluto: { key: 'pluto', ja: '冥王星', en: 'Pluto', glyph: '♇', weight: 1 },
  northNode: { key: 'northNode', ja: 'ドラゴンヘッド', en: 'North Node', glyph: '☊', weight: 1 },
  southNode: { key: 'southNode', ja: 'ドラゴンテイル', en: 'South Node', glyph: '☋', weight: 0 },
  chiron: { key: 'chiron', ja: 'キロン', en: 'Chiron', glyph: '⚷', weight: 1 },
  ascendant: { key: 'ascendant', ja: 'アセンダント', en: 'Ascendant', glyph: 'ASC', weight: 3 },
  mc: { key: 'mc', ja: 'MC（天頂）', en: 'Midheaven', glyph: 'MC', weight: 3 },
};

export const TAU = 360;

export function norm360(deg: number): number {
  return ((deg % TAU) + TAU) % TAU;
}

/** 2 点間の角度差（-180..180、a→b が反時計回り＝黄道順で正） */
export function deltaAngle(a: number, b: number): number {
  let d = norm360(b - a);
  if (d > 180) d -= 360;
  return d;
}

/** 2 点間の最小角距離（0..180） */
export function angularSeparation(a: number, b: number): number {
  return Math.abs(deltaAngle(a, b));
}

export interface SignPosition {
  sign: SignKey;
  signJa: string;
  signGlyph: string;
  /** 星座内の度数（0..30） */
  degreeInSign: number;
  /** "牡羊 12°34′" 形式 */
  label: string;
}

export function toSignPosition(longitude: number): SignPosition {
  const lon = norm360(longitude);
  const index = Math.floor(lon / 30) % 12;
  const degreeInSign = lon - index * 30;
  const s = SIGNS[index];
  const deg = Math.floor(degreeInSign);
  const min = Math.floor((degreeInSign - deg) * 60);
  return {
    sign: s.key,
    signJa: s.ja,
    signGlyph: s.glyph,
    degreeInSign,
    label: `${s.ja} ${deg}°${String(min).padStart(2, '0')}′`,
  };
}

export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;
