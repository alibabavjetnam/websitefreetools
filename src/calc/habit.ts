/** Tính chuỗi ngày (streak) cho thói quen từ danh sách ngày đã hoàn thành (YYYY-MM-DD) */

const shift = (key: string, days: number): string => {
  const [y, m, d] = key.split('-').map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + days));
  return x.toISOString().slice(0, 10);
};

export interface HabitStats {
  /** Chuỗi hiện tại: tính đến hôm nay, hoặc đến hôm qua nếu hôm nay chưa đánh dấu */
  current: number;
  best: number;
  /** Tỷ lệ hoàn thành trong 30 ngày gần nhất (gồm hôm nay), làm tròn % */
  last30: number;
}

export function habitStats(dates: string[], today: string): HabitStats {
  const set = new Set(dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today));

  let current = 0;
  let cursor = set.has(today) ? today : shift(today, -1);
  while (set.has(cursor)) {
    current++;
    cursor = shift(cursor, -1);
  }

  let best = 0;
  for (const d of set) {
    if (set.has(shift(d, -1))) continue; // chỉ bắt đầu đếm từ ngày đầu của mỗi chuỗi
    let len = 0;
    let c = d;
    while (set.has(c)) {
      len++;
      c = shift(c, 1);
    }
    best = Math.max(best, len);
  }

  let hit = 0;
  for (let i = 0; i < 30; i++) if (set.has(shift(today, -i))) hit++;
  return { current, best, last30: Math.round((hit / 30) * 100) };
}
