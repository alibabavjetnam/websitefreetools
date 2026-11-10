/** Lõi Nối điểm (Dots and Boxes) và Ultimate Tic-Tac-Toe. Thuần, không đụng DOM. */
const rnd = (n: number): number => Math.floor(Math.random() * n);

/* ============================== Dots and Boxes ============================== */
export const DOTS_SIZE = [3, 3, 3, 4, 4, 4, 5, 5, 5, 6];
/** Đường: id < (n+1)*n là ngang h(r,c)=r*n+c; phần còn lại là dọc v(r,c)=base + r*(n+1)+c */
export interface Dots { n: number; line: number[]; box: number[] } // line: 0 chưa, 1 người, 2 máy
export const dotsNew = (n: number): Dots => ({ n, line: new Array((n + 1) * n * 2).fill(0), box: new Array(n * n).fill(0) });
export const dotsBase = (n: number): number => (n + 1) * n;
export function boxSides(d: Dots, r: number, c: number): number[] {
  const n = d.n, base = dotsBase(n);
  return [r * n + c, (r + 1) * n + c, base + r * (n + 1) + c, base + r * (n + 1) + c + 1];
}
export function lineBoxes(d: Dots, id: number): number[] {
  const n = d.n, base = dotsBase(n), out: number[] = [];
  if (id < base) { const r = Math.floor(id / n), c = id % n; if (r > 0) out.push((r - 1) * n + c); if (r < n) out.push(r * n + c); }
  else { const k = id - base, r = Math.floor(k / (n + 1)), c = k % (n + 1); if (c > 0) out.push(r * n + c - 1); if (c < n) out.push(r * n + c); }
  return out;
}
const sidesDrawn = (d: Dots, b: number): number => boxSides(d, Math.floor(b / d.n), b % d.n).filter((l) => d.line[l]).length;
/** Vẽ đường; trả số ô vừa khép kín */
export function dotsPlay(d: Dots, id: number, who: 1 | 2): number {
  d.line[id] = who;
  let got = 0;
  for (const b of lineBoxes(d, id)) if (!d.box[b] && sidesDrawn(d, b) === 4) { d.box[b] = who; got++; }
  return got;
}
export const dotsOver = (d: Dots): boolean => d.box.every(Boolean);
export const dotsScore = (d: Dots): [number, number] => [d.box.filter((x) => x === 1).length, d.box.filter((x) => x === 2).length];
/** Máy chọn đường: level cao dùng chiến thuật (ăn ô, tránh tặng ô 3 cạnh), level thấp đi ngẫu nhiên */
export function dotsAi(d: Dots, level: number): number {
  const free: number[] = [];
  d.line.forEach((v, i) => { if (!v) free.push(i); });
  const smart = Math.random() < (level - 1) / 9 * 0.95 + (level > 1 ? 0.05 : 0);
  if (!smart) return free[rnd(free.length)];
  const take = free.filter((l) => lineBoxes(d, l).some((b) => !d.box[b] && sidesDrawn(d, b) === 3));
  if (take.length) return take[rnd(take.length)];
  const safe = free.filter((l) => lineBoxes(d, l).every((b) => d.box[b] || sidesDrawn(d, b) < 2));
  if (safe.length) return safe[rnd(safe.length)];
  // phải tặng ô: chọn đường tặng ít nhất (đếm ô có 2 cạnh kề)
  let best = free[0], bestV = Infinity;
  for (const l of free) { const v = lineBoxes(d, l).filter((b) => !d.box[b] && sidesDrawn(d, b) === 2).length + Math.random() * 0.5; if (v < bestV) { bestV = v; best = l; } }
  return best;
}

/* ============================== Ultimate Tic-Tac-Toe ============================== */
export interface Ut { cells: Uint8Array; local: Uint8Array; next: number; turn: 1 | 2; winner: number } // winner 0 chưa, 1, 2, 3 hoà
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
export const utNew = (): Ut => ({ cells: new Uint8Array(81), local: new Uint8Array(9), next: -1, turn: 1, winner: 0 });
export const utClone = (s: Ut): Ut => ({ cells: s.cells.slice(), local: s.local.slice(), next: s.next, turn: s.turn, winner: s.winner });
const lineWin = (get: (i: number) => number): number => {
  for (const [a, b, c] of LINES) { const v = get(a); if (v && v < 3 && v === get(b) && v === get(c)) return v; }
  return 0;
};
export function utMoves(s: Ut): number[] {
  if (s.winner) return [];
  const out: number[] = [];
  const boards = s.next >= 0 && !s.local[s.next] ? [s.next] : Array.from({ length: 9 }, (_, i) => i).filter((i) => !s.local[i]);
  for (const b of boards) for (let c = 0; c < 9; c++) if (!s.cells[b * 9 + c]) out.push(b * 9 + c);
  return out;
}
export function utPlay(s: Ut, m: number): void {
  const b = Math.floor(m / 9), c = m % 9;
  s.cells[m] = s.turn;
  const w = lineWin((i) => s.cells[b * 9 + i]);
  if (w) s.local[b] = w; else if (Array.from({ length: 9 }, (_, i) => s.cells[b * 9 + i]).every(Boolean)) s.local[b] = 3;
  const g = lineWin((i) => s.local[i]);
  if (g) s.winner = g; else if (s.local.every(Boolean)) s.winner = 3;
  s.next = s.local[c] ? -1 : c;
  s.turn = s.turn === 1 ? 2 : 1;
}
function playout(s0: Ut): number {
  const s = utClone(s0);
  while (!s.winner) { const mv = utMoves(s); utPlay(s, mv[rnd(mv.length)]); }
  return s.winner;
}
/** Máy (quân O): cấp 1 ngẫu nhiên; cấp 2-3 ưu tiên thắng ô nhỏ/chặn; cấp cao mô phỏng ngẫu nhiên theo ngân sách thời gian */
export function utAi(s: Ut, level: number): number {
  const mv = utMoves(s);
  if (level === 1) return mv[rnd(mv.length)];
  const me = s.turn;
  if (level <= 3) {
    const win = (m: number, who: number): boolean => { const t = utClone(s); t.turn = who as 1 | 2; const b = Math.floor(m / 9); utPlay(t, m); return t.local[b] === who && s.local[b] !== who; };
    const mine = mv.filter((m) => win(m, me)); if (mine.length && Math.random() < 0.5 + 0.2 * level) return mine[rnd(mine.length)];
    const opp = mv.filter((m) => win(m, me === 1 ? 2 : 1)); if (opp.length && Math.random() < 0.2 * level) return opp[rnd(opp.length)];
    return mv[rnd(mv.length)];
  }
  const budget = 150 + (level - 4) * 190; // ms
  const t0 = Date.now();
  const score = new Float64Array(mv.length), cnt = new Float64Array(mv.length);
  let i = 0;
  while (Date.now() - t0 < budget) {
    const k = i++ % mv.length;
    const t = utClone(s); utPlay(t, mv[k]);
    const w = t.winner || playout(t);
    cnt[k]++; score[k] += w === me ? 1 : w === 3 ? 0.5 : 0;
  }
  let best = 0, bv = -1;
  for (let k = 0; k < mv.length; k++) { const v = score[k] / Math.max(1, cnt[k]); if (v > bv) { bv = v; best = k; } }
  return mv[best];
}
