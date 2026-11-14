import { mountLayout } from '../layout';
import { $ } from '../ui';
import { pageText } from '../i18n';
import { area, button, select, bindCopy, dk, el, errorBox, showError, privacyNote, val, setVal, onChange } from '../lib/devkit';

mountLayout({ activeTool: 'url-encode' });
const T = pageText();

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px">
    <div class="form-grid">
      ${select('mode', T('mode', 'Chế độ'), [['component', T('mode.component', 'Mã hoá một phần URL (tham số, encodeURIComponent)')], ['uri', T('mode.uri', 'Mã hoá cả địa chỉ URL (encodeURI)')], ['form', T('mode.form', 'Dữ liệu biểu mẫu (dấu cách thành +)')]], 'component')}
    </div>
    <div class="workspace" style="margin-top:0">
      ${area('in', T('plain', 'Chuỗi gốc'), { rows: 10, value: T('sample', 'https://websitefreetools.com/tim kiem?q=công cụ miễn phí&lang=vi') })}
      ${area('out', T('encoded', 'Chuỗi đã mã hoá'), { rows: 10 })}
    </div>
    ${errorBox('err')}
    <div class="row">${button('enc', T('encode', 'Mã hoá ↓'), true)}${button('dec', T('decode', 'Giải mã ↑'))}${button('copy', dk.copy())}</div>
    <p class="note">${T('note', 'Gõ vào ô bên trái để mã hoá, hoặc dán chuỗi có %XX vào ô bên phải rồi bấm Giải mã. Chữ có dấu tiếng Việt được đổi sang UTF-8.')}</p>
  </div>
  ${privacyNote()}
`;
const mode = () => val('mode');
function enc(): void {
  const s = val('in');
  showError('err', '');
  setVal('out', mode() === 'uri' ? encodeURI(s) : mode() === 'form' ? encodeURIComponent(s).replace(/%20/g, '+') : encodeURIComponent(s));
}
function dec(): void {
  showError('err', '');
  try {
    const s = val('out');
    setVal('in', decodeURIComponent(mode() === 'form' ? s.replace(/\+/g, ' ') : s));
  } catch {
    showError('err', T('bad', 'Chuỗi có ký tự % không hợp lệ (phải là % kèm 2 chữ số hex, ví dụ %20). Sửa chỗ sai rồi thử lại.'));
  }
}
onChange(['in', 'mode'], enc, 80);
el('enc').addEventListener('click', enc);
el('dec').addEventListener('click', dec);
bindCopy('copy', () => val('out'));
enc();
