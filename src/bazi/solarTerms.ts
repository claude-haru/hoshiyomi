/**
 * 二十四節気の計算（太陽の視黄経が 15°の倍数になる瞬間）。
 * 四柱推命では 12 の「節」（中気ではない方）が月柱の境界になる。
 * astronomy-engine の SearchSunLongitude を使う。公表値と ~1 分で一致。
 */
import * as Astronomy from 'astronomy-engine';

/** 節（月柱の境界）。lon は太陽視黄経、branch は始まる月の地支 index */
export interface MajorTermDef {
  ja: string;
  lon: number;
  /** この節から始まる月の地支 index（寅=2 から） */
  branch: number;
  /** 概算の暦日（0-indexed month, day）。探索の起点用 */
  approxMonth: number;
  approxDay: number;
}

// 節は太陽黄経 315°(立春) から 30°おき。順に 寅→卯→…→丑。
export const MAJOR_TERMS: MajorTermDef[] = [
  { ja: '小寒', lon: 285, branch: 1, approxMonth: 0, approxDay: 6 }, // 丑月
  { ja: '立春', lon: 315, branch: 2, approxMonth: 1, approxDay: 4 }, // 寅月
  { ja: '啓蟄', lon: 345, branch: 3, approxMonth: 2, approxDay: 6 }, // 卯月
  { ja: '清明', lon: 15, branch: 4, approxMonth: 3, approxDay: 5 }, // 辰月
  { ja: '立夏', lon: 45, branch: 5, approxMonth: 4, approxDay: 6 }, // 巳月
  { ja: '芒種', lon: 75, branch: 6, approxMonth: 5, approxDay: 6 }, // 午月
  { ja: '小暑', lon: 105, branch: 7, approxMonth: 6, approxDay: 7 }, // 未月
  { ja: '立秋', lon: 135, branch: 8, approxMonth: 7, approxDay: 8 }, // 申月
  { ja: '白露', lon: 165, branch: 9, approxMonth: 8, approxDay: 8 }, // 酉月
  { ja: '寒露', lon: 195, branch: 10, approxMonth: 9, approxDay: 8 }, // 戌月
  { ja: '立冬', lon: 225, branch: 11, approxMonth: 10, approxDay: 7 }, // 亥月
  { ja: '大雪', lon: 255, branch: 0, approxMonth: 11, approxDay: 7 }, // 子月
];

export interface SolarTermInstant {
  def: MajorTermDef;
  date: Date;
}

const cache = new Map<string, Date>();

/**
 * 指定黄経の太陽到達時刻を、指定日以降の狭い窓で探す。
 * astronomy-engine の SearchSunLongitude は窓が広すぎると null を返すため、
 * 8 日前から 24 日窓で 1 回のイベントだけを狙う。
 */
export function searchSunLongitude(targetLon: number, after: Date, limitDays = 24): Date {
  const key = `${targetLon}:${Math.floor(after.getTime() / 86400000)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const t = Astronomy.SearchSunLongitude(targetLon, new Astronomy.AstroTime(after), limitDays);
  if (!t) throw new Error(`SearchSunLongitude failed for ${targetLon} from ${after.toISOString()}`);
  cache.set(key, t.date);
  return t.date;
}

/** 指定グレゴリオ年の、指定した節の瞬間 */
export function termInstant(def: MajorTermDef, gregorianYear: number): Date {
  const start = new Date(Date.UTC(gregorianYear, def.approxMonth, def.approxDay - 8));
  return searchSunLongitude(def.lon, start, 24);
}

/** 指定した瞬間の「直前の節」と「直後の節」 */
export function bracketingTerms(instant: Date): { prev: SolarTermInstant; next: SolarTermInstant } {
  const year = instant.getUTCFullYear();
  const list: SolarTermInstant[] = [];
  for (let y = year - 1; y <= year + 1; y++) {
    for (const def of MAJOR_TERMS) {
      list.push({ def, date: termInstant(def, y) });
    }
  }
  list.sort((a, b) => a.date.getTime() - b.date.getTime());
  for (let i = 0; i < list.length - 1; i++) {
    if (list[i].date.getTime() <= instant.getTime() && instant.getTime() < list[i + 1].date.getTime()) {
      return { prev: list[i], next: list[i + 1] };
    }
  }
  throw new Error('bracketingTerms: 節が見つかりません');
}

/** 立春（太陽黄経 315°）の瞬間。指定グレゴリオ年の 2 月ごろ */
export function lichun(gregorianYear: number): Date {
  return termInstant(MAJOR_TERMS[1], gregorianYear);
}
