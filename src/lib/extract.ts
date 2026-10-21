/** Trích phần chữ từ các loại file để so sánh: văn bản thường, Word (.docx), HTML, PDF */
import { childrenNamed, descendants, elements, localName, parseXml, type XmlElement } from './xml';
import { CDN, global, loadScript, openPdf, type PdfJsTextItem } from './cdn';

export const MAX_FILE_BYTES = 30 * 1024 * 1024;

/* ---------- Word (.docx) ---------- */

function paragraphText(p: XmlElement): string {
  let out = '';
  const walk = (el: XmlElement) => {
    for (const c of elements(el)) {
      const n = localName(c.name);
      if (n === 't') out += c.children.filter((x): x is string => typeof x === 'string').join('');
      else if (n === 'tab') out += '\t';
      else if (n === 'br' || n === 'cr') out += '\n';
      else if (n === 'noBreakHyphen') out += '-';
      else if (n === 'delText' || n === 'instrText') continue; // chữ đã xoá khi theo dõi sửa đổi, mã trường
      else walk(c);
    }
  };
  walk(p);
  return out;
}

/** Chuyển word/document.xml thành văn bản: mỗi đoạn một dòng, bảng thành các ô cách nhau bằng tab */
export function docxXmlToText(xml: string): string {
  const doc = parseXml(xml);
  const body = descendants(doc, 'body')[0] ?? doc;
  const lines: string[] = [];
  const walkBlock = (el: XmlElement) => {
    for (const c of elements(el)) {
      const n = localName(c.name);
      if (n === 'p') lines.push(paragraphText(c));
      else if (n === 'tbl') {
        for (const tr of childrenNamed(c, 'tr')) {
          lines.push(childrenNamed(tr, 'tc').map((tc) => childrenNamed(tc, 'p').map(paragraphText).join(' ')).join('\t'));
        }
      } else if (n === 'sdt' || n === 'sdtContent' || n === 'customXml' || n === 'ins') walkBlock(c);
    }
  };
  walkBlock(body);
  return lines.join('\n');
}

interface ZipEntry { async(t: 'string'): Promise<string>; async(t: 'blob'): Promise<Blob> }
export interface Zip { file(path: string): ZipEntry | null }
interface JSZipCtor { loadAsync(data: ArrayBuffer): Promise<Zip> }

export async function loadZip(buf: ArrayBuffer): Promise<Zip> {
  await loadScript(CDN.jszip, 'JSZip');
  try {
    return await global<JSZipCtor>('JSZip').loadAsync(buf);
  } catch {
    throw new Error('File bị hỏng hoặc không đúng định dạng Office mới (.docx, .pptx, .xlsx).');
  }
}

async function docxToText(buf: ArrayBuffer): Promise<string> {
  const zip = await loadZip(buf);
  const f = zip.file('word/document.xml');
  if (!f) throw new Error('Không tìm thấy nội dung văn bản trong file Word.');
  return docxXmlToText(await f.async('string'));
}

/* ---------- PDF ---------- */

async function pdfToText(buf: ArrayBuffer): Promise<string> {
  const doc = await openPdf(new Uint8Array(buf));
  const pages: string[] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let line = '';
      const lines: string[] = [];
      for (const it of content.items) {
        if (!('str' in it)) continue;
        line += (it as PdfJsTextItem).str;
        if ((it as PdfJsTextItem).hasEOL) {
          lines.push(line);
          line = '';
        }
      }
      if (line) lines.push(line);
      pages.push(lines.join('\n'));
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  const text = pages.join('\n');
  if (!text.trim()) throw new Error('File PDF này không có lớp chữ (thường là bản scan ảnh), nên không so sánh được nội dung.');
  return text;
}

/* ---------- HTML ---------- */

const BLOCK = /^(p|div|section|article|header|footer|main|aside|nav|h[1-6]|li|tr|br|hr|pre|blockquote|table|ul|ol|dl|dt|dd|figure|figcaption|form|fieldset|address)$/i;

/** Lấy phần chữ người đọc thấy (bỏ thẻ, script, style), xuống dòng theo khối */
export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, noscript, template, head').forEach((n) => n.remove());
  const out: string[] = [];
  let line = '';
  const flush = () => { if (line.trim()) out.push(line.replace(/[ \t]+/g, ' ').trim()); line = ''; };
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) { line += node.textContent ?? ''; return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = (node as Element).tagName;
    const block = BLOCK.test(tag);
    if (block) flush();
    if (/^(td|th)$/i.test(tag) && line) line += '\t';
    node.childNodes.forEach(walk);
    if (block) flush();
  };
  walk(doc.body ?? doc.documentElement);
  flush();
  return out.join('\n');
}

/* ---------- Đọc file bất kỳ ---------- */

export type HtmlMode = 'text' | 'source';

export async function fileToText(file: File, htmlMode: HtmlMode): Promise<{ text: string; kind: string }> {
  if (file.size > MAX_FILE_BYTES) throw new Error('File lớn hơn 30 MB.');
  const name = file.name.toLowerCase();
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';
  if (ext === 'docx') return { text: await docxToText(await file.arrayBuffer()), kind: 'Word' };
  if (ext === 'pdf' || file.type === 'application/pdf') return { text: await pdfToText(await file.arrayBuffer()), kind: 'PDF' };
  if (ext === 'doc') throw new Error('File Word đời cũ (.doc) chưa được hỗ trợ. Hãy mở bằng Word và lưu lại thành .docx.');
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf.slice(0, 8000));
  if (bytes.includes(0)) throw new Error(`File "${file.name}" không phải file chữ, không so sánh được.`);
  // Ưu tiên UTF-8; nếu lỗi thì thử bảng mã Windows-1258 (tiếng Việt cũ)
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder('windows-1258').decode(buf);
  }
  if (ext === 'html' || ext === 'htm' || file.type === 'text/html') return { text: htmlMode === 'text' ? htmlToText(text) : text, kind: 'HTML' };
  return { text, kind: 'văn bản' };
}

