import { mountLayout } from '../layout';
import { $, escapeHtml } from '../ui';
import { pageText } from '../i18n';
import { area, input, check, button, bindCopy, el, privacyNote, val, setVal, checked, onChange, showError, errorBox } from '../lib/devkit';

mountLayout({ activeTool: 'regex-tester' });
const T = pageText();
const PRESETS: [string, string, string][] = [
  ['email', T('p.email', 'Email'), '[\\w.+-]+@[\\w-]+\\.[\\w.-]+'],
  ['phone', T('p.phone', 'Số điện thoại'), '\\+?\\d[\\d\\s.-]{7,}\\d'],
  ['url', T('p.url', 'Đường dẫn URL'), 'https?:\\/\\/[^\\s"\'<>]+'],
  ['date', T('p.date', 'Ngày dd/mm/yyyy'), '\\b(0?[1-9]|[12]\\d|3[01])\\/(0?[1-9]|1[0-2])\\/(\\d{4})\\b'],
  ['ipv4', 'IPv4', '\\b(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\b'],
  ['hex', T('p.hex', 'Mã màu HEX'), '#(?:[0-9a-fA-F]{3}){1,2}\\b'],
  ['num', T('p.num', 'Số (có phần thập phân)'), '-?\\d+(?:[.,]\\d+)?'],
];

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px">
    <div class="row" id="presets">${PRESETS.map(([k, l]) => `<button type="button" class="btn btn-sm" data-p="${k}">${l}</button>`).join('')}</div>
    <div class="form-grid">
      ${input('re', T('pattern', 'Biểu thức (không cần dấu / ở hai đầu)'), { mono: true, value: PRESETS[0][2] })}
      <div class="field"><span class="field-label">${T('flags', 'Cờ')}</span><div class="row">${check('g', T('f.g', 'g: tìm tất cả'), true)}${check('i', T('f.i', 'i: không phân biệt hoa thường'), true)}${check('m', T('f.m', 'm: nhiều dòng'))}${check('s', T('f.s', 's: dấu . khớp cả xuống dòng'))}${check('u', 'u: Unicode', true)}</div></div>
    </div>
    ${errorBox('err')}
    ${area('text', T('text', 'Văn bản thử'), { rows: 8, mono: false, value: T('sample', 'Liên hệ: hotro@websitefreetools.com hoặc sales@vidu.vn, điện thoại +84 912 345 678. Hạn chót 15/12/2026. Website https://websitefreetools.com') })}
    <div class="field"><span class="field-label">${T('highlight', 'Kết quả tô sáng')} <span id="count" class="note"></span></span><div class="output" id="hl" style="font-family:inherit;white-space:pre-wrap;word-break:break-word"></div></div>
    <table class="data-table data-table--compact"><thead><tr><th>#</th><th>${T('match', 'Chuỗi khớp')}</th><th>${T('index', 'Vị trí')}</th><th>${T('groups', 'Nhóm')}</th></tr></thead><tbody id="rows"></tbody></table>
  </div>
  <div class="panel" style="margin-top:16px">
    <h2 class="panel-title">${T('replaceTitle', 'Thay thế')}</h2>
    ${input('rep', T('replaceWith', 'Thay bằng ($1, $2… là nhóm, $& là cả chuỗi khớp)'), { mono: true, value: '[$&]' })}
    ${area('repOut', T('replaced', 'Văn bản sau khi thay'), { rows: 5, ro: true, mono: false })}
    <div class="row">${button('copy', T('copy', 'Sao chép kết quả'))}</div>
  </div>
  <div class="panel" style="margin-top:16px">
    <h2 class="panel-title">${T('cheatTitle', 'Ký hiệu hay dùng')}</h2>
    <table class="data-table data-table--compact"><tbody>
      <tr><td class="mono">\\d \\w \\s</td><td>${T('c.class', 'Chữ số, chữ/số/gạch dưới, khoảng trắng')}</td></tr>
      <tr><td class="mono">. ^ $</td><td>${T('c.anchor', 'Ký tự bất kỳ, đầu dòng, cuối dòng')}</td></tr>
      <tr><td class="mono">* + ? {2,5}</td><td>${T('c.quant', '0 lần trở lên, 1 lần trở lên, có hoặc không, từ 2 đến 5 lần')}</td></tr>
      <tr><td class="mono">[abc] [^abc] [a-z]</td><td>${T('c.set', 'Một trong các ký tự, không phải các ký tự, khoảng ký tự')}</td></tr>
      <tr><td class="mono">( ) (?: ) (?&lt;ten&gt; )</td><td>${T('c.group', 'Nhóm có đánh số, nhóm không lưu, nhóm có tên')}</td></tr>
      <tr><td class="mono">a|b \\b (?= ) (?! )</td><td>${T('c.alt', 'Hoặc, ranh giới từ, nhìn trước khớp, nhìn trước không khớp')}</td></tr>
    </tbody></table>
  </div>
  ${privacyNote()}
`;
function flags(): string { return ['g', 'i', 'm', 's', 'u'].filter((f) => checked(f)).join(''); }
function run(): void {
  showError('err', '');
  const text = val('text');
  let re: RegExp;
  try { re = new RegExp(val('re'), flags().includes('g') ? flags() : flags() + 'g'); }
  catch (e) { showError('err', T('bad', 'Biểu thức sai cú pháp: ') + (e as Error).message); el('hl').textContent = text; el('rows').innerHTML = ''; return; }
  const ms = val('re') ? [...text.matchAll(re)].slice(0, checked('g') ? 1000 : 1) : [];
  let html = '', last = 0;
  for (const m of ms) {
    const i = m.index ?? 0;
    html += escapeHtml(text.slice(last, i)) + `<mark>${escapeHtml(m[0]) || '​'}</mark>`;
    last = i + m[0].length;
  }
  el('hl').innerHTML = html + escapeHtml(text.slice(last));
  el('count').textContent = '(' + T('found', '{n} kết quả').replace('{n}', String(ms.length)) + ')';
  el('rows').innerHTML = ms.slice(0, 200).map((m, k) => `<tr><td>${k + 1}</td><td class="mono">${escapeHtml(m[0])}</td><td>${m.index}</td><td class="mono">${m.slice(1).map((g, j) => `$${j + 1}=${escapeHtml(g ?? '∅')}`).join(' ')}${m.groups ? ' ' + Object.entries(m.groups).map(([n, g]) => `${escapeHtml(n)}=${escapeHtml(g ?? '∅')}`).join(' ') : ''}</td></tr>`).join('');
  try { setVal('repOut', text.replace(new RegExp(val('re'), flags()), val('rep'))); } catch { setVal('repOut', ''); }
}
el('presets').addEventListener('click', (e) => {
  const k = (e.target as HTMLElement).closest<HTMLElement>('[data-p]')?.dataset.p;
  const p = PRESETS.find((x) => x[0] === k);
  if (p) { setVal('re', p[2]); run(); }
});
onChange(['re', 'text', 'rep', 'g', 'i', 'm', 's', 'u'], run, 100);
bindCopy('copy', () => val('repOut'));
run();
