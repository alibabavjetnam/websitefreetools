/** Sudoku 9x9 và 16x16: sinh đề có đáp án duy nhất, giải bằng bitmask. Phần tính thuần, không đụng DOM. */

export type Grid = number[]; // độ dài n*n, 0 = ô trống, 1..n = số

export interface Puzzle {
  n: number;
  box: number;
  puzzle: Grid;
  solution: Grid;
  clues: number;
}

/** Số gợi ý mục tiêu cho từng cấp 1..10 (càng ít càng khó). */
export const CLUE_TARGETS: Record<number, number[]> = {
  9: [45, 40, 36, 33, 30, 28, 26, 24, 23, 22],
  16: [195, 175, 158, 142, 130, 118, 108, 100, 92, 85],
};

function shuffled<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** Lưới đã giải xong, xáo hàng/cột trong từng dải và đổi nhãn số. */
export function makeSolved(n: number): Grid {
  const b = Math.round(Math.sqrt(n));
  const base = Array.from({ length: b }, (_, i) => i);
  const order = () => shuffled(base).flatMap((g) => shuffled(base).map((x) => g * b + x));
  const rows = order();
  const cols = order();
  const nums = shuffled(Array.from({ length: n }, (_, i) => i + 1));
  const g: Grid = new Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) g[r * n + c] = nums[(b * (rows[r] % b) + Math.floor(rows[r] / b) + cols[c]) % n];
  return g;
}

const popcount = (x: number): number => {
  let c = 0;
  while (x) { x &= x - 1; c++; }
  return c;
};

/** Đếm số nghiệm (dừng ở `limit`). Trả -1 nếu vượt `maxNodes` mà chưa kết luận. */
export function countSolutions(input: Grid, n: number, limit = 2, maxNodes = 60000): number {
  const b = Math.round(Math.sqrt(n));
  const full = (1 << n) - 1;
  const g = input.slice();
  const rows = new Array(n).fill(0), cols = new Array(n).fill(0), boxes = new Array(n).fill(0);
  const boxOf = (i: number) => Math.floor(Math.floor(i / n) / b) * b + Math.floor((i % n) / b);
  for (let i = 0; i < n * n; i++) {
    if (!g[i]) continue;
    const bit = 1 << (g[i] - 1);
    const r = Math.floor(i / n), c = i % n, k = boxOf(i);
    if ((rows[r] | cols[c] | boxes[k]) & bit) return 0; // đề tự mâu thuẫn
    rows[r] |= bit; cols[c] |= bit; boxes[k] |= bit;
  }
  let count = 0, nodes = 0, aborted = false;
  const rec = (): void => {
    if (count >= limit || aborted) return;
    if (++nodes > maxNodes) { aborted = true; return; }
    let best = -1, bestMask = 0, bestCnt = 99;
    for (let i = 0; i < n * n; i++) {
      if (g[i]) continue;
      const mask = full & ~(rows[Math.floor(i / n)] | cols[i % n] | boxes[boxOf(i)]);
      const cnt = popcount(mask);
      if (cnt < bestCnt) { best = i; bestMask = mask; bestCnt = cnt; if (cnt <= 1) break; }
    }
    if (best < 0) { count++; return; }
    if (bestCnt === 0) return;
    const r = Math.floor(best / n), c = best % n, k = boxOf(best);
    for (let m = bestMask; m && count < limit && !aborted; m &= m - 1) {
      const bit = m & -m;
      g[best] = 31 - Math.clz32(bit) + 1;
      rows[r] |= bit; cols[c] |= bit; boxes[k] |= bit;
      rec();
      rows[r] &= ~bit; cols[c] &= ~bit; boxes[k] &= ~bit;
    }
    g[best] = 0;
  };
  rec();
  return aborted && count < limit ? -1 : count;
}

/** Sinh đề cho cấp `level` (1..10). Luôn có đáp án duy nhất (kiểm tra cho từng ô bị xoá). */
export function generatePuzzle(n: 9 | 16, level: number, budgetMs = n === 9 ? 1500 : 2500): Puzzle {
  const lv = Math.min(10, Math.max(1, Math.round(level)));
  const solution = makeSolved(n);
  const puzzle = solution.slice();
  const target = CLUE_TARGETS[n][lv - 1];
  const t0 = Date.now();
  let clues = n * n;
  for (const i of shuffled(Array.from({ length: n * n }, (_, k) => k))) {
    if (clues <= target || Date.now() - t0 > budgetMs) break;
    const keep = puzzle[i];
    puzzle[i] = 0;
    // 16x16: chỉ chấp nhận khi chứng minh được duy nhất trong giới hạn nút tìm kiếm
    if (countSolutions(puzzle, n, 2, n === 9 ? 40000 : 6000) === 1) clues--;
    else puzzle[i] = keep;
  }
  return { n, box: Math.round(Math.sqrt(n)), puzzle, solution, clues };
}

/** Các ô đang trùng số với ô khác cùng hàng/cột/khối. */
export function conflicts(g: Grid, n: number): Set<number> {
  const b = Math.round(Math.sqrt(n));
  const bad = new Set<number>();
  const groups: number[][] = [];
  for (let r = 0; r < n; r++) groups.push(Array.from({ length: n }, (_, c) => r * n + c));
  for (let c = 0; c < n; c++) groups.push(Array.from({ length: n }, (_, r) => r * n + c));
  for (let k = 0; k < n; k++) {
    const br = Math.floor(k / b) * b, bc = (k % b) * b;
    groups.push(Array.from({ length: n }, (_, j) => (br + Math.floor(j / b)) * n + bc + (j % b)));
  }
  for (const grp of groups) {
    const seen = new Map<number, number>();
    for (const i of grp) {
      const v = g[i];
      if (!v) continue;
      if (seen.has(v)) { bad.add(i); bad.add(seen.get(v) as number); } else seen.set(v, i);
    }
  }
  return bad;
}

export const isComplete = (g: Grid, n: number): boolean => g.every((v) => v > 0) && conflicts(g, n).size === 0;

/** Ký tự hiển thị: 1-9 rồi A-G cho lưới 16x16. */
export const digitLabel = (v: number): string => (v <= 0 ? '' : v < 10 ? String(v) : String.fromCharCode(55 + v));
