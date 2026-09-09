/**
 * ハウス計算（プラシーダス）とアセンダント・MC。
 *
 * RAMC（子午線の赤経）＝ 地方恒星時。
 * 中間ハウスカスプ（11,12,2,3）は半昼弧を時間で 3 分割する古典的な反復法で求める。
 * 高緯度（|緯度| ≳ 66°）ではプラシーダスが破綻するため、その旨を警告し値をクランプする。
 */
import * as Astronomy from 'astronomy-engine';
import { D2R, R2D, norm360 } from './zodiac.ts';

export type HouseSystem = 'placidus';

export interface Houses {
  system: HouseSystem;
  /** アセンダント黄経 */
  ascendant: number;
  /** MC 黄経 */
  mc: number;
  /** 12 ハウスのカスプ黄経。index 0 = 第1ハウス（=アセンダント） */
  cusps: number[];
  /** 子午線赤経（度） */
  ramc: number;
  /** 黄道傾斜（度、of date） */
  obliquity: number;
  /** 地方恒星時（度） */
  lst: number;
  warnings: string[];
}

/** その日の真黄道傾斜（度） */
export function trueObliquity(date: Date): number {
  const r = Astronomy.Rotation_EQD_ECT(date);
  return Math.acos(r.rot[2][2]) * R2D;
}

/** RAMC から黄道上の点の黄経を得る（黄緯 0 の点） */
function eclipticLonFromRA(raDeg: number, oblDeg: number): number {
  const ra = raDeg * D2R;
  const obl = oblDeg * D2R;
  return norm360(Math.atan2(Math.sin(ra), Math.cos(ra) * Math.cos(obl)) * R2D);
}

function computeMC(ramcDeg: number, oblDeg: number): number {
  // RA = RAMC を満たす黄道点（＝上側の子午線交点＝MC）
  return eclipticLonFromRA(ramcDeg, oblDeg);
}

function computeAscendant(ramcDeg: number, latDeg: number, oblDeg: number): number {
  const ramc = ramcDeg * D2R;
  const lat = latDeg * D2R;
  const obl = oblDeg * D2R;
  const y = Math.cos(ramc);
  const x = -(Math.sin(ramc) * Math.cos(obl) + Math.tan(lat) * Math.sin(obl));
  return norm360(Math.atan2(y, x) * R2D);
}

/**
 * 中間カスプ。RA = RAMC + offset + coef * SDA を反復で解く。
 * offset/coef:
 *   11: (0,   1/3)   12: (0,   2/3)
 *    2: (60,  2/3)    3: (120, 1/3)
 */
function intermediateCusp(
  ramcDeg: number,
  latDeg: number,
  oblDeg: number,
  offset: number,
  coef: number,
): { longitude: number; clamped: boolean } {
  const lat = latDeg * D2R;
  const obl = oblDeg * D2R;
  let ra = ramcDeg + offset + coef * 90;
  let clamped = false;
  let lon = 0;
  for (let i = 0; i < 30; i++) {
    lon = eclipticLonFromRA(ra, oblDeg);
    const decl = Math.asin(Math.sin(obl) * Math.sin(lon * D2R));
    let cosH = -Math.tan(lat) * Math.tan(decl);
    if (cosH > 1) {
      cosH = 1;
      clamped = true;
    } else if (cosH < -1) {
      cosH = -1;
      clamped = true;
    }
    const sda = Math.acos(cosH) * R2D; // 半昼弧（度）
    const raNew = ramcDeg + offset + coef * sda;
    if (Math.abs(raNew - ra) < 1e-8) {
      ra = raNew;
      break;
    }
    ra = raNew;
  }
  return { longitude: eclipticLonFromRA(ra, oblDeg), clamped };
}

export function computeHouses(date: Date, latitude: number, longitude: number): Houses {
  const warnings: string[] = [];
  const gastHours = Astronomy.SiderealTime(date); // グリニッジ視恒星時（時）
  const lstDeg = norm360(gastHours * 15 + longitude);
  const ramc = lstDeg;
  const obliquity = trueObliquity(date);

  if (Math.abs(latitude) > 66) {
    warnings.push('高緯度のためプラシーダス・ハウスが不安定です（極付近では定義できません）。');
  }

  const mc = computeMC(ramc, obliquity);
  let asc = computeAscendant(ramc, latitude, obliquity);

  // ハウスは MC(10)→11→12→ASC(1) と黄経が増える向き。
  // すなわち ASC は MC より黄道順で「先」： 0 < (ASC − MC) mod 360 < 180。
  if (norm360(asc - mc) >= 180) asc = norm360(asc + 180);

  const c11 = intermediateCusp(ramc, latitude, obliquity, 0, 1 / 3);
  const c12 = intermediateCusp(ramc, latitude, obliquity, 0, 2 / 3);
  const c2 = intermediateCusp(ramc, latitude, obliquity, 60, 2 / 3);
  const c3 = intermediateCusp(ramc, latitude, obliquity, 120, 1 / 3);
  if (c11.clamped || c12.clamped || c2.clamped || c3.clamped) {
    warnings.push('半昼弧が計算範囲を超えたためカスプを近似値に丸めました。');
  }

  // 第1〜12ハウスのカスプ（対向は +180）
  const cusps = new Array<number>(12);
  cusps[0] = asc; // 1
  cusps[1] = c2.longitude; // 2
  cusps[2] = c3.longitude; // 3
  cusps[3] = norm360(mc + 180); // 4 (IC)
  cusps[4] = norm360(c11.longitude + 180); // 5
  cusps[5] = norm360(c12.longitude + 180); // 6
  cusps[6] = norm360(asc + 180); // 7
  cusps[7] = norm360(c2.longitude + 180); // 8
  cusps[8] = norm360(c3.longitude + 180); // 9
  cusps[9] = mc; // 10
  cusps[10] = c11.longitude; // 11
  cusps[11] = c12.longitude; // 12

  return {
    system: 'placidus',
    ascendant: asc,
    mc,
    cusps,
    ramc,
    obliquity,
    lst: lstDeg,
    warnings,
  };
}

/** 黄経がどのハウスに入るか（1..12） */
export function houseOf(longitude: number, cusps: number[]): number {
  const lon = norm360(longitude);
  for (let i = 0; i < 12; i++) {
    const start = cusps[i];
    const end = cusps[(i + 1) % 12];
    const span = norm360(end - start);
    const offset = norm360(lon - start);
    if (offset < span) return i + 1;
  }
  return 1;
}
