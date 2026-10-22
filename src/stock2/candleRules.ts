/**
 * Bộ quy tắc nến đảo chiều + khối lượng trên khung ngày (mã nghiên cứu, chưa nối vào giao diện).
 * Mẫu hình: búa/sao băng, chuồn chuồn/bia mộ, nhấn chìm, xuyên thấu/mây đen, harami, đáy/đỉnh nhíp, sao mai/sao hôm.
 * Điều kiện ngữ cảnh: mẫu hình tạo đáy (hoặc đỉnh) thấp nhất (cao nhất) 10 ngày và nến trước mẫu hình nằm dưới (trên) SMA20.
 * Cần 3 nến xác nhận sau mẫu hình (nến 1 và nến 3 cùng chiều đảo chiều, không nến nào chạm cắt lỗ) rồi mới vào ở giá mở nến kế tiếp; bỏ lọc khối lượng (dùng R0); cắt lỗ ngoài râu mẫu hình ± 0,25 ATR; chốt lời tại R×tpR; giữ tối đa 15 nến.
 *
 * Kết quả nghiên cứu (BTC + 5 altcoin, 2017 đến 10/2026, chia khám phá <2022 / kiểm định 2022-23 / holdout 2024-26):
 * không mức nào đạt tỷ lệ thắng 65% ở chốt lời 1R; tỷ lệ thắng luôn dưới mức hoà vốn. Xem CLAUDE.md.
 */
import type { Bar } from './core/engine';

export type CandleRule = 'R0' | 'R1' | 'R2' | 'R3';
export type PatternKey = 'hammer' | 'dragonfly' | 'engulf' | 'piercing' | 'harami' | 'tweezer' | 'morningstar';

export const PATTERN_LEN: Record<PatternKey, number> = { morningstar: 3, engulf: 2, piercing: 2, harami: 2, tweezer: 2, hammer: 1, dragonfly: 1 };
export const PATTERN_NAME: Record<1 | -1, Record<PatternKey, string>> = {
  1: { hammer: 'Búa', dragonfly: 'Chuồn chuồn', engulf: 'Nhấn chìm tăng', piercing: 'Xuyên thấu', harami: 'Harami tăng', tweezer: 'Đáy nhíp', morningstar: 'Sao mai' },
  [-1]: { hammer: 'Sao băng', dragonfly: 'Bia mộ', engulf: 'Nhấn chìm giảm', piercing: 'Mây đen che phủ', harami: 'Harami giảm', tweezer: 'Đỉnh nhíp', morningstar: 'Sao hôm' },
} as Record<1 | -1, Record<PatternKey, string>>;

export const CANDLE_HOLD = 15;
const FEE = 0.0024; // phí + trượt giá 0,24% một vòng

export interface CandleSignal {
  i: number; t: number; side: 1 | -1; pattern: PatternKey; volRatio: number; riskPct: number;
  entry: number; sl: number; tp: number;
  result: 'win' | 'loss' | 'timeout' | 'open'; netR: number | null;
}

interface Ind { atr: number[]; sma20: number[]; sma50: number[]; sma200: number[]; vsma20: number[] }

function indicators(b: Bar[]): Ind {
  const n = b.length, nan = () => new Array<number>(n).fill(NaN);
  const atr = nan(), sma = (get: (x: Bar) => number, k: number) => {
    const out = nan(); let s = 0;
    for (let i = 0; i < n; i++) { s += get(b[i]); if (i >= k) s -= get(b[i - k]); if (i >= k - 1) out[i] = s / k; }
    return out;
  };
  const tr = (i: number) => (i === 0 ? b[0].h - b[0].l : Math.max(b[i].h - b[i].l, Math.abs(b[i].h - b[i - 1].c), Math.abs(b[i].l - b[i - 1].c)));
  if (n > 14) {
    let a = 0;
    for (let i = 0; i < 14; i++) a += tr(i);
    atr[13] = a / 14;
    for (let i = 14; i < n; i++) atr[i] = (atr[i - 1] * 13 + tr(i)) / 14;
  }
  return { atr, sma20: sma((x) => x.c, 20), sma50: sma((x) => x.c, 50), sma200: sma((x) => x.c, 200), vsma20: sma((x) => x.v, 20) };
}

function patterns(b: Bar[], ind: Ind, i: number, side: 1 | -1): PatternKey[] {
  const o = (k: number) => b[k].o, c = (k: number) => b[k].c, h = (k: number) => b[k].h, l = (k: number) => b[k].l;
  const rng = (k: number) => Math.max(h(k) - l(k), 1e-12), body = (k: number) => Math.abs(c(k) - o(k));
  const lw = (k: number) => Math.min(o(k), c(k)) - l(k), uw = (k: number) => h(k) - Math.max(o(k), c(k));
  const atr = ind.atr[i], out: PatternKey[] = [];
  if (side > 0) {
    if (body(i) <= 0.35 * rng(i) && lw(i) >= 2 * body(i) && uw(i) <= 0.1 * rng(i) + 0.5 * body(i) && c(i) - l(i) >= 0.66 * rng(i)) out.push('hammer');
    if (body(i) <= 0.1 * rng(i) && lw(i) >= 0.6 * rng(i) && uw(i) <= 0.1 * rng(i)) out.push('dragonfly');
    const red1 = c(i - 1) < o(i - 1), g = c(i) > o(i);
    if (red1 && g && o(i) <= c(i - 1) && c(i) >= o(i - 1)) out.push('engulf');
    if (red1 && g && body(i - 1) >= 0.5 * rng(i - 1) && o(i) <= c(i - 1) && c(i) > (o(i - 1) + c(i - 1)) / 2 && c(i) < o(i - 1)) out.push('piercing');
    if (red1 && g && body(i - 1) >= 0.5 * rng(i - 1) && Math.max(o(i), c(i)) < o(i - 1) && Math.min(o(i), c(i)) > c(i - 1)) out.push('harami');
    if (red1 && g && Math.abs(l(i) - l(i - 1)) <= 0.1 * atr) out.push('tweezer');
    const r2 = c(i - 2) < o(i - 2) && body(i - 2) >= 0.5 * rng(i - 2) && body(i - 2) >= 0.8 * atr;
    if (r2 && body(i - 1) <= 0.35 * body(i - 2) && g && c(i) > (o(i - 2) + c(i - 2)) / 2) out.push('morningstar');
  } else {
    if (body(i) <= 0.35 * rng(i) && uw(i) >= 2 * body(i) && lw(i) <= 0.1 * rng(i) + 0.5 * body(i) && h(i) - c(i) >= 0.66 * rng(i)) out.push('hammer');
    if (body(i) <= 0.1 * rng(i) && uw(i) >= 0.6 * rng(i) && lw(i) <= 0.1 * rng(i)) out.push('dragonfly');
    const grn1 = c(i - 1) > o(i - 1), r = c(i) < o(i);
    if (grn1 && r && o(i) >= c(i - 1) && c(i) <= o(i - 1)) out.push('engulf');
    if (grn1 && r && body(i - 1) >= 0.5 * rng(i - 1) && o(i) >= c(i - 1) && c(i) < (o(i - 1) + c(i - 1)) / 2 && c(i) > o(i - 1)) out.push('piercing');
    if (grn1 && r && body(i - 1) >= 0.5 * rng(i - 1) && Math.min(o(i), c(i)) > o(i - 1) && Math.max(o(i), c(i)) < c(i - 1)) out.push('harami');
    if (grn1 && r && Math.abs(h(i) - h(i - 1)) <= 0.1 * atr) out.push('tweezer');
    const g2 = c(i - 2) > o(i - 2) && body(i - 2) >= 0.5 * rng(i - 2) && body(i - 2) >= 0.8 * atr;
    if (g2 && body(i - 1) <= 0.35 * body(i - 2) && r && c(i) < (o(i - 2) + c(i - 2)) / 2) out.push('morningstar');
  }
  return out;
}

/** Quy tắc nào giữ tín hiệu nào (R1..R3 là các vòng lọc tìm được ở giai đoạn khám phá, xem ghi chú đầu file). */
export function passes(rule: CandleRule, s: { side: 1 | -1; pattern: PatternKey; volRatio: number; riskPct: number }): boolean {
  if (rule === 'R0') return true;
  if (!(s.volRatio <= 1.4)) return false;
  if (rule === 'R1') return true;
  if (!(s.riskPct <= 9.5)) return false;
  if (rule === 'R2') return true;
  return (s.side > 0 && (s.pattern === 'engulf' || s.pattern === 'hammer')) || (s.side < 0 && s.pattern === 'harami');
}

/** Quét toàn bộ nến ngày đã đóng; trả về tín hiệu và kết quả (SL/TP theo R×tpR, phí 0,24%). */
export interface ScanOpts { slAtr?: number; tpPct?: number; hold?: number }
/** Mặc định: SL = râu mẫu hình ± 0,25 ATR, TP = R×tpR. Với `tpPct` (vd 0.2): SL đặt đúng râu mẫu hình khi slAtr=0, TP = giá vào ± tpPct (netR khi đó tính theo R của lệnh đó). */
export function scanCandles(bars: Bar[], rule: CandleRule = 'R3', tpR = 1, confirmN = 3, opts: ScanOpts = {}): CandleSignal[] {
  const slAtr = opts.slAtr ?? 0.25, hold = opts.hold ?? CANDLE_HOLD;
  const ind = indicators(bars), n = bars.length, out: CandleSignal[] = [];
  const lead = confirmN; // confirmN nến xác nhận sau mẫu hình, rồi mới vào ở giá mở nến kế tiếp
  for (let i = 210; i < n - 1 - lead; i++) {
    if (!Number.isFinite(ind.atr[i]) || !Number.isFinite(ind.sma200[i])) continue;
    const volRatio = ind.vsma20[i - 1] > 0 ? bars[i].v / ind.vsma20[i - 1] : NaN;
    for (const side of [1, -1] as const) {
      for (const pattern of patterns(bars, ind, i, side)) {
        const pl = PATTERN_LEN[pattern];
        let ext: boolean;
        if (side > 0) {
          let a = Infinity, p = Infinity;
          for (let k = i - pl + 1; k <= i; k++) a = Math.min(a, bars[k].l);
          for (let k = i - 10 - pl + 1; k <= i - pl; k++) p = Math.min(p, bars[k].l);
          ext = a <= p;
        } else {
          let a = -Infinity, p = -Infinity;
          for (let k = i - pl + 1; k <= i; k++) a = Math.max(a, bars[k].h);
          for (let k = i - 10 - pl + 1; k <= i - pl; k++) p = Math.max(p, bars[k].h);
          ext = a >= p;
        }
        const trend = side > 0 ? bars[i - pl].c < ind.sma20[i - pl] : bars[i - pl].c > ind.sma20[i - pl];
        if (!ext || !trend) continue;
        const k = i + lead, e = bars[k + 1].o;
        let lo = Infinity, hi = -Infinity;
        for (let k = i - pl + 1; k <= i; k++) { lo = Math.min(lo, bars[k].l); hi = Math.max(hi, bars[k].h); }
        const sl = side > 0 ? lo - slAtr * ind.atr[i] : hi + slAtr * ind.atr[i], risk = side > 0 ? e - sl : sl - e;
        if (!(risk > 0)) continue;
        if (confirmN > 0) {
          // nến xác nhận đầu và cuối phải cùng chiều đảo chiều (tăng khi mua, giảm khi bán); không nến nào chạm cắt lỗ
          const dir = (q: number) => side * (bars[q].c - bars[q].o) > 0;
          if (!dir(i + 1) || !dir(k)) continue;
          let hit = false;
          for (let q = i + 1; q <= k; q++) if (side > 0 ? bars[q].l <= sl : bars[q].h >= sl) hit = true;
          if (hit) continue;
        }
        const sig: CandleSignal = { i, t: bars[i].t, side, pattern, volRatio, riskPct: (100 * risk) / e, entry: e, sl, tp: opts.tpPct !== undefined ? e * (1 + side * opts.tpPct) : e + side * tpR * risk, result: 'open', netR: null };
        if (!passes(rule, sig)) continue;
        const cost = (FEE * e) / risk;
        const tpRr = opts.tpPct !== undefined ? (e * opts.tpPct) / risk : tpR;
        for (let j = k + 1; j <= Math.min(n - 1, k + hold); j++) {
          const hitSL = side > 0 ? bars[j].l <= sl : bars[j].h >= sl, hitTP = side > 0 ? bars[j].h >= sig.tp : bars[j].l <= sig.tp;
          if (hitSL) { sig.result = 'loss'; sig.netR = -1 - cost; break; }
          if (hitTP) { sig.result = 'win'; sig.netR = tpRr - cost; break; }
        }
        if (sig.result === 'open' && k + hold <= n - 1) {
          sig.result = 'timeout';
          sig.netR = Math.max(-1, Math.min(tpRr, (side * (bars[k + hold].c - e)) / risk)) - cost;
        }
        out.push(sig);
      }
    }
  }
  return out;
}
