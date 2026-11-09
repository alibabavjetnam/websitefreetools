/**
 * Ô ăn quan (trò dân gian Việt Nam, họ Mancala). Vòng 12 ô: 0 = ô quan trái, 1-5 = năm ô dân của người chơi (dưới, trái → phải),
 * 6 = ô quan phải, 7-11 = năm ô dân của máy (trên, phải → trái). Mỗi ô dân 5 dân, mỗi ô quan 1 quan (= 10 điểm).
 */
import { MATE, searchBest, type SearchGame } from './search';

export interface OqState {
  dan: number[];      // số dân mỗi ô (ô quan có thể chứa dân rải vào)
  quan: boolean[];    // chỉ ô 0 và 6 có thể còn quan
  score: [number, number]; // [người, máy]
  turn: 0 | 1;
  over: boolean;
}
export interface OqMove { sq: number; dir: 1 | -1 }
export const QUAN_VALUE = 10;
export const isBig = (i: number): boolean => i === 0 || i === 6;
export const ownSquares = (side: 0 | 1): number[] => (side === 0 ? [1, 2, 3, 4, 5] : [7, 8, 9, 10, 11]);

export function oqNew(first: 0 | 1 = 0): OqState {
  const dan = new Array(12).fill(5); dan[0] = 0; dan[6] = 0;
  return { dan, quan: [true, false, false, false, false, false, true, false, false, false, false, false], score: [0, 0], turn: first, over: false };
}
const clone = (s: OqState): OqState => ({ dan: s.dan.slice(), quan: s.quan.slice(), score: [s.score[0], s.score[1]], turn: s.turn, over: s.over });
const mod = (i: number): number => ((i % 12) + 12) % 12;
const hasContent = (s: OqState, i: number): boolean => s.dan[i] > 0 || s.quan[i];

export function oqMoves(s: OqState): OqMove[] {
  if (s.over) return [];
  const out: OqMove[] = [];
  for (const sq of ownSquares(s.turn)) if (s.dan[sq] > 0) { out.push({ sq, dir: 1 }); out.push({ sq, dir: -1 }); }
  return out;
}

/** Hết dân ở phía mình: đặt 5 dân từ điểm đã ăn vào 5 ô (không đủ điểm thì ván kết thúc) */
function refill(s: OqState): void {
  const sq = ownSquares(s.turn);
  if (sq.some((i) => s.dan[i] > 0)) return;
  if (s.score[s.turn] >= 5) { s.score[s.turn] -= 5; sq.forEach((i) => { s.dan[i] = 1; }); }
  else finish(s);
}
function finish(s: OqState): void {
  for (const side of [0, 1] as const) for (const i of ownSquares(side)) { s.score[side] += s.dan[i]; s.dan[i] = 0; }
  s.over = true;
}

/** Thực hiện nước đi và trả về trạng thái mới (đã đổi lượt) */
export function oqPlay(st: OqState, m: OqMove): OqState {
  const s = clone(st);
  const side = s.turn;
  let hand = s.dan[m.sq];
  s.dan[m.sq] = 0;
  let pos = m.sq;
  for (let guard = 0; guard < 300; guard++) {
    while (hand > 0) { pos = mod(pos + m.dir); s.dan[pos]++; hand--; }
    const next = mod(pos + m.dir);
    if (!isBig(next) && s.dan[next] > 0) { hand = s.dan[next]; s.dan[next] = 0; pos = next; continue; }
    if (isBig(next)) break;
    // ô kế trống: ăn ô liền sau nếu có (ăn liên tiếp)
    let cur = next;
    while (!hasContent(s, cur)) {
      const target = mod(cur + m.dir);
      if (!hasContent(s, target)) break;
      s.score[side] += s.dan[target] + (s.quan[target] ? QUAN_VALUE : 0);
      s.dan[target] = 0; s.quan[target] = false;
      cur = mod(target + m.dir);
    }
    break;
  }
  s.turn = side === 0 ? 1 : 0;
  if (!s.quan[0] && !s.quan[6]) finish(s);
  else {
    refill(s);
    if (!s.over && !oqMoves(s).length) finish(s);
  }
  return s;
}

/** 1 người thắng, -1 máy thắng, 0 hoà (chỉ hỏi khi ván đã kết thúc) */
export const oqWinner = (s: OqState): number => Math.sign(s.score[0] - s.score[1]);

/* ----------------------------- Máy ----------------------------- */
export const OQ_LEVELS: { depth: number; noise: number; random?: boolean }[] = [
  { depth: 1, noise: 0, random: true }, { depth: 1, noise: 40 }, { depth: 1, noise: 15 }, { depth: 2, noise: 15 }, { depth: 2, noise: 4 },
  { depth: 3, noise: 6 }, { depth: 3, noise: 0 }, { depth: 3, noise: 2 }, { depth: 4, noise: 3 }, { depth: 4, noise: 0 },
];

export const OQ_EVAL = { dan: 0.3 };

class OqSearch implements SearchGame<OqMove> {
  private stack: OqState[] = [];
  constructor(private s: OqState) {}
  legalMoves() { return oqMoves(this.s); }
  makeMove(m: OqMove) { this.stack.push(this.s); this.s = oqPlay(this.s, m); }
  unmakeMove() { this.s = this.stack.pop() as OqState; }
  isCapture() { return false; }
  moveScore(m: OqMove) { return this.s.dan[m.sq]; }
  noMovesScore() { return 0; }
  evaluate() {
    const s = this.s;
    let v = (s.score[1] - s.score[0]) * 10;
    for (const i of ownSquares(1)) v += s.dan[i] * OQ_EVAL.dan;
    for (const i of ownSquares(0)) v -= s.dan[i] * OQ_EVAL.dan;
    if (s.over) v = (s.score[1] - s.score[0]) * 1000;
    // góc nhìn của bên đến lượt (searchBest dùng negamax)
    return s.turn === 1 ? v : -v;
  }
}
export function oqAiMove(s: OqState, level: number): OqMove | null {
  const cfg = OQ_LEVELS[Math.min(10, Math.max(1, level)) - 1];
  const legal = oqMoves(s);
  if (!legal.length) return null;
  if (cfg.random) return legal[Math.floor(Math.random() * legal.length)];
  void MATE;
  return searchBest(new OqSearch(s), { maxDepth: cfg.depth, timeMs: 1500, noise: cfg.noise, quiesce: false }).move;
}
