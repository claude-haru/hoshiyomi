/**
 * 真太陽時。出生地の経度による補正と均時差（太陽の実際の動きのズレ）を反映した、
 * 「日時計の時刻」。四柱推命の時柱・日柱の境界に用いる。
 *
 * 太陽の時角から地方視太陽時を求め、出生地の時計時刻との差ぶんだけ
 * 出生の瞬間をずらして、真太陽時の「壁時計表示」を得る。
 */
import * as Astronomy from 'astronomy-engine';
import type { BirthMoment } from '../domain/birthData.ts';

export interface TrueSolarClock {
  /** 真太陽時の暦日・時刻を UTC ゲッターで読める Date（実際の瞬間ではなく表示用） */
  wall: Date;
  year: number;
  month: number; // 1..12
  day: number;
  hour: number; // 0..23
  minute: number;
  /** 時計時刻からの補正（分）。東経で標準子午線より東／均時差プラスなら正 */
  offsetMinutes: number;
}

/** 地方視太陽時（時, 0..24）：太陽が南中する時刻を 12:00 とする */
function localApparentSolarHours(utc: Date, latitude: number, longitude: number): number {
  const observer = new Astronomy.Observer(latitude, longitude, 0);
  const ha = Astronomy.HourAngle(Astronomy.Body.Sun, utc, observer); // 時角（時）
  return ((ha + 12) % 24 + 24) % 24;
}

export function computeTrueSolarClock(moment: BirthMoment): TrueSolarClock {
  const utc = moment.date;

  // 出生地の「時計時刻」（入力どおりの現地時刻）
  const clockMs = utc.getTime() + moment.offsetMinutes * 60000;
  const clock = new Date(clockMs);
  const clockMinOfDay = clock.getUTCHours() * 60 + clock.getUTCMinutes() + clock.getUTCSeconds() / 60;

  // 真太陽時（分, その日の 0:00 基準）
  const lastHours = localApparentSolarHours(utc, moment.latitude, moment.longitude);
  const trueMinOfDay = lastHours * 60;

  // 時計時刻との差（±720 分に正規化。実際は ±約60分以内）
  let diff = trueMinOfDay - clockMinOfDay;
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;

  const wall = new Date(clockMs + diff * 60000);
  return {
    wall,
    year: wall.getUTCFullYear(),
    month: wall.getUTCMonth() + 1,
    day: wall.getUTCDate(),
    hour: wall.getUTCHours(),
    minute: wall.getUTCMinutes(),
    offsetMinutes: Math.round(diff),
  };
}
