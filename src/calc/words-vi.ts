/** Đọc số tiền thành chữ tiếng Việt, ví dụ 1.250.000 -> "Một triệu hai trăm năm mươi nghìn đồng" */

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

/** Đọc một nhóm 3 chữ số. full = true khi phía trước còn nhóm lớn hơn (phải đọc "không trăm", "lẻ") */
function readGroup(n: number, full: boolean): string {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  const words: string[] = [];
  if (h > 0 || full) words.push(DIGITS[h], 'trăm');
  if (t === 0) {
    if (u > 0 && (h > 0 || full)) words.push('lẻ');
  } else if (t === 1) {
    words.push('mười');
  } else {
    words.push(DIGITS[t], 'mươi');
  }
  if (u > 0) {
    if (u === 1 && t >= 2) words.push('mốt');
    else if (u === 5 && t >= 1) words.push('lăm');
    else if (u === 4 && t >= 2) words.push('tư');
    else words.push(DIGITS[u]);
  }
  return words.join(' ');
}

const UNITS = ['', 'nghìn', 'triệu'];

/** Đọc số nguyên không âm (tối đa 15 chữ số, đủ cho số tiền) */
export function numberToVietnamese(value: number): string {
  let n = Math.round(Math.abs(value));
  if (!Number.isFinite(n) || n > 999_999_999_999_999) return '';
  if (n === 0) return 'không';
  // Tách theo từng "tỷ": phần dưới tỷ đọc nghìn/triệu, mỗi lần qua tỷ thì thêm chữ "tỷ"
  const billions: number[] = [];
  while (n > 0) {
    billions.push(n % 1_000_000_000);
    n = Math.floor(n / 1_000_000_000);
  }
  const parts: string[] = [];
  for (let b = billions.length - 1; b >= 0; b--) {
    const chunk = billions[b];
    const hasHigher = b < billions.length - 1;
    if (chunk > 0) {
      const groups = [chunk % 1000, Math.floor(chunk / 1000) % 1000, Math.floor(chunk / 1_000_000)];
      let started = hasHigher;
      for (let g = 2; g >= 0; g--) {
        if (groups[g] === 0) continue;
        parts.push(readGroup(groups[g], started));
        if (UNITS[g]) parts.push(UNITS[g]);
        started = true;
      }
    }
    if (b > 0 && (chunk > 0 || parts.length)) parts.push('tỷ');
  }
  // "một tỷ tỷ" không xảy ra trong giới hạn 15 chữ số; gộp khoảng trắng thừa
  return parts.join(' ').replace(/\s+/g, ' ').replace(/(tỷ )+tỷ/g, 'tỷ').trim();
}

/** "Một triệu hai trăm nghìn đồng" (viết hoa chữ đầu) */
export function moneyInWords(value: number): string {
  const w = numberToVietnamese(value);
  if (!w) return '';
  const text = `${value < 0 ? 'âm ' : ''}${w} đồng`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
