/** Tính ngày làm việc giữa hai mốc, trừ cuối tuần và ngày lễ. */

const DAY = 86400000;
const toKey = (d: Date): string => d.toLocaleDateString('en-CA');
const parse = (s: string): Date => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

/**
 * Ngày nghỉ lễ chính thức của Việt Nam theo dương lịch, kèm Tết Nguyên đán (âm lịch quy đổi sẵn).
 * Tết và Giỗ Tổ tính theo âm lịch nên phải tra bảng cho từng năm.
 */
export const VN_HOLIDAYS: Record<string, string> = {
  // Cố định dương lịch
  '01-01': 'Tết Dương lịch',
  '04-30': 'Giải phóng miền Nam',
  '05-01': 'Quốc tế Lao động',
  '09-02': 'Quốc khánh',
};

/** Khoá ổn định của từng ngày lễ (dùng tra bản dịch ở trang: T('hol.' + key, tênViệt)). */
export const VN_HOLIDAY_KEYS: Record<string, string> = {
  '01-01': 'newYear',
  '04-30': 'reunification',
  '05-01': 'labour',
  '09-02': 'national',
};
const LUNAR_KEYS: Record<string, string> = { 'Tết Nguyên đán': 'tet', 'Giỗ Tổ Hùng Vương': 'hung' };

/** Hàm dịch tên ngày lễ: nhận khoá + tên tiếng Việt, trả về tên theo ngôn ngữ trang. */
export type HolidayNamer = (key: string, vi: string) => string;

/** Tết Nguyên đán và Giỗ Tổ Hùng Vương (10/3 âm) theo từng năm (ngày dương lịch). */
export const VN_LUNAR_HOLIDAYS: Record<number, { from: string; to: string; label: string }[]> = {
  2024: [{ from: '2024-02-08', to: '2024-02-14', label: 'Tết Nguyên đán' }, { from: '2024-04-18', to: '2024-04-18', label: 'Giỗ Tổ Hùng Vương' }],
  2025: [{ from: '2025-01-27', to: '2025-02-02', label: 'Tết Nguyên đán' }, { from: '2025-04-07', to: '2025-04-07', label: 'Giỗ Tổ Hùng Vương' }],
  2026: [{ from: '2026-02-16', to: '2026-02-22', label: 'Tết Nguyên đán' }, { from: '2026-04-26', to: '2026-04-26', label: 'Giỗ Tổ Hùng Vương' }],
  2027: [{ from: '2027-02-05', to: '2027-02-11', label: 'Tết Nguyên đán' }, { from: '2027-04-15', to: '2027-04-15', label: 'Giỗ Tổ Hùng Vương' }],
};

/** Tập hợp các ngày lễ (YYYY-MM-DD) trong khoảng năm cho trước, theo lịch VN. */
export function vnHolidaysBetween(fromYear: number, toYear: number, name: HolidayNamer = (_k, vi) => vi): Map<string, string> {
  const out = new Map<string, string>();
  for (let y = fromYear; y <= toYear; y++) {
    for (const [md, label] of Object.entries(VN_HOLIDAYS)) out.set(`${y}-${md}`, name(VN_HOLIDAY_KEYS[md], label));
    for (const h of VN_LUNAR_HOLIDAYS[y] ?? []) {
      let d = parse(h.from);
      const end = parse(h.to);
      while (d <= end) { out.set(toKey(d), name(LUNAR_KEYS[h.label] ?? h.label, h.label)); d = new Date(d.getTime() + DAY); }
    }
  }
  return out;
}

export interface WorkdaysOptions {
  excludeWeekend: boolean;
  /** 0 = Chủ nhật … 6 = Thứ Bảy: các thứ coi là ngày nghỉ */
  weekendDays: number[];
  holidays: Set<string>;
}

export interface WorkdaysResult {
  totalDays: number;
  workDays: number;
  weekendDays: number;
  holidayDays: number;
  /** Ngày lễ rơi vào ngày làm việc (không trùng cuối tuần) */
  holidaysOnWorkweek: { date: string; label: string }[];
}

/** Đếm ngày làm việc từ `from` tới `to` (bao gồm cả hai đầu). */
export function workdaysBetween(from: string, to: string, opts: WorkdaysOptions, holidayLabels?: Map<string, string>, defaultLabel = 'Ngày lễ'): WorkdaysResult {
  let start = parse(from);
  let end = parse(to);
  if (start > end) [start, end] = [end, start];
  const weekend = new Set(opts.weekendDays);
  let total = 0, work = 0, wknd = 0, holi = 0;
  const onWork: { date: string; label: string }[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY) {
    const d = new Date(t);
    const key = toKey(d);
    total++;
    const isWeekend = opts.excludeWeekend && weekend.has(d.getDay());
    const isHoliday = opts.holidays.has(key);
    if (isWeekend) wknd++;
    if (isHoliday) {
      holi++;
      if (!isWeekend) onWork.push({ date: key, label: holidayLabels?.get(key) ?? defaultLabel });
    }
    if (!isWeekend && !isHoliday) work++;
  }
  return { totalDays: total, workDays: work, weekendDays: wknd, holidayDays: holi, holidaysOnWorkweek: onWork };
}
