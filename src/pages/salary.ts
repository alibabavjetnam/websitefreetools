import { mountLayout } from '../layout';
import { $, fmtInt, fmtMoney, moneyInput, setupTabs } from '../ui';
import { SALARY_RULES, grossToNet, netToGross, type Region, type SalaryResult } from '../calc/salary';

mountLayout({ activeTool: 'salary' });

const R = SALARY_RULES;
const root = $('#tool-root');
root.innerHTML = `
  <div class="tabs" role="tablist" aria-label="Chiều quy đổi">
    <button type="button" role="tab" data-tab="gross">Gross sang Net</button>
    <button type="button" role="tab" data-tab="net">Net sang Gross</button>
  </div>
  <div class="workspace tool-body">
    <form class="panel" id="sal-form" novalidate>
      <label class="field">
        <span class="field-label" id="amount-label">Lương Gross (tổng thu nhập trên hợp đồng)</span>
        <input id="amount" type="text" value="30.000.000" autocomplete="off" />
      </label>
      <div class="form-grid">
        <label class="field">
          <span class="field-label">Số người phụ thuộc</span>
          <input id="deps" type="number" min="0" max="20" step="1" value="0" />
        </label>
        <label class="field">
          <span class="field-label">Vùng làm việc</span>
          <select id="region">
            <option value="1">Vùng I (Hà Nội, TP.HCM nội thành…)</option>
            <option value="2">Vùng II</option>
            <option value="3">Vùng III</option>
            <option value="4">Vùng IV</option>
          </select>
        </label>
      </div>
      <fieldset class="field">
        <legend>Lương đóng bảo hiểm</legend>
        <label class="check"><input type="radio" name="ins" value="full" checked /><span>Bằng lương chính thức</span></label>
        <label class="check"><input type="radio" name="ins" value="custom" /><span>Mức khác</span></label>
        <input id="ins-amount" type="text" value="" placeholder="Nhập lương đóng bảo hiểm" disabled />
      </fieldset>
      <p class="note">Áp dụng quy định rà soát ngày ${R.reviewedAt}: giảm trừ bản thân ${fmtInt(R.personalDeduction)} đ, người phụ thuộc ${fmtInt(R.dependentDeduction)} đ/tháng; biểu thuế 5 bậc; lương cơ sở ${fmtInt(R.baseSalary)} đ.</p>
    </form>

    <section class="preview" aria-live="polite">
      <div class="stat-grid" id="summary"></div>
      <p class="error" id="sal-error" hidden></p>
      <div class="table-wrap"><table class="data-table" id="detail"></table></div>
    </section>
  </div>

  <h2 class="section-title" style="margin-top:32px">Chi phí của doanh nghiệp</h2>
  <div class="table-wrap"><table class="data-table" id="employer"></table></div>

  <h2 class="section-title" style="margin-top:32px">Thuế theo từng bậc</h2>
  <div class="table-wrap"><table class="data-table" id="bands"></table></div>
  <p class="note" style="margin-top:12px">Kết quả để tham khảo. Chưa tính phí công đoàn, các khoản phụ cấp được miễn thuế (ăn trưa, điện thoại…) và thu nhập khác. Căn cứ: Nghị định 161/2026/NĐ-CP (lương cơ sở), Nghị định 293/2025/NĐ-CP (lương tối thiểu vùng), Luật Thuế thu nhập cá nhân áp dụng từ kỳ tính thuế 2026.</p>
`;

let mode: 'gross' | 'net' = 'gross';
const amountInput = $<HTMLInputElement>('#amount');
const readAmount = moneyInput(amountInput);
const insInput = $<HTMLInputElement>('#ins-amount');
const readIns = moneyInput(insInput);
const form = $<HTMLFormElement>('#sal-form');
const errorBox = $('#sal-error');

setupTabs(root, (tab) => {
  mode = tab as 'gross' | 'net';
  $('#amount-label').textContent =
    mode === 'gross' ? 'Lương Gross (tổng thu nhập trên hợp đồng)' : 'Lương Net mong muốn (thực nhận)';
  render();
});

const row = (label: string, value: string, strong = false) =>
  `<tr${strong ? ' class="is-strong"' : ''}><td>${label}</td><td>${strong ? `<b>${value}</b>` : value}</td></tr>`;

function render(): void {
  const amount = readAmount();
  const custom = (form.querySelector<HTMLInputElement>('input[name="ins"]:checked')?.value ?? 'full') === 'custom';
  insInput.disabled = !custom;
  const insurance = custom ? readIns() : null;
  const deps = Math.max(0, Math.min(20, Math.floor(Number($<HTMLInputElement>('#deps').value) || 0)));
  const region = Number($<HTMLSelectElement>('#region').value) as Region;

  if (!Number.isFinite(amount) || amount <= 0) {
    errorBox.textContent = 'Hãy nhập số tiền lương lớn hơn 0, ví dụ 30.000.000.';
    errorBox.hidden = false;
    return;
  }
  if (custom && (!Number.isFinite(insurance as number) || (insurance as number) < 0)) {
    errorBox.textContent = 'Hãy nhập lương đóng bảo hiểm hợp lệ, hoặc chọn "Bằng lương chính thức".';
    errorBox.hidden = false;
    return;
  }
  errorBox.hidden = true;

  const rest = { insuranceSalary: insurance, region, dependents: deps };
  const r: SalaryResult = mode === 'gross' ? grossToNet({ ...rest, gross: amount }) : netToGross(amount, rest);

  $('#summary').innerHTML = `
    <div class="stat ${mode === 'gross' ? 'stat--main' : ''}"><span class="stat-label">Lương Net (thực nhận)</span><span class="stat-value">${fmtMoney(r.net)}</span></div>
    <div class="stat ${mode === 'net' ? 'stat--main' : ''}"><span class="stat-label">Lương Gross</span><span class="stat-value">${fmtMoney(r.gross)}</span></div>
    <div class="stat"><span class="stat-label">Bảo hiểm bạn đóng</span><span class="stat-value">${fmtMoney(r.employee.total)}</span></div>
    <div class="stat"><span class="stat-label">Thuế thu nhập cá nhân</span><span class="stat-value">${fmtMoney(r.tax)}</span></div>`;

  $('#detail').innerHTML = `<tbody>
    ${row('Lương Gross', fmtMoney(r.gross), true)}
    ${row(`Bảo hiểm xã hội (8% × ${fmtInt(r.socialBase)})`, `− ${fmtMoney(r.employee.social)}`)}
    ${row(`Bảo hiểm y tế (1,5% × ${fmtInt(r.socialBase)})`, `− ${fmtMoney(r.employee.health)}`)}
    ${row(`Bảo hiểm thất nghiệp (1% × ${fmtInt(r.unemploymentBase)})`, `− ${fmtMoney(r.employee.unemployment)}`)}
    ${row('Thu nhập trước thuế', fmtMoney(r.incomeBeforeTax))}
    ${row('Giảm trừ bản thân', `− ${fmtMoney(r.deductions.personal)}`)}
    ${row(`Giảm trừ ${deps} người phụ thuộc`, `− ${fmtMoney(r.deductions.dependents)}`)}
    ${row('Thu nhập tính thuế', fmtMoney(r.taxableIncome))}
    ${row('Thuế thu nhập cá nhân', `− ${fmtMoney(r.tax)}`)}
    ${row('Lương Net', fmtMoney(r.net), true)}
  </tbody>`;

  $('#employer').innerHTML = `<tbody>
    ${row('Lương Gross trả cho bạn', fmtMoney(r.gross))}
    ${row('Bảo hiểm xã hội (17,5%, gồm tai nạn lao động)', fmtMoney(r.employer.social))}
    ${row('Bảo hiểm y tế (3%)', fmtMoney(r.employer.health))}
    ${row('Bảo hiểm thất nghiệp (1%)', fmtMoney(r.employer.unemployment))}
    ${row('Tổng chi phí doanh nghiệp', fmtMoney(r.employerCost), true)}
  </tbody>`;

  const bandLabel = (from: number, to: number) =>
    to === Infinity ? `Trên ${fmtInt(from / 1e6)} triệu` : `${from === 0 ? 'Đến' : `Trên ${fmtInt(from / 1e6)} đến`} ${fmtInt(to / 1e6)} triệu`;
  const bandRows = R.brackets.map((b, i) => {
    const from = i === 0 ? 0 : R.brackets[i - 1].upTo;
    const hit = r.bands[i];
    return `<tr><td>${bandLabel(from, b.upTo)}</td><td>${Math.round(b.rate * 100)}%</td><td>${hit ? fmtMoney(hit.taxable) : '—'}</td><td>${hit ? fmtMoney(hit.tax) : '—'}</td></tr>`;
  });
  $('#bands').innerHTML = `<thead><tr><th>Thu nhập tính thuế / tháng</th><th>Thuế suất</th><th>Phần thu nhập</th><th>Tiền thuế</th></tr></thead>
    <tbody>${bandRows.join('')}</tbody><tfoot><tr><td>Tổng</td><td></td><td>${fmtMoney(r.taxableIncome)}</td><td>${fmtMoney(r.tax)}</td></tr></tfoot>`;
}

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', (e) => e.preventDefault());
render();
