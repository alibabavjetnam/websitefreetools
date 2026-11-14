import { mountLayout } from '../layout';
import { $, escapeHtml } from '../ui';
import { pageText } from '../i18n';
import { area, button, select, bindCopy, dk, el, privacyNote, val, setVal, onChange } from '../lib/devkit';
import { encodeEntities, decodeEntities } from '../calc/encoding';

mountLayout({ activeTool: 'html-entities' });
const T = pageText();

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px">
    ${select('mode', T('mode', 'Kiểu mã hoá'), [['basic', escapeHtml(T('m.basic', 'Chỉ ký tự đặc biệt HTML (& < > " \')'))], ['named', T('m.named', 'Dùng tên thực thể khi có (&copy; &euro;…)')], ['all', T('m.all', 'Mọi ký tự ngoài ASCII thành mã số (&#233;)')]], 'basic')}
    <div class="workspace" style="margin-top:0">
      ${area('in', T('plain', 'Văn bản / mã HTML gốc'), { rows: 10, value: T('sample', '<p class="note">Giá: 5 € — © WFTools & bạn bè</p>') })}
      ${area('out', T('encoded', 'Đã mã hoá thực thể'), { rows: 10 })}
    </div>
    <div class="row">${button('enc', T('encode', 'Mã hoá →'), true)}${button('dec', T('decode', '← Giải mã'))}${button('copy', dk.copy())}</div>
    <p class="note">${T('note', 'Mã hoá giúp hiển thị mã HTML như chữ thường trên trang web (không bị trình duyệt chạy). Giải mã đổi &amp;lt; &amp;#233; … về ký tự thật.')}</p>
  </div>
  ${privacyNote()}
`;
const enc = () => setVal('out', encodeEntities(val('in'), val('mode') as 'basic'));
onChange(['in', 'mode'], enc, 60);
el('enc').addEventListener('click', enc);
el('dec').addEventListener('click', () => setVal('in', decodeEntities(val('out'))));
bindCopy('copy', () => val('out'));
enc();
