/** Lõi ba trò bài một người: Pyramid (cộng đủ 13), TriPeaks và Golf (nối lá hơn/kém 1). Thuần, không đụng DOM. */
import { deck, shuffle, type Card } from './solitaire';

/* ============================== Pyramid ============================== */
export interface Pyramid { rows: (Card | null)[][]; stock: Card[]; waste: Card[]; recycles: number }

/** Số lần được lật lại chồng bỏ theo cấp 1..10 */
export const PYRAMID_RECYCLES = [3, 3, 3, 3, 2, 2, 2, 1, 1, 1];

export function dealPyramid(level: number, rand?: () => number): Pyramid {
  const d = shuffle(deck(), rand).map((c) => ({ ...c, up: true }));
  const rows: Card[][] = [];
  for (let r = 0; r < 7; r++) rows.push(d.splice(0, r + 1));
  return { rows, stock: d, waste: [], recycles: PYRAMID_RECYCLES[Math.min(10, Math.max(1, level)) - 1] };
}

/** Lá ở (r,c) đã gỡ hết lá che? */
export function pyrFree(g: Pyramid, r: number, c: number): boolean {
  if (!g.rows[r][c]) return false;
  if (r === 6) return true;
  return !g.rows[r + 1][c] && !g.rows[r + 1][c + 1];
}

export type PyrRef = { kind: 'pyr'; r: number; c: number } | { kind: 'waste' };
export const pyrCard = (g: Pyramid, p: PyrRef): Card | null => (p.kind === 'waste' ? g.waste[g.waste.length - 1] ?? null : g.rows[p.r][p.c]);

/** Các lá có thể bấm: lá tự do trên kim tự tháp và lá trên cùng chồng bỏ */
export function pyrOpen(g: Pyramid): PyrRef[] {
  const out: PyrRef[] = [];
  for (let r = 0; r < 7; r++) for (let c = 0; c <= r; c++) if (pyrFree(g, r, c)) out.push({ kind: 'pyr', r, c });
  if (g.waste.length) out.push({ kind: 'waste' });
  return out;
}

export function pyrRemove(g: Pyramid, ps: PyrRef[]): Pyramid {
  const n: Pyramid = JSON.parse(JSON.stringify(g));
  for (const p of ps) { if (p.kind === 'waste') n.waste.pop(); else n.rows[p.r][p.c] = null; }
  return n;
}

/** Hợp lệ khi một lá K, hoặc hai lá khác nhau cộng đủ 13 */
export function pyrCanRemove(g: Pyramid, ps: PyrRef[]): boolean {
  const cards = ps.map((p) => pyrCard(g, p));
  if (cards.some((c) => !c)) return false;
  if (ps.length === 1) return (cards[0] as Card).r === 13;
  if (ps.length !== 2) return false;
  const [a, b] = ps;
  if (a.kind === b.kind && (a.kind === 'waste' || (a.kind === 'pyr' && b.kind === 'pyr' && a.r === b.r && a.c === b.c))) return false;
  return (cards[0] as Card).r + (cards[1] as Card).r === 13;
}

export const pyrDraw = (g: Pyramid): Pyramid => {
  const n: Pyramid = JSON.parse(JSON.stringify(g));
  if (n.stock.length) n.waste.push(n.stock.pop() as Card);
  else if (n.recycles > 0 && n.waste.length) { n.stock = n.waste.reverse(); n.waste = []; n.recycles--; }
  return n;
};
export const pyrCanDraw = (g: Pyramid): boolean => g.stock.length > 0 || (g.recycles > 0 && g.waste.length > 0);
export const pyrWon = (g: Pyramid): boolean => g.rows.every((r) => r.every((c) => !c));

/** Gợi ý: một nước gỡ (1 hoặc 2 lá) nếu có, ngược lại null (khi đó nên rút bài) */
export function pyrHint(g: Pyramid): PyrRef[] | null {
  const open = pyrOpen(g);
  for (const p of open) if (pyrCanRemove(g, [p])) return [p];
  for (let i = 0; i < open.length; i++) for (let j = i + 1; j < open.length; j++) if (pyrCanRemove(g, [open[i], open[j]])) return [open[i], open[j]];
  return null;
}
export const pyrStuck = (g: Pyramid): boolean => !pyrWon(g) && !pyrHint(g) && !pyrCanDraw(g);

/* ===================== TriPeaks và Golf (nối ±1) ===================== */
export type ChainKind = 'tripeaks' | 'golf';
export interface ChainCard { card: Card; gone: boolean; x: number; y: number; cover: number[] }
export interface Chain { kind: ChainKind; cards: ChainCard[]; stock: Card[]; waste: Card[]; wrap: boolean }

/** Cho phép nối K với A ở các cấp dễ; số lá rút giảm dần (và Golf thêm cột) khiến khó hơn */
export const CHAIN_WRAP = (kind: ChainKind, level: number): boolean => level <= (kind === 'golf' ? 6 : 5);
/** Golf: số cột bài theo cấp (ít cột = dễ) */
export const GOLF_COLS = [4, 4, 5, 5, 6, 6, 7, 7, 7, 7];
export const CHAIN_STOCK = (kind: ChainKind, level: number): number => (kind === 'tripeaks' ? [23, 23, 23, 23, 22, 22, 21, 21, 20, 20] : [30, 30, 25, 25, 20, 20, 17, 17, 17, 16])[Math.min(10, Math.max(1, level)) - 1];

export function dealChain(kind: ChainKind, level: number, rand?: () => number): Chain {
  const d = shuffle(deck(), rand).map((c) => ({ ...c, up: true }));
  const cards: ChainCard[] = [];
  if (kind === 'tripeaks') {
    const rowsX = [[3, 9, 15], [2, 4, 8, 10, 14, 16], [1, 3, 5, 7, 9, 11, 13, 15, 17], [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]];
    const idx = new Map<string, number>();
    rowsX.forEach((xs, r) => xs.forEach((x) => { idx.set(`${r},${x}`, cards.length); cards.push({ card: d.pop() as Card, gone: false, x, y: r, cover: [] }); }));
    cards.forEach((c) => {
      if (c.y < 3) c.cover = [idx.get(`${c.y + 1},${c.x - 1}`), idx.get(`${c.y + 1},${c.x + 1}`)].filter((v): v is number => v !== undefined);
    });
  } else {
    const cols = GOLF_COLS[Math.min(10, Math.max(1, level)) - 1];
    for (let col = 0; col < cols; col++) for (let k = 0; k < 5; k++) {
      const i = cards.length;
      cards.push({ card: d.pop() as Card, gone: false, x: col, y: k, cover: k < 4 ? [i + 1] : [] });
    }
  }
  const stock = d.splice(0, CHAIN_STOCK(kind, level));
  const first = stock.pop() as Card;
  return { kind, cards, stock, waste: [first], wrap: CHAIN_WRAP(kind, level) };
}

export const chainFree = (g: Chain, i: number): boolean => !g.cards[i].gone && g.cards[i].cover.every((j) => g.cards[j].gone);
export const chainLink = (g: Chain, r: number, s: number): boolean => {
  const d = Math.abs(r - s);
  return d === 1 || (g.wrap && d === 12);
};
export const chainCanPlay = (g: Chain, i: number): boolean => chainFree(g, i) && chainLink(g, g.cards[i].card.r, g.waste[g.waste.length - 1].r);
export function chainPlay(g: Chain, i: number): Chain {
  const n: Chain = JSON.parse(JSON.stringify(g));
  n.cards[i].gone = true;
  n.waste.push(n.cards[i].card);
  return n;
}
export const chainDraw = (g: Chain): Chain => {
  const n: Chain = JSON.parse(JSON.stringify(g));
  if (n.stock.length) n.waste.push(n.stock.pop() as Card);
  return n;
};
export const chainWon = (g: Chain): boolean => g.cards.every((c) => c.gone);
export const chainHint = (g: Chain): number => g.cards.findIndex((_, i) => chainCanPlay(g, i));
export const chainStuck = (g: Chain): boolean => !chainWon(g) && g.stock.length === 0 && chainHint(g) < 0;
