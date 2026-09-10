import { el, mount } from './dom.ts';
import { renderWheel } from './wheel.ts';
import type { BirthData, GeoLocation } from '../domain/birthData.ts';
import { emptyBirthData, validateBirthData } from '../domain/birthData.ts';
import {
  loadProfiles,
  getActiveProfile,
  setActiveProfileId,
  upsertProfile,
  deleteProfile,
  exportProfiles,
  importProfiles,
} from '../domain/profile.ts';
import { search, type GeoCandidate } from '../geo/geocode.ts';
import { lookupTimezone } from '../geo/timezone.ts';
import { buildChart, type Chart } from '../astro/chart.ts';
import { computeTransits, type TransitReport } from '../astro/transits.ts';
import {
  analyzeCategory,
  analyzeTransitOverview,
  CATEGORY_META,
  CATEGORY_KEYS,
  type CategoryKey,
  type NatalSection,
} from '../interpret/engine.ts';
import { buildBaziChart, type BaziChart } from '../bazi/chart.ts';
import { renderBaziResults } from './baziView.ts';

const DRAFT_KEY = 'astro-app:draft:v1';

type SystemKind = 'astrology' | 'bazi';

interface FormState {
  label: string;
  birth: BirthData;
  profileId: string | null;
  onlineSearch: boolean;
  manualCoord: boolean;
  system?: SystemKind;
}

function loadDraft(): FormState {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw) as FormState;
  } catch {
    /* ignore */
  }
  const active = getActiveProfile();
  if (active) {
    return { label: active.label, birth: active.birth, profileId: active.id, onlineSearch: true, manualCoord: false };
  }
  return { label: '本人', birth: emptyBirthData(), profileId: null, onlineSearch: true, manualCoord: false };
}

function saveDraft(state: FormState): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function renderApp(root: HTMLElement): void {
  const state = loadDraft();
  if (!state.system) state.system = 'astrology';
  let chart: Chart | null = null;
  let bazi: BaziChart | null = null;
  let transit: TransitReport | null = null;
  let transitDate = todayISO();
  let baziYear = new Date().getFullYear();
  let activeCategory: CategoryKey = 'overall';

  function recomputeTransit(): void {
    if (!chart) {
      transit = null;
      return;
    }
    // 基準日の正午(UTC)で計算
    const d = new Date(`${transitDate}T12:00:00Z`);
    transit = Number.isNaN(d.getTime()) ? null : computeTransits(chart, d);
  }

  const resultsEl = el('div', { id: 'results' });
  const formCard = el('div', { class: 'card' });

  const introEl = el('div', {});

  function rerender(): void {
    mount(introEl, introCard(state.system ?? 'astrology'));
    renderForm();
    renderResults();
    saveDraft(state);
  }

  // ---------- フォーム ----------
  function renderForm(): void {
    const b = state.birth;
    const profiles = loadProfiles();

    const profileSelect =
      profiles.length > 0 &&
      el(
        'div',
        {},
        el('label', {}, '保存済みプロフィール'),
        el(
          'select',
          {
            onchange: (e: Event) => {
              const id = (e.target as HTMLSelectElement).value;
              if (id === '__new') {
                Object.assign(state, {
                  label: '新しい人',
                  birth: emptyBirthData(),
                  profileId: null,
                });
              } else {
                const p = profiles.find((x) => x.id === id);
                if (p) {
                  state.label = p.label;
                  state.birth = structuredClone(p.birth);
                  state.profileId = p.id;
                  setActiveProfileId(p.id);
                }
              }
              chart = null;
              rerender();
            },
          },
          ...profiles.map((p) =>
            el('option', { value: p.id, selected: p.id === state.profileId }, `${p.label}（${p.birth.date}）`),
          ),
          el('option', { value: '__new', selected: state.profileId === null }, '＋ 新規入力'),
        ),
      );

    const locationField = state.manualCoord ? manualCoordField() : autocompleteField();

    const tzField = el(
      'div',
      {},
      el('label', {}, 'タイムゾーンの扱い'),
      el(
        'select',
        {
          value: b.tzMode,
          onchange: (e: Event) => {
            b.tzMode = (e.target as HTMLSelectElement).value as BirthData['tzMode'];
            rerender();
          },
        },
        el('option', { value: 'iana', selected: b.tzMode === 'iana' }, '地名から自動（推奨・歴史的サマータイム込み）'),
        el('option', { value: 'fixed', selected: b.tzMode === 'fixed' }, '固定 UTC オフセットを指定'),
      ),
      b.tzMode === 'iana' &&
        el('div', { class: 'note' }, b.location.timezone ? `判定: ${b.location.timezone}` : 'タイムゾーン未判定（地点を選び直してください）'),
      b.tzMode === 'fixed' &&
        el('input', {
          type: 'number',
          step: '15',
          placeholder: '例: 540（日本標準時 = +9時間 = 540分）',
          value: b.fixedOffsetMinutes ?? '',
          oninput: (e: Event) => {
            const v = (e.target as HTMLInputElement).value;
            b.fixedOffsetMinutes = v === '' ? undefined : Number(v);
            saveDraft(state);
          },
        }),
    );

    mount(
      formCard,
      el(
        'div',
        { class: 'tabs system-tabs' },
        ...(['astrology', 'bazi'] as SystemKind[]).map((sys) =>
          el(
            'button',
            {
              role: 'tab',
              'aria-selected': String(state.system === sys),
              onclick: () => {
                if (state.system === sys) return;
                state.system = sys;
                rerender();
              },
            },
            sys === 'astrology' ? '西洋占星術' : '四柱推命',
          ),
        ),
      ),
      profileSelect || undefined,
      el('label', {}, '呼び名（プロフィール名）'),
      el('input', {
        type: 'text',
        value: state.label,
        oninput: (e: Event) => {
          state.label = (e.target as HTMLInputElement).value;
          saveDraft(state);
        },
      }),
      el('label', {}, `性別${state.system === 'bazi' ? '（大運の計算に使用）' : '（四柱推命の大運で使用）'}`),
      el(
        'select',
        {
          value: b.gender ?? '',
          onchange: (e: Event) => {
            const v = (e.target as HTMLSelectElement).value;
            b.gender = v === '' ? null : (v as 'male' | 'female');
            saveDraft(state);
          },
        },
        el('option', { value: '', selected: !b.gender }, '未指定'),
        el('option', { value: 'male', selected: b.gender === 'male' }, '男性'),
        el('option', { value: 'female', selected: b.gender === 'female' }, '女性'),
      ),
      el(
        'div',
        { class: 'row' },
        el(
          'div',
          {},
          el('label', {}, '生年月日'),
          el('input', {
            type: 'date',
            value: b.date,
            min: '1800-01-01',
            max: '2100-12-31',
            oninput: (e: Event) => {
              b.date = (e.target as HTMLInputElement).value;
              saveDraft(state);
            },
          }),
        ),
        el(
          'div',
          {},
          el('label', {}, '出生時刻（分単位）'),
          el('input', {
            type: 'time',
            value: b.time,
            disabled: b.timeUnknown,
            oninput: (e: Event) => {
              b.time = (e.target as HTMLInputElement).value;
              saveDraft(state);
            },
          }),
        ),
      ),
      el(
        'div',
        { class: 'check' },
        el('input', {
          type: 'checkbox',
          id: 'timeUnknown',
          checked: !!b.timeUnknown,
          onchange: (e: Event) => {
            b.timeUnknown = (e.target as HTMLInputElement).checked;
            rerender();
          },
        }),
        el('label', { for: 'timeUnknown' }, '出生時刻が不明（正午で暫定計算。ASC・ハウス・月は目安）'),
      ),
      el('label', {}, '出生地'),
      locationField,
      el(
        'div',
        { class: 'check' },
        el('input', {
          type: 'checkbox',
          id: 'manualCoord',
          checked: state.manualCoord,
          onchange: (e: Event) => {
            state.manualCoord = (e.target as HTMLInputElement).checked;
            rerender();
          },
        }),
        el('label', { for: 'manualCoord' }, '緯度経度を手入力する'),
      ),
      !state.manualCoord &&
        el(
          'div',
          { class: 'check' },
          el('input', {
            type: 'checkbox',
            id: 'onlineSearch',
            checked: state.onlineSearch,
            onchange: (e: Event) => {
              state.onlineSearch = (e.target as HTMLInputElement).checked;
              saveDraft(state);
            },
          }),
          el('label', { for: 'onlineSearch' }, 'オンライン検索も使う（内蔵データに無い地名。OpenStreetMap）'),
        ),
      b.location.name &&
        Number.isFinite(b.location.latitude) &&
        el(
          'div',
          { class: 'pill-row' },
          el('span', { class: 'pill' }, `📍 ${b.location.name}`),
          el('span', { class: 'pill' }, `緯度 ${b.location.latitude.toFixed(4)} / 経度 ${b.location.longitude.toFixed(4)}`),
        ),
      tzField,
      el(
        'div',
        { class: 'actions' },
        el('button', { onclick: onCalculate }, '計算する'),
        el('button', { class: 'secondary', onclick: onSave }, state.profileId ? '上書き保存' : '保存'),
        state.profileId &&
          el('button', { class: 'secondary', onclick: onDelete }, '削除'),
      ),
      el(
        'div',
        { class: 'actions' },
        el('button', { class: 'ghost', onclick: onExport }, 'バックアップ書出し'),
        el('button', { class: 'ghost', onclick: onImport }, '読み込み'),
      ),
    );
  }

  function autocompleteField(): HTMLElement {
    let debounce: number | undefined;
    let ctrl: AbortController | undefined;
    const input = el('input', {
      type: 'text',
      placeholder: '市区町村・都市名（例: 世田谷区 / New York）',
      value: state.birth.location.name,
      oninput: (e: Event) => {
        const q = (e.target as HTMLInputElement).value;
        state.birth.location.name = q;
        window.clearTimeout(debounce);
        debounce = window.setTimeout(() => runSearch(q), 250);
      },
    });
    const list = el('div', { class: 'autocomplete-list hidden' });

    async function runSearch(q: string): Promise<void> {
      if (q.trim().length < 1) {
        list.classList.add('hidden');
        return;
      }
      ctrl?.abort();
      ctrl = new AbortController();
      let results: GeoCandidate[] = [];
      try {
        results = await search(q, { online: state.onlineSearch, signal: ctrl.signal });
      } catch {
        results = [];
      }
      mount(
        list,
        ...results.map((r) =>
          el(
            'button',
            {
              type: 'button',
              onclick: () => {
                const loc: GeoLocation = {
                  name: r.detail && r.source === 'nominatim' ? r.detail : r.name,
                  latitude: r.latitude,
                  longitude: r.longitude,
                  timezone: r.timezone ?? lookupTimezone(r.latitude, r.longitude),
                  source: r.source,
                };
                state.birth.location = loc;
                if (!loc.timezone) state.birth.tzMode = 'fixed';
                list.classList.add('hidden');
                rerender();
              },
            },
            el('div', {}, r.name, ' ', el('span', { class: 'src' }, r.source === 'builtin' ? '内蔵' : 'OSM')),
            r.detail && el('div', { class: 'muted' }, r.detail),
          ),
        ),
        results.length === 0 &&
          el('div', { class: 'muted', style: 'padding:10px 12px' }, '該当なし。オンライン検索を有効にするか、緯度経度を手入力してください。'),
      );
      list.classList.remove('hidden');
    }

    input.addEventListener('blur', () => window.setTimeout(() => list.classList.add('hidden'), 200));
    return el('div', { class: 'autocomplete' }, input, list);
  }

  function manualCoordField(): HTMLElement {
    const b = state.birth;
    const sync = () => {
      if (Number.isFinite(b.location.latitude) && Number.isFinite(b.location.longitude)) {
        b.location.timezone = lookupTimezone(b.location.latitude, b.location.longitude);
        const tzNote = document.getElementById('manual-tz-note');
        if (tzNote) tzNote.textContent = b.location.timezone ? `判定: ${b.location.timezone}` : 'タイムゾーン未判定';
      }
      saveDraft(state);
    };
    return el(
      'div',
      {},
      el('input', {
        type: 'text',
        placeholder: '地点の呼び名（任意）',
        value: b.location.name,
        oninput: (e: Event) => {
          b.location.name = (e.target as HTMLInputElement).value;
          saveDraft(state);
        },
      }),
      el(
        'div',
        { class: 'row', style: 'margin-top:8px' },
        el('input', {
          type: 'number',
          step: 'any',
          placeholder: '緯度（北緯＋ 例: 35.6586）',
          value: Number.isFinite(b.location.latitude) ? b.location.latitude : '',
          oninput: (e: Event) => {
            b.location.latitude = Number((e.target as HTMLInputElement).value);
            sync();
          },
        }),
        el('input', {
          type: 'number',
          step: 'any',
          placeholder: '経度（東経＋ 例: 139.7454）',
          value: Number.isFinite(b.location.longitude) ? b.location.longitude : '',
          oninput: (e: Event) => {
            b.location.longitude = Number((e.target as HTMLInputElement).value);
            sync();
          },
        }),
      ),
      el('div', { class: 'note', id: 'manual-tz-note' }, b.location.timezone ? `判定: ${b.location.timezone}` : ''),
    );
  }

  // ---------- アクション ----------
  function onCalculate(): void {
    const { errors } = validateBirthData(state.birth);
    if (errors.length) {
      chart = null;
      bazi = null;
      renderResults(errors);
      return;
    }
    try {
      if (state.system === 'bazi') {
        chart = null;
        transit = null;
        bazi = buildBaziChart(state.birth);
      } else {
        bazi = null;
        chart = buildChart(state.birth);
        recomputeTransit();
      }
    } catch (err) {
      chart = null;
      bazi = null;
      renderResults([(err as Error).message]);
      return;
    }
    renderResults();
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    saveDraft(state);
  }

  function onSave(): void {
    const { errors } = validateBirthData(state.birth);
    if (errors.length) {
      renderResults(errors);
      return;
    }
    const p = upsertProfile({ id: state.profileId ?? undefined, label: state.label, birth: state.birth });
    state.profileId = p.id;
    setActiveProfileId(p.id);
    rerender();
  }

  function onDelete(): void {
    if (!state.profileId) return;
    if (!confirm(`「${state.label}」を削除しますか？`)) return;
    deleteProfile(state.profileId);
    const next = getActiveProfile();
    if (next) {
      state.label = next.label;
      state.birth = structuredClone(next.birth);
      state.profileId = next.id;
    } else {
      state.label = '本人';
      state.birth = emptyBirthData();
      state.profileId = null;
    }
    chart = null;
    rerender();
  }

  function onExport(): void {
    const blob = new Blob([exportProfiles()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: `astro-profiles-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImport(): void {
    const inp = el('input', { type: 'file', accept: 'application/json' });
    inp.addEventListener('change', async () => {
      const file = inp.files?.[0];
      if (!file) return;
      try {
        const n = importProfiles(await file.text(), 'merge');
        alert(`${n} 件のプロフィールを読み込みました。`);
        rerender();
      } catch {
        alert('読み込みに失敗しました。ファイル形式を確認してください。');
      }
    });
    inp.click();
  }

  // ---------- 結果表示 ----------
  function renderResults(errors?: string[]): void {
    if (errors && errors.length) {
      mount(resultsEl, el('div', { class: 'card' }, ...errors.map((e) => el('div', { class: 'warn' }, e))));
      return;
    }
    if (state.system === 'bazi') {
      if (bazi) {
        mount(
          resultsEl,
          renderBaziResults(bazi, state.label, {
            asOfYear: baziYear,
            setAsOfYear: (y) => {
              baziYear = y;
              renderResults();
            },
            activeCategory,
            setActiveCategory: (k) => {
              activeCategory = k;
              renderResults();
            },
          }),
        );
      }
      else mount(resultsEl);
      return;
    }
    if (!chart) {
      mount(resultsEl);
      return;
    }
    const c = chart;

    const warnings = c.warnings.length
      ? el('div', { class: 'card' }, ...c.warnings.map((w) => el('div', { class: 'warn' }, w)))
      : undefined;

    const summary = el(
      'div',
      { class: 'card' },
      el('h2', {}, `${state.label} のホロスコープ`),
      el('div', { class: 'note' }, `${c.birth.date} ${c.birth.timeUnknown ? '(時刻不明)' : c.birth.time} ／ ${c.birth.location.name} ／ UTC ${new Date(c.moment.utcISO).toISOString().slice(0, 16).replace('T', ' ')}（オフセット ${(c.moment.offsetMinutes / 60).toFixed(1)}h）`),
      el(
        'div',
        { class: 'summary-grid', style: 'margin-top:12px' },
        summaryBox('☉', '太陽星座', c.summary.sun.signJa),
        summaryBox('☽', '月星座', c.summary.moon.signJa),
        summaryBox('ASC', '上昇星座', c.summary.ascendant.signJa),
      ),
      el('div', { class: 'wheel-wrap', style: 'margin-top:16px', html: renderWheel(c) }),
    );

    const positions = el(
      'div',
      { class: 'card' },
      el('h2', {}, '天体配置'),
      positionsTable(c),
      el('h3', { style: 'margin-top:16px' }, `ハウス（${c.houses.system === 'placidus' ? 'プラシーダス' : c.houses.system}）`),
      housesTable(c),
    );

    const aspects = el(
      'div',
      { class: 'card' },
      el('h2', {}, `アスペクト（${c.aspects.length}）`),
      ...c.aspects.map((a) => {
        const na = nameOf(c, a.a);
        const nb = nameOf(c, a.b);
        return el(
          'div',
          { class: 'aspect-line' },
          el('span', { class: `a-glyph nature-${a.def.nature}` }, a.def.glyph),
          el('span', {}, `${na} − ${nb}`),
          el('span', { class: `nature-${a.def.nature}` }, a.def.ja),
          el('span', { class: 'orb' }, `${a.orb.toFixed(1)}°${a.applying ? ' ↗' : ''}`),
        );
      }),
    );

    const transitCard = el(
      'div',
      { class: 'card' },
      el('h2', {}, '時期運（トランジット）'),
      el(
        'div',
        { style: 'display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:6px' },
        el('label', { style: 'margin:0' }, '基準日'),
        el('input', {
          type: 'date',
          value: transitDate,
          style: 'width:auto; flex:0 0 auto',
          oninput: (e: Event) => {
            transitDate = (e.target as HTMLInputElement).value || todayISO();
            recomputeTransit();
            renderResults();
          },
        }),
        el(
          'button',
          {
            class: 'ghost',
            style: 'flex:0 0 auto; padding:6px 10px',
            onclick: () => {
              transitDate = todayISO();
              recomputeTransit();
              renderResults();
            },
          },
          '今日',
        ),
      ),
      el('p', { class: 'note' }, '「いまはどんな時期か」を、現在の天体の運行と出生図の関係から読みます。動きの遅い木星〜冥王星が主役です。'),
      ...(transit ? analyzeTransitOverview(transit).map(sectionEl) : []),
    );

    const categoryCard = el(
      'div',
      { class: 'card' },
      el('h2', {}, 'カテゴリ別に見る'),
      el(
        'div',
        { class: 'tabs' },
        ...CATEGORY_KEYS.map((catKey) =>
          el(
            'button',
            {
              role: 'tab',
              'aria-selected': String(catKey === activeCategory),
              onclick: () => {
                activeCategory = catKey;
                renderResults();
              },
            },
            CATEGORY_META[catKey].ja,
          ),
        ),
      ),
      categoryBody(c),
    );

    mount(resultsEl, warnings || undefined, summary, positions, aspects, transitCard, categoryCard);
  }

  function categoryBody(c: Chart): HTMLElement {
    const a = analyzeCategory(c, activeCategory, transit);
    return el(
      'div',
      {},
      el('p', { class: 'note' }, a.intro),
      el('h3', { class: 'interp-group' }, '生まれ持った性質（ネイタル）'),
      ...a.sections.map(sectionEl),
      a.transitSections &&
        el(
          'div',
          {},
          el('h3', { class: 'interp-group' }, `いまの時期運（${transitDate} 時点）`),
          ...a.transitSections.map(sectionEl),
        ),
    );
  }

  rerender();
  root.append(introEl, formCard, resultsEl);
  if (state.birth.date && (state.birth.timeUnknown || state.birth.time) && Number.isFinite(state.birth.location.latitude)) {
    onCalculate();
  }
}

function introCard(system: SystemKind): HTMLElement {
  if (system === 'bazi') {
    return el(
      'div',
      { class: 'card intro-card' },
      el('h2', { style: 'margin-top:0' }, '天文計算にもとづく四柱推命'),
      el(
        'p',
        {},
        '出生時刻を「真太陽時」に換算し、二十四節気を天文計算で正確に求めたうえで、命式（四柱）を組み立てます。',
      ),
      el(
        'ul',
        { class: 'intro-list' },
        el('li', {}, el('strong', {}, '真太陽時'), '：出生地の経度補正に加え、均時差（太陽の実際の進みのズレ）も反映した「日時計の時刻」で時柱・日柱を決めます。'),
        el('li', {}, el('strong', {}, '節入り'), '：立春など 12 の節を、太陽視黄経が 15°の倍数になる瞬間として算出。公表値と約 1 分で一致。'),
        el('li', {}, '日柱は連続する六十干支（1949年10月1日＝甲子 を基準）。年柱は', el('strong', {}, '立春'), 'で切り替え、日の境界は 0:00。'),
      ),
      el(
        'p',
        { class: 'note', style: 'margin-bottom:0' },
        '※ 命式の算出は暦の計算です。十神・蔵干・強弱などの読み方や配分は流派によって差があります。',
      ),
    );
  }
  return el(
    'div',
    { class: 'card intro-card' },
    el('h2', { style: 'margin-top:0' }, '天体計算にもとづく西洋占星術ホロスコープ'),
    el(
      'p',
      {},
      'いわゆる「当たる／当たらない」だけの占いではなく、実際の天体の位置を計算して西洋占星術のホロスコープ（出生図）を組み立てるアプリです。',
    ),
    el(
      'ul',
      { class: 'intro-list' },
      el(
        'li',
        {},
        el('strong', {}, '天体の位置'),
        '：天文計算エンジン（VSOP87／ELP 準拠）で算出。探査機の軌道決定にも使われる ',
        el('strong', {}, 'NASA JPL Horizons'),
        ' と照合し、',
        el('strong', {}, '誤差およそ 1 分角'),
        'で一致することを確認しています。',
      ),
      el(
        'li',
        {},
        el('strong', {}, 'アセンダント・ハウス'),
        '：球面三角法による ',
        el('strong', {}, 'プラシーダス方式'),
        '。出生地の緯度経度と、歴史的なサマータイムまで考慮した時刻で計算します。',
      ),
      el(
        'li',
        {},
        '星座・ハウス・アスペクトの',
        el('strong', {}, '配置そのものは天文学的に正確'),
        'です。',
      ),
    ),
    el(
      'p',
      { class: 'note', style: 'margin-bottom:0' },
      '※ 各配置の解釈文は、西洋占星術の伝統的な読み方にもとづくものです（この部分は科学ではありません）。',
    ),
  );
}

function sectionEl(s: NatalSection): HTMLElement {
  return el(
    'div',
    { class: `interp-section tone-${s.tone}` },
    el('h3', {}, s.title),
    ...s.body.split('\n').map((line) =>
      el('p', { style: 'margin:2px 0 0', class: line.startsWith('〔') ? 'note' : undefined }, line),
    ),
  );
}

function summaryBox(glyph: string, k: string, v: string): HTMLElement {
  return el('div', { class: 'box' }, el('div', { class: 'glyph' }, glyph), el('div', { class: 'k' }, k), el('div', { class: 'v' }, v));
}

function nameOf(c: Chart, id: string): string {
  if (id === 'ascendant') return 'ASC';
  if (id === 'mc') return 'MC';
  return c.bodies.find((b) => b.id === id)?.ja ?? id;
}

function positionsTable(c: Chart): HTMLElement {
  const rows = c.bodies
    .filter((b) => b.id !== 'southNode')
    .map((b) =>
      el(
        'tr',
        {},
        el('td', {}, el('span', { class: 'glyph' }, b.glyph), ' ', b.ja),
        el('td', {}, b.sign.label, b.retrograde ? el('span', { class: 'retro' }, '逆行') : undefined),
        el('td', {}, `第${b.house}`),
        el('td', {}, `${b.speed.toFixed(2)}°/日`),
      ),
    );
  return el(
    'table',
    {},
    el('thead', {}, el('tr', {}, el('th', {}, '天体'), el('th', {}, '位置'), el('th', {}, 'ハウス'), el('th', {}, '速度'))),
    el('tbody', {}, ...rows),
  );
}

function housesTable(c: Chart): HTMLElement {
  const rows = c.houses.cusps.map((lon, i) =>
    el('tr', {}, el('td', {}, `第${i + 1}ハウス`), el('td', {}, toLabel(lon))),
  );
  return el('table', {}, el('tbody', {}, ...rows));
}

function toLabel(lon: number): string {
  const n = ((lon % 360) + 360) % 360;
  const idx = Math.floor(n / 30);
  const names = ['牡羊', '牡牛', '双子', '蟹', '獅子', '乙女', '天秤', '蠍', '射手', '山羊', '水瓶', '魚'];
  const d = n - idx * 30;
  const deg = Math.floor(d);
  const min = Math.floor((d - deg) * 60);
  return `${names[idx]} ${deg}°${String(min).padStart(2, '0')}′`;
}
