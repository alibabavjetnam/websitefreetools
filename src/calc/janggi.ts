/** Janggi (cờ tướng Hàn Quốc): bàn 9x10, cung có đường chéo, pháo nhảy đúng một quân, tượng 3 bước. Bỏ qua luật bikjang và nước bỏ lượt. */
import { MATE, searchBest, type SearchGame } from './search';

/** 1 tốt, 2 pháo, 3 xe, 4 mã, 5 tượng, 6 sĩ, 7 tướng. Dương = bên người (dưới), âm = máy (trên). */
export const JG_CHARS = ['', '兵', '包', '車', '馬', '象', '士', '王'];
const VAL = [0, 20, 70, 130, 50, 30, 30, 0];
export interface Move { from: number; to: number; cap: number }

const inPalace = (r: number, c: number): boolean => c >= 3 && c <= 5 && (r <= 2 || r >= 7);
/** Ô trên đường chéo cung: 4 góc và tâm */
const isDiagNode = (r: number, c: number): boolean => inPalace(r, c) && ((c === 4 && (r === 1 || r === 8)) || ((c === 3 || c === 5) && (r === 0 || r === 2 || r === 7 || r === 9)));
const DIAGS: number[][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTH: number[][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export class Janggi {
  b = new Int8Array(90);
  turn = 1;
  plies = 0;
  constructor() {
    const back = [3, 5, 4, 6, 0, 6, 5, 4, 3];
    for (let c = 0; c < 9; c++) { this.b[c] = back[c] ? -back[c] : 0; this.b[81 + c] = back[c]; }
    this.b[13] = -7; this.b[76] = 7;
    this.b[18 + 1] = -2; this.b[18 + 7] = -2; this.b[63 + 1] = 2; this.b[63 + 7] = 2;
    for (let c = 0; c < 9; c += 2) { this.b[27 + c] = -1; this.b[54 + c] = 1; }
  }
  private at(r: number, c: number): number { return r < 0 || r > 9 || c < 0 || c > 8 ? 99 : this.b[r * 9 + c]; }
  /** Các ô quân t (bên side) có thể đi tới, chưa lọc tự chiếu */
  private targets(i: number, t: number, side: number): number[] {
    const r = i / 9 | 0, c = i % 9, out: number[] = [];
    const add = (rr: number, cc: number): boolean => {
      const v = this.at(rr, cc);
      if (v === 99 || v * side > 0) return false;
      out.push(rr * 9 + cc);
      return v === 0;
    };
    const diagOK = (rr: number, cc: number, dr: number, dc: number): boolean => isDiagNode(rr, cc) && isDiagNode(rr + dr, cc + dc) && inPalace(rr + dr, cc + dc);
    if (t === 7 || t === 6) {
      for (const [dr, dc] of ORTH) if (inPalace(r + dr, c + dc)) add(r + dr, c + dc);
      for (const [dr, dc] of DIAGS) if (diagOK(r, c, dr, dc)) add(r + dr, c + dc);
    } else if (t === 1) {
      const f = side === 1 ? -1 : 1;
      add(r + f, c); add(r, c - 1); add(r, c + 1);
      for (const dc of [-1, 1]) if (diagOK(r, c, f, dc)) add(r + f, c + dc);
    } else if (t === 3) {
      for (const [dr, dc] of ORTH) { let rr = r + dr, cc = c + dc; while (add(rr, cc)) { rr += dr; cc += dc; } }
      for (const [dr, dc] of DIAGS) { let rr = r, cc = c; while (diagOK(rr, cc, dr, dc)) { rr += dr; cc += dc; if (!add(rr, cc)) break; } }
    } else if (t === 2) {
      const jump = (dr: number, dc: number, diag: boolean): void => {
        let rr = r, cc = c;
        // tìm quân đệm đầu tiên
        for (;;) {
          if (diag) { if (!diagOK(rr, cc, dr, dc)) return; rr += dr; cc += dc; } else { rr += dr; cc += dc; }
          const v = this.at(rr, cc);
          if (v === 99) return;
          if (v !== 0) { if (Math.abs(v) === 2) return; break; }
        }
        for (;;) {
          if (diag) { if (!diagOK(rr, cc, dr, dc)) return; rr += dr; cc += dc; } else { rr += dr; cc += dc; }
          const v = this.at(rr, cc);
          if (v === 99) return;
          if (v === 0) { out.push(rr * 9 + cc); continue; }
          if (v * side < 0 && Math.abs(v) !== 2) out.push(rr * 9 + cc);
          return;
        }
      };
      for (const [dr, dc] of ORTH) jump(dr, dc, false);
      for (const [dr, dc] of DIAGS) jump(dr, dc, true);
    } else if (t === 4) {
      for (const [dr, dc] of ORTH) {
        if (this.at(r + dr, c + dc) !== 0) continue;
        const sides = dr === 0 ? [[-1, 2 * dc], [1, 2 * dc]] : [[2 * dr, -1], [2 * dr, 1]];
        for (const [a, b2] of sides) add(r + a, c + b2);
      }
    } else if (t === 5) {
      for (const [dr, dc] of ORTH) {
        if (this.at(r + dr, c + dc) !== 0) continue;
        for (const s of [-1, 1]) {
          const mr = dr === 0 ? r + s : r + 2 * dr, mc = dr === 0 ? c + 2 * dc : c + s;
          if (this.at(mr, mc) !== 0) continue;
          add(dr === 0 ? r + 3 * s : r + 3 * dr, dr === 0 ? c + 3 * dc : c + 3 * s);
        }
      }
    }
    return out;
  }
  kingSq(side: number): number { return this.b.indexOf(side * 7); }
  attacked(sq: number, by: number): boolean {
    for (let i = 0; i < 90; i++) {
      const v = this.b[i];
      if (!v || v * by < 0) continue;
      if (this.targets(i, Math.abs(v), by).includes(sq)) return true;
    }
    return false;
  }
  inCheck(side: number): boolean { const k = this.kingSq(side); return k >= 0 && this.attacked(k, -side); }
  /** Hai tướng đối mặt không có quân chắn (không cho phép) */
  private facing(): boolean {
    const a = this.kingSq(1), b = this.kingSq(-1);
    if (a < 0 || b < 0 || a % 9 !== b % 9) return false;
    for (let i = b + 9; i < a; i += 9) if (this.b[i]) return false;
    return true;
  }
  legalMoves(): Move[] {
    const side = this.turn, out: Move[] = [];
    for (let i = 0; i < 90; i++) {
      const v = this.b[i];
      if (!v || v * side < 0) continue;
      for (const to of this.targets(i, Math.abs(v), side)) {
        const m: Move = { from: i, to, cap: this.b[to] };
        this.makeMove(m);
        const bad = this.inCheck(side) || this.facing();
        this.unmakeMove(m);
        if (!bad) out.push(m);
      }
    }
    return out;
  }
  makeMove(m: Move): void { this.b[m.to] = this.b[m.from]; this.b[m.from] = 0; this.turn = -this.turn; this.plies++; }
  unmakeMove(m: Move): void { this.b[m.from] = this.b[m.to]; this.b[m.to] = m.cap; this.turn = -this.turn; this.plies--; }
  status(): 'play' | 'lost' | 'draw' {
    if (!this.legalMoves().length) return 'lost';
    if (this.plies >= 400) return 'draw';
    return 'play';
  }
}

export const JANGGI_LEVELS: { depth: number; timeMs: number; noise: number; random?: boolean }[] = [
  { depth: 1, timeMs: 300, noise: 0, random: true },
  { depth: 1, timeMs: 400, noise: 160 },
  { depth: 2, timeMs: 600, noise: 110 },
  { depth: 2, timeMs: 800, noise: 60 },
  { depth: 3, timeMs: 1000, noise: 35 },
  { depth: 3, timeMs: 1300, noise: 15 },
  { depth: 4, timeMs: 1700, noise: 0 },
  { depth: 4, timeMs: 2200, noise: 0 },
  { depth: 5, timeMs: 2800, noise: 0 },
  { depth: 6, timeMs: 3500, noise: 0 },
];

class Search implements SearchGame<Move> {
  constructor(private g: Janggi) {}
  legalMoves() { return this.g.legalMoves(); }
  makeMove(m: Move) { this.g.makeMove(m); }
  unmakeMove(m: Move) { this.g.unmakeMove(m); }
  isCapture(m: Move) { return m.cap !== 0; }
  moveScore(m: Move) { return m.cap ? VAL[Math.abs(m.cap)] * 10 - VAL[Math.abs(this.g.b[m.from])] : 0; }
  noMovesScore(ply: number) { return -MATE + ply; }
  evaluate() {
    let s = 0;
    const b = this.g.b;
    for (let i = 0; i < 90; i++) {
      const v = b[i];
      if (!v) continue;
      const t = Math.abs(v), side = v > 0 ? 1 : -1, r = i / 9 | 0, c = i % 9;
      let sc = VAL[t];
      if (t === 1) sc += (side === 1 ? 9 - r : r) * 3;
      if (t === 3 || t === 4 || t === 2) sc += 4 - Math.abs(c - 4);
      s += side * sc;
    }
    return this.g.turn === 1 ? s : -s;
  }
}

export function janggiAiMove(g: Janggi, level: number): Move | null {
  const cfg = JANGGI_LEVELS[Math.min(10, Math.max(1, level)) - 1];
  const legal = g.legalMoves();
  if (!legal.length) return null;
  if (legal.length === 1) return legal[0];
  if (cfg.random) return legal[Math.floor(Math.random() * legal.length)];
  return searchBest(new Search(g), { maxDepth: cfg.depth, timeMs: cfg.timeMs, noise: cfg.noise, quiesce: false }).move;
}
export function perft(g: Janggi, d: number): number {
  if (d === 0) return 1;
  let n = 0;
  for (const m of g.legalMoves()) { g.makeMove(m); n += perft(g, d - 1); g.unmakeMove(m); }
  return n;
}
