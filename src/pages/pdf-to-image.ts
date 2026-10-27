import { mountLayout } from '../layout';
import { $, downloadBlob, storage, toast } from '../ui';
import { pageText } from '../i18n';
import { openPdf, type PdfJsDoc } from '../lib/cdn';
import { renderPage } from '../lib/pdfrender';
import { canvasToBlob } from '../lib/image';
import { bindDropzone, baseName, fmtSize, makeZip } from '../lib/files';
import { parseRanges, rangesToIndices } from '../lib/ranges';

mountLayout({ activeTool: 'pdf-to-image' });
const T = pageText();

const st = storage<{ fmt: string; dpi: number; quality: number }>('pdf-to-image', { fmt: 'image/jpeg', dpi: 150, quality: 90 });
const s = st.get();

$('#tool-root').innerHTML = `
  <div class="workspace">
    <div class="panel">
      <label class="dropzone" id="drop">
        <input type="file" id="file" accept="application/pdf,.pdf" />
        <b>${T('dropTitle', 'Chọn file PDF hoặc kéo thả vào đây')}</b>
        <span>${T('dropHint', 'Tối đa 200 MB. File xử lý ngay trên máy bạn.')}</span>
      </label>
      <p class="note" id="info"></p>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('format', 'Định dạng ảnh')}</span>
          <select id="fmt"><option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select>
        </label>
        <label class="field"><span class="field-label">${T('dpi', 'Độ nét')}</span>
          <select id="dpi"><option value="72">72 dpi (${T('dScreen', 'xem màn hình, nhẹ')})</option><option value="150">150 dpi (${T('dNormal', 'thường dùng')})</option><option value="200">200 dpi</option><option value="300">300 dpi (${T('dPrint', 'in ấn')})</option></select>
        </label>
      </div>
      <label class="field" id="q-row"><span class="field-label">${T('quality', 'Chất lượng JPG/WebP')}: <output id="q-out"></output>%</span><input type="range" id="quality" min="40" max="100" step="5" /></label>
      <label class="field"><span class="field-label">${T('pages', 'Trang cần chuyển')}</span><input type="text" id="range" class="input-inline" placeholder="${T('rangePh', 'Ví dụ: 1-3, 5 (bỏ trống = tất cả)')}" /></label>
      <div class="actions">
        <button type="button" class="btn btn-primary" id="run" disabled>${T('run', 'Chuyển thành ảnh')}</button>
        <button type="button" class="btn" id="zip" disabled>${T('zip', 'Tải tất cả (.zip)')}</button>
      </div>
      <div class="progress" id="prog" hidden><i></i></div>
      <p class="error" id="err" hidden></p>
    </div>
    <section class="panel">
      <div class="panel-title" style="margin:0">${T('result', 'Ảnh từng trang')}</div>
      <div class="thumbs" id="out"></div>
    </section>
  </div>
`;

let doc: PdfJsDoc | null = null;
let file: File | null = null;
let outs: { name: string; blob: Blob }[] = [];
const $i = (id: string) => $<HTMLInputElement>('#' + id);
$<HTMLSelectElement>('#fmt').value = s.fmt;
$<HTMLSelectElement>('#dpi').value = String(s.dpi);
$i('quality').value = String(s.quality);
const showErr = (m: string) => { const e = $('#err'); e.textContent = m; e.hidden = !m; };
function read(): void {
  s.fmt = $<HTMLSelectElement>('#fmt').value;
  s.dpi = Number($<HTMLSelectElement>('#dpi').value);
  s.quality = Number($i('quality').value);
  st.set(s);
  $('#q-out').textContent = String(s.quality);
  $('#q-row').hidden = s.fmt === 'image/png';
}

async function open(f: File): Promise<void> {
  showErr('');
  if (!/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name)) { showErr(T('notPdf', 'Hãy chọn file PDF.')); return; }
  if (f.size > 200 * 1024 * 1024) { showErr(T('tooBig', 'File lớn hơn 200 MB.')); return; }
  $('#info').textContent = T('opening', 'Đang mở file…');
  try {
    await doc?.destroy?.();
    doc = await openPdf(new Uint8Array(await f.arrayBuffer()));
    file = f;
    $('#info').textContent = `${f.name} · ${doc.numPages} ${T('pagesU', 'trang')} · ${fmtSize(f.size)}`;
    $<HTMLButtonElement>('#run').disabled = false;
    $('#out').innerHTML = '';
    outs = [];
    $<HTMLButtonElement>('#zip').disabled = true;
  } catch (e) {
    $('#info').textContent = '';
    showErr((e as Error).message);
  }
}

async function run(): Promise<void> {
  if (!doc || !file) return;
  read();
  showErr('');
  let pages: number[];
  try {
    const r = $i('range').value.trim();
    pages = r ? [...new Set(rangesToIndices(parseRanges(r, doc.numPages)))].map((i) => i + 1) : Array.from({ length: doc.numPages }, (_, i) => i + 1);
  } catch (e) { showErr((e as Error).message); return; }
  const btn = $<HTMLButtonElement>('#run');
  btn.disabled = true;
  const prog = $('#prog');
  prog.hidden = false;
  const bar = prog.querySelector('i') as HTMLElement;
  outs = [];
  $('#out').innerHTML = '';
  const ext = s.fmt === 'image/png' ? 'png' : s.fmt === 'image/webp' ? 'webp' : 'jpg';
  try {
    for (let k = 0; k < pages.length; k++) {
      const p = pages[k];
      bar.style.width = `${(k / pages.length) * 100}%`;
      const c = await renderPage(doc, p, s.dpi / 72);
      const blob = await canvasToBlob(c, s.fmt, s.quality / 100);
      const name = `${baseName(file.name)}-${String(p).padStart(String(doc.numPages).length, '0')}.${ext}`;
      outs.push({ name, blob });
      const url = URL.createObjectURL(blob);
      const card = document.createElement('div');
      card.className = 'thumb';
      card.innerHTML = `<img src="${url}" alt="" loading="lazy" /><span>${T('page', 'Trang')} ${p} · ${c.width}×${c.height} · ${fmtSize(blob.size)}</span><button type="button" class="btn btn-sm">${T('download', 'Tải ảnh')}</button>`;
      card.querySelector('button')!.addEventListener('click', () => downloadBlob(blob, name));
      $('#out').appendChild(card);
    }
    bar.style.width = '100%';
    $<HTMLButtonElement>('#zip').disabled = !outs.length;
    if (outs.length === 1) downloadBlob(outs[0].blob, outs[0].name);
  } catch (e) {
    showErr((e as Error).message || T('err', 'Không chuyển được trang này. Hãy thử độ nét thấp hơn.'));
  } finally {
    btn.disabled = false;
    setTimeout(() => (prog.hidden = true), 800);
  }
}

bindDropzone($('#drop'), $i('file'), (f) => void open(f[0]));
$('#run').addEventListener('click', () => void run());
$('#zip').addEventListener('click', async () => {
  if (!outs.length || !file) return;
  toast(T('zipping', 'Đang nén file ZIP…'));
  downloadBlob(await makeZip(outs.map((o) => ({ name: o.name, data: o.blob }))), `${baseName(file.name)}-${T('images', 'anh')}.zip`);
});
document.querySelectorAll('#fmt,#dpi,#quality').forEach((el) => el.addEventListener('input', read));
read();
