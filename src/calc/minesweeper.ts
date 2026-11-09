/** Lõi dò mìn (thuần): đặt mìn sau cú mở đầu tiên (ô đầu và xung quanh luôn an toàn), mở loang, cắm cờ, mở nhanh. */
export interface MineLevel { w: number; h: number; mines: number }
export const MINE_LEVELS: MineLevel[] = [
  { w: 8, h: 8, mines: 8 }, { w: 9, h: 9, mines: 10 }, { w: 9, h: 9, mines: 13 }, { w: 10, h: 10, mines: 16 },
  { w: 12, h: 12, mines: 24 }, { w: 14, h: 14, mines: 32 }, { w: 16, h: 16, mines: 40 }, { w: 16, h: 16, mines: 46 },
  { w: 16, h: 16, mines: 52 }, { w: 18, h: 18, mines: 68 },
];

export type CellState = 0 | 1 | 2; // 0 úp, 1 mở, 2 cờ

export class Minefield {
  readonly w: number; readonly h: number; readonly mines: number;
  mine: Uint8Array; num: Uint8Array; state: Uint8Array;
  placed = false; exploded = -1; opened = 0;

  constructor(lv: MineLevel) {
    this.w = lv.w; this.h = lv.h; this.mines = lv.mines;
    const n = lv.w * lv.h;
    this.mine = new Uint8Array(n); this.num = new Uint8Array(n); this.state = new Uint8Array(n);
  }

  neighbors(i: number): number[] {
    const out: number[] = [];
    const r = Math.floor(i / this.w), c = i % this.w;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < this.h && cc >= 0 && cc < this.w) out.push(rr * this.w + cc);
    }
    return out;
  }

  place(safe: number, rand: () => number = Math.random): void {
    const n = this.w * this.h;
    const ban = new Set([safe, ...this.neighbors(safe)]);
    const pool: number[] = [];
    for (let i = 0; i < n; i++) if (!ban.has(i)) pool.push(i);
    const need = Math.min(this.mines, pool.length);
    for (let k = 0; k < need; k++) {
      const j = k + Math.floor(rand() * (pool.length - k));
      [pool[k], pool[j]] = [pool[j], pool[k]];
      this.mine[pool[k]] = 1;
    }
    for (let i = 0; i < n; i++) this.num[i] = this.neighbors(i).reduce((a, j) => a + this.mine[j], 0);
    this.placed = true;
  }

  /** Mở ô; trả về false nếu trúng mìn. */
  open(i: number, rand?: () => number): boolean {
    if (!this.placed) this.place(i, rand);
    if (this.state[i] !== 0) return true;
    if (this.mine[i]) { this.state[i] = 1; this.exploded = i; return false; }
    const stack = [i];
    while (stack.length) {
      const j = stack.pop() as number;
      if (this.state[j] !== 0) continue;
      this.state[j] = 1; this.opened++;
      if (this.num[j] === 0) for (const k of this.neighbors(j)) if (this.state[k] === 0 && !this.mine[k]) stack.push(k);
    }
    return true;
  }

  /** Mở nhanh quanh ô số khi đã cắm đủ cờ. Trả về false nếu trúng mìn. */
  chord(i: number): boolean {
    if (this.state[i] !== 1 || !this.num[i]) return true;
    const nb = this.neighbors(i);
    if (nb.filter((j) => this.state[j] === 2).length !== this.num[i]) return true;
    let ok = true;
    for (const j of nb) if (this.state[j] === 0) ok = this.open(j) && ok;
    return ok;
  }

  toggleFlag(i: number): void {
    if (this.state[i] === 0) this.state[i] = 2;
    else if (this.state[i] === 2) this.state[i] = 0;
  }

  flags(): number { let f = 0; for (const s of this.state) if (s === 2) f++; return f; }
  won(): boolean { return this.placed && this.exploded < 0 && this.opened === this.w * this.h - this.mines; }
}
