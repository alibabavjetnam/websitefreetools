import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml, storage, toast } from '../ui';
import { pageText } from '../i18n';
import { loadImage, canvasToBlob, MAX_IMAGE_BYTES } from '../lib/image';
import { bindDropzone, fmtSize } from '../lib/files';
import { newPdf, pdfBlob } from '../lib/pdflib';

mountLayout({ activeTool: 'image-to-pdf' });
const T = pageText();

/** Khổ giấy theo điểm PDF (1 pt = 1/72 inch) */
const SIZES: Record<string, [number, number] | null> = { a4: [595.28, 841.89], letter: [612, 792], a5: [419.53, 595.28], a3: [841.89, 1190.55], legal: [612, 1008], fit: null };
const MARGINS: Record<string, number> = { none: 0, small: 20, big: 48 };

const st = storage<{ size: string; orient: string; margin: string; fit: string; quality: number; name: string }>('image-to-pdf', { size: 'a4', orient: 'auto', margin: 'small', fit: 'contain', quality: 85, name: '' });
const s = st.get();

$('#tool-root').innerHTML = `
  <div class="workspace">
    <div class="panel">
      <label class="dropzone" id="drop">
        <input type="file" id="files" accept="image/*" multiple />
        <b>${T('dropTitle', 'Chọn ảnh hoặc kéo thả vào đây')}</b>
        <span>${T('dropHint', 'JPG, PNG, WebP, GIF, BMP. Tối đa 200 ảnh, mỗi ảnh dưới 40 MB.')}</span>
      </label>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('size', 'Khổ giấy')}</span>
          <select id="size"><option value="a4">A4</option><option value="letter">Letter (US)</option><option value="a5">A5</option><option value="a3">A3</option><option value="legal">Legal</option><option value="fit">${T('fitImage', 'Bằng đúng kích thước ảnh')}</option></select>
        </label>
        <label class="field"><span class="field-label">${T('orient', 'Hướng giấy')}</span>
          <select id="orient"><option value="auto">${T('oAuto', 'Tự động theo ảnh')}</option><option value="portrait">${T('oPortrait', 'Dọc')}</option><option value="landscape">${T('oLandscape', 'Ngang')}</option></select>
        </label>
      </div>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('margin', 'Lề trang')}</span>
          <select id="margin"><option value="none">${T('mNone', 'Không lề')}</option><option value="small">${T('mSmall', 'Lề nhỏ')}</option><option value="big">${T('mBig', 'Lề lớn')}</option></select>
        </label>
        <label class="field"><span class="field-label">${T('fit', 'Cách đặt ảnh')}</span>
          <select id="fit"><option value="contain">${T('fContain', 'Vừa trang, giữ nguyên ảnh')}</option><option value="cover">${T('fCover', 'Phủ kín trang (cắt bớt)')}</option></select>
        </label>
      </div>
      <label class="field"><span class="field-label">${T('quality', 'Chất lượng ảnh trong PDF')}: <output id="q-out"></output>%</span><input type="range" id="quality" min="40" max="100" step="5" /></label>
      <label class="field"><span class="field-label">${T('fileName', 'Tên file PDF')}</span><input type="text" id="name" class="input-inline" placeholder="${T('defaultName', 'anh-sang-pdf')}" /></label>
      <div class="actions">
        <button type="button" class="btn btn-primary" id="make" disabled>${T('make', 'Tạo file PDF')}</button>
        <button type="button" class="btn" id="clear" disabled>${T('clear', 'Xoá hết ảnh')}</button>
      </div>
      <div class="progress" hidden id="prog"><i></i></div>
      <p class="note" id="status"></p>
    </div>
    <section class="panel">
      <div class="row" style="justify-content:space-between"><div class="panel-title" style="margin:0">${T('pages', 'Thứ tự trang')} · <span id="count">0</span></div>
        <div class="row"><button type="button" class="btn btn-sm" id="sortName">${T('sortName', 'Xếp theo tên')}</button><button type="button" class="btn btn-sm" id="reverse">${T('reverse', 'Đảo ngược')}</button></div></div>
      <div class="thumbs" id="thumbs"></div>
      <p class="note">${T('dragTip', 'Kéo thả ảnh để đổi thứ tự trang, hoặc dùng nút ◀ ▶. Ảnh xử lý ngay trên máy bạn.')}</p>
    </section>
  </div>
`;

interface Item { id: number; file: File; url: string }
let items: Item[] = [];
let seq = 0;
const $i = (id: string) => $<HTMLInputElement>('#' + id);
for (const k of ['size', 'orient', 'margin', 'fit'] as const) $<HTMLSelectElement>('#' + k).value = s[k];
$i('quality').value = String(s.quality);
$i('name').value = s.name;
function read(): void {
  for (const k of ['size', 'orient', 'margin', 'fit'] as const) s[k] = $<HTMLSelectElement>('#' + k).value;
  s.quality = Number($i('quality').value);
  s.name = $i('name').value;
  st.set(s);
  $('#q-out').textContent = String(s.quality);
}

function render(): void {
  $('#count').textContent = String(items.length);
  $<HTMLButtonElement>('#make').disabled = !items.length;
  $<HTMLButtonElement>('#clear').disabled = !items.length;
  $('#thumbs').innerHTML = items.map((it, i) => `
    <div class="thumb" draggable="true" data-i="${i}">
      <img src="${it.url}" alt="" />
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${i + 1}. ${escapeHtml(it.file.name)}</span>
      <div class="row"><button type="button" class="btn btn-sm" data-mv="-1" data-i="${i}" aria-label="${T('left', 'Lên trước')}">◀</button><button type="button" class="btn btn-sm" data-rm="${i}" aria-label="${T('remove', 'Bỏ ảnh')}">✕</button><button type="button" class="btn btn-sm" data-mv="1" data-i="${i}" aria-label="${T('right', 'Ra sau')}">▶</button></div>
    </div>`).join('');
}

function add(files: File[]): void {
  const errs: string[] = [];
  for (const f of files) {
    if (items.length >= 200) { errs.push(T('max', 'Tối đa 200 ảnh.')); break; }
    if (!f.type.startsWith('image/')) { errs.push(`${f.name}: ${T('notImage', 'không phải ảnh')}`); continue; }
    if (f.size > MAX_IMAGE_BYTES) { errs.push(`${f.name}: ${T('tooBig', 'lớn hơn 40 MB')}`); continue; }
    items.push({ id: ++seq, file: f, url: URL.createObjectURL(f) });
  }
  if (errs.length) toast(errs.slice(0, 3).join(' · '));
  render();
}

let dragFrom = -1;
const thumbs = $('#thumbs');
thumbs.addEventListener('dragstart', (e) => { const el = (e.target as HTMLElement).closest<HTMLElement>('.thumb'); if (el) { dragFrom = Number(el.dataset.i); el.classList.add('is-drag'); } });
thumbs.addEventListener('dragover', (e) => e.preventDefault());
thumbs.addEventListener('drop', (e) => {
  e.preventDefault();
  const el = (e.target as HTMLElement).closest<HTMLElement>('.thumb');
  if (!el || dragFrom < 0) return;
  const to = Number(el.dataset.i);
  const [m] = items.splice(dragFrom, 1);
  items.splice(to, 0, m);
  dragFrom = -1;
  render();
});
thumbs.addEventListener('dragend', () => { dragFrom = -1; render(); });
thumbs.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!b) return;
  if (b.dataset.rm) { const [it] = items.splice(Number(b.dataset.rm), 1); URL.revokeObjectURL(it.url); }
  if (b.dataset.mv) {
    const i = Number(b.dataset.i), j = i + Number(b.dataset.mv);
    if (j >= 0 && j < items.length) [items[i], items[j]] = [items[j], items[i]];
  }
  render();
});

/** Ảnh JPG giữ nguyên nếu không cần nén lại; ảnh khác vẽ lên canvas → JPG (PNG có nền trong suốt giữ PNG) */
async function prepare(f: File): Promise<{ bytes: Uint8Array; kind: 'jpg' | 'png'; w: number; h: number }> {
  const img = await loadImage(f);
  try {
    const w = img.width, h = img.height;
    if (f.type === 'image/jpeg' && s.quality >= 95) return { bytes: new Uint8Array(await f.arrayBuffer()), kind: 'jpg', w, h };
    // Thu nhỏ ảnh quá lớn (tối đa ~ 300 dpi cho A3) để file PDF không quá nặng
    const k = Math.min(1, 3600 / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * k);
    c.height = Math.round(h * k);
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    const keepPng = f.type === 'image/png' && s.quality >= 95;
    if (!keepPng) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(img.source, 0, 0, c.width, c.height);
    const blob = await canvasToBlob(c, keepPng ? 'image/png' : 'image/jpeg', s.quality / 100);
    return { bytes: new Uint8Array(await blob.arrayBuffer()), kind: keepPng ? 'png' : 'jpg', w, h };
  } finally {
    img.close();
  }
}

async function make(): Promise<void> {
  read();
  const btn = $<HTMLButtonElement>('#make');
  btn.disabled = true;
  const prog = $('#prog');
  prog.hidden = false;
  const bar = prog.querySelector('i') as HTMLElement;
  try {
    const pdf = await newPdf();
    const m = MARGINS[s.margin] ?? 20;
    for (let i = 0; i < items.length; i++) {
      $('#status').textContent = `${T('working', 'Đang xử lý ảnh')} ${i + 1}/${items.length}…`;
      bar.style.width = `${(i / items.length) * 100}%`;
      const p = await prepare(items[i].file);
      const emb = p.kind === 'jpg' ? await pdf.embedJpg(p.bytes) : await pdf.embedPng(p.bytes);
      let pw: number, ph: number;
      const size = SIZES[s.size];
      if (!size) { pw = p.w * 0.75 + m * 2; ph = p.h * 0.75 + m * 2; } // 96 dpi → 72 pt
      else {
        [pw, ph] = size;
        const land = s.orient === 'landscape' || (s.orient === 'auto' && p.w > p.h);
        if (land) [pw, ph] = [ph, pw];
      }
      const page = pdf.addPage([pw, ph]);
      const bw = pw - m * 2, bh = ph - m * 2;
      const r = s.fit === 'cover' ? Math.max(bw / p.w, bh / p.h) : Math.min(bw / p.w, bh / p.h);
      const dw = p.w * r, dh = p.h * r;
      page.drawImage(emb, { x: m + (bw - dw) / 2, y: m + (bh - dh) / 2, width: dw, height: dh });
    }
    bar.style.width = '100%';
    const bytes = await pdf.save({ useObjectStreams: true });
    const name = (s.name.trim() || T('defaultName', 'anh-sang-pdf')).replace(/\.pdf$/i, '');
    downloadBlob(pdfBlob(bytes), `${name}.pdf`);
    $('#status').textContent = `${T('done', 'Xong!')} ${items.length} ${T('pagesU', 'trang')} · ${fmtSize(bytes.length)}`;
  } catch (e) {
    $('#status').textContent = '';
    toast((e as Error).message || T('err', 'Không tạo được PDF. Hãy thử lại.'));
  } finally {
    btn.disabled = false;
    setTimeout(() => (prog.hidden = true), 800);
  }
}

bindDropzone($('#drop'), $i('files'), add);
$('#make').addEventListener('click', () => void make());
$('#clear').addEventListener('click', () => { items.forEach((i) => URL.revokeObjectURL(i.url)); items = []; render(); });
$('#sortName').addEventListener('click', () => { items.sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true })); render(); });
$('#reverse').addEventListener('click', () => { items.reverse(); render(); });
document.querySelectorAll('#size,#orient,#margin,#fit,#quality,#name').forEach((el) => el.addEventListener('input', read));
read();
render();
