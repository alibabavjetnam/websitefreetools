/**
 * Cờ quốc gia dạng SVG nội tuyến cho nút chọn ngôn ngữ.
 * Không dùng emoji cờ vì Windows không hiển thị emoji cờ (chỉ hiện hai chữ cái, ví dụ "US").
 * Mỗi cờ vẽ trong khung 30×20 (tỉ lệ 3:2).
 */

/** Ngôi sao 5 cánh: tâm (cx, cy), bán kính ngoài r, một cánh hướng theo góc `deg` (0° = hướng lên). */
function star(cx: number, cy: number, r: number, deg = 0): string {
  const inner = r * 0.382;
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = ((deg - 90 + i * 36) * Math.PI) / 180;
    const rr = i % 2 === 0 ? r : inner;
    pts.push(`${(cx + rr * Math.cos(rad)).toFixed(2)},${(cy + rr * Math.sin(rad)).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(' ')}"/>`;
}

/** Góc (độ) từ điểm (x1,y1) đến (x2,y2), 0° = hướng lên, theo chiều kim đồng hồ. */
const angleTo = (x1: number, y1: number, x2: number, y2: number): number =>
  (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI + 90;

function usFlag(): string {
  const h = 20 / 13;
  let stripes = '';
  for (let i = 0; i < 13; i += 2) stripes += `<rect y="${(i * h).toFixed(3)}" width="30" height="${h.toFixed(3)}" fill="#b22234"/>`;
  let dots = '';
  for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) dots += `<circle cx="${(1.8 + col * 2.35).toFixed(2)}" cy="${(1.7 + row * 2.3).toFixed(2)}" r=".55"/>`;
  return `<rect width="30" height="20" fill="#fff"/>${stripes}<rect width="12" height="${(7 * h).toFixed(3)}" fill="#3c3b6e"/><g fill="#fff">${dots}</g>`;
}

function vnFlag(): string {
  return `<rect width="30" height="20" fill="#da251d"/><g fill="#ffcd00">${star(15, 10.6, 6.2)}</g>`;
}

function jpFlag(): string {
  return `<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#bc002d"/>`;
}

function cnFlag(): string {
  const big = { x: 5, y: 5 };
  const smalls = [[10, 2], [12, 4], [12, 7], [10, 9]];
  const small = smalls.map(([x, y]) => star(x, y, 1, angleTo(x, y, big.x, big.y))).join('');
  return `<rect width="30" height="20" fill="#de2910"/><g fill="#ffde00">${star(big.x, big.y, 3)}${small}</g>`;
}

function esFlag(): string {
  return `<rect width="30" height="20" fill="#c60b1e"/><rect y="5" width="30" height="10" fill="#ffc400"/>`;
}

function deFlag(): string {
  return `<rect width="30" height="20" fill="#000"/><rect y="6.67" width="30" height="6.67" fill="#dd0000"/><rect y="13.33" width="30" height="6.67" fill="#ffce00"/>`;
}

const FLAGS: Record<string, () => string> = { en: usFlag, vi: vnFlag, ja: jpFlag, zh: cnFlag, es: esFlag, de: deFlag };

/** Trả về thẻ <svg> của lá cờ ứng với mã ngôn ngữ (rỗng nếu chưa có cờ). */
export function flagSvg(lang: string): string {
  const draw = FLAGS[lang];
  if (!draw) return '';
  return `<svg class="flag" viewBox="0 0 30 20" width="21" height="14" aria-hidden="true" focusable="false">${draw()}<rect width="30" height="20" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1"/></svg>`;
}
