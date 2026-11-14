import { mountLayout } from '../layout';
import { $, setupTabs } from '../ui';
import { pageText } from '../i18n';
import { area, button, check, bindCopy, bindDownload, dk, el, errorBox, showError, privacyNote, val, setVal, checked, onChange, utf8, fromUtf8, toB64, fromB64, fmtBytes, type Bytes } from '../lib/devkit';

mountLayout({ activeTool: 'base64-text' });
const T = pageText();

$('#tool-root').innerHTML = `
  <div class="tabs" role="tablist" style="margin-top:24px">
    <button type="button" role="tab" data-tab="enc">${T('tab.enc', 'Mã hoá Base64')}</button>
    <button type="button" role="tab" data-tab="dec">${T('tab.dec', 'Giải mã Base64')}</button>
    <button type="button" role="tab" data-tab="file">${T('tab.file', 'File sang Base64')}</button>
  </div>
  <div class="tool-body">
    <div class="panel" data-panel="enc">
      ${area('enc-in', T('plain', 'Văn bản thường'), { rows: 8, mono: false, value: T('sample', 'Xin chào WFTools! Công cụ chạy ngay trên trình duyệt.') })}
      <div class="row">${check('enc-url', T('urlSafe', 'Dạng an toàn cho URL (Base64URL, bỏ dấu =)'))}${check('enc-wrap', T('wrap', 'Xuống dòng mỗi 76 ký tự (MIME)'))}</div>
      ${area('enc-out', T('b64', 'Chuỗi Base64'), { rows: 8, ro: true })}
      <div class="row">${button('enc-copy', dk.copy(), true)}${button('enc-dl', dk.download())}<span class="note" id="enc-stat"></span></div>
    </div>
    <div class="panel" data-panel="dec" hidden>
      ${area('dec-in', T('b64', 'Chuỗi Base64'), { rows: 8, ph: 'SGVsbG8=' })}
      ${area('dec-out', T('plain', 'Văn bản thường'), { rows: 8, ro: true, mono: false })}
      ${errorBox('dec-err')}
      <div class="row">${button('dec-copy', dk.copy(), true)}${button('dec-bin', T('saveBin', 'Lưu thành file'))}</div>
      <p class="note">${T('decNote', 'Tự nhận cả Base64 thường, Base64URL (dùng - và _) và chuỗi data:...;base64, có hay không có dấu =.')}</p>
    </div>
    <div class="panel" data-panel="file" hidden>
      <label class="field"><span class="field-label">${dk.chooseFile()}</span><input type="file" id="file" /></label>
      ${check('file-uri', T('dataUri', 'Thêm tiền tố data URI (data:kiểu;base64,)'), true)}
      ${area('file-out', T('b64', 'Chuỗi Base64'), { rows: 10, ro: true })}
      <div class="row">${button('file-copy', dk.copy(), true)}<span class="note" id="file-stat"></span></div>
    </div>
  </div>
  ${privacyNote()}
`;
setupTabs($('#tool-root'));

function encode(): void {
  let out = toB64(utf8(val('enc-in')), checked('enc-url'));
  if (checked('enc-wrap')) out = out.replace(/(.{76})/g, '$1\n').trim();
  setVal('enc-out', out);
  el('enc-stat').textContent = `${fmtBytes(utf8(val('enc-in')).length)} → ${fmtBytes(out.length)}`;
}
let lastBytes: Bytes = new Uint8Array() as Bytes;
function decode(): void {
  const s = val('dec-in').trim();
  showError('dec-err', '');
  if (!s) { setVal('dec-out', ''); return; }
  try {
    lastBytes = fromB64(s);
    try { setVal('dec-out', fromUtf8(lastBytes)); }
    catch { setVal('dec-out', T('binary', '(Dữ liệu nhị phân, không phải văn bản — bấm "Lưu thành file" để tải về)')); }
  } catch {
    setVal('dec-out', '');
    showError('dec-err', T('bad', 'Chuỗi không phải Base64 hợp lệ. Kiểm tra lại ký tự lạ hoặc phần bị cắt mất.'));
  }
}
onChange(['enc-in', 'enc-url', 'enc-wrap'], encode, 60);
onChange(['dec-in'], decode, 60);
bindCopy('enc-copy', () => val('enc-out'));
bindDownload('enc-dl', () => val('enc-out'), () => 'base64.txt');
bindCopy('dec-copy', () => val('dec-out'));
el('dec-bin').addEventListener('click', () => {
  if (!lastBytes.length) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lastBytes]));
  a.download = 'decoded.bin';
  a.click();
});
let fileB64 = '';
let fileType = '';
async function readSel(): Promise<void> {
  const f = el<HTMLInputElement>('file').files?.[0];
  if (!f) return;
  fileType = f.type || 'application/octet-stream';
  fileB64 = toB64(new Uint8Array(await f.arrayBuffer()));
  showFile();
  el('file-stat').textContent = `${f.name} · ${fmtBytes(f.size)} → ${fmtBytes(fileB64.length)}`;
}
const showFile = () => setVal('file-out', fileB64 ? (checked('file-uri') ? `data:${fileType};base64,` : '') + fileB64 : '');
el('file').addEventListener('change', () => void readSel());
el('file-uri').addEventListener('change', showFile);
bindCopy('file-copy', () => val('file-out'));
encode();
