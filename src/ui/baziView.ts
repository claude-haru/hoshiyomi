/** 四柱推命の結果表示 */
import { el } from './dom.ts';
import type { BaziChart } from '../bazi/chart.ts';
import { WU_XING_JA, type WuXing } from '../bazi/ganzhi.ts';
import { TEN_GOD_JA } from '../bazi/tenGods.ts';
import { TWELVE_STAGE_JA } from '../bazi/twelveStages.ts';
import { DAY_MASTER_STRENGTH_JA } from '../bazi/wuxing.ts';
import { activeLuckPeriod, annualPillar } from '../bazi/luckPeriods.ts';
import { BAZI_GLOSSARY, TEN_GOD_MEANING, TWELVE_STAGE_MEANING } from '../bazi/glossary.ts';
import { TEN_GODS_ALL } from '../bazi/tenGods.ts';
import { TWELVE_STAGES_ALL } from '../bazi/twelveStages.ts';
import { analyzeBaziCategory } from '../interpret/bazi/engine.ts';
import { CATEGORY_META, CATEGORY_KEYS, type CategoryKey, type NatalSection } from '../interpret/engine.ts';

const ROLE_JA = { primary: '本気', middle: '中気', residual: '余気' } as const;

const ELEMENT_COLOR: Record<WuXing, string> = {
  wood: '#7fc97f', fire: '#ff9d76', earth: '#e6c07b', metal: '#cdd6e6', water: '#7ec8e3',
};

export interface BaziViewOptions {
  asOfYear: number;
  setAsOfYear: (y: number) => void;
  activeCategory: CategoryKey;
  setActiveCategory: (k: CategoryKey) => void;
}

export function renderBaziResults(chart: BaziChart, label: string, opts: BaziViewOptions): HTMLElement {
  const wrap = el('div', {});

  if (chart.warnings.length) {
    wrap.append(
      el('div', { class: 'card' }, ...chart.warnings.map((w) => el('div', { class: 'warn' }, w))),
    );
  }

  wrap.append(summaryCard(chart, label));
  wrap.append(mingShiCard(chart));
  wrap.append(wuXingCard(chart));
  wrap.append(luckCard(chart, opts));
  wrap.append(voidCard(chart));
  wrap.append(categoryCard(chart, opts));
  wrap.append(glossaryCard());

  return wrap;
}

function sectionEl(s: NatalSection): HTMLElement {
  return el(
    'div',
    { class: `interp-section tone-${s.tone}` },
    el('h3', {}, s.title),
    ...s.body.split('\n').map((line) => el('p', { style: 'margin:2px 0 0' }, line)),
  );
}

function categoryCard(chart: BaziChart, opts: BaziViewOptions): HTMLElement {
  const a = analyzeBaziCategory(chart, opts.activeCategory, opts.asOfYear);
  return el(
    'div',
    { class: 'card' },
    el('h2', {}, 'カテゴリ別に見る'),
    el(
      'div',
      { class: 'tabs' },
      ...CATEGORY_KEYS.map((k) =>
        el(
          'button',
          {
            role: 'tab',
            'aria-selected': String(k === opts.activeCategory),
            onclick: () => opts.setActiveCategory(k),
          },
          CATEGORY_META[k].ja,
        ),
      ),
    ),
    el('p', { class: 'note' }, a.intro),
    el('h3', { class: 'interp-group' }, '命式が示す傾向'),
    ...a.sections.map(sectionEl),
    a.timing &&
      el(
        'div',
        {},
        el('h3', { class: 'interp-group' }, `いまの時期（${opts.asOfYear}年）`),
        ...a.timing.map(sectionEl),
      ),
  );
}

function glossaryCard(): HTMLElement {
  const details = el(
    'details',
    { class: 'card glossary-card' },
    el('summary', {}, '用語の説明（四柱推命に詳しくない人向け）'),
    el(
      'dl',
      { class: 'glossary' },
      ...BAZI_GLOSSARY.flatMap((t) => [
        el('dt', {}, t.term, t.reading ? el('span', { class: 'gl-yomi' }, `（${t.reading}）`) : null),
        el('dd', {}, t.desc),
      ]),
    ),
    el('h3', { style: 'margin-top:14px' }, '十神（通変星）の意味'),
    el(
      'dl',
      { class: 'glossary compact' },
      ...TEN_GODS_ALL.flatMap((g) => [
        el('dt', {}, TEN_GOD_JA[g]),
        el('dd', {}, TEN_GOD_MEANING[g]),
      ]),
    ),
    el('h3', { style: 'margin-top:14px' }, '十二運星の意味'),
    el(
      'dl',
      { class: 'glossary compact' },
      ...TWELVE_STAGES_ALL.flatMap((s) => [
        el('dt', {}, TWELVE_STAGE_JA[s]),
        el('dd', {}, TWELVE_STAGE_MEANING[s]),
      ]),
    ),
  );
  return details;
}

function summaryCard(chart: BaziChart, label: string): HTMLElement {
  const ts = chart.pillars.trueSolar;
  const dm = chart.dayMaster;
  const w = chart.wuxing;
  const b = chart.birth;
  return el(
    'div',
    { class: 'card' },
    el('h2', {}, `${label} の命式`),
    el(
      'div',
      { class: 'note' },
      `${b.date} ${b.timeUnknown ? '(時刻不明)' : b.time} ／ ${b.location.name}` +
        `${b.gender ? ` ／ ${b.gender === 'male' ? '男性' : '女性'}` : ''}`,
    ),
    el(
      'div',
      { class: 'note' },
      `真太陽時：${ts.year}-${String(ts.month).padStart(2, '0')}-${String(ts.day).padStart(2, '0')} ` +
        `${String(ts.hour).padStart(2, '0')}:${String(ts.minute).padStart(2, '0')}` +
        `（時計時刻から ${ts.offsetMinutes >= 0 ? '+' : ''}${ts.offsetMinutes}分）`,
    ),
    el(
      'div',
      { class: 'summary-grid', style: 'margin-top:12px' },
      box(dm.ja, '日主（日干）', `${WU_XING_JA[dm.element]}・${dm.yin === 'yang' ? '陽' : '陰'}`),
      box('☯', '日主の強弱', DAY_MASTER_STRENGTH_JA[w.strength]),
      box(WU_XING_JA[w.strongest], '最も強い五行', `最弱：${WU_XING_JA[w.weakest]}`),
    ),
    el('p', { class: 'note', style: 'margin-top:10px' }, w.strengthNote),
    el(
      'div',
      { class: 'note' },
      `節：${chart.pillars.termPrev.def.ja}（${fmt(chart.pillars.termPrev.date)}）から ` +
        `${chart.pillars.termNext.def.ja}（${fmt(chart.pillars.termNext.date)}）まで。` +
        `月令の司令：${chart.monthCommand.ja}`,
    ),
  );
}

function mingShiCard(chart: BaziChart): HTMLElement {
  const cols = chart.details; // [year, month, day, hour]
  const headRow = el('tr', {}, el('th', {}, ''), ...cols.map((d) => el('th', {}, d.ja)));

  const stemRow = el(
    'tr',
    {},
    el('th', {}, '天干'),
    ...cols.map((d) =>
      el(
        'td',
        {},
        el('span', { class: 'gz-stem', style: `color:${ELEMENT_COLOR[d.ganZhi.stem.element]}` }, d.ganZhi.stem.ja),
        d.stemTenGod ? el('div', { class: 'tg' }, TEN_GOD_JA[d.stemTenGod]) : el('div', { class: 'tg' }, '（日主）'),
      ),
    ),
  );

  const branchRow = el(
    'tr',
    {},
    el('th', {}, '地支'),
    ...cols.map((d) =>
      el(
        'td',
        {},
        el('span', { class: 'gz-branch', style: `color:${ELEMENT_COLOR[d.branch.element]}` }, d.branch.ja),
        d.isVoid ? el('div', { class: 'tg void' }, '空亡') : null,
      ),
    ),
  );

  const stageRow = el(
    'tr',
    {},
    el('th', {}, '十二運'),
    ...cols.map((d) => el('td', {}, el('span', { class: 'tg' }, TWELVE_STAGE_JA[d.twelveStage]))),
  );

  const hiddenRow = el(
    'tr',
    {},
    el('th', {}, '蔵干'),
    ...cols.map((d) =>
      el(
        'td',
        { class: 'hidden-cell' },
        ...d.hidden.map((h) =>
          el(
            'div',
            { class: h.isCommand ? 'hs command' : 'hs' },
            `${h.stem.ja} `,
            el('span', { class: 'hs-role' }, ROLE_JA[h.role]),
            el('span', { class: 'hs-tg' }, TEN_GOD_JA[h.tenGod]),
          ),
        ),
      ),
    ),
  );

  return el(
    'div',
    { class: 'card' },
    el('h2', {}, '命式表'),
    el('p', { class: 'note', style: 'margin-top:-4px' }, '4 本の柱（年・月・日・時）。上が天干、下が地支。日柱の天干＝日主（あなた自身）が読みの基準。'),
    el(
      'div',
      { style: 'overflow-x:auto' },
      el(
        'table',
        { class: 'mingshi' },
        el('thead', {}, headRow),
        el('tbody', {}, stemRow, branchRow, stageRow, hiddenRow),
      ),
    ),
    el('p', { class: 'note' }, '色は五行（木＝緑／火＝橙／土＝黄／金＝銀／水＝水色）。十二運は日主から見た各地支の段階。太字の蔵干は月令の司令。'),
  );
}

function wuXingCard(chart: BaziChart): HTMLElement {
  const scores = chart.wuxing.scores;
  const max = Math.max(...scores.map((s) => s.score), 0.001);
  return el(
    'div',
    { class: 'card' },
    el('h2', {}, '五行バランス'),
    el('p', { class: 'note', style: 'margin-top:-4px' }, '命式に含まれる木・火・土・金・水の量。少ない五行が「意識して補うとよいもの」を示す。'),
    ...scores.map((s) =>
      el(
        'div',
        { class: 'wx-row' },
        el('span', { class: 'wx-label', style: `color:${ELEMENT_COLOR[s.element]}` }, s.ja),
        el(
          'span',
          { class: 'wx-bar-track' },
          el('span', {
            class: 'wx-bar',
            style: `width:${(s.score / max) * 100}%; background:${ELEMENT_COLOR[s.element]}`,
          }),
        ),
        el('span', { class: 'wx-val' }, `${s.score.toFixed(1)}（${Math.round(s.ratio * 100)}%）`),
      ),
    ),
    chart.wuxing.missing.length
      ? el('p', { class: 'note' }, `命式に無い五行：${chart.wuxing.missing.map((m) => WU_XING_JA[m]).join('・')}`)
      : el('p', { class: 'note' }, '五行はすべて命式に含まれています。'),
  );
}

function luckCard(chart: BaziChart, opts: BaziViewOptions): HTMLElement {
  const card = el(
    'div',
    { class: 'card' },
    el('h2', {}, '大運・流年'),
    el('p', { class: 'note', style: 'margin-top:-4px' }, '大運＝10 年ごとに巡る運気の柱（人生の大きな流れ）。流年＝その年 1 年の運気。'),
  );

  if (!chart.luck) {
    card.append(
      el('p', { class: 'note' }, '性別を選ぶと大運（10年ごとの運気の柱）が表示されます。'),
    );
    return card;
  }

  const luck = chart.luck;
  const birthYear = chart.pillars.trueSolar.year;
  const age = opts.asOfYear - birthYear;
  const active = activeLuckPeriod(luck, age);

  // 年ピッカー
  card.append(
    el(
      'div',
      { style: 'display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px' },
      el('label', { style: 'margin:0' }, '基準年'),
      el('input', {
        type: 'number',
        value: opts.asOfYear,
        min: birthYear,
        max: birthYear + 120,
        style: 'width:6em; flex:0 0 auto',
        oninput: (e: Event) => {
          const y = Number((e.target as HTMLInputElement).value);
          if (y >= birthYear && y <= birthYear + 120) opts.setAsOfYear(y);
        },
      }),
      el('span', { class: 'note' }, `満${age}歳ごろ`),
      el(
        'button',
        {
          class: 'ghost',
          style: 'flex:0 0 auto; padding:6px 10px',
          onclick: () => opts.setAsOfYear(new Date().getFullYear()),
        },
        '今年',
      ),
    ),
    el(
      'p',
      { class: 'note' },
      `大運は${luck.directionJa}（${chart.birth.gender === 'male' ? '男性' : '女性'}・` +
        `${chart.pillars.year.ganZhi.stem.ja}年）。起運：${luck.startAgeLabel}。`,
    ),
  );

  // 大運表
  const rows = luck.periods.map((p) => {
    const isActive = active?.index === p.index;
    return el(
      'tr',
      { class: isActive ? 'active-luck' : undefined },
      el('td', {}, `${Math.round(p.startAge)}〜${Math.round(p.endAge)}歳`),
      el('td', {}, `${p.startYear}〜${p.endYear}`),
      el('td', {}, el('span', { class: 'gz-inline', style: `color:${ELEMENT_COLOR[p.ganZhi.stem.element]}` }, p.ganZhi.ja)),
      el('td', {}, TEN_GOD_JA[p.stemTenGod]),
      el('td', {}, TWELVE_STAGE_JA[p.twelveStage]),
    );
  });
  card.append(
    el(
      'div',
      { style: 'overflow-x:auto' },
      el(
        'table',
        { class: 'luck-table' },
        el('thead', {}, el('tr', {}, el('th', {}, '年齢'), el('th', {}, '西暦'), el('th', {}, '干支'), el('th', {}, '十神'), el('th', {}, '十二運'))),
        el('tbody', {}, ...rows),
      ),
    ),
  );

  // 流年
  const ann = annualPillar(opts.asOfYear, chart.dayMaster);
  card.append(
    el('h3', { style: 'margin-top:16px' }, `流年 ${opts.asOfYear}年`),
    el(
      'p',
      {},
      el('span', { class: 'gz-inline', style: `color:${ELEMENT_COLOR[ann.ganZhi.stem.element]}` }, ann.ganZhi.ja),
      `　天干の十神：${TEN_GOD_JA[ann.stemTenGod]}／地支（本気）：${TEN_GOD_JA[ann.branchHiddenTenGod]}／十二運：${TWELVE_STAGE_JA[ann.twelveStage]}`,
    ),
    active
      ? el('p', { class: 'note' }, `この年に効いている大運：${active.ganZhi.ja}（${TEN_GOD_JA[active.stemTenGod]}）`)
      : el('p', { class: 'note' }, 'この年齢はまだ起運前（月柱の影響下）です。'),
    el('p', { class: 'note' }, '※ 流年は立春基準。1〜2月上旬生まれ・その時期を見る場合は前年の干支になることがあります。'),
  );

  return card;
}

function voidCard(chart: BaziChart): HTMLElement {
  const v = chart.voids;
  return el(
    'div',
    { class: 'card' },
    el('h2', {}, '空亡（天中殺）'),
    el('p', { class: 'note', style: 'margin-top:-4px' }, '日柱から決まる、欠けた 2 つの地支。'),
    el('p', {}, `日柱は ${v.xunName}。空亡は ${v.branches.map((b) => b.ja).join('・')} の 2 支です。`),
    el('p', { class: 'note' }, 'この 2 支を持つ柱の分野では、努力が空回りしやすい・結果が遅れる・見直しが起きやすいとされます。命式表で「空亡」と表示された柱がそれです。'),
  );
}

function box(glyph: string, k: string, val: string): HTMLElement {
  return el('div', { class: 'box' }, el('div', { class: 'glyph' }, glyph), el('div', { class: 'k' }, k), el('div', { class: 'v' }, val));
}
function fmt(d: Date): string {
  const j = new Date(d.getTime() + 9 * 3600000);
  return `${j.getUTCMonth() + 1}/${j.getUTCDate()} ${String(j.getUTCHours()).padStart(2, '0')}:${String(j.getUTCMinutes()).padStart(2, '0')} JST`;
}
