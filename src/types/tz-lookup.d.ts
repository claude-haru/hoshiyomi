declare module 'tz-lookup' {
  /** 緯度・経度から IANA タイムゾーン名を返す */
  export default function tzlookup(latitude: number, longitude: number): string;
}
