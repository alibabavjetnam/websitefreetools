import { mountLayout } from '../layout';
import { $, escapeHtml } from '../ui';
import { pageText, localeTag } from '../i18n';
import { input, select, button, bindCopy, el, privacyNote, val, setVal, onChange, showError, errorBox } from '../lib/devkit';
import { parseCron, cronNext, type CronField } from '../calc/devconv';

mountLayout({ activeTool: 'cron-gen' });
const T = pageText();
const PRESETS: [string, string][] = [
  ['* * * * *', T('p.everyMin', 'Mỗi phút')], ['*/5 * * * *', T('p.every5', 'Mỗi 5 phút')], ['0 * * * *', T('p.hourly', 'Đầu mỗi giờ')],
  ['0 8 * * *', T('p.daily8', 'Mỗi ngày lúc 8:00')], ['0 9 * * 1-5', T('p.weekday9', 'Thứ Hai đến thứ Sáu lúc 9:00')], ['30 23 * * 0', T('p.sun', 'Chủ nhật lúc 23:30')],
  ['0 0 1 * *', T('p.monthly', 'Ngày 1 hằng tháng lúc 0:00')], ['0 0 1 1 *', T('p.yearly', 'Ngày 1/1 hằng năm')], ['0 */6 * * *', T('p.every6h', 'Mỗi 6 giờ')],
];

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px">
    ${input('expr', T('expr', 'Biểu thức cron (phút giờ ngày tháng thứ)'), { mono: true, value: '0 9 * * 1-5' })}
    ${errorBox('err')}
    <div class="row">${button('copy', T('copy', 'Sao chép biểu thức'), true)}</div>
    <div class="row" id="presets">${PRESETS.map(([e, l]) => `<button type="button" class="btn btn-sm" data-e="${e}">${l}</button>`).join('')}</div>
  </div>
  <div class="workspace">
    <div class="panel">
      <h2 class="panel-title">${T('build', 'Tạo nhanh')}</h2>
      ${select('b-min', T('f.minute', 'Phút'), [['0', '0'], ['*', T('any', 'Mỗi')], ['*/5', T('every', 'Mỗi {n}').replace('{n}', '5')], ['*/10', T('every', 'Mỗi {n}').replace('{n}', '10')], ['*/15', T('every', 'Mỗi {n}').replace('{n}', '15')], ['*/30', T('every', 'Mỗi {n}').replace('{n}', '30')], ['30', '30']], '0')}
      ${select('b-hour', T('f.hour', 'Giờ'), [['*', T('any', 'Mỗi')], ...Array.from({ length: 24 }, (_, h) => [String(h), `${h}:00`] as [string, string]), ['*/2', T('every', 'Mỗi {n}').replace('{n}', '2')], ['9-17', '9–17']], '9')}
      ${select('b-dom', T('f.dom', 'Ngày trong tháng'), [['*', T('any', 'Mỗi')], ...Array.from({ length: 31 }, (_, d) => [String(d + 1), String(d + 1)] as [string, string]), ['1,15', '1, 15']], '*')}
      ${select('b-mon', T('f.month', 'Tháng'), [['*', T('any', 'Mỗi')], ...Array.from({ length: 12 }, (_, m) => [String(m + 1), monthName(m)] as [string, string]), ['*/3', T('quarter', 'Mỗi quý')]], '*')}
      ${select('b-dow', T('f.dow', 'Thứ trong tuần'), [['*', T('any', 'Mỗi')], ['1-5', T('weekdays', 'Thứ Hai – thứ Sáu')], ['0,6', T('weekend', 'Cuối tuần')], ...Array.from({ length: 7 }, (_, d) => [String(d), dayName(d)] as [string, string])], '1-5')}
      ${button('apply', T('apply', 'Dùng biểu thức này'))}
    </div>
    <div class="panel">
      <h2 class="panel-title">${T('meaning', 'Ý nghĩa')}</h2>
      <table class="data-table dk-table data-table--compact"><tbody id="fields"></tbody></table>
      <h2 class="panel-title">${T('next', '10 lần chạy tiếp theo (giờ máy bạn)')}</h2>
      <ol id="next" class="plain-list"></ol>
    </div>
  </div>
  ${privacyNote()}
`;
function monthName(m: number): string { return new Date(2026, m, 1).toLocaleString(localeTag(), { month: 'long' }); }
function dayName(d: number): string { return new Date(2026, 10, 15 + d).toLocaleString(localeTag(), { weekday: 'long' }); }
function desc(f: CronField, label: (n: number) => string, total: number): string {
  if (f.any || f.values.length === total) return T('any', 'Mỗi');
  return f.values.map(label).join(', ');
}
function run(): void {
  showError('err', '');
  try {
    const c = parseCron(val('expr'));
    const pad = (n: number) => String(n).padStart(2, '0');
    const rows: [string, string][] = [
      [T('f.minute', 'Phút'), desc(c.minute, pad, 60)], [T('f.hour', 'Giờ'), desc(c.hour, String, 24)], [T('f.dom', 'Ngày trong tháng'), desc(c.dom, String, 31)],
      [T('f.month', 'Tháng'), desc(c.month, (m) => monthName(m - 1), 12)], [T('f.dow', 'Thứ trong tuần'), desc(c.dow, dayName, 7)],
    ];
    el('fields').innerHTML = rows.map(([a, b]) => `<tr><th>${a}</th><td>${escapeHtml(b)}</td></tr>`).join('');
    const next = cronNext(c, new Date(), 10);
    el('next').innerHTML = next.length ? next.map((d) => `<li>${escapeHtml(d.toLocaleString(localeTag(), { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }))}</li>`).join('') : `<li>${T('never', 'Biểu thức không bao giờ chạy (ví dụ ngày 31/2).')}</li>`;
  } catch {
    showError('err', T('bad', 'Biểu thức chưa đúng. Cần đủ 5 phần cách nhau bằng dấu cách: phút (0-59) giờ (0-23) ngày (1-31) tháng (1-12) thứ (0-6, 0 = Chủ nhật). Dùng * , - / như */5 hoặc 1-5.'));
    el('fields').innerHTML = ''; el('next').innerHTML = '';
  }
}
el('presets').addEventListener('click', (e) => {
  const x = (e.target as HTMLElement).closest<HTMLElement>('[data-e]')?.dataset.e;
  if (x) { setVal('expr', x); run(); }
});
el('apply').addEventListener('click', () => { setVal('expr', ['b-min', 'b-hour', 'b-dom', 'b-mon', 'b-dow'].map(val).join(' ')); run(); });
onChange(['expr'], run, 100);
bindCopy('copy', () => val('expr'));
run();
