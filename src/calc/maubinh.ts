/** Mậu binh 1-1 (xếp 13 lá thành 3 chi 5-5-3), chỉ giải trí. Lá: r 2..14 (14 = A), s 0..3 */
import { eval7, type HCard } from './holdem';

const key = (c: HCard): number => c.r * 4 + c.s;
export function mbDeck(): HCard[] {
  const d: HCard[] = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ r, s });
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
export function mbDeal(): [HCard[], HCard[]] {
  const d = mbDeck();
  const sortH = (h: HCard[]) => h.sort((a, b) => b.r - a.r || a.s - b.s);
  return [sortH(d.slice(0, 13)), sortH(d.slice(13, 26))];
}

/** điểm 5 lá (cùng thang với eval7 khi chỉ có 5 lá) */
export const score5 = (c: HCard[]): number => eval7(c);
/** điểm 3 lá: 0 mậu thầu, 1 đôi, 3 sám — cùng thang với 5 lá để so chi giữa với chi đầu */
export function score3(c: HCard[]): number {
  const r = c.map((x) => x.r).sort((a, b) => b - a);
  let cat: number, k: number[];
  if (r[0] === r[1] && r[1] === r[2]) { cat = 3; k = [r[0]]; }
  else if (r[0] === r[1]) { cat = 1; k = [r[0], r[2]]; }
  else if (r[1] === r[2]) { cat = 1; k = [r[1], r[0]]; }
  else { cat = 0; k = r; }
  let v = cat; for (let i = 0; i < 5; i++) v = v * 15 + (k[i] || 0);
  return v;
}
export interface Arr { back: HCard[]; mid: HCard[]; front: HCard[] }
export interface Scored { back: number; mid: number; front: number }
export const scoreArr = (a: Arr): Scored => ({ back: score5(a.back), mid: score5(a.mid), front: score3(a.front) });
/** binh lủng: chi sau yếu hơn chi trước */
export const isFoul = (a: Arr): boolean => { const s = scoreArr(a); return s.back < s.mid || s.mid < s.front; };

/** So hai bộ: trả điểm của bên A (dương là A thắng). Mỗi chi ±1, thắng cả 3 chi (sập) gấp đôi; binh lủng thua như sập. */
export function compare(a: Arr, b: Arr): { pts: number; chi: number[]; foulA: boolean; foulB: boolean } {
  const fa = isFoul(a), fb = isFoul(b);
  if (fa && fb) return { pts: 0, chi: [0, 0, 0], foulA: true, foulB: true };
  if (fa) return { pts: -6, chi: [-1, -1, -1], foulA: true, foulB: false };
  if (fb) return { pts: 6, chi: [1, 1, 1], foulA: false, foulB: true };
  const x = scoreArr(a), y = scoreArr(b);
  const chi = [Math.sign(x.back - y.back), Math.sign(x.mid - y.mid), Math.sign(x.front - y.front)];
  const sum = chi[0] + chi[1] + chi[2];
  const pts = sum === 3 ? 6 : sum === -3 ? -6 : sum;
  return { pts, chi, foulA: false, foulB: false };
}

function combos(n: number, k: number, from = 0, cur: number[] = [], out: number[][] = []): number[][] {
  if (cur.length === k) { out.push(cur.slice()); return out; }
  for (let i = from; i <= n - (k - cur.length); i++) { cur.push(i); combos(n, k, i + 1, cur, out); cur.pop(); }
  return out;
}
const C13_5 = combos(13, 5), C8_5 = combos(8, 5);

/** Mọi cách xếp không lủng, kèm giá trị heuristic (thang tương đối theo loại bài) */
export function allValid(hand: HCard[]): { arr: Arr; v: number }[] {
  const res: { arr: Arr; v: number }[] = [];
  for (const bi of C13_5) {
    const bset = new Set(bi);
    const back = bi.map((i) => hand[i]);
    const rest = hand.filter((_, i) => !bset.has(i));
    const sb = score5(back);
    for (const mi of C8_5) {
      const mset = new Set(mi);
      const mid = mi.map((i) => rest[i]);
      const sm = score5(mid);
      if (sm > sb) continue;
      const front = rest.filter((_, i) => !mset.has(i));
      const sf = score3(front);
      if (sf > sm) continue;
      const cat = (s: number) => Math.floor(s / 15 ** 5);
      // chi cuối quan trọng như nhau; thưởng thêm cho sám chi đầu, cù lũ chi giữa (luật thưởng phổ biến)
      const v = cat(sb) * 3 + cat(sm) * 3.4 + cat(sf) * 4 + sb / 15 ** 6 + sm / 15 ** 6 + sf / 15 ** 6;
      res.push({ arr: { back, mid, front }, v });
    }
  }
  return res;
}
/** Máy xếp bài theo cấp 1..10: cấp thấp chọn ngẫu nhiên trong các cách tốt nhất rộng hơn; cấp 1 có thể xếp lủng */
export function mbAi(hand: HCard[], level: number): Arr {
  if (level === 1 && Math.random() < 0.5) {
    const h = hand.slice().sort(() => Math.random() - 0.5);
    return { back: h.slice(0, 5), mid: h.slice(5, 10), front: h.slice(10) };
  }
  const all = allValid(hand);
  if (!all.length) { const h = hand.slice().sort((a, b) => b.r - a.r); return { back: h.slice(0, 5), mid: h.slice(5, 10), front: h.slice(10) }; }
  all.sort((a, b) => b.v - a.v);
  const top = Math.max(1, Math.round(all.length * 0.3 * ((10 - level) / 9) ** 2));
  return all[Math.floor(Math.random() * Math.min(top, all.length))].arr;
}
/** Gợi ý cho người chơi: cách xếp tốt nhất */
export function mbBest(hand: HCard[]): Arr {
  const all = allValid(hand);
  if (!all.length) return mbAi(hand, 1);
  let best = all[0];
  for (const x of all) if (x.v > best.v) best = x;
  return best.arr;
}
export const mbKey = key;
