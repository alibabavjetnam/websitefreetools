import { mountLayout } from '../layout';
import { $, escapeHtml } from '../ui';
import { pageText, localeTag, currentLang } from '../i18n';
import { input, select, check, button, el, val, checked, onChange } from '../lib/devkit';
import { solarToLunar } from '../calc/lunar';

mountLayout({ activeTool: 'calendar-print' });
const T = pageText();
const now = new Date();
const sundayFirst = ['en', 'ja', 'zh', 'ko', 'pt', 'he', 'ar', 'hi', 'th', 'fil', 'zh-TW', 'yue'].includes(currentLang());

$('#tool-root').innerHTML = `
  <div class="panel cal-opts no-print" style="margin-top:24px">
    <div class="form-grid">
      ${select('view', T('view', 'Kiểu lịch'), [['month', T('v.month', 'Một tháng')], ['year', T('v.year', 'Cả năm (12 tháng)')]], 'month')}
      ${input('year', T('year', 'Năm'), { type: 'number', value: String(now.getFullYear()), attrs: 'min="1900" max="2199"' })}
      ${select('month', T('month', 'Tháng'), Array.from({ length: 12 }, (_, m) => [String(m), new Date(2026, m, 1).toLocaleString(localeTag(), { month: 'long' })] as [string, string]), String(now.getMonth()))}
      ${select('first', T('first', 'Tuần bắt đầu từ'), [['1', new Date(2026, 10, 16).toLocaleString(localeTag(), { weekday: 'long' })], ['0', new Date(2026, 10, 15).toLocaleString(localeTag(), { weekday: 'long' })]], sundayFirst ? '0' : '1')}
      ${input('title', T('title', 'Tiêu đề (không bắt buộc)'), { ph: T('titlePh', 'Lịch gia đình') })}
      ${input('color', T('color', 'Màu chủ đạo'), { type: 'color', value: '#0d6efd' })}
    </div>
    <div class="row">${check('lunar', T('lunar', 'Hiện ngày âm lịch'), currentLang() === 'vi' || currentLang() === 'zh')}${check('weekNo', T('weekNo', 'Hiện số tuần'))}${check('notes', T('notes', 'Thêm dòng ghi chú'), true)}</div>
    <div class="row">${button('print', T('print', 'In / Lưu PDF'), true)}${button('prev', '‹')}${button('next', '›')}</div>
    <p class="note">${T('printNote', 'Bấm In rồi chọn máy in, hoặc chọn "Lưu dưới dạng PDF". Nên chọn khổ A4, hướng ngang cho lịch tháng.')}</p>
  </div>
  <div id="cal" class="cal-sheet"></div>
`;
function weekNo(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  return Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}
function month(y: number, m: number, big: boolean): string {
  const first = Number(val('first'));
  const start = (new Date(y, m, 1).getDay() - first + 7) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const heads = Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 15 + ((i + first) % 7)).toLocaleString(localeTag(), { weekday: big ? 'short' : 'narrow' }));
  const today = new Date();
  let cells = '';
  const total = Math.ceil((start + days) / 7) * 7;
  for (let i = 0; i < total; i++) {
    const d = i - start + 1;
    const wk = checked('weekNo') && i % 7 === 0 ? `<td class="cal-wk">${weekNo(new Date(y, m, Math.max(1, Math.min(days, d))))}</td>` : '';
    if (i % 7 === 0) cells += `<tr>${wk}`;
    if (d < 1 || d > days) cells += '<td class="cal-empty"></td>';
    else {
      const dt = new Date(y, m, d);
      const dow = dt.getDay();
      let lun = '';
      if (checked('lunar')) { const l = solarToLunar(d, m + 1, y); lun = `<small class="cal-lun${l.day === 1 || l.day === 15 ? ' cal-lun-key' : ''}">${l.day === 1 ? `${l.day}/${l.month}${l.leap ? '*' : ''}` : l.day}</small>`; }
      const isToday = dt.toDateString() === today.toDateString();
      cells += `<td class="${dow === 0 ? 'cal-sun' : dow === 6 ? 'cal-sat' : ''}${isToday ? ' cal-today' : ''}"><span class="cal-d">${d}</span>${lun}</td>`;
    }
    if (i % 7 === 6) cells += '</tr>';
  }
  const name = new Date(y, m, 1).toLocaleString(localeTag(), { month: 'long', ...(big ? { year: 'numeric' } : {}) });
  return `<div class="cal-month${big ? ' cal-big' : ''}"><h3>${escapeHtml(name)}</h3><table><thead><tr>${checked('weekNo') ? '<th></th>' : ''}${heads.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${cells}</tbody></table>${big && checked('notes') ? `<div class="cal-notes"><b>${T('noteHead', 'Ghi chú')}</b></div>` : ''}</div>`;
}
function run(): void {
  const y = Math.min(2199, Math.max(1900, Number(val('year')) || now.getFullYear()));
  const m = Number(val('month'));
  const cal = el('cal');
  cal.style.setProperty('--cal', val('color'));
  const title = val('title') ? `<h2 class="cal-title">${escapeHtml(val('title'))}</h2>` : '';
  if (val('view') === 'year') cal.innerHTML = `${title}<h2 class="cal-year">${y}</h2><div class="cal-grid">${Array.from({ length: 12 }, (_, i) => month(y, i, false)).join('')}</div>`;
  else cal.innerHTML = title + month(y, m, true);
  (el('month').closest('.field') as HTMLElement).hidden = val('view') === 'year';
}
function shift(k: number): void {
  if (val('view') === 'year') (el<HTMLInputElement>('year')).value = String(Number(val('year')) + k);
  else {
    let m = Number(val('month')) + k, y = Number(val('year'));
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    (el<HTMLSelectElement>('month')).value = String(m); (el<HTMLInputElement>('year')).value = String(y);
  }
  run();
}
onChange(['view', 'year', 'month', 'first', 'title', 'color', 'lunar', 'weekNo', 'notes'], run, 60);
el('print').addEventListener('click', () => print());
el('prev').addEventListener('click', () => shift(-1));
el('next').addEventListener('click', () => shift(1));
run();
