/** Lõi trò ghép 3 (thuần): bàn 8×8, đổi chỗ hai ô kề nhau tạo hàng ≥3 cùng màu thì nổ, ô rơi xuống, ô mới lấp vào. */
export const M3 = 8;

export interface M3Level { colors: number; moves: number; target: number }
export const M3_LEVELS: M3Level[] = [
  { colors: 5, moves: 25, target: 1500 }, { colors: 5, moves: 25, target: 2500 }, { colors: 6, moves: 25, target: 2500 },
  { colors: 6, moves: 25, target: 3500 }, { colors: 6, moves: 22, target: 4000 }, { colors: 7, moves: 25, target: 3500 },
  { colors: 7, moves: 25, target: 4500 }, { colors: 7, moves: 22, target: 5000 }, { colors: 7, moves: 20, target: 5500 },
  { colors: 7, moves: 18, target: 6000 },
];

export class Match3 {
  b: number[] = [];
  score = 0;
  constructor(public colors: number, private rand: () => number = Math.random) {
    do { this.fill(); } while (!this.hasMove());
  }
  private rnd(): number { return Math.floor(this.rand() * this.colors); }
  private fill(): void {
    this.b = [];
    for (let i = 0; i < M3 * M3; i++) {
      let v: number;
      const r = Math.floor(i / M3), c = i % M3;
      do { v = this.rnd(); } while ((c >= 2 && this.b[i - 1] === v && this.b[i - 2] === v) || (r >= 2 && this.b[i - M3] === v && this.b[i - 2 * M3] === v));
      this.b.push(v);
    }
  }
  /** Các ô nằm trong hàng ≥3 */
  matches(): Set<number> {
    const out = new Set<number>();
    for (let r = 0; r < M3; r++) for (let c = 0; c < M3; c++) {
      const i = r * M3 + c, v = this.b[i];
      if (v < 0) continue;
      if (c <= M3 - 3 && this.b[i + 1] === v && this.b[i + 2] === v) { let k = c; while (k < M3 && this.b[r * M3 + k] === v) out.add(r * M3 + k++); }
      if (r <= M3 - 3 && this.b[i + M3] === v && this.b[i + 2 * M3] === v) { let k = r; while (k < M3 && this.b[k * M3 + c] === v) out.add(k++ * M3 + c); }
    }
    return out;
  }
  adjacent(a: number, b: number): boolean {
    const ra = Math.floor(a / M3), rb = Math.floor(b / M3);
    return (ra === rb && Math.abs(a - b) === 1) || Math.abs(a - b) === M3;
  }
  swap(a: number, b: number): void { [this.b[a], this.b[b]] = [this.b[b], this.b[a]]; }
  /** Thử đổi; hợp lệ khi tạo được hàng */
  trySwap(a: number, b: number): boolean {
    if (!this.adjacent(a, b)) return false;
    this.swap(a, b);
    if (this.matches().size) return true;
    this.swap(a, b);
    return false;
  }
  /** Nổ một đợt, rơi và lấp. Trả về số ô nổ (0 nếu hết). chain = số đợt liên tiếp (tính nhân điểm) */
  resolve(chain: number): number {
    const m = this.matches();
    if (!m.size) return 0;
    this.score += m.size * 20 * chain + (m.size > 3 ? (m.size - 3) * 40 : 0);
    for (const i of m) this.b[i] = -1;
    for (let c = 0; c < M3; c++) {
      let w = M3 - 1;
      for (let r = M3 - 1; r >= 0; r--) { const v = this.b[r * M3 + c]; if (v >= 0) { this.b[w * M3 + c] = v; w--; } }
      for (; w >= 0; w--) this.b[w * M3 + c] = this.rnd();
    }
    return m.size;
  }
  /** Một nước có thể đi (để gợi ý), null nếu bế tắc */
  findMove(): [number, number] | null {
    for (let i = 0; i < M3 * M3; i++) for (const j of [i + 1, i + M3]) {
      if (j >= M3 * M3 || !this.adjacent(i, j)) continue;
      this.swap(i, j);
      const ok = this.matches().size > 0;
      this.swap(i, j);
      if (ok) return [i, j];
    }
    return null;
  }
  hasMove(): boolean { return !!this.findMove(); }
  reshuffle(): void { do { this.fill(); } while (!this.hasMove()); }
}
