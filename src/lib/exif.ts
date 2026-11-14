/** Đọc và xoá siêu dữ liệu ảnh (EXIF, GPS, XMP) không làm giảm chất lượng: JPEG bỏ đoạn APP1/APP13, PNG bỏ chunk văn bản/eXIf */
export interface ExifInfo { tags: Record<string, string>; gps: { lat: number; lon: number } | null; hasMeta: boolean }
const TAGS: Record<number, string> = { 0x010f: 'Make', 0x0110: 'Model', 0x0131: 'Software', 0x0132: 'DateTime', 0x013b: 'Artist', 0x8298: 'Copyright', 0x9003: 'DateTimeOriginal', 0x829a: 'ExposureTime', 0x829d: 'FNumber', 0x8827: 'ISO', 0x920a: 'FocalLength', 0xa434: 'LensModel', 0xa002: 'PixelXDimension', 0xa003: 'PixelYDimension', 0x0112: 'Orientation', 0xa431: 'BodySerialNumber', 0x010e: 'ImageDescription' };
export function readExif(b: Uint8Array): ExifInfo {
  const out: ExifInfo = { tags: {}, gps: null, hasMeta: false };
  if (b[0] === 0x89 && b[1] === 0x50) { out.hasMeta = pngChunks(b).some((c) => META_PNG.has(c.type)); return out; }
  if (b[0] !== 0xff || b[1] !== 0xd8) return out;
  let i = 2;
  while (i + 4 < b.length && b[i] === 0xff) {
    const m = b[i + 1], len = (b[i + 2] << 8) | b[i + 3];
    if (m === 0xda) break;
    if (m === 0xe1 || m === 0xed || (m >= 0xe2 && m <= 0xef && m !== 0xee && m !== 0xe2)) out.hasMeta = true;
    if (m === 0xe1 && String.fromCharCode(...b.subarray(i + 4, i + 8)) === 'Exif') parseTiff(b.subarray(i + 10, i + 2 + len), out);
    i += 2 + len;
  }
  return out;
}
function parseTiff(t: Uint8Array, out: ExifInfo): void {
  if (t.length < 8) return;
  const le = t[0] === 0x49;
  const dv = new DataView(t.buffer, t.byteOffset, t.byteLength);
  const u16 = (o: number) => dv.getUint16(o, le), u32 = (o: number) => dv.getUint32(o, le);
  const size = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];
  const value = (o: number): string | number[] | null => {
    const type = u16(o + 2), cnt = u32(o + 4), n = size[type] * cnt;
    const p = n > 4 ? u32(o + 8) : o + 8;
    if (p + n > t.length) return null;
    if (type === 2) return String.fromCharCode(...t.subarray(p, p + cnt)).replace(/\0+$/, '').trim();
    const arr: number[] = [];
    for (let k = 0; k < Math.min(cnt, 8); k++) {
      if (type === 3) arr.push(u16(p + k * 2));
      else if (type === 4) arr.push(u32(p + k * 4));
      else if (type === 5 || type === 10) { const d = u32(p + k * 8 + 4); arr.push(d ? (type === 10 ? dv.getInt32(p + k * 8, le) : u32(p + k * 8)) / d : 0); }
      else if (type === 1 || type === 7) arr.push(t[p + k]);
    }
    return arr;
  };
  const ifd = (o: number, gps = false): void => {
    if (o + 2 > t.length) return;
    const n = u16(o);
    const g: Record<number, string | number[] | null> = {};
    for (let k = 0; k < n; k++) {
      const e = o + 2 + k * 12;
      if (e + 12 > t.length) return;
      const tag = u16(e);
      if (gps) { g[tag] = value(e); continue; }
      if (tag === 0x8769) ifd(u32(e + 8));
      else if (tag === 0x8825) ifd(u32(e + 8), true);
      else if (TAGS[tag]) {
        const v = value(e);
        if (v != null) out.tags[TAGS[tag]] = Array.isArray(v) ? (tag === 0x829a && v[0] < 1 ? `1/${Math.round(1 / v[0])}` : v.map((x) => +x.toFixed(3)).join(', ')) : v;
      }
    }
    if (gps && Array.isArray(g[2]) && Array.isArray(g[4])) {
      const dms = (a: number[]) => a[0] + a[1] / 60 + a[2] / 3600;
      let lat = dms(g[2] as number[]), lon = dms(g[4] as number[]);
      if (g[1] === 'S') lat = -lat;
      if (g[3] === 'W') lon = -lon;
      if (lat || lon) out.gps = { lat, lon };
    }
  };
  ifd(u32(4));
}
const META_PNG = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME']);
function pngChunks(b: Uint8Array): { type: string; start: number; end: number }[] {
  const r: { type: string; start: number; end: number }[] = [];
  let i = 8;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  while (i + 8 <= b.length) {
    const len = dv.getUint32(i);
    const type = String.fromCharCode(...b.subarray(i + 4, i + 8));
    r.push({ type, start: i, end: i + 12 + len });
    i += 12 + len;
    if (type === 'IEND') break;
  }
  return r;
}
/** Trả về bản sao ảnh đã bỏ siêu dữ liệu; null nếu định dạng không hỗ trợ bóc tách trực tiếp */
export function stripMeta(b: Uint8Array): Uint8Array | null {
  if (b[0] === 0x89 && b[1] === 0x50) {
    const keep = pngChunks(b).filter((c) => !META_PNG.has(c.type));
    const out = new Uint8Array(8 + keep.reduce((s, c) => s + c.end - c.start, 0));
    out.set(b.subarray(0, 8));
    let o = 8;
    for (const c of keep) { out.set(b.subarray(c.start, c.end), o); o += c.end - c.start; }
    return out;
  }
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  while (i + 4 < b.length && b[i] === 0xff) {
    const m = b[i + 1];
    if (m === 0xda) { parts.push(b.subarray(i)); i = b.length; break; }
    const len = (b[i + 2] << 8) | b[i + 3];
    // Giữ APP0 (JFIF), APP2 (hồ sơ màu ICC), APP14 (Adobe, cần để giải mã màu đúng); bỏ APP1 (EXIF/XMP), APP13 (IPTC) và các APP khác, bỏ COM
    const drop = (m >= 0xe1 && m <= 0xef && m !== 0xe2 && m !== 0xee) || m === 0xfe;
    if (!drop) parts.push(b.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  if (i < b.length) parts.push(b.subarray(i));
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
