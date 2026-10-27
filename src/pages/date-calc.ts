import { mountLayout } from '../layout';
import { $, fmtInt, setupTabs, storage } from '../ui';
import { pageText, localeTag } from '../i18n';
import { parseKey, toKey, todayKey, daysBetween, ymd, addMonths, addDays, weekdaysBetween } from '../calc/dates';

mountLayout({ activeTool: 'date-calc' });
const T = pageText();
const LOCALE = localeTag();

const st = storage<{ a: string; b: string; incl: boolean; base: string; sign: string; y: string; m: string; w: string; d: string; biz: boolean }>('date-calc', {
  a: '', b: '', incl: false, base: '', sign: '+', y: '0', m: '0', w: '0', d: '30', biz: false,
});
const s0 = st.get();

$('#tool-root').innerHTML = `
  <div class="tabs" role="tablist" style="margin-top:24px">
    <button type="button" role="tab" data-tab="diff">${T('tabDiff', 'Khoảng cách giữa hai ngày')}</button>
    <button type="button" role="tab" data-tab="add">${T('tabAdd', 'Cộng / trừ ngày')}</button>
  </div>
  <div class="tool-body">
    <div class="workspace" data-panel="diff">
      <form class="panel" id="f-diff" novalidate>
        <div class="field-row">
          <label class="field"><span class="field-label">${T('start', 'Ngày bắt đầu')}</span><input type="date" id="a" /></label>
          <label class="field"><span class="field-label">${T('end', 'Ngày kết thúc')}</span><input type="date" id="b" /></label>
        </div>
        <label class="check"><input type="checkbox" id="incl" /><span>${T('incl', 'Tính cả ngày kết thúc (cộng thêm 1 ngày)')}</span></label>
        <div class="row">
          <button type="button" class="btn btn-sm" data-quick="today">${T('qToday', 'Bắt đầu từ hôm nay')}</button>
          <button type="button" class="btn btn-sm" data-quick="newyear">${T('qNewYear', 'Đến ngày đầu năm sau')}</button>
          <button type="button" class="btn btn-sm" data-quick="xmas">${T('qXmas', 'Đến Giáng sinh')}</button>
        </div>
      </form>
      <section class="preview">
        <div class="stat stat--main"><span class="stat-label">${T('totalDays', 'Tổng số ngày')}</span><span class="stat-value" id="d-total">—</span></div>
        <div class="stat-grid" id="d-stats"></div>
        <p class="note" id="d-note"></p>
      </section>
    </div>
    <div class="workspace" data-panel="add" hidden>
      <form class="panel" id="f-add" novalidate>
        <label class="field"><span class="field-label">${T('from', 'Từ ngày')}</span><input type="date" id="base" /></label>
        <div class="segmented" role="radiogroup">
          <label><input type="radio" name="sign" value="+" /><span>${T('plus', 'Cộng thêm')}</span></label>
          <label><input type="radio" name="sign" value="-" /><span>${T('minus', 'Trừ đi')}</span></label>
        </div>
        <div class="field-row">
          <label class="field"><span class="field-label">${T('years', 'Năm')}</span><input type="number" id="y" min="0" step="1" /></label>
          <label class="field"><span class="field-label">${T('months', 'Tháng')}</span><input type="number" id="m" min="0" step="1" /></label>
          <label class="field"><span class="field-label">${T('weeks', 'Tuần')}</span><input type="number" id="w" min="0" step="1" /></label>
          <label class="field"><span class="field-label">${T('days', 'Ngày')}</span><input type="number" id="d" min="0" step="1" /></label>
        </div>
        <label class="check"><input type="checkbox" id="biz" /><span>${T('biz', 'Chỉ đếm ngày làm việc (bỏ thứ Bảy, Chủ nhật) cho phần ngày')}</span></label>
      </form>
      <section class="preview">
        <div class="stat stat--main"><span class="stat-label">${T('result', 'Kết quả')}</span><span class="stat-value" id="r-date">—</span></div>
        <p class="note" id="r-note"></p>
      </section>
    </div>
  </div>
`;
setupTabs($('#tool-root'));

const $i = (id: string) => $<HTMLInputElement>('#' + id);
const longDate = (d: Date) => d.toLocaleDateString(LOCALE, { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const stat = (label: string, value: string) => `<div class="stat"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`;

const today = todayKey();
$i('a').value = s0.a || today;
$i('b').value = s0.b || toKey(addMonths(parseKey(today) as Date, 3));
$i('incl').checked = s0.incl;
$i('base').value = s0.base || today;
for (const k of ['y', 'm', 'w', 'd'] as const) $i(k).value = s0[k];
$i('biz').checked = s0.biz;
document.querySelectorAll<HTMLInputElement>('input[name=sign]').forEach((r) => (r.checked = r.value === s0.sign));

function save(): void {
  st.set({
    a: $i('a').value, b: $i('b').value, incl: $i('incl').checked, base: $i('base').value,
    sign: document.querySelector<HTMLInputElement>('input[name=sign]:checked')?.value ?? '+',
    y: $i('y').value, m: $i('m').value, w: $i('w').value, d: $i('d').value, biz: $i('biz').checked,
  });
}

function renderDiff(): void {
  const a = parseKey($i('a').value);
  const b = parseKey($i('b').value);
  if (!a || !b) { $('#d-total').textContent = '—'; $('#d-stats').innerHTML = ''; return; }
  const [s, e] = a <= b ? [a, b] : [b, a];
  const incl = $i('incl').checked ? 1 : 0;
  const days = daysBetween(s, e) + incl;
  const r = ymd(s, addDays(e, incl));
  $('#d-total').textContent = `${fmtInt(days)} ${T('daysU', 'ngày')}`;
  const bizEnd = incl ? e : addDays(e, -1);
  const biz = bizEnd < s ? 0 : weekdaysBetween(s, bizEnd);
  $('#d-stats').innerHTML = [
    stat(T('ymd', 'Năm, tháng, ngày'), `${fmtInt(r.y)} ${T('yU', 'năm')} ${fmtInt(r.m)} ${T('mU', 'tháng')} ${fmtInt(r.d)} ${T('daysU', 'ngày')}`),
    stat(T('inWeeks', 'Theo tuần'), `${fmtInt(Math.floor(days / 7))} ${T('wU', 'tuần')} ${days % 7 ? `${days % 7} ${T('daysU', 'ngày')}` : ''}`),
    stat(T('weekdays', 'Ngày làm việc (T2–T6)'), fmtInt(biz)),
    stat(T('weekends', 'Ngày cuối tuần'), fmtInt(days - biz)),
    stat(T('hours', 'Số giờ'), fmtInt(days * 24)),
    stat(T('minutes', 'Số phút'), fmtInt(days * 1440)),
  ].join('');
  $('#d-note').textContent = `${longDate(s)} → ${longDate(e)}${a > b ? ` · ${T('swapped', 'đã đổi chỗ hai ngày cho đúng thứ tự')}` : ''}`;
  save();
}

function renderAdd(): void {
  const base = parseKey($i('base').value);
  if (!base) { $('#r-date').textContent = '—'; return; }
  const sign = document.querySelector<HTMLInputElement>('input[name=sign]:checked')?.value === '-' ? -1 : 1;
  const n = (id: string) => Math.max(0, Math.floor(Number($i(id).value) || 0));
  let d = addMonths(base, sign * (n('y') * 12 + n('m')));
  d = addDays(d, sign * n('w') * 7);
  let days = n('d');
  if ($i('biz').checked) {
    while (days > 0) { d = addDays(d, sign); const dow = d.getUTCDay(); if (dow !== 0 && dow !== 6) days--; }
  } else d = addDays(d, sign * days);
  $('#r-date').textContent = longDate(d);
  const diff = daysBetween(base, d);
  const tpl = diff >= 0 ? T('afterTpl', '{n} ngày sau {date}') : T('beforeTpl', '{n} ngày trước {date}');
  $('#r-note').textContent = `${tpl.replace('{n}', fmtInt(Math.abs(diff))).replace('{date}', longDate(base))} · ISO: ${toKey(d)}`;
  save();
}

$('#f-diff').addEventListener('input', renderDiff);
$('#f-add').addEventListener('input', renderAdd);
document.querySelectorAll<HTMLButtonElement>('[data-quick]').forEach((b) => b.addEventListener('click', () => {
  const t = parseKey(today) as Date;
  const y = t.getUTCFullYear();
  if (b.dataset.quick === 'today') $i('a').value = today;
  if (b.dataset.quick === 'newyear') { $i('a').value = today; $i('b').value = `${y + 1}-01-01`; }
  if (b.dataset.quick === 'xmas') { $i('a').value = today; $i('b').value = t > (parseKey(`${y}-12-25`) as Date) ? `${y + 1}-12-25` : `${y}-12-25`; }
  renderDiff();
}));
renderDiff();
renderAdd();
