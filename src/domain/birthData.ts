/**
 * 出生データの共通スキーマ。
 *
 * このモジュールは占星術アプリと将来の四柱推命アプリで共有する「契約」として扱う。
 * ここに破壊的変更を入れるときは schemaVersion を上げ、マイグレーションを用意すること。
 */

export type CoordinateSource = 'builtin' | 'nominatim' | 'manual';

export interface GeoLocation {
  /** 表示用の地名（例: "東京都新宿区" / "London, UK"） */
  name: string;
  /** 緯度。北緯が正（-90..90） */
  latitude: number;
  /** 経度。東経が正（-180..180） */
  longitude: number;
  /** IANA タイムゾーン名（例: "Asia/Tokyo"）。不明なら null */
  timezone: string | null;
  /** 標高（m）。未使用なら null */
  elevation?: number | null;
  /** 座標の取得元 */
  source?: CoordinateSource;
}

export type TimezoneMode = 'iana' | 'fixed';

export interface BirthData {
  /** スキーマ版数。現行は 1 */
  schemaVersion: 1;
  /** 現地の暦日 "YYYY-MM-DD"（グレゴリオ暦） */
  date: string;
  /** 現地の時刻 "HH:mm"（24時間・分単位） */
  time: string;
  /** 出生時刻が不明な場合 true。ハウス・月の度数などの精度が落ちる */
  timeUnknown?: boolean;
  /** 出生地 */
  location: GeoLocation;
  /**
   * タイムゾーンの解決方法。
   * - 'iana': location.timezone と IANA tzdata（歴史的サマータイム込み）で UTC 変換
   * - 'fixed': fixedOffsetMinutes の固定オフセットで UTC 変換
   */
  tzMode: TimezoneMode;
  /** tzMode==='fixed' のときの UTC オフセット（分、東が正。例: +540 = JST） */
  fixedOffsetMinutes?: number;
  /**
   * 性別。四柱推命の大運（順行／逆行）の判定に使用。占星術では未使用。
   * 未指定なら大運は計算しない。
   */
  gender?: 'male' | 'female' | null;
  /** 任意メモ */
  note?: string;
}

/** 出生の瞬間を UTC に解決した結果（計算層への入力） */
export interface BirthMoment {
  /** UTC の瞬間（ISO 8601, 例 "1990-05-01T15:30:00.000Z"） */
  utcISO: string;
  /** JS Date（UTC 瞬間） */
  date: Date;
  /** 適用された UTC オフセット（分、東が正） */
  offsetMinutes: number;
  /** ユリウス日（UT ベース、TT 補正なし） */
  julianDayUT: number;
  /** 実効的な緯度経度（計算で使用） */
  latitude: number;
  longitude: number;
}

export function emptyBirthData(): BirthData {
  return {
    schemaVersion: 1,
    date: '',
    time: '12:00',
    timeUnknown: false,
    location: {
      name: '',
      latitude: NaN,
      longitude: NaN,
      timezone: null,
    },
    tzMode: 'iana',
  };
}

/** バリデーション結果。errors が空なら妥当 */
export interface ValidationResult {
  errors: string[];
}

export function validateBirthData(b: BirthData): ValidationResult {
  const errors: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date)) {
    errors.push('生年月日を入力してください。');
  } else {
    const [y, m, d] = b.date.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
      errors.push('存在しない日付です。');
    }
    if (y < 1800 || y > 2100) errors.push('対応年は 1800〜2100 年です。');
  }
  if (!b.timeUnknown && !/^\d{2}:\d{2}$/.test(b.time)) {
    errors.push('出生時刻を HH:mm 形式で入力してください。');
  }
  if (!Number.isFinite(b.location.latitude) || Math.abs(b.location.latitude) > 90) {
    errors.push('出生地の緯度が不正です。');
  }
  if (!Number.isFinite(b.location.longitude) || Math.abs(b.location.longitude) > 180) {
    errors.push('出生地の経度が不正です。');
  }
  if (b.tzMode === 'iana' && !b.location.timezone) {
    errors.push('タイムゾーンが特定できません。地点を選び直すか、固定オフセットを指定してください。');
  }
  if (b.tzMode === 'fixed' && !Number.isFinite(b.fixedOffsetMinutes ?? NaN)) {
    errors.push('固定 UTC オフセットを入力してください。');
  }
  return { errors };
}
