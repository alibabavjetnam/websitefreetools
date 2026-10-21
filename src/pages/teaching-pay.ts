import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml, storage, toast } from '../ui';

mountLayout({ activeTool: 'teaching-pay' });

interface Session { id: string; date: string; title: string; hours: number; rate: number }
const store = storage<Session[]>('teaching-pay', []);
const rateStore = storage<number>('teaching-rate', 200000);
const newId = () => Math.random().toString(36).slice(2, 8);
const todayKey = () => new Date().toLocaleDateString('en-CA');
const vi = (n: number) => n.toLocaleString('vi-VN');
const money = (n: number) => n.toLocaleString('vi-VN') + ' đ';

const root = $('#tool-root');
root.innerHTML = `
  <div class="workspace">
    <form class="panel" id="form" novalidate>
      <div class="panel-title">Thêm buổi dạy</div>
      <div class="field-row">
        <label class="field"><span class="field-label">Ngày</span><input type="date" id="date" value="${todayKey()}" /></label>
        <label class="field" style="flex:2"><span class="field-label">Lớp / nội dung</span><input type="text" id="title" maxlength="80" placeholder="VD: Toán 12A, Ôn thi" /></label>
      </div>
      <div class="field-row">
        <label class="field"><span class="field-label">Số giờ</span><input type="number" id="hours" min="0.5" step="0.5" value="2" /></label>
        <label class="field"><span class="field-label">Đơn giá (đ/giờ)</span><input type="number" id="rate" min="0" step="10000" /></label>
      </div>
      <div class="actions"><button type="button" class="btn btn-primary" id="add">Thêm buổi</button></div>
    </form>
    <section class="preview"><div class="panel" id="summary"></div></section>
  </div>
  <div class="panel code-toolbar no-print" style="margin-top:16px">
    <label class="field field--inline"><span class="field-label">Lọc tháng</span><input type="month" id="filter" /></label>
    <div class="actions"><button type="button" class="btn" id="csv">Xuất CSV</button><button type="button" class="btn" id="print">In bảng kê</button></div>
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
    <div class="panel-title">Tổng kết${$<HTMLInputElement>('#filter').value ? ` tháng ${$<HTMLInputElement>('#filter').value.split('-').reverse().join('/')}` : ''}</div>
    <div class="stat-grid">
      <div class="stat"><span class="stat-label">Số buổi</span><span class="stat-value">${list.length}</span></div>
      <div class="stat"><span class="stat-label">Tổng giờ</span><span class="stat-value">${vi(totalHours)}</span></div>
      <div class="stat stat--main"><span class="stat-label">Tổng thù lao</span><span class="stat-value">${money(totalPay)}</span></div>
    </div>`;
  $('#list').innerHTML = list.length
    ? `<thead><tr><th>Ngày</th><th>Lớp / nội dung</th><th>Giờ</th><th>Đơn giá</th><th>Thành tiền</th><th class="no-print"></th></tr></thead>
      <tbody>${list.map((s) => `<tr><td>${s.date.split('-').reverse().join('/')}</td><td>${escapeHtml(s.title)}</td><td>${vi(s.hours)}</td><td>${money(s.rate)}</td><td><b>${money(s.hours * s.rate)}</b></td>
        <td class="no-print"><button type="button" class="btn btn-sm" data-del="${s.id}">Xoá</button></td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4">Tổng cộng</td><td><b>${money(totalPay)}</b></td><td class="no-print"></td></tr></tfoot>`
    : '<tbody><tr><td class="note">Chưa có buổi dạy nào.</td></tr></tbody>';
}

$('#add').addEventListener('click', () => {
  const date = $<HTMLInputElement>('#date').value;
  const title = $<HTMLInputElement>('#title').value.trim();
  const hours = Number($<HTMLInputElement>('#hours').value) || 0;
  const rate = Number($<HTMLInputElement>('#rate').value) || 0;
  if (!date || hours <= 0) return;
  rateStore.set(rate);
  store.set([...store.get(), { id: newId(), date, title: title || 'Buổi dạy', hours, rate }]);
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
  const rows = [['Ngày', 'Lớp/nội dung', 'Giờ', 'Đơn giá', 'Thành tiền'], ...filtered().map((s) => [s.date, s.title, String(s.hours), String(s.rate), String(s.hours * s.rate)])];
  const csv = '﻿' + rows.map((r) => r.map((c) => /[",;\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(';')).join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'gio-giang.csv');
  toast('Đã xuất CSV');
});
$('#print').addEventListener('click', () => { document.title = 'Bảng kê giờ giảng'; window.print(); });

$<HTMLInputElement>('#rate').value = String(rateStore.get());
render();
