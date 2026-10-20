import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml, storage, toast } from '../ui';
import { MAX_IMAGE_BYTES, canvasToBlob, drawToCanvas, fmtBytes, loadImage, renameFile, type LoadedImage } from '../lib/image';

mountLayout({ activeTool: 'watermark' });

declare const JSZip: (new () => { file(name: string, data: Blob): void; generateAsync(o: { type: 'blob' }): Promise<Blob> }) | undefined;

type Pos = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br' | 'tile';
const POS_LABEL: Record<Pos, string> = { tl: '↖', tc: '↑', tr: '↗', ml: '←', mc: '•', mr: '→', bl: '↙', bc: '↓', br: '↘', tile: 'Lặp kín' };

interface Settings { kind: 'text' | 'logo'; text: string; color: string; size: number; opacity: number; bold: boolean; outline: boolean; logoSize: number; pos: Pos; margin: number; angle: number }
const prefs = storage<Settings>('watermark', { kind: 'text', text: '© websitefreetools.com', color: '#ffffff', size: 5, opacity: 60, bold: true, outline: true, logoSize: 20, pos: 'br', margin: 3, angle: -30 });
const logoPref = storage<string>('watermark-logo', '');
let s: Settings = prefs.get();

$('#tool-root').innerHTML = `
  <div class="workspace tool-body">
    <form class="panel" id="wm-form" novalidate>
      <label class="dropzone" id="drop">
        <input type="file" id="files" accept="image/png,image/jpeg,image/webp,image/avif,image/bmp" multiple />
        <b>Chọn ảnh hoặc kéo thả vào đây</b>
        <span>Một hoặc nhiều ảnh, mỗi ảnh dưới 40 MB. Watermark được áp cho tất cả.</span>
      </label>
      <div class="segmented" role="radiogroup" aria-label="Loại watermark">
        <label><input type="radio" name="kind" value="text" /><span>Chữ</span></label>
        <label><input type="radio" name="kind" value="logo" /><span>Logo</span></label>
      </div>
      <div id="text-opts" class="form-grid">
        <label class="field span-all"><span class="field-label">Nội dung</span><input id="text" type="text" maxlength="120" /></label>
        <label class="field"><span class="field-label">Cỡ chữ: <output id="size-out"></output>% chiều rộng</span><input id="size" type="range" min="1" max="20" step="0.5" /></label>
        <label class="field"><span class="color"><input type="color" id="color" /><span>Màu chữ</span></span></label>
        <label class="check"><input type="checkbox" id="bold" /><span>Chữ đậm</span></label>
        <label class="check"><input type="checkbox" id="outline" /><span>Viền tối quanh chữ (dễ đọc trên nền sáng)</span></label>
      </div>
      <div id="logo-opts" class="form-grid" hidden>
        <label class="field span-all"><span class="field-label">Ảnh logo (nên dùng PNG nền trong suốt, tối đa 2 MB)</span><input id="logo" type="file" accept="image/png,image/webp,image/jpeg,image/svg+xml" /></label>
        <label class="field span-all"><span class="field-label">Chiều rộng logo: <output id="logo-out"></output>% chiều rộng ảnh</span><input id="logo-size" type="range" min="5" max="60" /></label>
      </div>
      <div class="form-grid">
        <label class="field span-all"><span class="field-label">Độ rõ: <output id="op-out"></output>%</span><input id="opacity" type="range" min="10" max="100" step="5" /></label>
      </div>
      <fieldset class="field">
        <legend>Vị trí</legend>
        <div class="pos-grid" id="pos">${(Object.keys(POS_LABEL) as Pos[]).map((p) => `<button type="button" data-pos="${p}" class="${p === 'tile' ? 'pos-tile' : ''}" aria-label="${p === 'tile' ? 'Lặp kín ảnh' : 'Vị trí ' + p}">${POS_LABEL[p]}</button>`).join('')}</div>
      </fieldset>
      <div class="form-grid">
        <label class="field" id="f-margin"><span class="field-label">Cách lề: <output id="margin-out"></output>%</span><input id="margin" type="range" min="0" max="15" step="0.5" /></label>
        <label class="field" id="f-angle"><span class="field-label">Góc xoay: <output id="angle-out"></output>°</span><input id="angle" type="range" min="-90" max="90" step="5" /></label>
      </div>
    </form>
    <section class="preview">
      <div class="bg-stage" id="stage"><p class="note">Chọn ảnh để xem trước watermark.</p></div>
      <div class="actions">
        <button type="button" class="btn btn-primary" id="run" disabled>Áp watermark và tải về</button>
      </div>
      <p class="note" id="info" aria-live="polite"></p>
      <div class="table-wrap"><table class="data-table" id="list"></table></div>
    </section>
  </div>
`;

let files: File[] = [];
let previewImg: LoadedImage | null = null;
let logo: LoadedImage | null = null;

/** Vẽ watermark lên canvas đã có ảnh; dùng chung cho xem trước và xuất file */
function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.globalAlpha = s.opacity / 100;
  const margin = (Math.min(w, h) * s.margin) / 100;
  let boxW: number;
  let boxH: number;
  let paint: (x: number, y: number) => void;

  if (s.kind === 'logo') {
    if (!logo) { ctx.restore(); return; }
    boxW = (w * s.logoSize) / 100;
    boxH = (boxW * logo.height) / logo.width;
    const lg = logo;
    paint = (x, y) => ctx.drawImage(lg.source, x, y, boxW, boxH);
  } else {
    const text = s.text.trim();
    if (!text) { ctx.restore(); return; }
    const fontSize = Math.max(8, (w * s.size) / 100);
    ctx.font = `${s.bold ? 700 : 500} ${fontSize}px 'Be Vietnam Pro', system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    boxW = ctx.measureText(text).width;
    boxH = fontSize * 1.2;
    paint = (x, y) => {
      if (s.outline) {
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(2, fontSize / 10);
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.strokeText(text, x, y + fontSize * 0.1);
      }
      ctx.fillStyle = s.color;
      ctx.fillText(text, x, y + fontSize * 0.1);
    };
  }

  if (s.pos === 'tile') {
    // Lặp kín: xoay quanh tâm ảnh, phủ theo đường chéo để không hở góc
    ctx.translate(w / 2, h / 2);
    ctx.rotate((s.angle * Math.PI) / 180);
    const diag = Math.hypot(w, h);
    const stepX = boxW * 1.8;
    const stepY = boxH * 3;
    for (let y = -diag / 2; y < diag / 2; y += stepY)
      for (let x = -diag / 2 + ((Math.round(y / stepY) % 2) * stepX) / 2; x < diag / 2; x += stepX) paint(x, y);
  } else {
    const col = s.pos[1];
    const row = s.pos[0];
    const x = col === 'l' ? margin : col === 'r' ? w - boxW - margin : (w - boxW) / 2;
    const y = row === 't' ? margin : row === 'b' ? h - boxH - margin : (h - boxH) / 2;
    paint(x, y);
  }
  ctx.restore();
}

function fillForm(): void {
  document.querySelectorAll<HTMLInputElement>('input[name="kind"]').forEach((r) => (r.checked = r.value === s.kind));
  $<HTMLInputElement>('#text').value = s.text;
  $<HTMLInputElement>('#color').value = s.color;
  $<HTMLInputElement>('#size').value = String(s.size);
  $<HTMLInputElement>('#opacity').value = String(s.opacity);
  $<HTMLInputElement>('#bold').checked = s.bold;
  $<HTMLInputElement>('#outline').checked = s.outline;
  $<HTMLInputElement>('#logo-size').value = String(s.logoSize);
  $<HTMLInputElement>('#margin').value = String(s.margin);
  $<HTMLInputElement>('#angle').value = String(s.angle);
  syncLabels();
}

function syncLabels(): void {
  $('#size-out').textContent = String(s.size);
  $('#op-out').textContent = String(s.opacity);
  $('#logo-out').textContent = String(s.logoSize);
  $('#margin-out').textContent = String(s.margin);
  $('#angle-out').textContent = String(s.angle);
  $('#text-opts').hidden = s.kind !== 'text';
  $('#logo-opts').hidden = s.kind !== 'logo';
  $('#f-margin').hidden = s.pos === 'tile';
  $('#f-angle').hidden = s.pos !== 'tile';
  document.querySelectorAll<HTMLElement>('[data-pos]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pos === s.pos)));
}

function readForm(): void {
  s = {
    kind: (document.querySelector<HTMLInputElement>('input[name="kind"]:checked')?.value ?? 'text') as Settings['kind'],
    text: $<HTMLInputElement>('#text').value,
    color: $<HTMLInputElement>('#color').value,
    size: Number($<HTMLInputElement>('#size').value),
    opacity: Number($<HTMLInputElement>('#opacity').value),
    bold: $<HTMLInputElement>('#bold').checked,
    outline: $<HTMLInputElement>('#outline').checked,
    logoSize: Number($<HTMLInputElement>('#logo-size').value),
    pos: s.pos,
    margin: Number($<HTMLInputElement>('#margin').value),
    angle: Number($<HTMLInputElement>('#angle').value),
  };
  prefs.set(s);
  syncLabels();
}

function renderPreview(): void {
  if (!previewImg) return;
  // Xem trước ở kích thước vừa khung, watermark tính theo tỷ lệ nên giống bản xuất
  const scale = Math.min(1, 900 / previewImg.width);
  const canvas = drawToCanvas(previewImg, previewImg.width * scale, previewImg.height * scale);
  drawWatermark(canvas.getContext('2d') as CanvasRenderingContext2D, canvas.width, canvas.height);
  canvas.className = 'bg-canvas';
  const stage = $('#stage');
  stage.innerHTML = '';
  stage.appendChild(canvas);
}

async function setFiles(list: FileList | File[]): Promise<void> {
  const ok = [...list].filter((f) => f.type.startsWith('image/') && f.size <= MAX_IMAGE_BYTES).slice(0, 100);
  if (!ok.length) return toast('Hãy chọn file ảnh dưới 40 MB');
  if (ok.length < list.length) toast('Đã bỏ qua file không phải ảnh hoặc lớn hơn 40 MB');
  files = ok;
  previewImg?.close();
  try {
    previewImg = await loadImage(files[0]);
  } catch (e) {
    return toast((e as Error).message);
  }
  $<HTMLButtonElement>('#run').disabled = false;
  $('#info').textContent = files.length > 1 ? `Đang xem trước ảnh đầu tiên trong ${files.length} ảnh.` : '';
  $('#list').innerHTML = '';
  renderPreview();
}

async function loadLogo(src: string): Promise<void> {
  if (!src) return;
  try {
    logo?.close();
    logo = await loadImage(await (await fetch(src)).blob());
  } catch {
    logo = null;
  }
}

async function exportAll(): Promise<void> {
  const btn = $<HTMLButtonElement>('#run');
  btn.disabled = true;
  const results: { name: string; blob: Blob }[] = [];
  const rows: string[] = [];
  for (let i = 0; i < files.length; i++) {
    btn.textContent = `Đang xử lý ${i + 1}/${files.length}…`;
    const f = files[i];
    try {
      const img = await loadImage(f);
      const canvas = drawToCanvas(img, img.width, img.height);
      img.close();
      drawWatermark(canvas.getContext('2d') as CanvasRenderingContext2D, canvas.width, canvas.height);
      // Giữ định dạng gốc; định dạng trình duyệt không xuất được thì lưu PNG
      const mime = ['image/jpeg', 'image/png', 'image/webp'].includes(f.type) ? f.type : 'image/png';
      const ext = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1];
      const blob = await canvasToBlob(canvas, mime, 0.92);
      results.push({ name: renameFile(f.name, ext, '-watermark'), blob });
      rows.push(`<tr><td>${escapeHtml(f.name)}</td><td>${fmtBytes(blob.size)}</td></tr>`);
    } catch (e) {
      rows.push(`<tr><td>${escapeHtml(f.name)}</td><td class="error-text">${escapeHtml((e as Error).message)}</td></tr>`);
    }
  }
  $('#list').innerHTML = `<thead><tr><th>Ảnh</th><th>Kết quả</th></tr></thead><tbody>${rows.join('')}</tbody>`;
  if (results.length === 1) downloadBlob(results[0].blob, results[0].name);
  else if (results.length > 1) {
    if (typeof JSZip === 'undefined') results.forEach((r, k) => setTimeout(() => downloadBlob(r.blob, r.name), k * 400));
    else {
      const zip = new JSZip();
      results.forEach((r, k) => zip.file(results.findIndex((x) => x.name === r.name) === k ? r.name : r.name.replace(/(\.[^.]+)$/, `-${k + 1}$1`), r.blob));
      downloadBlob(await zip.generateAsync({ type: 'blob' }), 'anh-watermark.zip');
    }
  }
  btn.textContent = 'Áp watermark và tải về';
  btn.disabled = false;
}

/* ---------- Sự kiện ---------- */
const input = $<HTMLInputElement>('#files');
input.addEventListener('change', () => { if (input.files?.length) void setFiles(input.files); input.value = ''; });
const drop = $('#drop');
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('is-over')));
drop.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer?.files.length) void setFiles(e.dataTransfer.files); });

const form = $<HTMLFormElement>('#wm-form');
form.addEventListener('input', (e) => {
  if ((e.target as HTMLElement).id === 'files' || (e.target as HTMLElement).id === 'logo') return;
  readForm();
  renderPreview();
});
form.addEventListener('submit', (e) => e.preventDefault());
$('#pos').addEventListener('click', (e) => {
  const p = (e.target as HTMLElement).closest<HTMLElement>('[data-pos]')?.dataset.pos as Pos | undefined;
  if (!p) return;
  s.pos = p;
  prefs.set(s);
  syncLabels();
  renderPreview();
});
$<HTMLInputElement>('#logo').addEventListener('change', (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  if (f.size > 2 * 1024 * 1024) return toast('Logo lớn hơn 2 MB, hãy nén trước');
  const reader = new FileReader();
  reader.onload = async () => {
    logoPref.set(String(reader.result));
    await loadLogo(String(reader.result));
    renderPreview();
  };
  reader.readAsDataURL(f);
});
$('#run').addEventListener('click', () => {
  if (s.kind === 'logo' && !logo) return toast('Hãy chọn ảnh logo trước');
  void exportAll();
});

fillForm();
void loadLogo(logoPref.get());
// Phông chữ tải xong thì vẽ lại để watermark dùng đúng phông
document.fonts?.ready.then(renderPreview).catch(() => undefined);
