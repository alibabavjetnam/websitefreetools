import { mountLayout } from '../layout';
import { $, escapeHtml } from '../ui';
import { pageText } from '../i18n';
import { area, input, select, check, button, bindCopy, el, privacyNote, val, checked } from '../lib/devkit';

mountLayout({ activeTool: 'team-split' });
const T = pageText();

$('#tool-root').innerHTML = `
  <div class="workspace" style="margin-top:24px">
    <div class="panel">
      ${area('names', T('names', 'Danh sách tên (mỗi dòng một người)'), { rows: 12, mono: false, value: T('sample', 'An\nBình\nChi\nDũng\nGiang\nHà\nKhang\nLinh\nMinh\nNgọc\nPhong\nQuỳnh') })}
      <p class="note" id="cnt"></p>
      <div class="form-grid">
        ${select('mode', T('mode', 'Chia theo'), [['teams', T('m.teams', 'Số đội')], ['size', T('m.size', 'Số người mỗi đội')]], 'teams')}
        ${input('n', T('n', 'Số lượng'), { type: 'number', value: '3', attrs: 'min="1" max="100"' })}
        ${input('prefix', T('prefix', 'Tên đội'), { value: T('team', 'Đội') })}
      </div>
      <div class="row">${check('leader', T('leader', 'Chọn đội trưởng ngẫu nhiên'))}${check('dedupe', T('dedupe', 'Bỏ tên trùng'), true)}</div>
      <div class="row">${button('go', T('go', 'Chia đội'), true)}${button('copy', T('copy', 'Sao chép kết quả'))}</div>
    </div>
    <div class="panel"><div id="out" class="ts-grid"><p class="note">${T('hint', 'Bấm "Chia đội" để xếp ngẫu nhiên. Bấm lại để chia lần khác.')}</p></div></div>
  </div>
  ${privacyNote()}
`;
let result: string[][] = [];
const names = () => { const l = val('names').split('\n').map((s) => s.trim()).filter(Boolean); return checked('dedupe') ? [...new Set(l)] : l; };
const upd = () => (el('cnt').textContent = T('count', '{n} người').replace('{n}', String(names().length)));
function go(): void {
  const l = names();
  for (let i = l.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [l[i], l[j]] = [l[j], l[i]]; }
  const n = Math.max(1, Number(val('n')) || 1);
  const k = val('mode') === 'teams' ? Math.min(n, l.length || 1) : Math.max(1, Math.ceil(l.length / n));
  result = Array.from({ length: k }, () => []);
  l.forEach((x, i) => result[i % k].push(x));
  el('out').innerHTML = result.map((team, i) => `<div class="ts-team"><h3>${escapeHtml(val('prefix'))} ${i + 1} <small>(${team.length})</small></h3><ol>${team.map((x, j) => `<li>${escapeHtml(x)}${checked('leader') && j === 0 ? ` <b>★ ${T('cap', 'đội trưởng')}</b>` : ''}</li>`).join('')}</ol></div>`).join('');
}
el('names').addEventListener('input', upd);
el('go').addEventListener('click', go);
bindCopy('copy', () => result.map((t, i) => `${val('prefix')} ${i + 1}: ${t.join(', ')}`).join('\n'));
upd();
