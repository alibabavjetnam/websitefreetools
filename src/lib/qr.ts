/**
 * Bộ mã hoá QR Code (ISO/IEC 18004) viết bằng TypeScript, không phụ thuộc thư viện.
 * Hỗ trợ version 1–40, 4 mức sửa lỗi, chế độ Numeric / Alphanumeric / Byte (UTF-8).
 */

export type Ecc = 'L' | 'M' | 'Q' | 'H';

const ECC_ORDINAL: Record<Ecc, number> = { L: 0, M: 1, Q: 2, H: 3 };
const ECC_FORMAT_BITS: Record<Ecc, number> = { L: 1, M: 0, Q: 3, H: 2 };

// Số codeword sửa lỗi mỗi block, theo [mức][version]
const ECC_CODEWORDS_PER_BLOCK: number[][] = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];

// Số block sửa lỗi, theo [mức][version]
const NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

const ALPHANUMERIC_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

type Mode = { bits: number; charCountBits: [number, number, number] };
const MODE_NUMERIC: Mode = { bits: 0x1, charCountBits: [10, 12, 14] };
const MODE_ALNUM: Mode = { bits: 0x2, charCountBits: [9, 11, 13] };
const MODE_BYTE: Mode = { bits: 0x4, charCountBits: [8, 16, 16] };

function charCountBits(mode: Mode, ver: number): number {
  return mode.charCountBits[ver <= 9 ? 0 : ver <= 26 ? 1 : 2];
}

function appendBits(buf: number[], val: number, len: number): void {
  for (let i = len - 1; i >= 0; i--) buf.push((val >>> i) & 1);
}

function getBit(x: number, i: number): boolean {
  return ((x >>> i) & 1) !== 0;
}

function numRawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function numDataCodewords(ver: number, ecc: Ecc): number {
  const e = ECC_ORDINAL[ecc];
  return Math.floor(numRawDataModules(ver) / 8) - ECC_CODEWORDS_PER_BLOCK[e][ver] * NUM_ERROR_CORRECTION_BLOCKS[e][ver];
}

// ---- Reed–Solomon trên GF(2^8), đa thức 0x11D ----
function rsMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = rsMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = rsMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => (result[i] ^= rsMultiply(coef, factor)));
  }
  return result;
}

// ---- Phân đoạn dữ liệu ----
function encodeSegment(text: string): { mode: Mode; numChars: number; bits: number[] } {
  const bits: number[] = [];
  if (/^[0-9]*$/.test(text)) {
    for (let i = 0; i < text.length; ) {
      const n = Math.min(text.length - i, 3);
      appendBits(bits, parseInt(text.substring(i, i + n), 10), n * 3 + 1);
      i += n;
    }
    return { mode: MODE_NUMERIC, numChars: text.length, bits };
  }
  if ([...text].every((c) => ALPHANUMERIC_CHARSET.includes(c))) {
    let i = 0;
    for (; i + 2 <= text.length; i += 2) {
      const v = ALPHANUMERIC_CHARSET.indexOf(text[i]) * 45 + ALPHANUMERIC_CHARSET.indexOf(text[i + 1]);
      appendBits(bits, v, 11);
    }
    if (i < text.length) appendBits(bits, ALPHANUMERIC_CHARSET.indexOf(text[i]), 6);
    return { mode: MODE_ALNUM, numChars: text.length, bits };
  }
  const bytes = new TextEncoder().encode(text);
  bytes.forEach((b) => appendBits(bits, b, 8));
  return { mode: MODE_BYTE, numChars: bytes.length, bits };
}

export class QrCapacityError extends Error {}

export interface QrCode {
  version: number;
  size: number;
  ecc: Ecc;
  mask: number;
  /** modules[y][x] = true là ô tối */
  modules: boolean[][];
}

export function encodeQr(text: string, ecc: Ecc = 'M'): QrCode {
  const seg = encodeSegment(text);

  // Chọn version nhỏ nhất chứa vừa dữ liệu
  let ver = 1;
  let usedBits = 0;
  for (; ; ver++) {
    const capacityBits = numDataCodewords(ver, ecc) * 8;
    const ccBits = charCountBits(seg.mode, ver);
    usedBits = 4 + ccBits + seg.bits.length;
    if (seg.numChars < 1 << ccBits && usedBits <= capacityBits) break;
    if (ver >= 40) throw new QrCapacityError(t('lib.qr.tooLong', 'Dữ liệu quá dài để tạo mã QR. Hãy rút ngắn nội dung hoặc giảm mức sửa lỗi.'));
  }

  const bb: number[] = [];
  appendBits(bb, seg.mode.bits, 4);
  appendBits(bb, seg.numChars, charCountBits(seg.mode, ver));
  bb.push(...seg.bits);

  const capacityBits = numDataCodewords(ver, ecc) * 8;
  appendBits(bb, 0, Math.min(4, capacityBits - bb.length));
  appendBits(bb, 0, (8 - (bb.length % 8)) % 8);
  for (let pad = 0xec; bb.length < capacityBits; pad ^= 0xec ^ 0x11) appendBits(bb, pad, 8);

  const dataCodewords: number[] = [];
  for (let i = 0; i < bb.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bb[i + j];
    dataCodewords.push(v);
  }

  return new QrBuilder(ver, ecc).build(dataCodewords);
}

class QrBuilder {
  readonly size: number;
  private modules: boolean[][];
  private isFunction: boolean[][];

  constructor(readonly version: number, readonly ecc: Ecc) {
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.isFunction = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
  }

  build(data: number[]): QrCode {
    this.drawFunctionPatterns();
    this.drawCodewords(this.addEccAndInterleave(data));

    let bestMask = 0;
    let minPenalty = Infinity;
    for (let m = 0; m < 8; m++) {
      this.applyMask(m);
      this.drawFormatBits(m);
      const p = this.penaltyScore();
      if (p < minPenalty) {
        bestMask = m;
        minPenalty = p;
      }
      this.applyMask(m); // XOR lần nữa để hoàn tác
    }
    this.applyMask(bestMask);
    this.drawFormatBits(bestMask);

    return { version: this.version, size: this.size, ecc: this.ecc, mask: bestMask, modules: this.modules };
  }

  private setFunction(x: number, y: number, dark: boolean): void {
    this.modules[y][x] = dark;
    this.isFunction[y][x] = true;
  }

  private drawFunctionPatterns(): void {
    for (let i = 0; i < this.size; i++) {
      this.setFunction(6, i, i % 2 === 0);
      this.setFunction(i, 6, i % 2 === 0);
    }
    this.drawFinder(3, 3);
    this.drawFinder(this.size - 4, 3);
    this.drawFinder(3, this.size - 4);

    const pos = this.alignmentPositions();
    const n = pos.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
        this.drawAlignment(pos[i], pos[j]);
      }
    }
    this.drawFormatBits(0);
    this.drawVersion();
  }

  private drawFinder(x: number, y: number): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) this.setFunction(xx, yy, dist !== 2 && dist !== 4);
      }
    }
  }

  private drawAlignment(x: number, y: number): void {
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) this.setFunction(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }

  private alignmentPositions(): number[] {
    if (this.version === 1) return [];
    const numAlign = Math.floor(this.version / 7) + 2;
    const step = this.version === 32 ? 26 : Math.ceil((this.version * 4 + 4) / (numAlign * 2 - 2)) * 2;
    const result = [6];
    for (let pos = this.size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
    return result;
  }

  private drawFormatBits(mask: number): void {
    const data = (ECC_FORMAT_BITS[this.ecc] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;

    for (let i = 0; i <= 5; i++) this.setFunction(8, i, getBit(bits, i));
    this.setFunction(8, 7, getBit(bits, 6));
    this.setFunction(8, 8, getBit(bits, 7));
    this.setFunction(7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i++) this.setFunction(14 - i, 8, getBit(bits, i));

    for (let i = 0; i < 8; i++) this.setFunction(this.size - 1 - i, 8, getBit(bits, i));
    for (let i = 8; i < 15; i++) this.setFunction(8, this.size - 15 + i, getBit(bits, i));
    this.setFunction(8, this.size - 8, true);
  }

  private drawVersion(): void {
    if (this.version < 7) return;
    let rem = this.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = getBit(bits, i);
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.setFunction(a, b, bit);
      this.setFunction(b, a, bit);
    }
  }

  private addEccAndInterleave(data: number[]): number[] {
    const e = ECC_ORDINAL[this.ecc];
    const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[e][this.version];
    const blockEccLen = ECC_CODEWORDS_PER_BLOCK[e][this.version];
    const rawCodewords = Math.floor(numRawDataModules(this.version) / 8);
    const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
    const shortBlockLen = Math.floor(rawCodewords / numBlocks);

    const blocks: number[][] = [];
    const divisor = rsDivisor(blockEccLen);
    for (let i = 0, k = 0; i < numBlocks; i++) {
      const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
      k += dat.length;
      const ecc = rsRemainder(dat, divisor);
      if (i < numShortBlocks) dat.push(0);
      blocks.push(dat.concat(ecc));
    }

    const result: number[] = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((block, j) => {
        if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]);
      });
    }
    return result;
  }

  private drawCodewords(data: number[]): void {
    let i = 0;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < this.size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? this.size - 1 - vert : vert;
          if (!this.isFunction[y][x] && i < data.length * 8) {
            this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
  }

  private applyMask(mask: number): void {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        let invert: boolean;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
        }
        if (!this.isFunction[y][x] && invert) this.modules[y][x] = !this.modules[y][x];
      }
    }
  }

  private penaltyScore(): number {
    const n = this.size;
    const m = this.modules;
    let result = 0;

    const line = (get: (i: number) => boolean) => {
      let run = 1;
      for (let i = 1; i <= n; i++) {
        if (i < n && get(i) === get(i - 1)) run++;
        else {
          if (run >= 5) result += 3 + (run - 5);
          run = 1;
        }
      }
      // Mẫu giống finder 1:1:3:1:1 kèm 4 ô sáng (coi ngoài viền là sáng)
      const at = (i: number) => (i < 0 || i >= n ? false : get(i));
      for (let i = -4; i < n; i++) {
        const core = at(i) && !at(i + 1) && at(i + 2) && at(i + 3) && at(i + 4) && !at(i + 5) && at(i + 6);
        if (!core) continue;
        const before = !at(i - 1) && !at(i - 2) && !at(i - 3) && !at(i - 4);
        const after = !at(i + 7) && !at(i + 8) && !at(i + 9) && !at(i + 10);
        if (before) result += 40;
        if (after) result += 40;
      }
    };
    for (let y = 0; y < n; y++) line((i) => m[y][i]);
    for (let x = 0; x < n; x++) line((i) => m[i][x]);

    for (let y = 0; y < n - 1; y++)
      for (let x = 0; x < n - 1; x++) {
        const c = m[y][x];
        if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) result += 3;
      }

    let dark = 0;
    m.forEach((row) => row.forEach((c) => c && dark++));
    const total = n * n;
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    result += Math.max(0, k) * 10;
    return result;
  }
}

/** Xuất mã QR thành chuỗi SVG */
export function qrToSvg(qr: QrCode, opts: { margin?: number; fg?: string; bg?: string; px?: number } = {}): string {
  const margin = opts.margin ?? 4;
  const fg = opts.fg ?? '#000000';
  const bg = opts.bg ?? '#ffffff';
  const dim = qr.size + margin * 2;
  const px = opts.px ?? dim * 8;
  const parts: string[] = [];
  for (let y = 0; y < qr.size; y++)
    for (let x = 0; x < qr.size; x++) if (qr.modules[y][x]) parts.push(`M${x + margin},${y + margin}h1v1h-1z`);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${px}" height="${px}" shape-rendering="crispEdges">` +
    `<rect width="100%" height="100%" fill="${bg}"/><path d="${parts.join('')}" fill="${fg}"/></svg>`
  );
}
