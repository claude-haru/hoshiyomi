/**
 * 四柱推命のカテゴリ別解釈エンジン。
 * 命式（日主・強弱・十神・五行・空亡・大運・流年）から、
 * 占星術と同じ 6 カテゴリの読みを NatalSection の並びとして組み立てる。
 *
 * ※ 解釈の重みづけ・格局判定などは流派差が大きい。ここでは
 *   「日主を中心に、命式に強く出ている十神と五行の偏りを読む」基本方針の簡易版。
 */
import type { BaziChart } from '../../bazi/chart.ts';
import { WU_XING_JA, type WuXing } from '../../bazi/ganzhi.ts';
import {
  TEN_GOD_JA,
  TEN_GOD_GROUP,
  TEN_GOD_GROUP_JA,
  tenGod,
  type TenGod,
  type TenGodGroup,
} from '../../bazi/tenGods.ts';
import { TWELVE_STAGE_JA, type TwelveStage } from '../../bazi/twelveStages.ts';
import { hiddenStemsOf } from '../../bazi/hiddenStems.ts';
import { activeLuckPeriod, annualPillar } from '../../bazi/luckPeriods.ts';
import { CATEGORY_META, type CategoryKey, type NatalSection } from '../engine.ts';
import { TEN_GOD_MEANING } from '../../bazi/glossary.ts';
import { DAY_MASTER_TEXT } from './dayMaster.ts';
import { TEN_GOD_LIFE } from './tenGodInLife.ts';
import { ELEMENT_TEXT } from './elements.ts';

export interface BaziCategoryAnalysis {
  key: CategoryKey;
  ja: string;
  intro: string;
  sections: NatalSection[];
  timing: NatalSection[] | null;
}

const CATEGORY_INTRO: Record<CategoryKey, string> = {
  overall: '日主（あなた自身）とその強弱、命式に強く出ている十神・五行から、生まれ持った傾向の全体像を読みます。',
  money: '財星（偏財・正財）の有無と扱える力（日主の強弱）、財を生む食傷、財を奪う比劫から、お金との付き合い方を読みます。',
  love: '配偶者星（男性は財星・女性は官星）と、日支（配偶者の座）の十神・十二運・空亡から、恋愛と結婚の傾向を読みます。',
  health: '五行の偏り（多すぎ・欠け）と、それが対応する体の部位、日主の強弱、ストレス系の十神から、体質と注意点を読みます。',
  career: '月柱の十神（社会での役割）と、命式に強い十神グループ、日主の強弱から、向いている働き方を読みます。',
  social: '比劫（対等な関係）の量、食傷や官殺、年柱の十神から、人との関わり方を読みます。',
};

// ---- 命式から十神を集計 ----

interface GodTally {
  god: TenGod;
  weight: number;
}

/** 日主以外の 天干3 ＋ 各地支の本気蔵干 を集計 */
function tallyTenGods(chart: BaziChart): { gods: GodTally[]; groups: { group: TenGodGroup; weight: number }[] } {
  const dm = chart.dayMaster;
  const acc = new Map<TenGod, number>();
  const add = (g: TenGod, w: number) => acc.set(g, (acc.get(g) ?? 0) + w);

  for (const d of chart.details) {
    const isMonth = d.kind === 'month';
    if (d.kind !== 'day') add(tenGod(dm, d.ganZhi.stem), isMonth ? 1.4 : 1);
    const primary = hiddenStemsOf(d.branch.index)[0].stem;
    add(tenGod(dm, primary), isMonth ? 1.2 : 0.8);
  }

  const gods = [...acc.entries()].map(([god, weight]) => ({ god, weight })).sort((a, b) => b.weight - a.weight);
  const gacc = new Map<TenGodGroup, number>();
  for (const { god, weight } of gods) {
    gacc.set(TEN_GOD_GROUP[god], (gacc.get(TEN_GOD_GROUP[god]) ?? 0) + weight);
  }
  const groups = [...gacc.entries()].map(([group, weight]) => ({ group, weight })).sort((a, b) => b.weight - a.weight);
  return { gods, groups };
}

function isStrong(chart: BaziChart): boolean {
  return chart.wuxing.strength === 'strong' || chart.wuxing.strength === 'very-strong';
}
function isWeak(chart: BaziChart): boolean {
  return chart.wuxing.strength === 'weak' || chart.wuxing.strength === 'very-weak';
}

function strengthApproach(chart: BaziChart): string {
  if (isStrong(chart)) {
    return '日主が強め。自分の意志と体力で押していくタイプで、人に頼ったり周囲に合わせたりは苦手。お金や地位は「自分から取りに行く」ほど手に入りやすく、エネルギーを使い切れる場（仕事・打ち込める趣味・体を動かすこと）があると安定します。独断・頑固・力の余りに注意。';
  }
  if (isWeak(chart)) {
    return '日主が弱め。周囲・環境・タイミングの影響を受けやすく、良い協力者・組織・後ろ盾があってこそ力を発揮します。一人で無理に頑張ると消耗し、体調にも出やすいタイプ。学び・仲間・休養（＝日主を助けるもの）を意識的に取り入れることが開運につながります。';
  }
  return '極端がなく、調整役やバランサーに向くタイプ。その時々の大運（10年の運気）で強め・弱めに傾くので、時期に応じて「押す／控える」を切り替えると流れに乗れます。';
}

// ---- セクション部品 ----

function section(title: string, body: string, tone: NatalSection['tone'] = 'neutral'): NatalSection {
  return { title, body, tone };
}

function dayMasterSection(chart: BaziChart): NatalSection {
  const dm = chart.dayMaster;
  const t = DAY_MASTER_TEXT[dm.ja];
  return section(
    `日主 ${dm.ja}（${WU_XING_JA[dm.element]}・${dm.yin === 'yang' ? '陽' : '陰'}）｜${t.image}`,
    t.text,
  );
}

function strengthSection(chart: BaziChart): NatalSection {
  const label = { 'very-strong': '極身強', strong: '身強', balanced: '中和', weak: '身弱', 'very-weak': '極身弱' }[chart.wuxing.strength];
  return section(`日主の強弱：${label}`, strengthApproach(chart), isWeak(chart) ? 'tense' : 'neutral');
}

function dominantGodSection(chart: BaziChart, category: CategoryKey): NatalSection | null {
  const { groups } = tallyTenGods(chart);
  if (!groups.length) return null;
  const top = groups[0];
  const groupGods: Record<TenGodGroup, TenGod[]> = {
    peer: ['bijian', 'jiecai'], output: ['shishen', 'shangguan'], wealth: ['piancai', 'zhengcai'],
    officer: ['pianguan', 'zhengguan'], resource: ['pianyin', 'zhengyin'],
  };
  const { gods } = tallyTenGods(chart);
  const leadGod = gods.find((g) => groupGods[top.group].includes(g.god))?.god ?? groupGods[top.group][0];
  const life = TEN_GOD_LIFE[leadGod];
  const facet = life.facets[category];
  return section(
    `命式で強い十神：${TEN_GOD_GROUP_JA[top.group]}（中心は ${TEN_GOD_JA[leadGod]}）`,
    `${life.general}${facet ? ' ' + facet : ''}`,
    tenGodTone(leadGod),
  );
}

function elementExtremesSection(chart: BaziChart, forHealth: boolean): NatalSection | null {
  const scores = chart.wuxing.scores;
  const strong = scores.find((s) => s.ratio >= 0.38);
  const missing = chart.wuxing.missing;
  const parts: string[] = [];
  if (strong) {
    const e = ELEMENT_TEXT[strong.element];
    parts.push(
      forHealth
        ? `${WU_XING_JA[strong.element]}が多め（${Math.round(strong.ratio * 100)}%）。対応するのは ${e.body}。${e.excess}`
        : `${WU_XING_JA[strong.element]}の気が強く出ています（持ち味：${e.trait}）。`,
    );
  }
  for (const m of missing) {
    const e = ELEMENT_TEXT[m as WuXing];
    parts.push(
      forHealth
        ? `${WU_XING_JA[m]}が命式にありません。対応するのは ${e.body}。${e.lack}`
        : `${WU_XING_JA[m]}が命式になく、その持ち味（${e.trait}）は意識して補うテーマ。`,
    );
  }
  if (!parts.length) return null;
  return section(forHealth ? '五行の偏りと体' : '五行の偏り', parts.join('\n'), missing.length ? 'tense' : 'neutral');
}

function wealthSection(chart: BaziChart): NatalSection {
  const { gods } = tallyTenGods(chart);
  const wealth = gods.filter((g) => g.god === 'piancai' || g.god === 'zhengcai').reduce((s, g) => s + g.weight, 0);
  const output = gods.filter((g) => g.god === 'shishen' || g.god === 'shangguan').reduce((s, g) => s + g.weight, 0);
  const peer = gods.filter((g) => g.god === 'bijian' || g.god === 'jiecai').reduce((s, g) => s + g.weight, 0);

  const lines: string[] = [];
  if (wealth >= 1.5) {
    lines.push('財星（お金の星）が命式にしっかりあり、お金や物質への関心・感覚が備わっています。');
    lines.push(
      isStrong(chart)
        ? '日主が強めなので「財を扱う力」があり、自分から動いて稼ぐほど手元に残りやすいタイプ。'
        : isWeak(chart)
          ? '日主が弱めなので、稼いでも管理や維持で消耗しやすい面が。仲間・仕組み・専門家の力を借り、守りを固めると安定します。'
          : '扱える範囲でのお金の動きが向いています。背伸びした投資より、地道な積み上げを。',
    );
  } else if (wealth > 0) {
    lines.push('財星は控えめ。お金そのものより「やりたいこと・好きなこと」が動機になりやすく、財は結果としてついてくる形。');
  } else {
    lines.push('命式に財星がありません。お金への執着は薄く、稼ぎは食傷（表現・技術）や人の縁を通じて間接的に入る傾向。金額より「何に使うか」を大事にするタイプ。');
  }
  if (output >= 1) lines.push('食傷（表現・技術・サービス）の気があり、「稼ぐ源泉」を自分の中に持っています。');
  if (peer >= 2) lines.push('比劫（対等な存在の気）が強く、分け合い・競争・立て替えでお金が目減りしやすい面も。共同出資や保証は慎重に。');
  return section('お金との関係（財星）', lines.join('\n'), isWeak(chart) && wealth >= 1.5 ? 'tense' : 'neutral');
}

function spouseSection(chart: BaziChart): NatalSection {
  const dm = chart.dayMaster;
  const gender = chart.birth.gender;
  const dayBranch = chart.details[2].branch;
  const dayBranchGod = tenGod(dm, hiddenStemsOf(dayBranch.index)[0].stem);
  const dayStage = chart.details[2].twelveStage;
  const dayVoid = chart.details[2].isVoid;

  const lines: string[] = [];
  lines.push(
    `日支（配偶者の座）は ${dayBranch.ja}、示す十神は「${TEN_GOD_JA[dayBranchGod]}」。` +
      `パートナー関係では次のような面が出やすい傾向です — ${TEN_GOD_MEANING[dayBranchGod]}`,
  );
  lines.push(`日支の十二運は「${TWELVE_STAGE_JA[dayStage]}」＝${stageBrief(dayStage)}。家庭・パートナー関係の「勢い」の出方の目安です。`);

  if (gender) {
    const spouseGods: TenGod[] = gender === 'male' ? ['piancai', 'zhengcai'] : ['pianguan', 'zhengguan'];
    const { gods } = tallyTenGods(chart);
    const w = gods.filter((g) => spouseGods.includes(g.god)).reduce((s, g) => s + g.weight, 0);
    const starJa = gender === 'male' ? '財星（妻の星）' : '官星（夫の星）';
    if (w >= 1.5) lines.push(`${starJa}が命式にはっきりあり、伴侶の存在感が大きい人生。恋愛・結婚のテーマが人生で重めに出ます。`);
    else if (w > 0) lines.push(`${starJa}は控えめ。パートナーは「必要なときに現れる」形で、一人の時間も大切にできるタイプ。`);
    else lines.push(`${starJa}が命式になく、結婚という形にはこだわりが薄いか、縁は大運（時期）で巡ってくるタイプ。日支の状態がより重要になります。`);

    const bothOfficer = gender === 'female' && gods.some((g) => g.god === 'pianguan') && gods.some((g) => g.god === 'zhengguan');
    const bothWealth = gender === 'male' && gods.some((g) => g.god === 'piancai') && gods.some((g) => g.god === 'zhengcai');
    if (bothOfficer || bothWealth) lines.push('同じ系統の星が複数あり、異性関係が複雑になりやすい配置。相手選びは焦らず、ひとりに絞る意識を。');
  } else {
    lines.push('※ 性別を選ぶと、配偶者星（男性は財星・女性は官星）を含めたより詳しい読みになります。');
  }

  if (dayVoid) lines.push('日支が空亡にあたっています。パートナー関係で「距離感が掴みにくい」「縁が遅れる・結び直しが起きやすい」テーマを抱えやすい配置。焦らず時間をかけて。');

  return section('恋愛・結婚の傾向', lines.join('\n'), dayVoid ? 'tense' : 'neutral');
}

const STAGE_BRIEF: Record<TwelveStage, string> = {
  changsheng: '素直な成長期', muyu: '不安定・迷い', guandai: '自立と体裁', linguan: '地道な一人前',
  diwang: '勢い最大', shuai: '落ち着き・保守', bing: '繊細・思いやり', si: '冷静・こだわり',
  mu: 'ため込む・管理', jue: '切り替え・再生', tai: 'これからの芽', yang: '人に恵まれる',
};
function stageBrief(stage: TwelveStage): string {
  return STAGE_BRIEF[stage];
}

function healthSection(chart: BaziChart): NatalSection {
  const { gods } = tallyTenGods(chart);
  const shangguan = gods.filter((g) => g.god === 'shangguan').reduce((s, g) => s + g.weight, 0);
  const qisha = gods.filter((g) => g.god === 'pianguan').reduce((s, g) => s + g.weight, 0);
  const lines: string[] = [];
  if (chart.wuxing.strength === 'very-weak') lines.push('日主が極端に弱く、もともと体力・回復力に余裕が少ないタイプ。睡眠・休養を最優先に、無理を「してから休む」ではなく「する前に配分する」意識を。');
  if (chart.wuxing.strength === 'very-strong') lines.push('日主が極端に強く、エネルギーが余りやすいタイプ。発散の場（運動・打ち込む活動）がないと、内圧が体調（血圧・炎症・頭部）に向かいがち。');
  if (shangguan >= 1.2) lines.push('傷官の気が強く、神経が細やか。ストレス・不眠・呼吸器や、考えすぎからくる不調に注意。');
  if (qisha >= 1.2) lines.push('偏官（七殺）の気が強く、頑張りすぎ・プレッシャーのため込みから、過労や急な不調・怪我につながりやすい配置。');
  if (!lines.length) lines.push('十神のうえでは、体調を大きく脅かす偏りは目立ちません。五行の偏りのほうを目安にしてください。');
  return section('体質とストレス', lines.join('\n'), lines.some((l) => l.includes('注意') || l.includes('弱')) ? 'tense' : 'neutral');
}

function careerSection(chart: BaziChart): NatalSection {
  const dm = chart.dayMaster;
  const monthStemGod = tenGod(dm, chart.details[1].ganZhi.stem);
  const { groups } = tallyTenGods(chart);
  const top = groups[0]?.group;
  const styleByGroup: Record<TenGodGroup, string> = {
    officer: '組織・規律の中で評価されるタイプ。公務・大企業・管理職・士業、責任ある立場で力を発揮します。',
    resource: '専門知識・資格・学びを軸にするタイプ。教育・研究・専門職、後ろ盾のある環境が合います。',
    output: '自分の表現・技術・サービスで立つタイプ。クリエイティブ・技術職・接客・自由業向き。組織の細かいルールとは摩擦が出やすい。',
    wealth: '人・お金・モノを動かすタイプ。営業・商売・投資・企画など、成果とお金が直結する仕事向き。',
    peer: '独立・現場・仲間との協働で力を出すタイプ。指示待ちより、自分の裁量がある働き方を。',
  };
  const lines: string[] = [];
  lines.push(`月柱の天干が示す社会での役割は「${TEN_GOD_JA[monthStemGod]}」。${TEN_GOD_LIFE[monthStemGod].facets.career ?? TEN_GOD_LIFE[monthStemGod].general}`);
  if (top) lines.push(styleByGroup[top]);
  lines.push(
    isStrong(chart)
      ? '日主が強めなので、独立・裁量の大きい立場ほど活きます。'
      : isWeak(chart)
        ? '日主が弱めなので、良いチーム・上司・仕組みのある組織でこそ実力が出ます。単独での起業は時期（大運）を選んで。'
        : '独立と組織、どちらも大運しだい。中年以降に立場が定まる傾向。',
  );
  lines.push(`月支の十二運は「${TWELVE_STAGE_JA[chart.details[1].twelveStage]}」＝${stageBrief(chart.details[1].twelveStage)}。仕事運の「出方」の目安です。`);
  return section('向いている働き方', lines.join('\n'));
}

function socialSection(chart: BaziChart): NatalSection {
  const { gods } = tallyTenGods(chart);
  const peer = gods.filter((g) => g.god === 'bijian' || g.god === 'jiecai').reduce((s, g) => s + g.weight, 0);
  const shishen = gods.filter((g) => g.god === 'shishen').reduce((s, g) => s + g.weight, 0);
  const shangguan = gods.filter((g) => g.god === 'shangguan').reduce((s, g) => s + g.weight, 0);
  const officer = gods.filter((g) => g.god === 'pianguan' || g.god === 'zhengguan').reduce((s, g) => s + g.weight, 0);
  const resource = gods.filter((g) => g.god === 'pianyin' || g.god === 'zhengyin').reduce((s, g) => s + g.weight, 0);
  const yearGod = tenGod(chart.dayMaster, chart.details[0].ganZhi.stem);

  const lines: string[] = [];
  if (peer >= 2) lines.push('比劫（対等な存在の気）が強く、仲間・ライバル・同志との「横のつながり」の中で生きるタイプ。群れるより、刺激し合える関係を好みます。主導権を巡って張り合わないよう注意。');
  else if (peer < 0.6) lines.push('比劫が薄く、大人数より少人数の深い付き合いを好むタイプ。一匹狼になりやすい一方、頼る／頼られるのバランスが偏りがち。');
  if (shishen >= 1) lines.push('食神の気があり、場を和ませる愛嬌と余裕があります。人に好かれやすいタイプ。');
  if (shangguan >= 1.2) lines.push('傷官の気が強く、弁は立つものの、正論や鋭い指摘で相手を追い込みやすい面も。言い方に一呼吸を。');
  if (officer >= 1.2) lines.push('官殺の気があり、目上・組織・ルールとの関係が人間関係の主題になりやすい配置。');
  if (resource >= 1.2) lines.push('印の気があり、世話を焼く・面倒を見る立場になりやすく、目上に可愛がられます。');
  lines.push(`年柱の天干が示すのは「${TEN_GOD_JA[yearGod]}」＝目上・世間・家系との関わり方の傾向。`);
  return section('人との関わり方', lines.join('\n'));
}

function voidSection(chart: BaziChart, category: CategoryKey): NatalSection | null {
  const relevantPillars: Partial<Record<CategoryKey, number[]>> = {
    overall: [0, 1, 2, 3],
    money: [1, 3], // 月柱=仕事から得る財、時柱=晩年の財
    love: [2], // 日支＝配偶者
    career: [1], // 月柱＝社会
    social: [0, 1], // 年柱＝目上、月柱＝社会
    health: [],
  };
  const idxs = relevantPillars[category];
  if (!idxs) return null;
  const hit = chart.details.filter((d, i) => idxs.includes(i) && d.isVoid);
  if (!hit.length) return null;
  return section(
    `空亡：${hit.map((d) => d.ja).join('・')}`,
    `${hit.map((d) => d.ja).join('・')}が空亡にあたります。この分野（${hit.map((d) => pillarTheme(d.kind)).join('・')}）では、努力がすぐ結果に結びつきにくく、遠回りや見直しが起きやすいテーマ。時間をかけて向き合うほど、後から実を結びます。`,
    'tense',
  );
}

function pillarTheme(kind: string): string {
  return { year: '家系・目上・若い頃', month: '両親・仕事・社会的立場', day: '自分自身・配偶者', hour: '子ども・部下・晩年' }[kind] ?? '';
}

// ---- 大運・流年（時期運） ----

function timingSections(chart: BaziChart, asOfYear: number, category: CategoryKey): NatalSection[] | null {
  if (!chart.luck) return null;
  const birthYear = chart.pillars.trueSolar.year;
  const age = asOfYear - birthYear;
  const active = activeLuckPeriod(chart.luck, age);
  const out: NatalSection[] = [];

  if (active) {
    const life = TEN_GOD_LIFE[active.stemTenGod];
    const facet = life.facets[category];
    out.push(
      section(
        `いまの大運：${active.ganZhi.ja}（${TEN_GOD_JA[active.stemTenGod]}／${Math.round(active.startAge)}〜${Math.round(active.endAge)}歳）`,
        `この 10 年は「${TEN_GOD_JA[active.stemTenGod]}」がテーマの時期。${facet ?? life.general} ` +
          `地支の十二運は「${TWELVE_STAGE_JA[active.twelveStage]}」＝${stageBrief(active.twelveStage)}。`,
        tenGodTone(active.stemTenGod),
      ),
    );
  } else {
    out.push(section('起運前', `満${age}歳は大運が始まる前で、月柱（両親・生家）の影響下にある時期です。`, 'neutral'));
  }

  const ann = annualPillar(asOfYear, chart.dayMaster);
  const alife = TEN_GOD_LIFE[ann.stemTenGod];
  out.push(
    section(
      `${asOfYear}年の流年：${ann.ganZhi.ja}（${TEN_GOD_JA[ann.stemTenGod]}）`,
      `${asOfYear}年は「${TEN_GOD_JA[ann.stemTenGod]}」の年。${alife.facets[category] ?? alife.general} ` +
        `十二運は「${TWELVE_STAGE_JA[ann.twelveStage]}」。` +
        `（立春基準。1〜2月上旬はひとつ前の年の干支で見ます）`,
      tenGodTone(ann.stemTenGod),
    ),
  );
  return out;
}

function tenGodTone(g: TenGod): NatalSection['tone'] {
  const grp = TEN_GOD_GROUP[g];
  if (g === 'pianguan' || g === 'shangguan' || g === 'jiecai') return 'tense';
  if (grp === 'wealth' || grp === 'resource' || g === 'shishen') return 'light';
  return 'neutral';
}

// ---- 公開 API ----

const PLANS: Record<CategoryKey, (c: BaziChart) => (NatalSection | null)[]> = {
  overall: (c) => [
    dayMasterSection(c),
    strengthSection(c),
    dominantGodSection(c, 'overall'),
    elementExtremesSection(c, false),
    voidSection(c, 'overall'),
  ],
  money: (c) => [wealthSection(c), dominantGodSection(c, 'money'), strengthSection(c), voidSection(c, 'money')],
  love: (c) => [spouseSection(c), dominantGodSection(c, 'love'), voidSection(c, 'love')],
  health: (c) => [elementExtremesSection(c, true), healthSection(c), strengthSection(c)],
  career: (c) => [careerSection(c), dominantGodSection(c, 'career'), strengthSection(c), voidSection(c, 'career')],
  social: (c) => [socialSection(c), dominantGodSection(c, 'social'), voidSection(c, 'social')],
};

export function analyzeBaziCategory(chart: BaziChart, key: CategoryKey, asOfYear: number): BaziCategoryAnalysis {
  const sections: NatalSection[] = [];
  const seen = new Set<string>();
  for (const s of PLANS[key](chart)) {
    if (!s || seen.has(s.title)) continue;
    seen.add(s.title);
    sections.push(s);
  }
  if (chart.birth.timeUnknown) {
    sections.unshift(
      section(
        '出生時刻が不明です',
        '時柱は正午（真太陽時）での暫定値です。時柱に関わる項目（晩年・子ども、時柱の空亡など）は参考程度に。年柱・月柱・日柱と、そこから出る十神・五行はほぼ正確です。',
        'tense',
      ),
    );
  }
  return {
    key,
    ja: CATEGORY_META[key].ja,
    intro: CATEGORY_INTRO[key],
    sections,
    timing: timingSections(chart, asOfYear, key),
  };
}
