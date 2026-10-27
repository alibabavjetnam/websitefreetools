/** Tính toán ngày tháng theo lịch (không phụ thuộc múi giờ: làm việc với ngày dạng YYYY-MM-DD theo UTC). */

export const parseKey = (k: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 ? d : null;
};
export const toKey = (d: Date): string => d.toISOString().slice(0, 10);
export const todayKey = (): string => {
  const n = new Date();
  return toKey(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())));
};
const DAY = 86400000;
export const daysBetween = (a: Date, b: Date): number => Math.round((b.getTime() - a.getTime()) / DAY);
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/** Cộng tháng, giữ ngày cuối tháng hợp lệ (31/1 + 1 tháng = 28/29 tháng 2) */
export function addMonths(d: Date, n: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const ty = y + Math.floor(m / 12);
  const tm = ((m % 12) + 12) % 12;
  return new Date(Date.UTC(ty, tm, Math.min(d.getUTCDate(), daysInMonth(ty, tm))));
}
export const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY);

/** Khoảng cách dạng năm-tháng-ngày (a ≤ b), cách tính tuổi thông thường */
export function ymd(a: Date, b: Date): { y: number; m: number; d: number } {
  let y = b.getUTCFullYear() - a.getUTCFullYear();
  let m = b.getUTCMonth() - a.getUTCMonth();
  let d = b.getUTCDate() - a.getUTCDate();
  if (d < 0) {
    m -= 1;
    // mượn số ngày của tháng trước ngày b
    const pm = b.getUTCMonth() === 0 ? 11 : b.getUTCMonth() - 1;
    const py = b.getUTCMonth() === 0 ? b.getUTCFullYear() - 1 : b.getUTCFullYear();
    d += daysInMonth(py, pm);
  }
  if (m < 0) { y -= 1; m += 12; }
  return { y, m, d };
}

/** Ngày sinh nhật tiếp theo (sinh 29/2 thì năm không nhuận lấy 28/2) */
export function nextBirthday(birth: Date, today: Date): Date {
  const bm = birth.getUTCMonth();
  const bd = birth.getUTCDate();
  const at = (y: number) => new Date(Date.UTC(y, bm, Math.min(bd, daysInMonth(y, bm))));
  let n = at(today.getUTCFullYear());
  if (n.getTime() < today.getTime()) n = at(today.getUTCFullYear() + 1);
  return n;
}

/** Cung hoàng đạo phương Tây: khoá tiếng Anh ổn định */
export function zodiac(d: Date): string {
  const md = (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  const signs: [number, string][] = [[120, 'capricorn'], [219, 'aquarius'], [321, 'pisces'], [420, 'aries'], [521, 'taurus'], [621, 'gemini'], [723, 'cancer'], [823, 'leo'], [923, 'virgo'], [1023, 'libra'], [1122, 'scorpio'], [1222, 'sagittarius'], [1232, 'capricorn']];
  return (signs.find(([end]) => md < end) as [number, string])[1];
}

/** Con giáp theo năm âm lịch (gần đúng theo năm dương; trước Tết thuộc năm trước) */
export const CHINESE_ANIMALS = ['rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake', 'horse', 'goat', 'monkey', 'rooster', 'dog', 'pig'];
export const chineseAnimal = (year: number): string => CHINESE_ANIMALS[(((year - 2020) % 12) + 12) % 12];

/** Đếm ngày làm việc (thứ Hai – thứ Sáu) giữa hai ngày, tính cả hai đầu */
export function weekdaysBetween(a: Date, b: Date): number {
  const [s, e] = a <= b ? [a, b] : [b, a];
  const total = daysBetween(s, e) + 1;
  const full = Math.floor(total / 7);
  let n = full * 5;
  const startDow = s.getUTCDay();
  for (let i = 0; i < total % 7; i++) {
    const dow = (startDow + i) % 7;
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}
