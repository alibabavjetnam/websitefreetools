import { currentLang } from '../i18n';

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
export function moneyInVietnamese(value: number): string {
  const w = numberToVietnamese(value);
  if (!w) return '';
  const text = `${value < 0 ? 'âm ' : ''}${w} đồng`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------- English ----------
const EN_ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const EN_SCALES = ['', 'thousand', 'million', 'billion', 'trillion'];

function enGroup(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h) parts.push(EN_ONES[h], 'hundred');
  if (r) {
    if (r < 20) parts.push(EN_ONES[r]);
    else parts.push(EN_TENS[Math.floor(r / 10)] + (r % 10 ? '-' + EN_ONES[r % 10] : ''));
  }
  return parts.join(' ');
}

/** 1234 -> "one thousand two hundred thirty-four" */
export function numberToEnglish(value: number): string {
  let n = Math.round(Math.abs(value));
  if (!Number.isFinite(n) || n > 999_999_999_999_999) return '';
  if (n === 0) return 'zero';
  const parts: string[] = [];
  for (let g = 0; n > 0; g++, n = Math.floor(n / 1000)) {
    const chunk = n % 1000;
    if (chunk) parts.unshift(enGroup(chunk) + (EN_SCALES[g] ? ' ' + EN_SCALES[g] : ''));
  }
  return parts.join(' ');
}

// ---------- 日本語 (大字: 金壱千弐百参拾四円也) ----------
const JA_DIGITS = ['零', '壱', '弐', '参', '四', '伍', '六', '七', '八', '九'];
const JA_SMALL = ['', '拾', '百', '千'];
const JA_BIG = ['', '万', '億', '兆'];

function jaGroup(n: number): string {
  let out = '';
  for (let p = 3; p >= 0; p--) {
    const d = Math.floor(n / 10 ** p) % 10;
    if (d) out += JA_DIGITS[d] + JA_SMALL[p];
  }
  return out;
}

export function numberToJapanese(value: number): string {
  let n = Math.round(Math.abs(value));
  if (!Number.isFinite(n) || n > 999_999_999_999_999) return '';
  if (n === 0) return '零';
  let out = '';
  for (let g = 0; n > 0; g++, n = Math.floor(n / 10000)) {
    const chunk = n % 10000;
    if (chunk) out = jaGroup(chunk) + JA_BIG[g] + out;
  }
  return out;
}

// ---------- 中文 (财务大写: 壹仟贰佰叁拾肆元整) ----------
const ZH_DIGITS = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
const ZH_SMALL = ['', '拾', '佰', '仟'];
const ZH_BIG = ['', '万', '亿', '万亿'];

function zhGroup(n: number): string {
  let out = '';
  let zero = false;
  for (let p = 3; p >= 0; p--) {
    const d = Math.floor(n / 10 ** p) % 10;
    if (d === 0) {
      if (out) zero = true;
    } else {
      if (zero) out += '零';
      zero = false;
      out += ZH_DIGITS[d] + ZH_SMALL[p];
    }
  }
  return out;
}

export function numberToChinese(value: number): string {
  let n = Math.round(Math.abs(value));
  if (!Number.isFinite(n) || n > 999_999_999_999_999) return '';
  if (n === 0) return '零';
  const chunks: number[] = [];
  for (; n > 0; n = Math.floor(n / 10000)) chunks.push(n % 10000);
  let out = '';
  let pendingZero = false;
  for (let g = chunks.length - 1; g >= 0; g--) {
    const c = chunks[g];
    if (c === 0) {
      if (out) pendingZero = true;
      continue;
    }
    if (out && (pendingZero || c < 1000)) out += '零';
    pendingZero = false;
    out += zhGroup(c) + ZH_BIG[g];
  }
  return out;
}

/** Số tiền bằng chữ theo ngôn ngữ trang: vi "... đồng", en "... dollars", ja "金...円也", zh "...元整" */
export function moneyInWords(value: number): string {
  const lang = currentLang();
  const neg = value < 0;
  if (lang === 'en') {
    const w = numberToEnglish(value);
    if (!w) return '';
    const text = `${neg ? 'minus ' : ''}${w} ${Math.round(Math.abs(value)) === 1 ? 'dollar' : 'dollars'}`;
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  if (lang === 'ja') {
    const w = numberToJapanese(value);
    return w ? `${neg ? 'マイナス' : ''}金${w}円也` : '';
  }
  if (lang === 'zh') {
    const w = numberToChinese(value);
    return w ? `${neg ? '负' : ''}${w}元整` : '';
  }
  return moneyInVietnamese(value);
}

