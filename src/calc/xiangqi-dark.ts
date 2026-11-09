/**
 * Cờ úp (biến thể cờ tướng phổ biến ở Việt Nam):
 *  - Hai Tướng ngửa ở chỗ cũ; 15 quân còn lại mỗi bên được xáo ngẫu nhiên và úp vào 15 vị trí xuất phát.
 *  - Quân úp đi theo quân của vị trí nó đang đứng (đứng ở chỗ Xe thì đi như Xe…); đi xong thì lật ngửa và từ đó đi theo quân thật.
 *  - Sĩ và Tượng (đã lật hoặc còn úp) được đi khắp bàn: Sĩ chéo 1 ô, Tượng chéo 2 ô (vẫn bị cản mắt). Tướng vẫn ở trong cung,
 *    hai Tướng không được đối mặt. Tốt chưa qua sông chỉ đi thẳng, qua sông được đi ngang.
 *  - Bị chiếu bí hoặc hết nước đi là thua.
 * Không ai (kể cả máy) biết quân úp là gì cho tới khi nó được lật; máy đoán bằng cách xáo thử nhiều lần các quân chưa lộ.
 */
import { MATE, searchBest, type SearchGame } from './search';
import { A, C, E, G, H, R, S } from './xiangqi';

export { A, C, E, G, H, R, S };

export interface DarkMove {
  from: number;
  to: number;
  /** Quân bị ăn (có dấu, 0 nếu không ăn) */
  cap: number;
  /** Quân bị ăn đang úp */
  capHidden: boolean;
  /** Quân đi đang úp: sau nước này sẽ lật */
  reveal: boolean;
}

const ROWS = 10, COLS = 9;
const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIAG1 = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const HORSE: [number, number, number, number][] = [
  [-2, -1, -1, 0], [-2, 1, -1, 0], [2, -1, 1, 0], [2, 1, 1, 0],
  [-1, -2, 0, -1], [1, -2, 0, -1], [-1, 2, 0, 1], [1, 2, 0, 1],
];

/** Loại quân theo vị trí xuất phát (quân úp đi theo loại này) */
export const START_TYPE = new Int8Array(ROWS * COLS);
{
  const back = [R, H, E, A, G, A, E, H, R];
  for (let c = 0; c < 9; c++) { START_TYPE[c] = back[c]; START_TYPE[81 + c] = back[c]; }
  START_TYPE[19] = START_TYPE[25] = START_TYPE[64] = START_TYPE[70] = C;
  for (const c of [0, 2, 4, 6, 8]) { START_TYPE[27 + c] = S; START_TYPE[54 + c] = S; }
}

/** 15 ô xuất phát (trừ Tướng) của Đỏ và Đen theo thứ tự cố định: dùng để mã hoá cách xáo quân */
export const RED_SQ: number[] = [81, 82, 83, 84, 86, 87, 88, 89, 64, 70, 54, 56, 58, 60, 62];
export const BLACK_SQ: number[] = [0, 1, 2, 3, 5, 6, 7, 8, 19, 25, 27, 29, 31, 33, 35];
const POOL = [A, A, E, E, H, H, R, R, C, C, S, S, S, S, S];

const VALUE = [0, 10000, 200, 200, 270, 600, 285, 30];

/** Xáo 15 quân cho mỗi bên: trả về 30 số (Đỏ theo RED_SQ rồi Đen theo BLACK_SQ) */
export function randomDeal(rand: () => number = Math.random): number[] {
  const one = (): number[] => {
    const a = [...POOL];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  return [...one(), ...one()];
}

/** Cách xáo hợp lệ: đúng 30 số, mỗi bên đúng bộ 15 quân */
export function validDeal(d: unknown): d is number[] {
  if (!Array.isArray(d) || d.length !== 30 || !d.every((x) => Number.isInteger(x))) return false;
  const norm = (a: number[]) => [...a].sort((x, y) => x - y).join();
  const want = norm(POOL);
  return norm(d.slice(0, 15)) === want && norm(d.slice(15)) === want;
}

export class DarkPosition {
  b = new Int8Array(ROWS * COLS);
  /** 1 = quân đang úp */
  hidden = new Uint8Array(ROWS * COLS);
  turn = 1;
  kingSq = [85, 4];
  keys: string[] = [];
  private undos: { cap: number; capHidden: number; fromHidden: number }[] = [];

  static start(deal: number[] = randomDeal()): DarkPosition {
    if (!validDeal(deal)) throw new Error('bad deal');
    const p = new DarkPosition();
    p.b[85] = G;
    p.b[4] = -G;
    RED_SQ.forEach((sq, i) => { p.b[sq] = deal[i]; p.hidden[sq] = 1; });
    BLACK_SQ.forEach((sq, i) => { p.b[sq] = -deal[15 + i]; p.hidden[sq] = 1; });
    p.keys.push(p.key());
    return p;
  }

  clone(): DarkPosition {
    const p = new DarkPosition();
    p.b = this.b.slice();
    p.hidden = this.hidden.slice();
    p.turn = this.turn;
    p.kingSq = [...this.kingSq];
    p.keys = [...this.keys];
    return p;
  }

  /** Loại quân dùng để đi: quân úp đi theo vị trí, quân ngửa theo chính nó */
  eff(sq: number): number {
    return this.hidden[sq] ? START_TYPE[sq] : Math.abs(this.b[sq]);
  }

  key(): string {
    return `${Array.from(this.b).join(',')}|${Array.from(this.hidden).join('')}|${this.turn}`;
  }
  record(): void { this.keys.push(this.key()); }
  unrecord(): void { this.keys.pop(); }

  inCheck(side = this.turn): boolean {
    const b = this.b;
    const ks = this.kingSq[side === 1 ? 0 : 1];
    const r = Math.floor(ks / 9), c = ks % 9;
    const them = -side;
    const is = (sq: number, type: number) => b[sq] * them > 0 && this.eff(sq) === type;
    for (const [dr, dc] of ORTH) {
      let rr = r + dr, cc = c + dc, screens = 0;
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) {
        const sq = rr * 9 + cc;
        if (b[sq]) {
          if (screens === 0) {
            if (is(sq, R)) return true;
            if (b[sq] === them * G && dc === 0) return true;
          } else if (is(sq, C)) return true;
          if (++screens > 1) break;
        }
        rr += dr; cc += dc;
      }
    }
    for (const [dr, dc, lr, lc] of HORSE) {
      const hr = r - dr, hc = c - dc;
      if (hr < 0 || hr >= ROWS || hc < 0 || hc >= COLS) continue;
      if (is(hr * 9 + hc, H) && !b[(hr + lr) * 9 + hc + lc]) return true;
    }
    // Tốt đối phương đi tới: Đen đi xuống (+1 hàng), Đỏ đi lên (-1 hàng)
    const fr = them === -1 ? r - 1 : r + 1;
    if (fr >= 0 && fr < ROWS && is(fr * 9 + c, S)) return true;
    const crossed = them === -1 ? r >= 5 : r <= 4;
    if (crossed) for (const dc of [-1, 1]) if (c + dc >= 0 && c + dc <= 8 && is(r * 9 + c + dc, S)) return true;
    // Sĩ, Tượng đi khắp bàn
    for (const [dr, dc] of DIAG1) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && is(rr * 9 + cc, A)) return true;
      const r2 = r + 2 * dr, c2 = c + 2 * dc;
      if (r2 >= 0 && r2 < ROWS && c2 >= 0 && c2 < COLS && is(r2 * 9 + c2, E) && !b[rr * 9 + cc]) return true;
    }
    return false;
  }

  private pseudo(): DarkMove[] {
    const out: DarkMove[] = [];
    const b = this.b, us = this.turn;
    const add = (from: number, r: number, c: number) => {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
      const to = r * 9 + c;
      if (b[to] * us > 0) return;
      out.push({ from, to, cap: b[to], capHidden: !!this.hidden[to], reveal: !!this.hidden[from] });
    };
    const inPalace = (r: number, c: number) => c >= 3 && c <= 5 && (us === 1 ? r >= 7 : r <= 2);
    const ownSide = (r: number) => (us === 1 ? r >= 5 : r <= 4);
    for (let sq = 0; sq < ROWS * COLS; sq++) {
      if (b[sq] * us <= 0) continue;
      const r = Math.floor(sq / 9), c = sq % 9;
      switch (this.eff(sq)) {
        case G:
          for (const [dr, dc] of ORTH) if (inPalace(r + dr, c + dc)) add(sq, r + dr, c + dc);
          break;
        case A:
          // Sĩ còn úp đi như sĩ thường (trong cung); chỉ sĩ đã lật mới đi khắp bàn
          for (const [dr, dc] of DIAG1) if (!this.hidden[sq] || inPalace(r + dr, c + dc)) add(sq, r + dr, c + dc);
          break;
        case E:
          for (const [dr, dc] of DIAG1) {
            const rr = r + 2 * dr, cc = c + 2 * dc;
            if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;
            // Tượng còn úp không qua sông; tượng đã lật đi khắp bàn
            if (!b[(r + dr) * 9 + c + dc] && (!this.hidden[sq] || ownSide(rr))) add(sq, rr, cc);
          }
          break;
        case H:
          for (const [dr, dc, lr, lc] of HORSE) {
            const lrr = r + lr, lcc = c + lc;
            if (lrr < 0 || lrr >= ROWS || lcc < 0 || lcc >= COLS) continue;
            if (!b[lrr * 9 + lcc]) add(sq, r + dr, c + dc);
          }
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
        case S:
          add(sq, r - us, c);
          if (!ownSide(r)) { add(sq, r, c - 1); add(sq, r, c + 1); }
          break;
      }
    }
    return out;
  }

  makeMove(m: DarkMove): void {
    const b = this.b, h = this.hidden;
    const piece = b[m.from];
    this.undos.push({ cap: b[m.to], capHidden: h[m.to], fromHidden: h[m.from] });
    b[m.to] = piece; b[m.from] = 0;
    h[m.to] = 0; h[m.from] = 0;
    if (Math.abs(piece) === G) this.kingSq[piece > 0 ? 0 : 1] = m.to;
    this.turn = -this.turn;
  }

  unmakeMove(m: DarkMove): void {
    const b = this.b, h = this.hidden;
    this.turn = -this.turn;
    const u = this.undos.pop() as { cap: number; capHidden: number; fromHidden: number };
    const piece = b[m.to];
    b[m.from] = piece; h[m.from] = u.fromHidden;
    b[m.to] = u.cap; h[m.to] = u.capHidden;
    if (Math.abs(piece) === G) this.kingSq[piece > 0 ? 0 : 1] = m.from;
  }

  legalMoves(): DarkMove[] {
    const res: DarkMove[] = [];
    const us = this.turn;
    for (const m of this.pseudo()) {
      this.makeMove(m);
      if (!this.inCheck(us)) res.push(m);
      this.unmakeMove(m);
    }
    return res;
  }

  status(): 'play' | 'checkmate' | 'stalemate' | 'draw' {
    if (!this.legalMoves().length) return this.inCheck() ? 'checkmate' : 'stalemate';
    const k = this.keys[this.keys.length - 1];
    if (this.keys.length > 400 || this.keys.filter((x) => x === k).length >= 3) return 'draw';
    return 'play';
  }

  /**
   * Bản sao trong đó các quân còn úp của mỗi bên được xáo lại ngẫu nhiên giữa các ô úp của bên đó:
   * máy dùng để đoán mà không nhìn trộm quân thật.
   */
  sample(rand: () => number = Math.random): DarkPosition {
    const p = this.clone();
    for (const side of [1, -1]) {
      const sqs: number[] = [];
      for (let i = 0; i < 90; i++) if (p.hidden[i] && p.b[i] * side > 0) sqs.push(i);
      const types = sqs.map((i) => Math.abs(p.b[i]));
      for (let i = types.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [types[i], types[j]] = [types[j], types[i]];
      }
      sqs.forEach((sq, i) => (p.b[sq] = side * types[i]));
    }
    return p;
  }
}

export const DARK_LEVELS: { depth: number; timeMs: number; noise: number; quiesce: boolean; samples: number; random?: boolean }[] = [
  { depth: 1, timeMs: 400, noise: 0, quiesce: false, samples: 1, random: true },
  { depth: 1, timeMs: 600, noise: 200, quiesce: false, samples: 1 },
  { depth: 1, timeMs: 800, noise: 90, quiesce: true, samples: 2 },
  { depth: 2, timeMs: 1000, noise: 70, quiesce: false, samples: 3 },
  { depth: 2, timeMs: 1200, noise: 30, quiesce: true, samples: 4 },
  { depth: 2, timeMs: 1600, noise: 15, quiesce: true, samples: 6 },
  { depth: 3, timeMs: 2000, noise: 0, quiesce: true, samples: 6 },
  { depth: 3, timeMs: 2400, noise: 0, quiesce: true, samples: 8 },
  { depth: 4, timeMs: 3000, noise: 0, quiesce: true, samples: 8 },
  { depth: 4, timeMs: 3500, noise: 0, quiesce: true, samples: 10 },
];

class DarkSearch implements SearchGame<DarkMove> {
  constructor(private p: DarkPosition) {}
  legalMoves() { return this.p.legalMoves(); }
  makeMove(m: DarkMove) { this.p.makeMove(m); }
  unmakeMove(m: DarkMove) { this.p.unmakeMove(m); }
  isCapture(m: DarkMove) { return m.cap !== 0; }
  moveScore(m: DarkMove) {
    return m.cap ? 10 * VALUE[Math.abs(m.cap)] - VALUE[this.p.eff(m.from)] / 10 + 1000 : 0;
  }
  noMovesScore(ply: number) { return -MATE + ply; }
  evaluate() {
    let s = 0;
    const b = this.p.b;
    for (let i = 0; i < 90; i++) {
      const v = b[i];
      if (!v) continue;
      const t = Math.abs(v), red = v > 0;
      const r = Math.floor(i / 9), c = i % 9;
      let sc = VALUE[t];
      // Quân còn úp chưa phát huy hết sức: trừ một chút để máy chịu lật quân ra
      if (this.p.hidden[i]) sc -= 15;
      const centre = 4 - Math.abs(c - 4);
      if (t === S) {
        const crossed = red ? r <= 4 : r >= 5;
        if (crossed) sc += 70 + centre * 5;
      } else if (t !== G) {
        sc += centre * 4;
        if (t === R || t === C) sc += (red ? 9 - r : r) * 2;
      }
      s += red ? sc : -sc;
    }
    return this.p.turn === 1 ? s : -s;
  }
}

const moveKey = (m: { from: number; to: number }) => m.from * 100 + m.to;

/** Nước đi của máy: xáo thử các quân úp nhiều lần, tìm nước tốt nhất trong từng lần rồi chọn nước được bầu nhiều nhất */
export function darkAiMove(p: DarkPosition, level: number, rand: () => number = Math.random): DarkMove | null {
  const cfg = DARK_LEVELS[Math.min(10, Math.max(1, level)) - 1];
  const legal = p.legalMoves();
  if (!legal.length) return null;
  if (cfg.random) return legal[Math.floor(rand() * legal.length)];
  const tally = new Map<number, { n: number; score: number }>();
  const per = cfg.timeMs / cfg.samples;
  for (let i = 0; i < cfg.samples; i++) {
    const q = p.sample(rand);
    const r = searchBest(new DarkSearch(q), { maxDepth: cfg.depth, timeMs: per, noise: cfg.noise, quiesce: cfg.quiesce });
    if (!r.move) continue;
    const k = moveKey(r.move);
    const e = tally.get(k) ?? { n: 0, score: 0 };
    e.n++;
    e.score += r.score;
    tally.set(k, e);
  }
  let best: DarkMove = legal[0];
  let bn = -1, bs = -Infinity;
  for (const m of legal) {
    const e = tally.get(moveKey(m));
    if (e && (e.n > bn || (e.n === bn && e.score > bs))) { best = m; bn = e.n; bs = e.score; }
  }
  return best;
}
