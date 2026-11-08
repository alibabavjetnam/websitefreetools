/** Cờ vây: luật (bắt quân, cấm tự sát, cấm cướp lặp tức thì "ko"), chấm điểm theo diện tích, máy đấu Monte-Carlo 10 cấp. */

export const EMPTY = 0, BLACK = 1, WHITE = 2;
export type Cells = Uint8Array;

export interface GoLevel { size: 5 | 7 | 9; komi: number }
/** Cấp 1-2: bàn 5x5, cấp 3-5: 7x7, cấp 6-10: 9x9. */
export const GO_LEVELS: GoLevel[] = [
  { size: 5, komi: 0.5 }, { size: 5, komi: 0.5 },
  { size: 7, komi: 4.5 }, { size: 7, komi: 4.5 }, { size: 7, komi: 4.5 },
  { size: 9, komi: 6.5 }, { size: 9, komi: 6.5 }, { size: 9, komi: 6.5 }, { size: 9, komi: 6.5 }, { size: 9, komi: 6.5 },
];

const nbrCache = new Map<number, Int16Array[]>();
function neighbors(n: number): Int16Array[] {
  let t = nbrCache.get(n);
  if (t) return t;
  t = [];
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n), c = i % n, l: number[] = [];
    if (r > 0) l.push(i - n);
    if (r < n - 1) l.push(i + n);
    if (c > 0) l.push(i - 1);
    if (c < n - 1) l.push(i + 1);
    t.push(Int16Array.from(l));
  }
  nbrCache.set(n, t);
  return t;
}

/** Bộ đệm dùng lại để duyệt nhóm quân mà không cấp phát mới. */
class Scratch {
  stamp: Int32Array;
  cur = 0;
  stack: Int16Array;
  group: Int16Array;
  size = 0;
  libs = 0;
  constructor(n: number) { this.stamp = new Int32Array(n * n * 2); this.stack = new Int16Array(n * n); this.group = new Int16Array(n * n); }
}
const scratchCache = new Map<number, Scratch>();
const scratchFor = (n: number) => { let s = scratchCache.get(n); if (!s) { s = new Scratch(n); scratchCache.set(n, s); } return s; };

/** Duyệt nhóm chứa `idx`: điền sc.group/sc.size và đếm số khí (sc.libs). */
function scan(cells: Cells, n: number, idx: number, sc: Scratch): void {
  const nb = neighbors(n);
  const color = cells[idx];
  if (sc.cur > 2_000_000_000) { sc.stamp.fill(0); sc.cur = 0; }
  sc.cur += 2;
  const mark = sc.cur; // mark: quân đã thăm; mark+1: khí đã đếm
  let sp = 0;
  sc.size = 0; sc.libs = 0;
  sc.stack[sp++] = idx; sc.stamp[idx] = mark;
  while (sp) {
    const p = sc.stack[--sp];
    sc.group[sc.size++] = p;
    for (const q of nb[p]) {
      const v = cells[q];
      if (v === EMPTY) {
        if (sc.stamp[q + n * n] !== mark + 1) { sc.stamp[q + n * n] = mark + 1; sc.libs++; }
      } else if (v === color && sc.stamp[q] !== mark) { sc.stamp[q] = mark; sc.stack[sp++] = q; }
    }
  }
}

export interface PlayResult { captured: number[]; ko: number }

/** Đặt quân; trả null nếu bất hợp lệ (đã có quân, ko, tự sát). Thành công thì sửa `cells` tại chỗ. */
export function play(cells: Cells, n: number, ko: number, idx: number, color: number): PlayResult | null {
  if (cells[idx] !== EMPTY || idx === ko) return null;
  const nb = neighbors(n);
  const sc = scratchFor(n);
  const enemy = color === BLACK ? WHITE : BLACK;
  cells[idx] = color;
  const captured: number[] = [];
  for (const q of nb[idx]) {
    if (cells[q] !== enemy) continue;
    scan(cells, n, q, sc);
    if (sc.libs === 0) for (let i = 0; i < sc.size; i++) { captured.push(sc.group[i]); }
    // xoá ngay để lần duyệt kế tiếp không đếm lại nhóm đã bị bắt
    if (sc.libs === 0) for (let i = 0; i < sc.size; i++) cells[captured[captured.length - sc.size + i]] = EMPTY;
  }
  scan(cells, n, idx, sc);
  if (sc.libs === 0) {
    cells[idx] = EMPTY;
    for (const c of captured) cells[c] = enemy;
    return null;
  }
  const newKo = captured.length === 1 && sc.size === 1 && sc.libs === 1 ? captured[0] : -1;
  return { captured, ko: newKo };
}

/** Điểm theo diện tích: quân + vùng trống chỉ giáp một màu. */
export function areaScore(cells: Cells, n: number): { black: number; white: number } {
  const nb = neighbors(n);
  let black = 0, white = 0;
  const seen = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) {
    if (cells[i] === BLACK) black++;
    else if (cells[i] === WHITE) white++;
    else if (!seen[i]) {
      let touchB = false, touchW = false, size = 0;
      const st = [i];
      seen[i] = 1;
      while (st.length) {
        const p = st.pop() as number;
        size++;
        for (const q of nb[p]) {
          if (cells[q] === EMPTY) { if (!seen[q]) { seen[q] = 1; st.push(q); } }
          else if (cells[q] === BLACK) touchB = true;
          else touchW = true;
        }
      }
      if (touchB && !touchW) black += size;
      else if (touchW && !touchB) white += size;
    }
  }
  return { black, white };
}

const isOwnEye = (cells: Cells, n: number, idx: number, color: number): boolean => {
  for (const q of neighbors(n)[idx]) if (cells[q] !== color) return false;
  return true;
};

/** Một ván chơi thử ngẫu nhiên (ưu tiên bắt quân bị atari / cứu quân) đến khi hai bên bỏ lượt; trả (Đen - Trắng) theo diện tích. */
function playout(start: Cells, n: number, startKo: number, toPlay: number, lastMove: number): number {
  const cells = start.slice();
  let ko = startKo, color = toPlay, passes = 0, last = lastMove;
  const sc = scratchFor(n);
  const nb = neighbors(n);
  const total = n * n;
  for (let step = 0; step < total * 3 && passes < 2; step++) {
    let moved = false;
    const enemy = color === BLACK ? WHITE : BLACK;
    // 1) bắt/cứu quân quanh nước vừa đi
    if (last >= 0 && Math.random() < 0.85) {
      let target = -1;
      const around = [last, ...nb[last]];
      for (const p of around) {
        const v = cells[p];
        if (v === EMPTY) continue;
        scan(cells, n, p, sc);
        if (sc.libs !== 1) continue;
        // tìm khí duy nhất
        let lib = -1;
        for (let g = 0; g < sc.size && lib < 0; g++) for (const q of nb[sc.group[g]]) if (cells[q] === EMPTY) { lib = q; break; }
        if (lib >= 0 && (v === enemy || (v === color && sc.size > 1))) { target = lib; if (v === enemy) break; }
      }
      if (target >= 0 && !isOwnEye(cells, n, target, color)) {
        const r = play(cells, n, ko, target, color);
        if (r) { ko = r.ko; last = target; moved = true; }
      }
    }
    // 2) nước ngẫu nhiên hợp lệ, không lấp mắt của mình
    if (!moved) {
      const start0 = Math.floor(Math.random() * total);
      for (let k = 0; k < total; k++) {
        const idx = (start0 + k) % total;
        if (cells[idx] !== EMPTY || idx === ko || isOwnEye(cells, n, idx, color)) continue;
        const r = play(cells, n, ko, idx, color);
        if (r) { ko = r.ko; last = idx; moved = true; break; }
      }
    }
    if (moved) passes = 0; else { passes++; ko = -1; last = -1; }
    color = enemy;
  }
  const s = areaScore(cells, n);
  return s.black - s.white;
}

/** Các nước hợp lệ, không lấp mắt của mình. */
export function candidateMoves(cells: Cells, n: number, ko: number, color: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n * n; i++) {
    if (cells[i] !== EMPTY || i === ko || isOwnEye(cells, n, i, color)) continue;
    const copy = cells.slice();
    if (play(copy, n, ko, i, color)) out.push(i);
  }
  return out;
}

const GO_TIME = [0, 0, 150, 300, 500, 800, 1200, 1800, 2500, 3500];

/** Máy chọn nước: trả chỉ số ô, hoặc -1 nếu bỏ lượt. */
export function goAiMove(cells: Cells, n: number, ko: number, color: number, level: number, opponentPassed: boolean, komi: number): number {
  const lv = Math.min(10, Math.max(1, level));
  const cands = candidateMoves(cells, n, ko, color);
  const sign = color === BLACK ? 1 : -1;
  if (opponentPassed) {
    const s = areaScore(cells, n);
    const diff = (s.black - s.white - komi) * sign;
    if (diff > 0) return -1; // đang thắng, đối thủ đã bỏ lượt: kết thúc
  }
  if (!cands.length) return -1;
  if (lv === 1) return cands[Math.floor(Math.random() * cands.length)];
  if (lv === 2) {
    // bắt quân nếu được, nếu không thì ngẫu nhiên
    let best: number[] = [], bestCap = 0;
    for (const m of cands) {
      const copy = cells.slice();
      const r = play(copy, n, ko, m, color);
      if (r && r.captured.length > bestCap) { bestCap = r.captured.length; best = [m]; } else if (r && r.captured.length === bestCap && bestCap > 0) best.push(m);
    }
    const pool = best.length ? best : cands;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const budget = GO_TIME[lv - 1];
  const wins = new Float64Array(cands.length), visits = new Float64Array(cands.length);
  const after: { cells: Cells; ko: number }[] = cands.map((m) => {
    const copy = cells.slice();
    const r = play(copy, n, ko, m, color) as PlayResult;
    return { cells: copy, ko: r.ko };
  });
  const enemy = color === BLACK ? WHITE : BLACK;
  const t0 = Date.now();
  let total = 0;
  const one = (i: number) => {
    const diff = playout(after[i].cells, n, after[i].ko, enemy, cands[i]) - komi;
    wins[i] += diff * sign > 0 ? 1 : 0;
    visits[i]++; total++;
  };
  for (let i = 0; i < cands.length; i++) one(i);
  while (Date.now() - t0 < budget) {
    for (let k = 0; k < 20; k++) {
      let bi = 0, bv = -1;
      const ln = Math.log(total + 1);
      for (let i = 0; i < cands.length; i++) {
        const u = wins[i] / visits[i] + 0.7 * Math.sqrt(ln / visits[i]);
        if (u > bv) { bv = u; bi = i; }
      }
      one(bi);
    }
  }
  let best = 0;
  for (let i = 1; i < cands.length; i++) if (visits[i] > visits[best] || (visits[i] === visits[best] && wins[i] > wins[best])) best = i;
  return cands[best];
}
