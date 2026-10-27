import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml, setupTabs, storage, toast } from '../ui';
import { pageText } from '../i18n';
import { SketchPad, loadGoogleFonts } from '../lib/sketch';

mountLayout({ activeTool: 'signature' });
const T = pageText();

/** Phông viết tay (có hỗ trợ chữ tiếng Việt nếu ghi chú vi) */
const FONTS = ['Dancing Script', 'Great Vibes', 'Allura', 'Pacifico', 'Caveat', 'Sacramento', 'Satisfy', 'Alex Brush', 'Mrs Saint Delafield', 'Herr Von Muellerhoff'];
const COLORS = ['#000000', '#0b2a6b', '#0d47a1', '#1b5e20', '#b9000e'];

const st = storage<{ name: string; font: string; color: string; width: number; slant: number }>('signature', { name: '', font: 'Great Vibes', color: '#0b2a6b', width: 3, slant: 0 });
const s = st.get();

$('#tool-root').innerHTML = `
  <div class="tabs" role="tablist" style="margin-top:24px">
    <button type="button" role="tab" data-tab="draw">${T('tabDraw', 'Vẽ chữ ký')}</button>
    <button type="button" role="tab" data-tab="type">${T('tabType', 'Gõ tên thành chữ ký')}</button>
  </div>
  <div class="tool-body">
    <div class="panel" data-panel="draw">
      <div class="sign-pad"><canvas id="pad" aria-label="${T('padLabel', 'Khung ký tên')}"></canvas></div>
      <div class="row" style="justify-content:space-between">
        <div class="row" id="colors">${COLORS.map((c) => `<button type="button" class="btn btn-sm" data-color="${c}" style="width:34px;height:34px;padding:0;background:${c};border-radius:50%" aria-label="${c}"></button>`).join('')}</div>
        <label class="row note">${T('thickness', 'Độ dày nét')} <input type="range" id="width" min="1" max="8" step="0.5" /></label>
      </div>
      <div class="actions">
        <button type="button" class="btn" id="undo">${T('undo', 'Hoàn tác')}</button>
        <button type="button" class="btn" id="clear">${T('clear', 'Xoá, ký lại')}</button>
        <button type="button" class="btn btn-primary" data-dl="png">${T('dlPng', 'Tải PNG nền trong suốt')}</button>
        <button type="button" class="btn" data-dl="svg">${T('dlSvg', 'Tải SVG')}</button>
        <button type="button" class="btn" data-dl="jpg">${T('dlJpg', 'Tải JPG nền trắng')}</button>
      </div>
      <p class="note">${T('drawTip', 'Ký bằng chuột, bút cảm ứng hoặc ngón tay trong khung. Trên điện thoại nên xoay ngang để có chỗ ký rộng hơn.')}</p>
    </div>
    <div class="panel" data-panel="type" hidden>
      <label class="field"><span class="field-label">${T('name', 'Họ tên')}</span><input type="text" id="name" class="input-inline" maxlength="60" /></label>
      <div class="font-pick" id="fonts"></div>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('color', 'Màu mực')}</span><input type="color" id="tcolor" /></label>
        <label class="field"><span class="field-label">${T('slant', 'Độ nghiêng')}</span><input type="range" id="slant" min="-20" max="20" step="1" /></label>
      </div>
      <div class="checker" style="border-radius:10px;padding:10px;text-align:center"><canvas id="typed" style="max-width:100%;height:auto"></canvas></div>
      <div class="actions">
        <button type="button" class="btn btn-primary" data-tdl="png">${T('dlPng', 'Tải PNG nền trong suốt')}</button>
        <button type="button" class="btn" data-tdl="jpg">${T('dlJpg', 'Tải JPG nền trắng')}</button>
      </div>
      <p class="note">${T('fontNote', 'Một số kiểu chữ chưa hỗ trợ đủ dấu tiếng Việt; nếu thấy dấu bị lệch hãy chọn Dancing Script, Great Vibes, Allura, Pacifico hoặc Caveat.')}</p>
    </div>
  </div>
  <p class="note" style="margin-top:16px">${T('legal', 'Chữ ký được tạo ngay trên máy bạn, không gửi đi đâu. Chèn ảnh chữ ký vào tài liệu chưa thay thế được chữ ký số có giá trị pháp lý khi cơ quan yêu cầu.')}</p>
`;
setupTabs($('#tool-root'));

// ---- Vẽ
const pad = new SketchPad($<HTMLCanvasElement>('#pad'));
pad.color = s.color;
pad.width = s.width;
const widthEl = $<HTMLInputElement>('#width');
widthEl.value = String(s.width);
const save = () => st.set(s);
function markColor(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((b) => (b.style.outline = b.dataset.color === pad.color ? '3px solid var(--accent)' : ''));
}
$('#colors').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-color]');
  if (!b) return;
  pad.color = b.dataset.color as string;
  s.color = pad.color;
  save();
  markColor();
});
widthEl.addEventListener('input', () => { pad.width = Number(widthEl.value); s.width = pad.width; save(); });
$('#undo').addEventListener('click', () => pad.undo());
$('#clear').addEventListener('click', () => pad.clear());
const fileBase = () => T('fileName', 'chu-ky');
document.querySelectorAll<HTMLButtonElement>('[data-dl]').forEach((b) => b.addEventListener('click', () => {
  if (pad.empty) { toast(T('empty', 'Bạn chưa ký. Hãy ký vào khung trước.')); return; }
  const kind = b.dataset.dl;
  if (kind === 'svg') { downloadBlob(new Blob([pad.toSvg()], { type: 'image/svg+xml' }), `${fileBase()}.svg`); return; }
  const c = pad.toCanvas(3, 12, kind === 'jpg' ? '#ffffff' : undefined);
  c?.toBlob((blob) => blob && downloadBlob(blob, `${fileBase()}.${kind}`), kind === 'jpg' ? 'image/jpeg' : 'image/png', 0.95);
}));
markColor();

// ---- Gõ tên
const nameEl = $<HTMLInputElement>('#name');
const tcolor = $<HTMLInputElement>('#tcolor');
const slant = $<HTMLInputElement>('#slant');
nameEl.value = s.name || T('sampleName', 'Nguyễn Văn An');
tcolor.value = s.color;
slant.value = String(s.slant);
const typed = $<HTMLCanvasElement>('#typed');

function renderFonts(): void {
  const text = nameEl.value || T('sampleName', 'Nguyễn Văn An');
  $('#fonts').innerHTML = FONTS.map((f) => `<button type="button" data-font="${f}" aria-pressed="${f === s.font}" style="font-family:'${f}',cursive" title="${f}">${escapeHtml(text)}</button>`).join('');
}
function renderTyped(bg?: string): HTMLCanvasElement {
  const text = nameEl.value.trim() || T('sampleName', 'Nguyễn Văn An');
  const size = 120;
  const ctx = typed.getContext('2d') as CanvasRenderingContext2D;
  ctx.font = `${size}px "${s.font}", cursive`;
  const m = ctx.measureText(text);
  const w = Math.ceil(m.width + size * 0.8);
  const h = Math.ceil(size * 1.9);
  typed.width = w;
  typed.height = h;
  ctx.clearRect(0, 0, w, h);
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
  ctx.font = `${size}px "${s.font}", cursive`;
  ctx.fillStyle = tcolor.value;
  ctx.textBaseline = 'middle';
  ctx.setTransform(1, 0, Math.tan((-Number(slant.value) * Math.PI) / 180), 1, size * 0.4 + (Number(slant.value) > 0 ? size * 0.3 : 0), 0);
  ctx.fillText(text, 0, h / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  typed.style.width = `${Math.min(w / 2, 700)}px`;
  return typed;
}
void loadGoogleFonts(FONTS).then(() => { renderFonts(); renderTyped(); });
renderFonts();
renderTyped();
nameEl.addEventListener('input', () => { s.name = nameEl.value; save(); renderFonts(); renderTyped(); });
[tcolor, slant].forEach((el) => el.addEventListener('input', () => { s.color = tcolor.value; s.slant = Number(slant.value); save(); renderTyped(); }));
$('#fonts').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-font]');
  if (!b) return;
  s.font = b.dataset.font as string;
  save();
  renderFonts();
  renderTyped();
});
document.querySelectorAll<HTMLButtonElement>('[data-tdl]').forEach((b) => b.addEventListener('click', () => {
  const kind = b.dataset.tdl as string;
  const c = renderTyped(kind === 'jpg' ? '#ffffff' : undefined);
  c.toBlob((blob) => { if (blob) downloadBlob(blob, `${fileBase()}.${kind}`); renderTyped(); }, kind === 'jpg' ? 'image/jpeg' : 'image/png', 0.95);
}));
