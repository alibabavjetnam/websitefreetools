/** Cờ tướng: luật đầy đủ (tướng không được đối mặt, chân mã, cản tượng, pháo ăn qua một quân) và máy đấu 10 cấp. */
import { MATE, searchBest, type SearchGame } from './search';

/** Ô: sq = hàng*9 + cột; hàng 0 là phía quân Đen (trên), hàng 9 là phía quân Đỏ (dưới). Đỏ dương, Đen âm. */
export const G = 1, A = 2, E = 3, H = 4, R = 5, C = 6, S = 7; // Tướng, Sĩ, Tượng, Mã, Xe, Pháo, Tốt
export interface Move { from: number; to: number; cap: number }

const ROWS = 10, COLS = 9;
const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const HORSE: [number, number, number, number][] = [
  // dr, dc, chân (dr, dc so với quân)
  [-2, -1, -1, 0], [-2, 1, -1, 0], [2, -1, 1, 0], [2, 1, 1, 0],
  [-1, -2, 0, -1], [1, -2, 0, -1], [-1, 2, 0, 1], [1, 2, 0, 1],
];

const VALUE = [0, 10000, 120, 120, 270, 600, 285, 30];

export class Position {
  b = new Int8Array(ROWS * COLS);
  turn = 1; // 1 Đỏ đi trước, -1 Đen
  kingSq = [85, 4]; // Đỏ, Đen
  private undos: number[] = [];
  keys: string[] = [];

  static start(): Position {
    const p = new Position();
    const back = [R, H, E, A, G, A, E, H, R];
    for (let c = 0; c < 9; c++) { p.b[c] = -back[c]; p.b[81 + c] = back[c]; }
    p.b[2 * 9 + 1] = p.b[2 * 9 + 7] = -C;
    p.b[7 * 9 + 1] = p.b[7 * 9 + 7] = C;
    for (const c of [0, 2, 4, 6, 8]) { p.b[3 * 9 + c] = -S; p.b[6 * 9 + c] = S; }
    p.keys.push(p.key());
    return p;
  }

  /** Đọc từ chuỗi kiểu FEN cờ tướng (chữ hoa = Đỏ), dùng cho kiểm thử. */
  static fromFen(fen: string): Position {
    const p = new Position();
    const [place, turn] = fen.split(' ');
    const map: Record<string, number> = { k: G, a: A, b: E, e: E, n: H, h: H, r: R, c: C, p: S };
    let sq = 0;
    for (const ch of place) {
      if (ch === '/') continue;
      if (/\d/.test(ch)) { sq += Number(ch); continue; }
      const v = map[ch.toLowerCase()];
      const red = ch === ch.toUpperCase();
      p.b[sq] = red ? v : -v;
      if (v === G) p.kingSq[red ? 0 : 1] = sq;
      sq++;
    }
    p.turn = turn === 'b' ? -1 : 1;
    p.keys.push(p.key());
    return p;
  }

  key(): string { return `${Array.from(this.b).join(',')}|${this.turn}`; }
  record(): void { this.keys.push(this.key()); }
  unrecord(): void { this.keys.pop(); }

  /** `side` đang bị chiếu (kể cả hai tướng đối mặt)? */
  inCheck(side = this.turn): boolean {
    const b = this.b;
    const ks = this.kingSq[side === 1 ? 0 : 1];
    const r = Math.floor(ks / 9), c = ks % 9;
    const them = -side;
    // Xe, Pháo, tướng đối mặt theo bốn hướng
    for (const [dr, dc] of ORTH) {
      let rr = r + dr, cc = c + dc, screens = 0;
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) {
        const v = b[rr * 9 + cc];
        if (v) {
          if (screens === 0) {
            if (v === them * R) return true;
            if (v === them * G && dc === 0) return true;
          } else if (screens === 1 && v === them * C) return true;
          screens++;
          if (screens > 1) break;
        }
        rr += dr; cc += dc;
      }
    }
    // Mã: quân Mã ở (r - dr, c - dc) nhảy tới tướng; chân tính từ vị trí mã
    for (const [dr, dc, lr, lc] of HORSE) {
      const hr = r - dr, hc = c - dc;
      if (hr < 0 || hr >= ROWS || hc < 0 || hc >= COLS) continue;
      if (b[hr * 9 + hc] !== them * H) continue;
      if (!b[(hr + lr) * 9 + hc + lc]) return true;
    }
    // Tốt: Đen đi xuống (+1), Đỏ đi lên (-1)
    const fr = them === -1 ? r - 1 : r + 1; // hàng của tốt phía trước tướng theo hướng tốt đối phương đi tới
    if (fr >= 0 && fr < ROWS && b[fr * 9 + c] === them * S) return true;
    for (const dc of [-1, 1]) {
      const cc = c + dc;
      if (cc < 0 || cc > 8) continue;
      const v = b[r * 9 + cc];
      if (v === them * S) {
        const crossed = them === -1 ? r >= 5 : r <= 4;
        if (crossed) return true;
      }
    }
    return false;
  }

  private pseudo(): Move[] {
    const out: Move[] = [];
    const b = this.b, us = this.turn;
    const add = (from: number, r: number, c: number) => {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
      const to = r * 9 + c;
      if (b[to] * us > 0) return;
      out.push({ from, to, cap: b[to] });
    };
    const inPalace = (r: number, c: number) => c >= 3 && c <= 5 && (us === 1 ? r >= 7 : r <= 2);
    const ownSide = (r: number) => (us === 1 ? r >= 5 : r <= 4);
    for (let sq = 0; sq < ROWS * COLS; sq++) {
      const v = b[sq] * us;
      if (v <= 0) continue;
      const r = Math.floor(sq / 9), c = sq % 9;
      switch (v) {
        case G:
          for (const [dr, dc] of ORTH) if (inPalace(r + dr, c + dc)) add(sq, r + dr, c + dc);
          break;
        case A:
          for (const dr of [-1, 1]) for (const dc of [-1, 1]) if (inPalace(r + dr, c + dc)) add(sq, r + dr, c + dc);
          break;
        case E:
          for (const dr of [-2, 2]) for (const dc of [-2, 2]) {
            const rr = r + dr, cc = c + dc;
            if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || !ownSide(rr)) continue;
            if (!b[(r + dr / 2) * 9 + c + dc / 2]) add(sq, rr, cc);
          }
          break;
        case H:
          for (const [dr, dc, lr, lc] of HORSE) if (!b[(r + lr) * 9 + c + lc]) add(sq, r + dr, c + dc);
          break;
        case R:
          for (const [dr, dc] of ORTH) {
            let rr = r + dr, cc = c + dc;
            while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) {
              add(sq, rr, cc);
              if (b[rr * 9 + cc]) break;
              rr += dr; cc += dc;
            }
          }
          break;
        case C:
          for (const [dr, dc] of ORTH) {
            let rr = r + dr, cc = c + dc, jumped = false;
            while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) {
              const t = b[rr * 9 + cc];
              if (!jumped) {
                if (t) jumped = true;
                else add(sq, rr, cc);
              } else if (t) {
                if (t * us < 0) add(sq, rr, cc);
                break;
              }
              rr += dr; cc += dc;
            }
          }
          break;
        case S: {
          const fwd = -us;
          add(sq, r + fwd, c);
          if (!ownSide(r)) { add(sq, r, c - 1); add(sq, r, c + 1); }
          break;
        }
      }
    }
    return out;
  }

  makeMove(m: Move): void {
    const b = this.b;
    const piece = b[m.from];
    this.undos.push(b[m.to]);
    b[m.to] = piece; b[m.from] = 0;
    if (Math.abs(piece) === G) this.kingSq[piece > 0 ? 0 : 1] = m.to;
    this.turn = -this.turn;
  }

  unmakeMove(m: Move): void {
    const b = this.b;
    this.turn = -this.turn;
    const piece = b[m.to];
    b[m.from] = piece; b[m.to] = this.undos.pop() as number;
    if (Math.abs(piece) === G) this.kingSq[piece > 0 ? 0 : 1] = m.from;
  }

  legalMoves(): Move[] {
    const res: Move[] = [];
    const us = this.turn;
    for (const m of this.pseudo()) {
      this.makeMove(m);
      if (!this.inCheck(us)) res.push(m);
      this.unmakeMove(m);
    }
    return res;
  }

  /** 'play' | 'checkmate' (bên đến lượt bị chiếu bí) | 'stalemate' (hết nước đi: cũng thua trong cờ tướng) | 'draw'. */
  status(): 'play' | 'checkmate' | 'stalemate' | 'draw' {
    if (!this.legalMoves().length) return this.inCheck() ? 'checkmate' : 'stalemate';
    const k = this.keys[this.keys.length - 1];
    if (this.keys.length > 240 || this.keys.filter((x) => x === k).length >= 3) return 'draw';
    return 'play';
  }
}

export const XQ_LEVELS: { depth: number; timeMs: number; noise: number; quiesce: boolean; random?: boolean }[] = [
  { depth: 1, timeMs: 500, noise: 0, quiesce: false, random: true },
  { depth: 1, timeMs: 800, noise: 200, quiesce: false },
  { depth: 1, timeMs: 800, noise: 90, quiesce: true },
  { depth: 2, timeMs: 1000, noise: 70, quiesce: false },
  { depth: 2, timeMs: 1200, noise: 30, quiesce: true },
  { depth: 3, timeMs: 1500, noise: 25, quiesce: true },
  { depth: 3, timeMs: 2000, noise: 0, quiesce: true },
  { depth: 4, timeMs: 2000, noise: 0, quiesce: true },
  { depth: 6, timeMs: 2500, noise: 0, quiesce: true },
  { depth: 8, timeMs: 3500, noise: 0, quiesce: true },
];

class XqSearch implements SearchGame<Move> {
  constructor(private p: Position) {}
  legalMoves() { return this.p.legalMoves(); }
  makeMove(m: Move) { this.p.makeMove(m); }
  unmakeMove(m: Move) { this.p.unmakeMove(m); }
  isCapture(m: Move) { return m.cap !== 0; }
  moveScore(m: Move) {
    return m.cap ? 10 * VALUE[Math.abs(m.cap)] - VALUE[Math.abs(this.p.b[m.from])] / 10 + 1000 : 0;
  }
  noMovesScore(ply: number) { return -MATE + ply; } // hết nước đi = thua
  evaluate() {
    let s = 0;
    const b = this.p.b;
    for (let i = 0; i < ROWS * COLS; i++) {
      const v = b[i];
      if (!v) continue;
      const t = Math.abs(v), red = v > 0;
      const r = Math.floor(i / 9), c = i % 9;
      let sc = VALUE[t];
      const centre = 4 - Math.abs(c - 4); // 0..4
      if (t === S) {
        const crossed = red ? r <= 4 : r >= 5;
        if (crossed) sc += 70 + centre * 5;
        else sc += (red ? 6 - r : r - 3) * 2;
      } else if (t === H || t === R || t === C) {
        sc += centre * 4;
        if (t === R || t === C) { const adv = red ? 9 - r : r; sc += adv * 2; }
      }
      s += red ? sc : -sc;
    }
    return this.p.turn === 1 ? s : -s;
  }
}

export function xiangqiAiMove(p: Position, level: number): Move | null {
  const cfg = XQ_LEVELS[Math.min(10, Math.max(1, level)) - 1];
  const legal = p.legalMoves();
  if (!legal.length) return null;
  if (cfg.random) return legal[Math.floor(Math.random() * legal.length)];
  return searchBest(new XqSearch(p), { maxDepth: cfg.depth, timeMs: cfg.timeMs, noise: cfg.noise, quiesce: cfg.quiesce }).move;
}

export function perft(p: Position, depth: number): number {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of p.legalMoves()) { p.makeMove(m); n += perft(p, depth - 1); p.unmakeMove(m); }
  return n;
}
