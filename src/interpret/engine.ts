/**
 * カテゴリ別のネイタル解釈エンジン。
 * チャートから「そのカテゴリで意味を持つ配置」を選び、参照データと配置データを
 * 合成して読みやすいセクション群にする。
 *
 * トランジット（時期運）はフェーズ4で transitSections として加える。
 */
import type { Chart } from '../astro/chart.ts';
import type { BodyId } from '../astro/ephemeris.ts';
import { SIGNS, toSignPosition, type SignKey } from '../astro/zodiac.ts';
import { SIGN_TABLE, HOUSE_TABLE, PLANET_TABLE } from './reference.ts';
import { SUN_SIGN } from './natal/sun.ts';
import { MOON_SIGN } from './natal/moon.ts';
import { ASC_SIGN } from './natal/ascendant.ts';
import { VENUS_SIGN } from './natal/venus.ts';
import { MARS_SIGN } from './natal/mars.ts';
import { MERCURY_SIGN } from './natal/mercury.ts';
import { JUPITER_SIGN } from './natal/jupiter.ts';
import { SATURN_SIGN } from './natal/saturn.ts';
import type { SignTextMap } from './natal/types.ts';
import { ASPECT_TEXT, aspectKey } from './natal/aspects.ts';
import type { TransitReport, TransitAspect, HouseTransit } from '../astro/transits.ts';
import { isSlow } from '../astro/transits.ts';
import { TRANSIT_PLANET, TRANSIT_ASPECT_TEXT } from './transit/meanings.ts';

export type CategoryKey = 'overall' | 'money' | 'love' | 'health' | 'career' | 'social';

export interface NatalSection {
  title: string;
  body: string;
  tone: 'light' | 'tense' | 'neutral';
}

export interface CategoryAnalysis {
  key: CategoryKey;
  ja: string;
  intro: string;
  sections: NatalSection[];
  /** フェーズ4で埋まる時期運 */
  transitSections: NatalSection[] | null;
}

export const CATEGORY_META: Record<CategoryKey, { ja: string; intro: string }> = {
  overall: {
    ja: '総合運',
    intro: '太陽（人生の目的）・月（感情の土台）・アセンダント（生き方の姿勢）を軸に、生まれ持った性質の全体像を読みます。',
  },
  money: {
    ja: '金運',
    intro: '第2ハウス（稼ぐ力・所有）と第8ハウス（他者と分かち合う財）、金星・木星・土星の状態から、お金との付き合い方を読みます。',
  },
  love: {
    ja: '恋愛・結婚運',
    intro: '金星（愛し方）・火星（求め方）・月（求める安心）と、第5ハウス（恋愛）・第7ハウス（パートナー）から読みます。',
  },
  health: {
    ja: '健康運',
    intro: 'アセンダント／第1ハウス（体質）と第6ハウス（日々の管理）、火星（炎症・急性）・土星（慢性・構造）の負荷から読みます。',
  },
  career: {
    ja: '仕事・キャリア運',
    intro: 'MC／第10ハウス（社会的到達点）と第6ハウス（労働）、太陽（目的）・土星（責任と実績）から読みます。',
  },
  social: {
    ja: '対人関係運',
    intro: '水星（関わり方）と第3・7・11ハウス（身近な人／1対1／仲間）、月・金星から読みます。',
  },
};

const SIGN_MAP: Partial<Record<BodyId, SignTextMap>> = {
  sun: SUN_SIGN,
  moon: MOON_SIGN,
  mercury: MERCURY_SIGN,
  venus: VENUS_SIGN,
  mars: MARS_SIGN,
  jupiter: JUPITER_SIGN,
  saturn: SATURN_SIGN,
};

const SIGN_RULER: Record<SignKey, BodyId> = {
  aries: 'mars', taurus: 'venus', gemini: 'mercury', cancer: 'moon',
  leo: 'sun', virgo: 'mercury', libra: 'venus', scorpio: 'pluto',
  sagittarius: 'jupiter', capricorn: 'saturn', aquarius: 'uranus', pisces: 'neptune',
};

function signOf(lon: number): SignKey {
  return SIGNS[Math.floor((((lon % 360) + 360) % 360) / 30)].key;
}

// ---- セクション生成のパーツ ----

function luminarySection(chart: Chart, id: 'sun' | 'moon' | 'ascendant'): NatalSection | null {
  if (id === 'ascendant') {
    const sign = signOf(chart.houses.ascendant);
    const t = ASC_SIGN[sign];
    const sp = toSignPosition(chart.houses.ascendant);
    return { title: `アセンダント ${sp.label}｜${t.keyword}`, body: t.text, tone: 'neutral' };
  }
  const b = chart.bodies.find((x) => x.id === id);
  if (!b) return null;
  const map = id === 'sun' ? SUN_SIGN : MOON_SIGN;
  const t = map[b.sign.sign];
  const label = id === 'sun' ? '太陽' : '月';
  return { title: `${label} ${b.sign.label}・第${b.house}ハウス｜${t.keyword}`, body: t.text, tone: 'neutral' };
}

function planetSignSection(chart: Chart, id: BodyId): NatalSection | null {
  const map = SIGN_MAP[id];
  const b = chart.bodies.find((x) => x.id === id);
  if (!map || !b) return null;
  const t = map[b.sign.sign];
  const pj = PLANET_TABLE[id]?.ja ?? id;
  return {
    title: `${pj} ${b.sign.label}${b.retrograde ? '（逆行）' : ''}｜${t.keyword}`,
    body: t.text + (b.retrograde ? `　※逆行のため、${pj}の働きは外向きより内向きに、時間をかけて自分の中で育つ形になりやすいです。` : ''),
    tone: 'neutral',
  };
}

function planetHouseSection(chart: Chart, id: BodyId): NatalSection | null {
  const b = chart.bodies.find((x) => x.id === id);
  const p = PLANET_TABLE[id];
  const h = b ? HOUSE_TABLE[b.house] : undefined;
  if (!b || !p || !h) return null;
  return {
    title: `${p.ja}は第${b.house}ハウス（${h.short}）`,
    body: `${p.ja}が司る「${p.domain}」は、${h.theme}の場面で強く動きます。この分野が、あなたが力を注ぎ・経験を積む舞台になります。`,
    tone: 'neutral',
  };
}

function houseCuspSection(chart: Chart, n: number): NatalSection | null {
  const h = HOUSE_TABLE[n];
  if (!h) return null;
  const lon = chart.houses.cusps[n - 1];
  const sign = signOf(lon);
  const s = SIGN_TABLE[sign];
  const sp = toSignPosition(lon);
  return {
    title: `第${n}ハウス（${h.short}）｜${sp.label}`,
    body: `${h.theme}のテーマに、${s.core}のスタイルが表れます。${s.style}向き合う傾向があり、強みは「${s.light}」。注意したいのは「${s.shadow}」です。`,
    tone: 'neutral',
  };
}

function houseRulerSection(chart: Chart, n: number): NatalSection | null {
  const h = HOUSE_TABLE[n];
  if (!h) return null;
  const cuspLon = chart.houses.cusps[n - 1];
  const rulerId = SIGN_RULER[signOf(cuspLon)];
  const ruler = chart.bodies.find((x) => x.id === rulerId);
  if (!ruler) return null;
  const rh = HOUSE_TABLE[ruler.house];
  const rj = PLANET_TABLE[rulerId]?.ja ?? rulerId;
  return {
    title: `第${n}ハウスの支配星 ${rj} → ${ruler.sign.label}・第${ruler.house}ハウス`,
    body: `${h.short}の鍵を握る${rj}が第${ruler.house}ハウス（${rh?.short ?? ''}）にあります。「${h.short}」の運は、${rh?.theme ?? '別の分野'}と結びついて動く傾向があります。`,
    tone: 'neutral',
  };
}

function mcSection(chart: Chart): NatalSection {
  const sign = signOf(chart.houses.mc);
  const s = SIGN_TABLE[sign];
  const sp = toSignPosition(chart.houses.mc);
  return {
    title: `MC（社会的な到達点）｜${sp.label}`,
    body: `社会に出るときの看板が${s.ja}。${s.core}という形で世に出て、「${s.light}」が評価につながりやすいです。目標に向かうときは${s.style}進むのが自分に合っています。`,
    tone: 'neutral',
  };
}

function toneOfAspect(nature: 'harmonious' | 'tense' | 'neutral'): NatalSection['tone'] {
  return nature === 'harmonious' ? 'light' : nature === 'tense' ? 'tense' : 'neutral';
}

function aspectSections(chart: Chart, focus: string[], limit = 3): NatalSection[] {
  const set = new Set(focus);
  const picked = chart.aspects
    .filter((a) => set.has(a.a) || set.has(a.b))
    .slice(0, limit + 4);
  const out: NatalSection[] = [];
  for (const a of picked) {
    const key = aspectKey(a.a, a.b);
    const entry = ASPECT_TEXT[key];
    const na = nameOf(chart, a.a);
    const nb = nameOf(chart, a.b);
    let body: string;
    if (entry) {
      if (a.type === 'conjunction') body = entry.conjunction ?? `${entry.harmony}（ただし距離が近く、良い面と課題の面が混ざって出ます）`;
      else if (a.def.nature === 'harmonious') body = entry.harmony;
      else body = entry.tension;
    } else {
      const sa = PLANET_TABLE[a.a as BodyId]?.short ?? na;
      const sb = PLANET_TABLE[a.b as BodyId]?.short ?? nb;
      body =
        a.def.nature === 'harmonious'
          ? `あなたの中で、${sa}と、${sb}が自然に手を組んでいます。ふだんは意識しなくても両立でき、強みとして働きます。`
          : a.def.nature === 'tense'
            ? `あなたの中で、${sa}と、${sb}が引っぱり合っています。どちらか一方を抑え込むと不満が残るので、両方に居場所を与えて折り合いをつけることが課題になります。`
            : `あなたの中で、${sa}と、${sb}が分けがたく結びついています。強く出る一方で、切り離して考えにくい面もあります。`;
    }
    out.push({
      title: `${na} ${a.def.glyph} ${nb}（${a.def.ja}／オーブ${a.orb.toFixed(1)}°${a.applying ? '・接近' : ''}）`,
      body,
      tone: toneOfAspect(a.def.nature),
    });
    if (out.length >= limit) break;
  }
  return out;
}

function nameOf(chart: Chart, id: string): string {
  if (id === 'ascendant') return 'ASC';
  if (id === 'mc') return 'MC';
  return chart.bodies.find((b) => b.id === id)?.ja ?? PLANET_TABLE[id as BodyId]?.ja ?? id;
}

// ---- カテゴリ定義 ----

type Selector = (chart: Chart) => NatalSection | NatalSection[] | null;

const PLANS: Record<CategoryKey, Selector[]> = {
  overall: [
    (c) => luminarySection(c, 'sun'),
    (c) => luminarySection(c, 'moon'),
    (c) => luminarySection(c, 'ascendant'),
    (c) => planetHouseSection(c, 'sun'),
    (c) => aspectSections(c, ['sun', 'moon', 'ascendant'], 3),
  ],
  money: [
    (c) => houseCuspSection(c, 2),
    (c) => houseRulerSection(c, 2),
    (c) => planetSignSection(c, 'venus'),
    (c) => planetHouseSection(c, 'jupiter'),
    (c) => planetSignSection(c, 'jupiter'),
    (c) => houseCuspSection(c, 8),
    (c) => aspectSections(c, ['venus', 'jupiter', 'saturn'], 3),
  ],
  love: [
    (c) => planetSignSection(c, 'venus'),
    (c) => planetSignSection(c, 'mars'),
    (c) => luminarySection(c, 'moon'),
    (c) => houseCuspSection(c, 7),
    (c) => houseRulerSection(c, 7),
    (c) => houseCuspSection(c, 5),
    (c) => aspectSections(c, ['venus', 'mars', 'moon'], 4),
  ],
  health: [
    (c) => luminarySection(c, 'ascendant'),
    (c) => houseCuspSection(c, 6),
    (c) => houseRulerSection(c, 6),
    (c) => planetSignSection(c, 'mars'),
    (c) => planetSignSection(c, 'saturn'),
    (c) => planetHouseSection(c, 'saturn'),
    (c) => aspectSections(c, ['mars', 'saturn'], 3),
  ],
  career: [
    (c) => mcSection(c),
    (c) => houseCuspSection(c, 10),
    (c) => houseRulerSection(c, 10),
    (c) => planetHouseSection(c, 'sun'),
    (c) => planetSignSection(c, 'saturn'),
    (c) => houseCuspSection(c, 6),
    (c) => aspectSections(c, ['sun', 'saturn', 'mc'], 3),
  ],
  social: [
    (c) => planetSignSection(c, 'mercury'),
    (c) => planetHouseSection(c, 'mercury'),
    (c) => houseCuspSection(c, 7),
    (c) => houseCuspSection(c, 11),
    (c) => houseCuspSection(c, 3),
    (c) => luminarySection(c, 'moon'),
    (c) => aspectSections(c, ['mercury', 'venus', 'moon'], 3),
  ],
};

export function analyzeCategory(chart: Chart, key: CategoryKey, transit?: TransitReport | null): CategoryAnalysis {
  const meta = CATEGORY_META[key];
  const sections: NatalSection[] = [];
  const seen = new Set<string>();
  for (const sel of PLANS[key]) {
    const res = sel(chart);
    if (!res) continue;
    for (const s of Array.isArray(res) ? res : [res]) {
      if (seen.has(s.title)) continue;
      seen.add(s.title);
      sections.push(s);
    }
  }
  if (chart.birth.timeUnknown) {
    sections.unshift({
      title: '出生時刻が不明です',
      body: 'ハウス・アセンダント・MC は正午での暫定計算です。これらに基づく項目（第○ハウス、支配星、MC など）は参考程度に。太陽・惑星の星座と、月以外のアスペクトは時刻不明でもほぼ正確です。',
      tone: 'tense',
    });
  }
  const transitSections = transit ? transitSectionsFor(chart, transit, key) : null;
  return { key, ja: meta.ja, intro: meta.intro, sections, transitSections };
}

export const CATEGORY_KEYS: CategoryKey[] = ['overall', 'money', 'love', 'health', 'career', 'social'];

// ---- トランジット（時期運） ----

const TRANSIT_FOCUS: Record<CategoryKey, { natal: string[]; houses: number[] }> = {
  overall: { natal: ['sun', 'moon', 'ascendant'], houses: [1] },
  money: { natal: ['venus', 'jupiter'], houses: [2, 8] },
  love: { natal: ['venus', 'mars', 'moon'], houses: [5, 7] },
  health: { natal: ['ascendant', 'sun', 'mars', 'saturn'], houses: [1, 6] },
  career: { natal: ['sun', 'saturn', 'mc'], houses: [10, 6] },
  social: { natal: ['mercury', 'venus', 'moon'], houses: [3, 7, 11] },
};

function natureKeyOf(a: TransitAspect): 'harmony' | 'tension' | 'conjunction' {
  if (a.type === 'conjunction') return 'conjunction';
  return a.nature === 'harmonious' ? 'harmony' : 'tension';
}

function fmtMonth(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月ごろ`;
}

function transitAspectSection(a: TransitAspect): NatalSection {
  const nk = natureKeyOf(a);
  const meaning = TRANSIT_PLANET[a.transiting];
  let body = TRANSIT_ASPECT_TEXT[`${a.transiting}-${a.natal.id}-${nk}`];
  if (!body) {
    const domain = PLANET_TABLE[a.natal.id as BodyId]?.short ?? a.natal.ja;
    const verb = nk === 'harmony' ? '追い風として働いています。' : nk === 'tension' ? '負荷としてかかっています。' : '強く重なっています。';
    const drive = meaning ? (nk === 'harmony' ? meaning.harmony : nk === 'tension' ? meaning.tension : meaning.conjunction) : '';
    body = `いま、${meaning?.theme ?? a.transitingJa + 'の動き'}が、あなたの「${domain}」に${verb}${drive}`;
  }
  const phase = a.phase === 'exact' ? '（ちょうど正確）' : a.phase === 'applying' ? '（強まっています）' : '（弱まりつつあります）';
  const extra: string[] = [];
  if (a.exactDate) extra.push(`正確化: ${fmtMonth(a.exactDate)}`);
  if (meaning) extra.push(`影響の目安: ${meaning.duration}`);
  return {
    title: `トランジット${a.transitingJa} ${a.glyph} ネイタル${a.natal.ja}（${a.ja}${a.transitingRetro ? '・逆行中' : ''}）${phase}`,
    body: extra.length ? `${body}\n〔${extra.join(' ／ ')}〕` : body,
    tone: a.type === 'conjunction' ? 'neutral' : a.nature === 'harmonious' ? 'light' : 'tense',
  };
}

function transitHouseSection(ht: HouseTransit): NatalSection | null {
  const meaning = TRANSIT_PLANET[ht.transiting];
  const h = HOUSE_TABLE[ht.house];
  if (!meaning || !h) return null;
  let body = `${meaning.theme}が、${h.theme}の分野で長く働いています。${meaning.house}`;
  if (ht.ingress === 'entering' && ht.ingressHouse) {
    body += ` まもなく第${ht.ingressHouse}ハウス（${HOUSE_TABLE[ht.ingressHouse]?.short ?? ''}）へ移り、この分野のテーマは一区切りに近づいています。`;
  } else if (ht.ingress === 'justEntered') {
    body += ' この分野に入ったばかりで、これからテーマが本格化していきます。';
  }
  return {
    title: `トランジット${ht.transitingJa}が第${ht.house}ハウス（${h.short}）を通過中`,
    body,
    tone: ht.transiting === 'jupiter' ? 'light' : ht.transiting === 'saturn' || ht.transiting === 'pluto' ? 'tense' : 'neutral',
  };
}

function transitSectionsFor(chart: Chart, report: TransitReport, key: CategoryKey): NatalSection[] {
  const focus = TRANSIT_FOCUS[key];
  const natalSet = new Set(focus.natal);
  for (const hn of focus.houses) {
    natalSet.add(SIGN_RULER[signOf(chart.houses.cusps[hn - 1])]);
  }
  const out: NatalSection[] = [];

  for (const ht of report.houseTransits) {
    if (focus.houses.includes(ht.house)) {
      const s = transitHouseSection(ht);
      if (s) out.push(s);
    }
  }

  // 時期運は動きの遅い天体（木星〜冥王星）のアスペクトに絞る
  const relevant = report.aspects.filter((a) => a.slow && natalSet.has(a.natal.id));
  relevant.sort((a, b) => b.weight - a.weight);
  for (const a of relevant.slice(0, 5)) out.push(transitAspectSection(a));

  // 短期（太陽・火星）の強いアスペクトが1つでもあれば、補足として1件だけ添える
  const shortTerm = report.aspects
    .filter((a) => !a.slow && natalSet.has(a.natal.id) && a.orb < 1)
    .sort((a, b) => a.orb - b.orb)[0];
  if (shortTerm) out.push(transitAspectSection(shortTerm));

  if (out.length === 0) {
    out.push({
      title: 'いま、目立った動きはありません',
      body: 'この分野に強く関わる時期運（木星〜冥王星）のアスペクトは、基準日の前後で見当たりません。大きな変化より、これまでの流れを整える時期です。',
      tone: 'neutral',
    });
  }
  return out;
}

/** カテゴリに関係なく、いま全体で効いている時期運の概況（上位） */
export function analyzeTransitOverview(report: TransitReport): NatalSection[] {
  const out: NatalSection[] = [];
  // 遅い天体のハウス位置サマリー
  const slowHouses = report.houseTransits.filter((h) => isSlow(h.transiting));
  if (slowHouses.length) {
    out.push({
      title: 'いま、動きの遅い天体が滞在している分野',
      body: slowHouses
        .map((h) => `${h.transitingJa} → 第${h.house}ハウス（${HOUSE_TABLE[h.house]?.short ?? ''}）${h.ingress === 'entering' ? '［まもなく次の分野へ］' : h.ingress === 'justEntered' ? '［入ったばかり］' : ''}`)
        .join('\n'),
      tone: 'neutral',
    });
  }
  // 効いている遅いアスペクト上位 3
  const slowAspects = report.aspects.filter((a) => a.slow).slice(0, 3);
  for (const a of slowAspects) out.push(transitAspectSection(a));
  if (out.length <= 1) {
    out.push({
      title: '大きな節目は近くにありません',
      body: '木星〜冥王星の強いアスペクトは、基準日の前後で見当たりません。比較的おだやかで、自分のペースで動きやすい時期です。',
      tone: 'light',
    });
  }
  return out;
}
