import { mountLayout } from '../layout';
import { $, downloadBlob, fmtDec, fmtInt, fmtMoney, moneyInput, parseNumber } from '../ui';
import { loanSchedule, type LoanMethod } from '../calc/loan';

mountLayout({ activeTool: 'loan' });

$('#tool-root').innerHTML = `
  <div class="workspace tool-body">
    <form class="panel" id="loan-form" novalidate>
      <label class="field">
        <span class="field-label">Số tiền vay</span>
        <input id="principal" type="text" value="1.000.000.000" autocomplete="off" />
      </label>
      <div class="form-grid">
        <label class="field">
          <span class="field-label">Thời hạn vay</span>
          <input id="term" type="number" min="1" max="600" step="1" value="20" />
        </label>
        <label class="field">
          <span class="field-label">Đơn vị</span>
          <select id="term-unit"><option value="12">Năm</option><option value="1">Tháng</option></select>
        </label>
        <label class="field">
          <span class="field-label">Lãi suất (%/năm)</span>
          <input id="rate" type="text" inputmode="decimal" value="10,5" />
        </label>
      </div>
      <fieldset class="field">
        <legend>Cách trả nợ</legend>
        <label class="check"><input type="radio" name="method" value="declining" checked /><span>Gốc đều, lãi giảm dần (phổ biến ở ngân hàng Việt Nam)</span></label>
        <label class="check"><input type="radio" name="method" value="annuity" /><span>Trả góp đều mỗi tháng</span></label>
      </fieldset>
      <details class="options">
        <summary>Lãi suất ưu đãi ban đầu</summary>
        <div class="options-body">
          <div class="form-grid">
            <label class="field">
              <span class="field-label">Số tháng ưu đãi</span>
              <input id="promo-months" type="number" min="0" max="600" step="1" value="0" />
            </label>
            <label class="field">
              <span class="field-label">Lãi ưu đãi (%/năm)</span>
              <input id="promo-rate" type="text" inputmode="decimal" value="7" />
            </label>
          </div>
          <p class="note">Hết thời gian ưu đãi, lãi suất chuyển sang mức ở trên (lãi thả nổi).</p>
        </div>
      </details>
    </form>

    <section class="preview" aria-live="polite">
      <div class="stat-grid" id="summary"></div>
      <p class="error" id="loan-error" hidden></p>
      <p class="note" id="loan-note"></p>
    </section>
  </div>

  <div class="row" style="margin-top:32px; justify-content: space-between">
    <h2 class="section-title" style="margin:0">Lịch trả nợ</h2>
    <button type="button" class="btn btn-sm" id="export">Tải bảng (CSV)</button>
  </div>
  <div class="table-wrap is-tall" style="margin-top:12px"><table class="data-table" id="schedule"></table></div>
  <p class="note" style="margin-top:12px">Kết quả để tham khảo. Số tiền thực tế phụ thuộc cách ngân hàng tính ngày lãi, phí trả nợ trước hạn và biến động lãi suất thả nổi.</p>
`;

const form = $<HTMLFormElement>('#loan-form');
const readPrincipal = moneyInput($<HTMLInputElement>('#principal'));
const errorBox = $('#loan-error');
let lastRows: ReturnType<typeof loanSchedule>['rows'] = [];

function render(): void {
  const principal = readPrincipal();
  const months = Math.round(Number($<HTMLInputElement>('#term').value) * Number($<HTMLSelectElement>('#term-unit').value));
  const rate = parseNumber($<HTMLInputElement>('#rate').value);
  const promoMonths = Math.max(0, Math.round(Number($<HTMLInputElement>('#promo-months').value) || 0));
  const promoRate = parseNumber($<HTMLInputElement>('#promo-rate').value);
  const method = (form.querySelector<HTMLInputElement>('input[name="method"]:checked')?.value ?? 'declining') as LoanMethod;

  const problem =
    !Number.isFinite(principal) || principal <= 0 ? 'Hãy nhập số tiền vay lớn hơn 0.'
    : !Number.isFinite(months) || months < 1 || months > 600 ? 'Thời hạn vay phải từ 1 tháng đến 50 năm.'
    : !Number.isFinite(rate) || rate < 0 || rate > 100 ? 'Lãi suất phải từ 0 đến 100 %/năm.'
    : promoMonths > 0 && (!Number.isFinite(promoRate) || promoRate < 0 || promoRate > 100) ? 'Lãi ưu đãi phải từ 0 đến 100 %/năm.'
    : '';
  errorBox.textContent = problem;
  errorBox.hidden = !problem;
  if (problem) return;

  const res = loanSchedule({ principal, months, annualRate: rate, method, promoMonths, promoRate: promoMonths > 0 ? promoRate : rate });
  lastRows = res.rows;

  const firstLabel = method === 'annuity' && promoMonths === 0 ? 'Trả mỗi tháng' : 'Tháng đầu trả';
  $('#summary').innerHTML = `
    <div class="stat stat--main"><span class="stat-label">${firstLabel}</span><span class="stat-value">${fmtMoney(res.firstPayment)}</span></div>
    <div class="stat"><span class="stat-label">Tổng tiền lãi</span><span class="stat-value">${fmtMoney(res.totalInterest)}</span></div>
    <div class="stat"><span class="stat-label">Tổng gốc + lãi</span><span class="stat-value">${fmtMoney(res.totalPaid)}</span></div>
    <div class="stat"><span class="stat-label">Trả nhiều nhất / ít nhất một tháng</span><span class="stat-value" style="font-size:1rem">${fmtMoney(res.maxPayment)}<br>${fmtMoney(res.minPayment)}</span></div>`;
  $('#loan-note').textContent =
    method === 'declining'
      ? 'Gốc đều: mỗi tháng trả cùng một khoản gốc, tiền lãi tính trên dư nợ còn lại nên số tiền trả giảm dần.'
      : 'Trả góp đều: mỗi tháng trả cùng một số tiền (thay đổi khi hết ưu đãi), phần gốc tăng dần, phần lãi giảm dần.';

  $('#schedule').innerHTML = `
    <thead><tr><th>Tháng</th><th>Lãi suất</th><th>Tiền gốc</th><th>Tiền lãi</th><th>Tổng trả</th><th>Dư nợ còn lại</th></tr></thead>
    <tbody>${res.rows
      .map((r) => `<tr><td>${r.month}</td><td>${fmtDec(r.rate)}%</td><td>${fmtInt(r.principal)}</td><td>${fmtInt(r.interest)}</td><td>${fmtInt(r.payment)}</td><td>${fmtInt(r.balance)}</td></tr>`)
      .join('')}</tbody>
    <tfoot><tr><td>Tổng</td><td></td><td>${fmtInt(principal)}</td><td>${fmtInt(res.totalInterest)}</td><td>${fmtInt(res.totalPaid)}</td><td></td></tr></tfoot>`;
}

$('#export').addEventListener('click', () => {
  if (!lastRows.length) return;
  const lines = ['Thang,Lai suat %/nam,Tien goc,Tien lai,Tong tra,Du no con lai'];
  lastRows.forEach((r) =>
    lines.push([r.month, r.rate, Math.round(r.principal), Math.round(r.interest), Math.round(r.payment), Math.round(r.balance)].join(',')),
  );
  // BOM để Excel mở đúng UTF-8
  downloadBlob(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }), 'lich-tra-no.csv');
});

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', (e) => e.preventDefault());
render();
