import { mountLayout } from '../layout';
import { $, downloadBlob, fmtInt, toast } from '../ui';
import { pageText } from '../i18n';
import { loadImage, canvasToBlob, MAX_IMAGE_BYTES } from '../lib/image';
import { bindDropzone, baseName, fmtSize } from '../lib/files';

mountLayout({ activeTool: 'image-crop' });
const T = pageText();

const RATIOS: [string, number, string][] = [
  ['free', 0, T('rFree', 'Tự do')], ['1:1', 1, '1:1'], ['4:3', 4 / 3, '4:3'], ['3:4', 3 / 4, '3:4'], ['3:2', 3 / 2, '3:2'], ['2:3', 2 / 3, '2:3'],
  ['16:9', 16 / 9, '16:9'], ['9:16', 9 / 16, '9:16'], ['4:5', 4 / 5, '4:5'], ['circle', 1, T('rCircle', 'Tròn')],
];

$('#tool-root').innerHTML = `
  <label class="dropzone" id="drop" style="margin-top:28px">
    <input type="file" id="file" accept="image/*" />
    <b>${T('dropTitle', 'Chọn ảnh hoặc kéo thả vào đây')}</b>
    <span>${T('dropHint', 'JPG, PNG, WebP, GIF, BMP, SVG; dưới 40 MB. Có thể dán ảnh bằng Ctrl+V.')}</span>
  </label>
  <div class="workspace" id="work" hidden>
    <section class="panel" style="padding:12px">
      <div class="crop-stage" id="stage"><canvas id="cv"></canvas><div class="crop-box" id="box">${['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((h) => `<span class="crop-handle" data-h="${h}"></span>`).join('')}</div></div>
      <div class="row" style="justify-content:center">
        <button type="button" class="btn btn-sm" id="rotL" title="${T('rotL', 'Xoay trái 90°')}">⟲ 90°</button>
        <button type="button" class="btn btn-sm" id="rotR" title="${T('rotR', 'Xoay phải 90°')}">⟳ 90°</button>
        <button type="button" class="btn btn-sm" id="flipH">${T('flipH', 'Lật ngang')}</button>
        <button type="button" class="btn btn-sm" id="flipV">${T('flipV', 'Lật dọc')}</button>
        <button type="button" class="btn btn-sm" id="reset">${T('reset', 'Chọn lại cả ảnh')}</button>
      </div>
    </section>
    <section class="panel">
      <fieldset class="field"><legend>${T('ratio', 'Tỉ lệ khung cắt')}</legend>
        <div class="row" id="ratios">${RATIOS.map(([id, , l]) => `<button type="button" class="btn btn-sm" data-r="${id}">${l}</button>`).join('')}</div>
      </fieldset>
      <div class="field-row">
        <label class="field"><span class="field-label">X</span><input type="number" id="x" min="0" /></label>
        <label class="field"><span class="field-label">Y</span><input type="number" id="y" min="0" /></label>
        <label class="field"><span class="field-label">${T('w', 'Rộng')}</span><input type="number" id="w" min="1" /></label>
        <label class="field"><span class="field-label">${T('h', 'Cao')}</span><input type="number" id="h" min="1" /></label>
      </div>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('format', 'Định dạng')}</span><select id="format"><option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option></select></label>
        <label class="field"><span class="field-label">${T('outW', 'Đổi chiều rộng khi lưu (px, tuỳ chọn)')}</span><input type="number" id="outw" min="1" max="20000" placeholder="${T('keepSize', 'Giữ nguyên')}" /></label>
      </div>
      <div class="stat"><span class="stat-label">${T('result', 'Ảnh sau khi cắt')}</span><span class="stat-value" id="size">—</span></div>
      <div class="actions">
        <button type="button" class="btn btn-primary" id="save">${T('download', 'Cắt và tải về')}</button>
        <button type="button" class="btn" id="other">${T('other', 'Chọn ảnh khác')}</button>
      </div>
      <p class="note">${T('tip', 'Kéo khung để di chuyển, kéo các ô vuông ở góc/cạnh để đổi cỡ. Phím mũi tên dịch khung 1 px (giữ Shift: 10 px). Ảnh tròn được lưu PNG nền trong suốt.')}</p>
    </section>
  </div>
`;

const cv = $<HTMLCanvasElement>('#cv');
const box = $('#box');
let src: HTMLCanvasElement | null = null; // ảnh sau khi xoay/lật, độ phân giải gốc
let file: File | null = null;
let ratioId = 'free';
let r = { x: 0, y: 0, w: 0, h: 0 }; // khung cắt theo pixel ảnh
const ratio = () => (RATIOS.find((x) => x[0] === ratioId) as [string, number, string])[1];

async function open(f: File): Promise<void> {
  if (!f.type.startsWith('image/')) { toast(T('notImage', 'File này không phải ảnh.')); return; }
  if (f.size > MAX_IMAGE_BYTES) { toast(T('tooBig', 'Ảnh lớn hơn 40 MB.')); return; }
  try {
    const img = await loadImage(f);
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    (c.getContext('2d') as CanvasRenderingContext2D).drawImage(img.source, 0, 0);
    img.close();
    src = c;
    file = f;
    $('#drop').hidden = true;
    $('#work').hidden = false;
    $<HTMLSelectElement>('#format').value = f.type === 'image/jpeg' ? 'image/jpeg' : f.type === 'image/webp' ? 'image/webp' : 'image/png';
    paint();
    resetBox();
  } catch (e) {
    toast((e as Error).message);
  }
}

function paint(): void {
  if (!src) return;
  cv.width = src.width;
  cv.height = src.height;
  (cv.getContext('2d') as CanvasRenderingContext2D).drawImage(src, 0, 0);
}

function resetBox(): void {
  if (!src) return;
  const W = src.width, H = src.height;
  const a = ratio();
  if (!a) r = { x: 0, y: 0, w: W, h: H };
  else {
    let w = W, h = w / a;
    if (h > H) { h = H; w = h * a; }
    r = { x: (W - w) / 2, y: (H - h) / 2, w, h };
  }
  update();
}

/** Giới hạn khung trong ảnh, làm tròn pixel, cập nhật ô nhập và lớp phủ */
function update(fromInputs = false): void {
  if (!src) return;
  const W = src.width, H = src.height;
  r.w = Math.max(1, Math.min(W, r.w));
  r.h = Math.max(1, Math.min(H, r.h));
  r.x = Math.max(0, Math.min(W - r.w, r.x));
  r.y = Math.max(0, Math.min(H - r.h, r.y));
  const k = cv.clientWidth / W || 1;
  const off = cv.offsetLeft;
  Object.assign(box.style, { left: `${off + r.x * k}px`, top: `${cv.offsetTop + r.y * k}px`, width: `${r.w * k}px`, height: `${r.h * k}px`, borderRadius: ratioId === 'circle' ? '50%' : '0' });
  if (!fromInputs) {
    $<HTMLInputElement>('#x').value = String(Math.round(r.x));
    $<HTMLInputElement>('#y').value = String(Math.round(r.y));
    $<HTMLInputElement>('#w').value = String(Math.round(r.w));
    $<HTMLInputElement>('#h').value = String(Math.round(r.h));
  }
  const ow = Number($<HTMLInputElement>('#outw').value) || 0;
  const outW = ow || Math.round(r.w);
  const outH = ow ? Math.round((r.h * ow) / r.w) : Math.round(r.h);
  $('#size').textContent = `${fmtInt(outW)} × ${fmtInt(outH)} px`;
  document.querySelectorAll<HTMLButtonElement>('[data-r]').forEach((b) => b.classList.toggle('btn-primary', b.dataset.r === ratioId));
}

// ---- Kéo / đổi cỡ khung
let drag: { mode: string; px: number; py: number; r0: typeof r } | null = null;
box.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  box.setPointerCapture(e.pointerId);
  const h = (e.target as HTMLElement).dataset.h ?? 'move';
  drag = { mode: h, px: e.clientX, py: e.clientY, r0: { ...r } };
});
box.addEventListener('pointermove', (e) => {
  if (!drag || !src) return;
  const k = cv.clientWidth / src.width;
  const dx = (e.clientX - drag.px) / k;
  const dy = (e.clientY - drag.py) / k;
  const o = drag.r0;
  const m = drag.mode;
  if (m === 'move') { r.x = o.x + dx; r.y = o.y + dy; update(); return; }
  let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
  if (m.includes('w')) x1 = Math.min(x2 - 8, o.x + dx);
  if (m.includes('e')) x2 = Math.max(x1 + 8, o.x + o.w + dx);
  if (m.includes('n')) y1 = Math.min(y2 - 8, o.y + dy);
  if (m.includes('s')) y2 = Math.max(y1 + 8, o.y + o.h + dy);
  x1 = Math.max(0, x1); y1 = Math.max(0, y1); x2 = Math.min(src.width, x2); y2 = Math.min(src.height, y2);
  let w = x2 - x1, h = y2 - y1;
  const a = ratio();
  if (a) {
    // Giữ tỉ lệ: lấy cạnh thay đổi nhiều hơn làm chuẩn, neo theo góc đối diện
    if (m === 'n' || m === 's') w = h * a;
    else if (m === 'e' || m === 'w') h = w / a;
    else if (w / h > a) w = h * a; else h = w / a;
    if (m.includes('w')) x1 = x2 - w;
    if (m.includes('n')) y1 = y2 - h;
    if (x1 < 0 || y1 < 0 || x1 + w > src.width || y1 + h > src.height) return;
  }
  r = { x: x1, y: y1, w, h };
  update();
});
['pointerup', 'pointercancel'].forEach((ev) => box.addEventListener(ev, () => (drag = null)));
document.addEventListener('keydown', (e) => {
  if (!src || $('#work').hidden || (e.target as HTMLElement).tagName === 'INPUT') return;
  const step = e.shiftKey ? 10 : 1;
  const map: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (!map[e.key]) return;
  e.preventDefault();
  r.x += map[e.key][0];
  r.y += map[e.key][1];
  update();
});
new ResizeObserver(() => update()).observe(cv);

// ---- Xoay, lật
function transform(kind: 'L' | 'R' | 'H' | 'V'): void {
  if (!src) return;
  const c = document.createElement('canvas');
  const rot = kind === 'L' || kind === 'R';
  c.width = rot ? src.height : src.width;
  c.height = rot ? src.width : src.height;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  if (kind === 'R') { ctx.translate(c.width, 0); ctx.rotate(Math.PI / 2); }
  if (kind === 'L') { ctx.translate(0, c.height); ctx.rotate(-Math.PI / 2); }
  if (kind === 'H') { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
  if (kind === 'V') { ctx.translate(0, c.height); ctx.scale(1, -1); }
  ctx.drawImage(src, 0, 0);
  src = c;
  paint();
  resetBox();
}
$('#rotL').addEventListener('click', () => transform('L'));
$('#rotR').addEventListener('click', () => transform('R'));
$('#flipH').addEventListener('click', () => transform('H'));
$('#flipV').addEventListener('click', () => transform('V'));
$('#reset').addEventListener('click', () => { ratioId = 'free'; resetBox(); });
$('#ratios').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-r]');
  if (!b) return;
  ratioId = b.dataset.r as string;
  if (ratioId === 'circle') $<HTMLSelectElement>('#format').value = 'image/png';
  resetBox();
});
['x', 'y', 'w', 'h'].forEach((id) => $('#' + id).addEventListener('input', () => {
  const v = (k: string) => Number($<HTMLInputElement>('#' + k).value) || 0;
  r = { x: v('x'), y: v('y'), w: v('w'), h: v('h') };
  const a = ratio();
  if (a && id === 'w') r.h = r.w / a;
  if (a && id === 'h') r.w = r.h * a;
  update(id === 'x' || id === 'y');
}));
$('#outw').addEventListener('input', () => update());
$('#other').addEventListener('click', () => { $('#work').hidden = true; $('#drop').hidden = false; src = null; });

$('#save').addEventListener('click', async () => {
  if (!src || !file) return;
  const ow = Number($<HTMLInputElement>('#outw').value) || 0;
  const W = ow || Math.round(r.w);
  const H = ow ? Math.round((r.h * ow) / r.w) : Math.round(r.h);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  let mime = $<HTMLSelectElement>('#format').value;
  if (ratioId === 'circle') {
    mime = 'image/png';
    ctx.beginPath();
    ctx.ellipse(W / 2, H / 2, W / 2, H / 2, 0, 0, Math.PI * 2);
    ctx.clip();
  } else if (mime === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, W, H);
  const blob = await canvasToBlob(c, mime, 0.92);
  const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';
  downloadBlob(blob, `${baseName(file.name)}-${T('cropped', 'da-cat')}.${ext}`);
  toast(`${T('saved', 'Đã lưu')} ${W}×${H} · ${fmtSize(blob.size)}`);
});
bindDropzone($('#drop'), $<HTMLInputElement>('#file'), (f) => void open(f[0]));
// Dán ảnh từ clipboard (Ctrl+V)
document.addEventListener('paste', (e) => {
  const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'));
  if (f) void open(f);
});
