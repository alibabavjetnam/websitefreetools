import { mountLayout } from '../layout';
import { $, escapeHtml, storage } from '../ui';
import { vnHolidaysBetween, workdaysBetween } from '../calc/workdays';
import { pageText, currentLang } from '../i18n';

mountLayout({ activeTool: 'workdays' });
const T = pageText();
const LOCALE = ({ en: 'en-US', vi: 'vi-VN', ja: 'ja-JP', zh: 'zh-CN', es: 'es-ES', de: 'de-DE' } as Record<string, string>)[currentLang()] || 'en-US';

const todayKey = () => new Date().toLocaleDateString('en-CA');
const addMonths = (k: string, n: number) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1 + n, d).toLocaleDateString('en-CA'); };
const vi = (n: number) => n.toLocaleString(LOCALE);
const fmt = (k: string) => {
  if (currentLang() === 'vi') return k.split('-').reverse().join('/');
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(LOCALE, { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' });
};

const cfg = storage<{ useVnHolidays: boolean; excludeWeekend: boolean; sat: boolean; sun: boolean; custom: string }>('workdays-cfg', { useVnHolidays: true, excludeWeekend: true, sat: true, sun: true, custom: '' });

const root = $('#tool-root');
root.innerHTML = `
  <div class="workspace">
    <form class="panel" id="form" novalidate>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('from','Từ ngày')}</span><input type="date" id="from" value="${todayKey()}" /></label>
        <label class="field"><span class="field-label">${T('to','Đến ngày')}</span><input type="date" id="to" value="${addMonths(todayKey(), 1)}" /></label>
      </div>
      <fieldset class="field">
        <legend>${T('daysOff','Ngày nghỉ')}</legend>
        <label class="check"><input type="checkbox" id="ex-weekend" /><span>${T('exWeekend','Trừ ngày cuối tuần')}</span></label>
        <div class="row" style="margin:6px 0 0 24px">
          <label class="check"><input type="checkbox" id="sat" /><span>${T('sat','Thứ Bảy')}</span></label>
          <label class="check"><input type="checkbox" id="sun" /><span>${T('sun','Chủ nhật')}</span></label>
        </div>
        <label class="check" style="margin-top:8px"><input type="checkbox" id="vn-holidays" /><span>${T('vnHolidays','Trừ ngày lễ Việt Nam (Tết, 30/4, 1/5, 2/9, Giỗ Tổ…)')}</span></label>
      </fieldset>
      <label class="field"><span class="field-label">${T('customDays','Ngày nghỉ thêm (mỗi dòng một ngày, dạng 2026-12-25)')}</span><textarea id="custom" rows="3" class="mono" placeholder="2026-12-25&#10;2026-11-20"></textarea></label>
    </form>
    <section class="preview"><div class="stat-grid" id="result"></div><div class="panel" id="holiday-list"></div></section>
  </div>
  <p class="note">${T('note','Ngày lễ Việt Nam có sẵn cho các năm 2024–2027 (Tết và Giỗ Tổ tính theo âm lịch nên cần bảng tra riêng từng năm); ngoài khoảng này chỉ tính các ngày lễ dương lịch cố định. Có thể thêm ngày nghỉ của riêng bạn ở ô bên dưới.')}</p>
`;

function render(): void {
  const from = $<HTMLInputElement>('#from').value;
  const to = $<HTMLInputElement>('#to').value;
  const c = {
    useVnHolidays: $<HTMLInputElement>('#vn-holidays').checked,
    excludeWeekend: $<HTMLInputElement>('#ex-weekend').checked,
    sat: $<HTMLInputElement>('#sat').checked,
    sun: $<HTMLInputElement>('#sun').checked,
    custom: $<HTMLTextAreaElement>('#custom').value,
  };
  cfg.set(c);
  if (!from || !to) { $('#result').innerHTML = `<p class="note">${T('pickDates','Chọn đủ hai mốc ngày.')}</p>`; $('#holiday-list').innerHTML = ''; return; }

  const y1 = Number(from.slice(0, 4)), y2 = Number(to.slice(0, 4));
  const labels = c.useVnHolidays ? vnHolidaysBetween(Math.min(y1, y2), Math.max(y1, y2), (k, vi) => T('hol.' + k, vi)) : new Map<string, string>();
  for (const d of c.custom.split('\n').map((x) => x.trim()).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x))) labels.set(d, labels.get(d) ?? T('customOff','Nghỉ thêm'));
  const weekendDays = [c.sun ? 0 : -1, c.sat ? 6 : -1].filter((x) => x >= 0);

  const r = workdaysBetween(from, to, { excludeWeekend: c.excludeWeekend, weekendDays, holidays: new Set(labels.keys()) }, labels, T('holiday','Ngày lễ'));
  $('#result').innerHTML = `
    <div class="stat stat--main"><span class="stat-label">${T('workDays','Số ngày làm việc')}</span><span class="stat-value">${vi(r.workDays)} ${T('days','ngày')}</span></div>
    <div class="stat"><span class="stat-label">${T('totalDays','Tổng số ngày')}</span><span class="stat-value">${vi(r.totalDays)}</span></div>
    <div class="stat"><span class="stat-label">${T('weekendDays','Ngày cuối tuần')}</span><span class="stat-value">${vi(r.weekendDays)}</span></div>
    <div class="stat"><span class="stat-label">${T('holidayDays','Ngày lễ')}</span><span class="stat-value">${vi(r.holidayDays)}</span></div>`;
  $('#holiday-list').innerHTML = r.holidaysOnWorkweek.length
    ? `<div class="panel-title">${T('holidaysOnWork','Ngày lễ rơi vào ngày làm việc')}</div><ul class="plain-list">${r.holidaysOnWorkweek.map((h) => `<li><b>${fmt(h.date)}</b> — ${escapeHtml(h.label)}</li>`).join('')}</ul>`
    : '';
}

const c0 = cfg.get();
$<HTMLInputElement>('#vn-holidays').checked = c0.useVnHolidays;
$<HTMLInputElement>('#ex-weekend').checked = c0.excludeWeekend;
$<HTMLInputElement>('#sat').checked = c0.sat;
$<HTMLInputElement>('#sun').checked = c0.sun;
$<HTMLTextAreaElement>('#custom').value = c0.custom;
$('#form').addEventListener('input', render);
render();
