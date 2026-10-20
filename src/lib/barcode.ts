/**
 * Bộ mã hoá mã vạch 1D: Code 128, EAN-13, EAN-8, UPC-A, Code 39.
 * Kết quả là chuỗi độ rộng các vạch xen kẽ (bắt đầu bằng vạch đen), tính theo module.
 */

export type BarcodeFormat = 'CODE128' | 'EAN13' | 'EAN8' | 'UPCA' | 'CODE39';

export interface BarcodeResult {
  /** Độ rộng từng phần tử, xen kẽ đen/trắng, phần tử đầu là đen */
  widths: number[];
  /** Chuỗi hiển thị dưới mã vạch (đã thêm số kiểm tra nếu có) */
  text: string;
}

export class BarcodeInputError extends Error {}

// ---------------- Code 128 ----------------
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
const START_A = 103, START_B = 104, START_C = 105, STOP = 106;
const CODE_A = 101, CODE_B = 100, CODE_C = 99;

function digitRun(s: string, from: number): number {
  let i = from;
  while (i < s.length && s[i] >= '0' && s[i] <= '9') i++;
  return i - from;
}

function encodeCode128(input: string): BarcodeResult {
  if (input.length === 0) throw new BarcodeInputError('Hãy nhập nội dung cần mã hoá.');
  for (const ch of input) {
    const c = ch.charCodeAt(0);
    if (c > 127) throw new BarcodeInputError('Code 128 chỉ nhận chữ không dấu, số và ký hiệu thông thường. Hãy bỏ dấu tiếng Việt hoặc dùng công cụ Tạo mã QR.');
  }

  const codes: number[] = [];
  type Set = 'A' | 'B' | 'C';
  let set: Set;
  let i = 0;

  const firstRun = digitRun(input, 0);
  if (firstRun === input.length && firstRun >= 2 ? true : firstRun >= 4) {
    set = 'C';
    codes.push(START_C);
  } else if (input.charCodeAt(0) < 32) {
    set = 'A';
    codes.push(START_A);
  } else {
    set = 'B';
    codes.push(START_B);
  }

  while (i < input.length) {
    if (set === 'C') {
      if (digitRun(input, i) >= 2) {
        codes.push(parseInt(input.substring(i, i + 2), 10));
        i += 2;
        continue;
      }
      const c = input.charCodeAt(i);
      set = c < 32 ? 'A' : 'B';
      codes.push(set === 'A' ? CODE_A : CODE_B);
      continue;
    }

    // Chuyển sang C khi gặp chuỗi số đủ dài (≥6 ở giữa, ≥4 ở cuối)
    const run = digitRun(input, i);
    if (run >= 6 || (run >= 4 && i + run === input.length)) {
      // Nếu số lượng lẻ, mã hoá 1 chữ số ở bộ hiện tại trước
      if (run % 2 === 1) {
        codes.push(input.charCodeAt(i) - 32);
        i++;
      }
      codes.push(CODE_C);
      set = 'C';
      continue;
    }

    const c = input.charCodeAt(i);
    if (set === 'B') {
      if (c < 32) {
        set = 'A';
        codes.push(CODE_A);
        continue;
      }
      codes.push(c - 32);
    } else {
      if (c >= 96) {
        set = 'B';
        codes.push(CODE_B);
        continue;
      }
      codes.push(c < 32 ? c + 64 : c - 32);
    }
    i++;
  }

  let checksum = codes[0];
  for (let k = 1; k < codes.length; k++) checksum += codes[k] * k;
  codes.push(checksum % 103, STOP);

  const widths: number[] = [];
  codes.forEach((code) => CODE128_PATTERNS[code].split('').forEach((w) => widths.push(Number(w))));
  return { widths, text: input };
}

// ---------------- EAN / UPC ----------------
const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_R = EAN_L.map((p) => p.replace(/./g, (b) => (b === '0' ? '1' : '0')));
const EAN_G = EAN_R.map((p) => p.split('').reverse().join(''));
const EAN13_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/** Số kiểm tra kiểu GS1 (dùng cho EAN-13, EAN-8, UPC-A) */
export function gs1CheckDigit(digits: string): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const d = Number(digits[digits.length - 1 - i]);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10;
}

function bitsToWidths(bits: string): number[] {
  const widths: number[] = [];
  let run = 1;
  for (let i = 1; i <= bits.length; i++) {
    if (i < bits.length && bits[i] === bits[i - 1]) run++;
    else {
      widths.push(run);
      run = 1;
    }
  }
  return widths;
}

function normalizeGs1(input: string, dataLen: number, name: string): string {
  const s = input.replace(/\s+/g, '');
  if (!/^\d+$/.test(s)) throw new BarcodeInputError(`${name} chỉ chấp nhận chữ số.`);
  if (s.length === dataLen) return s + gs1CheckDigit(s);
  if (s.length === dataLen + 1) {
    const expected = gs1CheckDigit(s.slice(0, dataLen));
    if (Number(s[dataLen]) !== expected)
      throw new BarcodeInputError(`Chữ số cuối chưa đúng, phải là ${expected}. Bạn có thể bỏ chữ số cuối để hệ thống tự thêm.`);
    return s;
  }
  throw new BarcodeInputError(`${name} cần ${dataLen} chữ số (hoặc ${dataLen + 1} chữ số kèm số kiểm tra).`);
}

function encodeEan13Digits(code: string): number[] {
  const parity = EAN13_PARITY[Number(code[0])];
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === 'L' ? EAN_L : EAN_G)[Number(code[i])];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += EAN_R[Number(code[i])];
  bits += '101';
  return bitsToWidths(bits);
}

function encodeEan13(input: string): BarcodeResult {
  const code = normalizeGs1(input, 12, 'EAN-13');
  return { widths: encodeEan13Digits(code), text: code };
}

function encodeUpcA(input: string): BarcodeResult {
  const code = normalizeGs1(input, 11, 'UPC-A');
  return { widths: encodeEan13Digits('0' + code), text: code };
}

function encodeEan8(input: string): BarcodeResult {
  const code = normalizeGs1(input, 7, 'EAN-8');
  let bits = '101';
  for (let i = 0; i < 4; i++) bits += EAN_L[Number(code[i])];
  bits += '01010';
  for (let i = 4; i < 8; i++) bits += EAN_R[Number(code[i])];
  bits += '101';
  return { widths: bitsToWidths(bits), text: code };
}

// ---------------- Code 39 ----------------
const CODE39: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn',
  F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn',
  K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn',
  P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn',
  U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn',
  $: 'nwnwnwnnn', '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn',
};

function encodeCode39(input: string): BarcodeResult {
  const s = input.toUpperCase();
  if (s.length === 0) throw new BarcodeInputError('Hãy nhập nội dung cần mã hoá.');
  const bad = [...s].find((c) => c === '*' || !(c in CODE39));
  if (bad !== undefined)
    throw new BarcodeInputError(`Code 39 không hỗ trợ ký tự "${bad}". Chỉ dùng A–Z, 0–9 và - . $ / + % khoảng trắng.`);
  const widths: number[] = [];
  const full = `*${s}*`;
  [...full].forEach((c, idx) => {
    CODE39[c].split('').forEach((e) => widths.push(e === 'w' ? 3 : 1));
    if (idx < full.length - 1) widths.push(1); // khoảng cách giữa các ký tự
  });
  return { widths, text: s };
}

export const BARCODE_FORMATS: { id: BarcodeFormat; label: string; hint: string; sample: string }[] = [
  { id: 'CODE128', label: 'Code 128', hint: 'Nhận chữ không dấu, số và ký hiệu. Hay dùng cho đơn hàng, vận chuyển, kho hàng.', sample: 'WFT-2026-0001' },
  { id: 'EAN13', label: 'EAN-13', hint: 'Nhập 12 chữ số, chữ số cuối được tự thêm. Mã vạch trên hàng bán lẻ, hàng Việt Nam bắt đầu bằng 893.', sample: '893123456789' },
  { id: 'EAN8', label: 'EAN-8', hint: 'Nhập 7 chữ số, chữ số cuối được tự thêm. Dùng cho sản phẩm nhỏ.', sample: '8931234' },
  { id: 'UPCA', label: 'UPC-A', hint: 'Nhập 11 chữ số, chữ số cuối được tự thêm. Hay gặp trên hàng Mỹ.', sample: '03600029145' },
  { id: 'CODE39', label: 'Code 39', hint: 'Nhận chữ in hoa không dấu, số và - . $ / + %. Hay dùng cho thẻ nhân viên, nhãn thiết bị.', sample: 'WFTOOLS-39' },
];

export function encodeBarcode(format: BarcodeFormat, input: string): BarcodeResult {
  switch (format) {
    case 'CODE128': return encodeCode128(input);
    case 'EAN13': return encodeEan13(input);
    case 'EAN8': return encodeEan8(input);
    case 'UPCA': return encodeUpcA(input);
    case 'CODE39': return encodeCode39(input);
  }
}

export interface BarcodeSvgOptions {
  moduleWidth?: number;
  height?: number;
  showText?: boolean;
  fg?: string;
  bg?: string;
  quietZone?: number;
  fontSize?: number;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] as string);
}

export function barcodeToSvg(result: BarcodeResult, o: BarcodeSvgOptions = {}): string {
  const mw = o.moduleWidth ?? 2;
  const h = o.height ?? 100;
  const fg = o.fg ?? '#000000';
  const bg = o.bg ?? '#ffffff';
  const qz = (o.quietZone ?? 10) * mw;
  const fontSize = o.fontSize ?? 16;
  const textH = o.showText === false ? 0 : fontSize + 8;
  const total = result.widths.reduce((a, b) => a + b, 0) * mw;
  const W = total + qz * 2;
  const H = h + textH + 20;

  let x = qz;
  const rects: string[] = [];
  result.widths.forEach((w, i) => {
    if (i % 2 === 0) rects.push(`M${x},10h${w * mw}v${h}h${-w * mw}z`);
    x += w * mw;
  });
  const text =
    o.showText === false
      ? ''
      : `<text x="${W / 2}" y="${10 + h + fontSize + 4}" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="${fontSize}" fill="${fg}">${escapeXml(result.text)}</text>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="crispEdges">` +
    `<rect width="100%" height="100%" fill="${bg}"/><path d="${rects.join('')}" fill="${fg}"/>${text}</svg>`
  );
}
