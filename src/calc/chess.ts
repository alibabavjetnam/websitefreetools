/** Cờ vua: luật đầy đủ (nhập thành, bắt tốt qua đường, phong cấp, chiếu bí, hoà) và máy đấu 10 cấp. */
import { MATE, searchBest, type SearchGame } from './search';

export const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
/** Ô: sq = hàng*8 + cột; hàng 0 là hàng 8 (phía quân Đen), hàng 7 là hàng 1 (phía quân Trắng). Quân Trắng dương, Đen âm. */
export interface Move { from: number; to: number; promo: number; cap: number; flag: number }
// flag: 0 thường, 1 tốt đi hai ô, 2 bắt tốt qua đường, 3 nhập thành gần, 4 nhập thành xa
interface Undo { castle: number; ep: number; half: number; cap: number }

const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];

const VALUE = [0, 100, 320, 330, 500, 900, 0];
// Bảng điểm vị trí (góc nhìn quân Trắng, hàng 8 ở trên cùng)
const PST: number[][] = [
  [],
  [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
];

export class Position {
  b = new Int8Array(64);
  turn = 1; // 1 Trắng, -1 Đen
  castle = 15; // 1 Trắng gần, 2 Trắng xa, 4 Đen gần, 8 Đen xa
  ep = -1;
  half = 0;
  kingSq = [60, 4];
  private undos: Undo[] = [];
  /** Khoá các vị trí đã xảy ra (để đếm lặp lại); do bên điều khiển ván gọi record()/unrecord() sau mỗi nước thật. */
  keys: string[] = [];
  record(): void { this.keys.push(this.key()); }
  unrecord(): void { this.keys.pop(); }

  static start(): Position {
    const p = new Position();
    const back = [R, N, B, Q, K, B, N, R];
    for (let f = 0; f < 8; f++) {
      p.b[f] = -back[f]; p.b[8 + f] = -P; p.b[48 + f] = P; p.b[56 + f] = back[f];
    }
    p.keys.push(p.key());
    return p;
  }

  /** Đọc từ FEN (dùng cho kiểm thử). */
  static fromFen(fen: string): Position {
    const p = new Position();
    const [place, turn, cas, ep] = fen.split(' ');
    const map: Record<string, number> = { p: P, n: N, b: B, r: R, q: Q, k: K };
    let sq = 0;
    for (const ch of place) {
      if (ch === '/') continue;
      if (/\d/.test(ch)) { sq += Number(ch); continue; }
      const v = map[ch.toLowerCase()];
      p.b[sq] = ch === ch.toLowerCase() ? -v : v;
      if (v === K) p.kingSq[ch === ch.toLowerCase() ? 1 : 0] = sq;
      sq++;
    }
    p.turn = turn === 'b' ? -1 : 1;
    p.castle = (cas.includes('K') ? 1 : 0) | (cas.includes('Q') ? 2 : 0) | (cas.includes('k') ? 4 : 0) | (cas.includes('q') ? 8 : 0);
    p.ep = ep && ep !== '-' ? (8 - Number(ep[1])) * 8 + (ep.charCodeAt(0) - 97) : -1;
    p.keys.push(p.key());
    return p;
  }

  key(): string {
    return `${Array.from(this.b).join(',')}|${this.turn}|${this.castle}|${this.ep}`;
  }

  /** Ô `sq` có bị bên `by` (1 hoặc -1) tấn công không. */
  attacked(sq: number, by: number): boolean {
    const r = sq >> 3, f = sq & 7, b = this.b;
    // tốt: tốt Trắng ở hàng r+1 ăn lên; tốt Đen ở hàng r-1 ăn xuống
    const pr = by === 1 ? r + 1 : r - 1;
    if (pr >= 0 && pr < 8) {
      if (f > 0 && b[pr * 8 + f - 1] === by * P) return true;
      if (f < 7 && b[pr * 8 + f + 1] === by * P) return true;
    }
    for (const [dr, df] of KNIGHT) {
      const rr = r + dr, ff = f + df;
      if (rr >= 0 && rr < 8 && ff >= 0 && ff < 8 && b[rr * 8 + ff] === by * N) return true;
    }
    for (const [dr, df] of KING) {
      const rr = r + dr, ff = f + df;
      if (rr >= 0 && rr < 8 && ff >= 0 && ff < 8 && b[rr * 8 + ff] === by * K) return true;
    }
    for (const [dr, df] of DIAG) {
      let rr = r + dr, ff = f + df;
      while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
        const v = b[rr * 8 + ff];
        if (v) { if (v === by * B || v === by * Q) return true; break; }
        rr += dr; ff += df;
      }
    }
    for (const [dr, df] of ORTH) {
      let rr = r + dr, ff = f + df;
      while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
        const v = b[rr * 8 + ff];
        if (v) { if (v === by * R || v === by * Q) return true; break; }
        rr += dr; ff += df;
      }
    }
    return false;
  }

  inCheck(side = this.turn): boolean {
    return this.attacked(this.kingSq[side === 1 ? 0 : 1], -side);
  }

  private pseudo(): Move[] {
    const out: Move[] = [];
    const b = this.b, us = this.turn;
    const add = (from: number, to: number, flag = 0, promo = 0) => out.push({ from, to, promo, cap: b[to], flag });
    for (let sq = 0; sq < 64; sq++) {
      const v = b[sq] * us;
      if (v <= 0) continue;
      const r = sq >> 3, f = sq & 7;
      if (v === P) {
        const dir = -us; // Trắng đi lên (hàng giảm)
        const r1 = r + dir;
        const lastRank = us === 1 ? 0 : 7;
        const startRank = us === 1 ? 6 : 1;
        if (r1 >= 0 && r1 < 8) {
          if (!b[r1 * 8 + f]) {
            if (r1 === lastRank) for (const pr of [Q, R, B, N]) add(sq, r1 * 8 + f, 0, pr);
            else {
              add(sq, r1 * 8 + f);
              if (r === startRank && !b[(r + 2 * dir) * 8 + f]) add(sq, (r + 2 * dir) * 8 + f, 1);
            }
          }
          for (const df of [-1, 1]) {
            const ff = f + df;
            if (ff < 0 || ff > 7) continue;
            const to = r1 * 8 + ff;
            if (b[to] * us < 0) {
              if (r1 === lastRank) for (const pr of [Q, R, B, N]) add(sq, to, 0, pr);
              else add(sq, to);
            } else if (to === this.ep) out.push({ from: sq, to, promo: 0, cap: -us * P, flag: 2 });
          }
        }
      } else if (v === N || v === K) {
        for (const [dr, df] of v === N ? KNIGHT : KING) {
          const rr = r + dr, ff = f + df;
          if (rr < 0 || rr > 7 || ff < 0 || ff > 7) continue;
          const to = rr * 8 + ff;
          if (b[to] * us <= 0) add(sq, to);
        }
        if (v === K) {
          const base = us === 1 ? 60 : 4;
          if (sq === base && !this.attacked(base, -us)) {
            const kBit = us === 1 ? 1 : 4, qBit = us === 1 ? 2 : 8;
            if ((this.castle & kBit) && !b[base + 1] && !b[base + 2] && b[base + 3] === us * R && !this.attacked(base + 1, -us) && !this.attacked(base + 2, -us)) add(sq, base + 2, 3);
            if ((this.castle & qBit) && !b[base - 1] && !b[base - 2] && !b[base - 3] && b[base - 4] === us * R && !this.attacked(base - 1, -us) && !this.attacked(base - 2, -us)) add(sq, base - 2, 4);
          }
        }
      } else {
        const dirs = v === B ? DIAG : v === R ? ORTH : [...DIAG, ...ORTH];
        for (const [dr, df] of dirs) {
          let rr = r + dr, ff = f + df;
          while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
            const to = rr * 8 + ff;
            if (b[to] * us > 0) break;
            add(sq, to);
            if (b[to]) break;
            rr += dr; ff += df;
          }
        }
      }
    }
    return out;
  }

  makeMove(m: Move): void {
    const b = this.b, us = this.turn;
    this.undos.push({ castle: this.castle, ep: this.ep, half: this.half, cap: m.flag === 2 ? 0 : b[m.to] });
    const piece = b[m.from];
    b[m.from] = 0;
    if (m.flag === 2) b[m.to + 8 * us] = 0; // tốt bị bắt nằm sau ô đến
    b[m.to] = m.promo ? us * m.promo : piece;
    if (m.flag === 3) { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = 0; }
    if (m.flag === 4) { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = 0; }
    if (Math.abs(piece) === K) this.kingSq[us === 1 ? 0 : 1] = m.to;
    // quyền nhập thành
    for (const s of [m.from, m.to]) {
      if (s === 60) this.castle &= ~3;
      else if (s === 4) this.castle &= ~12;
      else if (s === 63) this.castle &= ~1;
      else if (s === 56) this.castle &= ~2;
      else if (s === 7) this.castle &= ~4;
      else if (s === 0) this.castle &= ~8;
    }
    this.ep = m.flag === 1 ? (m.from + m.to) >> 1 : -1;
    this.half = Math.abs(piece) === P || m.cap ? 0 : this.half + 1;
    this.turn = -us;
  }

  unmakeMove(m: Move): void {
    const b = this.b;
    const u = this.undos.pop() as Undo;
    this.turn = -this.turn;
    const us = this.turn;
    const piece = m.promo ? us * P : b[m.to];
    b[m.from] = piece;
    b[m.to] = 0;
    if (m.flag === 2) b[m.to + 8 * us] = -us * P;
    else b[m.to] = u.cap;
    if (m.flag === 3) { b[m.to + 1] = b[m.to - 1]; b[m.to - 1] = 0; }
    if (m.flag === 4) { b[m.to - 2] = b[m.to + 1]; b[m.to + 1] = 0; }
    if (Math.abs(piece) === K) this.kingSq[us === 1 ? 0 : 1] = m.from;
    this.castle = u.castle; this.ep = u.ep; this.half = u.half;
  }

  legalMoves(): Move[] {
    const res: Move[] = [];
    const us = this.turn;
    for (const m of this.pseudo()) {
      this.makeMove(m);
      if (!this.attacked(this.kingSq[us === 1 ? 0 : 1], -us)) res.push(m);
      this.unmakeMove(m);
    }
    return res;
  }

  insufficient(): boolean {
    const pieces: number[] = [];
    for (let i = 0; i < 64; i++) { const v = Math.abs(this.b[i]); if (v && v !== K) pieces.push(v); }
    if (!pieces.length) return true;
    return pieces.length === 1 && (pieces[0] === N || pieces[0] === B);
  }

  /** 'play' | 'checkmate' (bên đến lượt bị chiếu bí) | 'stalemate' | 'draw'. */
  status(): 'play' | 'checkmate' | 'stalemate' | 'draw' {
    if (!this.legalMoves().length) return this.inCheck() ? 'checkmate' : 'stalemate';
    if (this.half >= 100 || this.insufficient()) return 'draw';
    const k = this.keys[this.keys.length - 1];
    if (this.keys.filter((x) => x === k).length >= 3) return 'draw';
    return 'play';
  }
}

/** Cấu hình từng cấp: độ sâu, thời gian, nhiễu. Cấp 1 đi ngẫu nhiên. */
export const CHESS_LEVELS: { depth: number; timeMs: number; noise: number; quiesce: boolean; random?: boolean }[] = [
  { depth: 1, timeMs: 500, noise: 0, quiesce: false, random: true },
  { depth: 1, timeMs: 800, noise: 220, quiesce: false },
  { depth: 1, timeMs: 800, noise: 90, quiesce: true },
  { depth: 2, timeMs: 1000, noise: 70, quiesce: false },
  { depth: 2, timeMs: 1200, noise: 30, quiesce: true },
  { depth: 3, timeMs: 1500, noise: 25, quiesce: true },
  { depth: 3, timeMs: 2000, noise: 0, quiesce: true },
  { depth: 4, timeMs: 2000, noise: 0, quiesce: true },
  { depth: 6, timeMs: 2500, noise: 0, quiesce: true },
  { depth: 8, timeMs: 3500, noise: 0, quiesce: true },
];

class ChessSearch implements SearchGame<Move> {
  constructor(private p: Position) {}
  legalMoves() { return this.p.legalMoves(); }
  makeMove(m: Move) { this.p.makeMove(m); }
  unmakeMove(m: Move) { this.p.unmakeMove(m); }
  isCapture(m: Move) { return m.cap !== 0 || m.promo !== 0; }
  moveScore(m: Move) {
    const mover = Math.abs(this.p.b[m.from]);
    return (m.cap ? 10 * VALUE[Math.abs(m.cap)] - VALUE[mover] / 10 + 1000 : 0) + (m.promo ? VALUE[m.promo] : 0);
  }
  noMovesScore(ply: number) { return this.p.inCheck() ? -MATE + ply : 0; }
  evaluate() {
    let s = 0;
    const b = this.p.b;
    for (let i = 0; i < 64; i++) {
      const v = b[i];
      if (!v) continue;
      const t = Math.abs(v);
      if (v > 0) s += VALUE[t] + PST[t][i];
      else s -= VALUE[t] + PST[t][((7 - (i >> 3)) << 3) | (i & 7)];
    }
    return this.p.turn === 1 ? s : -s;
  }
}

export function chessAiMove(p: Position, level: number): Move | null {
  const cfg = CHESS_LEVELS[Math.min(10, Math.max(1, level)) - 1];
  const legal = p.legalMoves();
  if (!legal.length) return null;
  if (cfg.random) return legal[Math.floor(Math.random() * legal.length)];
  return searchBest(new ChessSearch(p), { maxDepth: cfg.depth, timeMs: cfg.timeMs, noise: cfg.noise, quiesce: cfg.quiesce }).move;
}

export function perft(p: Position, depth: number): number {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of p.legalMoves()) { p.makeMove(m); n += perft(p, depth - 1); p.unmakeMove(m); }
  return n;
}
