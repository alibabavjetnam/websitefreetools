import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml, fmtDec, fmtInt, toast } from '../ui';
import { pageText } from '../i18n';

mountLayout({ activeTool: 'image-convert' });
const T = pageText();

/** JSZip được nạp từ CDN bằng thẻ <script> (chỉ dùng khi tải tất cả thành 1 file) */
declare const JSZip: (new () => {
  file(name: string, data: Blob): void;
  generateAsync(opts: { type: 'blob' }): Promise<Blob>;
}) | undefined;

const MAX_FILES = 100;
const MAX_BYTES = 40 * 1024 * 1024;
const FORMATS: Record<string, { mime: string; ext: string; label: string }> = {
  jpeg: { mime: 'image/jpeg', ext: 'jpg', label: 'JPG' },
  webp: { mime: 'image/webp', ext: 'webp', label: 'WebP' },
  png: { mime: 'image/png', ext: 'png', label: 'PNG' },
};

$('#tool-root').innerHTML = `
  <div class="workspace tool-body">
    <div class="panel">
      <label class="dropzone" id="drop">
        <input type="file" id="files" accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif" multiple />
        <b>${T('drop.title','Chọn ảnh hoặc kéo thả vào đây')}</b>
        <span>${T('drop.hint1','JPG, PNG, WebP, GIF, BMP. Tối đa')} ${MAX_FILES} ${T('drop.hint2','ảnh, mỗi ảnh dưới 40 MB.')}</span>
      </label>
      <form id="img-form" class="form-grid" novalidate>
        <label class="field">
          <span class="field-label">${T('outFormat','Định dạng xuất')}</span>
          <select id="format">
            <option value="keep">${T('fmt.keep','Giữ như ảnh gốc')}</option>
            <option value="jpeg">${T('fmt.jpeg','JPG (ảnh chụp, nhẹ nhất)')}</option>
            <option value="webp">${T('fmt.webp','WebP (nhẹ, dùng cho web)')}</option>
            <option value="png">${T('fmt.png','PNG (giữ nền trong suốt)')}</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">${T('quality','Chất lượng')}: <output id="q-out">80</output>%</span>
          <input type="range" id="quality" min="30" max="100" step="1" value="80" />
        </label>
        <label class="field">
          <span class="field-label">${T('maxW','Chiều rộng tối đa (px)')}</span>
          <input type="number" id="max-w" min="0" max="20000" step="1" placeholder="${T('keepSame','Giữ nguyên')}" />
        </label>
        <label class="field">
          <span class="field-label">${T('maxH','Chiều cao tối đa (px)')}</span>
          <input type="number" id="max-h" min="0" max="20000" step="1" placeholder="${T('keepSame','Giữ nguyên')}" />
        </label>
      </form>
      <p class="note">${T('note','Ảnh không bị phóng to. Ảnh PNG có nền trong suốt khi đổi sang JPG sẽ được lót nền trắng.')}</p>
    </div>
    <section class="preview">
      <div class="stat-grid" id="img-summary"></div>
      <div class="actions">
        <button type="button" class="btn btn-primary" id="run" disabled>${T('run','Xử lý ảnh')}</button>
        <button type="button" class="btn" id="zip" disabled>${T('zip','Tải tất cả (.zip)')}</button>
        <button type="button" class="btn" id="clear" disabled>${T('clear','Xoá danh sách')}</button>
      </div>
      <p class="error" id="img-error" hidden></p>
    </section>
  </div>
  <div class="table-wrap" style="margin-top:24px"><table class="data-table img-table" id="img-list"></table></div>
`;

interface Item {
  file: File;
  thumb: string;
  result?: { blob: Blob; name: string; width: number; height: number; keptOriginal: boolean };
  error?: string;
}
let items: Item[] = [];

const fmtSize = (b: number) => (b >= 1048576 ? `${fmtDec(b / 1048576)} MB` : `${fmtInt(b / 1024)} KB`);

function addFiles(list: FileList | File[]): void {
  const errors: string[] = [];
  for (const f of [...list]) {
    if (items.length >= MAX_FILES) { errors.push(`${T('err.max1','Chỉ nhận tối đa')} ${MAX_FILES} ${T('err.max2','ảnh mỗi lần.')}`); break; }
    if (!f.type.startsWith('image/')) { errors.push(`${f.name}: ${T('err.notImg','không phải file ảnh.')}`); continue; }
    if (f.size > MAX_BYTES) { errors.push(`${f.name}: ${T('err.tooBig','lớn hơn 40 MB.')}`); continue; }
    items.push({ file: f, thumb: URL.createObjectURL(f) });
  }
  const box = $('#img-error');
  box.textContent = errors.slice(0, 5).join(' ');
  box.hidden = !errors.length;
  render();
}

function outName(file: File, ext: string): string {
  const base = file.name.replace(/\.[^.]+$/, '') || 'anh';
  return `${base}.${ext}`;
}

async function processOne(item: Item): Promise<void> {
  const fmt = $<HTMLSelectElement>('#format').value;
  const quality = Number($<HTMLInputElement>('#quality').value) / 100;
  const maxW = Number($<HTMLInputElement>('#max-w').value) || Infinity;
  const maxH = Number($<HTMLInputElement>('#max-h').value) || Infinity;
  const srcKey = Object.keys(FORMATS).find((k) => FORMATS[k].mime === item.file.type);
  const target = FORMATS[fmt === 'keep' ? (srcKey ?? 'jpeg') : fmt];

  const bitmap = await createImageBitmap(item.file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  try {
    const scale = Math.min(1, maxW / bitmap.width, maxH / bitmap.height);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(T('err.noCanvas','Trình duyệt không hỗ trợ xử lý ảnh.'));
    if (target.mime === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, target.mime, quality));
    if (!blob) throw new Error(T('err.noBlob','Không tạo được ảnh.'));
    if (blob.type !== target.mime) throw new Error(`${T('err.noExport','Trình duyệt này không hỗ trợ xuất')} ${target.label}.`);
    // Ảnh đã tối ưu sẵn: kết quả không nhẹ hơn, cùng định dạng, không đổi kích thước thì giữ ảnh gốc
    const sameFormat = item.file.type === target.mime;
    if (sameFormat && scale === 1 && blob.size >= item.file.size) {
      item.result = { blob: item.file, name: outName(item.file, target.ext), width: w, height: h, keptOriginal: true };
    } else {
      item.result = { blob, name: outName(item.file, target.ext), width: w, height: h, keptOriginal: false };
    }
    item.error = undefined;
  } finally {
    bitmap.close();
  }
}

async function runAll(): Promise<void> {
  const btn = $<HTMLButtonElement>('#run');
  btn.disabled = true;
  for (let i = 0; i < items.length; i++) {
    btn.textContent = `${T('processing','Đang xử lý')} ${i + 1}/${items.length}…`;
    try {
      await processOne(items[i]);
    } catch (e) {
      items[i].result = undefined;
      items[i].error = (e as Error).message || T('err.readImg','Không đọc được ảnh.');
    }
    render();
  }
  btn.textContent = T('run','Xử lý ảnh');
  btn.disabled = false;
  const done = items.filter((x) => x.result).length;
  toast(`${T('toast.done','Đã xử lý')} ${done}/${items.length} ${T('images','ảnh')}`);
}

function render(): void {
  const done = items.filter((x) => x.result);
  const before = done.reduce((s, x) => s + x.file.size, 0);
  const after = done.reduce((s, x) => s + (x.result as NonNullable<Item['result']>).blob.size, 0);
  $('#img-summary').innerHTML = items.length
    ? `<div class="stat"><span class="stat-label">${T('stat.count','Số ảnh')}</span><span class="stat-value">${items.length}</span></div>
       <div class="stat"><span class="stat-label">${T('stat.origSize','Tổng dung lượng gốc')}</span><span class="stat-value">${fmtSize(items.reduce((s, x) => s + x.file.size, 0))}</span></div>
       ${done.length ? `<div class="stat stat--main"><span class="stat-label">${T('stat.after','Sau xử lý')} (${done.length} ${T('images','ảnh')})</span><span class="stat-value">${fmtSize(after)}</span><span class="stat-label">${T('stat.reduced','Giảm')} ${before ? Math.max(0, Math.round((1 - after / before) * 100)) : 0}%</span></div>` : ''}`
    : '';
  $<HTMLButtonElement>('#run').disabled = !items.length;
  $<HTMLButtonElement>('#clear').disabled = !items.length;
  $<HTMLButtonElement>('#zip').disabled = !done.length;

  $('#img-list').innerHTML = items.length
    ? `<thead><tr><th>${T('th.img','Ảnh')}</th><th>${T('th.orig','Gốc')}</th><th>${T('th.after','Sau xử lý')}</th><th>${T('th.size','Kích thước')}</th><th></th></tr></thead><tbody>${items
        .map((x, i) => {
          const r = x.result;
          const change = r ? Math.round((1 - r.blob.size / x.file.size) * 100) : 0;
          const after = x.error
            ? `<span class="error-text">${escapeHtml(x.error)}</span>`
            : r
              ? `${fmtSize(r.blob.size)} <span class="${change > 0 ? 'ok-text' : 'note'}">${r.keptOriginal ? T('alreadyOpt','(đã tối ưu sẵn)') : change >= 0 ? `−${change}%` : `+${-change}%`}</span>`
              : '—';
          return `<tr>
            <td><span class="img-cell"><img src="${x.thumb}" alt="" loading="lazy" /><span>${escapeHtml(x.file.name)}</span></span></td>
            <td>${fmtSize(x.file.size)}</td><td>${after}</td><td>${r ? `${r.width}×${r.height}` : '—'}</td>
            <td>${r ? `<button type="button" class="btn btn-sm" data-dl="${i}">${T('dl','Tải về')}</button>` : ''}</td></tr>`;
        })
        .join('')}</tbody>`
    : '';
}

const input = $<HTMLInputElement>('#files');
input.addEventListener('change', () => {
  if (input.files) addFiles(input.files);
  input.value = '';
});
const drop = $('#drop');
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('is-over')));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer?.files) addFiles(e.dataTransfer.files);
});

$('#quality').addEventListener('input', () => ($('#q-out').textContent = $<HTMLInputElement>('#quality').value));
// Đổi cài đặt thì kết quả cũ không còn đúng
$('#img-form').addEventListener('change', () => {
  items.forEach((x) => { x.result = undefined; x.error = undefined; });
  render();
});
$('#run').addEventListener('click', () => void runAll());
$('#clear').addEventListener('click', () => {
  items.forEach((x) => URL.revokeObjectURL(x.thumb));
  items = [];
  render();
});
$('#img-list').addEventListener('click', (e) => {
  const i = (e.target as HTMLElement).closest<HTMLElement>('[data-dl]')?.dataset.dl;
  const r = i !== undefined ? items[Number(i)]?.result : undefined;
  if (r) downloadBlob(r.blob, r.name);
});
$('#zip').addEventListener('click', async () => {
  const done = items.filter((x) => x.result);
  if (typeof JSZip === 'undefined') {
    toast(T('toast.noZip','Không nạp được công cụ nén zip, đang tải từng ảnh'));
    done.forEach((x, k) => setTimeout(() => downloadBlob(x.result!.blob, x.result!.name), k * 400));
    return;
  }
  const zip = new JSZip();
  const used = new Set<string>();
  done.forEach((x) => {
    let name = x.result!.name;
    for (let n = 2; used.has(name); n++) name = x.result!.name.replace(/(\.[^.]+)$/, `-${n}$1`);
    used.add(name);
    zip.file(name, x.result!.blob);
  });
  downloadBlob(await zip.generateAsync({ type: 'blob' }), 'anh-da-xu-ly.zip');
});
render();
