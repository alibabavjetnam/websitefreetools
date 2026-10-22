/** Đọc chuỗi khoảng trang kiểu "1-3, 5, 8-" (8- nghĩa là từ trang 8 đến hết) */
import { t, tf } from '../i18n';

export class RangeError extends Error {}

export function parseRanges(input: string, total: number): [number, number][] {
  const s = input.replace(/\s+/g, '').replace(/[–—]/g, '-');
  if (!s) throw new RangeError(t('lib.ranges.empty', 'Hãy nhập trang cần lấy, ví dụ: 1-3, 5, 8-'));
  const out: [number, number][] = [];
  for (const part of s.split(/[,;]/).filter(Boolean)) {
    const m = /^(\d*)-(\d*)$|^(\d+)$/.exec(part);
    if (!m) throw new RangeError(tf('lib.ranges.badFormat', '"{part}" không đúng dạng. Ví dụ hợp lệ: 1-3, 5, 8-', { part }));
    let from: number;
    let to: number;
    if (m[3]) from = to = Number(m[3]);
    else {
      from = m[1] ? Number(m[1]) : 1;
      to = m[2] ? Number(m[2]) : total;
    }
    if (from < 1 || to < 1) throw new RangeError(t('lib.ranges.min', 'Số trang bắt đầu từ 1.'));
    if (from > total || to > total) throw new RangeError(tf('lib.ranges.over', 'File chỉ có {total} trang, "{part}" vượt quá số trang.', { total, part }));
    if (from > to) throw new RangeError(tf('lib.ranges.reversed', 'Khoảng "{part}" bị ngược, trang đầu phải nhỏ hơn trang cuối.', { part }));
    out.push([from, to]);
  }
  return out;
}

/** Danh sách chỉ số trang (bắt đầu từ 0) theo thứ tự khoảng, giữ cả trang lặp nếu người dùng nhập lặp */
export const rangesToIndices = (ranges: [number, number][]): number[] =>
  ranges.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i));
