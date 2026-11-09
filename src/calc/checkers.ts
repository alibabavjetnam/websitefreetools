/** Cờ đam (Checkers/Draughts 8x8, luật Anh): bắt buộc ăn, nhảy nhiều lần, tốt chỉ đi/ăn tiến, vua đi lùi. Máy đấu 10 cấp. */
import { MATE, searchBest, type SearchGame } from './search';

/** Ô: i = hàng*8 + cột; chỉ dùng ô tối ((hàng+cột) lẻ). Người cầm Đỏ (dương, đi lên), máy cầm Đen (âm, đi xuống). 1 tốt, 2 vua. */
export interface Move { from: number; to: number; caps: number[]; path: number[] }
interface Undo { piece: number; capPieces: number[]; promoted: boolean; half: number }

export class Checkers {
  b = new Int8Array(64);
  turn = 1; // 1 Đỏ (người), -1 Đen (máy)
  half = 0; // số nước liên tiếp không ăn/không đi tốt
  private undos: Undo[] = [];
  keys: string[] = [];

  constructor() {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 !== 1) continue;
      if (r < 3) this.b[r * 8 + c] = -1; else if (r > 4) this.b[r * 8 + c] = 1;
    }
    this.keys.push(this.key());
  }
  key(): string { return `${Array.from(this.b).join('')}|${this.turn}`; }
  record(): void { this.keys.push(this.key()); }
  unrecord(): void { this.keys.pop(); }

  private dirs(piece: number): number[][] {
    if (Math.abs(piece) === 2) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    return piece > 0 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
  }

  private jumps(from: number, piece: number, caps: number[], path: number[], out: Move[], board: Int8Array): void {
    const r = from >> 3, c = from & 7;
    let any = false;
    for (const [dr, dc] of this.dirs(piece)) {
      const r1 = r + dr, c1 = c + dc, r2 = r + 2 * dr, c2 = c + 2 * dc;
      if (r2 < 0 || r2 > 7 || c2 < 0 || c2 > 7) continue;
      const mid = r1 * 8 + c1, dst = r2 * 8 + c2;
      const mv = board[mid];
      if (mv * piece >= 0 || caps.includes(mid)) continue;
      if (board[dst] !== 0 && dst !== path[0]) continue; // ô xuất phát đã trống
      any = true;
      const promote = Math.abs(piece) === 1 && (piece > 0 ? r2 === 0 : r2 === 7);
      const nc = [...caps, mid], np = [...path, dst];
      if (promote) out.push({ from: path[0], to: dst, caps: nc, path: np });
      else this.jumps(dst, piece, nc, np, out, board);
    }
    if (!any && caps.length) out.push({ from: path[0], to: from, caps, path });
  }

  legalMoves(): Move[] {
    const us = this.turn;
    const jumps: Move[] = [];
    const steps: Move[] = [];
    for (let i = 0; i < 64; i++) {
      const p = this.b[i];
      if (p * us <= 0) continue;
      this.jumps(i, p, [], [i], jumps, this.b);
      const r = i >> 3, c = i & 7;
      for (const [dr, dc] of this.dirs(p)) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
        if (!this.b[rr * 8 + cc]) steps.push({ from: i, to: rr * 8 + cc, caps: [], path: [i, rr * 8 + cc] });
      }
    }
    return jumps.length ? jumps : steps;
  }

  makeMove(m: Move): void {
    const piece = this.b[m.from];
    const capPieces = m.caps.map((i) => this.b[i]);
    const lastRow = m.to >> 3;
    const promoted = Math.abs(piece) === 1 && (piece > 0 ? lastRow === 0 : lastRow === 7);
    this.undos.push({ piece, capPieces, promoted, half: this.half });
    this.b[m.from] = 0;
    m.caps.forEach((i) => { this.b[i] = 0; });
    this.b[m.to] = promoted ? piece * 2 : piece;
    this.half = m.caps.length || Math.abs(piece) === 1 ? 0 : this.half + 1;
    this.turn = -this.turn;
  }
  unmakeMove(m: Move): void {
    const u = this.undos.pop() as Undo;
    this.turn = -this.turn;
    this.b[m.to] = 0;
    this.b[m.from] = u.piece;
    m.caps.forEach((i, k) => { this.b[i] = u.capPieces[k]; });
    this.half = u.half;
  }

  /** 'play' | 'lost' (bên đến lượt hết nước = thua) | 'draw' */
  status(): 'play' | 'lost' | 'draw' {
    if (!this.legalMoves().length) return 'lost';
    if (this.half >= 80) return 'draw';
    const k = this.keys[this.keys.length - 1];
    if (this.keys.filter((x) => x === k).length >= 3) return 'draw';
    return 'play';
  }
}

export const CHECKERS_LEVELS: { depth: number; timeMs: number; noise: number; random?: boolean }[] = [
  { depth: 1, timeMs: 400, noise: 0, random: true },
  { depth: 1, timeMs: 500, noise: 140 },
  { depth: 2, timeMs: 600, noise: 90 },
  { depth: 2, timeMs: 800, noise: 40 },
  { depth: 3, timeMs: 1000, noise: 25 },
  { depth: 4, timeMs: 1200, noise: 10 },
  { depth: 5, timeMs: 1500, noise: 0 },
  { depth: 6, timeMs: 1800, noise: 0 },
  { depth: 8, timeMs: 2500, noise: 0 },
  { depth: 12, timeMs: 3500, noise: 0 },
];

class Search implements SearchGame<Move> {
  constructor(private g: Checkers) {}
  legalMoves() { return this.g.legalMoves(); }
  makeMove(m: Move) { this.g.makeMove(m); }
  unmakeMove(m: Move) { this.g.unmakeMove(m); }
  isCapture(m: Move) { return m.caps.length > 0; }
  moveScore(m: Move) { return m.caps.length * 100 + (m.path.length > 2 ? 20 : 0); }
  noMovesScore(ply: number) { return -MATE + ply; }
  evaluate() {
    let s = 0;
    const b = this.g.b;
    for (let i = 0; i < 64; i++) {
      const v = b[i];
      if (!v) continue;
      const r = i >> 3, c = i & 7, red = v > 0, king = Math.abs(v) === 2;
      let sc = king ? 170 : 100;
      if (!king) sc += (red ? 7 - r : r) * 4;
      if (!king && (red ? r === 7 : r === 0)) sc += 8; // giữ hàng sau
      if (c === 0 || c === 7) sc -= 3;
      else if (r >= 2 && r <= 5 && c >= 2 && c <= 5) sc += 3;
      s += red ? sc : -sc;
    }
    return this.g.turn === 1 ? s : -s;
  }
}

export function checkersAiMove(g: Checkers, level: number): Move | null {
  const cfg = CHECKERS_LEVELS[Math.min(10, Math.max(1, level)) - 1];
  const legal = g.legalMoves();
  if (!legal.length) return null;
  if (legal.length === 1) return legal[0];
  if (cfg.random) return legal[Math.floor(Math.random() * legal.length)];
  return searchBest(new Search(g), { maxDepth: cfg.depth, timeMs: cfg.timeMs, noise: cfg.noise, quiesce: false }).move;
}

export function perft(g: Checkers, d: number): number {
  if (d === 0) return 1;
  let n = 0;
  for (const m of g.legalMoves()) { g.makeMove(m); n += perft(g, d - 1); g.unmakeMove(m); }
  return n;
}
