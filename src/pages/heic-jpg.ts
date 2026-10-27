import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml, storage } from '../ui';
import { pageText } from '../i18n';
import { loadScript, global } from '../lib/cdn';
import { canvasToBlob } from '../lib/image';
import { bindDropzone, baseName, fmtSize, makeZip } from '../lib/files';

mountLayout({ activeTool: 'heic-jpg' });
const T = pageText();
const HEIC2ANY = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';

const st = storage<{ fmt: string; quality: number }>('heic-jpg', { fmt: 'image/jpeg', quality: 90 });
const s = st.get();

$('#tool-root').innerHTML = `
  <div class="workspace">
    <div class="panel">
      <label class="dropzone" id="drop">
        <input type="file" id="files" accept=".heic,.heif,image/heic,image/heif" multiple />
        <b>${T('dropTitle', 'Chọn ảnh HEIC hoặc kéo thả vào đây')}</b>
        <span>${T('dropHint', 'Ảnh .heic / .heif chụp từ iPhone, iPad. Nhiều ảnh cùng lúc, mỗi ảnh dưới 50 MB.')}</span>
      </label>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('format', 'Đổi sang')}</span><select id="fmt"><option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select></label>
        <label class="field" id="q-row"><span class="field-label">${T('quality', 'Chất lượng')}: <output id="q-out"></output>%</span><input type="range" id="quality" min="50" max="100" step="5" /></label>
      </div>
      <div class="actions">
        <button type="button" class="btn btn-primary" id="run" disabled>${T('run', 'Chuyển đổi')}</button>
        <button type="button" class="btn" id="zip" disabled>${T('zip', 'Tải tất cả (.zip)')}</button>
        <button type="button" class="btn" id="clear" disabled>${T('clear', 'Xoá danh sách')}</button>
      </div>
      <div class="progress" id="prog" hidden><i></i></div>
      <p class="error" id="err" hidden></p>
      <p class="note">${T('note', 'Ảnh chuyển đổi ngay trên máy bạn. Lần đầu cần tải bộ giải mã HEIC (khoảng 1,5 MB). Ảnh Live Photo chỉ lấy khung hình chính. Thông tin vị trí GPS trong ảnh gốc không được giữ lại.')}</p>
    </div>
    <section class="panel"><div class="thumbs" id="list"></div></section>
  </div>
`;

interface Item { file: File; out?: { blob: Blob; name: string; url: string }; error?: string }
let items: Item[] = [];
const $i = (id: string) => $<HTMLInputElement>('#' + id);
$<HTMLSelectElement>('#fmt').value = s.fmt;
$i('quality').value = String(s.quality);
const showErr = (m: string) => { const e = $('#err'); e.textContent = m; e.hidden = !m; };
function read(): void {
  s.fmt = $<HTMLSelectElement>('#fmt').value;
  s.quality = Number($i('quality').value);
  st.set(s);
  $('#q-out').textContent = String(s.quality);
  $('#q-row').hidden = s.fmt === 'image/png';
}
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function render(): void {
  $<HTMLButtonElement>('#run').disabled = !items.length;
  $<HTMLButtonElement>('#clear').disabled = !items.length;
  $<HTMLButtonElement>('#zip').disabled = !items.some((i) => i.out);
  $('#list').innerHTML = items.map((it, i) => `<div class="thumb">
      ${it.out ? `<img src="${it.out.url}" alt="" />` : `<div style="aspect-ratio:3/4;display:flex;align-items:center;justify-content:center;background:var(--paper);border-radius:4px">HEIC</div>`}
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(it.file.name)}</span>
      <span>${fmtSize(it.file.size)}${it.out ? ` → ${fmtSize(it.out.blob.size)}` : ''}</span>
      ${it.error ? `<span class="error-text">${escapeHtml(it.error)}</span>` : ''}
      ${it.out ? `<button type="button" class="btn btn-sm" data-dl="${i}">${T('download', 'Tải')}</button>` : ''}
    </div>`).join('');
}

function add(files: File[]): void {
  showErr('');
  for (const f of files) {
    if (!/\.(heic|heif)$/i.test(f.name) && !/hei[cf]/i.test(f.type)) { showErr(`${f.name}: ${T('notHeic', 'không phải ảnh HEIC. Ảnh JPG/PNG thường hãy dùng công cụ Chuyển đổi định dạng ảnh.')}`); continue; }
    if (f.size > 50 * 1024 * 1024) { showErr(`${f.name}: ${T('tooBig', 'lớn hơn 50 MB')}`); continue; }
    items.push({ file: f });
  }
  render();
}

type Heic2Any = (o: { blob: Blob; toType: string; quality?: number; multiple?: boolean }) => Promise<Blob | Blob[]>;

/** Giải mã HEIC: thử trình duyệt trước (Safari đọc được sẵn), không được thì dùng heic2any */
async function decode(f: File): Promise<ImageBitmap | Blob> {
  try {
    return await createImageBitmap(f, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  } catch {
    await loadScript(HEIC2ANY, 'heic2any');
    const r = await global<Heic2Any>('heic2any')({ blob: f, toType: 'image/png' });
    return Array.isArray(r) ? r[0] : r;
  }
}

$('#run').addEventListener('click', async () => {
  read();
  const btn = $<HTMLButtonElement>('#run');
  btn.disabled = true;
  const prog = $('#prog');
  prog.hidden = false;
  const bar = prog.querySelector('i') as HTMLElement;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    bar.style.width = `${(i / items.length) * 100}%`;
    if (it.out) continue;
    try {
      const d = await decode(it.file);
      const bmp = d instanceof Blob ? await createImageBitmap(d) : d;
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      const ctx = c.getContext('2d') as CanvasRenderingContext2D;
      if (s.fmt === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(bmp, 0, 0);
      bmp.close();
      const blob = await canvasToBlob(c, s.fmt, s.quality / 100);
      it.out = { blob, name: `${baseName(it.file.name)}.${EXT[s.fmt]}`, url: URL.createObjectURL(blob) };
      it.error = undefined;
    } catch (e) {
      it.error = /fetch|load/i.test(String((e as Error)?.message)) ? T('errNet', 'Không tải được bộ giải mã. Kiểm tra mạng rồi thử lại.') : T('errDecode', 'Không đọc được ảnh này (file hỏng hoặc định dạng HEIC chưa hỗ trợ).');
    }
    render();
  }
  bar.style.width = '100%';
  btn.disabled = false;
  setTimeout(() => (prog.hidden = true), 600);
  const done = items.filter((i) => i.out);
  if (done.length === 1 && items.length === 1) downloadBlob(done[0].out!.blob, done[0].out!.name);
});
$('#list').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-dl]');
  if (b) { const o = items[Number(b.dataset.dl)].out!; downloadBlob(o.blob, o.name); }
});
$('#zip').addEventListener('click', async () => {
  const outs = items.filter((i) => i.out).map((i) => ({ name: i.out!.name, data: i.out!.blob }));
  if (outs.length) downloadBlob(await makeZip(outs), `${T('zipName', 'anh-heic-da-chuyen')}.zip`);
});
$('#clear').addEventListener('click', () => { items.forEach((i) => i.out && URL.revokeObjectURL(i.out.url)); items = []; render(); });
document.querySelectorAll('#fmt,#quality').forEach((el) => el.addEventListener('input', () => { read(); items.forEach((i) => (i.out = undefined)); render(); }));
bindDropzone($('#drop'), $i('files'), add);
read();
