import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml, fmtInt, fmtMoney, moneyInput } from '../ui';
import { SheetStore, newId } from '../google/sync';

mountLayout({ activeTool: 'expense' });

interface Tx { id: string; date: string; type: string; category: string; amount: number; note: string }
interface Budget { id: string; category: string; limit: number }
type Data = { tx: Tx[]; budgets: Budget[] };

const EXPENSE_CATS = ['Ăn uống', 'Đi lại', 'Nhà ở & hoá đơn', 'Mua sắm', 'Sức khoẻ', 'Giáo dục', 'Giải trí', 'Gia đình & con cái', 'Hiếu hỉ, biếu tặng', 'Khác'];
const INCOME_CATS = ['Lương', 'Thưởng', 'Kinh doanh', 'Đầu tư', 'Được cho, tặng', 'Khác'];

const store = new SheetStore<Data>({
  tag: 'expense',
  title: 'WFTools - Chi tiêu',
  empty: { tx: [], budgets: [] },
  tables: {
    tx: {
      sheet: 'Giao dịch',
      columns: [
        { key: 'id', label: 'Mã' }, { key: 'date', label: 'Ngày' }, { key: 'type', label: 'Loại' },
        { key: 'category', label: 'Danh mục' }, { key: 'amount', label: 'Số tiền', type: 'number' }, { key: 'note', label: 'Ghi chú' },
      ],
    },
    budgets: {
      sheet: 'Ngân sách',
      columns: [{ key: 'id', label: 'Mã' }, { key: 'category', label: 'Danh mục' }, { key: 'limit', label: 'Hạn mức tháng', type: 'number' }],
    },
  },
});

const today = () => new Date().toLocaleDateString('en-CA');
const pad = (n: number) => String(n).padStart(2, '0');
const nowMonth = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
// Bảng tính có thể trả ngày dạng "2026-10-20" hoặc "20/10/2026" nếu người dùng sửa tay
const normDate = (s: string) => { const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]}-${pad(+m[2])}-${pad(+m[1])}` : s; };

const root = $('#tool-root');
root.innerHTML = `
  <div class="tool-body">
    <div class="row" style="justify-content:space-between">
      <label class="field" style="flex-direction:row;align-items:center;gap:10px">
        <span class="field-label" style="margin:0">Tháng</span>
        <input type="month" id="month" class="input-inline" />
      </label>
      <button type="button" class="btn btn-sm" id="export">Tải CSV tháng này</button>
    </div>
    <div class="stat-grid" id="summary" style="margin-top:14px"></div>
  </div>

  <div class="workspace" style="margin-top:20px">
    <form class="panel" id="tx-form" novalidate>
      <h2 class="panel-title">Thêm giao dịch</h2>
      <div class="segmented" role="radiogroup" aria-label="Loại giao dịch">
        <label><input type="radio" name="type" value="chi" checked /><span>Khoản chi</span></label>
        <label><input type="radio" name="type" value="thu" /><span>Khoản thu</span></label>
      </div>
      <div class="form-grid">
        <label class="field"><span class="field-label">Số tiền</span><input id="amount" type="text" placeholder="50.000" autocomplete="off" /></label>
        <label class="field"><span class="field-label">Ngày</span><input id="date" type="date" /></label>
        <label class="field"><span class="field-label">Danh mục</span><select id="category"></select></label>
        <label class="field"><span class="field-label">Ghi chú</span><input id="note" type="text" maxlength="200" placeholder="Không bắt buộc" /></label>
      </div>
      <p class="error" id="tx-error" hidden></p>
      <div class="row"><button type="submit" class="btn btn-primary">Thêm</button></div>
    </form>

    <section class="panel">
      <h2 class="panel-title">Chi theo danh mục</h2>
      <div id="by-cat" class="cat-bars"></div>
      <details class="options">
        <summary>Đặt hạn mức chi mỗi tháng</summary>
        <div class="options-body">
          <div class="form-grid">
            <label class="field"><span class="field-label">Danh mục</span><select id="b-cat">${EXPENSE_CATS.map((c) => `<option>${c}</option>`).join('')}</select></label>
            <label class="field"><span class="field-label">Hạn mức / tháng</span><input id="b-limit" type="text" placeholder="3.000.000" /></label>
          </div>
          <div class="row"><button type="button" class="btn" id="b-save">Lưu hạn mức</button><span class="note">Nhập 0 để bỏ hạn mức.</span></div>
        </div>
      </details>
    </section>
  </div>

  <h2 class="section-title" style="margin-top:28px">Giao dịch trong tháng</h2>
  <div class="table-wrap is-tall"><table class="data-table" id="tx-table"></table></div>
`;
store.mount(root);

const monthInput = $<HTMLInputElement>('#month');
monthInput.value = nowMonth();
$<HTMLInputElement>('#date').value = today();
const readAmount = moneyInput($<HTMLInputElement>('#amount'));
const readLimit = moneyInput($<HTMLInputElement>('#b-limit'));
const form = $<HTMLFormElement>('#tx-form');

function txType(): 'chi' | 'thu' {
  return (form.querySelector<HTMLInputElement>('input[name="type"]:checked')?.value ?? 'chi') as 'chi' | 'thu';
}
function fillCategories(): void {
  const cats = txType() === 'chi' ? EXPENSE_CATS : INCOME_CATS;
  $('#category').innerHTML = cats.map((c) => `<option>${c}</option>`).join('');
}

function monthTx(d: Data): Tx[] {
  return d.tx.filter((t) => normDate(t.date).startsWith(monthInput.value)).sort((a, b) => normDate(b.date).localeCompare(normDate(a.date)));
}

function render(): void {
  const d = store.get();
  const list = monthTx(d);
  const income = list.filter((t) => t.type === 'thu').reduce((s, t) => s + t.amount, 0);
  const expense = list.filter((t) => t.type !== 'thu').reduce((s, t) => s + t.amount, 0);
  $('#summary').innerHTML = `
    <div class="stat"><span class="stat-label">Tổng thu</span><span class="stat-value ok-text">${fmtMoney(income)}</span></div>
    <div class="stat"><span class="stat-label">Tổng chi</span><span class="stat-value">${fmtMoney(expense)}</span></div>
    <div class="stat stat--main"><span class="stat-label">Còn lại</span><span class="stat-value">${fmtMoney(income - expense)}</span></div>`;

  // Chi theo danh mục, kèm hạn mức nếu có
  const byCat = new Map<string, number>();
  list.filter((t) => t.type !== 'thu').forEach((t) => byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount));
  d.budgets.forEach((b) => b.limit > 0 && !byCat.has(b.category) && byCat.set(b.category, 0));
  const rows = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const maxSpent = Math.max(1, ...rows.map((r) => r[1]));
  $('#by-cat').innerHTML = rows.length
    ? rows
        .map(([cat, spent]) => {
          const limit = d.budgets.find((b) => b.category === cat)?.limit ?? 0;
          const pct = limit > 0 ? spent / limit : spent / maxSpent;
          const over = limit > 0 && spent > limit;
          return `<div class="cat-bar${over ? ' is-over' : ''}">
            <div class="cat-bar-head"><span>${escapeHtml(cat)}</span><span>${fmtInt(spent)}${limit > 0 ? ` / ${fmtInt(limit)}` : ''}</span></div>
            <div class="cat-bar-track"><i style="width:${Math.min(100, pct * 100).toFixed(1)}%"></i></div>
            ${over ? `<span class="cat-bar-note">Vượt hạn mức ${fmtMoney(spent - limit)}</span>` : ''}
          </div>`;
        })
        .join('')
    : '<p class="note">Chưa có khoản chi nào trong tháng này.</p>';

  $('#tx-table').innerHTML = list.length
    ? `<thead><tr><th>Ngày</th><th>Danh mục</th><th>Ghi chú</th><th>Số tiền</th><th></th></tr></thead><tbody>${list
        .map(
          (t) => `<tr><td>${escapeHtml(normDate(t.date).split('-').reverse().join('/'))}</td><td>${escapeHtml(t.category)}</td>
          <td>${escapeHtml(t.note)}</td><td class="${t.type === 'thu' ? 'ok-text' : ''}">${t.type === 'thu' ? '+' : '−'}${fmtInt(t.amount)}</td>
          <td><button type="button" class="btn btn-sm" data-del="${escapeHtml(t.id)}" aria-label="Xoá giao dịch">Xoá</button></td></tr>`,
        )
        .join('')}</tbody>`
    : '<tbody><tr><td class="note">Chưa có giao dịch. Thêm khoản thu chi đầu tiên ở khung bên trên.</td></tr></tbody>';
}

form.addEventListener('change', (e) => {
  if ((e.target as HTMLInputElement).name === 'type') fillCategories();
});
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const amount = readAmount();
  const date = $<HTMLInputElement>('#date').value;
  const err = $('#tx-error');
  const problem = !Number.isFinite(amount) || amount <= 0 ? 'Hãy nhập số tiền lớn hơn 0.' : !date ? 'Hãy chọn ngày.' : '';
  err.textContent = problem;
  err.hidden = !problem;
  if (problem) return;
  const d = store.get();
  const tx: Tx = { id: newId(), date, type: txType(), category: $<HTMLSelectElement>('#category').value, amount: Math.round(amount), note: $<HTMLInputElement>('#note').value.trim() };
  store.set({ ...d, tx: [...d.tx, tx] });
  $<HTMLInputElement>('#amount').value = '';
  $<HTMLInputElement>('#note').value = '';
  if (!date.startsWith(monthInput.value)) monthInput.value = date.slice(0, 7);
  render();
  $<HTMLInputElement>('#amount').focus();
});

$('#tx-table').addEventListener('click', (e) => {
  const id = (e.target as HTMLElement).closest<HTMLElement>('[data-del]')?.dataset.del;
  if (!id) return;
  const d = store.get();
  store.set({ ...d, tx: d.tx.filter((t) => t.id !== id) });
  render();
});

$('#b-save').addEventListener('click', () => {
  const limit = readLimit();
  const cat = $<HTMLSelectElement>('#b-cat').value;
  if (!Number.isFinite(limit) || limit < 0) return;
  const d = store.get();
  const others = d.budgets.filter((b) => b.category !== cat);
  store.set({ ...d, budgets: limit > 0 ? [...others, { id: newId(), category: cat, limit: Math.round(limit) }] : others });
  render();
});

$('#export').addEventListener('click', () => {
  const list = monthTx(store.get());
  const csv = ['Ngay,Loai,Danh muc,So tien,Ghi chu', ...list.map((t) => [normDate(t.date), t.type, t.category, t.amount, t.note].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))];
  downloadBlob(new Blob(['﻿' + csv.join('\n')], { type: 'text/csv;charset=utf-8' }), `chi-tieu-${monthInput.value}.csv`);
});

monthInput.addEventListener('change', render);
store.onChange(render);
fillCategories();
render();
