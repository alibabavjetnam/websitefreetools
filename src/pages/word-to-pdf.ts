import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml, toast } from '../ui';
import { pageText } from '../i18n';
import { CDN, global, loadScript } from '../lib/cdn';
import { bindDropzone, baseName, fmtSize } from '../lib/files';
import { newPdf, pdfBlob } from '../lib/pdflib';
import { docxToHtml, type DocxResult } from '../lib/docxhtml';

mountLayout({ activeTool: 'word-to-pdf' });
const T = pageText();
const PX = 96 / 72; // pt → px

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:28px">
    <label class="dropzone" id="drop">
      <input type="file" id="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
      <b>${T('dropTitle', 'Chọn file Word (.docx) hoặc kéo thả vào đây')}</b>
      <span>${T('dropHint', 'Tối đa 50 MB. File được đọc ngay trên máy bạn, không tải lên máy chủ.')}</span>
    </label>
    <div class="actions">
      <button type="button" class="btn btn-primary" id="dl" disabled>${T('download', 'Tải file PDF')}</button>
      <button type="button" class="btn" id="print" disabled>${T('print', 'In / Lưu PDF chữ sắc nét')}</button>
      <span class="note" id="status"></span>
    </div>
    <div class="progress" id="prog" hidden><i></i></div>
    <p class="error" id="err" hidden></p>
    <p class="note">${T('note', '"Tải file PDF" tạo PDF ngay (mỗi trang là ảnh chất lượng cao). "In / Lưu PDF chữ sắc nét" mở hộp thoại in: chọn máy in "Lưu thành PDF" (Save as PDF) để có PDF chữ chọn và tìm kiếm được. Bố cục phức tạp (đầu trang, chân trang, hộp văn bản, biểu đồ) có thể khác bản gốc.')}</p>
  </div>
  <div class="dx-pages" id="pages" style="margin-top:16px" hidden></div>
`;

let result: DocxResult | null = null;
let file: File | null = null;
const showErr = (m: string) => { const e = $('#err'); e.textContent = m; e.hidden = !m; };

/** Chia nội dung thành các trang có kích thước như khổ giấy của tài liệu */
function paginate(r: DocxResult): HTMLElement[] {
  const host = $('#pages');
  host.innerHTML = '';
  host.hidden = false;
  const W = r.pageWpt * PX, H = r.pageHpt * PX;
  const m = r.margins;
  const pages: HTMLElement[] = [];
  let body = document.createElement("div");
  const newPage = () => {
    const pg = document.createElement('div');
    pg.className = 'dx-page';
    Object.assign(pg.style, { width: `${W}px`, height: `${H}px`, padding: `${m.top * PX}px ${m.right * PX}px ${m.bottom * PX}px ${m.left * PX}px` });
    body = document.createElement('div');
    body.style.height = '100%';
    body.style.overflow = 'hidden';
    pg.appendChild(body);
    host.appendChild(pg);
    pages.push(pg);
  };
  const limit = () => H - (m.top + m.bottom) * PX;
  const fits = () => body.scrollHeight <= limit() + 1;
  newPage();
  const tmp = document.createElement('div');
  tmp.innerHTML = r.html;
  for (const block of [...tmp.children] as HTMLElement[]) {
    if (block.classList.contains('dx-break')) { if (body.childElementCount) newPage(); continue; }
    body.appendChild(block);
    if (fits()) continue;
    if (block.tagName === 'TABLE') {
      // Bảng dài: chuyển từng hàng sang trang sau
      const rows = [...block.querySelectorAll(':scope > tbody > tr')];
      const colgroup = block.querySelector('colgroup');
      let cur = block as HTMLTableElement;
      let tbody = cur.tBodies[0];
      tbody.innerHTML = '';
      for (const row of rows) {
        tbody.appendChild(row);
        if (!fits() && tbody.rows.length > 1) {
          row.remove();
          newPage();
          cur = document.createElement('table');
          cur.className = block.className;
          if (colgroup) cur.appendChild(colgroup.cloneNode(true));
          tbody = cur.createTBody();
          body.appendChild(cur);
          tbody.appendChild(row);
        }
      }
      continue;
    }
    // Khối không vừa: sang trang mới (nếu trang hiện tại đã có nội dung khác)
    if (body.childElementCount > 1) {
      block.remove();
      newPage();
      body.appendChild(block);
    }
  }
  if (!body.childElementCount && pages.length > 1) { pages.pop()?.remove(); }
  fitPreview();
  return pages;
}

/** Thu nhỏ trang cho vừa khung xem (không ảnh hưởng file xuất) */
function fitPreview(): void {
  const host = $('#pages');
  if (!result) return;
  const k = Math.min(1, (host.clientWidth - 32) / (result.pageWpt * PX));
  host.querySelectorAll<HTMLElement>('.dx-page').forEach((p) => ((p.style as CSSStyleDeclaration & { zoom: string }).zoom = String(k)));
}

async function open(f: File): Promise<void> {
  showErr('');
  if (!/\.docx$/i.test(f.name)) {
    showErr(/\.doc$/i.test(f.name) ? T('oldDoc', 'File .doc (Word 97-2003) chưa được hỗ trợ. Hãy mở bằng Word và lưu lại dạng .docx rồi thử lại.') : T('notDocx', 'Hãy chọn file Word dạng .docx.'));
    return;
  }
  if (f.size > 50 * 1024 * 1024) { showErr(T('tooBig', 'File lớn hơn 50 MB.')); return; }
  $('#status').textContent = T('reading', 'Đang đọc file…');
  try {
    result = await docxToHtml(await f.arrayBuffer());
    file = f;
    const pages = paginate(result);
    $('#status').textContent = `${f.name} · ${pages.length} ${T('pagesU', 'trang')}`;
    $<HTMLButtonElement>('#dl').disabled = false;
    $<HTMLButtonElement>('#print').disabled = false;
    if (result.warnings.length) showErr(result.warnings.join(' '));
  } catch (e) {
    $('#status').textContent = '';
    showErr((e as Error).message);
  }
}

interface HtmlToImage { toJpeg(el: HTMLElement, o: Record<string, unknown>): Promise<string> }

async function download(): Promise<void> {
  if (!result || !file) return;
  const btn = $<HTMLButtonElement>('#dl');
  btn.disabled = true;
  const prog = $('#prog');
  prog.hidden = false;
  const bar = prog.querySelector('i') as HTMLElement;
  const pages = [...document.querySelectorAll<HTMLElement>('.dx-page')];
  try {
    await loadScript(CDN.htmlToImage, 'htmlToImage');
    const h2i = global<HtmlToImage>('htmlToImage');
    const pdf = await newPdf();
    for (let i = 0; i < pages.length; i++) {
      bar.style.width = `${(i / pages.length) * 100}%`;
      $('#status').textContent = `${T('rendering', 'Đang tạo trang')} ${i + 1}/${pages.length}…`;
      const pg = pages[i];
      const z = (pg.style as CSSStyleDeclaration & { zoom: string }).zoom;
      (pg.style as CSSStyleDeclaration & { zoom: string }).zoom = '1';
      const url = await h2i.toJpeg(pg, { quality: 0.92, pixelRatio: 2, backgroundColor: '#ffffff', skipFonts: true, style: { boxShadow: 'none', margin: '0' } });
      (pg.style as CSSStyleDeclaration & { zoom: string }).zoom = z;
      const bytes = Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0));
      const img = await pdf.embedJpg(bytes);
      const page = pdf.addPage([result.pageWpt, result.pageHpt]);
      page.drawImage(img, { x: 0, y: 0, width: result.pageWpt, height: result.pageHpt });
    }
    bar.style.width = '100%';
    const out = await pdf.save({ useObjectStreams: true });
    downloadBlob(pdfBlob(out), `${baseName(file.name)}.pdf`);
    $('#status').textContent = `${T('done', 'Xong!')} ${pages.length} ${T('pagesU', 'trang')} · ${fmtSize(out.length)}`;
  } catch (e) {
    showErr((e as Error).message || T('err', 'Không tạo được PDF. Hãy thử nút In / Lưu PDF.'));
  } finally {
    btn.disabled = false;
    setTimeout(() => (prog.hidden = true), 600);
  }
}

/** In bằng trình duyệt: giữ chữ dạng vector, người dùng chọn "Lưu thành PDF" */
function printPdf(): void {
  if (!result || !file) return;
  const pages = [...document.querySelectorAll<HTMLElement>('.dx-page')].map((p) => {
    const c = p.cloneNode(true) as HTMLElement;
    (c.style as CSSStyleDeclaration & { zoom: string }).zoom = '';
    c.style.boxShadow = 'none';
    return c.outerHTML;
  });
  const css = [...document.styleSheets].map((s) => { try { return [...s.cssRules].map((r) => r.cssText).filter((t) => /\.dx-/.test(t)).join('\n'); } catch { return ''; } }).join('\n');
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
  document.body.appendChild(frame);
  const d = frame.contentDocument as Document;
  d.open();
  d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(baseName(file.name))}</title><style>${css}
    @page { size: ${result.pageWpt}pt ${result.pageHpt}pt; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .dx-page { box-shadow: none !important; page-break-after: always; break-after: page; }
    .dx-page:last-child { page-break-after: auto; break-after: auto; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style></head><body>${pages.join('')}</body></html>`);
  d.close();
  const go = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60_000);
  };
  // Đợi ảnh trong trang tải xong rồi mới in
  const imgs = [...d.images];
  Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })))).then(() => setTimeout(go, 200));
  toast(T('printTip', 'Chọn máy in "Lưu thành PDF" (Save as PDF) để lưu file.'));
}

bindDropzone($('#drop'), $<HTMLInputElement>('#file'), (f) => void open(f[0]));
$('#dl').addEventListener('click', () => void download());
$('#print').addEventListener('click', printPdf);
window.addEventListener('resize', fitPreview);
