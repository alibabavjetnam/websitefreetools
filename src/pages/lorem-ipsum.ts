import { mountLayout } from '../layout';
import { $, fmtInt, escapeHtml } from '../ui';
import { pageText } from '../i18n';
import { area, input, select, check, button, bindCopy, dk, el, privacyNote, val, setVal, checked, onChange } from '../lib/devkit';

mountLayout({ activeTool: 'lorem-ipsum' });
const T = pageText();
const WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum pellentesque habitant morbi tristique senectus netus malesuada fames ac turpis egestas vestibulum tortor quam feugiat vitae ultricies eget tempus metus aenean ultrices mauris placerat eleifend leo integer posuere erat a ante venenatis dapibus rhoncus mattis nunc sapien nec sagittis aliquam vivamus arcu felis bibendum lectus vulputate odio facilisis gravida neque convallis cras semper auctor urna nisl blandit volutpat maecenas accumsan lacus vel risus commodo viverra'.split(' ');
const START = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px">
    <div class="form-grid">
      ${input('n', T('n', 'Số lượng'), { type: 'number', value: '3', attrs: 'min="1" max="500"' })}
      ${select('unit', T('unit', 'Đơn vị'), [['p', T('u.p', 'Đoạn văn')], ['s', T('u.s', 'Câu')], ['w', T('u.w', 'Từ')], ['list', T('u.list', 'Mục danh sách')]], 'p')}
      ${select('fmt', T('fmt', 'Định dạng'), [['text', T('f.text', 'Văn bản thường')], ['html', escapeHtml(T('f.html', 'HTML (<p>, <li>)'))], ['md', 'Markdown']], 'text')}
    </div>
    <div class="row">${check('start', T('start', 'Bắt đầu bằng "Lorem ipsum dolor sit amet…"'), true)}</div>
    <div class="row">${button('gen', dk.generate(), true)}${button('copy', dk.copy())}<span class="note" id="stat"></span></div>
    ${area('out', dk.output(), { rows: 14, mono: false })}
    <p class="note">${T('note', 'Lorem ipsum là đoạn chữ giả tiếng Latin dùng để lấp chỗ khi thiết kế giao diện, in ấn, làm mẫu website trước khi có nội dung thật.')}</p>
  </div>
  ${privacyNote()}
`;
const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const word = () => WORDS[Math.floor(Math.random() * WORDS.length)];
function sentence(first: boolean): string {
  let s = first && checked('start') ? START : '';
  const n = rnd(6, 16);
  const ws: string[] = [];
  for (let i = 0; i < n; i++) ws.push(word());
  if (!s) s = ws.join(' ');
  else s += ' ' + ws.slice(0, rnd(2, 6)).join(' ');
  if (!(first && checked('start')) && s.split(' ').length > 9 && Math.random() < 0.5) { const p = s.split(' '); p[rnd(3, p.length - 3)] += ','; s = p.join(' '); }
  return s[0].toUpperCase() + s.slice(1) + '.';
}
const para = (first: boolean) => Array.from({ length: rnd(4, 7) }, (_, i) => sentence(first && i === 0)).join(' ');
function gen(): void {
  const n = Math.min(500, Math.max(1, Number(val('n')) || 1));
  const u = val('unit'), f = val('fmt');
  let items: string[];
  if (u === 'w') {
    const ws = checked('start') ? START.replace(',', '').toLowerCase().split(' ') : [];
    while (ws.length < n) ws.push(word());
    items = [ws.slice(0, n).join(' ')];
  } else if (u === 's') items = [Array.from({ length: n }, (_, i) => sentence(i === 0)).join(' ')];
  else if (u === 'list') items = Array.from({ length: n }, (_, i) => sentence(i === 0).replace(/\.$/, ''));
  else items = Array.from({ length: n }, (_, i) => para(i === 0));
  let out: string;
  if (u === 'list') out = f === 'html' ? `<ul>\n${items.map((x) => `  <li>${x}</li>`).join('\n')}\n</ul>` : items.map((x) => (f === 'md' ? '- ' : '• ') + x).join('\n');
  else out = f === 'html' ? items.map((x) => `<p>${x}</p>`).join('\n') : items.join('\n\n');
  setVal('out', out);
  const text = items.join(' ');
  el('stat').textContent = T('stat', '{w} từ · {c} ký tự').replace('{w}', fmtInt(text.split(/\s+/).filter(Boolean).length)).replace('{c}', fmtInt(text.length));
}
el('gen').addEventListener('click', gen);
onChange(['n', 'unit', 'fmt', 'start'], gen, 80);
bindCopy('copy', () => val('out'));
gen();
