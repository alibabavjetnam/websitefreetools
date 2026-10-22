/**
 * Mô hình node njs: tổng có trọng số của 3488 đặc trưng (1024 node), huấn luyện bằng hồi quy logistic có điều chuẩn L2.
 * Trọng số nằm trong public/zzz2/model-njs.json (đã chuẩn hoá theo trung bình/độ lệch của giai đoạn huấn luyện).
 * Nhãn huấn luyện: từ giá mở nến kế tiếp, giá chạm +K×ATR trước (1) hay −K×ATR trước (0) trong H nến.
 */
import { computeNode, NODE_COUNT, nodeInfo } from './nodes';
import type { Context, Trade } from './core/engine';

export interface NjsModel {
  version: number; K: number; H: number; trainedUntil: number; threshold: number;
  nFeat: number; C: number; intercept: number; trainRows: number;
  w: number[]; mu: number[]; sd: number[]; importance: number[];
  walkForward: { year: number; auc: number; n: number; win: number; gross: number; net: number; cost: number }[];
}

export const NJS_WARMUP = 800;

export async function loadModel(url = 'model-njs.json'): Promise<NjsModel> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không tải được mô hình njs (HTTP ${res.status}).`);
  return (await res.json()) as NjsModel;
}

/** Điểm logit của mô hình tại mọi nến (dùng dữ liệu tới nến i, không nhìn trước). */
export async function scoreBars(ctx: Context, m: NjsModel, onProgress?: (done: number, total: number) => void): Promise<Float64Array> {
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
  return logit;
}

export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export interface NjsParams { delta: number; feePct: number; slipPct: number; from: number }

/** Giao dịch theo mô hình: |p − 0,5| ≥ delta thì vào lệnh ở giá mở nến kế tiếp, cắt lỗ = chốt lời = K×ATR, giữ tối đa H nến. */
export function runNjs(ctx: Context, logit: Float64Array, m: NjsModel, p: NjsParams): Trade[] {
  const { f } = ctx, n = f.c.length, trades: Trade[] = [];
  let busy = -1;
  for (let i = NJS_WARMUP; i < n - 2; i++) {
    if (i <= busy || f.bars[i].t < p.from) continue;
    const atr = f.atr[i];
    if (!(atr > 0)) continue;
    const pr = sigmoid(m.intercept + logit[i]);
    if (Math.abs(pr - 0.5) < p.delta) continue;
    const s: 1 | -1 = pr > 0.5 ? 1 : -1;
    const entry = f.o[i + 1] * (1 + (s * p.slipPct) / 100), risk = m.K * atr;
    const sl = entry - s * risk, tp = entry + s * risk;
    const last = Math.min(n - 1, i + 1 + m.H);
    let res: Trade['result'] = 'timeout', exit = last, grossR = 0;
    for (let j = i + 1; j <= last; j++) {
      const hitSL = s > 0 ? f.l[j] <= sl : f.h[j] >= sl, hitTP = s > 0 ? f.h[j] >= tp : f.l[j] <= tp;
      if (hitSL) { res = 'loss'; exit = j; grossR = -1; break; }
      if (hitTP) { res = 'win'; exit = j; grossR = 1; break; }
    }
    if (res === 'timeout') grossR = (s * (f.c[exit] - entry)) / risk;
    const cost = ((2 * (p.feePct + p.slipPct)) / 100 * entry) / risk;
    busy = exit;
    trades.push({ i, t: f.bars[i].t, dir: s, channel: ctx.bias.trend[ctx.dIdx[i]] === s ? 'with' : 'counter', entry, sl, tp, riskPct: (100 * risk) / entry, exitIdx: exit, result: res, grossR, netR: grossR - cost });
  }
  return trades;
}

/** Danh sách node có trọng số ảnh hưởng lớn nhất. */
export function topNodes(m: NjsModel, count = 20) {
  return m.importance.map((w, k) => ({ w, k: k + 1 })).sort((a, b) => b.w - a.w).slice(0, count)
    .map(({ w, k }) => ({ ...nodeInfo(k), weight: w }));
}
