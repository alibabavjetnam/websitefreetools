/**
 * Lõi ba trò cờ hai người với máy (thuần): Cờ caro (5 liên tiếp, bàn 15×15), Reversi 8×8, Nối 4 (7×6).
 * Quân: 1 = người chơi (đi trước), -1 = máy, 0 = trống.
 */

export interface AiLevel { depth: number; noise: number; random?: boolean }
/** Cấp 1 đi ngẫu nhiên; tăng dần độ sâu, giảm dần nhiễu */
export const BOARD_AI_LEVELS: AiLevel[] = [
  { depth: 1, noise: 1, random: true }, { depth: 1, noise: 0.6 }, { depth: 1, noise: 0.35 }, { depth: 2, noise: 0.3 },
  { depth: 2, noise: 0.15 }, { depth: 3, noise: 0.1 }, { depth: 3, noise: 0.04 }, { depth: 4, noise: 0.02 },
  { depth: 5, noise: 0 }, { depth: 6, noise: 0 },
];

/* ============================== Nối 4 ============================== */
export const C4_COLS = 7, C4_ROWS = 6;
export class Connect4 {
  b = new Int8Array(C4_COLS * C4_ROWS);
  turn = 1; moves = 0;
  dropRow(c: number): number {
    for (let r = C4_ROWS - 1; r >= 0; r--) if (!this.b[r * C4_COLS + c]) return r;
    return -1;
  }
  legal(): number[] { const out: number[] = []; for (const c of [3, 2, 4, 1, 5, 0, 6]) if (!this.b[c]) out.push(c); return out; }
  play(c: number): number { const r = this.dropRow(c); this.b[r * C4_COLS + c] = this.turn; this.turn = -this.turn; this.moves++; return r; }
  undo(c: number): void { for (let r = 0; r < C4_ROWS; r++) if (this.b[r * C4_COLS + c]) { this.b[r * C4_COLS + c] = 0; break; } this.turn = -this.turn; this.moves--; }
  /** Trả về [người thắng, các ô thắng] nếu có */
  winner(): { who: number; cells: number[] } | null {
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let r = 0; r < C4_ROWS; r++) for (let c = 0; c < C4_COLS; c++) {
      const v = this.b[r * C4_COLS + c];
      if (!v) continue;
      for (const [dr, dc] of dirs) {
        const cells = [r * C4_COLS + c];
        for (let k = 1; k < 4; k++) {
          const rr = r + dr * k, cc = c + dc * k;
          if (rr < 0 || rr >= C4_ROWS || cc < 0 || cc >= C4_COLS || this.b[rr * C4_COLS + cc] !== v) break;
          cells.push(rr * C4_COLS + cc);
        }
        if (cells.length === 4) return { who: v, cells };
      }
    }
    return null;
  }
  full(): boolean { return this.moves >= C4_COLS * C4_ROWS; }
  /** Điểm thế cờ theo góc nhìn người đi `side` */
  evaluate(side: number): number {
    let s = 0;
    const lines: number[][] = [];
    for (let r = 0; r < C4_ROWS; r++) for (let c = 0; c < C4_COLS; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const er = r + dr * 3, ec = c + dc * 3;
      if (er < 0 || er >= C4_ROWS || ec < 0 || ec >= C4_COLS) continue;
      lines.push([0, 1, 2, 3].map((k) => (r + dr * k) * C4_COLS + c + dc * k));
    }
    for (const ln of lines) {
      let mine = 0, theirs = 0;
      for (const i of ln) { if (this.b[i] === side) mine++; else if (this.b[i] === -side) theirs++; }
      if (mine && !theirs) s += [0, 1, 6, 40][mine] ?? 0;
      else if (theirs && !mine) s -= [0, 1, 7, 50][theirs] ?? 0;
    }
    for (let r = 0; r < C4_ROWS; r++) { const v = this.b[r * C4_COLS + 3]; if (v === side) s += 3; else if (v === -side) s -= 3; }
    return s;
  }
}

function c4Search(g: Connect4, depth: number, alpha: number, beta: number): number {
  const w = g.winner();
  if (w) return -100000 - depth; // người vừa đi (đối thủ của g.turn) đã thắng
  if (g.full()) return 0;
  if (!depth) return g.evaluate(g.turn);
  let best = -Infinity;
  for (const c of g.legal()) {
    g.play(c);
    const v = -c4Search(g, depth - 1, -beta, -alpha);
    g.undo(c);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

export function connect4Ai(g: Connect4, lv: AiLevel, rand: () => number = Math.random): number {
  const legal = g.legal();
  if (lv.random) return legal[Math.floor(rand() * legal.length)];
  const depth = lv.depth + 1;
  let best = legal[0], bestV = -Infinity;
  for (const c of legal) {
    g.play(c);
    let v = -c4Search(g, depth - 1, -Infinity, Infinity);
    g.undo(c);
    v += (rand() - 0.5) * lv.noise * 200;
    if (v > bestV) { bestV = v; best = c; }
  }
  return best;
}

/* ============================== Reversi ============================== */
const RDIRS = [-9, -8, -7, -1, 1, 7, 8, 9];
export class Reversi {
  b = new Int8Array(64);
  turn = 1;
  constructor() { this.b[27] = -1; this.b[36] = -1; this.b[28] = 1; this.b[35] = 1; }
  clone(): Reversi { const x = new Reversi(); x.b = this.b.slice(); x.turn = this.turn; return x; }
  private flips(i: number, side: number): number[] {
    if (this.b[i]) return [];
    const out: number[] = [];
    const r = i >> 3, c = i & 7;
    for (const d of RDIRS) {
      const dr = d === -9 || d === -8 || d === -7 ? -1 : d === 7 || d === 8 || d === 9 ? 1 : 0;
      const dc = d === -9 || d === -1 || d === 7 ? -1 : d === -7 || d === 1 || d === 9 ? 1 : 0;
      const line: number[] = [];
      let rr = r + dr, cc = c + dc;
      while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && this.b[rr * 8 + cc] === -side) { line.push(rr * 8 + cc); rr += dr; cc += dc; }
      if (line.length && rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && this.b[rr * 8 + cc] === side) out.push(...line);
    }
    return out;
  }
  legal(side = this.turn): number[] { const out: number[] = []; for (let i = 0; i < 64; i++) if (!this.b[i] && this.flips(i, side).length) out.push(i); return out; }
  play(i: number): number[] {
    const f = this.flips(i, this.turn);
    this.b[i] = this.turn;
    for (const j of f) this.b[j] = this.turn;
    this.turn = -this.turn;
    return f;
  }
  pass(): void { this.turn = -this.turn; }
  count(side: number): number { let n = 0; for (const v of this.b) if (v === side) n++; return n; }
  over(): boolean { return !this.legal(1).length && !this.legal(-1).length; }
}
const RW = [
  100, -20, 10, 5, 5, 10, -20, 100, -20, -50, -2, -2, -2, -2, -50, -20, 10, -2, -1, -1, -1, -1, -2, 10, 5, -2, -1, -1, -1, -1, -2, 5,
  5, -2, -1, -1, -1, -1, -2, 5, 10, -2, -1, -1, -1, -1, -2, 10, -20, -50, -2, -2, -2, -2, -50, -20, 100, -20, 10, 5, 5, 10, -20, 100,
];
function revEval(g: Reversi, side: number): number {
  if (g.over()) { const d = g.count(side) - g.count(-side); return d > 0 ? 10000 + d : d < 0 ? -10000 + d : 0; }
  let s = 0;
  for (let i = 0; i < 64; i++) s += g.b[i] * RW[i];
  s *= side;
  s += 5 * (g.legal(side).length - g.legal(-side).length);
  return s;
}
function revSearch(g: Reversi, depth: number, alpha: number, beta: number): number {
  if (!depth || g.over()) return revEval(g, g.turn);
  const moves = g.legal();
  if (!moves.length) { const x = g.clone(); x.pass(); return -revSearch(x, depth - 1, -beta, -alpha); }
  let best = -Infinity;
  for (const m of moves) {
    const x = g.clone(); x.play(m);
    const v = -revSearch(x, depth - 1, -beta, -alpha);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}
export function reversiAi(g: Reversi, lv: AiLevel, rand: () => number = Math.random): number {
  const moves = g.legal();
  if (!moves.length) return -1;
  if (lv.random) return moves[Math.floor(rand() * moves.length)];
  let best = moves[0], bestV = -Infinity;
  for (const m of moves) {
    const x = g.clone(); x.play(m);
    let v = -revSearch(x, lv.depth - 1, -Infinity, Infinity);
    v += (rand() - 0.5) * lv.noise * 400;
    if (v > bestV) { bestV = v; best = m; }
  }
  return best;
}

/* ============================== Cờ caro ============================== */
export const GK = 15;
export class Gomoku {
  b = new Int8Array(GK * GK);
  turn = 1; moves: number[] = [];
  play(i: number): void { this.b[i] = this.turn; this.turn = -this.turn; this.moves.push(i); }
  undo(): void { const i = this.moves.pop(); if (i !== undefined) { this.b[i] = 0; this.turn = -this.turn; } }
  /** 5 quân liên tiếp trở lên qua ô i */
  fiveAt(i: number): number[] | null {
    const v = this.b[i];
    if (!v) return null;
    const r = Math.floor(i / GK), c = i % GK;
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const cells = [i];
      for (const sgn of [1, -1]) {
        let rr = r + dr * sgn, cc = c + dc * sgn;
        while (rr >= 0 && rr < GK && cc >= 0 && cc < GK && this.b[rr * GK + cc] === v) { cells.push(rr * GK + cc); rr += dr * sgn; cc += dc * sgn; }
      }
      if (cells.length >= 5) return cells;
    }
    return null;
  }
  full(): boolean { return this.moves.length >= GK * GK; }
}

/** Điểm mẫu theo số quân liên tiếp và số đầu bị chặn */
function shapeScore(count: number, open: number): number {
  if (count >= 5) return 1e6;
  if (open === 0) return 0;
  if (count === 4) return open === 2 ? 1e5 : 1e4;
  if (count === 3) return open === 2 ? 5e3 : 300;
  if (count === 2) return open === 2 ? 200 : 20;
  return open === 2 ? 10 : 2;
}
/** Giá trị đặt quân `side` vào ô trống i (tính trên 4 hướng) */
function cellValue(g: Gomoku, i: number, side: number): number {
  const r = Math.floor(i / GK), c = i % GK;
  let total = 0;
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    let count = 1, open = 0;
    for (const sgn of [1, -1]) {
      let rr = r + dr * sgn, cc = c + dc * sgn;
      while (rr >= 0 && rr < GK && cc >= 0 && cc < GK && g.b[rr * GK + cc] === side) { count++; rr += dr * sgn; cc += dc * sgn; }
      if (rr >= 0 && rr < GK && cc >= 0 && cc < GK && !g.b[rr * GK + cc]) open++;
    }
    total += shapeScore(count, open);
  }
  return total;
}
function candidates(g: Gomoku): number[] {
  if (!g.moves.length) return [Math.floor(GK * GK / 2)];
  const set = new Set<number>();
  for (const m of g.moves) {
    const r = Math.floor(m / GK), c = m % GK;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < GK && cc >= 0 && cc < GK && !g.b[rr * GK + cc]) set.add(rr * GK + cc);
    }
  }
  return [...set];
}
function ranked(g: Gomoku, side: number, limit: number): { i: number; v: number }[] {
  return candidates(g).map((i) => ({ i, v: cellValue(g, i, side) + 0.9 * cellValue(g, i, -side) })).sort((a, b) => b.v - a.v).slice(0, limit);
}
function gkSearch(g: Gomoku, depth: number, alpha: number, beta: number): number {
  const side = g.turn;
  const moves = ranked(g, side, 8);
  if (!moves.length) return 0;
  if (!depth) return moves[0].v - 0.8 * (ranked(g, -side, 1)[0]?.v ?? 0);
  let best = -Infinity;
  for (const m of moves) {
    g.play(m.i);
    const v = g.fiveAt(m.i) ? 1e7 + depth : -gkSearch(g, depth - 1, -beta, -alpha);
    g.undo();
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}
export function gomokuAi(g: Gomoku, lv: AiLevel, rand: () => number = Math.random): number {
  const cand = candidates(g);
  if (lv.random) {
    // cấp 1: vẫn chặn khi đối thủ sắp thắng, còn lại gần như ngẫu nhiên
    const urgent = ranked(g, g.turn, 1)[0];
    if (urgent && urgent.v >= 1e4) return urgent.i;
    return cand[Math.floor(rand() * cand.length)];
  }
  const depth = Math.min(lv.depth, 4);
  const moves = ranked(g, g.turn, 10);
  let best = moves[0].i, bestV = -Infinity;
  for (const m of moves) {
    g.play(m.i);
    let v = g.fiveAt(m.i) ? 1e8 : -gkSearch(g, depth - 1, -Infinity, Infinity);
    g.undo();
    v += m.v * 0.01 + (rand() - 0.5) * lv.noise * 20000;
    if (v > bestV) { bestV = v; best = m.i; }
  }
  return best;
}
