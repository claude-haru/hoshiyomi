/** 四柱推命の結果表示 */
import { el } from './dom.ts';
import type { BaziChart } from '../bazi/chart.ts';
import { WU_XING_JA, type WuXing } from '../bazi/ganzhi.ts';
import { TEN_GOD_JA } from '../bazi/tenGods.ts';
import { DAY_MASTER_STRENGTH_JA } from '../bazi/wuxing.ts';

const ROLE_JA = { primary: '本気', middle: '中気', residual: '余気' } as const;

const ELEMENT_COLOR: Record<WuXing, string> = {
  wood: '#7fc97f', fire: '#ff9d76', earth: '#e6c07b', metal: '#cdd6e6', water: '#7ec8e3',
};

export function renderBaziResults(chart: BaziChart, label: string): HTMLElement {
  const wrap = el('div', {});

  if (chart.warnings.length) {
    wrap.append(
      el('div', { class: 'card' }, ...chart.warnings.map((w) => el('div', { class: 'warn' }, w))),
    );
  }

  wrap.append(summaryCard(chart, label));
  wrap.append(mingShiCard(chart));
  wrap.append(wuXingCard(chart));
  wrap.append(voidCard(chart));

  return wrap;
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
      `${b.date} ${b.timeUnknown ? '(時刻不明)' : b.time} ／ ${b.location.name}`,
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
    el(
      'div',
      { style: 'overflow-x:auto' },
      el('table', { class: 'mingshi' }, el('thead', {}, headRow), el('tbody', {}, stemRow, branchRow, hiddenRow)),
    ),
    el('p', { class: 'note' }, '十干・十二支の色は五行（木＝緑／火＝橙／土＝黄／金＝銀／水＝水色）。太字の蔵干は月令の司令。'),
  );
}

function wuXingCard(chart: BaziChart): HTMLElement {
  const scores = chart.wuxing.scores;
  const max = Math.max(...scores.map((s) => s.score), 0.001);
  return el(
    'div',
    { class: 'card' },
    el('h2', {}, '五行バランス'),
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

function voidCard(chart: BaziChart): HTMLElement {
  const v = chart.voids;
  return el(
    'div',
    { class: 'card' },
    el('h2', {}, '空亡（天中殺）'),
    el('p', {}, `日柱は ${v.xunName}。空亡は ${v.branches.map((b) => b.ja).join('・')} の 2 支です。`),
    el('p', { class: 'note' }, '空亡にあたる柱は、その分野で努力が結果に結びつきにくい・見直しが起きやすいとされます。'),
  );
}

function box(glyph: string, k: string, val: string): HTMLElement {
  return el('div', { class: 'box' }, el('div', { class: 'glyph' }, glyph), el('div', { class: 'k' }, k), el('div', { class: 'v' }, val));
}
function fmt(d: Date): string {
  const j = new Date(d.getTime() + 9 * 3600000);
  return `${j.getUTCMonth() + 1}/${j.getUTCDate()} ${String(j.getUTCHours()).padStart(2, '0')}:${String(j.getUTCMinutes()).padStart(2, '0')} JST`;
}
