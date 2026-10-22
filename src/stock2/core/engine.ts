/**
 * zzz2 — engine tín hiệu + backtest (thuần tính toán, chạy được cả trong trình duyệt lẫn Node).
 *
 * Khác zzz (bản cũ):
 *  - Có phí + trượt giá, vào lệnh ở GIÁ MỞ nến kế tiếp (không vào ở giá đóng đã biết).
 *  - SL có đệm ATR, bỏ lệnh khi rủi ro quá nhỏ so với ATR/phí.
 *  - Xác nhận bằng phá cấu trúc (đóng cửa vượt đỉnh m nến gần nhất) + EMA20 + dòng tiền taker.
 *  - Cửa sổ sự kiện BB/RSI ngắn (lookback nến), có thể chỉ cần 1 trong 2 (BB, RSI cùng đo độ kéo giãn).
 *  - Lọc khung trung gian (H4) và độ mạnh xu hướng (ADX) cho kênh ngược xu hướng.
 *  - Không nhìn trước: mọi chỉ báo khung lớn chỉ dùng nến ĐÃ ĐÓNG tại thời điểm xét.
 */
import { buildSeries } from '../../stock/core/indicators';
import { trendAt } from '../../stock/core/trend';

export interface Bar { t: number; o: number; h: number; l: number; c: number; v: number; tb: number }

export interface Frame {
  ms: number;
  bars: Bar[];
  o: Float64Array; h: Float64Array; l: Float64Array; c: Float64Array;
  atr: Float64Array; ema20: Float64Array; ema50: Float64Array; rsi: Float64Array; adx: Float64Array;
  taker: Float64Array; // tỉ lệ taker mua trên tổng khối lượng của nến (0..1)
  bbCache: Map<number, { up: Float64Array; lo: Float64Array }>;
}

const NaNs = (n: number) => new Float64Array(n).fill(NaN);

export function emaArr(x: Float64Array, p: number): Float64Array {
  const out = NaNs(x.length);
  if (x.length < p) return out;
  const k = 2 / (p + 1);
  let prev = 0;
  for (let i = 0; i < p; i++) prev += x[i];
  prev /= p;
  out[p - 1] = prev;
  for (let i = p; i < x.length; i++) { prev = (x[i] - prev) * k + prev; out[i] = prev; }
  return out;
}

export function wilder(x: Float64Array, p: number, start: number): Float64Array {
  const out = NaNs(x.length);
  if (x.length < start + p) return out;
  let s = 0;
  for (let i = start; i < start + p; i++) s += x[i];
  let prev = s / p;
  out[start + p - 1] = prev;
  for (let i = start + p; i < x.length; i++) { prev = (prev * (p - 1) + x[i]) / p; out[i] = prev; }
  return out;
}

function rsiArr(c: Float64Array, p = 14): Float64Array {
  const out = NaNs(c.length);
  if (c.length <= p) return out;
  let g = 0, l = 0;
  for (let i = 1; i <= p; i++) { const d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d; }
  g /= p; l /= p;
  out[p] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  for (let i = p + 1; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    g = (g * (p - 1) + (d > 0 ? d : 0)) / p;
    l = (l * (p - 1) + (d < 0 ? -d : 0)) / p;
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return out;
}

function atrAdx(h: Float64Array, l: Float64Array, c: Float64Array, p = 14) {
  const n = c.length;
  const tr = NaNs(n), pdm = NaNs(n), mdm = NaNs(n);
  for (let i = 1; i < n; i++) {
    tr[i] = Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
    const up = h[i] - h[i - 1], dn = l[i - 1] - l[i];
    pdm[i] = up > dn && up > 0 ? up : 0;
    mdm[i] = dn > up && dn > 0 ? dn : 0;
  }
  const atr = wilder(tr, p, 1), sp = wilder(pdm, p, 1), sm = wilder(mdm, p, 1);
  const dx = NaNs(n);
  for (let i = 0; i < n; i++) {
    if (Number.isNaN(atr[i]) || atr[i] === 0) continue;
    const pdi = (100 * sp[i]) / atr[i], mdi = (100 * sm[i]) / atr[i];
    dx[i] = pdi + mdi === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / (pdi + mdi);
  }
  let first = dx.findIndex((x) => !Number.isNaN(x));
  if (first < 0) first = n;
  return { atr, adx: wilder(dx, p, first) };
}

/** Gộp nến nhỏ thành nến lớn (căn theo mốc epoch UTC). */
export function resample(bars: Bar[], ms: number): Bar[] {
  const out: Bar[] = [];
  let cur: Bar | null = null;
  for (const b of bars) {
    const t = Math.floor(b.t / ms) * ms;
    if (!cur || cur.t !== t) { cur = { t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v, tb: b.tb }; out.push(cur); }
    else { if (b.h > cur.h) cur.h = b.h; if (b.l < cur.l) cur.l = b.l; cur.c = b.c; cur.v += b.v; cur.tb += b.tb; }
  }
  return out;
}

export function makeFrame(bars: Bar[], ms: number): Frame {
  const n = bars.length;
  const o = new Float64Array(n), h = new Float64Array(n), l = new Float64Array(n), c = new Float64Array(n), taker = new Float64Array(n);
  bars.forEach((b, i) => { o[i] = b.o; h[i] = b.h; l[i] = b.l; c[i] = b.c; taker[i] = b.v > 0 ? b.tb / b.v : 0.5; });
  const { atr, adx } = atrAdx(h, l, c);
  return { ms, bars, o, h, l, c, atr, adx, ema20: emaArr(c, 20), ema50: emaArr(c, 50), rsi: rsiArr(c), taker, bbCache: new Map() };
}

function bb(f: Frame, mult: number) {
  let r = f.bbCache.get(mult);
  if (r) return r;
  const n = f.c.length, up = NaNs(n), lo = NaNs(n);
  let s = 0, s2 = 0;
  for (let i = 0; i < n; i++) {
    s += f.c[i]; s2 += f.c[i] * f.c[i];
    if (i >= 20) { s -= f.c[i - 20]; s2 -= f.c[i - 20] * f.c[i - 20]; }
    if (i >= 19) { const m = s / 20, sd = Math.sqrt(Math.max(0, s2 / 20 - m * m)); up[i] = m + mult * sd; lo[i] = m - mult * sd; }
  }
  r = { up, lo };
  f.bbCache.set(mult, r);
  return r;
}

/* ------------------------------------------------------------------ */
/* Xu hướng D1 (dùng đúng luật chấm điểm 4 điểm của zzz)                */
/* ------------------------------------------------------------------ */
export interface Bias { ms: number; t: number[]; trend: Int8Array } // 1 = tăng, -1 = giảm, 0 = đi ngang

export function dailyBias(daily: Bar[]): Bias {
  const s = buildSeries(daily.map((b) => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v })));
  const trend = new Int8Array(daily.length);
  for (let i = 0; i < daily.length; i++) { const r = trendAt(s, i).trend; trend[i] = r === 'UP' ? 1 : r === 'DOWN' ? -1 : 0; }
  return { ms: 86_400_000, t: daily.map((b) => b.t), trend };
}

/* ------------------------------------------------------------------ */
/* Tham số + tín hiệu                                                   */
/* ------------------------------------------------------------------ */
export interface Params {
  rr: number;
  feePct: number; // phí mỗi chiều, %
  slipPct: number; // trượt giá mỗi chiều, %
  lookback: number; // số nến quét sự kiện BB/RSI
  needBB: boolean; needRSI: boolean;
  bbMult: number; rsiLo: number; // RSI mua ≤ rsiLo; bán ≥ 100 - rsiLo
  breakN: number; // đóng cửa vượt đỉnh/đáy của N nến gần nhất (phá cấu trúc)
  needEma: boolean; // đóng cửa trên EMA20 (mua) / dưới EMA20 (bán)
  takerMin: number; // trung bình 3 nến: tỉ lệ taker cùng chiều ≥ takerMin (0.5 = tắt)
  slBufAtr: number; minRiskAtr: number; maxRiskAtr: number; minRiskPct: number;
  h4Mode: 'off' | 'agree' | 'notAgainst'; // lọc khung H4 theo EMA20/EMA50
  counterMaxAdx: number; // kênh ngược xu hướng: bỏ khi ADX khung giao dịch > ngưỡng và đang đi ngược (0 = tắt)
  allowWith: boolean; allowCounter: boolean;
  mode: 'pullback' | 'breakout'; // pullback: bắt nhịp điều chỉnh (BB/RSI); breakout: theo đà phá đỉnh/đáy breakN nến
  atrStop: number; // > 0: SL = atrStop × ATR quanh giá vào (thay vì SL theo râu nến cực trị)
  useBias: boolean; // bắt buộc có xu hướng D1 (false = giao dịch hai chiều theo cấu trúc)
  maxHold: number; // số nến tối đa giữ lệnh
  from: number; // chỉ vào lệnh từ thời điểm này (ms)
}

export const DEFAULTS: Params = {
  rr: 1, feePct: 0.1, slipPct: 0.02, lookback: 12, needBB: true, needRSI: false, bbMult: 2, rsiLo: 30,
  breakN: 4, needEma: true, takerMin: 0.5, slBufAtr: 0.5, minRiskAtr: 1.5, maxRiskAtr: 8, minRiskPct: 0.3,
  h4Mode: 'notAgainst', counterMaxAdx: 28, allowWith: true, allowCounter: true, mode: 'pullback', atrStop: 0, useBias: true, maxHold: 200, from: 0,
};

export interface Trade {
  i: number; t: number; dir: 1 | -1; channel: 'with' | 'counter';
  entry: number; sl: number; tp: number; riskPct: number;
  exitIdx: number; result: 'win' | 'loss' | 'timeout'; grossR: number; netR: number;
}

export interface Stats {
  n: number; wins: number; losses: number; timeouts: number; winRate: number;
  netR: number; expR: number; pf: number; maxDD: number;
}

export function summarize(tr: Trade[]): Stats {
  const wins = tr.filter((t) => t.result === 'win').length;
  const losses = tr.filter((t) => t.result === 'loss').length;
  const timeouts = tr.length - wins - losses;
  let gp = 0, gl = 0, eq = 0, peak = 0, dd = 0;
  for (const t of tr) {
    if (t.netR > 0) gp += t.netR; else gl -= t.netR;
    eq += t.netR; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq);
  }
  const netR = eq;
  return { n: tr.length, wins, losses, timeouts, winRate: tr.length ? (100 * wins) / tr.length : 0, netR, expR: tr.length ? netR / tr.length : 0, pf: gl > 0 ? gp / gl : gp > 0 ? Infinity : 0, maxDD: dd };
}

export interface Context {
  f: Frame; h4: Frame; d1: Frame; bias: Bias;
  h4Idx: Int32Array; // chỉ số nến H4 đã đóng gần nhất tại mỗi nến giao dịch
  dIdx: Int32Array; // chỉ số nến D1 đã đóng gần nhất
}

function lastClosedIndex(ctxMs: number, tfBars: Bar[], tfMs: number, htfT: number[], htfMs: number): Int32Array {
  const out = new Int32Array(tfBars.length).fill(-1);
  let p = -1;
  for (let i = 0; i < tfBars.length; i++) {
    const close = tfBars[i].t + tfMs;
    while (p + 1 < htfT.length && htfT[p + 1] + htfMs <= close) p++;
    out[i] = p;
  }
  void ctxMs;
  return out;
}

/** Dựng ngữ cảnh từ ba nguồn riêng: khung giao dịch, H4 và D1 (dùng trong trình duyệt, mỗi khung tải riêng). */
export function makeContextFrom(tfBars: Bar[], tfMs: number, h4Bars: Bar[], dBars: Bar[]): Context {
  const f = makeFrame(tfBars, tfMs);
  const h4Ms = 4 * 3_600_000;
  const h4 = makeFrame(h4Bars, h4Ms);
  const bias = dailyBias(dBars);
  return {
    f, h4, d1: makeFrame(dBars, 86_400_000), bias,
    h4Idx: lastClosedIndex(0, tfBars, tfMs, h4Bars.map((b) => b.t), h4Ms),
    dIdx: lastClosedIndex(0, tfBars, tfMs, bias.t, 86_400_000),
  };
}

/** Dựng ngữ cảnh từ một chuỗi nến 15m duy nhất (H4, D1 được gộp từ đó). Dùng khi nghiên cứu trên Node. */
export function makeContext(bars15: Bar[], tfMin: number): Context {
  const ms = tfMin * 60_000;
  return makeContextFrom(tfMin === 15 ? bars15 : resample(bars15, ms), ms, resample(bars15, 4 * 3_600_000), resample(bars15, 86_400_000));
}

export function run(ctx: Context, p: Params): Trade[] {
  const { f, h4 } = ctx;
  const n = f.c.length;
  const trades: Trade[] = [];
  const bbs = bb(f, p.bbMult);
  let busy = -1;
  const used = new Set<number>();
  const warm = 220;

  for (let i = warm; i < n - 2; i++) {
    if (i <= busy || f.bars[i].t < p.from) continue;
    const atr = f.atr[i];
    if (!(atr > 0)) continue;
    const bi = ctx.bias.trend[ctx.dIdx[i]] ?? 0;
    for (const s of [1, -1] as const) {
      if (p.useBias && bi !== s) continue;
      // ---- góc nhìn: lật dấu để viết một lần cho cả mua và bán
      const lowV = (j: number) => (s > 0 ? f.l[j] : -f.h[j]);
      const highV = (j: number) => (s > 0 ? f.h[j] : -f.l[j]);
      const closeV = (j: number) => s * f.c[j];
      let E = -1;
      if (p.mode === 'pullback') {
      // ---- sự kiện kéo giãn trong cửa sổ
      const w0 = Math.max(1, i - p.lookback + 1);
      let bbIdx = -1, rsiIdx = -1;
      for (let j = i; j >= w0; j--) {
        if (bbIdx < 0) { const band = s > 0 ? bbs.lo[j] : bbs.up[j]; if (!Number.isNaN(band) && (s > 0 ? f.l[j] <= band : f.h[j] >= band)) bbIdx = j; }
        if (rsiIdx < 0) { const r = f.rsi[j]; if (!Number.isNaN(r) && (s > 0 ? r <= p.rsiLo : r >= 100 - p.rsiLo)) rsiIdx = j; }
        if (bbIdx >= 0 && rsiIdx >= 0) break;
      }
      if (p.needBB && bbIdx < 0) continue;
      if (p.needRSI && rsiIdx < 0) continue;
      if (!p.needBB && !p.needRSI && bbIdx < 0 && rsiIdx < 0) continue;
      const ev = [p.needBB ? bbIdx : -1, p.needRSI ? rsiIdx : -1, !p.needBB && !p.needRSI ? Math.max(bbIdx, rsiIdx) : -1].filter((x) => x >= 0);
      const start = Math.min(...ev);
      // ---- nến cực trị E (đáy cho mua) từ lúc có sự kiện tới nến trước hiện tại
      for (let j = Math.max(1, start - 2); j < i; j++) if (E < 0 || lowV(j) < lowV(E)) E = j;
      if (E < 0 || used.has(E * 2 + (s > 0 ? 1 : 0))) continue;
      } else {
        E = i - 1; // breakout không có nến cực trị: neo vào nến trước để SL dự phòng
      }
      // ---- phá cấu trúc: đóng cửa vượt đỉnh của breakN nến liền trước
      let hh = -Infinity;
      for (let j = i - p.breakN; j < i; j++) hh = Math.max(hh, highV(j));
      if (!(closeV(i) > hh)) continue;
      // chỉ tính nến phá đầu tiên (nến i-1 chưa phá)
      let hh1 = -Infinity;
      for (let j = i - 1 - p.breakN; j < i - 1; j++) hh1 = Math.max(hh1, highV(j));
      if (closeV(i - 1) > hh1) continue;
      if (p.needEma && !(s * (f.c[i] - f.ema20[i]) > 0)) continue;
      if (p.takerMin > 0.5) {
        const tk = (f.taker[i] + f.taker[i - 1] + f.taker[i - 2]) / 3;
        if (!((s > 0 ? tk : 1 - tk) >= p.takerMin)) continue;
      }
      // ---- kênh: cùng/ngược xu hướng khung giao dịch
      const tfAligned = s * (f.ema20[i] - f.ema50[i]) > 0;
      const channel: 'with' | 'counter' = tfAligned ? 'with' : 'counter';
      if (channel === 'with' && !p.allowWith) continue;
      if (channel === 'counter' && !p.allowCounter) continue;
      if (channel === 'counter' && p.counterMaxAdx > 0 && f.adx[i] > p.counterMaxAdx) continue;
      // ---- khung H4
      if (p.h4Mode !== 'off') {
        const k = ctx.h4Idx[i];
        if (k < 55) continue;
        const d = s * (h4.ema20[k] - h4.ema50[k]);
        if (p.h4Mode === 'agree' && !(d > 0)) continue;
        if (p.h4Mode === 'notAgainst' && d < -0.004 * h4.c[k]) continue;
      }
      // ---- vào lệnh ở giá MỞ nến kế tiếp, SL dưới râu E trừ đệm ATR
      const entry = f.o[i + 1] * (1 + (s * p.slipPct) / 100);
      const slPx = s * (lowV(E) - p.slBufAtr * atr) * (s > 0 ? 1 : -1) * 1; // giá thật
      const sl = p.atrStop > 0 ? entry - s * p.atrStop * atr : s > 0 ? f.l[E] - p.slBufAtr * atr : f.h[E] + p.slBufAtr * atr;
      void slPx;
      const risk = s * (entry - sl);
      if (!(risk > 0)) continue;
      if (risk < p.minRiskAtr * atr || risk > p.maxRiskAtr * atr || (100 * risk) / entry < p.minRiskPct) continue;
      const tp = entry + s * p.rr * risk;
      let res: Trade['result'] = 'timeout', exit = Math.min(n - 1, i + 1 + p.maxHold), grossR = 0;
      const last = Math.min(n - 1, i + 1 + p.maxHold);
      for (let j = i + 1; j <= last; j++) {
        const hitSL = s > 0 ? f.l[j] <= sl : f.h[j] >= sl;
        const hitTP = s > 0 ? f.h[j] >= tp : f.l[j] <= tp;
        if (hitSL) { res = 'loss'; exit = j; grossR = -1; break; }
        if (hitTP) { res = 'win'; exit = j; grossR = p.rr; break; }
      }
      if (res === 'timeout') grossR = (s * (f.c[exit] - entry)) / risk;
      const cost = (2 * (p.feePct + p.slipPct) / 100 * entry) / risk;
      used.add(E * 2 + (s > 0 ? 1 : 0));
      busy = exit;
      trades.push({ i, t: f.bars[i].t, dir: s, channel, entry, sl, tp, riskPct: (100 * risk) / entry, exitIdx: exit, result: res, grossR, netR: grossR - cost });
      break;
    }
  }
  return trades;
}
