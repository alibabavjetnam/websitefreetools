/** Phỏm (Tá lả) 2 người đấu với máy, bản rút gọn: không gửi bài. Lá: r 1..13, s 0..3 */
export interface PCard { r: number; s: number }
export const pVal = (c: PCard): number => c.r;
export const pKey = (c: PCard): number => c.s * 13 + c.r;
const same = (a: PCard, b: PCard): boolean => a.r === b.r && a.s === b.s;

export function pDeck(): PCard[] {
  const d: PCard[] = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ r, s });
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
export const pSort = (h: PCard[]): PCard[] => h.slice().sort((a, b) => a.s - b.s || a.r - b.r);

/** Mọi phỏm có thể: bộ ≥3 lá cùng số, dãy ≥3 lá cùng chất liên tiếp (A chỉ là 1). Trả về mặt nạ bit theo chỉ số lá trong tay */
function allMelds(h: PCard[]): number[] {
  const out: number[] = [];
  const n = h.length;
  for (let r = 1; r <= 13; r++) {
    const idx = h.map((c, i) => (c.r === r ? i : -1)).filter((i) => i >= 0);
    for (let m = 1; m < 1 << idx.length; m++) {
      let cnt = 0, mask = 0;
      for (let b = 0; b < idx.length; b++) if (m & (1 << b)) { cnt++; mask |= 1 << idx[b]; }
      if (cnt >= 3) out.push(mask);
    }
  }
  for (let s = 0; s < 4; s++) {
    const at: number[] = new Array(14).fill(-1);
    for (let i = 0; i < n; i++) if (h[i].s === s) at[h[i].r] = i;
    for (let a = 1; a <= 11; a++) {
      let mask = 0;
      for (let b = a; b <= 13; b++) {
        if (at[b] < 0) break;
        mask |= 1 << at[b];
        if (b - a >= 2) out.push(mask);
      }
    }
  }
  return out;
}
export interface Plan { left: number; melds: number[]; mask: number }
/** Cách hạ phỏm làm tổng điểm lá rác nhỏ nhất */
export function pBest(h: PCard[]): Plan {
  const melds = allMelds(h), n = h.length, full = (1 << n) - 1;
  const memo = new Map<number, { left: number; ms: number[] }>();
  const val = (i: number) => pVal(h[i]);
  const go = (used: number): { left: number; ms: number[] } => {
    if (used === full) return { left: 0, ms: [] };
    const m0 = memo.get(used);
    if (m0) return m0;
    let i = 0; while (used & (1 << i)) i++;
    let best = (() => { const r = go(used | (1 << i)); return { left: r.left + val(i), ms: r.ms }; })();
    for (const m of melds) {
      if (!(m & (1 << i)) || (m & used)) continue;
      const r = go(used | m);
      if (r.left < best.left) best = { left: r.left, ms: [m, ...r.ms] };
    }
    memo.set(used, best);
    return best;
  };
  const r = go(0);
  return { left: r.left, melds: r.ms, mask: r.ms.reduce((a, m) => a | m, 0) };
}
export const pLeft = (h: PCard[]): number => pBest(h).left;

/** Lá c ghép được phỏm với bài trên tay (để được ăn) */
export function pCanEat(hand: PCard[], c: PCard): boolean {
  const h = [...hand, c];
  const idx = h.length - 1;
  return allMelds(h).some((m) => m & (1 << idx));
}
/** Điểm tiềm năng: số cặp gần thành phỏm */
function potential(h: PCard[]): number {
  let p = 0;
  for (let i = 0; i < h.length; i++) for (let j = i + 1; j < h.length; j++) {
    if (h[i].r === h[j].r) p += 1;
    else if (h[i].s === h[j].s) { const d = Math.abs(h[i].r - h[j].r); if (d === 1) p += 1; else if (d === 2) p += 0.5; }
  }
  return p;
}
/** Máy chọn lá đánh (chỉ số trong tay) theo cấp 1..10; seen = các lá người chơi đã ăn (để tránh nhả bài cho họ) */
export function pAiDiscard(hand: PCard[], level: number, seen: PCard[] = [], eaten: PCard[] = []): number {
  if (Math.random() < Math.max(0, 0.6 - level * 0.07)) return Math.floor(Math.random() * hand.length);
  let best = 0, bv = Infinity;
  hand.forEach((c, i) => {
    if (eaten.some((e) => same(e, c))) return; // lá đã ăn phải giữ
    const rest = hand.filter((_, k) => k !== i);
    let v = pLeft(rest) * 10 - potential(rest) * 3;
    if (level >= 6 && seen.some((s) => s.r === c.r || (s.s === c.s && Math.abs(s.r - c.r) <= 2))) v += 6;
    v += Math.random() * (11 - level) * 0.6;
    if (v < bv) { bv = v; best = i; }
  });
  return best;
}
/** Máy có ăn lá vừa bị đánh không? */
export function pAiEat(hand: PCard[], c: PCard, level: number): boolean {
  if (!pCanEat(hand, c)) return false;
  return Math.random() < Math.min(1, 0.35 + level * 0.07);
}
/** Ù: toàn bộ bài đã vào phỏm */
export const pIsU = (hand: PCard[]): boolean => pBest(hand).left === 0;
