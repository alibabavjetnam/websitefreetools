import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml, toast } from '../ui';
import { MAX_IMAGE_BYTES, canEncode, canvasToBlob, drawToCanvas, encodeBmp, encodeIco, fmtBytes, loadImage, renameFile } from '../lib/image';
import { pageText } from '../i18n';

mountLayout({ activeTool: 'image-format' });
const T = pageText();

declare const JSZip: (new () => { file(name: string, data: Blob): void; generateAsync(o: { type: 'blob' }): Promise<Blob> }) | undefined;

interface Target { id: string; label: string; hint: string; mime: string; ext: string; quality: boolean; opaque: boolean }
const TARGETS: Target[] = [
  { id: 'webp', label: 'WebP', hint: 'Nhẹ, giữ nền trong suốt. Nên dùng cho website.', mime: 'image/webp', ext: 'webp', quality: true, opaque: false },
  { id: 'jpg', label: 'JPG', hint: 'Phổ biến nhất, hợp ảnh chụp. Không có nền trong suốt.', mime: 'image/jpeg', ext: 'jpg', quality: true, opaque: true },
  { id: 'png', label: 'PNG', hint: 'Không mất chất lượng, giữ nền trong suốt. Hợp logo, ảnh chụp màn hình.', mime: 'image/png', ext: 'png', quality: false, opaque: false },
  { id: 'avif', label: 'AVIF', hint: 'Nhẹ nhất, nhưng phần mềm cũ có thể chưa mở được.', mime: 'image/avif', ext: 'avif', quality: true, opaque: false },
  { id: 'bmp', label: 'BMP', hint: 'Không nén, dung lượng lớn. Dùng cho phần mềm cũ, máy in, máy cắt.', mime: 'image/bmp', ext: 'bmp', quality: false, opaque: true },
  { id: 'ico', label: 'ICO (favicon)', hint: 'Biểu tượng website, gồm nhiều kích thước trong một file.', mime: 'image/x-icon', ext: 'ico', quality: false, opaque: false },
];
const ICO_SIZES = [16, 32, 48, 64, 128, 256];
const available = TARGETS.filter((t) => t.id !== 'avif' || canEncode('image/avif'));

$('#tool-root').innerHTML = `
  <div class="workspace tool-body">
    <div class="panel">
      <label class="dropzone" id="drop">
        <input type="file" id="files" accept="image/*,.heic,.heif" multiple />
        <b>${T('drop.title','Chọn ảnh hoặc kéo thả vào đây')}</b>
        <span>${T('drop.hint','Nhận JPG, PNG, WebP, GIF, BMP, AVIF, SVG, ICO. Tối đa 100 ảnh, mỗi ảnh dưới 40 MB.')}</span>
      </label>
      <form id="fmt-form" class="form-grid" novalidate>
        <fieldset class="field span-all">
          <legend>${T('convertTo','Đổi sang định dạng')}</legend>
          <div class="format-list" id="targets">
            ${available.map((t, i) => `<label class="format-option"><input type="radio" name="target" value="${t.id}"${i === 0 ? ' checked' : ''} /><span class="format-name">${t.label}</span></label>`).join('')}
          </div>
          <span class="field-hint" id="target-hint"></span>
        </fieldset>
        <label class="field" id="f-quality"><span class="field-label">${T('quality','Chất lượng')}: <output id="q-out">85</output>%</span><input type="range" id="quality" min="40" max="100" value="85" /></label>
        <label class="field" id="f-bg"><span class="color"><input type="color" id="bg" value="#ffffff" /><span>${T('bgFill','Màu lót cho phần trong suốt')}</span></span></label>
        <fieldset class="field span-all" id="f-ico" hidden>
          <legend>${T('icoSizes','Kích thước trong file ICO')}</legend>
          <div class="row">${ICO_SIZES.map((s) => `<label class="check"><input type="checkbox" data-ico="${s}"${s <= 48 ? ' checked' : ''} /><span>${s}×${s}</span></label>`).join('')}</div>
        </fieldset>
      </form>
      ${canEncode('image/avif') ? '' : `<p class="note">${T('avifNote','Trình duyệt này chưa xuất được AVIF. Dùng Chrome hoặc Edge bản mới để có thêm lựa chọn này.')}</p>`}
    </div>
    <section class="preview">
      <div class="stat-grid" id="summary"></div>
      <div class="actions">
        <button type="button" class="btn btn-primary" id="run" disabled>${T('run','Chuyển đổi')}</button>
        <button type="button" class="btn" id="zip" disabled>${T('zip','Tải tất cả (.zip)')}</button>
        <button type="button" class="btn" id="clear" disabled>${T('clear','Xoá danh sách')}</button>
      </div>
      <p class="error" id="err" hidden></p>
    </section>
  </div>
  <div class="table-wrap" style="margin-top:24px"><table class="data-table" id="list"></table></div>
`;

interface Item { file: File; thumb: string; out?: { blob: Blob; name: string; w: number; h: number }; error?: string }
let items: Item[] = [];
const target = () => available.find((t) => t.id === ($('#fmt-form').querySelector<HTMLInputElement>('input[name="target"]:checked')?.value ?? 'webp')) as Target;

function syncOptions(): void {
  const t = target();
  $('#target-hint').textContent = T('hint.' + t.id, t.hint);
  $('#f-quality').hidden = !t.quality;
  $('#f-bg').hidden = !t.opaque;
  $('#f-ico').hidden = t.id !== 'ico';
}

function addFiles(list: FileList | File[]): void {
  const errs: string[] = [];
  for (const f of [...list]) {
    if (items.length >= 100) { errs.push(T('err.max','Chỉ nhận tối đa 100 ảnh mỗi lần.')); break; }
    if (!f.type.startsWith('image/') && !/\.(heic|heif)$/i.test(f.name)) { errs.push(`${f.name}: ${T('err.notImg','không phải file ảnh.')}`); continue; }
    if (f.size > MAX_IMAGE_BYTES) { errs.push(`${f.name}: ${T('err.tooBig','lớn hơn 40 MB.')}`); continue; }
    items.push({ file: f, thumb: URL.createObjectURL(f) });
  }
  $('#err').textContent = errs.slice(0, 4).join(' ');
  $('#err').hidden = !errs.length;
  render();
}

async function convert(item: Item): Promise<void> {
  const t = target();
  const img = await loadImage(item.file);
  try {
    let blob: Blob;
    if (t.id === 'ico') {
      const sizes = [...document.querySelectorAll<HTMLInputElement>('[data-ico]')].filter((c) => c.checked).map((c) => Number(c.dataset.ico));
      if (!sizes.length) throw new Error(T('err.icoSize','Hãy chọn ít nhất một kích thước cho file ICO.'));
      blob = await encodeIco(img, sizes);
    } else {
      const canvas = drawToCanvas(img, img.width, img.height, t.opaque ? $<HTMLInputElement>('#bg').value : undefined);
      blob = t.id === 'bmp' ? encodeBmp(canvas) : await canvasToBlob(canvas, t.mime, t.quality ? Number($<HTMLInputElement>('#quality').value) / 100 : undefined);
    }
    item.out = { blob, name: renameFile(item.file.name, t.ext), w: img.width, h: img.height };
    item.error = undefined;
  } finally {
    img.close();
  }
}

async function runAll(): Promise<void> {
  const btn = $<HTMLButtonElement>('#run');
  btn.disabled = true;
  for (let i = 0; i < items.length; i++) {
    btn.textContent = `${T('converting','Đang chuyển')} ${i + 1}/${items.length}…`;
    try {
      await convert(items[i]);
    } catch (e) {
      items[i].out = undefined;
      items[i].error = (e as Error).message;
    }
    render();
  }
  btn.textContent = T('run','Chuyển đổi');
  btn.disabled = false;
  toast(`${T('toast.converted','Đã chuyển')} ${items.filter((x) => x.out).length}/${items.length} ${T('toast.imagesTo','ảnh sang')} ${target().label}`);
}

function render(): void {
  const done = items.filter((x) => x.out);
  $('#summary').innerHTML = items.length
    ? `<div class="stat"><span class="stat-label">${T('stat.count','Số ảnh')}</span><span class="stat-value">${items.length}</span></div>
       ${done.length ? `<div class="stat stat--main"><span class="stat-label">${T('stat.done','Đã chuyển xong')}</span><span class="stat-value">${done.length} ${T('images','ảnh')}, ${fmtBytes(done.reduce((s, x) => s + x.out!.blob.size, 0))}</span></div>` : ''}`
    : '';
  $<HTMLButtonElement>('#run').disabled = !items.length;
  $<HTMLButtonElement>('#clear').disabled = !items.length;
  $<HTMLButtonElement>('#zip').disabled = !done.length;
  $('#list').innerHTML = items.length
    ? `<thead><tr><th>${T('th.img','Ảnh')}</th><th>${T('th.orig','Gốc')}</th><th>${T('th.result','Kết quả')}</th><th>${T('th.size','Kích thước')}</th><th></th></tr></thead><tbody>${items
        .map((x, i) => `<tr><td><span class="img-cell"><img src="${x.thumb}" alt="" loading="lazy" /><span>${escapeHtml(x.file.name)}</span></span></td>
          <td>${fmtBytes(x.file.size)}</td>
          <td>${x.error ? `<span class="error-text">${escapeHtml(x.error)}</span>` : x.out ? `${escapeHtml(x.out.name)}, ${fmtBytes(x.out.blob.size)}` : '—'}</td>
          <td>${x.out ? `${x.out.w}×${x.out.h}` : '—'}</td>
          <td>${x.out ? `<button type="button" class="btn btn-sm" data-dl="${i}">${T('dl','Tải về')}</button>` : ''}</td></tr>`)
        .join('')}</tbody>`
    : '';
}

const input = $<HTMLInputElement>('#files');
input.addEventListener('change', () => { if (input.files) addFiles(input.files); input.value = ''; });
const drop = $('#drop');
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('is-over')));
drop.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer?.files) addFiles(e.dataTransfer.files); });

$('#quality').addEventListener('input', () => ($('#q-out').textContent = $<HTMLInputElement>('#quality').value));
$('#fmt-form').addEventListener('change', () => {
  syncOptions();
  items.forEach((x) => { x.out = undefined; x.error = undefined; });
  render();
});
$('#fmt-form').addEventListener('submit', (e) => e.preventDefault());
$('#run').addEventListener('click', () => void runAll());
$('#clear').addEventListener('click', () => { items.forEach((x) => URL.revokeObjectURL(x.thumb)); items = []; render(); });
$('#list').addEventListener('click', (e) => {
  const i = (e.target as HTMLElement).closest<HTMLElement>('[data-dl]')?.dataset.dl;
  const out = i !== undefined ? items[Number(i)]?.out : undefined;
  if (out) downloadBlob(out.blob, out.name);
});
$('#zip').addEventListener('click', async () => {
  const done = items.filter((x) => x.out);
  if (typeof JSZip === 'undefined') {
    done.forEach((x, k) => setTimeout(() => downloadBlob(x.out!.blob, x.out!.name), k * 400));
    return;
  }
  const zip = new JSZip();
  const used = new Set<string>();
  done.forEach((x) => {
    let name = x.out!.name;
    for (let n = 2; used.has(name); n++) name = x.out!.name.replace(/(\.[^.]+)$/, `-${n}$1`);
    used.add(name);
    zip.file(name, x.out!.blob);
  });
  downloadBlob(await zip.generateAsync({ type: 'blob' }), `anh-${target().ext}.zip`);
});

syncOptions();
render();
