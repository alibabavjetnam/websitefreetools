/** Lõi trò xếp gạch rơi (thuần): bàn 10×20, 7 khối 4 ô, xoay có đẩy tường, túi 7 khối ngẫu nhiên. */
export const COLS = 10, ROWS = 20;

// Mỗi khối: 4 trạng thái xoay, mỗi trạng thái là 4 toạ độ [x, y] trong khung 4×4
const SHAPES: Record<string, number[][]> = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
};
export const KINDS = Object.keys(SHAPES);
export const COLOR: Record<string, string> = { I: '#22b8cf', O: '#fcc419', T: '#9c36b5', S: '#40c057', Z: '#fa5252', J: '#1c7ed6', L: '#fd7e14' };

function rotateCells(cells: number[][], kind: string, times: number): number[][] {
  let out = cells.map(([x, y]) => [x, y]);
  const size = kind === 'I' ? 4 : kind === 'O' ? 0 : 3;
  if (!size) return out;
  for (let k = 0; k < ((times % 4) + 4) % 4; k++) out = out.map(([x, y]) => [size - 1 - y, x]);
  return out;
}

export interface Piece { kind: string; rot: number; x: number; y: number }
export const cellsOf = (p: Piece): number[][] => rotateCells(SHAPES[p.kind], p.kind, p.rot).map(([x, y]) => [x + p.x, y + p.y]);

export class BlockGame {
  grid: string[] = new Array(COLS * ROWS).fill('');
  cur!: Piece;
  next: string[] = [];
  lines = 0; score = 0; over = false;
  private bag: string[] = [];
  constructor(private rand: () => number = Math.random) { this.fillNext(); this.spawn(); }

  private draw(): string {
    if (!this.bag.length) {
      this.bag = [...KINDS];
      for (let i = this.bag.length - 1; i > 0; i--) { const j = Math.floor(this.rand() * (i + 1)); [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]]; }
    }
    return this.bag.pop() as string;
  }
  private fillNext(): void { while (this.next.length < 3) this.next.push(this.draw()); }

  spawn(): void {
    const kind = this.next.shift() as string;
    this.fillNext();
    this.cur = { kind, rot: 0, x: 3, y: kind === 'I' ? -1 : 0 };
    if (!this.fits(this.cur)) this.over = true;
  }

  fits(p: Piece): boolean {
    for (const [x, y] of cellsOf(p)) {
      if (x < 0 || x >= COLS || y >= ROWS) return false;
      if (y >= 0 && this.grid[y * COLS + x]) return false;
    }
    return true;
  }

  shift(dx: number): boolean {
    const p = { ...this.cur, x: this.cur.x + dx };
    if (this.over || !this.fits(p)) return false;
    this.cur = p; return true;
  }

  rotate(dir = 1): boolean {
    if (this.over) return false;
    for (const kick of [0, -1, 1, -2, 2]) {
      for (const up of [0, -1]) {
        const p = { ...this.cur, rot: this.cur.rot + dir, x: this.cur.x + kick, y: this.cur.y + up };
        if (this.fits(p)) { this.cur = p; return true; }
      }
    }
    return false;
  }

  /** Rơi một ô; chạm đáy thì khoá khối. Trả về số hàng vừa xoá (-1 nếu chưa khoá). */
  step(): number {
    if (this.over) return -1;
    const p = { ...this.cur, y: this.cur.y + 1 };
    if (this.fits(p)) { this.cur = p; return -1; }
    return this.lock();
  }

  hardDrop(): number {
    if (this.over) return -1;
    let d = 0;
    while (this.fits({ ...this.cur, y: this.cur.y + 1 })) { this.cur.y++; d++; }
    this.score += d * 2;
    return this.lock();
  }

  ghostY(): number {
    let y = this.cur.y;
    while (this.fits({ ...this.cur, y: y + 1 })) y++;
    return y;
  }

  private lock(): number {
    for (const [x, y] of cellsOf(this.cur)) {
      if (y < 0) { this.over = true; continue; }
      this.grid[y * COLS + x] = this.cur.kind;
    }
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      let full = true;
      for (let c = 0; c < COLS; c++) if (!this.grid[r * COLS + c]) { full = false; break; }
      if (full) {
        this.grid.splice(r * COLS, COLS);
        this.grid.unshift(...new Array(COLS).fill(''));
        cleared++; r++;
      }
    }
    this.lines += cleared;
    this.score += [0, 100, 300, 500, 800][cleared];
    if (!this.over) this.spawn();
    return cleared;
  }
}

/** Cấp: tốc độ rơi (ms mỗi ô) và số hàng cần xoá */
export const BLOCK_LEVELS = Array.from({ length: 10 }, (_, i) => ({ ms: Math.round(800 * Math.pow(0.8, i)), lines: 10 + i * 2 }));
