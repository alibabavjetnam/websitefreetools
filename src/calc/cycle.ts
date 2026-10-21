/** Dự đoán chu kỳ kinh nguyệt từ các kỳ đã ghi. Chỉ mang tính tham khảo, không thay tư vấn y tế. */

export interface CyclePrediction {
  avgCycle: number;
  avgPeriod: number;
  nextStart: string; // YYYY-MM-DD
  predictions: { start: string; fertileStart: string; fertileEnd: string; ovulation: string; periodEnd: string }[];
  phaseToday: string;
  daysToNext: number;
}

const DAY = 86400000;
const toKey = (d: Date): string => d.toLocaleDateString('en-CA');
const parse = (s: string): Date => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s: string, n: number): string => toKey(new Date(parse(s).getTime() + n * DAY));
const diffDays = (a: string, b: string): number => Math.round((parse(a).getTime() - parse(b).getTime()) / DAY);

/**
 * @param starts Ngày bắt đầu các kỳ (YYYY-MM-DD), không cần sắp xếp.
 * @param defCycle Độ dài chu kỳ mặc định khi chưa đủ dữ liệu (ngày).
 * @param defPeriod Số ngày hành kinh mặc định.
 * @param months Số chu kỳ dự đoán tới.
 * @param today Ngày hiện tại (để test); mặc định hôm nay.
 */
export function predictCycle(starts: string[], defCycle = 28, defPeriod = 5, months = 6, today = toKey(new Date())): CyclePrediction | null {
  const sorted = [...new Set(starts)].sort();
  if (!sorted.length) return null;

  // Độ dài chu kỳ trung bình từ khoảng cách giữa các kỳ liên tiếp (bỏ giá trị bất thường)
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const g = diffDays(sorted[i], sorted[i - 1]);
    if (g >= 15 && g <= 60) gaps.push(g);
  }
  const avgCycle = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : defCycle;
  const avgPeriod = defPeriod;

  const last = sorted[sorted.length - 1];
  // Nếu kỳ gần nhất đã lâu hơn một chu kỳ, dự đoán từ kỳ đáng lẽ tới gần nhất
  let base = last;
  while (diffDays(today, base) >= avgCycle) base = addDays(base, avgCycle);

  const predictions: CyclePrediction['predictions'] = [];
  for (let i = 0; i < months; i++) {
    const start = addDays(base, i * avgCycle);
    // Rụng trứng ~14 ngày trước kỳ kế tiếp; khoảng dễ thụ thai = 5 ngày trước + ngày rụng trứng
    const ovulation = addDays(addDays(start, avgCycle), -14);
    predictions.push({
      start,
      periodEnd: addDays(start, avgPeriod - 1),
      ovulation,
      fertileStart: addDays(ovulation, -5),
      fertileEnd: addDays(ovulation, 1),
    });
  }

  const nextStart = predictions.find((p) => diffDays(p.start, today) >= 0)?.start ?? predictions[0].start;
  const daysToNext = diffDays(nextStart, today);

  // Xác định giai đoạn hôm nay
  let phaseToday = 'Ngoài kỳ dự đoán';
  for (const p of predictions) {
    if (today >= p.start && today <= p.periodEnd) { phaseToday = 'Đang hành kinh'; break; }
    if (today >= p.fertileStart && today <= p.fertileEnd) { phaseToday = today === p.ovulation ? 'Ngày rụng trứng' : 'Khoảng dễ thụ thai'; break; }
    if (today > p.periodEnd && today < p.fertileStart) { phaseToday = 'Giai đoạn nang trứng'; break; }
    if (today > p.fertileEnd && today < addDays(p.start, avgCycle)) { phaseToday = 'Giai đoạn hoàng thể'; break; }
  }

  return { avgCycle, avgPeriod, nextStart, predictions, phaseToday, daysToNext };
}
