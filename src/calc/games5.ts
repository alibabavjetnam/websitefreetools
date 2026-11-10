/**
 * Lõi thuần đợt 5: Kalah (Mancala), Rắn & thang, Cờ cối (Nine Men's Morris), Hải chiến (Battleship), Bầu cua,
 * Baccarat, Bingo, Yahtzee, Bài 8 lá (Crazy Eights), Bài cào. Không phụ thuộc DOM.
 */
import { deck, shuffle, type Card } from './solitaire';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const ri = (a: number, b: number): number => a + Math.floor(Math.random() * (b - a + 1));

/* ============================ Kalah ============================ */
export interface Kalah { p: number[]; turn: 0 | 1; over: boolean }
export const KALAH_AI = [{ d: 0, noise: 0 }, { d: 1, noise: 3 }, { d: 2, noise: 2 }, { d: 3, noise: 1 }, { d: 4, noise: 1 }, { d: 5, noise: 0 }, { d: 6, noise: 0 }, { d: 7, noise: 0 }, { d: 9, noise: 0 }, { d: 11, noise: 0 }];
export function kalahNew(first: 0 | 1 = 0): Kalah { const p = Array(14).fill(4); p[6] = 0; p[13] = 0; return { p, turn: first, over: false }; }
export const kalahPits = (turn: 0 | 1): number[] => (turn === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12]);
export const kalahMoves = (s: Kalah): number[] => (s.over ? [] : kalahPits(s.turn).filter((i) => s.p[i] > 0));
/** Chơi ô `i`; trả về trạng thái mới và đường rải (để hoạt hình) */
export function kalahPlay(s: Kalah, i: number): { s: Kalah; path: number[]; captured: boolean; extra: boolean } {
  const p = s.p.slice(), me = s.turn, store = me === 0 ? 6 : 13, opp = me === 0 ? 13 : 6;
  let n = p[i], idx = i; p[i] = 0;
  const path: number[] = [];
  while (n > 0) { idx = (idx + 1) % 14; if (idx === opp) continue; p[idx]++; n--; path.push(idx); }
  const own = (k: number): boolean => (me === 0 ? k <= 5 : k >= 7 && k <= 12);
  let captured = false, extra = false;
  if (idx === store) extra = true;
  else if (own(idx) && p[idx] === 1 && p[12 - idx] > 0) { p[store] += p[12 - idx] + 1; p[idx] = 0; p[12 - idx] = 0; captured = true; }
  const mine = kalahPits(me).every((k) => p[k] === 0), theirs = kalahPits(me === 0 ? 1 : 0).every((k) => p[k] === 0);
  let over = false;
  if (mine || theirs) {
    over = true;
    for (const k of [...kalahPits(0)]) { p[6] += p[k]; p[k] = 0; }
    for (const k of [...kalahPits(1)]) { p[13] += p[k]; p[k] = 0; }
  }
  return { s: { p, turn: extra ? me : me === 0 ? 1 : 0, over }, path, captured, extra };
}
export const kalahWinner = (s: Kalah): 0 | 1 | null => (!s.over ? null : s.p[6] === s.p[13] ? null : s.p[6] > s.p[13] ? 0 : 1);
function kalahSearch(s: Kalah, d: number, a: number, b: number, me: 0 | 1): number {
  if (s.over || d === 0) return s.p[me === 0 ? 6 : 13] - s.p[me === 0 ? 13 : 6];
  const ms = kalahMoves(s).reverse();
  if (s.turn === me) { let best = -1e9; for (const m of ms) { best = Math.max(best, kalahSearch(kalahPlay(s, m).s, d - 1, a, b, me)); a = Math.max(a, best); if (a >= b) break; } return best; }
  let best = 1e9; for (const m of ms) { best = Math.min(best, kalahSearch(kalahPlay(s, m).s, d - 1, a, b, me)); b = Math.min(b, best); if (a >= b) break; } return best;
}
export function kalahAi(s: Kalah, level: number): number {
  const L = KALAH_AI[clamp(level, 1, 10) - 1], ms = kalahMoves(s);
  if (!L.d) return ms[ri(0, ms.length - 1)];
  let bm = ms[0], bv = -1e9;
  for (const m of ms) {
    const r = kalahPlay(s, m);
    let v = r.s.turn === s.turn ? kalahSearch(r.s, L.d - 1, -1e9, 1e9, s.turn) : kalahSearch(r.s, L.d - 1, -1e9, 1e9, s.turn);
    v += (Math.random() - 0.5) * 2 * L.noise;
    if (v > bv) { bv = v; bm = m; }
  }
  return bm;
}

/* ============================ Rắn & thang ============================ */
export interface Snl { snakes: Record<number, number>; ladders: Record<number, number>; pos: number[]; turn: number; exact: boolean; winner: number }
export const slPlayers = (l: number): number => (l <= 3 ? 2 : l <= 7 ? 3 : 4);
export function slNew(level: number): Snl {
  const l = clamp(level, 1, 10), snakes: Record<number, number> = {}, ladders: Record<number, number> = {}, used = new Set<number>([1, 100]);
  const nS = 4 + Math.ceil(l * 0.8), nL = Math.max(4, 9 - Math.floor(l / 2));
  const place = (n: number, up: boolean, into: Record<number, number>): void => {
    let tries = 0;
    while (Object.keys(into).length < n && tries++ < 500) {
      const a = ri(3, 98), len = ri(10, 45), b = up ? a + len : a - len;
      const lo = Math.min(a, b), hi = Math.max(a, b);
      if (hi > 99 || lo < 2 || used.has(a) || used.has(b) || Math.floor((lo - 1) / 10) === Math.floor((hi - 1) / 10)) continue;
      used.add(a); used.add(b); into[a] = b;
    }
  };
  place(nL, true, ladders); place(nS, false, snakes);
  return { snakes, ladders, pos: Array(slPlayers(l)).fill(1), turn: 0, exact: l >= 4, winner: -1 };
}
/** Các ô token đi qua khi tung `roll`, rồi ô đích sau rắn/thang */
export function slMove(s: Snl, who: number, roll: number): { steps: number[]; end: number; jump: number } {
  const from = s.pos[who], steps: number[] = [];
  let to = from + roll;
  if (to > 100) { if (s.exact) return { steps: [], end: from, jump: from }; to = 100; }
  for (let k = from + 1; k <= to; k++) steps.push(k);
  const jump = s.snakes[to] ?? s.ladders[to] ?? to;
  return { steps, end: to, jump };
}
/** Số hàng/cột của ô `n` (1..100) trên bàn đi theo kiểu rắn; hàng 0 ở dưới cùng */
export function slCell(n: number): { r: number; c: number } {
  const r = Math.floor((n - 1) / 10), k = (n - 1) % 10;
  return { r, c: r % 2 === 0 ? k : 9 - k };
}

/* ============================ Cờ cối (Nine Men's Morris) ============================ */
export const NMM_ADJ: number[][] = [
  [1, 9], [0, 2, 4], [1, 14], [4, 10], [1, 3, 5, 7], [4, 13], [7, 11], [4, 6, 8], [7, 12],
  [0, 10, 21], [3, 9, 11, 18], [6, 10, 15], [8, 13, 17], [5, 12, 14, 20], [2, 13, 23], [11, 16], [15, 17, 19], [12, 16],
  [10, 19], [16, 18, 20, 22], [13, 19], [9, 22], [19, 21, 23], [14, 22],
];
export const NMM_MILLS: number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14], [15, 16, 17], [18, 19, 20], [21, 22, 23],
  [0, 9, 21], [3, 10, 18], [6, 11, 15], [1, 4, 7], [16, 19, 22], [8, 12, 17], [5, 13, 20], [2, 14, 23],
];
/** Toạ độ lưới 7x7 của 24 điểm (để vẽ) */
export const NMM_XY: [number, number][] = [
  [0, 0], [3, 0], [6, 0], [1, 1], [3, 1], [5, 1], [2, 2], [3, 2], [4, 2],
  [0, 3], [1, 3], [2, 3], [4, 3], [5, 3], [6, 3], [2, 4], [3, 4], [4, 4],
  [1, 5], [3, 5], [5, 5], [0, 6], [3, 6], [6, 6],
];
export interface Nmm { b: number[]; hand: [number, number]; turn: 1 | 2 }
export interface NmmMove { from: number; to: number; remove: number }
export const nmmNew = (): Nmm => ({ b: Array(24).fill(0), hand: [9, 9], turn: 1 });
const inMill = (b: number[], i: number, who: number): boolean => NMM_MILLS.some((m) => m.includes(i) && m.every((k) => b[k] === who));
const count = (s: Nmm, who: 1 | 2): number => s.b.filter((v) => v === who).length + s.hand[who - 1];
export function nmmMoves(s: Nmm): NmmMove[] {
  const me = s.turn, opp = me === 1 ? 2 : 1, out: NmmMove[] = [];
  const finish = (from: number, to: number): void => {
    const b = s.b.slice(); if (from >= 0) b[from] = 0; b[to] = me;
    if (inMill(b, to, me)) {
      const oppPieces = b.map((v, i) => (v === opp ? i : -1)).filter((i) => i >= 0);
      const free = oppPieces.filter((i) => !inMill(b, i, opp));
      for (const r of free.length ? free : oppPieces) out.push({ from, to, remove: r });
    } else out.push({ from, to, remove: -1 });
  };
  if (s.hand[me - 1] > 0) { for (let i = 0; i < 24; i++) if (!s.b[i]) finish(-1, i); return out; }
  const mine = s.b.map((v, i) => (v === me ? i : -1)).filter((i) => i >= 0), fly = mine.length === 3;
  for (const f of mine) for (const to of fly ? s.b.map((_, i) => i) : NMM_ADJ[f]) if (!s.b[to]) finish(f, to);
  return out;
}
export function nmmApply(s: Nmm, m: NmmMove): Nmm {
  const b = s.b.slice(), hand: [number, number] = [s.hand[0], s.hand[1]];
  if (m.from >= 0) b[m.from] = 0; else hand[s.turn - 1]--;
  b[m.to] = s.turn; if (m.remove >= 0) b[m.remove] = 0;
  return { b, hand, turn: s.turn === 1 ? 2 : 1 };
}
/** Người thắng (1/2) hoặc 0 nếu chưa phân thắng bại */
export function nmmWinner(s: Nmm): 0 | 1 | 2 {
  for (const who of [1, 2] as const) {
    const placed = s.hand[who - 1] === 0;
    if (placed && count(s, who) < 3) return who === 1 ? 2 : 1;
  }
  if (nmmMoves(s).length === 0) return s.turn === 1 ? 2 : 1;
  return 0;
}
function nmmEval(s: Nmm, me: 1 | 2): number {
  const opp = me === 1 ? 2 : 1;
  let v = (count(s, me) - count(s, opp)) * 30;
  for (const m of NMM_MILLS) { const a = m.filter((k) => s.b[k] === me).length, o = m.filter((k) => s.b[k] === opp).length; if (!o) v += a * a * 2; if (!a) v -= o * o * 2; }
  const mob = (w: 1 | 2): number => s.b.reduce((n, x, i) => n + (x === w ? NMM_ADJ[i].filter((k) => !s.b[k]).length : 0), 0);
  return v + (mob(me) - mob(opp)) * 2;
}
function nmmSearch(s: Nmm, d: number, a: number, b: number, me: 1 | 2): number {
  const w = nmmWinner(s);
  if (w) return w === me ? 10000 + d : -10000 - d;
  if (d === 0) return nmmEval(s, me);
  const ms = nmmMoves(s);
  if (s.turn === me) { let best = -1e9; for (const m of ms) { best = Math.max(best, nmmSearch(nmmApply(s, m), d - 1, a, b, me)); a = Math.max(a, best); if (a >= b) break; } return best; }
  let best = 1e9; for (const m of ms) { best = Math.min(best, nmmSearch(nmmApply(s, m), d - 1, a, b, me)); b = Math.min(b, best); if (a >= b) break; } return best;
}
export const NMM_AI = [{ d: 0, n: 0 }, { d: 1, n: 25 }, { d: 1, n: 8 }, { d: 2, n: 8 }, { d: 2, n: 2 }, { d: 3, n: 4 }, { d: 3, n: 0 }, { d: 4, n: 2 }, { d: 4, n: 0 }, { d: 5, n: 0 }];
export function nmmAi(s: Nmm, level: number): NmmMove {
  const L = NMM_AI[clamp(level, 1, 10) - 1], ms = nmmMoves(s);
  if (!L.d) return ms[ri(0, ms.length - 1)];
  let best = ms[0], bv = -1e9;
  for (const m of ms) { const v = nmmSearch(nmmApply(s, m), L.d - 1, -1e9, 1e9, s.turn) + (Math.random() - 0.5) * 2 * L.n; if (v > bv) { bv = v; best = m; } }
  return best;
}

/* ============================ Hải chiến ============================ */
export const BS_N = 10, BS_SHIPS = [5, 4, 3, 3, 2];
export interface BsShip { cells: number[]; len: number }
export interface BsBoard { ships: BsShip[]; shots: Record<number, 'miss' | 'hit'> }
export function bsNew(): BsBoard {
  const ships: BsShip[] = [], used = new Set<number>();
  for (const len of BS_SHIPS) {
    for (let t = 0; t < 1000; t++) {
      const h = Math.random() < 0.5, r = ri(0, h ? BS_N - 1 : BS_N - len), c = ri(0, h ? BS_N - len : BS_N - 1);
      const cells = Array.from({ length: len }, (_, k) => (h ? r * BS_N + c + k : (r + k) * BS_N + c));
      if (cells.some((x) => used.has(x))) continue;
      cells.forEach((x) => used.add(x)); ships.push({ cells, len }); break;
    }
  }
  return { ships, shots: {} };
}
export const bsSunk = (b: BsBoard, sh: BsShip): boolean => sh.cells.every((c) => b.shots[c] === 'hit');
export const bsAllSunk = (b: BsBoard): boolean => b.ships.every((s) => bsSunk(b, s));
export function bsShoot(b: BsBoard, i: number): { res: 'miss' | 'hit' | 'sunk'; ship?: BsShip } | null {
  if (b.shots[i]) return null;
  const sh = b.ships.find((s) => s.cells.includes(i));
  if (!sh) { b.shots[i] = 'miss'; return { res: 'miss' }; }
  b.shots[i] = 'hit';
  return bsSunk(b, sh) ? { res: 'sunk', ship: sh } : { res: 'hit' };
}
/** Máy chọn ô bắn tiếp. skill 1..10 */
export function bsAiPick(b: BsBoard, skill: number): number {
  const free: number[] = []; for (let i = 0; i < BS_N * BS_N; i++) if (!b.shots[i]) free.push(i);
  const rnd = (): number => free[ri(0, free.length - 1)];
  const sunkCells = new Set(b.ships.filter((s) => bsSunk(b, s)).flatMap((s) => s.cells));
  const live = Object.keys(b.shots).map(Number).filter((i) => b.shots[i] === 'hit' && !sunkCells.has(i));
  const smart = skill >= 2 && Math.random() < Math.min(1, 0.35 + skill * 0.08);
  if (skill === 1 || (!smart && !live.length)) return rnd();
  const around = (i: number): number[] => { const r = Math.floor(i / BS_N), c = i % BS_N, o: number[] = []; if (r > 0) o.push(i - BS_N); if (r < BS_N - 1) o.push(i + BS_N); if (c > 0) o.push(i - 1); if (c < BS_N - 1) o.push(i + 1); return o.filter((k) => !b.shots[k]); };
  if (live.length && (smart || skill >= 2)) {
    if (skill >= 4 && live.length >= 2) {
      const s = live.slice().sort((x, y) => x - y), dr = Math.floor(s[1] / BS_N) === Math.floor(s[0] / BS_N) ? 1 : BS_N;
      const ends = [s[0] - dr, s[s.length - 1] + dr].filter((k) => k >= 0 && k < BS_N * BS_N && !b.shots[k] && (dr === BS_N || Math.floor(k / BS_N) === Math.floor(s[0] / BS_N)));
      if (ends.length) return ends[ri(0, ends.length - 1)];
    }
    const cand = live.flatMap(around);
    if (cand.length) return cand[ri(0, cand.length - 1)];
  }
  if (skill < 4) return rnd();
  // mật độ xác suất của các tàu còn lại
  const remaining = b.ships.filter((s) => !bsSunk(b, s)).map((s) => s.len);
  const dens = new Float64Array(BS_N * BS_N);
  for (const len of remaining) for (let r = 0; r < BS_N; r++) for (let c = 0; c < BS_N; c++) for (const h of [true, false]) {
    if (h ? c + len > BS_N : r + len > BS_N) continue;
    const cells = Array.from({ length: len }, (_, k) => (h ? r * BS_N + c + k : (r + k) * BS_N + c + 0));
    if (cells.some((x) => b.shots[x] === 'miss' || sunkCells.has(x))) continue;
    for (const x of cells) if (!b.shots[x]) dens[x] += 1;
  }
  let best = -1, bi = rnd();
  for (const i of free) { const v = dens[i] + (skill < 7 ? Math.random() * 3 : Math.random() * 0.2) + (skill >= 6 && (Math.floor(i / BS_N) + (i % BS_N)) % 2 === 0 ? 0.5 : 0); if (v > best) { best = v; bi = i; } }
  return bi;
}

/* ============================ Bầu cua ============================ */
export const BC_SYMBOLS = ['🎃', '🦀', '🦐', '🐟', '🐓', '🦌'];
export const BC_START = 300;
export const BC_LEVELS = Array.from({ length: 10 }, (_, i) => ({ target: Math.round(BC_START * [1.3, 1.5, 1.7, 2, 2.3, 2.7, 3.2, 3.8, 4.5, 5.5][i] / 10) * 10, rounds: [10, 10, 10, 12, 12, 12, 14, 14, 16, 18][i], minBet: 10 }));
export const bcRoll = (): number[] => [ri(0, 5), ri(0, 5), ri(0, 5)];
/** Tiền nhận lại (gồm cả tiền cược) cho các cửa đã đặt */
export function bcPayout(bets: number[], dice: number[]): number {
  let back = 0;
  for (let s = 0; s < 6; s++) { const m = dice.filter((d) => d === s).length; if (bets[s] && m) back += bets[s] * (m + 1); }
  return back;
}

/* ============================ Baccarat ============================ */
export const bacVal = (c: Card): number => (c.r >= 10 ? 0 : c.r);
export const bacTotal = (cs: Card[]): number => cs.reduce((a, c) => a + bacVal(c), 0) % 10;
export interface BacHand { player: Card[]; banker: Card[]; result: 'P' | 'B' | 'T' }
export function bacDeal(shoe: Card[]): BacHand {
  const player = [shoe.pop() as Card, shoe.pop() as Card], banker = [shoe.pop() as Card, shoe.pop() as Card];
  const pt = bacTotal(player), bt = bacTotal(banker);
  if (pt < 8 && bt < 8) {
    let p3: Card | null = null;
    if (pt <= 5) { p3 = shoe.pop() as Card; player.push(p3); }
    const v = p3 ? bacVal(p3) : -1;
    const bd = ((): boolean => {
      const b = bacTotal(banker);
      if (!p3) return b <= 5;
      if (b <= 2) return true; if (b === 3) return v !== 8; if (b === 4) return v >= 2 && v <= 7; if (b === 5) return v >= 4 && v <= 7; if (b === 6) return v === 6 || v === 7; return false;
    })();
    if (bd) banker.push(shoe.pop() as Card);
  }
  const p = bacTotal(player), b = bacTotal(banker);
  return { player, banker, result: p > b ? 'P' : b > p ? 'B' : 'T' };
}
/** Tiền nhận lại (gồm cược) cho cược `bet` vào cửa `side` */
export function bacPayout(side: 'P' | 'B' | 'T', bet: number, r: 'P' | 'B' | 'T'): number {
  if (r === 'T') return side === 'T' ? bet * 9 : bet;
  if (side !== r) return 0;
  return side === 'P' ? bet * 2 : Math.floor(bet * 1.95);
}
export const COIN_LEVELS = (start: number, mult: number[], rounds: number[]) => mult.map((m, i) => ({ target: Math.round((start * m) / 10) * 10, rounds: rounds[i], minBet: 10 }));
export const BAC_START = 500;
export const BAC_LEVELS = COIN_LEVELS(BAC_START, [1.2, 1.35, 1.5, 1.7, 1.9, 2.2, 2.5, 3, 3.6, 4.5], [10, 10, 10, 12, 12, 14, 14, 16, 18, 20]);
export const newBacShoe = (): Card[] => shuffle([...deck(), ...deck(), ...deck(), ...deck(), ...deck(), ...deck()].map((c, i) => ({ ...c, id: i, up: true })));

/* ============================ Bingo ============================ */
export interface BingoCfg { every: number; ais: number }
export const bingoCfg = (l: number): BingoCfg => ({ every: Math.round(4600 - clamp(l, 1, 10) * 300), ais: clamp(Math.ceil(l / 2.5), 1, 4) });
export function bingoCard(): number[] {
  const cols = [0, 1, 2, 3, 4].map((c) => shuffle(Array.from({ length: 15 }, (_, i) => c * 15 + i + 1)).slice(0, 5));
  const card: number[] = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) card.push(r === 2 && c === 2 ? 0 : cols[c][r]);
  return card; // 0 = ô miễn phí
}
export const BINGO_LINES: number[][] = [
  ...[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => r * 5 + c)),
  ...[0, 1, 2, 3, 4].map((c) => [0, 1, 2, 3, 4].map((r) => r * 5 + c)),
  [0, 6, 12, 18, 24], [4, 8, 12, 16, 20],
];
export const bingoHasLine = (card: number[], marked: Set<number>): boolean => BINGO_LINES.some((ln) => ln.every((i) => card[i] === 0 || marked.has(card[i])));
/** Lượt gọi (1-based) mà thẻ của máy hoàn thành hàng đầu tiên, theo dãy số gọi */
export function bingoCompleteAt(card: number[], calls: number[]): number {
  const at = new Map(calls.map((n, i) => [n, i + 1]));
  let best = 1e9;
  for (const ln of BINGO_LINES) { let m = 0; for (const i of ln) if (card[i] !== 0) m = Math.max(m, at.get(card[i]) ?? 1e9); best = Math.min(best, m); }
  return best;
}

/* ============================ Yahtzee ============================ */
export const Y_CATS = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes', 'three', 'four', 'full', 'small', 'large', 'yahtzee', 'chance'] as const;
export type YCat = (typeof Y_CATS)[number];
export const Y_TARGETS = [110, 130, 150, 170, 190, 205, 220, 235, 250, 265];
export function yScore(cat: YCat, d: number[]): number {
  const cnt = [0, 0, 0, 0, 0, 0, 0]; d.forEach((v) => cnt[v]++);
  const sum = d.reduce((a, b) => a + b, 0), mx = Math.max(...cnt), uniq = new Set(d);
  const has = (a: number[]): boolean => a.every((v) => uniq.has(v));
  switch (cat) {
    case 'ones': case 'twos': case 'threes': case 'fours': case 'fives': case 'sixes': { const n = Y_CATS.indexOf(cat) + 1; return cnt[n] * n; }
    case 'three': return mx >= 3 ? sum : 0;
    case 'four': return mx >= 4 ? sum : 0;
    case 'full': return cnt.includes(3) && cnt.includes(2) ? 25 : mx === 5 ? 25 : 0;
    case 'small': return has([1, 2, 3, 4]) || has([2, 3, 4, 5]) || has([3, 4, 5, 6]) ? 30 : 0;
    case 'large': return has([1, 2, 3, 4, 5]) || has([2, 3, 4, 5, 6]) ? 40 : 0;
    case 'yahtzee': return mx === 5 ? 50 : 0;
    default: return sum;
  }
}
export function yTotal(scores: Partial<Record<YCat, number>>): { upper: number; bonus: number; total: number } {
  const upper = Y_CATS.slice(0, 6).reduce((a, c) => a + (scores[c] ?? 0), 0), bonus = upper >= 63 ? 35 : 0;
  return { upper, bonus, total: Y_CATS.reduce((a, c) => a + (scores[c] ?? 0), 0) + bonus };
}

/* ============================ Bài 8 lá (Crazy Eights) ============================ */
export interface Crazy { hands: Card[][]; draw: Card[]; pile: Card[]; suit: number; turn: number; winner: number; n: number }
export const crazyPlayers = (l: number): number => (l <= 3 ? 2 : l <= 6 ? 3 : 4);
export function crazyNew(level: number): Crazy {
  const n = crazyPlayers(level), d = shuffle(deck().map((c) => ({ ...c, up: true })));
  const hands: Card[][] = Array.from({ length: n }, () => d.splice(0, n === 2 ? 7 : 5));
  let top = d.pop() as Card;
  while (top.r === 8) { d.unshift(top); top = d.pop() as Card; }
  return { hands, draw: d, pile: [top], suit: top.s, turn: 0, winner: -1, n };
}
export const crazyCanPlay = (g: Crazy, c: Card): boolean => c.r === 8 || c.s === g.suit || c.r === g.pile[g.pile.length - 1].r;
export function crazyPlay(g: Crazy, who: number, c: Card, suit: number): void {
  g.hands[who] = g.hands[who].filter((x) => x.id !== c.id); g.pile.push(c); g.suit = c.r === 8 ? suit : c.s;
  if (!g.hands[who].length) g.winner = who; else g.turn = (who + 1) % g.n;
}
export function crazyDraw(g: Crazy, who: number): Card | null {
  if (!g.draw.length) { const top = g.pile.pop() as Card; g.draw = shuffle(g.pile); g.pile = [top]; }
  const c = g.draw.pop() ?? null; if (c) g.hands[who].push(c); return c;
}
export function crazyAiChoose(g: Crazy, who: number, level: number): { card: Card; suit: number } | null {
  const h = g.hands[who], ok = h.filter((c) => crazyCanPlay(g, c));
  if (!ok.length) return null;
  const pickSuit = (rest: Card[]): number => { const k = [0, 0, 0, 0]; rest.forEach((c) => k[c.s]++); return k.indexOf(Math.max(...k)); };
  let card: Card;
  if (level < 4) card = ok[ri(0, ok.length - 1)];
  else { const non8 = ok.filter((c) => c.r !== 8); const pool = non8.length ? non8 : ok; card = pool.slice().sort((a, b) => b.r - a.r)[0]; if (level >= 7) { const k = [0, 0, 0, 0]; h.forEach((c) => k[c.s]++); card = pool.slice().sort((a, b) => k[b.s] - k[a.s] || b.r - a.r)[0]; } }
  return { card, suit: pickSuit(h.filter((c) => c.id !== card.id)) };
}

/* ============================ Bài cào ============================ */
export interface CaoRank { tier: number; pts: number; label: 'sap' | 'ba-tien' | 'pts' }
export function caoRank(cs: Card[]): CaoRank {
  if (cs.every((c) => c.r === cs[0].r)) return { tier: 2, pts: cs[0].r, label: 'sap' };
  if (cs.every((c) => c.r >= 11)) return { tier: 1, pts: 0, label: 'ba-tien' };
  const pts = cs.reduce((a, c) => a + (c.r >= 10 ? 10 : c.r), 0) % 10;
  return { tier: 0, pts, label: 'pts' };
}
export function caoCompare(p: Card[], d: Card[], dealerWinsTie: boolean): 'win' | 'lose' | 'tie' {
  const a = caoRank(p), b = caoRank(d);
  if (a.tier !== b.tier) return a.tier > b.tier ? 'win' : 'lose';
  if (a.pts !== b.pts) return a.pts > b.pts ? 'win' : 'lose';
  return dealerWinsTie ? 'lose' : 'tie';
}
export const CAO_START = 500;
export const CAO_LEVELS = COIN_LEVELS(CAO_START, [1.25, 1.4, 1.6, 1.8, 2.05, 2.4, 2.8, 3.3, 4, 5], [10, 10, 12, 12, 14, 14, 16, 16, 18, 20]);
export const caoDealerTie = (l: number): boolean => l >= 6;
