import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml, storage, toast } from '../ui';
import { pageText, currentLang } from '../i18n';

mountLayout({ activeTool: 'teaching-pay' });
const T = pageText();
const LOCALE = ({ en: 'en-US', vi: 'vi-VN', ja: 'ja-JP', zh: 'zh-CN', es: 'es-ES', de: 'de-DE', ru: 'ru-RU' } as Record<string, string>)[currentLang()] || 'en-US';

interface Session { id: string; date: string; title: string; hours: number; rate: number }
const store = storage<Session[]>('teaching-pay', []);
const rateStore = storage<number>('teaching-rate', 200000);
const newId = () => Math.random().toString(36).slice(2, 8);
const todayKey = () => new Date().toLocaleDateString('en-CA');
const vi = (n: number) => n.toLocaleString(LOCALE);
const fmtD = (k: string) => {
  if (currentLang() === 'vi') return k.split('-').reverse().join('/');
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(LOCALE, { year: 'numeric', month: 'short', day: 'numeric' });
};
const money = (n: number) => n.toLocaleString(LOCALE) + ' đ';

const root = $('#tool-root');
root.innerHTML = `
  <div class="workspace">
    <form class="panel" id="form" novalidate>
      <div class="panel-title">${T('addSession','Thêm buổi dạy')}</div>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('date','Ngày')}</span><input type="date" id="date" value="${todayKey()}" /></label>
        <label class="field" style="flex:2"><span class="field-label">${T('classContent','Lớp / nội dung')}</span><input type="text" id="title" maxlength="80" placeholder="${T('classPh','VD: Toán 12A, Ôn thi')}" /></label>
      </div>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('hours','Số giờ')}</span><input type="number" id="hours" min="0.5" step="0.5" value="2" /></label>
        <label class="field"><span class="field-label">${T('rate','Đơn giá (đ/giờ)')}</span><input type="number" id="rate" min="0" step="10000" /></label>
      </div>
      <div class="actions"><button type="button" class="btn btn-primary" id="add">${T('add','Thêm buổi')}</button></div>
    </form>
    <section class="preview"><div class="panel" id="summary"></div></section>
  </div>
  <div class="panel code-toolbar no-print" style="margin-top:16px">
    <label class="field field--inline"><span class="field-label">${T('filterMonth','Lọc tháng')}</span><input type="month" id="filter" /></label>
    <div class="actions"><button type="button" class="btn" id="csv">${T('csv','Xuất CSV')}</button><button type="button" class="btn" id="print">${T('print','In bảng kê')}</button></div>
  </div>
  <div class="table-wrap" style="margin-top:12px"><table class="data-table" id="list"></table></div>
`;

function filtered(): Session[] {
  const f = $<HTMLInputElement>('#filter').value;
  const list = [...store.get()].sort((a, b) => b.date.localeCompare(a.date));
  return f ? list.filter((s) => s.date.startsWith(f)) : list;
}

function render(): void {
  const list = filtered();
  const totalHours = list.reduce((a, s) => a + s.hours, 0);
  const totalPay = list.reduce((a, s) => a + s.hours * s.rate, 0);
  $('#summary').innerHTML = `
    <div class="panel-title">${T('summary','Tổng kết')}${$<HTMLInputElement>('#filter').value ? ` ${T('monthPrefix','tháng')} ${currentLang() === 'vi' ? $<HTMLInputElement>('#filter').value.split('-').reverse().join('/') : new Date(Number($<HTMLInputElement>('#filter').value.slice(0, 4)), Number($<HTMLInputElement>('#filter').value.slice(5, 7)) - 1, 1).toLocaleDateString(LOCALE, { year: 'numeric', month: 'long' })}` : ''}</div>
    <div class="stat-grid">
      <div class="stat"><span class="stat-label">${T('numSessions','Số buổi')}</span><span class="stat-value">${list.length}</span></div>
      <div class="stat"><span class="stat-label">${T('totalHours','Tổng giờ')}</span><span class="stat-value">${vi(totalHours)}</span></div>
      <div class="stat stat--main"><span class="stat-label">${T('totalPay','Tổng thù lao')}</span><span class="stat-value">${money(totalPay)}</span></div>
    </div>`;
  $('#list').innerHTML = list.length
    ? `<thead><tr><th>${T('th.date','Ngày')}</th><th>${T('th.class','Lớp / nội dung')}</th><th>${T('th.hours','Giờ')}</th><th>${T('th.rate','Đơn giá')}</th><th>${T('th.amount','Thành tiền')}</th><th class="no-print"></th></tr></thead>
      <tbody>${list.map((s) => `<tr><td>${fmtD(s.date)}</td><td>${escapeHtml(s.title)}</td><td>${vi(s.hours)}</td><td>${money(s.rate)}</td><td><b>${money(s.hours * s.rate)}</b></td>
        <td class="no-print"><button type="button" class="btn btn-sm" data-del="${s.id}">${T('del','Xoá')}</button></td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4">${T('grandTotal','Tổng cộng')}</td><td><b>${money(totalPay)}</b></td><td class="no-print"></td></tr></tfoot>`
    : `<tbody><tr><td class="note">${T('empty','Chưa có buổi dạy nào.')}</td></tr></tbody>`;
}

$('#add').addEventListener('click', () => {
  const date = $<HTMLInputElement>('#date').value;
  const title = $<HTMLInputElement>('#title').value.trim();
  const hours = Number($<HTMLInputElement>('#hours').value) || 0;
  const rate = Number($<HTMLInputElement>('#rate').value) || 0;
  if (!date || hours <= 0) return;
  rateStore.set(rate);
  store.set([...store.get(), { id: newId(), date, title: title || T('defaultTitle','Buổi dạy'), hours, rate }]);
  $<HTMLInputElement>('#title').value = '';
  render();
});
$('#list').addEventListener('click', (e) => {
  const id = (e.target as HTMLElement).closest<HTMLElement>('[data-del]')?.dataset.del;
  if (!id) return;
  store.set(store.get().filter((s) => s.id !== id));
  render();
});
$('#filter').addEventListener('change', render);
$('#csv').addEventListener('click', () => {
  const rows = [[T('th.date','Ngày'), T('th.class','Lớp / nội dung'), T('th.hours','Giờ'), T('th.rate','Đơn giá'), T('th.amount','Thành tiền')], ...filtered().map((s) => [s.date, s.title, String(s.hours), String(s.rate), String(s.hours * s.rate)])];
  const csv = '﻿' + rows.map((r) => r.map((c) => /[",;\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(';')).join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), T('csvName','gio-giang.csv'));
  toast(T('toast.csv','Đã xuất CSV'));
});
$('#print').addEventListener('click', () => { document.title = T('printTitle','Bảng kê giờ giảng'); window.print(); });

$<HTMLInputElement>('#rate').value = String(rateStore.get());
render();
