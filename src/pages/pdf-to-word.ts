import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml, storage } from '../ui';
import { pageText } from '../i18n';
import { openPdf, type PdfJsDoc } from '../lib/cdn';
import { renderPage } from '../lib/pdfrender';
import { bindDropzone, baseName, fmtSize } from '../lib/files';
import { buildDocx, type Block } from '../lib/docxwriter';
import { toLines, toParagraphs, bodyFontSize, type TextPiece } from '../calc/pdftext';

mountLayout({ activeTool: 'pdf-to-word' });
const T = pageText();

type Mode = 'text' | 'image' | 'both';
const st = storage<{ mode: Mode }>('pdf-to-word', { mode: 'text' });
const s = st.get();

$('#tool-root').innerHTML = `
  <div class="workspace">
    <div class="panel">
      <label class="dropzone" id="drop">
        <input type="file" id="file" accept="application/pdf,.pdf" />
        <b>${T('dropTitle', 'Chọn file PDF hoặc kéo thả vào đây')}</b>
        <span>${T('dropHint', 'Tối đa 100 MB, 300 trang. File xử lý ngay trên máy bạn.')}</span>
      </label>
      <fieldset class="field"><legend>${T('mode', 'Cách chuyển')}</legend>
        <div class="fields">
          <label class="check"><input type="radio" name="mode" value="text" /><span><b>${T('mText', 'Lấy chữ để sửa')}</b> — ${T('mTextD', 'đoạn văn, tiêu đề chỉnh sửa được; bố cục phức tạp (bảng, cột) có thể lệch')}</span></label>
          <label class="check"><input type="radio" name="mode" value="image" /><span><b>${T('mImage', 'Giữ nguyên hình trang')}</b> — ${T('mImageD', 'mỗi trang là một ảnh trong Word, giống hệt bản gốc nhưng không sửa chữ được')}</span></label>
          <label class="check"><input type="radio" name="mode" value="both" /><span><b>${T('mBoth', 'Cả hai')}</b> — ${T('mBothD', 'ảnh trang kèm phần chữ bên dưới để sao chép')}</span></label>
        </div>
      </fieldset>
      <div class="actions"><button type="button" class="btn btn-primary" id="run" disabled>${T('run', 'Chuyển sang Word')}</button></div>
      <div class="progress" id="prog" hidden><i></i></div>
      <p class="note" id="status"></p>
      <p class="error" id="err" hidden></p>
      <p class="note">${T('scanNote', 'PDF dạng bản scan (ảnh chụp) không có chữ thật; hãy dùng công cụ Lấy chữ từ ảnh (OCR) với từng trang, hoặc chọn "Giữ nguyên hình trang".')}</p>
    </div>
    <section class="panel">
      <div class="panel-title" style="margin:0">${T('preview', 'Xem trước phần chữ')}</div>
      <div class="doc-preview"><div class="doc-sheet" id="preview"><p class="note">${T('noFile', 'Chưa chọn file.')}</p></div></div>
    </section>
  </div>
`;

let file: File | null = null;
let doc: PdfJsDoc | null = null;
const MAX_PAGES = 300;
const showErr = (m: string) => { const e = $('#err'); e.textContent = m; e.hidden = !m; };
document.querySelectorAll<HTMLInputElement>('input[name=mode]').forEach((r) => {
  r.checked = r.value === s.mode;
  r.addEventListener('change', () => { s.mode = r.value as Mode; st.set(s); });
});

/** Đo độ rộng tương đối từng ký tự bằng canvas để đặt lại đúng chữ có dấu vẽ chồng */
const mctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
mctx.font = '100px "Times New Roman", serif';
const measure = (str: string) => [...str].map((c) => mctx.measureText(c).width);

interface PdfTextItemFull { str: string; transform: number[]; width: number; height?: number }
async function pagePieces(p: number): Promise<{ pieces: TextPiece[]; w: number; h: number }> {
  const page = await (doc as PdfJsDoc).getPage(p);
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  page.cleanup();
  const pieces: TextPiece[] = [];
  for (const it of tc.items as unknown as PdfTextItemFull[]) {
    if (typeof it.str !== 'string' || !it.transform) continue;
    const [a, b, , d, e, f] = it.transform;
    const size = Math.hypot(a, b) || Math.abs(d) || 10;
    pieces.push({ str: it.str, x: e, y: f, w: it.width, size });
  }
  return { pieces, w: vp.width, h: vp.height };
}

async function open(f: File): Promise<void> {
  showErr('');
  if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { showErr(T('notPdf', 'Hãy chọn file PDF.')); return; }
  if (f.size > 100 * 1024 * 1024) { showErr(T('tooBig', 'File lớn hơn 100 MB.')); return; }
  $('#status').textContent = T('opening', 'Đang mở file…');
  try {
    await doc?.destroy?.();
    doc = await openPdf(new Uint8Array(await f.arrayBuffer()));
    file = f;
    $<HTMLButtonElement>('#run').disabled = false;
    $('#status').textContent = `${f.name} · ${doc.numPages} ${T('pagesU', 'trang')} · ${fmtSize(f.size)}`;
    // Xem trước chữ 2 trang đầu
    const html: string[] = [];
    for (let p = 1; p <= Math.min(2, doc.numPages); p++) {
      const { pieces, w } = await pagePieces(p);
      const body = bodyFontSize(pieces);
      for (const para of toParagraphs(toLines(pieces, measure), w, body)) {
        html.push(`<p style="text-align:${para.align};${para.heading ? 'font-weight:700;' : ''}font-size:${Math.max(9, Math.min(28, para.size))}pt">${escapeHtml(para.text)}</p>`);
      }
      if (p === 1 && doc.numPages > 1) html.push('<hr />');
    }
    $('#preview').innerHTML = html.length ? html.join('') : `<p class="error">${T('noText', 'Không tìm thấy chữ trong file (có thể là bản scan). Hãy chọn "Giữ nguyên hình trang" hoặc dùng công cụ OCR.')}</p>`;
  } catch (e) {
    $('#status').textContent = '';
    showErr((e as Error).message);
  }
}

async function run(): Promise<void> {
  if (!doc || !file) return;
  showErr('');
  const btn = $<HTMLButtonElement>('#run');
  btn.disabled = true;
  const prog = $('#prog');
  prog.hidden = false;
  const bar = prog.querySelector('i') as HTMLElement;
  try {
    const n = Math.min(doc.numPages, MAX_PAGES);
    const blocks: Block[] = [];
    let first = { w: 595.28, h: 841.89 };
    let textChars = 0;
    for (let p = 1; p <= n; p++) {
      bar.style.width = `${((p - 1) / n) * 100}%`;
      $('#status').textContent = `${T('working', 'Đang xử lý trang')} ${p}/${n}…`;
      const { pieces, w, h } = await pagePieces(p);
      if (p === 1) first = { w, h };
      // Chế độ chỉ ảnh: ảnh cao gần bằng trang nên tự sang trang, không cần ngắt trang (tránh trang trắng)
      if (p > 1 && s.mode !== 'image') blocks.push({ kind: 'break' });
      if (s.mode !== 'text') {
        const c = await renderPage(doc, p, 150 / 72);
        const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.85));
        if (blob) {
          // Ảnh trang vừa khít vùng in (trừ lề), giữ tỉ lệ trang
          const margin = s.mode === 'image' ? 0 : 36;
          const bw = first.w - margin * 2 - 2, bh = first.h - margin * 2 - 2;
          const k = Math.min(bw / w, bh / h);
          blocks.push({ kind: 'image', data: new Uint8Array(await blob.arrayBuffer()), widthPt: w * k, heightPt: h * k });
        }
      }
      if (s.mode !== 'image') {
        const body = bodyFontSize(pieces);
        const paras = toParagraphs(toLines(pieces, measure), w, body);
        if (s.mode === 'both' && paras.length) blocks.push({ kind: 'break' });
        for (const para of paras) {
          textChars += para.text.length;
          blocks.push({ kind: 'p', text: para.text.replace(/\t/g, '    '), size: Math.max(8, Math.min(36, Math.round(para.size * 2) / 2)), bold: para.heading, align: para.align });
        }
      }
    }
    if (s.mode === 'text' && textChars === 0) throw new Error(T('noText', 'Không tìm thấy chữ trong file (có thể là bản scan). Hãy chọn "Giữ nguyên hình trang" hoặc dùng công cụ OCR.'));
    bar.style.width = '100%';
    const docx = await buildDocx(blocks, { pageWpt: first.w, pageHpt: first.h, marginPt: s.mode === 'image' ? 0 : 54 });
    downloadBlob(docx, `${baseName(file.name)}.docx`);
    $('#status').textContent = `${T('done', 'Xong!')} ${fmtSize(docx.size)}${doc.numPages > MAX_PAGES ? ` · ${T('limited', 'chỉ chuyển 300 trang đầu')}` : ''}`;
  } catch (e) {
    showErr((e as Error).message || T('err', 'Không chuyển được file này.'));
    $('#status').textContent = '';
  } finally {
    btn.disabled = false;
    setTimeout(() => (prog.hidden = true), 600);
  }
}

bindDropzone($('#drop'), $<HTMLInputElement>('#file'), (f) => void open(f[0]));
$('#run').addEventListener('click', () => void run());
