import { linearRegression } from './indicators';
import type { Series, TrendCriterion, TrendResult } from './types';

/**
 * Chấm điểm xu hướng tại nến i (chỉ dùng dữ liệu <= i), tổng 4 điểm:
 *  1. SMA64 so với SMA128 ................................... 2 điểm: SMA64 > SMA128 → tăng, SMA64 < SMA128 → giảm
 *  2. Kênh giá (hồi quy 50 nến, R² ≥ 0.5) .................. 1 điểm: độ dốc dương → tăng, âm → giảm
 *  3. Độ dốc SMA64 & SMA128 (so với 10 nến trước) ........... 1 điểm: cả hai cao hơn → tăng, cả hai thấp hơn → giảm
 * Có xu hướng khi một phe đạt từ TREND_MIN_SCORE điểm (3/4). Tổng chỉ có 4 điểm nên hai phe không thể cùng đạt ngưỡng.
 */
export const TREND_WEIGHTS = { maOrder: 2, trendline: 1, maSlope: 1 } as const;

/** Số điểm tối thiểu (trên 4) của một phe để công nhận có xu hướng. */
export const TREND_MIN_SCORE = 3;

const position = (a: number, b: number): string => (a > b ? 'nằm trên' : a < b ? 'nằm dưới' : 'bằng');

export function trendAt(s: Series, i: number): TrendResult {
  const criteria: TrendCriterion[] = [];
  const m64 = s.sma64[i], m128 = s.sma128[i];

  // 1. SMA64 so với SMA128
  const maLabel = 'SMA64 so với SMA128';
  const W1 = TREND_WEIGHTS.maOrder;
  if (m64 !== null && m128 !== null) {
    const vote: 1 | -1 | 0 = m64 > m128 ? 1 : m64 < m128 ? -1 : 0;
    criteria.push({
      key: 'maOrder', label: maLabel, weight: W1, vote, up: vote === 1 ? W1 : 0, down: vote === -1 ? W1 : 0,
      note: `SMA64 ${position(m64, m128)} SMA128`,
    });
  } else {
    criteria.push({ key: 'maOrder', label: maLabel, weight: W1, vote: null, up: 0, down: 0, note: 'Cần ít nhất 128 nến' });
  }

  // 2. Kênh giá (hồi quy 50 nến)
  const lr = linearRegression(s.close, i, 50);
  if (lr) {
    let vote: 1 | -1 | 0 = 0;
    if (lr.r2 >= 0.5 && lr.slope > 0) vote = 1;
    else if (lr.r2 >= 0.5 && lr.slope < 0) vote = -1;
    criteria.push({
      key: 'trendline', label: 'Kênh giá 50 nến', weight: TREND_WEIGHTS.trendline, vote,
      up: vote === 1 ? TREND_WEIGHTS.trendline : 0, down: vote === -1 ? TREND_WEIGHTS.trendline : 0,
      note: `Độ dốc ${lr.slopePct >= 0 ? '+' : ''}${lr.slopePct.toFixed(3)}%/nến, R² ${lr.r2.toFixed(2)}`,
    });
  } else {
    criteria.push({ key: 'trendline', label: 'Kênh giá 50 nến', weight: TREND_WEIGHTS.trendline, vote: null, up: 0, down: 0, note: 'Thiếu dữ liệu' });
  }

  // 3. Độ dốc SMA64 & SMA128 (so với 10 nến trước)
  const m64p = i >= 10 ? s.sma64[i - 10] : null;
  const m128p = i >= 10 ? s.sma128[i - 10] : null;
  if (m64 !== null && m128 !== null && m64p !== null && m128p !== null) {
    let vote: 1 | -1 | 0 = 0;
    if (m64 > m64p && m128 > m128p) vote = 1;
    else if (m64 < m64p && m128 < m128p) vote = -1;
    criteria.push({
      key: 'maSlope', label: 'Độ dốc SMA64 & SMA128', weight: TREND_WEIGHTS.maSlope, vote,
      up: vote === 1 ? TREND_WEIGHTS.maSlope : 0, down: vote === -1 ? TREND_WEIGHTS.maSlope : 0,
      note: vote === 1 ? 'Cả hai dốc lên' : vote === -1 ? 'Cả hai dốc xuống' : 'Không cùng hướng',
    });
  } else {
    criteria.push({ key: 'maSlope', label: 'Độ dốc SMA64 & SMA128', weight: TREND_WEIGHTS.maSlope, vote: null, up: 0, down: 0, note: 'Cần ít nhất 138 nến' });
  }

  const maxScore = criteria.reduce((a, b) => a + b.weight, 0);
  const upScore = criteria.reduce((a, b) => a + b.up, 0);
  const downScore = criteria.reduce((a, b) => a + b.down, 0);
  let trend: TrendResult['trend'] = 'SIDEWAYS';
  if (upScore >= TREND_MIN_SCORE) trend = 'UP';
  else if (downScore >= TREND_MIN_SCORE) trend = 'DOWN';

  return { trend, upScore, downScore, maxScore, criteria };
}

export const TREND_LABEL: Record<TrendResult['trend'], string> = {
  UP: 'Xu hướng tăng',
  DOWN: 'Xu hướng giảm',
  SIDEWAYS: 'Không có xu hướng',
};
