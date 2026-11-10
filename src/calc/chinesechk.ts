/** Cờ nhảy (Chinese checkers) 2 người: sao 6 cánh 121 ô, mỗi bên 10 quân. Tọa độ khối (q, r, s = -q - r). */
export interface Cell { q: number; r: number }
export const key = (q: number, r: number): number => (q + 8) * 17 + (r + 8);
export const CELLS: Cell[] = [];
for (let q = -8; q <= 8; q++) for (let r = -8; r <= 8; r++) {
  const s = -q - r;
  if (Math.abs(s) > 8) continue;
  if (Math.min(q, r, s) >= -4 || Math.max(q, r, s) <= 4) CELLS.push({ q, r });
}
export const IN = new Set(CELLS.map((c) => key(c.q, c.r)));
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];

/** Trại người chơi (q >= 5) và trại máy (q <= -5) */
export const HOME_P = CELLS.filter((c) => c.q >= 5).map((c) => key(c.q, c.r));
export const HOME_A = CELLS.filter((c) => c.q <= -5).map((c) => key(c.q, c.r));
const cellOf = (k: number): Cell => ({ q: Math.floor(k / 17) - 8, r: (k % 17) - 8 });
export const cell = cellOf;
const TIP_A = { q: -8, r: 4 }, TIP_P = { q: 8, r: -4 };
const dist = (a: Cell, b: Cell): number => Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.q + a.r - b.q - b.r));

export interface Board { p: Set<number>; a: Set<number> }
export const newBoard = (): Board => ({ p: new Set(HOME_P), a: new Set(HOME_A) });

/** Mọi ô đến được từ ô k (bước 1 ô hoặc nhảy liên tiếp) */
export function reach(b: Board, k: number): number[] {
  const occ = (x: number) => b.p.has(x) || b.a.has(x);
  const out = new Set<number>();
  const c0 = cellOf(k);
  for (const [dq, dr] of DIRS) {
    const n = key(c0.q + dq, c0.r + dr);
    if (IN.has(n) && !occ(n)) out.add(n);
  }
  const seen = new Set<number>([k]);
  const stack = [k];
  while (stack.length) {
    const cur = stack.pop() as number;
    const c = cellOf(cur);
    for (const [dq, dr] of DIRS) {
      const mid = key(c.q + dq, c.r + dr), land = key(c.q + 2 * dq, c.r + 2 * dr);
      if (!IN.has(land) || !occ(mid) || occ(land) || seen.has(land)) continue;
      seen.add(land); out.add(land); stack.push(land);
    }
  }
  return [...out];
}

export interface Mv { from: number; to: number }
export function allMoves(b: Board, side: 'p' | 'a'): Mv[] {
  const res: Mv[] = [];
  for (const k of side === 'p' ? b.p : b.a) for (const to of reach(b, k)) res.push({ from: k, to });
  return res;
}
export function apply(b: Board, side: 'p' | 'a', m: Mv): void {
  const s = side === 'p' ? b.p : b.a;
  s.delete(m.from); s.add(m.to);
}
export function undo(b: Board, side: 'p' | 'a', m: Mv): void {
  const s = side === 'p' ? b.p : b.a;
  s.delete(m.to); s.add(m.from);
}

/** Thắng: lấp kín trại đối phương và có ít nhất một quân của mình trong đó */
export function won(b: Board, side: 'p' | 'a'): boolean {
  const goal = side === 'p' ? HOME_A : HOME_P, mine = side === 'p' ? b.p : b.a;
  return goal.every((k) => b.p.has(k) || b.a.has(k)) && goal.some((k) => mine.has(k));
}

/** Điểm lệch (nhỏ hơn là tốt hơn): tổng khoảng cách tới đỉnh trại đích, quân tụt lại bị phạt thêm */
function cost(set: Set<number>, tip: Cell): number {
  let sum = 0, worst = 0;
  for (const k of set) { const d = dist(cellOf(k), tip); sum += d; if (d > worst) worst = d; }
  return sum + worst * 1.5;
}
const evalA = (b: Board): number => cost(b.p, TIP_A) - cost(b.a, TIP_P); // dương = máy lợi

const NOISE = [1, 0.7, 0.45, 0.25, 0.1, 0.05, 0, 0, 0, 0];
const DEPTH = [0, 0, 1, 1, 1, 2, 2, 2, 2, 2];

/** Chọn nước cho máy theo cấp 1..10 */
export function aiMove(b: Board, level: number, rand: () => number = Math.random): Mv | null {
  const mv = allMoves(b, 'a');
  if (!mv.length) return null;
  if (level === 1) {
    // cấp 1: đi gần như ngẫu nhiên nhưng ưu tiên nước tiến
    const fw = mv.filter((m) => dist(cellOf(m.to), TIP_P) < dist(cellOf(m.from), TIP_P));
    const pool = rand() < 0.6 && fw.length ? fw : mv;
    return pool[Math.floor(rand() * pool.length)];
  }
  const noise = NOISE[level - 1], depth = DEPTH[level - 1];
  let best: Mv | null = null, bestV = -Infinity;
  for (const m of mv) {
    apply(b, 'a', m);
    let v: number;
    if (won(b, 'a')) v = 1e6;
    else if (depth >= 2) {
      // người chơi trả lời nước tốt nhất theo cùng thước đo
      let worst = Infinity;
      const pm = allMoves(b, 'p');
      for (const p of pm) {
        apply(b, 'p', p);
        const e = evalA(b);
        if (e < worst) worst = e;
        undo(b, 'p', p);
      }
      v = worst === Infinity ? evalA(b) : worst;
    } else v = evalA(b);
    undo(b, 'a', m);
    v += (rand() - 0.5) * 2 * noise * 6;
    if (v > bestV) { bestV = v; best = m; }
  }
  return best;
}
