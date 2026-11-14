import { mountLayout } from '../layout';
import { $ } from '../ui';

import { pageText, localeTag } from '../i18n';
import { area, button, select, input, check, bindCopy, bindDownload, dk, el, privacyNote, val, setVal, checked, onChange } from '../lib/devkit';
import { uuidV4, uuidV7, ulid, idTime } from '../calc/encoding';

mountLayout({ activeTool: 'uuid-gen' });
const T = pageText();

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px">
    <div class="form-grid">
      ${select('kind', T('kind', 'Loại mã'), [['v4', T('k.v4', 'UUID v4 (ngẫu nhiên)')], ['v7', T('k.v7', 'UUID v7 (theo thời gian, dễ sắp xếp)')], ['ulid', 'ULID'], ['nil', T('k.nil', 'UUID rỗng (toàn số 0)')]], 'v4')}
      ${input('count', T('count', 'Số lượng'), { type: 'number', value: '10', attrs: 'min="1" max="1000"' })}
    </div>
    <div class="row">${check('upper', T('upper', 'Chữ in hoa'))}${check('nodash', T('nodash', 'Bỏ dấu gạch ngang'))}${check('braces', T('braces', 'Bọc trong ngoặc { }'))}</div>
    <div class="row">${button('gen', dk.generate(), true)}${button('copy', dk.copy())}${button('dl', dk.download())}</div>
    ${area('out', dk.output(), { rows: 12, ro: true })}
  </div>
  <div class="panel" style="margin-top:16px">
    ${input('inspect', T('inspect', 'Dán một UUID/ULID để xem thông tin'), { mono: true })}
    <p class="note" id="info"></p>
  </div>
  ${privacyNote()}
`;
function gen(): void {
  const n = Math.min(1000, Math.max(1, Number(val('count')) || 1));
  const k = val('kind');
  const list: string[] = [];
  for (let i = 0; i < n; i++) {
    let id = k === 'v7' ? uuidV7() : k === 'ulid' ? ulid() : k === 'nil' ? '00000000-0000-0000-0000-000000000000' : uuidV4();
    if (k !== 'ulid') {
      if (checked('nodash')) id = id.replace(/-/g, '');
      if (checked('braces')) id = `{${id}}`;
    }
    list.push(checked('upper') ? id.toUpperCase() : k === 'ulid' ? id : id.toLowerCase());
  }
  setVal('out', list.join('\n'));
}
function inspect(): void {
  const s = val('inspect').trim().replace(/[{}]/g, '');
  const out = el('info');
  if (!s) { out.textContent = ''; return; }
  const hex = s.replace(/-/g, '');
  let msg: string;
  if (/^[0-9a-f]{32}$/i.test(hex)) {
    const ver = parseInt(hex[12], 16);
    msg = T('isUuid', 'UUID hợp lệ, phiên bản {v}.').replace('{v}', String(ver));
  } else if (/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(s)) msg = T('isUlid', 'ULID hợp lệ.');
  else { out.className = 'note error-text'; out.textContent = T('notId', 'Không phải UUID (32 chữ số hex) hay ULID (26 ký tự).'); return; }
  const tm = idTime(s);
  if (tm != null) msg += ' ' + T('created', 'Thời điểm tạo: {t}.').replace('{t}', new Date(tm).toLocaleString(localeTag()));
  out.className = 'note ok-text';
  out.textContent = msg;
}
el('gen').addEventListener('click', gen);
onChange(['kind', 'count', 'upper', 'nodash', 'braces'], gen, 100);
onChange(['inspect'], inspect, 80);
bindCopy('copy', () => val('out'));
bindDownload('dl', () => val('out'), () => 'ids.txt');
gen();
