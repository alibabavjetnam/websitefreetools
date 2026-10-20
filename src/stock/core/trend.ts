import { isPivotHigh, isPivotLow, linearRegression } from './indicators';
import type { Series, Settings, TrendCriterion, TrendResult } from './types';

/**
 * Chấm điểm xu hướng tại nến i (chỉ dùng dữ liệu <= i), tổng 7 điểm:
 *  1. Cấu trúc đỉnh - đáy (HH/HL hoặc LH/LL) ............. 3 điểm: đọc trực tiếp từ giá, báo sớm nhất
 *  2. Trật tự SMA50 / SMA200 ............................... 2 điểm: xu hướng dài hạn, bền nhưng chậm
 *  3. Kênh giá (hồi quy 50 nến, R² ≥ 0.5) ................. 1 điểm: xác nhận giá đi có trật tự
 *  4. Độ dốc SMA50 & SMA200 (so với 10 nến trước) .......... 1 điểm: xác nhận đà của MA
 * Tiêu chí 3 và 4 phần nào trùng ý với 1 và 2 nên chỉ giữ vai trò xác nhận.
 * Xu hướng được công nhận khi điểm phe đó ≥ trendMinScore, hơn phe kia ≥ 3 điểm
 * và cấu trúc đỉnh - đáy không ngược chiều.
 */
export const TREND_WEIGHTS = { structure: 3, maOrder: 2, trendline: 1, maSlope: 1 } as const;

export function trendAt(s: Series, i: number, cfg: Settings): TrendResult {
  const criteria: TrendCriterion[] = [];
  const P = 3; // độ rộng pivot cho cấu trúc
  const SCAN = 150;

  // 1. Cấu trúc đỉnh - đáy
  const highsIdx: number[] = [];
  const lowsIdx: number[] = [];
  for (let k = i - P; k >= Math.max(P, i - SCAN) && (highsIdx.length < 2 || lowsIdx.length < 2); k--) {
    if (highsIdx.length < 2 && isPivotHigh(s.high, k, P, P, i)) highsIdx.push(k);
    if (lowsIdx.length < 2 && isPivotLow(s.low, k, P, P, i)) lowsIdx.push(k);
  }
  if (highsIdx.length === 2 && lowsIdx.length === 2) {
    const [h2, h1] = highsIdx.map((k) => s.high[k]); // h2 = gần nhất
    const [l2, l1] = lowsIdx.map((k) => s.low[k]);
    // Giá hiện tại phá đỉnh/đáy gần nhất cũng được tính như một đỉnh/đáy mới
    const hh = h2 > h1 || s.close[i] > h2;
    const hl = l2 > l1;
    const lh = h2 < h1;
    const ll = l2 < l1 || s.close[i] < l2;
    let vote: 1 | -1 | 0 = 0;
    let note = 'Đỉnh/đáy đan xen, chưa rõ cấu trúc';
    if (hh && hl && !ll) { vote = 1; note = 'Đỉnh sau cao hơn, đáy sau cao hơn (HH-HL)'; }
    else if (lh && ll && !hh) { vote = -1; note = 'Đỉnh sau thấp hơn, đáy sau thấp hơn (LH-LL)'; }
    criteria.push({ key: 'structure', label: 'Cấu trúc đỉnh - đáy', weight: TREND_WEIGHTS.structure, vote, note });
  } else {
    criteria.push({ key: 'structure', label: 'Cấu trúc đỉnh - đáy', weight: TREND_WEIGHTS.structure, vote: null, note: 'Chưa đủ đỉnh/đáy để so sánh' });
  }

  // 2. Kênh giá (hồi quy 50 nến)
  const lr = linearRegression(s.close, i, 50);
  if (lr) {
    let vote: 1 | -1 | 0 = 0;
    if (lr.r2 >= 0.5 && lr.slope > 0) vote = 1;
    else if (lr.r2 >= 0.5 && lr.slope < 0) vote = -1;
    criteria.push({
      key: 'trendline', label: 'Kênh giá 50 nến', weight: TREND_WEIGHTS.trendline, vote,
      note: `Độ dốc ${lr.slopePct >= 0 ? '+' : ''}${lr.slopePct.toFixed(3)}%/nến, R² ${lr.r2.toFixed(2)}`,
    });
  } else {
    criteria.push({ key: 'trendline', label: 'Kênh giá 50 nến', weight: TREND_WEIGHTS.trendline, vote: null, note: 'Thiếu dữ liệu' });
  }

  const m50 = s.sma50[i], m200 = s.sma200[i];

  // 3. Trật tự SMA50 / SMA200 (cắt vàng / cắt tử thần)
  if (m50 !== null && m200 !== null) {
    let vote: 1 | -1 | 0 = 0;
    if (m50 > m200) vote = 1;
    else if (m50 < m200) vote = -1;
    criteria.push({
      key: 'maOrder', label: 'Trật tự SMA50 / SMA200', weight: TREND_WEIGHTS.maOrder, vote,
      note: vote === 1 ? 'SMA50 nằm trên SMA200' : vote === -1 ? 'SMA50 nằm dưới SMA200' : 'SMA50 bằng SMA200',
    });
  } else {
    criteria.push({ key: 'maOrder', label: 'Trật tự SMA50 / SMA200', weight: TREND_WEIGHTS.maOrder, vote: null, note: 'Cần ít nhất 200 nến' });
  }

  // 4. Độ dốc MA
  const m50p = i >= 10 ? s.sma50[i - 10] : null;
  const m200p = i >= 10 ? s.sma200[i - 10] : null;
  if (m50 !== null && m200 !== null && m50p !== null && m200p !== null) {
    let vote: 1 | -1 | 0 = 0;
    if (m50 > m50p && m200 > m200p) vote = 1;
    else if (m50 < m50p && m200 < m200p) vote = -1;
    criteria.push({
      key: 'maSlope', label: 'Độ dốc SMA50 & SMA200', weight: TREND_WEIGHTS.maSlope, vote,
      note: vote === 1 ? 'Cả hai dốc lên' : vote === -1 ? 'Cả hai dốc xuống' : 'Không cùng hướng',
    });
  } else {
    criteria.push({ key: 'maSlope', label: 'Độ dốc SMA50 & SMA200', weight: TREND_WEIGHTS.maSlope, vote: null, note: 'Cần ít nhất 210 nến' });
  }

  let upScore = 0, downScore = 0;
  const maxScore = criteria.reduce((a, b) => a + b.weight, 0);
  for (const cr of criteria) {
    if (cr.vote === 1) upScore += cr.weight;
    if (cr.vote === -1) downScore += cr.weight;
  }
  const structureVote = criteria[0].vote;
  let trend: TrendResult['trend'] = 'SIDEWAYS';
  if (upScore >= cfg.trendMinScore && upScore - downScore >= 3 && structureVote !== -1) trend = 'UP';
  else if (downScore >= cfg.trendMinScore && downScore - upScore >= 3 && structureVote !== 1) trend = 'DOWN';

  return { trend, upScore, downScore, maxScore, criteria };
}

export const TREND_LABEL: Record<TrendResult['trend'], string> = {
  UP: 'Xu hướng tăng',
  DOWN: 'Xu hướng giảm',
  SIDEWAYS: 'Không có xu hướng',
};
