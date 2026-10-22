/**
 * Node thông tin njs1 … njs1024 cho zzz2.
 *
 * Một node = một LOẠI thông tin về giao dịch, gồm một mảng đặc trưng (số thực) tính tại nến i,
 * chỉ dùng dữ liệu tới nến i (không nhìn trước). 32 họ × 32 biến thể tham số = 1024 node.
 * Đặc trưng đã chuẩn hoá theo ATR hoặc dạng tỉ lệ, cắt ở ±6, giá trị thiếu = 0.
 *
 *   njs(id): họ = floor((id-1)/32), biến thể = (id-1) % 32.
 *   Họ 0 (njs1…njs32) là ví dụ của người dùng: so sánh 16 cặp (mở/cao/thấp/đóng nến i) với (mở/cao/thấp/đóng nến i-lag).
 */
import { emaArr, wilder, type Context } from './core/engine';

export const NODE_COUNT = 1024;
const VARIANTS = 32;

type Cols = Float64Array[];
export interface NodeOut { names: string[]; cols: Cols }

/** 32 giá trị tăng dần theo cấp số nhân từ 2 tới ~max (số nguyên, tăng ngặt). */
function plist(max: number): number[] {
  const out: number[] = [];
  for (let v = 0; v < VARIANTS; v++) {
    let x = Math.round(2 * Math.pow(max / 2, v / (VARIANTS - 1)));
    if (v > 0 && x <= out[v - 1]) x = out[v - 1] + 1;
    out.push(x);
  }
  return out;
}
const P640 = plist(640), P320 = plist(320), P256 = plist(256), P200 = plist(200), P160 = plist(160), P128 = plist(128), P96 = plist(96);

const cache = new WeakMap<Context, Map<string, Float64Array>>();
function memo(ctx: Context, key: string, make: () => Float64Array): Float64Array {
  let m = cache.get(ctx);
  if (!m) { m = new Map(); cache.set(ctx, m); }
  let v = m.get(key);
  if (!v) { v = make(); m.set(key, v); }
  return v;
}

const mk = (n: number, k: number): Cols => Array.from({ length: k }, () => new Float64Array(n));
const nan = (n: number) => new Float64Array(n).fill(NaN);

function prefix(x: ArrayLike<number>): Float64Array {
  const s = new Float64Array(x.length + 1);
  for (let i = 0; i < x.length; i++) s[i + 1] = s[i] + (Number.isFinite(x[i]) ? x[i] : 0);
  return s;
}
/** Trung bình trượt p nến kết thúc ở i (cần i ≥ p-1). */
function rollMean(x: ArrayLike<number>, p: number): Float64Array {
  const s = prefix(x), out = nan(x.length);
  for (let i = p - 1; i < x.length; i++) out[i] = (s[i + 1] - s[i + 1 - p]) / p;
  return out;
}
function rollMax(x: ArrayLike<number>, p: number, skipCurrent = false): Float64Array {
  const n = x.length, out = nan(n), dq: number[] = [];
  let head = 0;
  for (let i = 0; i < n; i++) {
    while (dq.length > head && x[dq[dq.length - 1]] <= x[i]) dq.pop();
    dq.push(i);
    while (dq[head] <= i - p) head++;
    if (!skipCurrent) { if (i >= p - 1) out[i] = x[dq[head]]; }
    else if (i >= p) {
      // cửa sổ [i-p, i-1]: dùng deque tính ở bước trước
    }
  }
  if (skipCurrent) { const base = rollMax(x, p, false); for (let i = n - 1; i >= 1; i--) out[i] = base[i - 1]; out[0] = NaN; }
  return out;
}
function rollMin(x: ArrayLike<number>, p: number, skipCurrent = false): Float64Array {
  const neg = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) neg[i] = -x[i];
  const m = rollMax(neg, p, skipCurrent);
  for (let i = 0; i < m.length; i++) m[i] = -m[i];
  return m;
}
const ema = (ctx: Context, p: number) => memo(ctx, `ema${p}`, () => emaArr(ctx.f.c, p));
const trSma = (ctx: Context, p: number) => memo(ctx, `trs${p}`, () => {
  const f = ctx.f, tr = new Float64Array(f.c.length);
  for (let i = 1; i < tr.length; i++) tr[i] = Math.max(f.h[i] - f.l[i], Math.abs(f.h[i] - f.c[i - 1]), Math.abs(f.l[i] - f.c[i - 1]));
  tr[0] = f.h[0] - f.l[0];
  return rollMean(tr, p);
});
const ret1 = (ctx: Context) => memo(ctx, 'ret1', () => {
  const c = ctx.f.c, r = new Float64Array(c.length);
  for (let i = 1; i < c.length; i++) r[i] = Math.log(c[i] / c[i - 1]);
  return r;
});
const tp = (ctx: Context) => memo(ctx, 'tp', () => {
  const f = ctx.f, t = new Float64Array(f.c.length);
  for (let i = 0; i < t.length; i++) t[i] = (f.h[i] + f.l[i] + f.c[i]) / 3;
  return t;
});
const vol = (ctx: Context) => memo(ctx, 'vol', () => Float64Array.from(ctx.f.bars, (b) => b.v));

type Fn = (ctx: Context, v: number) => NodeOut;
const at = (a: ArrayLike<number>, i: number) => (i >= 0 && i < a.length ? a[i] : NaN);
const div = (a: number, b: number) => (b !== 0 && Number.isFinite(b) ? a / b : NaN);

/* ------------------------------------------------------------------ */
const F: Fn[] = [];

// 0 — njs1…32: 16 cặp so sánh giữa nến i và nến i-lag
F[0] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, L = v + 1;
  const S: [string, Float64Array][] = [['o', f.o], ['h', f.h], ['l', f.l], ['c', f.c]];
  const names: string[] = [], cols = mk(n, 16);
  let k = 0;
  for (const [xn, x] of S) for (const [yn, y] of S) {
    names.push(`${xn}[i]-${yn}[i-${L}]`);
    for (let i = L; i < n; i++) cols[k][i] = (x[i] - y[i - L]) / f.atr[i];
    k++;
  }
  return { names, cols };
};
// 1 — giá so với EMA(p)
F[1] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = P640[v], e = ema(ctx, p), c = mk(n, 4);
  for (let i = 1; i < n; i++) {
    c[0][i] = (f.c[i] - e[i]) / f.atr[i]; c[1][i] = (f.h[i] - e[i]) / f.atr[i]; c[2][i] = (f.l[i] - e[i]) / f.atr[i]; c[3][i] = (e[i] - e[i - 1]) / f.atr[i];
  }
  return { names: [`c-ema${p}`, `h-ema${p}`, `l-ema${p}`, `slope-ema${p}`], cols: c };
};
// 2 — giá so với SMA(p)
F[2] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = P640[v], s = rollMean(f.c, p), e = ema(ctx, p), q = Math.max(1, p >> 2), c = mk(n, 3);
  for (let i = q; i < n; i++) { c[0][i] = (f.c[i] - s[i]) / f.atr[i]; c[1][i] = (s[i] - s[i - q]) / f.atr[i]; c[2][i] = (e[i] - s[i]) / f.atr[i]; }
  return { names: [`c-sma${p}`, `slope-sma${p}`, `ema-sma${p}`], cols: c };
};
// 3 — lợi suất p nến
F[3] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = P640[v], c = mk(n, 3);
  for (let i = p; i < n; i++) { const d = f.c[i] - f.c[i - p]; c[0][i] = d / f.atr[i]; c[1][i] = (100 * Math.log(f.c[i] / f.c[i - p])); c[2][i] = d / f.atr[i] / Math.sqrt(p); }
  return { names: [`ret${p}/atr`, `ret${p}%`, `ret${p}/atr/sqrt`], cols: c };
};
// 4 — RSI(p)
F[4] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = Math.max(2, P96[v]), r = memo(ctx, `rsi${p}`, () => {
    const out = nan(n); if (n <= p) return out;
    let g = 0, l = 0;
    for (let i = 1; i <= p; i++) { const d = f.c[i] - f.c[i - 1]; if (d > 0) g += d; else l -= d; }
    g /= p; l /= p; out[p] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    for (let i = p + 1; i < n; i++) { const d = f.c[i] - f.c[i - 1]; g = (g * (p - 1) + (d > 0 ? d : 0)) / p; l = (l * (p - 1) + (d < 0 ? -d : 0)) / p; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
    return out;
  });
  const h = Math.max(1, p >> 1), c = mk(n, 3);
  for (let i = p + h; i < n; i++) { c[0][i] = (r[i] - 50) / 50; c[1][i] = (r[i] - r[i - 1]) / 50; c[2][i] = (r[i] - r[i - h]) / 50; }
  return { names: [`rsi${p}`, `drsi${p}`, `drsi${p}/${h}`], cols: c };
};
// 5 — Bollinger(p, 2)
F[5] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = Math.max(5, P256[v]), m = rollMean(f.c, p), sq = rollMean(Float64Array.from(f.c, (x) => x * x), p), c = mk(n, 3);
  for (let i = p; i < n; i++) {
    const sd = Math.sqrt(Math.max(0, sq[i] - m[i] * m[i]));
    if (sd > 0) { c[0][i] = (f.c[i] - m[i]) / sd; c[1][i] = (f.l[i] - m[i]) / sd; c[2][i] = (f.h[i] - m[i]) / sd; }
  }
  return { names: [`bb${p}.z(c)`, `bb${p}.z(l)`, `bb${p}.z(h)`], cols: c };
};
// 6 — Donchian(p)
F[6] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = P640[v], hh = rollMax(f.h, p), ll = rollMin(f.l, p), c = mk(n, 3);
  for (let i = p; i < n; i++) { const w = hh[i] - ll[i]; if (w > 0) c[0][i] = (f.c[i] - ll[i]) / w - 0.5; c[1][i] = (hh[i] - f.c[i]) / f.atr[i]; c[2][i] = (f.c[i] - ll[i]) / f.atr[i]; }
  return { names: [`don${p}.pos`, `don${p}.toHigh`, `don${p}.fromLow`], cols: c };
};
// 7 — khối lượng + dòng tiền taker
F[7] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = P160[v], vv = vol(ctx), mv = rollMean(vv, p), mv4 = rollMean(vv, p * 4), tk = rollMean(f.taker, p), c = mk(n, 4);
  for (let i = p * 4; i < n; i++) {
    c[0][i] = Math.log((vv[i] + 1e-9) / (mv[i] + 1e-9)); c[1][i] = tk[i] - 0.5; c[2][i] = f.taker[i] - 0.5; c[3][i] = Math.log((mv[i] + 1e-9) / (mv4[i] + 1e-9));
  }
  return { names: [`lnVol/mean${p}`, `taker.mean${p}`, 'taker.now', `lnVolMean${p}/4x`], cols: c };
};
// 8 — biến động
F[8] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = P160[v], a = trSma(ctx, p), a4 = trSma(ctx, p * 4), c = mk(n, 3);
  const r = ret1(ctx), r2 = rollMean(Float64Array.from(r, (x) => x * x), Math.max(2, p));
  for (let i = p * 4; i < n; i++) { c[0][i] = Math.log(a[i] / a4[i]); c[1][i] = (f.h[i] - f.l[i]) / a[i]; c[2][i] = Math.sqrt(r2[i]) / (a[i] / f.c[i]); }
  return { names: [`ln(tr${p}/tr${p * 4})`, `range/tr${p}`, `sd${p}/atr`], cols: c };
};
// 9 — hình dạng nến trung bình p nến
F[9] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = P640[v];
  const b = new Float64Array(n), u = new Float64Array(n), d = new Float64Array(n);
  for (let i = 0; i < n; i++) { const r = f.h[i] - f.l[i]; if (r > 0) { b[i] = (f.c[i] - f.o[i]) / r; u[i] = (f.h[i] - Math.max(f.o[i], f.c[i])) / r; d[i] = (Math.min(f.o[i], f.c[i]) - f.l[i]) / r; } }
  const mb = rollMean(b, p), mu = rollMean(u, p), md = rollMean(d, p), c = mk(n, 3);
  for (let i = p; i < n; i++) { c[0][i] = mb[i]; c[1][i] = mu[i]; c[2][i] = md[i]; }
  return { names: [`body.mean${p}`, `upWick.mean${p}`, `loWick.mean${p}`], cols: c };
};
// 10 — DMI / ADX
F[10] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = Math.max(2, P96[v]);
  const tr = new Float64Array(n), pdm = new Float64Array(n), mdm = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    tr[i] = Math.max(f.h[i] - f.l[i], Math.abs(f.h[i] - f.c[i - 1]), Math.abs(f.l[i] - f.c[i - 1]));
    const up = f.h[i] - f.h[i - 1], dn = f.l[i - 1] - f.l[i];
    pdm[i] = up > dn && up > 0 ? up : 0; mdm[i] = dn > up && dn > 0 ? dn : 0;
  }
  const a = wilder(tr, p, 1), sp = wilder(pdm, p, 1), sm = wilder(mdm, p, 1), dx = nan(n);
  for (let i = 0; i < n; i++) if (a[i] > 0) { const pi = (100 * sp[i]) / a[i], mi = (100 * sm[i]) / a[i]; dx[i] = pi + mi === 0 ? 0 : (100 * Math.abs(pi - mi)) / (pi + mi); }
  const first = dx.findIndex((x) => Number.isFinite(x)), adx = first < 0 ? nan(n) : wilder(dx, p, first), c = mk(n, 3);
  for (let i = 0; i < n; i++) if (Number.isFinite(adx[i]) && a[i] > 0) { const pi = (100 * sp[i]) / a[i], mi = (100 * sm[i]) / a[i]; c[0][i] = (adx[i] - 25) / 25; c[1][i] = pi + mi > 0 ? (pi - mi) / (pi + mi) : 0; c[2][i] = (pi + mi) / 100; }
  return { names: [`adx${p}`, `di.diff${p}`, `di.sum${p}`], cols: c };
};
// 11 — CCI, MFI
F[11] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = Math.max(5, P96[v]), t = tp(ctx), vv = vol(ctx), m = rollMean(t, p), c = mk(n, 3);
  for (let i = p; i < n; i++) {
    let dev = 0, pos = 0, neg = 0;
    for (let j = i - p + 1; j <= i; j++) { dev += Math.abs(t[j] - m[i]); if (j > i - p + 1) { const fl = t[j] * vv[j]; if (t[j] > t[j - 1]) pos += fl; else if (t[j] < t[j - 1]) neg += fl; } }
    dev /= p;
    if (dev > 0) c[0][i] = (t[i] - m[i]) / (0.015 * dev) / 200;
    c[1][i] = (t[i] - m[i]) / f.atr[i];
    c[2][i] = pos + neg > 0 ? (100 * pos) / (pos + neg) / 50 - 1 : 0;
  }
  return { names: [`cci${p}`, `tp-sma${p}`, `mfi${p}`], cols: c };
};
// 12 — MACD (p, 2p, 9)
F[12] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = P160[v], e1 = ema(ctx, p), e2 = ema(ctx, 2 * p);
  const m = new Float64Array(n);
  for (let i = 0; i < n; i++) m[i] = Number.isFinite(e1[i]) && Number.isFinite(e2[i]) && f.atr[i] > 0 ? (e1[i] - e2[i]) / f.atr[i] : 0;
  const sg = emaArr(m, 9), c = mk(n, 3);
  for (let i = 2 * p + 10; i < n; i++) { c[0][i] = m[i]; c[1][i] = m[i] - sg[i]; c[2][i] = m[i] - m[i - 1]; }
  return { names: [`macd${p}/${2 * p}`, `hist${p}`, `dmacd${p}`], cols: c };
};
// 13 — thời gian: hài của giờ trong ngày và thứ trong tuần
F[13] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, k = v + 1, c = mk(n, 4);
  for (let i = 0; i < n; i++) {
    const t = f.bars[i].t, hod = ((t / 3_600_000) % 24) / 24, dow = ((Math.floor(t / 86_400_000) + 4) % 7 + hod) / 7;
    c[0][i] = Math.sin(2 * Math.PI * k * hod); c[1][i] = Math.cos(2 * Math.PI * k * hod); c[2][i] = Math.sin(2 * Math.PI * k * dow); c[3][i] = Math.cos(2 * Math.PI * k * dow);
  }
  return { names: [`hour.sin${k}`, `hour.cos${k}`, `dow.sin${k}`, `dow.cos${k}`], cols: c };
};
// 14, 15 — bối cảnh khung H4 và D1 (chỉ nến đã đóng)
function htf(which: 'h4' | 'd1'): Fn {
  return (ctx, v) => {
    const { f } = ctx, n = f.c.length, fr = which === 'h4' ? ctx.h4 : ctx.d1, idx = which === 'h4' ? ctx.h4Idx : ctx.dIdx, p = P200[v];
    const e = memo(ctx, `${which}ema${p}`, () => emaArr(fr.c, p)), c = mk(n, 3);
    for (let i = 0; i < n; i++) {
      const k = idx[i];
      if (k < 1 || !Number.isFinite(e[k]) || !(fr.atr[k] > 0)) continue;
      c[0][i] = (fr.c[k] - e[k]) / fr.atr[k]; c[1][i] = (e[k] - e[k - 1]) / fr.atr[k]; c[2][i] = (f.c[i] - e[k]) / fr.atr[k];
    }
    return { names: [`${which}.c-ema${p}`, `${which}.slope${p}`, `${which}.now-ema${p}`], cols: c };
  };
}
F[14] = htf('h4');
F[15] = htf('d1');
// 16 — chuỗi tăng/giảm
F[16] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = P640[v], up = new Float64Array(n), cu = new Float64Array(n), st = new Float64Array(n);
  for (let i = 1; i < n; i++) { up[i] = f.c[i] > f.o[i] ? 1 : 0; cu[i] = f.c[i] > f.c[i - 1] ? 1 : 0; st[i] = f.c[i] > f.c[i - 1] ? (st[i - 1] > 0 ? st[i - 1] + 1 : 1) : f.c[i] < f.c[i - 1] ? (st[i - 1] < 0 ? st[i - 1] - 1 : -1) : 0; }
  const a = rollMean(up, p), b = rollMean(cu, p), c = mk(n, 3);
  for (let i = p; i < n; i++) { c[0][i] = a[i] - 0.5; c[1][i] = b[i] - 0.5; c[2][i] = Math.max(-6, Math.min(6, st[i] / Math.sqrt(p))); }
  return { names: [`upBody.frac${p}`, `upClose.frac${p}`, 'streak'], cols: c };
};
// 17 — khoảng cách và tuổi của đáy/đỉnh trong p nến
F[17] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = P96[v], c = mk(n, 3);
  for (let i = p; i < n; i++) {
    let mi = i, ma = i;
    for (let j = i - p + 1; j <= i; j++) { if (f.l[j] <= f.l[mi]) mi = j; if (f.h[j] >= f.h[ma]) ma = j; }
    c[0][i] = (i - mi) / p; c[1][i] = (i - ma) / p; c[2][i] = (f.c[i] - f.l[mi]) / f.atr[i];
  }
  return { names: [`lowAge${p}`, `highAge${p}`, `c-low${p}`], cols: c };
};
// 18 — moment bậc cao của lợi suất 1 nến
F[18] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = Math.max(8, P128[v]), r = ret1(ctx), c = mk(n, 3);
  for (let i = p; i < n; i++) {
    let m = 0; for (let j = i - p + 1; j <= i; j++) m += r[j]; m /= p;
    let s2 = 0, s3 = 0, s4 = 0; for (let j = i - p + 1; j <= i; j++) { const d = r[j] - m; s2 += d * d; s3 += d * d * d; s4 += d * d * d * d; }
    s2 /= p; const sd = Math.sqrt(s2);
    if (sd > 0) { c[0][i] = s3 / p / (sd * sd * sd); c[1][i] = s4 / p / (s2 * s2) - 3; c[2][i] = sd / (f.atr[i] / f.c[i]); }
  }
  return { names: [`skew${p}`, `kurt${p}`, `sd${p}/atr`], cols: c };
};
// 19 — hồi quy tuyến tính p nến
F[19] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = Math.max(5, P96[v]), c = mk(n, 3);
  const sx = (p * (p - 1)) / 2, sxx = ((p - 1) * p * (2 * p - 1)) / 6;
  for (let i = p; i < n; i++) {
    let sy = 0, sxy = 0, syy = 0;
    for (let k = 0; k < p; k++) { const y = f.c[i - p + 1 + k]; sy += y; sxy += k * y; syy += y * y; }
    const den = p * sxx - sx * sx, slope = (p * sxy - sx * sy) / den, icpt = (sy - slope * sx) / p;
    const ssTot = syy - (sy * sy) / p; let ssRes = 0;
    for (let k = 0; k < p; k++) { const e = f.c[i - p + 1 + k] - (icpt + slope * k); ssRes += e * e; }
    c[0][i] = slope / f.atr[i]; c[1][i] = ssTot > 0 ? 1 - ssRes / ssTot : 0; c[2][i] = (f.c[i] - (icpt + slope * (p - 1))) / f.atr[i];
  }
  return { names: [`lr${p}.slope`, `lr${p}.r2`, `lr${p}.resid`], cols: c };
};
// 20 — Chaikin money flow, OBV, chênh taker
F[20] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = P640[v], vv = vol(ctx);
  const mf = new Float64Array(n), ob = new Float64Array(n), td = new Float64Array(n);
  for (let i = 1; i < n; i++) { const r = f.h[i] - f.l[i]; mf[i] = r > 0 ? (((f.c[i] - f.l[i]) - (f.h[i] - f.c[i])) / r) * vv[i] : 0; ob[i] = Math.sign(f.c[i] - f.c[i - 1]) * vv[i]; td[i] = 2 * f.bars[i].tb - vv[i]; }
  const sv = rollMean(vv, p), a = rollMean(mf, p), b = rollMean(ob, p), d = rollMean(td, p), c = mk(n, 3);
  for (let i = p; i < n; i++) if (sv[i] > 0) { c[0][i] = a[i] / sv[i]; c[1][i] = b[i] / sv[i]; c[2][i] = d[i] / sv[i]; }
  return { names: [`cmf${p}`, `obv${p}`, `takerDelta${p}`], cols: c };
};
// 21 — tự tương quan, variance ratio, t-stat
F[21] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = Math.max(12, P128[v]), r = ret1(ctx), c = mk(n, 3);
  for (let i = p + 2; i < n; i++) {
    let m = 0; for (let j = i - p + 1; j <= i; j++) m += r[j]; m /= p;
    let v0 = 0, v1 = 0, v2 = 0;
    for (let j = i - p + 1; j <= i; j++) { const d = r[j] - m; v0 += d * d; if (j > i - p + 1) v1 += d * (r[j - 1] - m); if (j > i - p + 2) { const s2 = r[j] + r[j - 1] - 2 * m; v2 += s2 * s2; } }
    if (v0 > 0) { c[0][i] = v1 / v0; c[1][i] = v2 / (p - 1) / (2 * (v0 / p)) - 1; c[2][i] = (m / Math.sqrt(v0 / p)) * Math.sqrt(p) / 3; }
  }
  return { names: [`ac1.${p}`, `vr2.${p}`, `tstat${p}`], cols: c };
};
// 22 — mở rộng khỏi vùng giá p nến trước
F[22] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = P640[v], hh = rollMax(f.h, p, true), ll = rollMin(f.l, p, true), c = mk(n, 3);
  for (let i = p + 1; i < n; i++) { c[0][i] = (f.h[i] - hh[i]) / f.atr[i]; c[1][i] = (f.l[i] - ll[i]) / f.atr[i]; c[2][i] = (f.h[i] - f.l[i]) / (hh[i] - ll[i]); }
  return { names: [`h-prevHigh${p}`, `l-prevLow${p}`, `range/prevRange${p}`], cols: c };
};
// 23 — VWAP trượt
F[23] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = P640[v], t = tp(ctx), vv = vol(ctx);
  const tv = Float64Array.from(t, (x, i) => x * vv[i]), a = rollMean(tv, p), b = rollMean(vv, p), w = nan(n), c = mk(n, 2), q = Math.max(1, p >> 2);
  for (let i = p; i < n; i++) if (b[i] > 0) w[i] = a[i] / b[i];
  for (let i = p + q; i < n; i++) { c[0][i] = (f.c[i] - w[i]) / f.atr[i]; c[1][i] = (w[i] - w[i - q]) / f.atr[i]; }
  return { names: [`c-vwap${p}`, `vwap${p}.slope`], cols: c };
};
// 24 — vị trí đóng cửa trong nến, nến trong
F[24] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = P640[v], cp = new Float64Array(n), ins = new Float64Array(n);
  for (let i = 1; i < n; i++) { const r = f.h[i] - f.l[i]; cp[i] = r > 0 ? (f.c[i] - f.l[i]) / r - 0.5 : 0; ins[i] = f.h[i] <= f.h[i - 1] && f.l[i] >= f.l[i - 1] ? 1 : 0; }
  const a = rollMean(cp, p), b = rollMean(ins, p), c = mk(n, 3);
  for (let i = p; i < n; i++) { c[0][i] = a[i]; c[1][i] = cp[i]; c[2][i] = b[i]; }
  return { names: [`closePos.mean${p}`, 'closePos.now', `inside.frac${p}`], cols: c };
};
// 25 — hạng phần trăm
F[25] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = P96[v], vv = vol(ctx), tr = trSma(ctx, 1), c = mk(n, 3);
  for (let i = p; i < n; i++) {
    let a = 0, b = 0, d = 0;
    for (let j = i - p; j < i; j++) { if (f.c[j] < f.c[i]) a++; if (vv[j] < vv[i]) b++; if (tr[j] < tr[i]) d++; }
    c[0][i] = a / p - 0.5; c[1][i] = b / p - 0.5; c[2][i] = d / p - 0.5;
  }
  return { names: [`rank.close${p}`, `rank.vol${p}`, `rank.tr${p}`], cols: c };
};
// 26 — chồng EMA
F[26] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = P160[v], e1 = ema(ctx, p), e2 = ema(ctx, 2 * p), e4 = ema(ctx, 4 * p), c = mk(n, 3);
  for (let i = 4 * p; i < n; i++) { c[0][i] = (e1[i] - e2[i]) / f.atr[i]; c[1][i] = (e2[i] - e4[i]) / f.atr[i]; c[2][i] = (f.c[i] - e4[i]) / f.atr[i]; }
  return { names: [`ema${p}-ema${2 * p}`, `ema${2 * p}-ema${4 * p}`, `c-ema${4 * p}`], cols: c };
};
// 27 — Keltner / squeeze
F[27] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = Math.max(5, P256[v]), e = ema(ctx, p), a = trSma(ctx, p), m = rollMean(f.c, p), sq = rollMean(Float64Array.from(f.c, (x) => x * x), p), c = mk(n, 2);
  for (let i = p; i < n; i++) { const sd = Math.sqrt(Math.max(0, sq[i] - m[i] * m[i])); c[0][i] = (f.c[i] - e[i]) / (1.5 * a[i]); c[1][i] = (4 * sd) / (3 * a[i]) - 1; }
  return { names: [`kelt${p}.pos`, `squeeze${p}`], cols: c };
};
// 28 — gia tốc
F[28] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = P320[v], h = Math.max(1, p >> 1), c = mk(n, 2);
  for (let i = 2 * p; i < n; i++) { c[0][i] = (f.c[i] - 2 * f.c[i - p] + f.c[i - 2 * p]) / f.atr[i]; c[1][i] = (f.c[i] - f.c[i - h] - (f.c[i - h] - f.c[i - 2 * h])) / f.atr[i]; }
  return { names: [`accel${p}`, `accel${h}`], cols: c };
};
// 29 — tương tác (đảo chiều trong xu hướng, đà × khối lượng)
F[29] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = P640[v], e = ema(ctx, p), r = memo(ctx, 'rsi14', () => {
    const out = nan(n); let g = 0, l = 0;
    for (let i = 1; i <= 14; i++) { const d = f.c[i] - f.c[i - 1]; if (d > 0) g += d; else l -= d; }
    g /= 14; l /= 14; out[14] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    for (let i = 15; i < n; i++) { const d = f.c[i] - f.c[i - 1]; g = (g * 13 + (d > 0 ? d : 0)) / 14; l = (l * 13 + (d < 0 ? -d : 0)) / 14; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
    return out;
  }), vv = vol(ctx), mv = rollMean(vv, p), c = mk(n, 3);
  for (let i = p + 1; i < n; i++) {
    const g = Math.tanh((f.c[i] - e[i]) / f.atr[i]), mom = Math.tanh((f.c[i] - f.c[i - p]) / f.atr[i] / Math.sqrt(p));
    c[0][i] = g * ((r[i] - 50) / 50); c[1][i] = mom * Math.log((vv[i] + 1e-9) / (mv[i] + 1e-9)); c[2][i] = g * mom;
  }
  return { names: [`trend*rsi${p}`, `mom*vol${p}`, `trend*mom${p}`], cols: c };
};
// 30 — mẫu hình hai nến (nến i so với nến i-lag)
F[30] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, L = v + 1, vv = vol(ctx), c = mk(n, 3);
  for (let i = L; i < n; i++) {
    const b0 = Math.abs(f.c[i] - f.o[i]) + 1e-9, b1 = Math.abs(f.c[i - L] - f.o[i - L]) + 1e-9;
    c[0][i] = Math.max(-4, Math.min(4, Math.log(b0 / b1)));
    c[1][i] = Math.sign(f.c[i] - f.o[i]) * Math.sign(f.c[i - L] - f.o[i - L]);
    c[2][i] = Math.max(-4, Math.min(4, Math.log((vv[i] + 1e-9) / (vv[i - L] + 1e-9))));
  }
  return { names: [`ln(body/body[-${L}])`, `bodySign*[-${L}]`, `ln(vol/vol[-${L}])`], cols: c };
};
// 31 — hiệu suất xu hướng (Kaufman)
F[31] = (ctx, v) => {
  const { f } = ctx, n = f.c.length, p = P320[v], ad = new Float64Array(n), c = mk(n, 3);
  for (let i = 1; i < n; i++) ad[i] = Math.abs(f.c[i] - f.c[i - 1]);
  const s = rollMean(ad, p), s2 = rollMean(ad, Math.min(640, 2 * p));
  for (let i = 2 * p; i < n; i++) {
    const net = f.c[i] - f.c[i - p], er = s[i] > 0 ? Math.abs(net) / (s[i] * p) : 0, net2 = f.c[i] - f.c[i - 2 * p], er2 = s2[i] > 0 ? Math.abs(net2) / (s2[i] * 2 * p) : 0;
    c[0][i] = er; c[1][i] = Math.sign(net) * er; c[2][i] = er - er2;
  }
  return { names: [`er${p}`, `er${p}.signed`, `er${p}-er${2 * p}`], cols: c };
};

export const FAMILY_NAMES = [
  'pair', 'emaGap', 'smaGap', 'ret', 'rsi', 'bb', 'donchian', 'volume', 'volatility', 'candleShape', 'dmi', 'cci_mfi', 'macd', 'time', 'h4', 'd1',
  'streak', 'swing', 'moments', 'linreg', 'flow', 'autocorr', 'extend', 'vwap', 'closePos', 'rank', 'emaStack', 'keltner', 'accel', 'interact', 'twoBar', 'efficiency',
];

export function nodeName(id: number): string { return `njs${id}`; }
export function nodeInfo(id: number) {
  if (!Number.isInteger(id) || id < 1 || id > NODE_COUNT) throw new RangeError(`njs${id} không tồn tại (1 … ${NODE_COUNT})`);
  const family = Math.floor((id - 1) / VARIANTS);
  return { id, name: nodeName(id), family, familyName: FAMILY_NAMES[family], variant: (id - 1) % VARIANTS };
}

/** Tính node njs{id}: trả về tên các đặc trưng và các cột (độ dài = số nến, đã làm sạch). */
export function computeNode(ctx: Context, id: number): NodeOut {
  const { family, variant } = nodeInfo(id);
  const out = F[family](ctx, variant);
  const names = out.names.map((s) => `${nodeName(id)}:${s}`);
  for (const col of out.cols) for (let i = 0; i < col.length; i++) { const x = col[i]; col[i] = Number.isFinite(x) ? (x > 6 ? 6 : x < -6 ? -6 : x) : 0; }
  void div; void at;
  return { names, cols: out.cols };
}
