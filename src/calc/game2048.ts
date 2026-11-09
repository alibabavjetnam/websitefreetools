/** Lõi trò 2048 (thuần, không DOM): bàn n×n, trượt 4 hướng, sinh ô 2/4. */
export type Dir = 'left' | 'right' | 'up' | 'down';

export interface Level2048 { size: number; target: number }
export const LEVELS_2048: Level2048[] = [
  { size: 4, target: 64 }, { size: 4, target: 128 }, { size: 4, target: 256 }, { size: 4, target: 512 },
  { size: 4, target: 1024 }, { size: 4, target: 2048 }, { size: 3, target: 256 }, { size: 3, target: 512 },
  { size: 4, target: 4096 }, { size: 5, target: 8192 },
];

export interface Board2048 { n: number; cells: number[]; score: number }

export function newBoard(n: number, rand: () => number = Math.random): Board2048 {
  const b: Board2048 = { n, cells: new Array(n * n).fill(0), score: 0 };
  spawn(b, rand); spawn(b, rand);
  return b;
}

export function spawn(b: Board2048, rand: () => number = Math.random): number {
  const empty = b.cells.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  if (!empty.length) return -1;
  const i = empty[Math.floor(rand() * empty.length)];
  b.cells[i] = rand() < 0.9 ? 2 : 4;
  return i;
}

/** Trượt một hàng về đầu mảng, gộp cặp bằng nhau (mỗi ô gộp một lần). */
export function slideLine(line: number[]): { out: number[]; gained: number; merged: boolean[] } {
  const vals = line.filter((v) => v);
  const out: number[] = [];
  const merged: boolean[] = [];
  let gained = 0;
  for (let i = 0; i < vals.length; i++) {
    if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
      out.push(vals[i] * 2); merged.push(true); gained += vals[i] * 2; i++;
    } else { out.push(vals[i]); merged.push(false); }
  }
  while (out.length < line.length) { out.push(0); merged.push(false); }
  return { out, gained, merged };
}

/** Thực hiện nước trượt; trả về false nếu bàn không đổi. merged: chỉ số ô vừa gộp. */
export function move(b: Board2048, dir: Dir): { moved: boolean; merged: number[] } {
  const n = b.n;
  let moved = false;
  const mergedIdx: number[] = [];
  for (let k = 0; k < n; k++) {
    const idx: number[] = [];
    for (let j = 0; j < n; j++) {
      if (dir === 'left') idx.push(k * n + j);
      else if (dir === 'right') idx.push(k * n + (n - 1 - j));
      else if (dir === 'up') idx.push(j * n + k);
      else idx.push((n - 1 - j) * n + k);
    }
    const { out, gained, merged } = slideLine(idx.map((i) => b.cells[i]));
    idx.forEach((i, j) => {
      if (b.cells[i] !== out[j]) moved = true;
      b.cells[i] = out[j];
      if (merged[j]) mergedIdx.push(i);
    });
    b.score += gained;
  }
  return { moved, merged: mergedIdx };
}

export function canMove(b: Board2048): boolean {
  const n = b.n;
  for (let i = 0; i < n * n; i++) {
    if (!b.cells[i]) return true;
    const r = Math.floor(i / n), c = i % n;
    if (c + 1 < n && b.cells[i] === b.cells[i + 1]) return true;
    if (r + 1 < n && b.cells[i] === b.cells[i + n]) return true;
  }
  return false;
}

export const maxTile = (b: Board2048): number => Math.max(...b.cells);
