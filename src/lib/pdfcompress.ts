/**
 * Nén PDF ngay trên trình duyệt.
 *  - compressImages: giữ nguyên chữ và vector, chỉ thu nhỏ + nén lại các ảnh JPEG nhúng trong file (pdf-lib cấp thấp)
 *  - rasterize: vẽ mỗi trang thành ảnh JPEG rồi ghép lại (nén mạnh nhất, nhưng chữ không còn chọn/sao chép được)
 */
import { pdfLib, newPdf } from './pdflib';
import { openPdf } from './cdn';
import { renderPage } from './pdfrender';
import { t } from '../i18n';

/* Kiểu tối thiểu cho phần cấp thấp của pdf-lib */
interface PObj { toString(): string }
interface PDict extends PObj { get(k: PObj): PObj | undefined; has?(k: PObj): boolean }
interface PStream extends PObj { dict: PDict; contents?: Uint8Array; getContents?(): Uint8Array }
interface PContext {
  enumerateIndirectObjects(): [PObj, PObj][];
  stream(contents: Uint8Array, dict: Record<string, unknown>): PObj;
  assign(ref: PObj, obj: PObj): void;
}
interface PDoc { context: PContext; save(o?: { useObjectStreams?: boolean }): Promise<Uint8Array>; getPageCount(): number }
interface Lib {
  PDFDocument: { load(b: Uint8Array, o?: Record<string, unknown>): Promise<PDoc> };
  PDFName: { of(s: string): PObj };
  PDFRawStream: new (...a: unknown[]) => PStream;
}

export interface Progress { (done: number, total: number): void }

export async function compressImages(bytes: Uint8Array, maxSide: number, quality: number, onProgress?: Progress): Promise<{ bytes: Uint8Array; changed: number; total: number }> {
  const lib = (await pdfLib()) as unknown as Lib;
  let doc: PDoc;
  try {
    doc = await lib.PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    if (/encrypt/i.test(String((e as Error).message))) throw new Error(t('lib.pdfc.locked', 'File PDF có mật khẩu hoặc bị khoá chỉnh sửa. Hãy mở khoá trước khi nén.'));
    throw new Error(t('lib.pdfc.unreadable', 'Không đọc được file PDF, file có thể bị hỏng.'));
  }
  const N = (s: string) => lib.PDFName.of(s);
  const images = doc.context.enumerateIndirectObjects().filter(([, o]) => {
    if (!(o instanceof lib.PDFRawStream)) return false;
    const d = (o as PStream).dict;
    if (d.get(N('Subtype'))?.toString() !== '/Image') return false;
    const f = d.get(N('Filter'))?.toString().replace(/[[\]\s]/g, '');
    if (f !== '/DCTDecode') return false;
    // Bỏ qua ảnh có mặt nạ, bảng giải mã riêng hoặc hệ màu CMYK (trình duyệt hay vẽ sai màu)
    if (d.get(N('SMask')) || d.get(N('Mask')) || d.get(N('Decode'))) return false;
    const cs = d.get(N('ColorSpace'))?.toString() ?? '';
    if (/CMYK|Separation|DeviceN|Indexed|Lab/.test(cs)) return false;
    return true;
  });
  let changed = 0;
  for (let i = 0; i < images.length; i++) {
    onProgress?.(i, images.length);
    const [ref, o] = images[i];
    const st = o as PStream;
    const raw = st.contents ?? st.getContents?.();
    if (!raw || raw.length < 20000) continue; // ảnh nhỏ: nén lại không đáng
    try {
      const bmp = await createImageBitmap(new Blob([raw as BlobPart], { type: 'image/jpeg' }));
      const w0 = bmp.width, h0 = bmp.height;
      // Ảnh ICC nhiều kênh khác 3/1 (ví dụ CMYK ICC) đã bị loại; đến đây chỉ còn RGB / xám
      const k = Math.min(1, maxSide / Math.max(w0, h0));
      const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d') as CanvasRenderingContext2D;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bmp, 0, 0, w, h);
      bmp.close();
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', quality));
      if (!blob) continue;
      const out = new Uint8Array(await blob.arrayBuffer());
      if (out.length >= raw.length * 0.92) continue; // không nhỏ hơn đáng kể: giữ ảnh gốc
      const stream = doc.context.stream(out, {
        Type: 'XObject', Subtype: 'Image', Width: w, Height: h, BitsPerComponent: 8, ColorSpace: 'DeviceRGB', Filter: 'DCTDecode',
      });
      doc.context.assign(ref, stream);
      changed++;
    } catch {
      // ảnh trình duyệt không giải mã được: giữ nguyên
    }
  }
  onProgress?.(images.length, images.length);
  return { bytes: await doc.save({ useObjectStreams: true }), changed, total: images.length };
}

export async function rasterize(bytes: Uint8Array, dpi: number, quality: number, onProgress?: Progress): Promise<Uint8Array> {
  const src = await openPdf(bytes);
  try {
    const out = await newPdf();
    for (let p = 1; p <= src.numPages; p++) {
      onProgress?.(p - 1, src.numPages);
      const page = await src.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      page.cleanup();
      const c = await renderPage(src, p, dpi / 72);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', quality));
      if (!blob) throw new Error(t('lib.pdfc.render', 'Không vẽ được trang PDF.'));
      const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      const pg = out.addPage([vp.width, vp.height]);
      pg.drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height });
    }
    onProgress?.(src.numPages, src.numPages);
    return await out.save({ useObjectStreams: true });
  } finally {
    await src.destroy?.();
  }
}
