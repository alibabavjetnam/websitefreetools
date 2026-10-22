/**
 * Theo dõi "mua đáy 4h" = bộ lọc giá njs + điều kiện thanh lý / funding của ngày trước (bằng luật).
 * Nghiên cứu (BTC, 2024 đến 2026, huấn luyện đến hết 2023) cho thấy dấu hiệu nhưng mẫu rất nhỏ; công cụ này để tích luỹ thêm lệnh mới.
 * Không nhìn trước: đặc trưng njs và z-score thanh lý/funding chỉ dùng dữ liệu của ngày UTC đã đóng.
 */
import { computeNode, NODE_COUNT } from './nodes';
import type { Context } from './core/engine';

export const REV_NW = 12;        // đáy thấp nhất 12 nến 4h
export const REV_H = 30;         // giữ tối đa 30 nến 4h
export const REV_WARMUP = 800;
const DAY = 86_400_000;
const RAW = 'https://raw.githubusercontent.com/ErcinDedeoglu/crypto-market-data/main/data/daily/';

export interface RevModel {
  version: number; kind: string; trainedUntil: number; trainRows: number; threshold: number;
  nFeat: number; intercept: number; w: number[]; mu: number[]; sd: number[]; check: [number, number][];
}

export async function loadRevModel(url = 'model-dao4h.json'): Promise<RevModel> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không tải được mô hình đáy 4h (HTTP ${res.status}).`);
  return (await res.json()) as RevModel;
}

async function series(name: string): Promise<Map<number, number>> {
  const res = await fetch(`${RAW}${name}.json`);
  if (!res.ok) throw new Error(`Không tải được dữ liệu ${name} (HTTP ${res.status}). Hãy bấm chạy lại.`);
  const j = (await res.json()) as { data: { timestamp: number; value: number }[] };
  const m = new Map<number, number>();
  for (const p of j.data) if (Number.isFinite(p.value)) m.set(Math.floor(p.timestamp / DAY) * DAY, p.value);
  return m;
}

export interface Deriv { liqLong: Map<number, number>; funding: Map<number, number> }
export async function loadDeriv(): Promise<Deriv> {
  const [liqLong, funding] = await Promise.all([series('btc_long_liquidations_usd'), series('btc_funding_rates')]);
  return { liqLong, funding };
}

/** z-score 30 ngày (trung bình và độ lệch của 30 ngày TRƯỚC, không gồm ngày hiện tại); thiếu dữ liệu thì bỏ. */
export function zscores(m: Map<number, number>, w = 30): Map<number, number> {
  const days = [...m.keys()].sort((a, b) => a - b), out = new Map<number, number>();
  for (let k = w; k < days.length; k++) {
    let ok = true, s = 0, s2 = 0;
    for (let q = k - w; q < k; q++) {
      const d = days[q];
      if (days[k] - d !== (k - q) * DAY) { ok = false; break; }   // phải liên tục theo ngày
      const x = m.get(d)!; s += x; s2 += x * x;
    }
    if (!ok) continue;
    const mean = s / w, sd = Math.sqrt(Math.max(0, s2 / w - mean * mean));
    out.set(days[k], (m.get(days[k])! - mean) / (sd + 1e-12));
  }
  return out;
}

/** Xác suất mô hình tại mọi nến (dùng dữ liệu tới nến i). */
export async function scoreRev(ctx: Context, m: RevModel, onProgress?: (done: number, total: number) => void): Promise<Float64Array> {
  const n = ctx.f.c.length, logit = new Float64Array(n);
  let k = 0;
  for (let id = 1; id <= NODE_COUNT; id++) {
    const { cols } = computeNode(ctx, id);
    for (const col of cols) {
      const w = m.w[k], mu = m.mu[k], sd = m.sd[k];
      if (w !== 0) for (let i = 0; i < n; i++) { let z = (col[i] - mu) / sd; z = z > 6 ? 6 : z < -6 ? -6 : z; logit[i] += w * z; }
      k++;
    }
    if (id % 16 === 0) { onProgress?.(id, NODE_COUNT); await new Promise((r) => setTimeout(r, 0)); }
  }
  if (k !== m.nFeat) throw new Error(`Số đặc trưng không khớp mô hình (${k} ≠ ${m.nFeat}). Hãy tải lại trang.`);
  const p = new Float64Array(n);
  for (let i = 0; i < n; i++) p[i] = 1 / (1 + Math.exp(-(m.intercept + logit[i])));
  return p;
}

export type RuleKey = 'all' | 'njs' | 'liq25' | 'liq25njs' | 'liq15njs' | 'fundnjs';
export const RULES: { key: RuleKey; label: string }[] = [
  { key: 'all', label: 'Mọi nến tạo đáy 12 nến (đối chứng)' },
  { key: 'njs', label: 'Chỉ njs (nửa trên điểm)' },
  { key: 'liq25', label: 'Thanh lý long z > 2,5 (ngày trước)' },
  { key: 'liq25njs', label: 'njs nửa trên + thanh lý long z > 2,5' },
  { key: 'liq15njs', label: 'njs nửa trên + thanh lý long z > 1,5' },
  { key: 'fundnjs', label: 'njs nửa trên + funding z < −1' },
];

export interface RevSignal {
  i: number; t: number; entry: number; sl: number; tp: number; riskPct: number;
  zLiq: number | null; zFund: number | null; pNjs: number; njsHi: boolean;
  result: 'win' | 'loss' | 'timeout' | 'open'; netR: number | null; flags: Record<RuleKey, boolean>;
}

/** Quét mọi nến đáy 12 nến kể từ `from`; kết quả sau phí theo SL/TP 1:1 (SL = đáy nến − 0,5 ATR). */
export function scanBottoms(ctx: Context, pNjs: Float64Array, m: RevModel, d: Deriv, p: { feePct: number; slipPct: number; from: number }): RevSignal[] {
  const { f } = ctx, n = f.c.length, out: RevSignal[] = [];
  const zL = zscores(d.liqLong), zF = zscores(d.funding);
  for (let i = Math.max(REV_WARMUP, REV_NW); i < n - 1; i++) {
    if (f.bars[i].t < p.from || !(f.atr[i] > 0)) continue;
    let mn = Infinity;
    for (let j = i - REV_NW + 1; j <= i; j++) if (f.l[j] < mn) mn = f.l[j];
    if (f.l[i] !== mn) continue;
    const prevDay = Math.floor(f.bars[i].t / DAY) * DAY - DAY;
    const zLiq = zL.get(prevDay) ?? null, zFund = zF.get(prevDay) ?? null;
    const entry = f.o[i + 1], sl = f.l[i] - 0.5 * f.atr[i], risk = entry - sl;
    if (!(risk > 0)) continue;
    const tp = entry + risk, cost = ((2 * (p.feePct + p.slipPct)) / 100 * entry) / risk;
    let result: RevSignal['result'] = 'open', netR: number | null = null;
    for (let j = i + 1; j <= Math.min(n - 1, i + REV_H); j++) {
      if (f.l[j] <= sl) { result = 'loss'; netR = -1 - cost; break; }
      if (f.h[j] >= tp) { result = 'win'; netR = 1 - cost; break; }
    }
    if (result === 'open' && i + REV_H <= n - 1) {
      result = 'timeout';
      netR = Math.max(-1, Math.min(1, (f.c[i + REV_H] - entry) / risk)) - cost;
    }
    const hi = pNjs[i] >= m.threshold;
    const flags: Record<RuleKey, boolean> = {
      all: true, njs: hi, liq25: zLiq !== null && zLiq > 2.5,
      liq25njs: hi && zLiq !== null && zLiq > 2.5, liq15njs: hi && zLiq !== null && zLiq > 1.5, fundnjs: hi && zFund !== null && zFund < -1,
    };
    out.push({ i, t: f.bars[i].t, entry, sl, tp, riskPct: (100 * risk) / entry, zLiq, zFund, pNjs: pNjs[i], njsHi: hi, result, netR, flags });
  }
  return out;
}

/** Nến đã đóng gần nhất: có phải đáy 12 nến và đang thoả điều kiện nào (vào lệnh ở giá mở nến kế tiếp). */
export function currentSignal(ctx: Context, pNjs: Float64Array, m: RevModel, d: Deriv): { t: number; close: number; sl: number; isBottom: boolean; zLiq: number | null; zFund: number | null; pNjs: number; flags: Record<RuleKey, boolean> } {
  const { f } = ctx, i = f.c.length - 1;
  let mn = Infinity;
  for (let j = i - REV_NW + 1; j <= i; j++) if (f.l[j] < mn) mn = f.l[j];
  const prevDay = Math.floor(f.bars[i].t / DAY) * DAY - DAY;
  const zLiq = zscores(d.liqLong).get(prevDay) ?? null, zFund = zscores(d.funding).get(prevDay) ?? null;
  const hi = pNjs[i] >= m.threshold, isBottom = f.l[i] === mn && f.atr[i] > 0;
  const flags: Record<RuleKey, boolean> = {
    all: isBottom, njs: isBottom && hi, liq25: isBottom && zLiq !== null && zLiq > 2.5,
    liq25njs: isBottom && hi && zLiq !== null && zLiq > 2.5, liq15njs: isBottom && hi && zLiq !== null && zLiq > 1.5, fundnjs: isBottom && hi && zFund !== null && zFund < -1,
  };
  return { t: f.bars[i].t, close: f.c[i], sl: f.l[i] - 0.5 * f.atr[i], isBottom, zLiq, zFund, pNjs: pNjs[i], flags };
}
