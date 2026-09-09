/**
 * 出生地の緯度経度 → タイムゾーン、そして出生の瞬間 → UTC 解決。
 * 歴史的なサマータイム・標準時変更は Luxon（ブラウザの IANA tzdata）に任せる。
 */
import { DateTime, FixedOffsetZone, IANAZone } from 'luxon';
import tzLookup from 'tz-lookup';
import type { BirthData, BirthMoment } from '../domain/birthData.ts';

/** 緯度経度から IANA タイムゾーン名を求める（オフラインで動作） */
export function lookupTimezone(latitude: number, longitude: number): string | null {
  try {
    return tzLookup(latitude, longitude);
  } catch {
    return null;
  }
}

/** Unix ミリ秒 → ユリウス日（UT） */
export function julianDayFromDate(date: Date): number {
  return 2440587.5 + date.getTime() / 86400000;
}

export interface ResolveResult {
  moment: BirthMoment | null;
  /** 解決時の警告（時刻不明・オフセット推定など） */
  warnings: string[];
  error?: string;
}

/**
 * BirthData を UTC の瞬間へ解決する。
 * time が不明な場合は正午（現地）を仮に用い、警告を返す。
 */
export function resolveBirthMoment(birth: BirthData): ResolveResult {
  const warnings: string[] = [];

  const timeStr = birth.timeUnknown || !birth.time ? '12:00' : birth.time;
  if (birth.timeUnknown) {
    warnings.push('出生時刻が不明のため、現地正午で暫定計算しています（アセンダント・ハウス・月度数は目安）。');
  }

  const isoLocal = `${birth.date}T${timeStr}`;

  let zone: IANAZone | FixedOffsetZone;
  if (birth.tzMode === 'fixed') {
    if (!Number.isFinite(birth.fixedOffsetMinutes ?? NaN)) {
      return { moment: null, warnings, error: '固定 UTC オフセットが未設定です。' };
    }
    zone = FixedOffsetZone.instance(birth.fixedOffsetMinutes as number);
  } else {
    const tz = birth.location.timezone;
    if (!tz || !IANAZone.isValidZone(tz)) {
      return {
        moment: null,
        warnings,
        error: 'タイムゾーンが特定できません。地点を選び直すか、固定オフセットを指定してください。',
      };
    }
    zone = IANAZone.create(tz);
  }

  const dt = DateTime.fromISO(isoLocal, { zone });
  if (!dt.isValid) {
    return { moment: null, warnings, error: `日時の解釈に失敗しました: ${dt.invalidReason ?? ''}` };
  }

  // サマータイム開始時の「存在しない時刻」を Luxon は繰り上げる。その旨を通知。
  const back = dt.setZone(zone).toFormat('HH:mm');
  if (!birth.timeUnknown && back !== timeStr) {
    warnings.push(`入力時刻 ${timeStr} はサマータイム切替の谷間にあたるため ${back} として扱いました。`);
  }

  const jsDate = dt.toJSDate();
  const moment: BirthMoment = {
    utcISO: dt.toUTC().toISO() ?? jsDate.toISOString(),
    date: jsDate,
    offsetMinutes: dt.offset,
    julianDayUT: julianDayFromDate(jsDate),
    latitude: birth.location.latitude,
    longitude: birth.location.longitude,
  };
  return { moment, warnings };
}
