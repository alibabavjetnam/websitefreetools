/** Lõi các game giải đố đợt 3 (thuần, không đụng DOM): Lights Out, 15-puzzle, Sokoban, Flood-it, Mastermind, Nonogram, Nối ống, Tháp Hà Nội, Block 10x10. */
const rnd = (n: number): number => Math.floor(Math.random() * n);
const clampLv = (lv: number): number => Math.min(10, Math.max(1, lv));

/* ============================== Lights Out ============================== */
export const LIGHTS_SIZE = [3, 3, 4, 4, 5, 5, 5, 6, 6, 7];
export function lightsPress(b: boolean[], n: number, i: number): void {
  const r = Math.floor(i / n), c = i % n;
  for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < n && cc >= 0 && cc < n) b[rr * n + cc] = !b[rr * n + cc];
  }
}
/** Bàn có lời giải: bắt đầu từ bàn tắt hết rồi bấm ngẫu nhiên */
export function lightsNew(level: number): { n: number; b: boolean[] } {
  const n = LIGHTS_SIZE[clampLv(level) - 1];
  for (;;) {
    const b = new Array(n * n).fill(false);
    const presses = Math.round(n * n * (0.35 + 0.05 * level));
    for (let k = 0; k < presses; k++) lightsPress(b, n, rnd(n * n));
    if (b.some((x) => x)) return { n, b };
  }
}
/** Giải bằng khử Gauss trên GF(2): trả danh sách ô cần bấm (hoặc null nếu vô nghiệm) */
export function lightsSolve(b: boolean[], n: number): number[] | null {
  const N = n * n;
  const m: number[][] = [];
  for (let i = 0; i < N; i++) {
    const row = new Array(N + 1).fill(0);
    const t: boolean[] = new Array(N).fill(false);
    lightsPress(t, n, i);
    t.forEach((v, j) => { if (v) row[j] = 1; });
    row[N] = b[i] ? 1 : 0;
    m.push(row);
  }
  // Ma trận đối xứng nên cột = hàng
  const piv: number[] = new Array(N).fill(-1);
  let r = 0;
  for (let c = 0; c < N && r < N; c++) {
    let p = -1;
    for (let i = r; i < N; i++) if (m[i][c]) { p = i; break; }
    if (p < 0) continue;
    [m[r], m[p]] = [m[p], m[r]];
    for (let i = 0; i < N; i++) if (i !== r && m[i][c]) for (let j = c; j <= N; j++) m[i][j] ^= m[r][j];
    piv[c] = r; r++;
  }
  for (let i = r; i < N; i++) if (m[i][N]) return null;
  const out: number[] = [];
  for (let c = 0; c < N; c++) if (piv[c] >= 0 && m[piv[c]][N]) out.push(c);
  return out;
}

/* ============================== 15-puzzle ============================== */
export const FIFTEEN_SIZE = [3, 3, 3, 4, 4, 4, 4, 5, 5, 5];
export const fifteenSolved = (n: number): number[] => Array.from({ length: n * n }, (_, i) => (i + 1) % (n * n));
/** Xáo bằng các nước hợp lệ nên luôn giải được; số nước tăng theo cấp */
export function fifteenNew(level: number): { n: number; t: number[] } {
  const n = FIFTEEN_SIZE[clampLv(level) - 1];
  const t = fifteenSolved(n);
  let blank = n * n - 1, prev = -1;
  const steps = n * n * (6 + level * 3);
  for (let k = 0; k < steps; k++) {
    const r = Math.floor(blank / n), c = blank % n;
    const nb: number[] = [];
    if (r > 0) nb.push(blank - n);
    if (r < n - 1) nb.push(blank + n);
    if (c > 0) nb.push(blank - 1);
    if (c < n - 1) nb.push(blank + 1);
    const opts = nb.filter((x) => x !== prev);
    const to = opts[rnd(opts.length)];
    t[blank] = t[to]; t[to] = 0; prev = blank; blank = to;
  }
  if (t.every((v, i) => v === fifteenSolved(n)[i])) return fifteenNew(level);
  return { n, t };
}
/** Trượt cả hàng/cột từ ô i về phía ô trống; trả true nếu có đi */
export function fifteenSlide(t: number[], n: number, i: number): boolean {
  const b = t.indexOf(0);
  const r = Math.floor(i / n), c = i % n, br = Math.floor(b / n), bc = b % n;
  if (i === b || (r !== br && c !== bc)) return false;
  const step = r === br ? (bc > c ? 1 : -1) : (br > r ? n : -n);
  let cur = b;
  while (cur !== i) { t[cur] = t[cur - step]; cur -= step; }
  t[i] = 0;
  return true;
}
export const fifteenWon = (t: number[], n: number): boolean => fifteenSolved(n).every((v, i) => t[i] === v);

/* ============================== Sokoban ============================== */
export interface SokoLevel { w: number; h: number; walls: boolean[]; goals: boolean[]; boxes: boolean[]; player: number }
const SOKO = [
  { w: 6, h: 6, box: 1, steps: 40 }, { w: 7, h: 6, box: 2, steps: 60 }, { w: 7, h: 7, box: 2, steps: 90 }, { w: 8, h: 7, box: 3, steps: 120 },
  { w: 8, h: 8, box: 3, steps: 180 }, { w: 9, h: 8, box: 4, steps: 240 }, { w: 9, h: 9, box: 4, steps: 320 }, { w: 10, h: 9, box: 5, steps: 420 },
  { w: 10, h: 10, box: 5, steps: 560 }, { w: 11, h: 10, box: 6, steps: 700 },
];
/** Sinh bàn bằng cách "kéo ngược" thùng từ ô đích nên chắc chắn giải được */
export function sokoNew(level: number): SokoLevel {
  const cfg = SOKO[clampLv(level) - 1];
  for (let attempt = 0; attempt < 200; attempt++) {
    const { w, h } = cfg;
    const walls = new Array(w * h).fill(false);
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (r === 0 || c === 0 || r === h - 1 || c === w - 1) walls[r * w + c] = true;
    const extra = Math.round(w * h * 0.08);
    for (let k = 0; k < extra; k++) walls[(1 + rnd(h - 2)) * w + 1 + rnd(w - 2)] = true;
    const free: number[] = [];
    walls.forEach((x, i) => { if (!x) free.push(i); });
    if (free.length < cfg.box * 3 + 4) continue;
    // chọn ô đích: các ô không phải góc cứng
    const pick: number[] = [];
    const shuffled = free.slice().sort(() => Math.random() - 0.5);
    for (const i of shuffled) {
      if (pick.length >= cfg.box) break;
      pick.push(i);
    }
    const goals = new Array(w * h).fill(false);
    const boxes = new Array(w * h).fill(false);
    pick.forEach((i) => { goals[i] = true; boxes[i] = true; });
    const p0 = shuffled.find((i) => !boxes[i]);
    if (p0 === undefined) continue;
    let p: number = p0;
    const dirs = [-1, 1, -w, w];
    for (let s = 0; s < cfg.steps; s++) {
      const d = dirs[rnd(4)];
      const to = p + d;
      if (walls[to] || boxes[to]) continue;
      // kéo: thùng phía sau người (cạnh vị trí cũ, ngược hướng đi) đi theo vào ô người vừa rời
      const behind = p - d;
      const pull = boxes[behind] && Math.random() < 0.85;
      if (pull) { boxes[behind] = false; boxes[p] = true; }
      p = to;
    }
    // loại bàn đã xong hoặc có thùng bị kẹt ở góc (khó chịu nhưng vẫn hợp lệ → chỉ cần có ít nhất một thùng chưa vào đích)
    if (boxes.every((b, i) => b === goals[i])) continue;
    return { w, h, walls, goals, boxes, player: p };
  }
  return { w: 6, h: 6, walls: Array.from({ length: 36 }, (_, i) => i < 6 || i >= 30 || i % 6 === 0 || i % 6 === 5), goals: Object.assign(new Array(36).fill(false), { 14: true }), boxes: Object.assign(new Array(36).fill(false), { 15: true }), player: 16 };
}
/** Đi một bước; trả trạng thái mới hoặc null nếu bị chặn */
export function sokoMove(l: SokoLevel, dir: 0 | 1 | 2 | 3): SokoLevel | null {
  const d = [-l.w, l.w, -1, 1][dir];
  const to = l.player + d;
  if (l.walls[to]) return null;
  let boxes = l.boxes;
  if (boxes[to]) {
    const beyond = to + d;
    if (l.walls[beyond] || boxes[beyond]) return null;
    boxes = boxes.slice(); boxes[to] = false; boxes[beyond] = true;
  }
  return { ...l, boxes, player: to };
}
export const sokoWon = (l: SokoLevel): boolean => l.boxes.every((b, i) => !b || l.goals[i]) && l.goals.every((g, i) => !g || l.boxes[i]);

/* ============================== Flood-it ============================== */
export const FLOOD_CFG = [
  { n: 8, colors: 4 }, { n: 8, colors: 4 }, { n: 10, colors: 5 }, { n: 10, colors: 5 }, { n: 12, colors: 5 },
  { n: 12, colors: 6 }, { n: 14, colors: 6 }, { n: 14, colors: 6 }, { n: 16, colors: 6 }, { n: 18, colors: 6 },
];
export function floodFill(g: number[], n: number, color: number): number {
  const old = g[0];
  if (old === color) return 0;
  const stack = [0], seen = new Uint8Array(n * n);
  let cnt = 0;
  seen[0] = 1;
  while (stack.length) {
    const i = stack.pop() as number;
    g[i] = color; cnt++;
    const r = Math.floor(i / n), c = i % n;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
      const j = rr * n + cc;
      if (!seen[j] && g[j] === old) { seen[j] = 1; stack.push(j); }
    }
  }
  return cnt;
}
export const floodDone = (g: number[]): boolean => g.every((v) => v === g[0]);
/** Số ô của vùng đang chiếm (liền với ô góc trên trái) */
export function floodRegion(g: number[], n: number): number {
  const col = g[0], seen = new Uint8Array(n * n), stack = [0];
  seen[0] = 1;
  let cnt = 0;
  while (stack.length) {
    const i = stack.pop() as number;
    cnt++;
    const r = Math.floor(i / n), c = i % n;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
      const j = rr * n + cc;
      if (!seen[j] && g[j] === col) { seen[j] = 1; stack.push(j); }
    }
  }
  return cnt;
}
/** Số nước tham lam (mỗi lần chọn màu nuốt được nhiều ô nhất) */
export function floodGreedy(g0: number[], n: number, colors: number): number {
  const g = g0.slice();
  let steps = 0;
  while (!floodDone(g) && steps < 500) {
    let best = -1, bestV = -1;
    for (let c = 0; c < colors; c++) {
      if (c === g[0]) continue;
      const t = g.slice(); floodFill(t, n, c);
      const v = floodRegion(t, n);
      if (v > bestV) { bestV = v; best = c; }
    }
    floodFill(g, n, best); steps++;
  }
  return steps;
}
export function floodNew(level: number): { n: number; colors: number; g: number[]; limit: number } {
  const { n, colors } = FLOOD_CFG[clampLv(level) - 1];
  const g = Array.from({ length: n * n }, () => rnd(colors));
  const greedy = floodGreedy(g, n, colors);
  const slack = Math.max(0, Math.round(greedy * (0.22 - 0.022 * level)));
  return { n, colors, g, limit: greedy + slack };
}

/* ============================== Mastermind ============================== */
export const MM_CFG = [
  { len: 3, colors: 4, tries: 10 }, { len: 3, colors: 5, tries: 10 }, { len: 4, colors: 5, tries: 10 }, { len: 4, colors: 6, tries: 10 }, { len: 4, colors: 6, tries: 9 },
  { len: 4, colors: 7, tries: 9 }, { len: 4, colors: 8, tries: 9 }, { len: 5, colors: 6, tries: 10 }, { len: 5, colors: 7, tries: 9 }, { len: 5, colors: 8, tries: 9 },
];
export const mmNew = (level: number): number[] => { const c = MM_CFG[clampLv(level) - 1]; return Array.from({ length: c.len }, () => rnd(c.colors)); };
export function mmScore(code: number[], guess: number[]): { black: number; white: number } {
  let black = 0;
  const cc: number[] = [], gc: number[] = [];
  code.forEach((v, i) => { if (guess[i] === v) black++; else { cc[v] = (cc[v] || 0) + 1; gc[guess[i]] = (gc[guess[i]] || 0) + 1; } });
  let white = 0;
  for (let k = 0; k < cc.length; k++) white += Math.min(cc[k] || 0, gc[k] || 0);
  return { black, white };
}

/* ============================== Nonogram ============================== */
export const NONO_SIZE = [5, 5, 6, 7, 8, 8, 10, 10, 12, 15];
export function nonoNew(level: number): { n: number; sol: boolean[] } {
  const n = NONO_SIZE[clampLv(level) - 1];
  const dens = 0.55 + 0.02 * (level % 3);
  for (;;) {
    const sol = Array.from({ length: n * n }, () => Math.random() < dens);
    // mỗi hàng/cột có ít nhất 1 ô
    let ok = true;
    for (let i = 0; i < n && ok; i++) {
      if (!sol.slice(i * n, i * n + n).some((x) => x)) ok = false;
      if (!Array.from({ length: n }, (_, r) => sol[r * n + i]).some((x) => x)) ok = false;
    }
    if (ok) return { n, sol };
  }
}
export function nonoClues(cells: boolean[], n: number): { rows: number[][]; cols: number[][] } {
  const line = (get: (k: number) => boolean): number[] => {
    const out: number[] = []; let run = 0;
    for (let k = 0; k < n; k++) { if (get(k)) run++; else if (run) { out.push(run); run = 0; } }
    if (run) out.push(run);
    return out.length ? out : [0];
  };
  return { rows: Array.from({ length: n }, (_, r) => line((k) => cells[r * n + k])), cols: Array.from({ length: n }, (_, c) => line((k) => cells[k * n + c])) };
}
export const nonoLineOk = (clue: number[], got: number[]): boolean => clue.length === got.length && clue.every((v, i) => v === got[i]);

/* ============================== Nối ống ============================== */
/** Mỗi ô có mặt nạ cạnh: 1 lên, 2 phải, 4 xuống, 8 trái */
export const PIPE_SIZE = [3, 4, 4, 5, 5, 6, 6, 7, 8, 9];
export function pipesNew(level: number): { n: number; t: number[] } {
  const n = PIPE_SIZE[clampLv(level) - 1];
  const t = new Array(n * n).fill(0);
  const seen = new Uint8Array(n * n);
  const stack = [rnd(n * n)];
  seen[stack[0]] = 1;
  while (stack.length) {
    const i = stack[stack.length - 1];
    const r = Math.floor(i / n), c = i % n;
    const nb: [number, number, number][] = [];
    if (r > 0 && !seen[i - n]) nb.push([i - n, 1, 4]);
    if (c < n - 1 && !seen[i + 1]) nb.push([i + 1, 2, 8]);
    if (r < n - 1 && !seen[i + n]) nb.push([i + n, 4, 1]);
    if (c > 0 && !seen[i - 1]) nb.push([i - 1, 8, 2]);
    if (!nb.length) { stack.pop(); continue; }
    const [j, a, b] = nb[rnd(nb.length)];
    t[i] |= a; t[j] |= b; seen[j] = 1; stack.push(j);
  }
  // xoay ngẫu nhiên
  for (let i = 0; i < t.length; i++) for (let k = rnd(4); k > 0; k--) t[i] = pipeRot(t[i]);
  // nếu đã giải sẵn thì xoay thêm một ô
  if (pipesWon(t, n)) { const i = t.findIndex((v) => v !== 15 && v !== 5 && v !== 10); if (i >= 0) t[i] = pipeRot(t[i]); }
  return { n, t };
}
export const pipeRot = (m: number): number => ((m << 1) | (m >> 3)) & 15;
/** Thắng khi mọi cạnh mở đều khớp với ô bên cạnh (cây liền mạch) */
export function pipesWon(t: number[], n: number): boolean {
  for (let i = 0; i < t.length; i++) {
    const r = Math.floor(i / n), c = i % n, m = t[i];
    if ((m & 1) && !(r > 0 && (t[i - n] & 4))) return false;
    if ((m & 4) && !(r < n - 1 && (t[i + n] & 1))) return false;
    if ((m & 2) && !(c < n - 1 && (t[i + 1] & 8))) return false;
    if ((m & 8) && !(c > 0 && (t[i - 1] & 2))) return false;
  }
  return true;
}
/** Ô nào còn cạnh hở (chưa khớp) */
export function pipesOpen(t: number[], n: number): boolean[] {
  return t.map((m, i) => {
    const r = Math.floor(i / n), c = i % n;
    return !!((m & 1) && !(r > 0 && (t[i - n] & 4))) || !!((m & 4) && !(r < n - 1 && (t[i + n] & 1))) || !!((m & 2) && !(c < n - 1 && (t[i + 1] & 8))) || !!((m & 8) && !(c > 0 && (t[i - 1] & 2)));
  });
}

/* ============================== Tháp Hà Nội ============================== */
export const HANOI_CFG = [
  { pegs: 3, discs: 3 }, { pegs: 3, discs: 4 }, { pegs: 3, discs: 5 }, { pegs: 3, discs: 6 }, { pegs: 3, discs: 7 },
  { pegs: 3, discs: 8 }, { pegs: 4, discs: 6 }, { pegs: 4, discs: 8 }, { pegs: 4, discs: 10 }, { pegs: 4, discs: 12 },
];
/** Số nước tối thiểu (3 cọc: 2^n-1; 4 cọc: Frame–Stewart) */
export function hanoiMin(pegs: number, n: number): number {
  if (pegs === 3) return 2 ** n - 1;
  const memo = new Map<number, number>();
  const f4 = (k: number): number => {
    if (k <= 1) return k;
    const hit = memo.get(k); if (hit !== undefined) return hit;
    let best = Infinity;
    for (let j = 1; j < k; j++) best = Math.min(best, 2 * f4(j) + (2 ** (k - j) - 1));
    memo.set(k, best); return best;
  };
  return f4(n);
}
export function hanoiNew(level: number): { pegs: number[][]; discs: number } {
  const { pegs, discs } = HANOI_CFG[clampLv(level) - 1];
  const p: number[][] = Array.from({ length: pegs }, () => []);
  for (let d = discs; d >= 1; d--) p[0].push(d);
  return { pegs: p, discs };
}
export const hanoiCanMove = (p: number[][], from: number, to: number): boolean => from !== to && p[from].length > 0 && (!p[to].length || p[to][p[to].length - 1] > p[from][p[from].length - 1]);

/* ============================== Block 10x10 ============================== */
export type Shape = number[][]; // các ô [r,c]
const SHAPES: { s: Shape; w: number }[] = [
  { s: [[0, 0]], w: 1 }, { s: [[0, 0], [0, 1]], w: 2 }, { s: [[0, 0], [1, 0]], w: 2 }, { s: [[0, 0], [0, 1], [0, 2]], w: 2 }, { s: [[0, 0], [1, 0], [2, 0]], w: 2 },
  { s: [[0, 0], [0, 1], [1, 0], [1, 1]], w: 3 }, { s: [[0, 0], [0, 1], [0, 2], [0, 3]], w: 2 }, { s: [[0, 0], [1, 0], [2, 0], [3, 0]], w: 2 },
  { s: [[0, 0], [1, 0], [1, 1]], w: 2 }, { s: [[0, 0], [0, 1], [1, 0]], w: 2 }, { s: [[0, 0], [0, 1], [1, 1]], w: 2 }, { s: [[0, 1], [1, 0], [1, 1]], w: 2 },
  { s: [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]], w: 1 }, { s: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]], w: 1 }, { s: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], w: 1 },
  { s: [[0, 2], [1, 2], [2, 0], [2, 1], [2, 2]], w: 1 }, { s: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]], w: 1 }, { s: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]], w: 1 },
  { s: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], w: 1 }, { s: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], w: 1 }, { s: [[0, 0], [0, 1], [0, 2], [1, 1]], w: 1 }, { s: [[0, 0], [1, 0], [2, 0], [1, 1]], w: 1 },
];
export const BLOCK_TARGET = [300, 400, 500, 650, 800, 1000, 1250, 1500, 1800, 2200];
export const BLOCK_N = 10;
/** Cấp cao: ưu tiên mảnh to nhiều hơn (khó hơn) */
export function blockPieces(level: number): Shape[] {
  const bias = (level - 1) / 9;
  const pool = SHAPES.map((x) => ({ s: x.s, w: x.w + (x.s.length >= 4 ? bias * 3 : 0) }));
  const total = pool.reduce((s, x) => s + x.w, 0);
  const pick = (): Shape => { let t = Math.random() * total; for (const x of pool) { t -= x.w; if (t <= 0) return x.s; } return pool[0].s; };
  return [pick(), pick(), pick()];
}
export const blockCanPlace = (b: boolean[], s: Shape, r: number, c: number): boolean => s.every(([dr, dc]) => { const rr = r + dr, cc = c + dc; return rr >= 0 && rr < BLOCK_N && cc >= 0 && cc < BLOCK_N && !b[rr * BLOCK_N + cc]; });
export const blockFits = (b: boolean[], s: Shape): boolean => { for (let r = 0; r < BLOCK_N; r++) for (let c = 0; c < BLOCK_N; c++) if (blockCanPlace(b, s, r, c)) return true; return false; };
/** Đặt mảnh, xoá hàng/cột đầy; trả điểm và số đường xoá */
export function blockPlace(b: boolean[], s: Shape, r: number, c: number): { score: number; lines: number } {
  s.forEach(([dr, dc]) => { b[(r + dr) * BLOCK_N + c + dc] = true; });
  const rows: number[] = [], cols: number[] = [];
  for (let i = 0; i < BLOCK_N; i++) {
    if (Array.from({ length: BLOCK_N }, (_, k) => b[i * BLOCK_N + k]).every(Boolean)) rows.push(i);
    if (Array.from({ length: BLOCK_N }, (_, k) => b[k * BLOCK_N + i]).every(Boolean)) cols.push(i);
  }
  rows.forEach((i) => { for (let k = 0; k < BLOCK_N; k++) b[i * BLOCK_N + k] = false; });
  cols.forEach((i) => { for (let k = 0; k < BLOCK_N; k++) b[k * BLOCK_N + i] = false; });
  const lines = rows.length + cols.length;
  return { score: s.length + lines * 10 * lines, lines };
}
