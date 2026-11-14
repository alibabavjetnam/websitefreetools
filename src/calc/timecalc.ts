/** Tính thời lượng, giờ làm việc và đổi Unix timestamp. Phần thuần, không DOM. */

/** Đọc "1:30:15", "90:00", "1h 30m 15s", "45" (giây) thành số giây. NaN nếu sai. */
export function parseDurationText(input: string): number {
  const s = input.trim().toLowerCase();
  if (!s) return NaN;
  let sign = 1;
  let body = s;
  if (body.startsWith('-')) { sign = -1; body = body.slice(1).trim(); }
  if (/[hms]/.test(body) && !body.includes(':')) {
    const re = /(\d+(?:[.,]\d+)?)\s*(h|m|s)/g;
    let total = 0;
    let used = '';
    for (const m of body.matchAll(re)) {
      const v = Number(m[1].replace(',', '.'));
      total += m[2] === 'h' ? v * 3600 : m[2] === 'm' ? v * 60 : v;
      used += m[0];
    }
    if (used.replace(/\s/g, '').length !== body.replace(/\s/g, '').length) return NaN;
    return sign * total;
  }
  const parts = body.split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d+(?:[.,]\d+)?$/.test(p.trim()))) return NaN;
  const nums = parts.map((p) => Number(p.replace(',', '.')));
  let total = 0;
  for (const n of nums) total = total * 60 + n;
  return sign * total;
}

/** Số giây → "h:mm:ss" (giờ không giới hạn 24) */
export function formatDuration(totalSeconds: number): string {
  const neg = totalSeconds < 0;
  const t = Math.round(Math.abs(totalSeconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${neg ? '-' : ''}${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export interface DurationItem { sign: 1 | -1; seconds: number }
export const sumDurations = (items: DurationItem[]): number => items.reduce((a, b) => a + b.sign * b.seconds, 0);

/** Phân rã số giây thành ngày/giờ/phút/giây */
export function splitSeconds(totalSeconds: number): { days: number; hours: number; minutes: number; seconds: number } {
  const t = Math.round(Math.abs(totalSeconds));
  return { days: Math.floor(t / 86400), hours: Math.floor((t % 86400) / 3600), minutes: Math.floor((t % 3600) / 60), seconds: t % 60 };
}

/** "HH:MM" → số phút trong ngày; null nếu sai */
export function parseClock(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h > 23 || mi > 59 ? null : h * 60 + mi;
}

export interface WorkResult { grossMinutes: number; netMinutes: number; decimalHours: number; overnight: boolean; pay: number | null }

/** Giờ làm từ giờ vào đến giờ ra (qua nửa đêm thì cộng 24 giờ), trừ giờ nghỉ */
export function workTime(startMin: number, endMin: number, breakMin: number, hourlyRate: number | null): WorkResult {
  const overnight = endMin < startMin;
  const gross = (overnight ? endMin + 1440 : endMin) - startMin;
  const net = Math.max(0, gross - Math.max(0, breakMin));
  const decimalHours = Math.round((net / 60) * 100) / 100;
  return { grossMinutes: gross, netMinutes: net, decimalHours, overnight, pay: hourlyRate != null && hourlyRate >= 0 ? decimalHours * hourlyRate : null };
}

/** Đoán Unix timestamp tính bằng giây hay mili giây (từ 12 chữ số trở lên là mili giây) */
export function unixToDate(value: number): Date | null {
  if (!Number.isFinite(value)) return null;
  const ms = Math.abs(value) >= 1e11 ? value : value * 1000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}
export const dateToUnix = (d: Date): { seconds: number; millis: number } => ({ seconds: Math.floor(d.getTime() / 1000), millis: d.getTime() });
