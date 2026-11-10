/** Lõi thuần Kakuro và KenKen (đề ngẫu nhiên, thắng khi mọi ràng buộc được thoả — không cần trùng đáp án gốc). */
const ri = (a: number, b: number): number => a + Math.floor(Math.random() * (b - a + 1));
function shuffle<T>(a: T[]): T[] { for (let i = a.length - 1; i > 0; i--) { const j = ri(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ============================ KenKen ============================ */
export type KOp = '=' | '+' | '-' | 'x' | '/';
export interface Cage { cells: number[]; op: KOp; target: number }
export interface KenKen { n: number; sol: number[]; cages: Cage[]; cageOf: number[] }
export const kenkenSize = (level: number): number => [3, 3, 4, 4, 4, 5, 5, 5, 6, 6][Math.min(10, Math.max(1, level)) - 1];

export function kenkenNew(level: number): KenKen {
  const n = kenkenSize(level), l = Math.min(10, Math.max(1, level));
  const rows = shuffle(Array.from({ length: n }, (_, i) => i)), cols = shuffle(Array.from({ length: n }, (_, i) => i)), sym = shuffle(Array.from({ length: n }, (_, i) => i + 1));
  const sol: number[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) sol.push(sym[(rows[r] + cols[c]) % n]);
  const cageOf = new Array(n * n).fill(-1), cages: Cage[] = [];
  const maxSize = l <= 2 ? 2 : l <= 5 ? 3 : 4;
  for (const start of shuffle(Array.from({ length: n * n }, (_, i) => i))) {
    if (cageOf[start] >= 0) continue;
    const want = ri(l <= 2 ? 1 : 1, maxSize) === 1 && Math.random() < 0.5 ? 1 : ri(2, maxSize);
    const cells = [start]; cageOf[start] = cages.length;
    while (cells.length < want) {
      const opts: number[] = [];
      for (const c of cells) { const r = Math.floor(c / n), q = c % n; for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) { const rr = r + dr, qq = q + dc; if (rr >= 0 && rr < n && qq >= 0 && qq < n && cageOf[rr * n + qq] < 0) opts.push(rr * n + qq); } }
      if (!opts.length) break;
      const nx = opts[ri(0, opts.length - 1)]; cells.push(nx); cageOf[nx] = cages.length;
    }
    const vals = cells.map((c) => sol[c]);
    let op: KOp, target: number;
    if (cells.length === 1) { op = '='; target = vals[0]; }
    else if (cells.length === 2) {
      const [a, b] = vals, hi = Math.max(a, b), lo = Math.min(a, b), pool: KOp[] = ['+', '-'];
      if (l >= 3) pool.push('x'); if (l >= 3 && hi % lo === 0) pool.push('/');
      op = pool[ri(0, pool.length - 1)];
      target = op === '+' ? a + b : op === '-' ? hi - lo : op === 'x' ? a * b : hi / lo;
    } else { op = l >= 4 && Math.random() < 0.45 ? 'x' : '+'; target = op === '+' ? vals.reduce((x, y) => x + y, 0) : vals.reduce((x, y) => x * y, 1); }
    cages.push({ cells, op, target });
  }
  return { n, sol, cages, cageOf };
}
export function cageOk(g: number[], cg: Cage): boolean {
  const v = cg.cells.map((c) => g[c]);
  if (v.some((x) => !x)) return false;
  switch (cg.op) {
    case '=': return v[0] === cg.target;
    case '+': return v.reduce((a, b) => a + b, 0) === cg.target;
    case 'x': return v.reduce((a, b) => a * b, 1) === cg.target;
    case '-': return Math.abs(v[0] - v[1]) === cg.target;
    default: return Math.max(v[0], v[1]) / Math.min(v[0], v[1]) === cg.target;
  }
}
/** Ô trùng số trong cùng hàng/cột */
export function dupCells(g: number[], n: number): Set<number> {
  const bad = new Set<number>();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const v = g[r * n + c]; if (!v) continue;
    for (let k = 0; k < n; k++) { if (k !== c && g[r * n + k] === v) bad.add(r * n + c); if (k !== r && g[k * n + c] === v) bad.add(r * n + c); }
  }
  return bad;
}
export const kenkenSolved = (k: KenKen, g: number[]): boolean => g.every((v) => v > 0) && dupCells(g, k.n).size === 0 && k.cages.every((c) => cageOk(g, c));

/* ============================ Kakuro ============================ */
export interface Kakuro { n: number; white: boolean[]; sol: number[]; right: number[]; down: number[] } // right/down: tổng gợi ý đặt tại ô đen đứng trước dãy (0 = không có)
export const kakuroSize = (level: number): number => [5, 5, 6, 6, 7, 7, 8, 8, 9, 9][Math.min(10, Math.max(1, level)) - 1];

export function kakuroNew(level: number): Kakuro {
  const n = kakuroSize(level), l = Math.min(10, Math.max(1, level));
  for (let attempt = 0; attempt < 200; attempt++) {
    const white: boolean[] = Array.from({ length: n * n }, (_, i) => Math.floor(i / n) > 0 && i % n > 0 && Math.random() >= 0.18 + l * 0.012);
    // loại ô có dãy ngang/dọc dài 1 (lặp tới khi ổn định)
    let changed = true;
    while (changed) {
      changed = false;
      for (let r = 1; r < n; r++) for (let c = 1; c < n; c++) {
        if (!white[r * n + c]) continue;
        const h = (c > 0 && white[r * n + c - 1] ? 1 : 0) + (c < n - 1 && white[r * n + c + 1] ? 1 : 0);
        const v = (r > 0 && white[(r - 1) * n + c] ? 1 : 0) + (r < n - 1 && white[(r + 1) * n + c] ? 1 : 0);
        if (h === 0 || v === 0) { white[r * n + c] = false; changed = true; }
      }
    }
    const cnt = white.filter(Boolean).length;
    if (cnt < n * n * 0.4) continue;
    // điền số: không trùng trong dãy
    const sol = new Array(n * n).fill(0);
    const order: number[] = []; for (let i = 0; i < n * n; i++) if (white[i]) order.push(i);
    const seen = (i: number, v: number): boolean => {
      const r = Math.floor(i / n), c = i % n;
      for (let k = c - 1; k >= 0 && white[r * n + k]; k--) if (sol[r * n + k] === v) return true;
      for (let k = r - 1; k >= 0 && white[k * n + c]; k--) if (sol[k * n + c] === v) return true;
      return false;
    };
    let ok = true;
    for (const i of order) {
      const opts = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((v) => !seen(i, v)));
      if (!opts.length) { ok = false; break; }
      sol[i] = opts[0];
    }
    if (!ok) continue;
    const right = new Array(n * n).fill(0), down = new Array(n * n).fill(0);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (white[r * n + c]) continue;
      let s = 0, k = c + 1; while (k < n && white[r * n + k]) { s += sol[r * n + k]; k++; } right[r * n + c] = s;
      s = 0; k = r + 1; while (k < n && white[k * n + c]) { s += sol[k * n + c]; k++; } down[r * n + c] = s;
    }
    return { n, white, sol, right, down };
  }
  throw new Error('kakuro');
}
/** các dãy: {cells, sum} */
export function kakuroRuns(k: Kakuro): { cells: number[]; sum: number }[] {
  const n = k.n, runs: { cells: number[]; sum: number }[] = [];
  for (let i = 0; i < n * n; i++) {
    if (k.white[i]) continue;
    const r = Math.floor(i / n), c = i % n;
    if (k.right[i]) { const cells: number[] = []; for (let q = c + 1; q < n && k.white[r * n + q]; q++) cells.push(r * n + q); runs.push({ cells, sum: k.right[i] }); }
    if (k.down[i]) { const cells: number[] = []; for (let q = r + 1; q < n && k.white[q * n + c]; q++) cells.push(q * n + c); runs.push({ cells, sum: k.down[i] }); }
  }
  return runs;
}
export function kakuroBad(k: Kakuro, g: number[]): Set<number> {
  const bad = new Set<number>();
  for (const ru of kakuroRuns(k)) {
    const v = ru.cells.map((c) => g[c]), seen = new Set<number>();
    v.forEach((x, i) => { if (x && seen.has(x)) { bad.add(ru.cells[i]); } if (x) seen.add(x); });
    if (v.every(Boolean) && v.reduce((a, b) => a + b, 0) !== ru.sum) ru.cells.forEach((c) => bad.add(c));
    else if (v.reduce((a, b) => a + b, 0) > ru.sum) ru.cells.forEach((c) => bad.add(c));
  }
  return bad;
}
export const kakuroSolved = (k: Kakuro, g: number[]): boolean => k.white.every((w, i) => !w || g[i] > 0) && kakuroBad(k, g).size === 0;
