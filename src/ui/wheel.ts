/** ホロスコープ・ホイールを SVG 文字列で描く */
import type { Chart } from '../astro/chart.ts';
import { SIGNS, norm360, BODIES } from '../astro/zodiac.ts';
import { ASPECT_DEFS } from '../astro/aspects.ts';

const SIZE = 400;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUT = 196;
const R_SIGN_IN = 168;
const R_HOUSE_IN = 78;
const R_PLANET = 148;
const R_ASPECT = R_HOUSE_IN;

/** 黄経 → 画面角（度）。ASC を左（9時方向）に固定し、黄経増加で反時計回り */
function screenAngle(lon: number, ascLon: number): number {
  return 180 + (lon - ascLon);
}
function pt(lon: number, radius: number, ascLon: number): [number, number] {
  const a = (screenAngle(lon, ascLon) * Math.PI) / 180;
  return [CX + radius * Math.cos(a), CY - radius * Math.sin(a)];
}
function arcPath(lonA: number, lonB: number, radius: number, ascLon: number): string {
  const [x1, y1] = pt(lonA, radius, ascLon);
  const [x2, y2] = pt(lonB, radius, ascLon);
  const large = norm360(lonB - lonA) > 180 ? 1 : 0;
  // 反時計回り（sweep=0）
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${large} 0 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

const SIGN_COLORS: Record<string, string> = {
  火: '#ff9d76',
  地: '#9bd18b',
  風: '#9ec9ff',
  水: '#8fd7cf',
};

export function renderWheel(chart: Chart): string {
  const asc = chart.houses.ascendant;
  const parts: string[] = [];

  parts.push(`<svg viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ホロスコープ">`);
  parts.push(`<circle cx="${CX}" cy="${CY}" r="${R_OUT}" fill="#1c1940" stroke="#3a336b"/>`);

  // 12 サイン
  for (let i = 0; i < 12; i++) {
    const start = i * 30;
    const end = start + 30;
    const [xo1, yo1] = pt(start, R_OUT, asc);
    const [xi1, yi1] = pt(start, R_SIGN_IN, asc);
    parts.push(`<line x1="${xo1.toFixed(2)}" y1="${yo1.toFixed(2)}" x2="${xi1.toFixed(2)}" y2="${yi1.toFixed(2)}" stroke="#3a336b"/>`);
    const s = SIGNS[i];
    const [lx, ly] = pt(start + 15, (R_OUT + R_SIGN_IN) / 2, asc);
    parts.push(
      `<text x="${lx.toFixed(2)}" y="${(ly + 6).toFixed(2)}" text-anchor="middle" font-size="17" fill="${SIGN_COLORS[s.element]}">${s.glyph}</text>`,
    );
    const bandOuter = arcPath(start, end, R_SIGN_IN, asc);
    parts.push(`<path d="${bandOuter}" fill="none" stroke="${SIGN_COLORS[s.element]}" stroke-opacity="0.25" stroke-width="2"/>`);
  }
  parts.push(`<circle cx="${CX}" cy="${CY}" r="${R_SIGN_IN}" fill="none" stroke="#3a336b"/>`);
  parts.push(`<circle cx="${CX}" cy="${CY}" r="${R_HOUSE_IN}" fill="none" stroke="#3a336b"/>`);

  // ハウスカスプ
  for (let i = 0; i < 12; i++) {
    const cusp = chart.houses.cusps[i];
    const isAngle = i === 0 || i === 3 || i === 6 || i === 9;
    const [x1, y1] = pt(cusp, R_HOUSE_IN, asc);
    const [x2, y2] = pt(cusp, R_SIGN_IN, asc);
    parts.push(
      `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${isAngle ? '#ffd479' : '#4b4488'}" stroke-width="${isAngle ? 2 : 1}"/>`,
    );
    // ハウス番号
    const mid = cusp + norm360(chart.houses.cusps[(i + 1) % 12] - cusp) / 2;
    const [nx, ny] = pt(mid, R_HOUSE_IN + 12, asc);
    parts.push(`<text x="${nx.toFixed(2)}" y="${(ny + 3).toFixed(2)}" text-anchor="middle" font-size="9" fill="#7c76b0">${i + 1}</text>`);
  }

  // ASC / MC ラベル
  for (const angle of chart.angles) {
    const [x, y] = pt(angle.longitude, R_OUT + 2, asc);
    const anchor = x < CX - 10 ? 'end' : x > CX + 10 ? 'start' : 'middle';
    parts.push(
      `<text x="${x.toFixed(2)}" y="${(y + 3).toFixed(2)}" text-anchor="${anchor}" font-size="10" fill="#ffd479" font-weight="700">${angle.glyph}</text>`,
    );
  }

  // アスペクト線
  for (const asp of chart.aspects) {
    if (asp.a === 'ascendant' || asp.a === 'mc' || asp.b === 'ascendant' || asp.b === 'mc') continue;
    const pa = chart.bodies.find((b) => b.id === asp.a);
    const pb = chart.bodies.find((b) => b.id === asp.b);
    if (!pa || !pb) continue;
    const def = ASPECT_DEFS.find((d) => d.type === asp.type)!;
    const color = def.nature === 'harmonious' ? '#6fd3c7' : def.nature === 'tense' ? '#ff8f9c' : '#8f89c9';
    const [x1, y1] = pt(pa.longitude, R_ASPECT, asc);
    const [x2, y2] = pt(pb.longitude, R_ASPECT, asc);
    parts.push(
      `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${color}" stroke-width="${(0.5 + asp.strength * 1.6).toFixed(2)}" stroke-opacity="${(0.25 + asp.strength * 0.5).toFixed(2)}"/>`,
    );
  }

  // 天体
  const drawn: { lon: number; r: number }[] = [];
  for (const body of chart.bodies) {
    if (body.id === 'southNode') continue;
    let r = R_PLANET;
    // 近接した天体は半径をずらして重なりを避ける
    while (drawn.some((d) => Math.abs(norm360(d.lon - body.longitude + 180) - 180) < 7 && Math.abs(d.r - r) < 12)) {
      r -= 13;
    }
    drawn.push({ lon: body.longitude, r });
    const [gx, gy] = pt(body.longitude, r, asc);
    const [tx, ty] = pt(body.longitude, R_SIGN_IN, asc);
    parts.push(`<line x1="${gx.toFixed(2)}" y1="${gy.toFixed(2)}" x2="${tx.toFixed(2)}" y2="${ty.toFixed(2)}" stroke="#4b4488" stroke-width="0.75"/>`);
    parts.push(
      `<text x="${gx.toFixed(2)}" y="${(gy + 5).toFixed(2)}" text-anchor="middle" font-size="15" fill="#ffe9bf">${BODIES[body.id]?.glyph ?? '?'}${body.retrograde ? '<tspan font-size="8" fill="#ff8f9c" dy="-6">R</tspan>' : ''}</text>`,
    );
  }

  parts.push(`<circle cx="${CX}" cy="${CY}" r="2" fill="#ffd479"/>`);
  parts.push(`</svg>`);
  return parts.join('');
}
