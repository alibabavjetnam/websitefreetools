/**
 * njscb1 … njscb64 — 64 chỉ báo "đường đi của giá" xây từ lý thuyết đồ thị và toán rời rác.
 * Mỗi chỉ báo được tính trên cửa sổ w nến gần nhất (w = 32, 64, 128) → mỗi node có 3 đặc trưng.
 * Chỉ dùng giá đóng cửa tới nến i (không nhìn trước).
 *
 *   1–8    Đồ thị tầm nhìn tự nhiên (natural visibility graph)
 *   9–16   Đồ thị tầm nhìn ngang (horizontal visibility graph)
 *   17–24  Đồ thị chuyển tiếp mẫu thứ tự (Bandt–Pompe)
 *   25–32  Đồ thị Markov theo phân vị lợi suất
 *   33–40  Mạng tái diễn (recurrence network) và dự báo tương tự
 *   41–48  Mạng mức giá (các ô giá là đỉnh, chuyển động giá là cạnh có hướng, PageRank)
 *   49–56  Hình học / tổ hợp: chu kỳ lệch pha, bao lồi, dãy con tăng dài nhất, nghịch thế, bản ghi
 *   57–62  Bước đi ±1 (đường Dyck, luật arcsine, bài toán phiếu bầu)
 *   63–64  Cây bao trùm nhỏ nhất (MST) của đám mây điểm (thời gian, giá)
 */
export const CB_COUNT = 64;
export const CB_SCALES = [32, 64, 128] as const;

const W = 128;
const NV = new Uint8Array(W * W);   // tầm nhìn tự nhiên
const HV = new Uint8Array(W * W);   // tầm nhìn ngang
const RC = new Uint8Array(W * W);   // tái diễn
const DS = new Float32Array(W * W); // khoảng cách tái diễn
const p = new Float64Array(W), d = new Float64Array(W), tmp = new Float64Array(W);
const degN = new Int32Array(W), degH = new Int32Array(W);
const pat3 = new Int16Array(W), pat4 = new Int16Array(W), st = new Int16Array(W), bin = new Int16Array(W);
const dist = new Int32Array(W), queue = new Int32Array(W);
const sorted = new Float64Array(W);

const log = Math.log;
const clip = (x: number, m = 6) => (Number.isFinite(x) ? (x > m ? m : x < -m ? -m : x) : 0);

function entropyOfCounts(c: ArrayLike<number>, n: number, total: number): number {
  let h = 0;
  for (let k = 0; k < n; k++) if (c[k] > 0) { const q = c[k] / total; h -= q * log(q); }
  return h;
}

function degreeStats(adj: Uint8Array, w: number, deg: Int32Array) {
  let sumD = 0, maxD = 0, hub = 0;
  for (let a = 0; a < w; a++) {
    let k = 0;
    const row = a * w;
    for (let b = 0; b < w; b++) k += adj[row + b];
    deg[a] = k; sumD += k;
    if (k > maxD) { maxD = k; hub = a; }
  }
  const hist = new Int32Array(w + 1);
  for (let a = 0; a < w; a++) hist[deg[a]]++;
  const ent = entropyOfCounts(hist, w + 1, w) / log(w);
  return { sumD, maxD, hub, ent };
}

function localClust(adj: Uint8Array, w: number, deg: Int32Array, v: number): number {
  const d0 = deg[v];
  if (d0 < 2) return 0;
  let t = 0;
  const row = v * w;
  for (let a = 0; a < w; a++) {
    if (!adj[row + a]) continue;
    for (let b = a + 1; b < w; b++) if (adj[row + b] && adj[a * w + b]) t++;
  }
  return (2 * t) / (d0 * (d0 - 1));
}

function assortativity(adj: Uint8Array, w: number, deg: Int32Array): number {
  let m = 0, s1 = 0, s2 = 0, s3 = 0;
  for (let a = 0; a < w; a++) for (let b = a + 1; b < w; b++) if (adj[a * w + b]) {
    m++; s1 += deg[a] + deg[b]; s2 += deg[a] * deg[b]; s3 += deg[a] * deg[a] + deg[b] * deg[b];
  }
  if (m === 0) return 0;
  const mean = s1 / (2 * m), cov = s2 / m - mean * mean, v = s3 / (2 * m) - mean * mean;
  return v > 1e-12 ? cov / v : 0;
}

function bfs(adj: Uint8Array, w: number, src: number): { ecc: number; mean: number } {
  dist.fill(-1); dist[src] = 0;
  let qh = 0, qt = 0; queue[qt++] = src;
  let sum = 0, cnt = 0, ecc = 0;
  while (qh < qt) {
    const u = queue[qh++], row = u * w;
    for (let v = 0; v < w; v++) if (adj[row + v] && dist[v] < 0) { dist[v] = dist[u] + 1; queue[qt++] = v; sum += dist[v]; cnt++; if (dist[v] > ecc) ecc = dist[v]; }
  }
  return { ecc, mean: cnt ? sum / cnt : 0 };
}

function perm4Code(a: number, b: number, c: number, e: number): number {
  const r0 = (b < a ? 1 : 0) + (c < a ? 1 : 0) + (e < a ? 1 : 0);
  const r1 = (a <= b ? 1 : 0) * 0 + (a < b ? 1 : 0) + (c < b ? 1 : 0) + (e < b ? 1 : 0);
  const r2 = (a < c ? 1 : 0) + (b < c ? 1 : 0) + (e < c ? 1 : 0);
  return r0 * 16 + r1 * 4 + r2;
}

function cross(ox: number, oy: number, ax: number, ay: number, bx: number, by: number) { return (ax - ox) * (by - oy) - (ay - oy) * (bx - ox); }
function segInter(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): boolean {
  const d1 = cross(ax, ay, bx, by, cx, cy), d2 = cross(ax, ay, bx, by, dx, dy), d3 = cross(cx, cy, dx, dy, ax, ay), d4 = cross(cx, cy, dx, dy, bx, by);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** Tính 64 chỉ báo cho cửa sổ w kết thúc ở nến i; ghi vào out[off + k], k = 0…63. */
export function graphIndicators(logClose: ArrayLike<number>, i: number, w: number, out: Float64Array, off: number): void {
  for (let k = 0; k < CB_COUNT; k++) out[off + k] = 0;
  if (i < w) return;
  const base = i - w + 1;
  let mn = Infinity, mx = -Infinity;
  for (let k = 0; k < w; k++) { const v = logClose[base + k]; p[k] = v; if (v < mn) mn = v; if (v > mx) mx = v; }
  const rng = mx - mn;
  if (!(rng > 0)) return;
  let sd = 0, md = 0;
  d[0] = 0;
  for (let k = 1; k < w; k++) { d[k] = p[k] - p[k - 1]; md += d[k]; }
  md /= w - 1;
  for (let k = 1; k < w; k++) sd += (d[k] - md) ** 2;
  sd = Math.sqrt(sd / (w - 1));
  if (!(sd > 0)) return;
  const last = w - 1, o = (k: number, v: number) => { out[off + k - 1] = clip(v); };

  /* ---------- 1–8: đồ thị tầm nhìn tự nhiên ---------- */
  NV.fill(0, 0, w * w);
  for (let a = 0; a < w; a++) {
    let ms = -Infinity;
    for (let b = a + 1; b < w; b++) {
      const s = (p[b] - p[a]) / (b - a);
      if (s > ms) { NV[a * w + b] = 1; NV[b * w + a] = 1; ms = s; }
    }
  }
  const ns = degreeStats(NV, w, degN);
  let up = 0, dn = 0;
  for (let a = 0; a < last; a++) if (NV[last * w + a]) { if (p[a] > p[last]) up++; else dn++; }
  o(1, degN[last] / (w - 1));
  o(2, (up - dn) / Math.max(1, up + dn));
  o(3, ns.sumD / w / (w - 1));
  o(4, ns.ent);
  o(5, localClust(NV, w, degN, last));
  o(6, assortativity(NV, w, degN));
  o(7, ((w - 1 - ns.hub) / (w - 1)) * Math.sign(p[ns.hub] - p[last] + 1e-12) + (p[ns.hub] - p[last]) / rng);
  let cc = 0;
  for (let a = 0; a < w; a++) cc += localClust(NV, w, degN, a);
  o(8, cc / w);

  /* ---------- 9–16: đồ thị tầm nhìn ngang ---------- */
  HV.fill(0, 0, w * w);
  for (let a = 0; a < w; a++) {
    let mb = -Infinity;
    for (let b = a + 1; b < w; b++) {
      if (mb < Math.min(p[a], p[b])) { HV[a * w + b] = 1; HV[b * w + a] = 1; }
      if (p[b] > mb) mb = p[b];
      if (p[b] >= p[a]) break;
    }
  }
  const hs = degreeStats(HV, w, degH);
  let d2 = 0;
  for (let a = 0; a < w; a++) if (degH[a] === 2) d2++;
  const bh = bfs(HV, w, last);
  let prevHigher = last;
  while (prevHigher > 0 && p[prevHigher - 1] < p[last]) prevHigher--;
  o(9, degH[last]);
  o(10, hs.sumD / w - 4);
  o(11, hs.ent);
  o(12, d2 / w);
  o(13, bh.ecc / w);
  o(14, bh.mean / log(w));
  o(15, hs.maxD / Math.sqrt(w));
  o(16, (last - prevHigher + 1) / w);

  /* ---------- 17–24: đồ thị chuyển tiếp mẫu thứ tự ---------- */
  const cnt3 = new Int32Array(8), cnt4 = new Int32Array(256), tr3 = new Int32Array(64);
  for (let t = 2; t < w; t++) { const c = (p[t - 2] < p[t - 1] ? 4 : 0) + (p[t - 1] < p[t] ? 2 : 0) + (p[t - 2] < p[t] ? 1 : 0); pat3[t] = c; cnt3[c]++; if (t > 2) tr3[pat3[t - 1] * 8 + c]++; }
  for (let t = 3; t < w; t++) { const c = perm4Code(p[t - 3], p[t - 2], p[t - 1], p[t]); pat4[t] = c; cnt4[c]++; }
  const n3 = w - 2;
  let absent = 0;
  for (const c of [0, 1, 2, 3, 4, 5, 6, 7]) if (c !== 3 && c !== 4 && cnt3[c] === 0) absent++; // 3 và 4 là tổ hợp không thể xảy ra
  let trTot = 0, recip = 0, self = 0;
  for (let u = 0; u < 8; u++) for (let v = 0; v < 8; v++) { const x = tr3[u * 8 + v]; trTot += x; if (u === v) self += x; if (u < v) recip += 2 * Math.min(x, tr3[v * 8 + u]); }
  let tv = 0;
  for (let c = 0; c < 8; c++) if (c !== 3 && c !== 4) tv += Math.abs(cnt3[c] / n3 - 1 / 6);
  const markov = (pat: Int16Array, t0: number) => {
    let n = 0, u = 0; const cur = pat[last];
    for (let t = t0; t < last; t++) if (pat[t] === cur) { n++; if (d[t + 1] > 0) u++; }
    return (u + 1) / (n + 2) - 0.5;
  };
  o(17, entropyOfCounts(cnt3, 8, n3) / log(6));
  o(18, entropyOfCounts(tr3, 64, Math.max(1, trTot)) / log(36));
  let distinct4 = 0;
  for (let c = 0; c < 256; c++) if (cnt4[c] > 0) distinct4++;
  void absent;
  o(19, (24 - distinct4) / 24);
  o(20, markov(pat3, 2) * 4);
  o(21, markov(pat4, 3) * 4);
  o(22, trTot ? recip / trTot : 0);
  o(23, tv);
  o(24, trTot ? self / trTot : 0);

  /* ---------- 25–32: đồ thị Markov theo phân vị lợi suất ---------- */
  for (let k = 1; k < w; k++) sorted[k - 1] = d[k];
  const ss = sorted.subarray(0, w - 1).sort();
  const q1 = ss[Math.floor((w - 1) * 0.2)], q2 = ss[Math.floor((w - 1) * 0.4)], q3 = ss[Math.floor((w - 1) * 0.6)], q4 = ss[Math.floor((w - 1) * 0.8)];
  for (let t = 1; t < w; t++) st[t] = d[t] <= q1 ? 0 : d[t] <= q2 ? 1 : d[t] <= q3 ? 2 : d[t] <= q4 ? 3 : 4;
  const P = new Float64Array(25), rowN = new Float64Array(5);
  for (let t = 1; t < last; t++) { P[st[t] * 5 + st[t + 1]]++; rowN[st[t]]++; }
  let uu = 0, un = 0, du = 0, dn2 = 0, dd = 0, ddn = 0, uup = 0, uun = 0;
  for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) {
    const x = P[a * 5 + b];
    if (a >= 3) { un += x; if (b >= 3) uu += x; }
    if (a <= 1) { dn2 += x; if (b >= 3) du += x; if (b <= 1) dd += x; }
  }
  void ddn; void uup; void uun;
  let eSum = 0, eN = 0;
  for (let t = 1; t < last; t++) if (st[t] === st[last]) { eSum += d[t + 1]; eN++; }
  let H = 0;
  for (let a = 0; a < 5; a++) if (rowN[a] > 0) { let h = 0; for (let b = 0; b < 5; b++) { const q = P[a * 5 + b] / rowN[a]; if (q > 0) h -= q * log(q); } H += (rowN[a] / (w - 2)) * h; }
  // khoảng trống phổ: |λ2| của ma trận chuyển tiếp làm trơn, bằng lặp luỹ thừa trừ thành phần dừng
  const M = new Float64Array(25);
  for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) M[a * 5 + b] = (P[a * 5 + b] + 0.2) / (rowN[a] + 1);
  let pi: Float64Array = new Float64Array(5).fill(0.2);
  for (let it = 0; it < 30; it++) { const nx = new Float64Array(5); for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) nx[b] += pi[a] * M[a * 5 + b]; pi = nx; }
  let v: Float64Array = Float64Array.from([1, -1, 0.5, -0.5, 0.2]); let lam = 0;
  for (let it = 0; it < 40; it++) {
    let s = 0; for (let a = 0; a < 5; a++) s += v[a];
    for (let a = 0; a < 5; a++) v[a] -= s * pi[a];
    const nx = new Float64Array(5); for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) nx[b] += v[a] * M[a * 5 + b];
    let n0 = 0, n1 = 0; for (let a = 0; a < 5; a++) { n0 += v[a] * v[a]; n1 += nx[a] * nx[a]; }
    lam = n0 > 1e-18 ? Math.sqrt(n1 / n0) : 0; const nn = Math.sqrt(n1) || 1; v = Float64Array.from(nx, (x) => x / nn);
  }
  let runs = 0, curLen = 1, maxRun = 1, sumRun = 0;
  for (let t = 2; t < w; t++) { if ((d[t] > 0) === (d[t - 1] > 0)) { curLen++; } else { runs++; sumRun += curLen; if (curLen > maxRun) maxRun = curLen; curLen = 1; } }
  runs++; sumRun += curLen; if (curLen > maxRun) maxRun = curLen;
  let bg = 0;
  for (let t = 1; t < last; t++) if (st[t] === st[last - 1] && st[t + 1] === st[last]) bg++;
  o(25, (un ? uu / un : 0.5) - (dn2 ? du / dn2 : 0.5));
  o(26, (eSum / Math.max(1, eN) / sd) * (eN / (eN + 3)));
  o(27, H / log(5));
  o(28, 1 - lam);
  o(29, (dn2 ? dd / dn2 : 0.5) - (un ? uu / un : 0.5));
  o(30, sumRun / runs / 2 - 1);
  o(31, maxRun / log(w) * log(2) - 1);
  o(32, -log((bg + 1) / (w - 1)) - log(25) * 0);

  /* ---------- 33–40: mạng tái diễn trên không gian nhúng 3 chiều ---------- */
  const N = w - 3; // vector t = 3 … w-1
  let sumDist = 0, pairs = 0;
  for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) {
    const ta = a + 3, tb = b + 3;
    const x0 = (d[ta] - d[tb]) / sd, x1 = (d[ta - 1] - d[tb - 1]) / sd, x2 = (d[ta - 2] - d[tb - 2]) / sd;
    const e = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
    DS[a * N + b] = e; DS[b * N + a] = e; sumDist += e; pairs++;
  }
  const eps = 0.5 * (sumDist / Math.max(1, pairs));
  let rate = 0;
  for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) { const r = a !== b && DS[a * N + b] < eps ? 1 : 0; RC[a * N + b] = r; rate += r; }
  const lastV = N - 1;
  let degR = 0, aSum = 0, aN = 0, nearest = Infinity;
  const nb: number[] = [];
  for (let a = 0; a < lastV; a++) {
    const dd2 = DS[lastV * N + a];
    if (dd2 < nearest) nearest = dd2;
    if (RC[lastV * N + a]) { degR++; nb.push(a); aSum += d[a + 3 + 1]; aN++; }
  }
  let diag = 0, vert = 0;
  for (let a = 0; a < N - 1; a++) for (let b = 0; b < N - 1; b++) if (RC[a * N + b]) { if (RC[(a + 1) * N + b + 1]) diag++; if (RC[a * N + b + 1]) vert++; }
  let triR = 0;
  for (let x = 0; x < nb.length; x++) for (let y = x + 1; y < nb.length; y++) if (RC[nb[x] * N + nb[y]]) triR++;
  const idxs = Array.from({ length: lastV }, (_, k) => k).sort((x, y) => DS[lastV * N + x] - DS[lastV * N + y]).slice(0, 5);
  let vote = 0;
  for (const j of idxs) vote += Math.sign(d[j + 3 + 1]);
  o(33, rate / (N * (N - 1)) * 5);
  o(34, degR / Math.max(1, lastV) * 5);
  o(35, (aSum / Math.max(1, aN) / sd) * (aN / (aN + 3)));
  o(36, rate ? diag / rate : 0);
  o(37, rate ? vert / rate : 0);
  o(38, nb.length > 1 ? (2 * triR) / (nb.length * (nb.length - 1)) : 0);
  o(39, nearest / (sumDist / Math.max(1, pairs)));
  o(40, vote / 5);

  /* ---------- 41–48: mạng mức giá (12 ô giá theo phân vị) ---------- */
  for (let k = 0; k < w; k++) sorted[k] = p[k];
  const sp = sorted.subarray(0, w).sort();
  const NB = 12, edges = new Float64Array(NB * NB), thr: number[] = [];
  for (let b = 1; b < NB; b++) thr.push(sp[Math.floor((w * b) / NB)]);
  for (let k = 0; k < w; k++) { let b = 0; while (b < NB - 1 && p[k] >= thr[b]) b++; bin[k] = b; }
  const bl = bin[last];
  let cross2 = 0, upF = 0, dnF = 0;
  const visits = new Float64Array(NB);
  for (let k = 0; k < w; k++) visits[bin[k]]++;
  for (let k = 0; k < last; k++) {
    const a = bin[k], b = bin[k + 1];
    if (a !== b) { edges[a * NB + b]++; if (Math.min(a, b) < bl && bl < Math.max(a, b)) cross2++; if (a === bl) { if (b > a) upF++; else dnF++; } }
  }
  let pr: Float64Array = new Float64Array(NB).fill(1 / NB);
  const outS = new Float64Array(NB);
  for (let a = 0; a < NB; a++) for (let b = 0; b < NB; b++) outS[a] += edges[a * NB + b];
  for (let it = 0; it < 25; it++) {
    const nx = new Float64Array(NB).fill(0.15 / NB); let dang = 0;
    for (let a = 0; a < NB; a++) { if (outS[a] === 0) dang += pr[a]; else for (let b = 0; b < NB; b++) if (edges[a * NB + b]) nx[b] += 0.85 * pr[a] * edges[a * NB + b] / outS[a]; }
    for (let b = 0; b < NB; b++) nx[b] += (0.85 * dang) / NB;
    pr = nx;
  }
  let best = 0, degB = 0, prH = 0;
  for (let b = 0; b < NB; b++) { if (pr[b] > pr[best]) best = b; if (edges[bl * NB + b] || edges[b * NB + bl]) degB++; if (pr[b] > 0) prH -= pr[b] * log(pr[b]); }
  let dwellNow = 1;
  while (dwellNow < w && bin[last - dwellNow] === bl) dwellNow++;
  let visitsRuns = 0, runLenSum = 0, rl = 0;
  for (let k = 0; k < last - dwellNow + 1; k++) { if (bin[k] === bl) rl++; else if (rl) { visitsRuns++; runLenSum += rl; rl = 0; } }
  if (rl) { visitsRuns++; runLenSum += rl; }
  const midOf = (b: number) => (b === 0 ? sp[0] : b === NB - 1 ? sp[w - 1] : (thr[b - 1] + thr[b]) / 2);
  o(41, (pr[bl] - 1 / NB) * NB);
  o(42, (midOf(best) - p[last]) / rng * 3);
  o(43, prH / log(NB));
  o(44, cross2 / w * 4);
  o(45, degB / NB);
  o(46, (upF - dnF) / (upF + dnF + 2) * 2);
  o(47, dwellNow / Math.sqrt(w));
  o(48, visitsRuns ? runLenSum / visitsRuns / 3 - 1 : 0);

  /* ---------- 49–56: hình học và tổ hợp ---------- */
  // 49: tỉ lệ chân sóng cuối / chân sóng liền trước (zigzag ngưỡng 2 sd)
  const th = 2 * sd;
  let pivP = p[0], pivT = 0, dir = 0, ext = p[0], extT = 0;
  const legs: number[] = [];
  for (let t = 1; t < w; t++) {
    if (dir >= 0 && p[t] > ext) { ext = p[t]; extT = t; }
    if (dir <= 0 && p[t] < ext) { ext = p[t]; extT = t; }
    if (dir >= 0 && ext - p[t] >= th) { legs.push(ext - pivP); pivP = ext; pivT = extT; ext = p[t]; extT = t; dir = -1; }
    else if (dir <= 0 && p[t] - ext >= th) { legs.push(ext - pivP); pivP = ext; pivT = extT; ext = p[t]; extT = t; dir = 1; }
    else if (dir === 0) dir = p[t] > p[0] ? 1 : -1;
  }
  void pivT;
  const lastLeg = p[last] - pivP, prevLeg = legs.length ? legs[legs.length - 1] : 0;
  o(49, Math.sign(lastLeg) * clip(log((Math.abs(lastLeg) + sd) / (Math.abs(prevLeg) + sd)), 3));
  // 50: số lần tự cắt của quỹ đạo trong mặt phẳng pha (p_t, p_{t+1})
  let cr = 0;
  for (let a = 0; a < w - 2; a++) for (let b = a + 2; b < w - 2; b++) if (segInter(p[a], p[a + 1], p[a + 1], p[a + 2], p[b], p[b + 1], p[b + 1], p[b + 2])) cr++;
  o(50, cr / w);
  // 51–52: bao lồi của (thời gian, giá) trừ nến cuối; khoảng cách có dấu của nến cuối tới bao
  const idx = Array.from({ length: w - 1 }, (_, k) => k); // đã sắp theo x
  const hull: number[] = [];
  const yv = (k: number) => (p[k] - mn) / rng, xv = (k: number) => k / (w - 1);
  for (const k of idx) { while (hull.length >= 2 && cross(xv(hull[hull.length - 2]), yv(hull[hull.length - 2]), xv(hull[hull.length - 1]), yv(hull[hull.length - 1]), xv(k), yv(k)) <= 0) hull.pop(); hull.push(k); }
  const lower = hull.length;
  for (let k = w - 3; k >= 0; k--) { while (hull.length > lower && cross(xv(hull[hull.length - 2]), yv(hull[hull.length - 2]), xv(hull[hull.length - 1]), yv(hull[hull.length - 1]), xv(k), yv(k)) <= 0) hull.pop(); hull.push(k); }
  hull.pop();
  let sdist = -Infinity;
  const lx = xv(last), ly = yv(last);
  for (let e = 0; e < hull.length; e++) {
    const a = hull[e], b = hull[(e + 1) % hull.length];
    const ex = xv(b) - xv(a), ey = yv(b) - yv(a), len = Math.hypot(ex, ey) || 1;
    const sdv = ((lx - xv(a)) * ey - (ly - yv(a)) * ex) / len; // CCW: ngoài là phía phải
    if (sdv > sdist) sdist = sdv;
  }
  o(51, Number.isFinite(sdist) ? sdist * 4 : 0);
  o(52, hull.length / w * 4);
  // 53–54: dãy con tăng/giảm dài nhất
  const lis = (sign: number) => { const tails: number[] = []; for (let k = 0; k < w; k++) { const v2 = sign * p[k]; let lo = 0, hi = tails.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (tails[mid] < v2) lo = mid + 1; else hi = mid; } tails[lo] = v2; } return tails.length; };
  o(53, lis(1) / Math.sqrt(w) - 2 + 0);
  o(54, lis(-1) / Math.sqrt(w) - 2 + 0);
  // 55: nghịch thế (Kendall tau giữa thời gian và giá)
  let inv = 0;
  for (let a = 0; a < w; a++) for (let b = a + 1; b < w; b++) if (p[a] > p[b]) inv++;
  o(55, 1 - (2 * inv) / ((w * (w - 1)) / 2));
  // 56: bản ghi đỉnh/đáy
  let hi = p[0], lo = p[0], rh = 0, rlw = 0;
  for (let k = 1; k < w; k++) { if (p[k] > hi) { hi = p[k]; rh++; } if (p[k] < lo) { lo = p[k]; rlw++; } }
  o(56, (rh - rlw) / Math.sqrt(w));

  /* ---------- 57–62: bước đi ±1 ---------- */
  let Wk = 0, zr = 0, pos = 0, nz = 0, wMax = 0, wMin = 0, ddW = 0, lastZero = 0;
  for (let t = 1; t < w; t++) {
    Wk += d[t] > 0 ? 1 : d[t] < 0 ? -1 : 0;
    if (Wk === 0) { zr++; lastZero = t; }
    if (Wk > 0) pos++;
    if (Wk !== 0) nz++;
    if (Wk > wMax) wMax = Wk;
    if (Wk < wMin) wMin = Wk;
    if (wMax - Wk > ddW) ddW = wMax - Wk;
  }
  const sw = Math.sqrt(w);
  o(57, zr / sw - 0.8);
  o(58, nz ? pos / nz - 0.5 : 0);
  o(59, ddW / sw - 1);
  o(60, (Wk - wMin) / sw - 1);
  o(61, (last - lastZero) / w);
  o(62, wMin / sw);

  /* ---------- 63–64: cây bao trùm nhỏ nhất (Prim) của đám mây (thời gian, giá) ---------- */
  const key = tmp, par = dist; // dùng lại bộ đệm
  const inT = new Uint8Array(w);
  key.fill(Infinity); par.fill(-1); key[0] = 0;
  let total = 0, lastEdge = 0, lastPar = 0;
  for (let it = 0; it < w; it++) {
    let u = -1;
    for (let k = 0; k < w; k++) if (!inT[k] && (u < 0 || key[k] < key[u])) u = k;
    inT[u] = 1; total += key[u];
    if (u === last) { lastEdge = key[u]; lastPar = par[u]; }
    for (let k = 0; k < w; k++) if (!inT[k]) { const e = Math.hypot(xv(u) - xv(k), yv(u) - yv(k)); if (e < key[k]) { key[k] = e; par[k] = u; } }
  }
  o(63, total / sw - 0.8);
  o(64, Math.sign(yv(lastPar) - yv(last)) * lastEdge * sw);
}

/** Cột đặc trưng của node njscb{k} (k = 1…64): 3 cột ứng với w = 32, 64, 128, tính tại các nến trong `rows`. */
export function graphColumns(logClose: ArrayLike<number>, rows: ArrayLike<number>): Float64Array[][] {
  // trả về [scale][k] → mảng giá trị theo hàng
  const res: Float64Array[][] = CB_SCALES.map(() => Array.from({ length: CB_COUNT }, () => new Float64Array(rows.length)));
  const buf = new Float64Array(CB_COUNT);
  CB_SCALES.forEach((w, s) => {
    for (let r = 0; r < rows.length; r++) {
      graphIndicators(logClose, rows[r], w, buf, 0);
      for (let k = 0; k < CB_COUNT; k++) res[s][k][r] = buf[k];
    }
  });
  return res;
}

export const cbName = (k: number) => `njscb${k}`;
