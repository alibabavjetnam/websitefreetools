/**
 * Phân tích biểu thức cron 5 trường (phút giờ ngày tháng thứ), mô tả bằng tiếng Việt
 * và tính các lần chạy tiếp theo. Theo quy ước của cron Unix (Vixie cron).
 */

export interface CronField {
  values: Set<number>;
  /** Trường để "*" (mọi giá trị) */
  any: boolean;
}

export interface CronExpr {
  minute: CronField;
  hour: CronField;
  dom: CronField;
  month: CronField;
  dow: CronField;
}

export class CronError extends Error {}

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DOW_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const MACROS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

const FIELD_SPECS = [
  { key: 'minute', label: 'phút', min: 0, max: 59 },
  { key: 'hour', label: 'giờ', min: 0, max: 23 },
  { key: 'dom', label: 'ngày trong tháng', min: 1, max: 31 },
  { key: 'month', label: 'tháng', min: 1, max: 12, names: MONTH_NAMES, nameBase: 1 },
  { key: 'dow', label: 'thứ trong tuần', min: 0, max: 7, names: DOW_NAMES, nameBase: 0 },
] as const;

function parseValue(token: string, spec: (typeof FIELD_SPECS)[number]): number {
  const upper = token.toUpperCase();
  if ('names' in spec) {
    const idx = spec.names.indexOf(upper as never);
    if (idx >= 0) return idx + spec.nameBase;
  }
  if (!/^\d+$/.test(token)) throw new CronError(`Giá trị "${token}" không hợp lệ ở trường ${spec.label}.`);
  const n = Number(token);
  if (n < spec.min || n > spec.max)
    throw new CronError(`Giá trị ${n} ở trường ${spec.label} phải từ ${spec.min} đến ${spec.max}.`);
  return n;
}

function parseField(raw: string, spec: (typeof FIELD_SPECS)[number]): CronField {
  const values = new Set<number>();
  const any = raw === '*' || raw === '?';
  for (const part of raw.split(',')) {
    if (!part) throw new CronError(`Trường ${spec.label} có dấu phẩy thừa.`);
    const [rangePart, stepPart, extra] = part.split('/');
    if (extra !== undefined) throw new CronError(`Trường ${spec.label} có quá nhiều dấu "/".`);
    let step = 1;
    if (stepPart !== undefined) {
      if (!/^\d+$/.test(stepPart) || Number(stepPart) === 0)
        throw new CronError(`Bước nhảy "${stepPart}" ở trường ${spec.label} phải là số lớn hơn 0.`);
      step = Number(stepPart);
    }
    let from: number;
    let to: number;
    if (rangePart === '*' || rangePart === '?') {
      from = spec.min;
      to = spec.key === 'dow' ? 6 : spec.max;
    } else if (rangePart.includes('-')) {
      const [a, b] = rangePart.split('-');
      from = parseValue(a, spec);
      to = parseValue(b, spec);
      if (from > to) throw new CronError(`Khoảng ${rangePart} ở trường ${spec.label} bị ngược.`);
    } else {
      from = parseValue(rangePart, spec);
      to = stepPart !== undefined ? (spec.key === 'dow' ? 6 : spec.max) : from;
    }
    for (let v = from; v <= to; v += step) values.add(spec.key === 'dow' && v === 7 ? 0 : v);
  }
  return { values, any };
}

export function parseCron(expression: string): CronExpr {
  let expr = expression.trim().replace(/\s+/g, ' ');
  if (!expr) throw new CronError('Hãy nhập biểu thức cron.');
  if (expr.startsWith('@')) {
    const m = MACROS[expr.toLowerCase()];
    if (!m) throw new CronError(`Không hỗ trợ "${expr}".`);
    expr = m;
  }
  const parts = expr.split(' ');
  if (parts.length !== 5)
    throw new CronError(`Cần đúng 5 trường (phút giờ ngày tháng thứ), bạn đang nhập ${parts.length} trường.`);
  const fields = parts.map((p, i) => parseField(p, FIELD_SPECS[i]));
  return { minute: fields[0], hour: fields[1], dom: fields[2], month: fields[3], dow: fields[4] };
}

function dayMatches(c: CronExpr, d: Date): boolean {
  const domOk = c.dom.values.has(d.getDate());
  const dowOk = c.dow.values.has(d.getDay());
  // Quy ước cron: nếu cả ngày-trong-tháng và thứ đều bị giới hạn thì chỉ cần khớp một trong hai
  if (!c.dom.any && !c.dow.any) return domOk || dowOk;
  if (!c.dom.any) return domOk;
  if (!c.dow.any) return dowOk;
  return true;
}

/** Các lần chạy tiếp theo, tính theo giờ địa phương của trình duyệt */
export function nextRuns(c: CronExpr, from: Date, count = 5): Date[] {
  const out: Date[] = [];
  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  const limit = from.getTime() + 5 * 366 * 24 * 3600 * 1000; // dừng sau 5 năm (vd. ngày 30/2 không bao giờ tới)

  while (out.length < count && d.getTime() <= limit) {
    if (!c.month.values.has(d.getMonth() + 1)) {
      d.setMonth(d.getMonth() + 1, 1);
      d.setHours(0, 0, 0, 0);
      continue;
    }
    if (!dayMatches(c, d)) {
      d.setDate(d.getDate() + 1);
      d.setHours(0, 0, 0, 0);
      continue;
    }
    if (!c.hour.values.has(d.getHours())) {
      d.setHours(d.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (!c.minute.values.has(d.getMinutes())) {
      d.setMinutes(d.getMinutes() + 1, 0, 0);
      continue;
    }
    out.push(new Date(d.getTime()));
    d.setMinutes(d.getMinutes() + 1, 0, 0);
  }
  return out;
}

const DOW_VI = ['Chủ nhật', 'thứ Hai', 'thứ Ba', 'thứ Tư', 'thứ Năm', 'thứ Sáu', 'thứ Bảy'];

function listText(vals: number[], fmt: (n: number) => string): string {
  if (vals.length <= 1) return vals.map(fmt).join('');
  return `${vals.slice(0, -1).map(fmt).join(', ')} và ${fmt(vals[vals.length - 1])}`;
}

/** Mô tả biểu thức bằng câu tiếng Việt dễ hiểu */
export function describeCron(c: CronExpr): string {
  const sorted = (f: CronField) => [...f.values].sort((a, b) => a - b);
  const mins = sorted(c.minute);
  const hours = sorted(c.hour);
  const pad = (n: number) => String(n).padStart(2, '0');

  let time: string;
  if (c.minute.any && c.hour.any) time = 'Mỗi phút';
  else if (c.hour.any && mins.length === 1) time = `Vào phút thứ ${mins[0]} của mỗi giờ`;
  else if (c.hour.any) time = `Vào các phút ${listText(mins, String)} của mỗi giờ`;
  else if (c.minute.any) time = `Mỗi phút trong khung giờ ${listText(hours, (h) => `${h}h`)}`;
  else if (mins.length * hours.length <= 6)
    time = `Lúc ${listText(hours.flatMap((h) => mins.map((m) => h * 60 + m)), (t) => `${pad(Math.floor(t / 60))}:${pad(t % 60)}`)}`;
  else time = `Vào phút ${listText(mins, String)} của các giờ ${listText(hours, String)}`;

  const parts = [time];
  if (!c.dom.any && !c.dow.any)
    parts.push(`ngày ${listText(sorted(c.dom), String)} hằng tháng hoặc vào ${listText(sorted(c.dow), (d) => DOW_VI[d])}`);
  else if (!c.dom.any) parts.push(`ngày ${listText(sorted(c.dom), String)} hằng tháng`);
  else if (!c.dow.any) parts.push(`vào ${listText(sorted(c.dow), (d) => DOW_VI[d])}`);
  else parts.push('mỗi ngày');
  if (!c.month.any) parts.push(`trong tháng ${listText(sorted(c.month), String)}`);
  return parts.join(', ') + '.';
}
