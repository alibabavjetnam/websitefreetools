import { mountLayout } from '../layout';
import { $, escapeHtml } from '../ui';
import { pageText } from '../i18n';
import { area, check, button, bindCopy, el, privacyNote, val, setVal, checked, onChange, showError, errorBox } from '../lib/devkit';
import { jsonDiff, type JsonChange } from '../calc/devconv';

mountLayout({ activeTool: 'json-diff' });
const T = pageText();
const A = `{\n  "name": "WFTools",\n  "version": "1.2.0",\n  "tools": ["qr", "pdf", "barcode"],\n  "settings": { "theme": "light", "lang": "vi" }\n}`;
const B = `{\n  "name": "WFTools",\n  "version": "1.3.0",\n  "tools": ["qr", "pdf"],\n  "settings": { "theme": "dark", "lang": "vi", "beta": true }\n}`;

$('#tool-root').innerHTML = `
  <div class="workspace" style="margin-top:24px">
    ${area('a', T('a', 'JSON gốc (A)'), { rows: 14, value: A })}
    ${area('b', T('b', 'JSON mới (B)'), { rows: 14, value: B })}
  </div>
  ${errorBox('err')}
  <div class="panel" style="margin-top:16px">
    <div class="row">${check('order', T('order', 'Bỏ qua thứ tự phần tử trong mảng'))}${button('swap', T('swap', 'Đổi A ↔ B'))}${button('copy', T('copy', 'Sao chép báo cáo'))}</div>
    <p id="sum"></p>
    <table class="data-table data-table--compact"><thead><tr><th>${T('col.path', 'Đường dẫn')}</th><th>${T('col.kind', 'Thay đổi')}</th><th>A</th><th>B</th></tr></thead><tbody id="rows"></tbody></table>
  </div>
  ${privacyNote()}
`;
const KIND: Record<JsonChange['kind'], string> = { added: T('k.added', 'Thêm mới'), removed: T('k.removed', 'Bị xoá'), changed: T('k.changed', 'Đổi giá trị'), type: T('k.type', 'Đổi kiểu dữ liệu') };
const COLOR: Record<JsonChange['kind'], string> = { added: '#0e7a55', removed: '#b9000e', changed: '#0d6efd', type: '#8a5a00' };
let changes: JsonChange[] = [];
const show = (v: unknown) => (v === undefined ? '' : escapeHtml(JSON.stringify(v)));
function run(): void {
  showError('err', '');
  let a: unknown, b: unknown;
  try { a = JSON.parse(val('a')); } catch (e) { showError('err', T('badA', 'JSON A chưa hợp lệ: ') + (e as Error).message); return; }
  try { b = JSON.parse(val('b')); } catch (e) { showError('err', T('badB', 'JSON B chưa hợp lệ: ') + (e as Error).message); return; }
  changes = jsonDiff(a, b, '$', [], checked('order'));
  const cnt = (k: JsonChange['kind']) => changes.filter((c) => c.kind === k).length;
  el('sum').innerHTML = changes.length ? `<b>${T('diffCount', '{n} khác biệt').replace('{n}', String(changes.length))}</b> — ${KIND.added}: ${cnt('added')} · ${KIND.removed}: ${cnt('removed')} · ${KIND.changed}: ${cnt('changed') + cnt('type')}` : `<b class="ok-text">${T('same', 'Hai JSON giống hệt nhau về nội dung.')}</b>`;
  el('rows').innerHTML = changes.map((c) => `<tr><td class="mono">${escapeHtml(c.path)}</td><td style="color:${COLOR[c.kind]};font-weight:600">${KIND[c.kind]}</td><td class="mono">${show(c.from)}</td><td class="mono">${show(c.to)}</td></tr>`).join('');
}
el('swap').addEventListener('click', () => { const x = val('a'); setVal('a', val('b')); setVal('b', x); run(); });
onChange(['a', 'b', 'order'], run, 200);
bindCopy('copy', () => changes.map((c) => `${c.path}\t${KIND[c.kind]}\t${c.from === undefined ? '' : JSON.stringify(c.from)}\t${c.to === undefined ? '' : JSON.stringify(c.to)}`).join('\n'));
run();
