/** Tiện ích tải ảnh SVG / PNG từ chuỗi SVG */
import { t } from '../i18n';

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSvg(svg: string, filename: string): void {
  triggerDownload(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), filename);
}

/** Vẽ SVG lên canvas với kích thước mong muốn rồi tải về PNG */
export async function downloadPng(svg: string, filename: string, width: number, height: number): Promise<void> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(t('lib.download.pngDraw', 'Không vẽ được ảnh PNG.')));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width);
    canvas.height = Math.round(height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(t('lib.download.noCanvas', 'Trình duyệt không hỗ trợ canvas.'));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) throw new Error(t('lib.download.pngMake', 'Không tạo được tệp PNG.'));
    triggerDownload(blob, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Tên tệp an toàn từ nội dung mã. Bỏ dấu tiếng Việt cho gọn, nhưng giữ chữ của các hệ chữ khác
 * (Nhật, Trung, Nga...) để tên tệp đúng ngôn ngữ; chỉ thay những ký tự không dùng được trong tên tệp.
 */
export function safeFilename(text: string, fallback: string): string {
  const base = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || fallback;
}
