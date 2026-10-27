import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml, setupTabs, storage, toast } from '../ui';
import { pageText, localeTag } from '../i18n';
import { bindDropzone, baseName, fmtSize } from '../lib/files';
import { pdfBlob } from '../lib/pdflib';
import { PdfEditor } from '../lib/pdfeditor';
import { SketchPad, loadGoogleFonts } from '../lib/sketch';

mountLayout({ activeTool: 'pdf-sign' });
const T = pageText();
const LOCALE = localeTag();
const FONTS = ['Great Vibes', 'Dancing Script', 'Allura', 'Caveat', 'Pacifico'];

const st = storage<{ sigs: string[]; name: string; font: string; color: string }>('pdf-sign', { sigs: [], name: '', font: 'Great Vibes', color: '#0b2a6b' });
const s = st.get();

$('#tool-root').innerHTML = `
  <label class="dropzone" id="drop" style="margin-top:28px">
    <input type="file" id="file" accept="application/pdf,.pdf" />
    <b>${T('dropTitle', 'Chọn file PDF cần ký hoặc kéo thả vào đây')}</b>
    <span>${T('dropHint', 'Tối đa 100 MB. File không tải lên máy chủ.')}</span>
  </label>
  <div id="work" hidden>
    <div class="toolbar" style="margin-top:16px">
      <button type="button" class="btn btn-primary" id="new-sig">${T('newSig', '✍ Tạo chữ ký')}</button>
      <div class="row" id="sig-list"></div>
      <button type="button" class="btn" data-tool="date">${T('addDate', '+ Ngày tháng')}</button>
      <button type="button" class="btn" data-tool="text">${T('addText', '+ Chữ')}</button>
      <button type="button" class="btn" data-tool="check">✓</button>
      <span class="note" id="hint"></span>
      <span style="flex:1"></span>
      <button type="button" class="btn btn-primary" id="save">${T('save', 'Tải PDF đã ký')}</button>
    </div>
    <p class="error" id="err" hidden></p>
    <div class="pdf-pages" id="pages" style="margin-top:12px"></div>
    <p class="note" style="margin-top:8px">${T('tip', 'Chọn chữ ký rồi bấm vào trang để đặt. Kéo để di chuyển, kéo ô vuông góc dưới để đổi cỡ, bấm × hoặc phím Delete để xoá. Chữ ký dạng ảnh này phù hợp giấy tờ thông thường, không thay thế chữ ký số khi cơ quan yêu cầu.')}</p>
  </div>
  <dialog id="dlg" style="max-width:640px;width:calc(100% - 32px);border:0;border-radius:12px;padding:0">
    <div class="panel" style="border:0">
      <div class="tabs" role="tablist">
        <button type="button" role="tab" data-tab="draw">${T('tDraw', 'Vẽ')}</button>
        <button type="button" role="tab" data-tab="type">${T('tType', 'Gõ tên')}</button>
        <button type="button" role="tab" data-tab="upload">${T('tUpload', 'Tải ảnh lên')}</button>
      </div>
      <div class="tool-body">
        <div data-panel="draw" class="fields">
          <div class="sign-pad"><canvas id="pad"></canvas></div>
          <div class="row"><button type="button" class="btn btn-sm" id="pad-clear">${T('clear', 'Xoá')}</button><button type="button" class="btn btn-sm" id="pad-undo">${T('undo', 'Hoàn tác')}</button></div>
        </div>
        <div data-panel="type" class="fields" hidden>
          <input type="text" id="sig-name" class="input-inline" placeholder="${T('namePh', 'Họ tên của bạn')}" maxlength="50" />
          <div class="font-pick" id="fonts"></div>
        </div>
        <div data-panel="upload" class="fields" hidden>
          <label class="dropzone" id="sig-drop"><input type="file" id="sig-file" accept="image/*" /><span>${T('upHint', 'Ảnh chụp chữ ký trên giấy trắng (JPG, PNG)')}</span></label>
          <label class="check"><input type="checkbox" id="rm-white" checked /><span>${T('rmWhite', 'Xoá nền trắng của ảnh')}</span></label>
          <div class="checker" style="min-height:80px;border-radius:8px;display:flex;align-items:center;justify-content:center"><img id="up-prev" alt="" style="max-height:120px;max-width:100%" /></div>
        </div>
      </div>
      <div class="row">
        <label class="row note">${T('ink', 'Màu mực')} <input type="color" id="ink" /></label>
        <span style="flex:1"></span>
        <button type="button" class="btn" id="dlg-cancel">${T('cancel', 'Huỷ')}</button>
        <button type="button" class="btn btn-primary" id="dlg-ok">${T('use', 'Dùng chữ ký này')}</button>
      </div>
    </div>
  </dialog>
`;

const editor = new PdfEditor($('#pages'));
let file: File | null = null;
let armed: { kind: 'sig'; src: string; ratio: number } | { kind: 'date' | 'text' | 'check' } | null = null;
const showErr = (m: string) => { const e = $('#err'); e.textContent = m; e.hidden = !m; };

function setArmed(a: typeof armed): void {
  armed = a;
  document.querySelectorAll<HTMLButtonElement>('[data-tool],[data-sig]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  if (a?.kind === 'sig') document.querySelector(`[data-sig="${s.sigs.indexOf(a.src)}"]`)?.setAttribute('aria-pressed', 'true');
  else if (a) document.querySelector(`[data-tool="${a.kind}"]`)?.setAttribute('aria-pressed', 'true');
  $('#hint').textContent = a ? T('clickPage', 'Bấm vào trang để đặt') : '';
  $('#pages').style.cursor = a ? 'crosshair' : '';
}
editor.placer = (page, x, y) => {
  if (!armed) return null;
  const a = armed;
  if (a.kind === 'sig') { const w = 150; return { page, kind: 'image', x, y, w, h: w / a.ratio, src: a.src }; }
  if (a.kind === 'date') return { page, kind: 'text', x, y, w: 80, h: 16, text: new Date().toLocaleDateString(LOCALE), size: 12, color: '#000000' };
  if (a.kind === 'check') return { page, kind: 'text', x, y, w: 16, h: 18, text: '✓', size: 16, color: '#000000', bold: true };
  return { page, kind: 'text', x, y, w: 60, h: 16, text: T('textSample', 'Văn bản'), size: 12, color: '#000000' };
};

function renderSigs(): void {
  $('#sig-list').innerHTML = s.sigs.map((src, i) => `<span class="row" style="gap:2px"><button type="button" class="btn" data-sig="${i}" title="${T('useSig', 'Dùng chữ ký này')}" style="padding:4px 8px;background:#fff"><img src="${src}" alt="" style="height:28px;max-width:120px" /></button><button type="button" class="btn btn-sm" data-delsig="${i}" aria-label="${T('delSig', 'Xoá chữ ký đã lưu')}">×</button></span>`).join('');
}
$('#sig-list').addEventListener('click', async (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!b) return;
  if (b.dataset.delsig) { s.sigs.splice(Number(b.dataset.delsig), 1); st.set(s); renderSigs(); return; }
  const src = s.sigs[Number(b.dataset.sig)];
  const img = new Image();
  img.src = src;
  await img.decode().catch(() => undefined);
  setArmed({ kind: 'sig', src, ratio: (img.naturalWidth || 3) / (img.naturalHeight || 1) });
});
document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => b.addEventListener('click', () => {
  const k = b.dataset.tool as 'date' | 'text' | 'check';
  setArmed(armed?.kind === k ? null : { kind: k });
}));

// ---- Hộp tạo chữ ký
const dlg = $<HTMLDialogElement>('#dlg');
setupTabs(dlg);
const pad = new SketchPad($<HTMLCanvasElement>('#pad'));
const ink = $<HTMLInputElement>('#ink');
ink.value = s.color;
pad.color = s.color;
pad.width = 3;
const nameEl = $<HTMLInputElement>('#sig-name');
nameEl.value = s.name;
let upload: HTMLCanvasElement | null = null;
const tab = () => dlg.querySelector<HTMLButtonElement>('[role=tab][aria-selected=true]')?.dataset.tab ?? 'draw';

function renderFonts(): void {
  const text = nameEl.value || T('namePh', 'Họ tên của bạn');
  $('#fonts').innerHTML = FONTS.map((f) => `<button type="button" data-font="${f}" aria-pressed="${f === s.font}" style="font-family:'${f}',cursive;color:${ink.value}">${escapeHtml(text)}</button>`).join('');
}
$('#fonts').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-font]');
  if (b) { s.font = b.dataset.font as string; renderFonts(); }
});
nameEl.addEventListener('input', renderFonts);
ink.addEventListener('input', () => { pad.color = ink.value; renderFonts(); if (upload) void recolorUpload(); });
$('#pad-clear').addEventListener('click', () => pad.clear());
$('#pad-undo').addEventListener('click', () => pad.undo());
$('#new-sig').addEventListener('click', () => {
  dlg.showModal();
  requestAnimationFrame(() => pad.resize());
  void loadGoogleFonts(FONTS).then(renderFonts);
  renderFonts();
});
$('#dlg-cancel').addEventListener('click', () => dlg.close());

let upFile: File | null = null;
async function recolorUpload(): Promise<void> {
  if (!upFile) return;
  const bmp = await createImageBitmap(upFile);
  const k = Math.min(1, 1200 / bmp.width);
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  if ($<HTMLInputElement>('#rm-white').checked) {
    // Điểm ảnh sáng → trong suốt; điểm tối → màu mực đã chọn, độ đậm theo độ tối
    const d = ctx.getImageData(0, 0, c.width, c.height);
    const n = parseInt(ink.value.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    for (let i = 0; i < d.data.length; i += 4) {
      const lum = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
      const a = Math.max(0, Math.min(255, (200 - lum) * 2.2));
      d.data[i] = r; d.data[i + 1] = g; d.data[i + 2] = b; d.data[i + 3] = a;
    }
    ctx.putImageData(d, 0, 0);
  }
  upload = c;
  $<HTMLImageElement>('#up-prev').src = c.toDataURL('image/png');
}
bindDropzone($('#sig-drop'), $<HTMLInputElement>('#sig-file'), (f) => { upFile = f[0]; void recolorUpload(); });
$('#rm-white').addEventListener('change', () => void recolorUpload());

/** Cắt sát vùng có nét để ảnh chữ ký không thừa khoảng trắng */
function trim(c: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return c;
  const o = document.createElement('canvas');
  const pad2 = 6;
  o.width = x1 - x0 + 1 + pad2 * 2;
  o.height = y1 - y0 + 1 + pad2 * 2;
  (o.getContext('2d') as CanvasRenderingContext2D).drawImage(c, x0 - pad2, y0 - pad2, o.width, o.height, 0, 0, o.width, o.height);
  return o;
}

$('#dlg-ok').addEventListener('click', async () => {
  let c: HTMLCanvasElement | null = null;
  const tb = tab();
  if (tb === 'draw') c = pad.toCanvas(3, 8);
  if (tb === 'type') {
    const text = nameEl.value.trim();
    if (text) {
      await document.fonts.load(`80px "${s.font}"`).catch(() => undefined);
      c = document.createElement('canvas');
      const ctx = c.getContext('2d') as CanvasRenderingContext2D;
      ctx.font = `120px "${s.font}", cursive`;
      c.width = Math.ceil(ctx.measureText(text).width + 60);
      c.height = 220;
      ctx.font = `120px "${s.font}", cursive`;
      ctx.fillStyle = ink.value;
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 30, 110);
      c = trim(c);
      s.name = text;
    }
  }
  if (tb === 'upload' && upload) c = trim(upload);
  if (!c) { toast(T('emptySig', 'Chưa có chữ ký. Hãy vẽ, gõ tên hoặc tải ảnh lên.')); return; }
  const src = c.toDataURL('image/png');
  s.sigs = [src, ...s.sigs].slice(0, 4);
  s.color = ink.value;
  st.set(s);
  renderSigs();
  dlg.close();
  setArmed({ kind: 'sig', src, ratio: c.width / c.height });
});

// ---- Mở / lưu PDF
async function open(f: File): Promise<void> {
  showErr('');
  if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { showErr(T('notPdf', 'Hãy chọn file PDF.')); return; }
  if (f.size > 100 * 1024 * 1024) { showErr(T('tooBig', 'File lớn hơn 100 MB.')); return; }
  file = f;
  $('#drop').hidden = true;
  $('#work').hidden = false;
  try {
    await editor.load(new Uint8Array(await f.arrayBuffer()));
    if (!s.sigs.length) $('#new-sig').click();
  } catch (e) {
    showErr((e as Error).message);
  }
}
$('#save').addEventListener('click', async () => {
  if (!file) return;
  if (!editor.objs.length) { toast(T('nothing', 'Chưa đặt chữ ký nào lên trang.')); return; }
  const btn = $<HTMLButtonElement>('#save');
  btn.disabled = true;
  try {
    const out = await editor.export();
    downloadBlob(pdfBlob(out), `${baseName(file.name)}-${T('suffix', 'da-ky')}.pdf`);
    toast(`${T('saved', 'Đã lưu')} · ${fmtSize(out.length)}`);
  } catch (e) {
    showErr((e as Error).message);
  } finally {
    btn.disabled = false;
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setArmed(null); });
bindDropzone($('#drop'), $<HTMLInputElement>('#file'), (f) => void open(f[0]));
renderSigs();
