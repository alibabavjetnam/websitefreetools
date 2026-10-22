/** Lớp mỏng quanh thư viện pdf-lib (nạp từ CDN khi cần) */
import { CDN, global, loadScript } from './cdn';
import { tf } from '../i18n';

export interface PdfPage {
  getSize(): { width: number; height: number };
  getRotation(): { angle: number };
  setRotation(r: unknown): void;
  drawImage(img: unknown, o: { x: number; y: number; width: number; height: number }): void;
}
export interface PdfDoc {
  getPageCount(): number;
  getPageIndices(): number[];
  copyPages(src: PdfDoc, indices: number[]): Promise<PdfPage[]>;
  addPage(p?: PdfPage | [number, number]): PdfPage;
  embedJpg(bytes: Uint8Array | ArrayBuffer): Promise<unknown>;
  embedPng(bytes: Uint8Array | ArrayBuffer): Promise<unknown>;
  setTitle(t: string): void;
  setProducer(t: string): void;
  setCreator(t: string): void;
  save(o?: { useObjectStreams?: boolean }): Promise<Uint8Array>;
}
interface PdfLibApi {
  PDFDocument: { create(): Promise<PdfDoc>; load(bytes: Uint8Array | ArrayBuffer, o?: { ignoreEncryption?: boolean }): Promise<PdfDoc> };
  degrees(n: number): unknown;
}

export async function pdfLib(): Promise<PdfLibApi> {
  await loadScript(CDN.pdfLib, 'PDFLib');
  return global<PdfLibApi>('PDFLib');
}

export async function newPdf(): Promise<PdfDoc> {
  const doc = await (await pdfLib()).PDFDocument.create();
  doc.setProducer('WFTools');
  doc.setCreator('websitefreetools.com');
  return doc;
}

/** Mở file PDF, đổi lỗi thường gặp sang tiếng Việt */
export async function loadPdf(bytes: Uint8Array | ArrayBuffer, name: string): Promise<PdfDoc> {
  const lib = await pdfLib();
  try {
    return await lib.PDFDocument.load(bytes);
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    if (/encrypt/i.test(msg)) throw new Error(tf('lib.pdf.locked', '"{name}" được khoá bằng mật khẩu hoặc bị hạn chế chỉnh sửa. Hãy mở khoá file trước.', { name }));
    throw new Error(tf('lib.pdf.unreadable', 'Không đọc được "{name}". File có thể bị hỏng hoặc không phải PDF.', { name }));
  }
}

export const pdfBlob = (bytes: Uint8Array): Blob => new Blob([bytes as BlobPart], { type: 'application/pdf' });
