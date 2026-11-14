import { mountLayout } from '../layout';
import { $ } from '../ui';
import { pageText } from '../i18n';
import { area, select, button, bindCopy, dk, el, errorBox, showError, privacyNote, val, setVal, onChange } from '../lib/devkit';
import { escapeStr, unescapeStr, type EscapeMode } from '../calc/encoding';

mountLayout({ activeTool: 'string-escape' });
const T = pageText();

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px">
    ${select('mode', T('mode', 'Ngữ cảnh'), [['json', T('m.json', 'Chuỗi JSON')], ['js', T('m.js', 'Chuỗi JavaScript / Java / C#')], ['sql', T('m.sql', 'Chuỗi SQL (nháy đơn)')], ['csv', T('m.csv', 'Ô CSV')], ['regex', T('m.regex', 'Biểu thức chính quy (Regex)')], ['xml', 'XML / HTML'], ['shell', T('m.shell', 'Lệnh shell (bash)')]], 'json')}
    <div class="workspace" style="margin-top:0">
      ${area('in', T('raw', 'Chuỗi gốc'), { rows: 10, value: T('sample', 'Anh ấy nói: "Xin chào!"\nĐường dẫn: C:\\Users\\WFT\nGiá 50% (giảm)') })}
      ${area('out', T('escaped', 'Chuỗi đã thoát ký tự'), { rows: 10 })}
    </div>
    ${errorBox('err')}
    <div class="row">${button('esc', T('escape', 'Thoát ký tự →'), true)}${button('unesc', T('unescape', '← Bỏ thoát'))}${button('copy', dk.copy())}</div>
    <p class="note">${T('note', 'Dùng khi cần dán văn bản có dấu nháy, xuống dòng, dấu gạch chéo vào mã nguồn, câu lệnh SQL hay biểu thức regex mà không làm hỏng cú pháp.')}</p>
  </div>
  ${privacyNote()}
`;
const m = () => val('mode') as EscapeMode;
const esc = () => { showError('err', ''); setVal('out', escapeStr(val('in'), m())); };
onChange(['in', 'mode'], esc, 60);
el('esc').addEventListener('click', esc);
el('unesc').addEventListener('click', () => {
  showError('err', '');
  try { setVal('in', unescapeStr(val('out'), m())); }
  catch { showError('err', T('bad', 'Chuỗi có ký tự thoát không hợp lệ cho ngữ cảnh này. Kiểm tra dấu \\ hoặc dấu nháy bị thiếu.')); }
});
bindCopy('copy', () => val('out'));
esc();
