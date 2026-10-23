/** Xử lý ảnh dùng chung: đọc ảnh, vẽ lên canvas, xuất ra các định dạng (kể cả BMP, ICO tự mã hoá) */
import { localeTag, t, tf } from '../i18n';

export const MAX_IMAGE_BYTES = 40 * 1024 * 1024;

export interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  close(): void;
}

/** Đọc file ảnh; SVG dùng thẻ <img> vì createImageBitmap không đọc được SVG trên mọi trình duyệt */
export async function loadImage(file: Blob): Promise<LoadedImage> {
  if (file.type === 'image/svg+xml') {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      await new Promise<void>((ok, fail) => {
        img.onload = () => ok();
        img.onerror = () => fail(new Error(t('lib.image.svg', 'Không đọc được file SVG.')));
        img.src = url;
      });
      // SVG không khai báo kích thước thì lấy 512px làm mặc định
      const width = img.naturalWidth || 512;
      const height = img.naturalHeight || 512;
      return { source: img, width, height, close: () => URL.revokeObjectURL(url) };
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
  }
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  } catch {
    throw new Error(
      /heic|heif/i.test(file.type) ? t('lib.image.heic', 'Trình duyệt này không đọc được ảnh HEIC của iPhone. Hãy mở bằng Safari hoặc đổi ảnh sang JPG trước.') : t('lib.image.unreadable', 'Không đọc được ảnh, file có thể bị hỏng hoặc không phải ảnh.'),
    );
  }
}

/** Vẽ ảnh lên canvas mới với kích thước cho trước; bg dùng cho định dạng không có nền trong suốt */
export function drawToCanvas(img: LoadedImage, width: number, height: number, bg?: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(t('lib.image.noCanvas', 'Trình duyệt không hỗ trợ xử lý ảnh.'));
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img.source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((ok, fail) =>
    canvas.toBlob((b) => (b && b.type === mime ? ok(b) : fail(new Error(tf('lib.image.noEncode', 'Trình duyệt này không xuất được định dạng {fmt}.', { fmt: mime.replace('image/', '').toUpperCase() })))), mime, quality),
  );
}

/** Trình duyệt có tự xuất được định dạng này qua canvas không (AVIF chỉ một số trình duyệt hỗ trợ) */
export function canEncode(mime: string): boolean {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    return c.toDataURL(mime).startsWith(`data:${mime}`);
  } catch {
    return false;
  }
}

/** Mã hoá BMP 24-bit (không nén), phần trong suốt được lót nền trắng */
export function encodeBmp(canvas: HTMLCanvasElement): Blob {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  return new Blob([bmpBytes(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)], { type: 'image/bmp' });
}

/** Dữ liệu BMP từ điểm ảnh RGBA */
export function bmpBytes(px: Uint8ClampedArray | Uint8Array, w: number, h: number): ArrayBuffer {
  const rowSize = Math.ceil((w * 3) / 4) * 4;
  const imageSize = rowSize * h;
  const buf = new ArrayBuffer(54 + imageSize);
  const v = new DataView(buf);
  v.setUint16(0, 0x4d42, true); // "BM"
  v.setUint32(2, buf.byteLength, true);
  v.setUint32(10, 54, true);
  v.setUint32(14, 40, true);
  v.setInt32(18, w, true);
  v.setInt32(22, h, true); // dương: dòng lưu từ dưới lên
  v.setUint16(26, 1, true);
  v.setUint16(28, 24, true);
  v.setUint32(34, imageSize, true);
  v.setInt32(38, 2835, true); // 72 dpi
  v.setInt32(42, 2835, true);
  const out = new Uint8Array(buf);
  for (let y = 0; y < h; y++) {
    const row = 54 + (h - 1 - y) * rowSize;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = px[i + 3] / 255;
      const blend = (c: number) => Math.round(c * a + 255 * (1 - a));
      out[row + x * 3] = blend(px[i + 2]);
      out[row + x * 3 + 1] = blend(px[i + 1]);
      out[row + x * 3 + 2] = blend(px[i]);
    }
  }
  return buf;
}

/** Mã hoá ICO chứa nhiều kích thước (mỗi kích thước là một ảnh PNG), dùng làm favicon */
export async function encodeIco(img: LoadedImage, sizes: number[]): Promise<Blob> {
  const pngs: Uint8Array[] = [];
  for (const s of sizes) {
    // Giữ tỷ lệ, căn giữa trong ô vuông
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = s;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const scale = Math.min(s / img.width, s / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img.source, (s - w) / 2, (s - h) / 2, w, h);
    pngs.push(new Uint8Array(await (await canvasToBlob(canvas, 'image/png')).arrayBuffer()));
  }
  return new Blob([icoBytes(sizes, pngs)], { type: 'image/x-icon' });
}

/** Ghép các ảnh PNG thành file ICO */
export function icoBytes(sizes: number[], pngs: Uint8Array[]): ArrayBuffer {
  const headerSize = 6 + 16 * sizes.length;
  const total = headerSize + pngs.reduce((n, p) => n + p.length, 0);
  const buf = new ArrayBuffer(total);
  const v = new DataView(buf);
  v.setUint16(2, 1, true); // loại: icon
  v.setUint16(4, sizes.length, true);
  let offset = headerSize;
  sizes.forEach((s, i) => {
    const e = 6 + i * 16;
    v.setUint8(e, s >= 256 ? 0 : s); // 0 nghĩa là 256
    v.setUint8(e + 1, s >= 256 ? 0 : s);
    v.setUint16(e + 4, 1, true); // số mặt phẳng màu
    v.setUint16(e + 6, 32, true); // bit mỗi điểm ảnh
    v.setUint32(e + 8, pngs[i].length, true);
    v.setUint32(e + 12, offset, true);
    new Uint8Array(buf, offset, pngs[i].length).set(pngs[i]);
    offset += pngs[i].length;
  });
  return buf;
}

export const fmtBytes = (b: number): string =>
  b >= 1048576 ? `${(b / 1048576).toLocaleString(localeTag(), { maximumFractionDigits: 2, minimumFractionDigits: 2 })} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} byte`;

/** Tên file mới: giữ tên gốc, đổi phần mở rộng, thêm hậu tố nếu có */
export const renameFile = (name: string, ext: string, suffix = ''): string => `${name.replace(/\.[^.]+$/, '') || 'anh'}${suffix}.${ext}`;

/** Nhận diện định dạng ảnh từ vài byte đầu (dùng khi giải mã Base64 không kèm tiền tố data:) */
export function sniffImageType(bytes: Uint8Array): string | null {
  const b = (i: number) => bytes[i];
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return 'image/png';
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return 'image/jpeg';
  if (b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46) return 'image/gif';
  if (b(0) === 0x42 && b(1) === 0x4d) return 'image/bmp';
  if (b(0) === 0x00 && b(1) === 0x00 && b(2) === 0x01 && b(3) === 0x00) return 'image/x-icon';
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(4, 8) === 'ftyp' && /avif|avis/.test(ascii(8, 12))) return 'image/avif';
  const head = ascii(0, Math.min(bytes.length, 256)).trimStart();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'image/svg+xml';
  return null;
}

export const EXT_OF: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/bmp': 'bmp', 'image/x-icon': 'ico',
  'image/webp': 'webp', 'image/avif': 'avif', 'image/svg+xml': 'svg',
};
