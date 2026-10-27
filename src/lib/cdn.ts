/** Nạp thư viện từ CDN khi người dùng thật sự cần (trang mở nhanh, không tải thừa) */
import { t, tf } from '../i18n';


export const CDN = {
  pdfLib: 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  pdfjs: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs',
  pdfjsWorker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs',
  pptxgen: 'https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.bundle.js',
  jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  // Bản chính thức của SheetJS; bản trên npm dừng ở 0.18.5 và có lỗ hổng đã biết
  xlsx: 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
  beautifyJs: 'https://cdnjs.cloudflare.com/ajax/libs/js-beautify/1.15.1/beautify.min.js',
  beautifyCss: 'https://cdnjs.cloudflare.com/ajax/libs/js-beautify/1.15.1/beautify-css.min.js',
  beautifyHtml: 'https://cdnjs.cloudflare.com/ajax/libs/js-beautify/1.15.1/beautify-html.min.js',
  acorn: 'https://cdnjs.cloudflare.com/ajax/libs/acorn/8.14.0/acorn.min.js',
  mp4Muxer: 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.1/build/mp4-muxer.min.js',
  // Chụp phần tử HTML thành ảnh (Word → PDF)
  htmlToImage: 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/dist/html-to-image.js',
};

const loading = new Map<string, Promise<void>>();

/** Nạp thẻ <script> thường (thư viện dạng UMD gắn biến toàn cục) */
export function loadScript(url: string, globalName: string): Promise<void> {
  if ((window as unknown as Record<string, unknown>)[globalName]) return Promise.resolve();
  let p = loading.get(url);
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.onload = () => ((window as unknown as Record<string, unknown>)[globalName] ? resolve() : reject(new Error(tf('cdn.libInit', 'Thư viện {name} không khởi động được.', { name: globalName }))));
      s.onerror = () => {
        loading.delete(url);
        reject(new Error(t('cdn.loadFail', 'Không tải được thư viện cần thiết. Kiểm tra kết nối mạng rồi thử lại.')));
      };
      document.head.appendChild(s);
    });
    loading.set(url, p);
  }
  return p;
}

export function global<T>(name: string): T {
  return (window as unknown as Record<string, T>)[name];
}

/* ---------- pdf.js (dạng module ES) ---------- */

export interface PdfJsTextItem { str: string; hasEOL?: boolean; transform: number[] }
export interface PdfJsPage {
  getViewport(o: { scale: number }): { width: number; height: number };
  render(o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> };
  getTextContent(): Promise<{ items: (PdfJsTextItem | { type: string })[] }>;
  cleanup(): void;
}
export interface PdfJsDoc { numPages: number; getPage(n: number): Promise<PdfJsPage>; destroy(): Promise<void> }
interface PdfJs {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: { data: Uint8Array; password?: string }): { promise: Promise<PdfJsDoc> };
}

let pdfjsPromise: Promise<PdfJs> | null = null;
export function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= (import(/* @vite-ignore */ CDN.pdfjs) as Promise<PdfJs>)
    .then((m) => {
      m.GlobalWorkerOptions.workerSrc = CDN.pdfjsWorker;
      return m;
    })
    .catch(() => {
      pdfjsPromise = null;
      throw new Error(t('cdn.pdfLoadFail', 'Không tải được bộ đọc PDF. Kiểm tra kết nối mạng rồi thử lại.'));
    });
  return pdfjsPromise;
}

/** Mở PDF bằng pdf.js, đổi thông báo lỗi thường gặp sang tiếng Việt */
export async function openPdf(bytes: Uint8Array): Promise<PdfJsDoc> {
  const pdfjs = await loadPdfJs();
  try {
    // pdf.js chiếm quyền mảng dữ liệu: truyền bản sao để file gốc còn dùng được
    return await pdfjs.getDocument({ data: bytes.slice() }).promise;
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === 'PasswordException') throw new Error(t('cdn.pdfPassword', 'File PDF có mật khẩu. Hãy mở khoá file trước.'));
    throw new Error(t('cdn.pdfCorrupt', 'Không đọc được file PDF, file có thể bị hỏng.'));
  }
}
