/** Vẽ trang PDF thành ảnh bằng pdf.js (dùng chung cho PDF → ảnh, nén PDF, ký PDF, sửa PDF, PDF → Word) */
import type { PdfJsDoc } from './cdn';

/** Giới hạn số điểm ảnh mỗi trang để không làm treo trình duyệt (≈ 40 megapixel) */
const MAX_PIXELS = 40_000_000;

export async function renderPage(doc: PdfJsDoc, pageNo: number, scale: number): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNo);
  try {
    const base = page.getViewport({ scale: 1 });
    let k = scale;
    if (base.width * base.height * k * k > MAX_PIXELS) k = Math.sqrt(MAX_PIXELS / (base.width * base.height));
    const vp = page.getViewport({ scale: k });
    const c = document.createElement('canvas');
    c.width = Math.ceil(vp.width);
    c.height = Math.ceil(vp.height);
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return c;
  } finally {
    page.cleanup();
  }
}

/** Kích thước trang theo điểm PDF (scale 1) */
export async function pageSize(doc: PdfJsDoc, pageNo: number): Promise<{ width: number; height: number }> {
  const page = await doc.getPage(pageNo);
  const vp = page.getViewport({ scale: 1 });
  page.cleanup();
  return { width: vp.width, height: vp.height };
}
