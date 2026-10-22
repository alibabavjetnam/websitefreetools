import { linearRegression } from './indicators';
import type { Series, TrendCriterion, TrendResult } from './types';

/**
 * Chấm điểm xu hướng tại nến i (chỉ dùng dữ liệu <= i), tổng 4 điểm:
 *  1. Trật tự SMA50 / SMA100 / SMA200 ...................... 2 điểm, chia theo từng cặp liền kề
 *       SMA50 > SMA100  → +0.5 điểm tăng,  SMA50 < SMA100  → +0.5 điểm giảm
 *       SMA100 > SMA200 → +1.5 điểm tăng,  SMA100 < SMA200 → +1.5 điểm giảm
 *  2. Kênh giá (hồi quy 50 nến, R² ≥ 0.5) .................. 1 điểm: xác nhận giá đi có trật tự
 *  3. Độ dốc SMA50 & SMA200 (so với 10 nến trước) ........... 1 điểm: xác nhận đà của MA
 * Có xu hướng khi một phe đạt từ TREND_MIN_SCORE điểm (3/4). Cặp SMA100/SMA200 (1.5 điểm) nặng hơn hẳn:
 * thiếu nó thì phe đó tối đa 0.5 + 2 = 2.5 điểm, nên không thể có xu hướng khi SMA100 chưa đồng thuận với SMA200
 * (ví dụ vừa đảo chiều: SMA50 đã xuống dưới SMA100 nhưng SMA100 vẫn trên SMA200). Có nó mà cả kênh giá lẫn độ dốc
 * cùng đồng thuận thì đủ điểm kể cả khi SMA50 đang hồi ngược. Tổng chỉ có 4 điểm nên hai phe không thể cùng đạt ngưỡng.
 */
export const TREND_WEIGHTS = { maOrder: 2, trendline: 1, maSlope: 1 } as const;

/** Điểm của từng cặp trong trật tự SMA (cộng lại bằng TREND_WEIGHTS.maOrder). */
const PAIR_50_100 = 0.5;
const PAIR_100_200 = 1.5;

/** Số điểm tối thiểu (trên 4) của một phe để công nhận có xu hướng. */
export const TREND_MIN_SCORE = 3;

const position = (a: number, b: number): string => (a > b ? 'nằm trên' : a < b ? 'nằm dưới' : 'bằng');

export function trendAt(s: Series, i: number): TrendResult {
  const criteria: TrendCriterion[] = [];
  const m50 = s.sma50[i], m100 = s.sma100[i], m200 = s.sma200[i];

  // 1. Trật tự SMA50 / SMA100 / SMA200: mỗi cặp liền kề đúng thứ tự được 1 điểm cho phe tương ứng
  const maOrderLabel = 'Trật tự SMA50 / SMA100 / SMA200';
  if (m50 !== null && m100 !== null && m200 !== null) {
    const up = (m50 > m100 ? PAIR_50_100 : 0) + (m100 > m200 ? PAIR_100_200 : 0);
    const down = (m50 < m100 ? PAIR_50_100 : 0) + (m100 < m200 ? PAIR_100_200 : 0);
    criteria.push({
      key: 'maOrder', label: maOrderLabel, weight: TREND_WEIGHTS.maOrder,
      vote: up > down ? 1 : down > up ? -1 : 0, up, down,
      note: `SMA50 ${position(m50, m100)} SMA100, SMA100 ${position(m100, m200)} SMA200`,
    });
  } else {
    criteria.push({ key: 'maOrder', label: maOrderLabel, weight: TREND_WEIGHTS.maOrder, vote: null, up: 0, down: 0, note: 'Cần ít nhất 200 nến' });
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

  // 3. Độ dốc SMA50 & SMA200
  const m50p = i >= 10 ? s.sma50[i - 10] : null;
  const m200p = i >= 10 ? s.sma200[i - 10] : null;
  if (m50 !== null && m200 !== null && m50p !== null && m200p !== null) {
    let vote: 1 | -1 | 0 = 0;
    if (m50 > m50p && m200 > m200p) vote = 1;
    else if (m50 < m50p && m200 < m200p) vote = -1;
    criteria.push({
      key: 'maSlope', label: 'Độ dốc SMA50 & SMA200', weight: TREND_WEIGHTS.maSlope, vote,
      up: vote === 1 ? TREND_WEIGHTS.maSlope : 0, down: vote === -1 ? TREND_WEIGHTS.maSlope : 0,
      note: vote === 1 ? 'Cả hai dốc lên' : vote === -1 ? 'Cả hai dốc xuống' : 'Không cùng hướng',
    });
  } else {
    criteria.push({ key: 'maSlope', label: 'Độ dốc SMA50 & SMA200', weight: TREND_WEIGHTS.maSlope, vote: null, up: 0, down: 0, note: 'Cần ít nhất 210 nến' });
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
