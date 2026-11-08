/** Trò ghi nhớ ô hình – màu: sinh bàn chơi theo cấp. */

export const SHAPES = ['circle', 'square', 'triangle', 'star', 'diamond', 'heart', 'hexagon', 'cross'] as const;
export const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#eab308', '#9333ea', '#f97316', '#06b6d4', '#ec4899'] as const;

export interface Tile { shape: number; color: number }
export interface MemoryLevel { rows: number; cols: number; shapes: number; colors: number; questions: number }

export const MEMORY_LEVELS: MemoryLevel[] = [
  { rows: 2, cols: 2, shapes: 4, colors: 4, questions: 2 },
  { rows: 2, cols: 3, shapes: 4, colors: 4, questions: 3 },
  { rows: 3, cols: 3, shapes: 5, colors: 5, questions: 3 },
  { rows: 3, cols: 3, shapes: 6, colors: 6, questions: 4 },
  { rows: 3, cols: 4, shapes: 6, colors: 6, questions: 4 },
  { rows: 4, cols: 4, shapes: 7, colors: 7, questions: 5 },
  { rows: 4, cols: 4, shapes: 8, colors: 8, questions: 5 },
  { rows: 4, cols: 5, shapes: 8, colors: 8, questions: 6 },
  { rows: 5, cols: 5, shapes: 8, colors: 8, questions: 6 },
  { rows: 5, cols: 5, shapes: 8, colors: 8, questions: 7 },
];

function shuffled<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

/** Mỗi ô một cặp (hình, màu) khác nhau để câu hỏi chỉ có một đáp án. */
export function makeBoard(level: number): { tiles: Tile[]; order: number[] } {
  const L = MEMORY_LEVELS[Math.min(10, Math.max(1, level)) - 1];
  const count = L.rows * L.cols;
  const combos: Tile[] = [];
  for (let s = 0; s < L.shapes; s++) for (let c = 0; c < L.colors; c++) combos.push({ shape: s, color: c });
  const tiles = shuffled(combos).slice(0, count);
  const order = shuffled(Array.from({ length: count }, (_, i) => i)).slice(0, L.questions);
  return { tiles, order };
}

/** SVG của một hình (viewBox 0 0 100 100). */
export function shapeSvg(shape: number, color: string, size = 100): string {
  const f = `fill="${color}" stroke="rgba(0,0,0,.35)" stroke-width="3" stroke-linejoin="round"`;
  let inner = '';
  switch (SHAPES[shape]) {
    case 'circle': inner = `<circle cx="50" cy="50" r="34" ${f}/>`; break;
    case 'square': inner = `<rect x="18" y="18" width="64" height="64" rx="6" ${f}/>`; break;
    case 'triangle': inner = `<polygon points="50,14 88,80 12,80" ${f}/>`; break;
    case 'star': inner = `<polygon points="50,10 61,38 91,40 68,59 76,88 50,72 24,88 32,59 9,40 39,38" ${f}/>`; break;
    case 'diamond': inner = `<polygon points="50,10 86,50 50,90 14,50" ${f}/>`; break;
    case 'heart': inner = `<path d="M50 86 C10 56 14 22 34 20 C44 19 50 28 50 34 C50 28 56 19 66 20 C86 22 90 56 50 86Z" ${f}/>`; break;
    case 'hexagon': inner = `<polygon points="50,12 83,31 83,69 50,88 17,69 17,31" ${f}/>`; break;
    default: inner = `<polygon points="38,12 62,12 62,38 88,38 88,62 62,62 62,88 38,88 38,62 12,62 12,38 38,38" ${f}/>`;
  }
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${inner}</svg>`;
}
