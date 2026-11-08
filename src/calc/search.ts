/** Tìm nước đi dùng chung cho cờ vua và cờ tướng: negamax + alpha-beta + tìm tiếp các nước ăn quân, giới hạn thời gian. */

export interface SearchGame<M> {
  legalMoves(): M[];
  makeMove(m: M): void;
  unmakeMove(m: M): void;
  /** Điểm theo góc nhìn của bên đang đến lượt (centipawn). */
  evaluate(): number;
  isCapture(m: M): boolean;
  /** Điểm gợi ý để sắp xếp nước đi (ăn quân giá trị cao bằng quân rẻ trước). */
  moveScore(m: M): number;
  /** Điểm khi bên đến lượt hết nước đi hợp lệ (bị chiếu bí / hết nước). Âm = thua. */
  noMovesScore(ply: number): number;
}

export interface SearchOptions {
  maxDepth: number;
  timeMs: number;
  /** Nhiễu ngẫu nhiên (centipawn) cộng vào điểm từng nước ở gốc: máy yếu hơn, ít lặp lại. */
  noise: number;
  quiesce: boolean;
}

export const MATE = 100000;

class Timeout extends Error {}

export function searchBest<M>(g: SearchGame<M>, opt: SearchOptions): { move: M | null; score: number; depth: number } {
  const root = g.legalMoves();
  if (!root.length) return { move: null, score: g.noMovesScore(0), depth: 0 };
  const t0 = Date.now();
  let nodes = 0;
  const check = () => {
    if ((++nodes & 1023) === 0 && Date.now() - t0 > opt.timeMs) throw new Timeout();
  };
  const order = (ms: M[]) => ms.map((m) => ({ m, s: g.moveScore(m) })).sort((a, b) => b.s - a.s).map((x) => x.m);

  const quiet = (alpha: number, beta: number, ply: number): number => {
    check();
    const stand = g.evaluate();
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (ply > 12) return stand;
    const caps = order(g.legalMoves().filter((m) => g.isCapture(m)));
    for (const m of caps) {
      g.makeMove(m);
      let sc: number;
      try { sc = -quiet(-beta, -alpha, ply + 1); } finally { g.unmakeMove(m); }
      if (sc >= beta) return sc;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  };

  const negamax = (depth: number, alpha: number, beta: number, ply: number): number => {
    check();
    const ms = g.legalMoves();
    if (!ms.length) return g.noMovesScore(ply);
    if (depth <= 0) return opt.quiesce ? quiet(alpha, beta, ply) : g.evaluate();
    let best = -Infinity;
    for (const m of order(ms)) {
      g.makeMove(m);
      let sc: number;
      try { sc = -negamax(depth - 1, -beta, -alpha, ply + 1); } finally { g.unmakeMove(m); }
      if (sc > best) best = sc;
      if (sc > alpha) alpha = sc;
      if (alpha >= beta) break;
    }
    return best;
  };

  let bestMove: M = root[0];
  let bestScore = -Infinity;
  let doneDepth = 0;

  if (opt.noise > 0) {
    // Máy yếu: chấm điểm từng nước ở gốc với cửa sổ đầy đủ rồi cộng nhiễu. Hết giờ thì dùng những nước đã chấm.
    try {
      for (const m of root) {
        g.makeMove(m);
        let sc: number;
        try { sc = -negamax(opt.maxDepth - 1, -Infinity, Infinity, 1) + (Math.random() * 2 - 1) * opt.noise; } finally { g.unmakeMove(m); }
        if (sc > bestScore) { bestScore = sc; bestMove = m; }
      }
      doneDepth = opt.maxDepth;
    } catch (e) {
      if (!(e instanceof Timeout)) throw e;
    }
    return { move: bestMove, score: bestScore, depth: doneDepth };
  }

  // Máy mạnh: đào sâu dần, giữ kết quả của độ sâu hoàn chỉnh cuối cùng
  let ordered = order(root);
  for (let d = 1; d <= opt.maxDepth; d++) {
    let curBest: M = ordered[0];
    let curScore = -Infinity;
    try {
      for (const m of ordered) {
        g.makeMove(m);
        let sc: number;
        try { sc = -negamax(d - 1, -MATE * 2, -Math.max(curScore, -MATE * 2), 1); } finally { g.unmakeMove(m); }
        if (sc > curScore) { curScore = sc; curBest = m; }
      }
    } catch (e) {
      if (!(e instanceof Timeout)) throw e;
      break;
    }
    bestMove = curBest; bestScore = curScore; doneDepth = d;
    ordered = [curBest, ...ordered.filter((x) => x !== curBest)];
    if (Math.abs(curScore) > MATE - 100) break;
    if (Date.now() - t0 > opt.timeMs * 0.6) break;
  }
  return { move: bestMove, score: bestScore, depth: doneDepth };
}
