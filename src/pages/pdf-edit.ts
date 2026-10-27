import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml, toast } from '../ui';
import { pageText } from '../i18n';
import { bindDropzone, baseName, fmtSize } from '../lib/files';
import { pdfBlob, pdfLib } from '../lib/pdflib';
import { PdfEditor } from '../lib/pdfeditor';

mountLayout({ activeTool: 'pdf-edit' });
const T = pageText();

const FONTS: [string, string][] = [['Arial, Helvetica, sans-serif', 'Arial'], ["'Times New Roman', Times, serif", 'Times'], ["'Courier New', monospace", 'Courier'], ["'Be Vietnam Pro', sans-serif", 'Be Vietnam Pro']];

$('#tool-root').innerHTML = `
  <label class="dropzone" id="drop" style="margin-top:28px">
    <input type="file" id="file" accept="application/pdf,.pdf" />
    <b>${T('dropTitle', 'Chọn file PDF hoặc kéo thả vào đây')}</b>
    <span>${T('dropHint', 'Tối đa 100 MB. File không tải lên máy chủ.')}</span>
  </label>
  <div id="work" hidden>
    <div class="toolbar" style="margin-top:16px">
      <button type="button" class="btn" data-tool="text">${T('tText', 'Aa Thêm chữ')}</button>
      <button type="button" class="btn" data-tool="check" title="${T('tCheckT', 'Dấu tích')}">✓</button>
      <button type="button" class="btn" data-tool="cross" title="${T('tCrossT', 'Dấu chéo')}">✗</button>
      <button type="button" class="btn" data-tool="white">${T('tWhite', 'Che trắng')}</button>
      <button type="button" class="btn" data-tool="black">${T('tBlack', 'Che đen')}</button>
      <label class="btn" style="cursor:pointer">${T('tImage', '🖼 Ảnh')}<input type="file" id="img" accept="image/png,image/jpeg" hidden /></label>
      <span class="row" id="props" hidden>
        <select id="font" aria-label="${T('font', 'Phông chữ')}">${FONTS.map(([v, l]) => `<option value="${escapeHtml(v)}">${l}</option>`).join('')}</select>
        <input type="number" id="size" min="4" max="96" style="width:64px" aria-label="${T('size', 'Cỡ chữ')}" />
        <input type="color" id="color" aria-label="${T('color', 'Màu chữ')}" />
        <button type="button" class="btn btn-sm" id="bold" aria-pressed="false"><b>B</b></button>
      </span>
      <span class="note" id="hint"></span>
      <span style="flex:1"></span>
      <button type="button" class="btn btn-primary" id="save">${T('save', 'Tải PDF đã sửa')}</button>
    </div>
    <p class="error" id="err" hidden></p>
    <section class="panel" id="form-panel" hidden style="margin-top:12px">
      <div class="panel-title" style="margin:0">${T('formTitle', 'Các ô biểu mẫu trong file')}</div>
      <div class="form-fields" id="fields"></div>
      <label class="check"><input type="checkbox" id="flatten" /><span>${T('flatten', 'Khoá biểu mẫu sau khi điền (không sửa lại được)')}</span></label>
    </section>
    <div class="pdf-pages" id="pages" style="margin-top:12px"></div>
    <p class="note" style="margin-top:8px">${T('tip', 'Chọn công cụ rồi bấm vào trang để đặt. Bấm vào chữ để sửa, kéo để di chuyển, kéo ô vuông góc dưới để đổi cỡ, phím Delete để xoá. Lưu ý: "Che đen/Che trắng" chỉ phủ hình lên trên, chữ gốc bên dưới vẫn còn trong file; để xoá hẳn thông tin nhạy cảm hãy dùng thêm công cụ Nén PDF mức Tối đa (chuyển trang thành ảnh).')}</p>
  </div>
`;

const editor = new PdfEditor($('#pages'));
let file: File | null = null;
let tool: string | null = null;
let defaults = { size: 12, color: '#000000', bold: false, font: FONTS[0][0] };
const showErr = (m: string) => { const e = $('#err'); e.textContent = m; e.hidden = !m; };

function setTool(tl: string | null): void {
  tool = tl;
  document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === tl)));
  $('#hint').textContent = tl ? T('clickPage', 'Bấm vào trang để đặt') : '';
  $('#pages').style.cursor = tl ? 'crosshair' : '';
}
document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(tool === b.dataset.tool ? null : (b.dataset.tool as string))));

let pendingImg: { src: string; ratio: number } | null = null;
editor.placer = (page, x, y) => {
  if (pendingImg) {
    const im = pendingImg;
    pendingImg = null;
    $('#hint').textContent = '';
    const w = 160;
    return { page, kind: 'image', x, y, w, h: w / im.ratio, src: im.src };
  }
  switch (tool) {
    case 'text': return { page, kind: 'text', x, y, w: 10, h: 14, text: '', ...defaults };
    case 'check': return { page, kind: 'text', x, y, w: 14, h: 16, text: '✓', ...defaults, size: 14, bold: true };
    case 'cross': return { page, kind: 'text', x, y, w: 14, h: 16, text: '✗', ...defaults, size: 14, bold: true };
    case 'white': return { page, kind: 'rect', x, y, w: 120, h: 18, fill: '#ffffff' };
    case 'black': return { page, kind: 'rect', x, y, w: 120, h: 18, fill: '#000000' };
  }
  return null;
};

// Thuộc tính ô chữ đang chọn
const sizeEl = $<HTMLInputElement>('#size');
const colorEl = $<HTMLInputElement>('#color');
const fontEl = $<HTMLSelectElement>('#font');
editor.onChange = () => {
  const o = editor.get(editor.active);
  const isText = o?.kind === 'text';
  $('#props').hidden = !isText && tool !== 'text';
  const src = isText ? o : defaults;
  sizeEl.value = String(src?.size ?? 12);
  colorEl.value = src?.color ?? '#000000';
  fontEl.value = src?.font ?? FONTS[0][0];
  $('#bold').setAttribute('aria-pressed', String(!!src?.bold));
};
function applyProps(patch: Partial<typeof defaults>): void {
  defaults = { ...defaults, ...patch };
  const o = editor.get(editor.active);
  if (o?.kind === 'text') editor.update(o.id, patch);
}
sizeEl.addEventListener('input', () => applyProps({ size: Math.max(4, Math.min(96, Number(sizeEl.value) || 12)) }));
colorEl.addEventListener('input', () => applyProps({ color: colorEl.value }));
fontEl.addEventListener('change', () => applyProps({ font: fontEl.value }));
$('#bold').addEventListener('click', () => applyProps({ bold: !(editor.get(editor.active)?.bold ?? defaults.bold) }));

bindDropzone($('#work'), $<HTMLInputElement>('#img'), async (files) => {
  const f = files.find((x) => /image\/(png|jpeg)/.test(x.type));
  if (!f) return;
  const src = await new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result)); fr.readAsDataURL(f); });
  const img = new Image();
  img.src = src;
  await img.decode().catch(() => undefined);
  pendingImg = { src, ratio: (img.naturalWidth || 1) / (img.naturalHeight || 1) };
  setTool(null);
  $('#hint').textContent = T('clickImg', 'Bấm vào trang để đặt ảnh');
});

// ---- Biểu mẫu
interface Field { getName(): string; constructor: { name: string } }
interface FieldInfo { name: string; type: 'text' | 'check' | 'select' | 'radio'; options?: string[]; value: string | boolean; multiline?: boolean }
let fields: FieldInfo[] = [];

async function readForm(bytes: Uint8Array): Promise<void> {
  fields = [];
  try {
    const lib = (await pdfLib()) as unknown as Record<string, unknown> & { PDFDocument: { load(b: Uint8Array, o?: unknown): Promise<{ getForm(): { getFields(): Field[] } }> } };
    const doc = await lib.PDFDocument.load(bytes, { ignoreEncryption: true });
    for (const f of doc.getForm().getFields()) {
      const any = f as unknown as Record<string, () => unknown>;
      const name = f.getName();
      if (lib.PDFTextField && f instanceof (lib.PDFTextField as new () => unknown)) fields.push({ name, type: 'text', value: String(any.getText() ?? ''), multiline: !!any.isMultiline?.() });
      else if (lib.PDFCheckBox && f instanceof (lib.PDFCheckBox as new () => unknown)) fields.push({ name, type: 'check', value: !!any.isChecked() });
      else if ((lib.PDFDropdown && f instanceof (lib.PDFDropdown as new () => unknown)) || (lib.PDFOptionList && f instanceof (lib.PDFOptionList as new () => unknown))) fields.push({ name, type: 'select', options: any.getOptions() as string[], value: String((any.getSelected() as string[])[0] ?? '') });
      else if (lib.PDFRadioGroup && f instanceof (lib.PDFRadioGroup as new () => unknown)) fields.push({ name, type: 'radio', options: any.getOptions() as string[], value: String(any.getSelected() ?? '') });
    }
  } catch { /* file không có form hoặc không đọc được form: bỏ qua */ }
  $('#form-panel').hidden = !fields.length;
  $('#fields').innerHTML = fields.map((f, i) => {
    const label = `<span class="field-label">${escapeHtml(f.name)}</span>`;
    if (f.type === 'check') return `<label class="check"><input type="checkbox" data-f="${i}"${f.value ? ' checked' : ''} /><span>${escapeHtml(f.name)}</span></label>`;
    if (f.type === 'select' || f.type === 'radio') return `<label class="field">${label}<select data-f="${i}"><option value=""></option>${(f.options ?? []).map((o) => `<option${o === f.value ? ' selected' : ''}>${escapeHtml(o)}</option>`).join('')}</select></label>`;
    return `<label class="field">${label}${f.multiline ? `<textarea data-f="${i}" rows="3">${escapeHtml(String(f.value))}</textarea>` : `<input type="text" class="input-inline" data-f="${i}" value="${escapeHtml(String(f.value))}" />`}</label>`;
  }).join('');
}
$('#fields').addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  const f = fields[Number(el.dataset.f)];
  if (f) f.value = el.type === 'checkbox' ? el.checked : el.value;
});

async function open(f: File): Promise<void> {
  showErr('');
  if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { showErr(T('notPdf', 'Hãy chọn file PDF.')); return; }
  if (f.size > 100 * 1024 * 1024) { showErr(T('tooBig', 'File lớn hơn 100 MB.')); return; }
  file = f;
  $('#drop').hidden = true;
  $('#work').hidden = false;
  try {
    const bytes = new Uint8Array(await f.arrayBuffer());
    await editor.load(bytes);
    await readForm(bytes);
    setTool('text');
  } catch (e) {
    showErr((e as Error).message);
  }
}

$('#save').addEventListener('click', async () => {
  if (!file) return;
  const btn = $<HTMLButtonElement>('#save');
  btn.disabled = true;
  showErr('');
  try {
    const flatten = $<HTMLInputElement>('#flatten').checked;
    editor.extra = [];
    let lockedForUnicode = false;
    const out = await editor.export(async (docU) => {
      if (!fields.length) return;
      const doc = docU as { getForm(): { getFields(): Field[]; flatten(): void; removeField(f: unknown): void }; getPages(): { ref: unknown; getSize(): { width: number; height: number } }[] };
      const form = doc.getForm();
      const pages = doc.getPages();
      for (const fi of fields) {
        const fld = form.getFields().find((x) => x.getName() === fi.name) as unknown as Record<string, (v?: unknown) => unknown> & { acroField?: { getWidgets(): { getRectangle(): { x: number; y: number; width: number; height: number }; P(): unknown }[] } };
        if (!fld) continue;
        try {
          if (fi.type === 'text') {
            const v = String(fi.value);
            // Phông mặc định của biểu mẫu (Helvetica) không có chữ có dấu tiếng Việt, chữ Nhật…:
            // để trống ô và vẽ chữ trực tiếp lên trang tại vị trí ô (giống cách thêm chữ)
            if (/[^\x00-\xff]/.test(v)) {
              lockedForUnicode = true;
              for (const w of fld.acroField?.getWidgets() ?? []) {
                const r = w.getRectangle();
                let pi = pages.findIndex((p) => p.ref === w.P());
                if (pi < 0) pi = 0;
                const H = pages[pi].getSize().height;
                const size = Math.max(6, Math.min(12, r.height * 0.65));
                editor.extra.push({ id: -1, page: pi + 1, kind: 'text', text: v, size, color: '#000000', font: 'Arial, Helvetica, sans-serif',
                  x: r.x + 2, y: H - r.y - r.height + (r.height - size * 1.2) / 2, w: Math.max(10, r.width - 4), h: size * 1.2 + 2 });
              }
              // Bỏ ô biểu mẫu này (chữ đã nằm trên trang); các ô khác vẫn điền tiếp được
              form.removeField(fld);
            } else fld.setText(v);
          }
          if (fi.type === 'check') (fi.value ? fld.check() : fld.uncheck());
          if ((fi.type === 'select' || fi.type === 'radio') && fi.value) fld.select(fi.value);
        } catch { /* ô bị khoá hoặc giá trị không hợp lệ */ }
      }
      if (flatten) form.flatten();
    });
    editor.extra = [];
    if (lockedForUnicode) toast(T('unicodeLocked', 'Ô có chữ tiếng Việt được ghi thẳng lên trang (ô đó không còn sửa lại được).'));
    downloadBlob(pdfBlob(out), `${baseName(file.name)}-${T('suffix', 'da-sua')}.pdf`);
    toast(`${T('saved', 'Đã lưu')} · ${fmtSize(out.length)}`);
  } catch (e) {
    showErr((e as Error).message || T('err', 'Không lưu được PDF.'));
  } finally {
    btn.disabled = false;
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setTool(null); });
bindDropzone($('#drop'), $<HTMLInputElement>('#file'), (f) => void open(f[0]));
