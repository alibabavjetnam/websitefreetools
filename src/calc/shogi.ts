/** Shogi (cờ shogi Nhật) đầy đủ luật chính: thả quân, thăng cấp, cấm 2 tốt cùng cột (nifu). Bỏ qua cấm thả tốt chiếu bí và luật lặp 4 lần. */
import { MATE, searchBest, type SearchGame } from './search';

/** 1 P, 2 L, 3 N, 4 S, 5 G, 6 B, 7 R, 8 K, +8: 9 と, 10 成香, 11 成桂, 12 成銀, 13 馬, 14 龍. Dương = bên người (dưới), âm = máy (trên). */
export const KANJI = ['', '歩', '香', '桂', '銀', '金', '角', '飛', '玉', 'と', '杏', '圭', '全', '馬', '竜'];
const VAL = [0, 100, 300, 320, 450, 500, 850, 1000, 0, 420, 460, 460, 480, 1000, 1250];
const baseOf = (t: number): number => (t === 9 ? 1 : t === 10 ? 2 : t === 11 ? 3 : t === 12 ? 4 : t === 13 ? 6 : t === 14 ? 7 : t);
const promOf = (t: number): number => (t >= 1 && t <= 7 && t !== 5 ? t + 8 : t);
const GOLD_LIKE = new Set([5, 9, 10, 11, 12]);

export interface Move { from: number; to: number; type: number; promote: boolean; cap: number; orig: number }
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]], ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export class Shogi {
  b = new Int8Array(81);
  hand: number[][] = [new Array(8).fill(0), new Array(8).fill(0)]; // [0] = bên người, [1] = máy; chỉ số 1..7
  turn = 1;
  plies = 0;
  constructor() {
    const back = [2, 3, 4, 5, 8, 5, 4, 3, 2];
    for (let c = 0; c < 9; c++) { this.b[c] = -back[c]; this.b[72 + c] = back[c]; this.b[18 + c] = -1; this.b[54 + c] = 1; }
    this.b[9 + 1] = -7; this.b[9 + 7] = -6; this.b[63 + 1] = 6; this.b[63 + 7] = 7;
  }
  private hi = (side: number): number => (side === 1 ? 0 : 1);

  /** Các ô quân t của bên side có thể đi tới (chưa lọc tự chiếu) */
  private targets(i: number, t: number, side: number): number[] {
    const r = i / 9 | 0, c = i % 9, f = side === 1 ? -1 : 1, out: number[] = [];
    const add = (rr: number, cc: number): boolean => {
      if (rr < 0 || rr > 8 || cc < 0 || cc > 8) return false;
      const v = this.b[rr * 9 + cc];
      if (v * side > 0) return false;
      out.push(rr * 9 + cc);
      return v === 0;
    };
    const slide = (dr: number, dc: number) => { let rr = r + dr, cc = c + dc; while (add(rr, cc)) { rr += dr; cc += dc; } };
    const step = (dr: number, dc: number) => { add(r + dr, c + dc); };
    if (t === 1) step(f, 0);
    else if (t === 2) slide(f, 0);
    else if (t === 3) { step(2 * f, -1); step(2 * f, 1); }
    else if (t === 4) { step(f, -1); step(f, 0); step(f, 1); step(-f, -1); step(-f, 1); }
    else if (GOLD_LIKE.has(t)) { step(f, -1); step(f, 0); step(f, 1); step(0, -1); step(0, 1); step(-f, 0); }
    else if (t === 6 || t === 13) { for (const [a, d] of DIAG) slide(a, d); if (t === 13) for (const [a, d] of ORTH) step(a, d); }
    else if (t === 7 || t === 14) { for (const [a, d] of ORTH) slide(a, d); if (t === 14) for (const [a, d] of DIAG) step(a, d); }
    else if (t === 8) { for (const [a, d] of [...DIAG, ...ORTH]) step(a, d); }
    return out;
  }
  private zone(i: number, side: number): boolean { const r = i / 9 | 0; return side === 1 ? r <= 2 : r >= 6; }
  private lastRows(to: number, t: number, side: number): boolean {
    const r = to / 9 | 0, far = side === 1 ? r : 8 - r;
    return (t === 1 || t === 2) ? far === 0 : t === 3 ? far <= 1 : false;
  }
  kingSq(side: number): number { return this.b.indexOf(side * 8); }
  /** Ô sq có bị bên by tấn công không */
  attacked(sq: number, by: number): boolean {
    for (let i = 0; i < 81; i++) {
      const v = this.b[i];
      if (!v || v * by < 0) continue;
      if (this.targets(i, Math.abs(v), by).includes(sq)) return true;
    }
    return false;
  }
  inCheck(side: number): boolean { const k = this.kingSq(side); return k >= 0 && this.attacked(k, -side); }

  private pseudo(): Move[] {
    const side = this.turn, res: Move[] = [];
    for (let i = 0; i < 81; i++) {
      const v = this.b[i];
      if (!v || v * side < 0) continue;
      const t = Math.abs(v);
      for (const to of this.targets(i, t, side)) {
        const cap = this.b[to];
        const canProm = t <= 7 && t !== 5 && (this.zone(i, side) || this.zone(to, side));
        const forced = this.lastRows(to, t, side);
        if (!forced) res.push({ from: i, to, type: t, promote: false, cap, orig: v });
        if (canProm) res.push({ from: i, to, type: t, promote: true, cap, orig: v });
      }
    }
    const h = this.hand[this.hi(side)];
    for (let t = 1; t <= 7; t++) {
      if (!h[t]) continue;
      let pawnCols: Set<number> | null = null;
      if (t === 1) { pawnCols = new Set(); for (let i = 0; i < 81; i++) if (this.b[i] === side) pawnCols.add(i % 9); }
      for (let to = 0; to < 81; to++) {
        if (this.b[to] || this.lastRows(to, t, side)) continue;
        if (pawnCols && pawnCols.has(to % 9)) continue;
        res.push({ from: -1, to, type: t, promote: false, cap: 0, orig: 0 });
      }
    }
    return res;
  }
  legalMoves(): Move[] {
    const side = this.turn, out: Move[] = [];
    for (const m of this.pseudo()) {
      this.makeMove(m);
      const bad = this.inCheck(side);
      this.unmakeMove(m);
      if (!bad) out.push(m);
    }
    return out;
  }
  makeMove(m: Move): void {
    const side = this.turn, hs = this.hand[this.hi(side)];
    if (m.from < 0) { this.b[m.to] = side * m.type; hs[m.type]--; }
    else {
      this.b[m.from] = 0;
      this.b[m.to] = side * (m.promote ? promOf(m.type) : m.type);
      if (m.cap) hs[baseOf(Math.abs(m.cap))]++;
    }
    this.turn = -side; this.plies++;
  }
  unmakeMove(m: Move): void {
    const side = -this.turn, hs = this.hand[this.hi(side)];
    if (m.from < 0) { this.b[m.to] = 0; hs[m.type]++; }
    else {
      this.b[m.to] = m.cap; this.b[m.from] = m.orig;
      if (m.cap) hs[baseOf(Math.abs(m.cap))]--;
    }
    this.turn = side; this.plies--;
  }
  /** 'play' | 'lost' (bên đang đến lượt hết nước = bị chiếu bí) | 'draw' (quá dài) */
  status(): 'play' | 'lost' | 'draw' {
    if (!this.legalMoves().length) return 'lost';
    if (this.plies >= 400) return 'draw';
    return 'play';
  }
}

export const SHOGI_LEVELS: { depth: number; timeMs: number; noise: number; random?: boolean }[] = [
  { depth: 1, timeMs: 300, noise: 0, random: true },
  { depth: 1, timeMs: 400, noise: 220 },
  { depth: 2, timeMs: 600, noise: 150 },
  { depth: 2, timeMs: 800, noise: 80 },
  { depth: 3, timeMs: 1000, noise: 50 },
  { depth: 3, timeMs: 1300, noise: 20 },
  { depth: 4, timeMs: 1700, noise: 0 },
  { depth: 4, timeMs: 2200, noise: 0 },
  { depth: 5, timeMs: 2800, noise: 0 },
  { depth: 6, timeMs: 3500, noise: 0 },
];

class Search implements SearchGame<Move> {
  constructor(private g: Shogi) {}
  legalMoves() { return this.g.legalMoves(); }
  makeMove(m: Move) { this.g.makeMove(m); }
  unmakeMove(m: Move) { this.g.unmakeMove(m); }
  isCapture(m: Move) { return m.cap !== 0; }
  moveScore(m: Move) { return (m.cap ? VAL[Math.abs(m.cap)] * 10 - VAL[m.type] : 0) + (m.promote ? 300 : 0); }
  noMovesScore(ply: number) { return -MATE + ply; }
  evaluate() {
    let s = 0;
    const b = this.g.b;
    for (let i = 0; i < 81; i++) {
      const v = b[i];
      if (!v) continue;
      const t = Math.abs(v), side = v > 0 ? 1 : -1, r = i / 9 | 0, c = i % 9;
      let sc = VAL[t];
      if (t === 1 || t === 4 || t === 5) sc += (side === 1 ? 8 - r : r) * 3;
      if (t !== 8 && c >= 3 && c <= 5) sc += 4;
      if (t === 8) sc += (side === 1 ? r : 8 - r) * 6; // vua nên ở hàng nhà
      s += side * sc;
    }
    for (let t = 1; t <= 7; t++) s += (this.g.hand[0][t] - this.g.hand[1][t]) * Math.round(VAL[t] * 1.1);
    return this.g.turn === 1 ? s : -s;
  }
}

export function shogiAiMove(g: Shogi, level: number): Move | null {
  const cfg = SHOGI_LEVELS[Math.min(10, Math.max(1, level)) - 1];
  const legal = g.legalMoves();
  if (!legal.length) return null;
  if (legal.length === 1) return legal[0];
  if (cfg.random) return legal[Math.floor(Math.random() * legal.length)];
  return searchBest(new Search(g), { maxDepth: cfg.depth, timeMs: cfg.timeMs, noise: cfg.noise, quiesce: false }).move;
}

export function perft(g: Shogi, d: number): number {
  if (d === 0) return 1;
  let n = 0;
  for (const m of g.legalMoves()) { g.makeMove(m); n += perft(g, d - 1); g.unmakeMove(m); }
  return n;
}
