import { mountLayout } from '../layout';
import { $, copyText, downloadBlob, escapeHtml, setupTabs } from '../ui';
import { EXT_OF, fmtBytes, sniffImageType } from '../lib/image';
import { pageText, currentLang } from '../i18n';

mountLayout({ activeTool: 'image-base64' });
const T = pageText();
const LOCALE = ({ en: 'en-US', vi: 'vi-VN', ja: 'ja-JP', zh: 'zh-CN' } as Record<string, string>)[currentLang()] || 'en-US';

const MAX_BYTES = 10 * 1024 * 1024;

const root = $('#tool-root');
root.innerHTML = `
  <div class="tabs" role="tablist" aria-label="${T('aria.dir','Chiều chuyển đổi')}">
    <button type="button" role="tab" data-tab="to">${T('tab.to','Ảnh sang Base64')}</button>
    <button type="button" role="tab" data-tab="from">${T('tab.from','Base64 sang ảnh')}</button>
  </div>

  <section class="tool-body" data-panel="to">
    <div class="workspace">
      <div class="panel">
        <label class="dropzone" id="drop">
          <input type="file" id="file" accept="image/*" />
          <b>${T('drop.title','Chọn một ảnh hoặc kéo thả vào đây')}</b>
          <span>${T('drop.hint','Tối đa 10 MB. Nên dùng cho ảnh nhỏ như biểu tượng, logo (dưới 10 KB) để trang web không bị nặng.')}</span>
        </label>
        <div class="b64-preview" id="to-preview"></div>
        <p class="note" id="to-info" aria-live="polite"></p>
      </div>
      <div class="panel">
        <div class="tabs b64-kinds" role="tablist" aria-label="${T('aria.outKind','Dạng kết quả')}">
          <button type="button" data-kind="uri" aria-selected="true">Data URI</button>
          <button type="button" data-kind="raw" aria-selected="false">${T('kind.raw','Base64 thuần')}</button>
          <button type="button" data-kind="img" aria-selected="false">${T('kind.img','Thẻ HTML img')}</button>
          <button type="button" data-kind="css" aria-selected="false">${T('kind.css','CSS background')}</button>
        </div>
        <textarea id="to-out" class="mono" rows="12" readonly spellcheck="false" aria-label="${T('aria.outTo','Kết quả Base64')}"></textarea>
        <div class="row"><button type="button" class="btn btn-primary" id="to-copy" disabled>${T('copy','Sao chép')}</button><button type="button" class="btn" id="to-save" disabled>${T('saveTxt','Tải file .txt')}</button></div>
      </div>
    </div>
  </section>

  <section class="tool-body" data-panel="from" hidden>
    <div class="workspace">
      <div class="panel">
        <label class="field">
          <span class="field-label">${T('pasteB64','Dán chuỗi Base64 hoặc Data URI (data:image/png;base64,…)')}</span>
          <textarea id="from-in" class="mono" rows="12" spellcheck="false"></textarea>
        </label>
        <p class="error" id="from-err" hidden></p>
      </div>
      <div class="panel">
        <div class="b64-preview" id="from-preview"><p class="note">${T('imgHere','Ảnh sẽ hiện ở đây.')}</p></div>
        <p class="note" id="from-info"></p>
        <div class="row"><button type="button" class="btn btn-primary" id="from-dl" disabled>${T('dlImg','Tải ảnh về')}</button></div>
      </div>
    </div>
  </section>
`;
setupTabs(root);

/* ---------- Ảnh -> Base64 ---------- */
let dataUri = '';
let fileName = 'anh';
let kind = 'uri';

function outputText(): string {
  if (!dataUri) return '';
  const raw = dataUri.slice(dataUri.indexOf(',') + 1);
  if (kind === 'raw') return raw;
  if (kind === 'img') return `<img src="${dataUri}" alt="" />`;
  if (kind === 'css') return `background-image: url("${dataUri}");`;
  return dataUri;
}
function renderTo(): void {
  $<HTMLTextAreaElement>('#to-out').value = outputText();
  $<HTMLButtonElement>('#to-copy').disabled = !dataUri;
  $<HTMLButtonElement>('#to-save').disabled = !dataUri;
}

function readFile(f: File): void {
  const info = $('#to-info');
  if (!f.type.startsWith('image/')) { info.innerHTML = `<span class="error-text">${T('err.notImg','File này không phải ảnh.')}</span>`; return; }
  if (f.size > MAX_BYTES) { info.innerHTML = `<span class="error-text">${T('err.tooBig','Ảnh lớn hơn 10 MB. Hãy nén ảnh trước.')}</span>`; return; }
  const reader = new FileReader();
  reader.onload = () => {
    dataUri = String(reader.result);
    fileName = f.name.replace(/\.[^.]+$/, '') || 'anh';
    $('#to-preview').innerHTML = `<img src="${dataUri}" alt="${T('alt.chosen','Ảnh đã chọn')}" />`;
    const grow = Math.round((dataUri.length / f.size - 1) * 100);
    info.innerHTML = `${escapeHtml(f.name)}: ${T('info.img','ảnh')} ${fmtBytes(f.size)}, ${T('info.b64len','chuỗi Base64 dài')} ${dataUri.length.toLocaleString(LOCALE)} ${T('info.chars','ký tự (nặng hơn khoảng')} ${grow}%).${f.size > 50 * 1024 ? ' <b>' + T('info.largeWarn','Ảnh khá lớn: nên dùng file ảnh bình thường thay vì nhúng Base64.') + '</b>' : ''}`;
    renderTo();
  };
  reader.onerror = () => (info.innerHTML = `<span class="error-text">${T('err.read','Không đọc được file.')}</span>`);
  reader.readAsDataURL(f);
}

const fileInput = $<HTMLInputElement>('#file');
fileInput.addEventListener('change', () => { const f = fileInput.files?.[0]; if (f) readFile(f); });
const drop = $('#drop');
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('is-over')));
drop.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer?.files[0]; if (f) readFile(f); });
root.querySelector('.b64-kinds')!.addEventListener('click', (e) => {
  const k = (e.target as HTMLElement).closest<HTMLElement>('[data-kind]')?.dataset.kind;
  if (!k) return;
  kind = k;
  root.querySelectorAll('[data-kind]').forEach((b) => b.setAttribute('aria-selected', String((b as HTMLElement).dataset.kind === k)));
  renderTo();
});
$('#to-copy').addEventListener('click', () => copyText(outputText()));
$('#to-save').addEventListener('click', () => downloadBlob(new Blob([outputText()], { type: 'text/plain' }), `${fileName}-base64.txt`));

/* ---------- Base64 -> ảnh ---------- */
let decoded: Blob | null = null;
let previewUrl = '';

function decode(): void {
  const raw = $<HTMLTextAreaElement>('#from-in').value.trim();
  const err = $('#from-err');
  const fail = (msg: string) => {
    err.textContent = msg;
    err.hidden = !msg;
    decoded = null;
    $<HTMLButtonElement>('#from-dl').disabled = true;
    $('#from-preview').innerHTML = `<p class="note">${T('imgHere','Ảnh sẽ hiện ở đây.')}</p>`;
    $('#from-info').textContent = '';
  };
  if (!raw) return fail('');
  // Chấp nhận cả data URI, chuỗi trong url("…") của CSS và Base64 thuần (có thể xuống dòng)
  const m = raw.match(/data:([\w/+.-]+)?;base64,([A-Za-z0-9+/=_\s-]+)/);
  const body = (m ? m[2] : raw).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body)) return fail(T('err.notB64','Chuỗi có ký tự không thuộc Base64. Hãy kiểm tra lại đoạn đã dán.'));
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(body + '='.repeat((4 - (body.length % 4)) % 4)), (c) => c.charCodeAt(0));
  } catch {
    return fail(T('err.decode','Không giải mã được chuỗi Base64.'));
  }
  const type = sniffImageType(bytes) ?? m?.[1] ?? null;
  if (!type || !type.startsWith('image/')) return fail(T('err.notImgData','Giải mã được nhưng dữ liệu không phải ảnh (PNG, JPG, GIF, WebP, SVG, BMP, ICO, AVIF).'));
  err.hidden = true;
  decoded = new Blob([bytes as BlobPart], { type });
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(decoded);
  // SVG hiển thị qua <img> nên mã script trong SVG (nếu có) không chạy được
  $('#from-preview').innerHTML = `<img src="${previewUrl}" alt="${T('alt.decoded','Ảnh giải mã')}" />`;
  $('#from-info').textContent = `${T('info.format','Định dạng')} ${type.replace('image/', '').toUpperCase()}, ${fmtBytes(bytes.length)}.`;
  $<HTMLButtonElement>('#from-dl').disabled = false;
}
$('#from-in').addEventListener('input', decode);
$('#from-dl').addEventListener('click', () => decoded && downloadBlob(decoded, `anh-tu-base64.${EXT_OF[decoded.type] ?? 'bin'}`));
