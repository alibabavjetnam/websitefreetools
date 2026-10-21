import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml, setupTabs, toast } from '../ui';
import { bindDropzone, baseName, extOf, fmtSize, makeZip, safeFileName } from '../lib/files';
import { loadPdf, newPdf, pdfBlob, type PdfDoc } from '../lib/pdflib';
import { openPdf, type PdfJsDoc } from '../lib/cdn';
import { parseRanges, rangesToIndices } from '../lib/ranges';
import { pageText } from '../i18n';

mountLayout({ activeTool: 'pdf-merge' });
const T = pageText();

const MAX_PDF_BYTES = 100 * 1024 * 1024;
const MAX_FILES = 50;
const MAX_THUMBS = 300;

const root = $('#tool-root');
root.innerHTML = `
  <div class="tabs" role="tablist" aria-label="${T('aria.tabs','Chọn thao tác')}">
    <button type="button" role="tab" data-tab="merge">${T('tab.merge','Nối PDF')}</button>
    <button type="button" role="tab" data-tab="split">${T('tab.split','Tách PDF')}</button>
  </div>

  <section class="tool-body" data-panel="merge">
    <div class="panel">
      <label class="dropzone" id="m-drop">
        <input type="file" id="m-files" accept="application/pdf,.pdf" multiple />
        <b>${T('m.drop','Chọn các file PDF hoặc kéo thả vào đây')}</b>
        <span>${T('m.dropHint1','Tối đa')} ${MAX_FILES} ${T('m.dropHint2','file, mỗi file dưới 100 MB. Có thể thêm nhiều lần.')}</span>
      </label>
      <ol class="file-list" id="m-list"></ol>
      <p class="note" id="m-hint">${T('m.hint','Sắp xếp thứ tự bằng nút mũi tên. Ô Trang để trống nghĩa là lấy hết, hoặc nhập ví dụ <b>1-3, 5, 8-</b> (8- là từ trang 8 đến hết).')}</p>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('m.outName','Tên file kết quả')}</span><input type="text" id="m-name" value="gop-file" maxlength="100" /></label>
      </div>
      <div class="actions">
        <button type="button" class="btn btn-primary" id="m-run" disabled>${T('m.run','Nối và tải về')}</button>
        <button type="button" class="btn" id="m-clear" disabled>${T('m.clear','Xoá danh sách')}</button>
      </div>
      <p class="error" id="m-err" hidden></p>
    </div>
  </section>

  <section class="tool-body" data-panel="split">
    <div class="panel">
      <label class="dropzone" id="s-drop">
        <input type="file" id="s-file" accept="application/pdf,.pdf" />
        <b>${T('s.drop','Chọn một file PDF hoặc kéo thả vào đây')}</b>
        <span>${T('s.dropHint','File dưới 100 MB.')}</span>
      </label>
      <div id="s-body" class="split-body" hidden>
        <p id="s-info" class="split-info"></p>
        <fieldset class="field">
          <legend>${T('s.mode','Cách tách')}</legend>
          <div class="format-list">
            <label class="format-option"><input type="radio" name="s-mode" value="pick" checked /><span class="format-name">${T('s.pick','Lấy các trang đã chọn')}</span></label>
            <label class="format-option"><input type="radio" name="s-mode" value="ranges" /><span class="format-name">${T('s.ranges','Mỗi khoảng thành một file')}</span></label>
            <label class="format-option"><input type="radio" name="s-mode" value="each" /><span class="format-name">${T('s.each','Mỗi trang một file')}</span></label>
            <label class="format-option"><input type="radio" name="s-mode" value="every" /><span class="format-name">${T('s.every','Chia đều mỗi N trang')}</span></label>
          </div>
          <span class="field-hint" id="s-mode-hint"></span>
        </fieldset>
        <div class="field-row">
          <label class="field" id="s-f-range"><span class="field-label">${T('s.pages','Trang')}</span><input type="text" id="s-range" placeholder="${T('s.pagesPh','Ví dụ: 1-3, 5, 8-')}" /></label>
          <label class="field" id="s-f-every" hidden><span class="field-label">${T('s.perFile','Số trang mỗi file')}</span><input type="number" id="s-every" min="1" value="2" /></label>
        </div>
        <div class="actions">
          <button type="button" class="btn btn-primary" id="s-run">${T('s.run','Tách và tải về')}</button>
          <button type="button" class="btn" id="s-all">${T('s.all','Chọn tất cả')}</button>
          <button type="button" class="btn" id="s-none">${T('s.none','Bỏ chọn')}</button>
        </div>
        <p class="error" id="s-err" hidden></p>
        <p class="note">${T('s.clickHint','Bấm vào trang để chọn hoặc bỏ chọn, ô Trang sẽ tự cập nhật.')}</p>
        <div class="page-grid" id="s-pages"></div>
      </div>
    </div>
  </section>
`;
setupTabs(root);

const showErr = (id: string, msg: string) => {
  const el = $(id);
  el.textContent = msg;
  el.hidden = !msg;
};

/* ---------------- Nối ---------------- */

interface MergeItem { file: File; bytes: Uint8Array; doc: PdfDoc; pages: number; range: string }
let mergeItems: MergeItem[] = [];

async function addMergeFiles(files: File[]): Promise<void> {
  const errs: string[] = [];
  for (const f of files) {
    if (mergeItems.length >= MAX_FILES) { errs.push(`${T('err.maxMerge1','Chỉ nối tối đa')} ${MAX_FILES} ${T('err.maxMerge2','file mỗi lần.')}`); break; }
    if (extOf(f.name) !== 'pdf' && f.type !== 'application/pdf') { errs.push(`${f.name}: ${T('err.notPdf','không phải file PDF.')}`); continue; }
    if (f.size > MAX_PDF_BYTES) { errs.push(`${f.name}: ${T('err.tooBig','lớn hơn 100 MB.')}`); continue; }
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await loadPdf(bytes, f.name);
      mergeItems.push({ file: f, bytes, doc, pages: doc.getPageCount(), range: '' });
    } catch (e) {
      errs.push((e as Error).message);
    }
    renderMerge();
  }
  showErr('#m-err', errs.slice(0, 4).join(' '));
}

function renderMerge(): void {
  $('#m-list').innerHTML = mergeItems
    .map((it, i) => `<li class="file-item">
      <span class="file-main"><b>${escapeHtml(it.file.name)}</b><span class="note">${it.pages} ${T('pages','trang')} · ${fmtSize(it.file.size)}</span></span>
      <label class="file-range"><span class="sr-only">${T('pagesFrom','Trang lấy từ')} ${escapeHtml(it.file.name)}</span><input type="text" data-range="${i}" value="${escapeHtml(it.range)}" placeholder="${T('allPages','Tất cả trang')}" /></label>
      <span class="file-actions">
        <button type="button" class="btn btn-sm" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="${T('moveUp','Đưa lên')}">↑</button>
        <button type="button" class="btn btn-sm" data-down="${i}" ${i === mergeItems.length - 1 ? 'disabled' : ''} aria-label="${T('moveDown','Đưa xuống')}">↓</button>
        <button type="button" class="btn btn-sm" data-del="${i}" aria-label="${T('removeFile','Bỏ file này')}">✕</button>
      </span>
    </li>`)
    .join('');
  $<HTMLButtonElement>('#m-run').disabled = mergeItems.length === 0;
  $<HTMLButtonElement>('#m-clear').disabled = mergeItems.length === 0;
}

$('#m-list').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b) return;
  const swap = (i: number, j: number) => ([mergeItems[i], mergeItems[j]] = [mergeItems[j], mergeItems[i]]);
  if (b.dataset.up) swap(Number(b.dataset.up), Number(b.dataset.up) - 1);
  else if (b.dataset.down) swap(Number(b.dataset.down), Number(b.dataset.down) + 1);
  else if (b.dataset.del) mergeItems.splice(Number(b.dataset.del), 1);
  renderMerge();
});
$('#m-list').addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.dataset.range) mergeItems[Number(t.dataset.range)].range = t.value;
});

$('#m-run').addEventListener('click', async () => {
  const btn = $<HTMLButtonElement>('#m-run');
  showErr('#m-err', '');
  try {
    if (mergeItems.length === 1 && !mergeItems[0].range.trim()) throw new Error(T('err.needTwo','Hãy thêm ít nhất hai file để nối, hoặc nhập trang cần lấy.'));
    // Kiểm tra mọi khoảng trang trước khi làm để báo lỗi sớm
    const plans = mergeItems.map((it) => {
      try {
        return it.range.trim() ? rangesToIndices(parseRanges(it.range, it.pages)) : it.doc.getPageIndices();
      } catch (e) {
        throw new Error(`${it.file.name}: ${(e as Error).message}`);
      }
    });
    btn.disabled = true;
    btn.textContent = T('merging','Đang nối…');
    const out = await newPdf();
    for (let i = 0; i < mergeItems.length; i++) {
      const pages = await out.copyPages(mergeItems[i].doc, plans[i]);
      pages.forEach((p) => out.addPage(p));
    }
    const name = safeFileName($<HTMLInputElement>('#m-name').value || 'gop-file');
    out.setTitle(name);
    const bytes = await out.save();
    downloadBlob(pdfBlob(bytes), `${name}.pdf`);
    toast(`${T('toast.merged','Đã nối')} ${plans.reduce((a, p) => a + p.length, 0)} ${T('pages','trang')}, ${fmtSize(bytes.length)}`);
  } catch (e) {
    showErr('#m-err', (e as Error).message);
  } finally {
    btn.disabled = mergeItems.length === 0;
    btn.textContent = T('m.run','Nối và tải về');
  }
});
$('#m-clear').addEventListener('click', () => {
  mergeItems = [];
  renderMerge();
  showErr('#m-err', '');
});
bindDropzone($('#m-drop'), $<HTMLInputElement>('#m-files'), (f) => void addMergeFiles(f));

/* ---------------- Tách ---------------- */

interface SplitState { file: File; doc: PdfDoc; pages: number; view: PdfJsDoc | null }
let split: SplitState | null = null;
let selected = new Set<number>(); // số trang (bắt đầu từ 1)
let thumbJob = 0;

const mode = () => (root.querySelector<HTMLInputElement>('input[name="s-mode"]:checked')?.value ?? 'pick') as 'pick' | 'ranges' | 'each' | 'every';
const MODE_HINT = {
  pick: T('hint.pick', 'Các trang đã chọn được gộp thành một file PDF mới.'),
  ranges: T('hint.ranges', 'Mỗi khoảng cách nhau bằng dấu phẩy tạo thành một file riêng, tải về dạng .zip.'),
  each: T('hint.each', 'Mỗi trang thành một file PDF, tải về dạng .zip.'),
  every: T('hint.every', 'Cắt file thành các phần bằng nhau, phần cuối có thể ít trang hơn. Tải về dạng .zip.'),
};

/** Nén danh sách trang thành chuỗi khoảng, ví dụ [1,2,3,5] → "1-3, 5" */
function toRangeText(pages: number[]): string {
  const s = [...pages].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < s.length; ) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    out.push(i === j ? `${s[i]}` : `${s[i]}-${s[j]}`);
    i = j + 1;
  }
  return out.join(', ');
}

function syncMode(): void {
  const m = mode();
  $('#s-mode-hint').textContent = MODE_HINT[m];
  $('#s-f-range').hidden = m === 'each' || m === 'every';
  $('#s-f-every').hidden = m !== 'every';
}

function syncSelectionFromText(): void {
  if (!split) return;
  try {
    selected = new Set(rangesToIndices(parseRanges($<HTMLInputElement>('#s-range').value, split.pages)).map((i) => i + 1));
  } catch {
    selected = new Set();
  }
  paintSelection();
}

function paintSelection(): void {
  root.querySelectorAll<HTMLElement>('[data-page]').forEach((el) => {
    const on = selected.has(Number(el.dataset.page));
    el.classList.toggle('is-selected', on);
    el.setAttribute('aria-pressed', String(on));
  });
}

async function loadSplit(files: File[]): Promise<void> {
  const f = files[0];
  showErr('#s-err', '');
  if (!f) return;
  if (extOf(f.name) !== 'pdf' && f.type !== 'application/pdf') return showErr('#s-err', `${f.name}: ${T('err.notPdf','không phải file PDF.')}`);
  if (f.size > MAX_PDF_BYTES) return showErr('#s-err', `${f.name}: ${T('err.tooBig','lớn hơn 100 MB.')}`);
  try {
    const bytes = new Uint8Array(await f.arrayBuffer());
    const doc = await loadPdf(bytes, f.name);
    await split?.view?.destroy();
    split = { file: f, doc, pages: doc.getPageCount(), view: null };
    selected = new Set();
    $<HTMLInputElement>('#s-range').value = '';
    $('#s-info').innerHTML = `<b>${escapeHtml(f.name)}</b> · ${split.pages} ${T('pages','trang')} · ${fmtSize(f.size)}`;
    $('#s-body').hidden = false;
    const grid = $('#s-pages');
    grid.innerHTML = Array.from({ length: split.pages }, (_, i) =>
      `<button type="button" class="page-thumb" data-page="${i + 1}" aria-pressed="false"><span class="page-canvas"></span><span class="page-no">${i + 1}</span></button>`).join('');
    void renderThumbs(bytes);
  } catch (e) {
    showErr('#s-err', (e as Error).message);
  }
}

/** Vẽ ảnh thu nhỏ từng trang (lần lượt để không treo máy với file nhiều trang) */
async function renderThumbs(bytes: Uint8Array): Promise<void> {
  const job = ++thumbJob;
  try {
    const view = await openPdf(bytes);
    if (job !== thumbJob || !split) { await view.destroy(); return; }
    split.view = view;
    const n = Math.min(view.numPages, MAX_THUMBS);
    for (let i = 1; i <= n; i++) {
      if (job !== thumbJob) return;
      const page = await view.getPage(i);
      const vp0 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: 220 / Math.max(vp0.width, vp0.height) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      await page.render({ canvasContext: canvas.getContext('2d') as CanvasRenderingContext2D, viewport: vp }).promise;
      page.cleanup();
      root.querySelector(`[data-page="${i}"] .page-canvas`)?.replaceChildren(canvas);
    }
  } catch {
    // Không vẽ được ảnh thu nhỏ vẫn tách được bằng pdf-lib, chỉ hiện số trang
  }
}

$('#s-pages').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-page]');
  if (!b) return;
  const p = Number(b.dataset.page);
  if (selected.has(p)) selected.delete(p);
  else selected.add(p);
  if (mode() === 'each' || mode() === 'every') (root.querySelector('input[name="s-mode"][value="pick"]') as HTMLInputElement).checked = true;
  syncMode();
  $<HTMLInputElement>('#s-range').value = toRangeText([...selected]);
  paintSelection();
});
$('#s-range').addEventListener('input', syncSelectionFromText);
$('#s-all').addEventListener('click', () => {
  if (!split) return;
  $<HTMLInputElement>('#s-range').value = `1-${split.pages}`;
  syncSelectionFromText();
});
$('#s-none').addEventListener('click', () => {
  $<HTMLInputElement>('#s-range').value = '';
  syncSelectionFromText();
});
root.querySelectorAll('input[name="s-mode"]').forEach((r) => r.addEventListener('change', syncMode));

async function extract(src: PdfDoc, indices: number[], title: string): Promise<Uint8Array> {
  const out = await newPdf();
  (await out.copyPages(src, indices)).forEach((p) => out.addPage(p));
  out.setTitle(title);
  return out.save();
}

$('#s-run').addEventListener('click', async () => {
  if (!split) return;
  const btn = $<HTMLButtonElement>('#s-run');
  showErr('#s-err', '');
  const { doc, pages, file } = split;
  const base = safeFileName(baseName(file.name));
  try {
    let groups: { indices: number[]; label: string }[];
    const m = mode();
    if (m === 'pick') {
      const idx = rangesToIndices(parseRanges($<HTMLInputElement>('#s-range').value, pages));
      groups = [{ indices: idx, label: `trang-${toRangeText(idx.map((i) => i + 1)).replace(/, /g, '_')}` }];
    } else if (m === 'ranges') {
      groups = parseRanges($<HTMLInputElement>('#s-range').value, pages).map(([a, b]) => ({
        indices: rangesToIndices([[a, b]]),
        label: a === b ? `trang-${a}` : `trang-${a}-${b}`,
      }));
    } else if (m === 'each') {
      groups = doc.getPageIndices().map((i) => ({ indices: [i], label: `trang-${i + 1}` }));
    } else {
      const n = Math.floor(Number($<HTMLInputElement>('#s-every').value));
      if (!(n >= 1)) throw new Error(T('err.perFile','Số trang mỗi file phải từ 1 trở lên.'));
      if (n >= pages) throw new Error(`${T('err.onlyPages1','File chỉ có')} ${pages} ${T('err.onlyPages2','trang, hãy nhập số nhỏ hơn.')}`);
      groups = [];
      for (let a = 0; a < pages; a += n) {
        const idx = Array.from({ length: Math.min(n, pages - a) }, (_, k) => a + k);
        groups.push({ indices: idx, label: `phan-${groups.length + 1}_trang-${a + 1}-${a + idx.length}` });
      }
    }
    btn.disabled = true;
    if (groups.length === 1) {
      btn.textContent = T('splitting','Đang tách…');
      const bytes = await extract(doc, groups[0].indices, base);
      downloadBlob(pdfBlob(bytes), safeFileName(`${base}_${groups[0].label}`).slice(0, 120) + '.pdf');
      toast(`${T('toast.made','Đã tạo file')} ${groups[0].indices.length} ${T('pages','trang')}`);
    } else {
      const entries: { name: string; data: Uint8Array }[] = [];
      for (let i = 0; i < groups.length; i++) {
        btn.textContent = `${T('splitting2','Đang tách')} ${i + 1}/${groups.length}…`;
        entries.push({ name: `${safeFileName(`${base}_${groups[i].label}`)}.pdf`, data: await extract(doc, groups[i].indices, base) });
      }
      btn.textContent = T('zipping','Đang nén .zip…');
      downloadBlob(await makeZip(entries), `${base}_tach.zip`);
      toast(`${T('toast.split','Đã tách thành')} ${groups.length} ${T('files','file')}`);
    }
  } catch (e) {
    showErr('#s-err', (e as Error).message);
  } finally {
    btn.disabled = false;
    btn.textContent = T('s.run','Tách và tải về');
  }
});
bindDropzone($('#s-drop'), $<HTMLInputElement>('#s-file'), (f) => void loadSplit(f));
syncMode();
