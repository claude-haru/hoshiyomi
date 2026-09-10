import assert from 'node:assert/strict';
import test from 'node:test';
import type { BirthData } from '../src/domain/birthData.ts';
import { julianDayNumber, computeFourPillars } from '../src/bazi/pillars.ts';
import { lichun, bracketingTerms } from '../src/bazi/solarTerms.ts';
import { ganZhi } from '../src/bazi/ganzhi.ts';
import { buildBaziChart } from '../src/bazi/chart.ts';
import { resolveBirthMoment } from '../src/geo/timezone.ts';
import { tenGod } from '../src/bazi/tenGods.ts';
import { STEMS } from '../src/bazi/ganzhi.ts';

const S = (ja: string) => STEMS.find((s) => s.ja === ja)!;

test('ユリウス日：既知の値', () => {
  assert.equal(julianDayNumber(2000, 1, 1), 2451545);
  assert.equal(julianDayNumber(1949, 10, 1), 2433191);
  assert.equal(julianDayNumber(1912, 2, 18), 2419451);
});

test('日柱：1949-10-01 は甲子（Wikipedia の実測アンカー）', () => {
  const idx = (julianDayNumber(1949, 10, 1) + 49) % 60;
  assert.equal(ganZhi(idx).ja, '甲子');
  assert.equal(ganZhi((julianDayNumber(1912, 2, 18) + 49) % 60).ja, '甲子');
  assert.equal(ganZhi((julianDayNumber(2000, 1, 1) + 49) % 60).ja, '戊午');
});

test('立春：公表値と ~1 分で一致（JST）', () => {
  const j = (d: Date) => new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 16);
  assert.equal(j(lichun(2023)), '2023-02-04T11:42');
  assert.equal(j(lichun(2024)), '2024-02-04T17:26');
  assert.equal(j(lichun(2025)), '2025-02-03T23:10');
});

test('十神：日主 甲 から見た関係', () => {
  assert.equal(tenGod(S('甲'), S('甲')), 'bijian'); // 比肩
  assert.equal(tenGod(S('甲'), S('乙')), 'jiecai'); // 劫財
  assert.equal(tenGod(S('甲'), S('丙')), 'shishen'); // 食神（木→火・同陽）
  assert.equal(tenGod(S('甲'), S('丁')), 'shangguan'); // 傷官
  assert.equal(tenGod(S('甲'), S('戊')), 'piancai'); // 偏財（木剋土・同陽）
  assert.equal(tenGod(S('甲'), S('己')), 'zhengcai'); // 正財
  assert.equal(tenGod(S('甲'), S('庚')), 'pianguan'); // 偏官（金剋木・同陽）
  assert.equal(tenGod(S('甲'), S('辛')), 'zhengguan'); // 正官
  assert.equal(tenGod(S('甲'), S('壬')), 'pianyin'); // 偏印（水生木・同陽）
  assert.equal(tenGod(S('甲'), S('癸')), 'zhengyin'); // 印綬
});

const AKASHI = { name: '明石', latitude: 34.65, longitude: 135.0, timezone: 'Asia/Tokyo' };

function birth(date: string, time: string): BirthData {
  return { schemaVersion: 1, date, time, location: AKASHI, tzMode: 'iana' };
}

test('命式：2000-01-01 12:00 明石（内部整合）', () => {
  const { moment } = resolveBirthMoment(birth('2000-01-01', '12:00'));
  const fp = computeFourPillars(moment!);
  // 立春前なので年柱は 1999 年 → 己卯
  assert.equal(fp.year.ganZhi.ja, '己卯');
  // 前の節は大雪1999 → 子月、五虎遁で 丙子
  assert.equal(fp.month.ganZhi.branch.ja, '子');
  assert.equal(fp.month.ganZhi.ja, '丙子');
  // 日柱 戊午
  assert.equal(fp.day.ganZhi.ja, '戊午');
  // 時柱：真太陽時 ~11:5x → 午刻、日干戊 → 五鼠遁で 戊午
  assert.equal(fp.hour.ganZhi.branch.ja, '午');
  assert.equal(fp.hour.ganZhi.ja, '戊午');
});

test('年柱の立春境界：2024-02-04（立春当日前後）', () => {
  // 立春 2024 = 02-04 17:26 JST。直前(17:00)は前年扱い、直後(18:00)は当年扱い。
  const before = computeFourPillars(resolveBirthMoment(birth('2024-02-04', '17:00')).moment!);
  const after = computeFourPillars(resolveBirthMoment(birth('2024-02-04', '18:00')).moment!);
  assert.equal(before.year.ganZhi.ja, ganZhi((2023 - 4) % 60).ja); // 癸卯
  assert.equal(after.year.ganZhi.ja, ganZhi((2024 - 4) % 60).ja); // 甲辰
  assert.equal(after.year.ganZhi.ja, '甲辰');
  assert.equal(before.year.ganZhi.ja, '癸卯');
});

test('buildBaziChart：構造とバランス', () => {
  const chart = buildBaziChart(birth('1985-11-20', '06:40'));
  assert.equal(chart.details.length, 4);
  assert.equal(chart.details[2].stemTenGod, null); // 日柱天干は日主
  assert.equal(chart.dayMaster.index, chart.pillars.day.ganZhi.stem.index);
  const total = chart.wuxing.scores.reduce((s, x) => s + x.score, 0);
  assert.ok(total > 5 && total < 15, `五行スコア合計が妥当 (${total})`);
  assert.ok(chart.voids.branches.length === 2);
});

test('十二運星：日主 甲・乙 の既知の段階', async () => {
  const { twelveStage, TWELVE_STAGE_JA } = await import('../src/bazi/twelveStages.ts');
  const { BRANCHES } = await import('../src/bazi/ganzhi.ts');
  const b = (ja: string) => BRANCHES.find((x) => x.ja === ja)!.index;
  assert.equal(TWELVE_STAGE_JA[twelveStage(S('甲'), b('亥'))], '長生');
  assert.equal(TWELVE_STAGE_JA[twelveStage(S('甲'), b('子'))], '沐浴');
  assert.equal(TWELVE_STAGE_JA[twelveStage(S('甲'), b('卯'))], '帝旺');
  assert.equal(TWELVE_STAGE_JA[twelveStage(S('乙'), b('午'))], '長生'); // 陰干は逆行
  assert.equal(TWELVE_STAGE_JA[twelveStage(S('乙'), b('寅'))], '帝旺');
  assert.equal(TWELVE_STAGE_JA[twelveStage(S('丙'), b('寅'))], '長生');
});

test('大運：方向と起運、干支の連続', () => {
  // 1990-06-15 男性、庚午年（庚＝陽）→ 順行
  const chart = buildBaziChart({
    ...birth('1990-06-15', '08:30'),
    location: { name: '東京', latitude: 35.6895, longitude: 139.6917, timezone: 'Asia/Tokyo' },
    gender: 'male',
  });
  assert.ok(chart.luck);
  assert.equal(chart.luck!.direction, 'forward');
  // 起運：小暑(7/7)まで約22日 → 約7歳台
  assert.ok(chart.luck!.startAge > 6 && chart.luck!.startAge < 9, `起運 ${chart.luck!.startAge.toFixed(2)}歳`);
  // 大運[0] は月柱の次の干支
  const monthIdx = chart.pillars.month.ganZhi.index;
  assert.equal(chart.luck!.periods[0].ganZhi.index, (monthIdx + 1) % 60);
  assert.equal(chart.luck!.periods[1].ganZhi.index, (monthIdx + 2) % 60);
  // 女性なら逆行
  const f = buildBaziChart({
    ...birth('1990-06-15', '08:30'),
    location: { name: '東京', latitude: 35.6895, longitude: 139.6917, timezone: 'Asia/Tokyo' },
    gender: 'female',
  });
  assert.equal(f.luck!.direction, 'backward');
  assert.equal(f.luck!.periods[0].ganZhi.index, ((monthIdx - 1) % 60 + 60) % 60);
});

test('流年：西暦から干支', async () => {
  const { annualPillar } = await import('../src/bazi/luckPeriods.ts');
  assert.equal(annualPillar(2024, S('甲')).ganZhi.ja, '甲辰');
  assert.equal(annualPillar(2025, S('甲')).ganZhi.ja, '乙巳');
  assert.equal(annualPillar(1990, S('甲')).ganZhi.ja, '庚午');
});

test('カテゴリ別解釈：6カテゴリぶんセクションが出る', async () => {
  const { analyzeBaziCategory } = await import('../src/interpret/bazi/engine.ts');
  const { CATEGORY_KEYS } = await import('../src/interpret/engine.ts');
  const chart = buildBaziChart({
    ...birth('1978-03-25', '15:20'),
    location: { name: '大阪', latitude: 34.6937, longitude: 135.5023, timezone: 'Asia/Tokyo' },
    gender: 'male',
  });
  for (const k of CATEGORY_KEYS) {
    const a = analyzeBaziCategory(chart, k, 2026);
    assert.ok(a.sections.length >= 1, `${a.ja}: セクションあり`);
    assert.ok(a.timing && a.timing.length >= 1, `${a.ja}: 時期セクションあり（性別あり）`);
    for (const s of a.sections) {
      assert.ok(s.body.length > 10, `${a.ja} / ${s.title}: 本文あり`);
      assert.ok(!/undefined|NaN|\[object/.test(s.body), `${a.ja} / ${s.title}: 変な文字列なし`);
    }
  }
});

test('カテゴリ別解釈：性別なしなら大運セクションなし', async () => {
  const { analyzeBaziCategory } = await import('../src/interpret/bazi/engine.ts');
  const chart = buildBaziChart(birth('1978-03-25', '15:20'));
  const a = analyzeBaziCategory(chart, 'overall', 2026);
  assert.equal(a.timing, null);
  assert.ok(a.sections.length >= 1);
});

test('bracketingTerms：清明2024の前後', () => {
  // 2024-04-10 は清明(04-04)の後、穀雨は中気なので次の節は立夏(05-05)
  const b = bracketingTerms(new Date(Date.UTC(2024, 3, 10)));
  assert.equal(b.prev.def.ja, '清明');
  assert.equal(b.next.def.ja, '立夏');
});
