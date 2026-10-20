import { isPivotHigh, isPivotLow, linearRegression } from './indicators';
import type { Series, Settings, TrendCriterion, TrendResult } from './types';

/**
 * Chấm điểm xu hướng tại nến i (chỉ dùng dữ liệu <= i), tổng 6 điểm:
 *  1. Cấu trúc đỉnh - đáy (HH/HL hoặc LH/LL) ............ 2 điểm (quan trọng nhất)
 *  2. Đường xu hướng / kênh giá (hồi quy 50 nến, R² ≥ 0.5) 1 điểm
 *  3. Trật tự MA: EMA20 > SMA50 > SMA200 (hoặc ngược lại)  1 điểm
 *  4. Vị trí giá so với EMA20, SMA50, SMA200 .............. 1 điểm
 *  5. Độ dốc SMA50 & SMA200 (so với 10 nến trước) ......... 1 điểm
 * Xu hướng được công nhận khi điểm phe đó ≥ trendMinScore, hơn phe kia ≥ 3 điểm
 * và cấu trúc đỉnh - đáy không ngược chiều.
 */
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
    criteria.push({ key: 'structure', label: 'Cấu trúc đỉnh - đáy', weight: 2, vote, note });
  } else {
    criteria.push({ key: 'structure', label: 'Cấu trúc đỉnh - đáy', weight: 2, vote: null, note: 'Chưa đủ đỉnh/đáy để so sánh' });
  }

  // 2. Đường xu hướng / kênh giá
  const lr = linearRegression(s.close, i, 50);
  if (lr) {
    let vote: 1 | -1 | 0 = 0;
    if (lr.r2 >= 0.5 && lr.slope > 0) vote = 1;
    else if (lr.r2 >= 0.5 && lr.slope < 0) vote = -1;
    criteria.push({
      key: 'trendline', label: 'Kênh giá 50 nến', weight: 1, vote,
      note: `Độ dốc ${lr.slopePct >= 0 ? '+' : ''}${lr.slopePct.toFixed(3)}%/nến, R² ${lr.r2.toFixed(2)}`,
    });
  } else {
    criteria.push({ key: 'trendline', label: 'Kênh giá 50 nến', weight: 1, vote: null, note: 'Thiếu dữ liệu' });
  }

  const e20 = s.ema20[i], m50 = s.sma50[i], m200 = s.sma200[i];
  const c = s.close[i];

  // 3. Trật tự MA
  if (e20 !== null && m50 !== null && m200 !== null) {
    let vote: 1 | -1 | 0 = 0;
    if (e20 > m50 && m50 > m200) vote = 1;
    else if (e20 < m50 && m50 < m200) vote = -1;
    criteria.push({
      key: 'maOrder', label: 'Trật tự EMA20 / SMA50 / SMA200', weight: 1, vote,
      note: vote === 1 ? 'EMA20 > SMA50 > SMA200' : vote === -1 ? 'EMA20 < SMA50 < SMA200' : 'Các đường MA đan xen',
    });
  } else {
    criteria.push({ key: 'maOrder', label: 'Trật tự EMA20 / SMA50 / SMA200', weight: 1, vote: null, note: 'Cần ít nhất 200 nến' });
  }

  // 4. Vị trí giá
  if (e20 !== null && m50 !== null && m200 !== null) {
    let vote: 1 | -1 | 0 = 0;
    if (c > e20 && c > m50 && c > m200) vote = 1;
    else if (c < e20 && c < m50 && c < m200) vote = -1;
    criteria.push({
      key: 'pricePos', label: 'Vị trí giá so với MA', weight: 1, vote,
      note: vote === 1 ? 'Giá nằm trên cả 3 đường MA' : vote === -1 ? 'Giá nằm dưới cả 3 đường MA' : 'Giá nằm giữa các đường MA',
    });
  } else {
    criteria.push({ key: 'pricePos', label: 'Vị trí giá so với MA', weight: 1, vote: null, note: 'Cần ít nhất 200 nến' });
  }

  // 5. Độ dốc MA
  const m50p = i >= 10 ? s.sma50[i - 10] : null;
  const m200p = i >= 10 ? s.sma200[i - 10] : null;
  if (m50 !== null && m200 !== null && m50p !== null && m200p !== null) {
    let vote: 1 | -1 | 0 = 0;
    if (m50 > m50p && m200 > m200p) vote = 1;
    else if (m50 < m50p && m200 < m200p) vote = -1;
    criteria.push({
      key: 'maSlope', label: 'Độ dốc SMA50 & SMA200', weight: 1, vote,
      note: vote === 1 ? 'Cả hai dốc lên' : vote === -1 ? 'Cả hai dốc xuống' : 'Không cùng hướng',
    });
  } else {
    criteria.push({ key: 'maSlope', label: 'Độ dốc SMA50 & SMA200', weight: 1, vote: null, note: 'Cần ít nhất 210 nến' });
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
