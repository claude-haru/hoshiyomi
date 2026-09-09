// 計算の自己検証。astronomy-engine の地平座標変換を「独立した検算」に使う。
//   - アセンダント黄経の点 → 実際に高度 0°・方位 東 になっているか
//   - MC 黄経の点 → 子午線上（方位 南/北）になっているか
// Node 24 の型ストリッピングで .ts を直接 import する。
import assert from 'node:assert/strict';
import test from 'node:test';
import * as Astronomy from 'astronomy-engine';
import { computeHouses } from '../src/astro/houses.ts';
import { computePosition, bodyLongitude } from '../src/astro/ephemeris.ts';
import { resolveBirthMoment } from '../src/geo/timezone.ts';
import { angularSeparation, norm360 } from '../src/astro/zodiac.ts';
import { buildChart } from '../src/astro/chart.ts';
import { computeTransits } from '../src/astro/transits.ts';
import type { BirthData } from '../src/domain/birthData.ts';

/** 黄道(of date)・黄緯0 の点を地平座標へ変換 */
function eclipticToHorizon(lonDeg: number, date: Date, lat: number, lon: number) {
  const ectVec = Astronomy.VectorFromSphere(
    new Astronomy.Spherical(0, lonDeg, 1),
    Astronomy.MakeTime(date),
  );
  const eqd = Astronomy.RotateVector(Astronomy.Rotation_ECT_EQD(date), ectVec);
  const observer = new Astronomy.Observer(lat, lon, 0);
  const hor = Astronomy.RotateVector(Astronomy.Rotation_EQD_HOR(date, observer), eqd);
  const s = Astronomy.HorizonFromVector(hor, null);
  return { altitude: s.lat, azimuth: s.lon };
}

const CASES = [
  { name: '東京 1990-06-15 08:30', date: '1990-06-15', time: '08:30', tz: 'Asia/Tokyo', lat: 35.6896, lon: 139.6917 },
  { name: 'ロンドン 1975-12-01 23:10', date: '1975-12-01', time: '23:10', tz: 'Europe/London', lat: 51.5074, lon: -0.1278 },
  { name: 'シドニー 2001-03-21 05:45', date: '2001-03-21', time: '05:45', tz: 'Australia/Sydney', lat: -33.8688, lon: 151.2093 },
  { name: 'ニューヨーク 1960-07-04 12:00', date: '1960-07-04', time: '12:00', tz: 'America/New_York', lat: 40.7128, lon: -74.006 },
  { name: 'ナイロビ 1988-09-09 14:20', date: '1988-09-09', time: '14:20', tz: 'Africa/Nairobi', lat: -1.2921, lon: 36.8219 },
];

for (const c of CASES) {
  test(`ASC/MC 検算: ${c.name}`, () => {
    const birth: BirthData = {
      schemaVersion: 1,
      date: c.date,
      time: c.time,
      location: { name: c.name, latitude: c.lat, longitude: c.lon, timezone: c.tz },
      tzMode: 'iana',
    };
    const { moment } = resolveBirthMoment(birth);
    assert.ok(moment, 'moment resolved');
    const h = computeHouses(moment!.date, c.lat, c.lon);

    // ASC: 地平線上（高度≈0）で東側（方位 0〜180）にある
    const asc = eclipticToHorizon(h.ascendant, moment!.date, c.lat, c.lon);
    assert.ok(Math.abs(asc.altitude) < 0.05, `ASC altitude ≈ 0 (got ${asc.altitude.toFixed(4)})`);
    assert.ok(asc.azimuth > 0 && asc.azimuth < 180, `ASC は東の地平線 (azimuth ${asc.azimuth.toFixed(2)})`);

    // MC: 子午線上（方位≈0 か ≈180）で地平線より上
    const mc = eclipticToHorizon(h.mc, moment!.date, c.lat, c.lon);
    const az = mc.azimuth;
    const onMeridian = Math.abs(az - 180) < 0.3 || az < 0.3 || Math.abs(az - 360) < 0.3;
    assert.ok(onMeridian, `MC は子午線上 (azimuth ${az.toFixed(3)})`);
    assert.ok(mc.altitude > 0, `MC は地平線より上 (altitude ${mc.altitude.toFixed(2)})`);

    let acc = 0;
    for (let i = 0; i < 12; i++) {
      const d = norm360(h.cusps[(i + 1) % 12] - h.cusps[i]);
      assert.ok(d > 0.2 && d < 150, `カスプ間隔が妥当 house${i + 1}: ${d.toFixed(2)}`);
      acc += d;
    }
    assert.ok(Math.abs(acc - 360) < 1e-6, `カスプ一周 = 360 (got ${acc})`);

    for (let i = 0; i < 6; i++) {
      const diff = norm360(h.cusps[i + 6] - h.cusps[i]);
      assert.ok(Math.abs(diff - 180) < 1e-6, `house${i + 1} と house${i + 7} が対向`);
    }
    // 第10ハウス=MC, 第1ハウス=ASC
    assert.ok(Math.abs(norm360(h.cusps[9] - h.mc)) < 1e-9);
    assert.ok(Math.abs(norm360(h.cusps[0] - h.ascendant)) < 1e-9);
  });
}

test('プラシーダス中間カスプが半昼弧の 1/3・2/3 分割になっている', () => {
  // 東京の例。各中間カスプの点について、時角 = 係数 × 半昼弧 を検算。
  const birth: BirthData = {
    schemaVersion: 1,
    date: '1990-06-15',
    time: '08:30',
    location: { name: '東京', latitude: 35.6442, longitude: 139.6483, timezone: 'Asia/Tokyo' },
    tzMode: 'iana',
  };
  const { moment } = resolveBirthMoment(birth);
  const h = computeHouses(moment!.date, 35.6442, 139.6483);
  const lat = 35.6442;
  const D2R = Math.PI / 180;
  const R2D = 180 / Math.PI;

  // カスプ index(0基点) → 期待される「RAMC からの時角 / 半昼弧」係数
  const expected: Record<number, number> = { 10: 1 / 3, 11: 2 / 3, 1: 4 / 3 /* 実質 60+2/3 */ };
  // ここでは 11,12 ハウス（index 10,11）で検算
  for (const [idx, coef] of [[10, 1 / 3], [11, 2 / 3]] as const) {
    const lon = h.cusps[idx];
    const decl = Math.asin(Math.sin(h.obliquity * D2R) * Math.sin(lon * D2R)) * R2D;
    const ra = Math.atan2(
      Math.sin(lon * D2R) * Math.cos(h.obliquity * D2R),
      Math.cos(lon * D2R),
    ) * R2D;
    const H = norm360(h.ramc - ra); // 時角（西回り正）
    const hourAngleEast = H > 180 ? 360 - H : H;
    const sda = Math.acos(-Math.tan(lat * D2R) * Math.tan(decl * D2R)) * R2D;
    assert.ok(
      Math.abs(hourAngleEast - coef * sda) < 0.05,
      `cusp${idx + 1}: 時角 ${hourAngleEast.toFixed(3)} ≈ ${coef} × 半昼弧 ${sda.toFixed(3)} = ${(coef * sda).toFixed(3)}`,
    );
  }
  void expected;
});

test('外惑星の逆行判定と太陽の日速', () => {
  const d = new Date(Date.UTC(2020, 4, 20, 0, 0)); // 木星・土星 逆行中
  assert.equal(computePosition('jupiter', d).retrograde, true);
  assert.equal(computePosition('saturn', d).retrograde, true);
  const sun = computePosition('sun', d);
  assert.ok(sun.speed > 0.9 && sun.speed < 1.1, `太陽の日速 ≈ 1° (got ${sun.speed.toFixed(3)})`);
  assert.equal(sun.retrograde, false);
});

test('ノード（ドラゴンヘッド）の位置と対向', () => {
  const d = new Date(Date.UTC(2000, 0, 1, 0, 0)); // 平均ノード ≈ 125°（かに座 5°付近）
  const n = computePosition('northNode', d);
  assert.ok(Math.abs(norm360(n.longitude) - 125) < 3, `North Node ≈ 125° (got ${n.longitude.toFixed(2)})`);
  const s = computePosition('southNode', d);
  assert.ok(Math.abs(norm360(s.longitude - n.longitude) - 180) < 1e-6, 'South Node は North Node の対向');
});

test('トランジット：構造と正確化日の妥当性', () => {
  const birth: BirthData = {
    schemaVersion: 1,
    date: '1990-06-15',
    time: '08:30',
    location: { name: '東京', latitude: 35.6442, longitude: 139.6483, timezone: 'Asia/Tokyo' },
    tzMode: 'iana',
  };
  const chart = buildChart(birth);
  const asOf = new Date(Date.UTC(2026, 8, 9, 12, 0));
  const report = computeTransits(chart, asOf);

  // 遅い天体 5 つのハウス通過が出る
  const slow = report.houseTransits.map((h) => h.transiting).sort();
  assert.deepEqual(slow, ['jupiter', 'neptune', 'pluto', 'saturn', 'uranus']);

  // 各アスペクトは基準日時点でオーブ内
  for (const a of report.aspects) {
    const sep = angularSeparation(bodyLongitude(a.transiting, asOf), a.natal.longitude);
    assert.ok(Math.abs(sep - a.aspectAngle) <= 2.6, `${a.transiting}-${a.natal.id} オーブ内`);
  }

  // exactDate があるものは、その日に実際オーブ ≈ 0
  let checked = 0;
  for (const a of report.aspects) {
    if (!a.exactDate) continue;
    const sep = angularSeparation(bodyLongitude(a.transiting, a.exactDate), a.natal.longitude);
    assert.ok(
      Math.abs(sep - a.aspectAngle) < 0.15,
      `${a.transiting} ${a.type} ${a.natal.id}: 正確化日のオーブ ${(sep - a.aspectAngle).toFixed(3)}`,
    );
    checked++;
  }
  assert.ok(checked > 0, '正確化日が求まったアスペクトが少なくとも 1 つある');
});

test('太陽星座（既知）', () => {
  // 2023-04-05 → 牡羊座（0..30°）
  const sun = computePosition('sun', new Date(Date.UTC(2023, 3, 5, 12, 0)));
  assert.ok(sun.longitude > 14 && sun.longitude < 16, `牡羊 ~15° (got ${sun.longitude.toFixed(2)})`);
});
