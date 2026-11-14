import { mountLayout } from '../layout';
import { $, escapeHtml } from '../ui';
import { pageText } from '../i18n';
import { area, input, button, bindCopy, el, privacyNote, val, setVal, onChange, showError, errorBox } from '../lib/devkit';
import { jsonPath, sortKeys } from '../calc/devconv';

mountLayout({ activeTool: 'json-viewer' });
const T = pageText();
const SAMPLE = `{"store":{"name":"WFTools","books":[{"title":"Clean Code","price":32.5,"tags":["dev"]},{"title":"Refactoring","price":41,"tags":["dev","design"]},{"title":"Atomic Habits","price":18.9,"tags":["life"]}],"open":true,"rating":null}}`;

$('#tool-root').innerHTML = `
  <div class="workspace" style="margin-top:24px">
    <div class="panel">
      ${area('in', 'JSON', { rows: 16, value: SAMPLE })}
      ${errorBox('err')}
      <div class="row">${button('pretty', T('pretty', 'Làm đẹp'), true)}${button('sort', T('sort', 'Sắp xếp khoá A-Z'))}${button('expand', T('expand', 'Mở hết'))}${button('collapse', T('collapse', 'Thu gọn'))}</div>
      ${input('q', T('query', 'Truy vấn JSONPath'), { mono: true, value: '$.store.books[?(@.price<35)].title' })}
      <p class="note">${T('qHint', 'Ví dụ: $.store.books[0].title · $..price · $.store.books[*].tags · $.store.books[1:3] · [?(@.price>20)]')}</p>
      <pre class="output" id="qres"></pre>
      <div class="row">${button('copyq', T('copyQ', 'Sao chép kết quả truy vấn'))}</div>
    </div>
    <div class="panel">
      <span class="field-label">${T('tree', 'Dạng cây')} <span class="note" id="stat"></span></span>
      <div id="tree" class="jv-tree mono"></div>
      <p class="note">${T('treeHint', 'Bấm vào một dòng để xem đường dẫn JSONPath của nó.')}</p>
      <input id="path" class="mono" readonly />
    </div>
  </div>
  ${privacyNote()}
`;
let data: unknown = null;
function node(v: unknown, key: string, path: string, depth: number): string {
  const k = key ? `<span class="jv-k">${escapeHtml(key)}</span>: ` : '';
  if (v && typeof v === 'object') {
    const isArr = Array.isArray(v);
    const entries = isArr ? (v as unknown[]).map((x, i) => [String(i), x, `${path}[${i}]`] as const) : Object.entries(v as object).map(([kk, x]) => [kk, x, /^[A-Za-z_$][\w$]*$/.test(kk) ? `${path}.${kk}` : `${path}[${JSON.stringify(kk)}]`] as const);
    const sum = isArr ? `[${entries.length}]` : `{${entries.length}}`;
    return `<details${depth < 2 ? ' open' : ''}><summary data-path="${escapeHtml(path)}">${k}<span class="jv-n">${sum}</span></summary>${entries.map(([kk, x, p]) => node(x, kk, p, depth + 1)).join('')}</details>`;
  }
  const cls = v === null ? 'jv-null' : typeof v === 'string' ? 'jv-s' : typeof v === 'number' ? 'jv-num' : 'jv-b';
  return `<div class="jv-leaf" data-path="${escapeHtml(path)}">${k}<span class="${cls}">${escapeHtml(JSON.stringify(v))}</span></div>`;
}
function count(v: unknown): number { return v && typeof v === 'object' ? 1 + Object.values(v as object).reduce((a: number, x) => a + count(x), 0) : 1; }
function parse(): void {
  showError('err', '');
  try { data = JSON.parse(val('in')); }
  catch (e) { showError('err', T('bad', 'JSON chưa hợp lệ: ') + (e as Error).message); return; }
  el('tree').innerHTML = node(data, '', '$', 0);
  el('stat').textContent = T('nodes', '({n} nút)').replace('{n}', String(count(data)));
  query();
}
function query(): void {
  if (data == null) return;
  try {
    const r = jsonPath(data, val('q') || '$');
    el('qres').textContent = r.length ? JSON.stringify(r.length === 1 ? r[0].value : r.map((x) => x.value), null, 2) : T('none', '(không có kết quả)');
  } catch { el('qres').textContent = T('qBad', 'Truy vấn không hợp lệ.'); }
}
el('tree').addEventListener('click', (e) => {
  const p = (e.target as HTMLElement).closest<HTMLElement>('[data-path]')?.dataset.path;
  if (p) setVal('path', p);
});
el('pretty').addEventListener('click', () => { if (data != null) setVal('in', JSON.stringify(data, null, 2)); });
el('sort').addEventListener('click', () => { if (data != null) { data = sortKeys(data); setVal('in', JSON.stringify(data, null, 2)); parse(); } });
el('expand').addEventListener('click', () => el('tree').querySelectorAll('details').forEach((d) => (d.open = true)));
el('collapse').addEventListener('click', () => el('tree').querySelectorAll('details').forEach((d) => (d.open = false)));
onChange(['in'], parse, 200);
onChange(['q'], query, 120);
bindCopy('copyq', () => el('qres').textContent || '');
parse();
