import { mountLayout } from '../layout';
import { $, fmtDec, fmtInt, fmtVnd as fmtMoney, moneyInput } from '../ui';
import { PIT_RULES, computePit, type PitYear } from '../calc/pit';
import type { Region } from '../calc/salary';
import { pageText } from '../i18n';

mountLayout({ activeTool: 'pit-tax' });
const T = pageText();

$('#tool-root').innerHTML = `
  <p class="note" style="margin-bottom:12px"><b>${T('vnOnly','Dành cho Việt Nam.')}</b> ${T('vnOnlyNote','Công cụ này tính theo quy định thuế thu nhập cá nhân và bảo hiểm của Việt Nam (tiền Việt Nam đồng, đ). Không áp dụng cho các nước khác.')}</p>
  <div class="workspace tool-body">
    <form class="panel" id="pit-form" novalidate>
      <label class="field">
        <span class="field-label">${T('year','Năm tính thuế')}</span>
        <select id="year">
          <option value="2026">${T('year.2026','2026 (quy định mới: 5 bậc, giảm trừ 15,5 triệu)')}</option>
          <option value="2025">${T('year.2025','2025 (quy định cũ: 7 bậc, giảm trừ 11 triệu)')}</option>
        </select>
      </label>
      <label class="field">
        <span class="field-label">${T('salary','Lương bình quân mỗi tháng (đã gồm phụ cấp chịu thuế)')}</span>
        <input id="salary" type="text" value="${fmtInt(30000000)}" autocomplete="off" />
      </label>
      <div class="form-grid">
        <label class="field">
          <span class="field-label">${T('months','Số tháng có lương trong năm')}</span>
          <input id="months" type="number" min="1" max="12" step="1" value="12" />
        </label>
        <label class="field">
          <span class="field-label">${T('bonus','Thưởng Tết, tháng 13 và thu nhập chịu thuế khác')}</span>
          <input id="bonus" type="text" value="${fmtInt(30000000)}" autocomplete="off" />
        </label>
      </div>
      <div class="form-grid">
        <label class="field">
          <span class="field-label">${T('deps','Số người phụ thuộc')}</span>
          <input id="deps" type="number" min="0" max="20" step="1" value="0" />
        </label>
        <label class="field">
          <span class="field-label">${T('depMonths','Số tháng tính giảm trừ gia cảnh')}</span>
          <input id="dep-months" type="number" min="0" max="12" step="1" value="12" />
        </label>
      </div>
      <label class="field">
        <span class="field-label">${T('withheld','Thuế đã bị khấu trừ trong năm')}</span>
        <input id="withheld" type="text" value="${fmtInt(0)}" autocomplete="off" />
      </label>
      <details class="options">
        <summary>${T('more','Bảo hiểm, khoản miễn thuế và từ thiện')}</summary>
        <div class="options-body">
          <fieldset class="field">
            <legend>${T('insLegend','Lương đóng bảo hiểm')}</legend>
            <label class="check"><input type="radio" name="ins" value="full" checked /><span>${T('ins.full','Bằng lương hằng tháng')}</span></label>
            <label class="check"><input type="radio" name="ins" value="custom" /><span>${T('ins.custom','Mức khác')}</span></label>
            <input id="ins-amount" type="text" value="" placeholder="${T('ins.ph','Nhập lương đóng bảo hiểm mỗi tháng')}" disabled />
          </fieldset>
          <label class="field">
            <span class="field-label">${T('region','Vùng làm việc')}</span>
            <select id="region">
              <option value="1">${T('region.1','Vùng I (Hà Nội, TP.HCM nội thành…)')}</option>
              <option value="2">${T('region.2','Vùng II')}</option>
              <option value="3">${T('region.3','Vùng III')}</option>
              <option value="4">${T('region.4','Vùng IV')}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">${T('exempt','Phụ cấp, khoản được miễn thuế trong năm')}</span>
            <input id="exempt" type="text" value="${fmtInt(0)}" autocomplete="off" />
          </label>
          <label class="field">
            <span class="field-label">${T('charity','Đóng góp từ thiện, nhân đạo, khuyến học')}</span>
            <input id="charity" type="text" value="${fmtInt(0)}" autocomplete="off" />
          </label>
        </div>
      </details>
    </form>

    <section class="preview" aria-live="polite">
      <div class="stat-grid" id="summary"></div>
      <p class="error" id="pit-error" hidden></p>
      <div class="table-wrap"><table class="data-table" id="detail"></table></div>
    </section>
  </div>

  <h2 class="section-title" style="margin-top:32px">${T('bonusTitle','Thuế của khoản thưởng')}</h2>
  <div class="table-wrap"><table class="data-table" id="bonus-table"></table></div>

  <h2 class="section-title" style="margin-top:32px">${T('bandsTitle','Thuế theo từng bậc (cả năm)')}</h2>
  <div class="table-wrap"><table class="data-table" id="bands"></table></div>
  <p class="note" style="margin-top:12px" id="rules-note"></p>
  <p class="note" style="margin-top:12px">${T('footNote','Kết quả để tham khảo, chưa tính thu nhập nhiều nơi, thu nhập ngoài tiền lương và các trường hợp riêng. Căn cứ: Luật Thuế thu nhập cá nhân số 109/2025/QH15, Nghị quyết 110/2025/UBTVQH15 (từ kỳ tính thuế 2026), Luật số 04/2007/QH12 và Nghị quyết 954/2020/UBTVQH14 (năm 2025). Hạn quyết toán: 31/3 với doanh nghiệp, 30/4 với cá nhân tự quyết toán.')}</p>
`;

const form = $<HTMLFormElement>('#pit-form');
const readSalary = moneyInput($<HTMLInputElement>('#salary'));
const readBonus = moneyInput($<HTMLInputElement>('#bonus'));
const readWithheld = moneyInput($<HTMLInputElement>('#withheld'));
const readExempt = moneyInput($<HTMLInputElement>('#exempt'));
const readCharity = moneyInput($<HTMLInputElement>('#charity'));
const insInput = $<HTMLInputElement>('#ins-amount');
const readIns = moneyInput(insInput);
const errorBox = $('#pit-error');

const row = (label: string, value: string, strong = false) =>
  `<tr${strong ? ' class="is-strong"' : ''}><td>${label}</td><td>${strong ? `<b>${value}</b>` : value}</td></tr>`;
const nz = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);
const mil = (n: number) => `${fmtInt(n / 1e6)} ${T('million','triệu')}`;

function render(): void {
  const year = Number($<HTMLSelectElement>('#year').value) as PitYear;
  const custom = (form.querySelector<HTMLInputElement>('input[name="ins"]:checked')?.value ?? 'full') === 'custom';
  insInput.disabled = !custom;
  const salary = readSalary();
  const months = Number($<HTMLInputElement>('#months').value);
  const depMonths = Number($<HTMLInputElement>('#dep-months').value);
  const ins = custom ? readIns() : null;

  const problem =
    !Number.isFinite(salary) || salary < 0 ? T('err.salary','Hãy nhập lương mỗi tháng hợp lệ, ví dụ 30.000.000.')
    : !Number.isFinite(months) || months < 1 || months > 12 ? T('err.months','Số tháng có lương phải từ 1 đến 12.')
    : !Number.isFinite(depMonths) || depMonths < 0 || depMonths > 12 ? T('err.depMonths','Số tháng giảm trừ gia cảnh phải từ 0 đến 12.')
    : custom && (!Number.isFinite(ins as number) || (ins as number) < 0) ? T('err.ins','Hãy nhập lương đóng bảo hiểm hợp lệ, hoặc chọn Bằng lương hằng tháng.')
    : '';
  errorBox.textContent = problem;
  errorBox.hidden = !problem;
  if (problem) return;

  const rules = PIT_RULES[year];
  const deps = Math.max(0, Math.min(20, Math.floor(Number($<HTMLInputElement>('#deps').value) || 0)));
  const r = computePit({
    year,
    monthlySalary: salary,
    months,
    bonus: nz(readBonus()),
    exempt: nz(readExempt()),
    insuranceSalary: ins,
    region: Number($<HTMLSelectElement>('#region').value) as Region,
    dependents: deps,
    deductionMonths: depMonths,
    charity: nz(readCharity()),
    withheld: nz(readWithheld()),
  });

  const settleLabel = r.settle > 0 ? T('payMore','Phải nộp thêm') : r.settle < 0 ? T('refund','Được hoàn lại') : T('settleZero','Chênh lệch');
  $('#summary').innerHTML = `
    <div class="stat stat--main"><span class="stat-label">${T('taxYear','Thuế TNCN cả năm')}</span><span class="stat-value">${fmtMoney(r.tax)}</span></div>
    <div class="stat"><span class="stat-label">${settleLabel}</span><span class="stat-value">${fmtMoney(Math.abs(r.settle))}</span></div>
    <div class="stat"><span class="stat-label">${T('avgRate','Thuế suất bình quân')}</span><span class="stat-value">${fmtDec(Math.round(r.averageRate * 10000) / 100)}%</span></div>
    <div class="stat"><span class="stat-label">${T('netYear','Thực nhận cả năm')}</span><span class="stat-value">${fmtMoney(r.net)}</span></div>`;

  $('#detail').innerHTML = `<tbody>
    ${row(T('taxableGross','Tổng thu nhập chịu thuế'), fmtMoney(r.taxableGross), true)}
    ${row(T('insPaid','Bảo hiểm bắt buộc đã đóng'), `− ${fmtMoney(r.insurance)}`)}
    ${row(`${T('personalDeduction','Giảm trừ bản thân')} (${fmtMoney(rules.personal)} × ${depMonths})`, `− ${fmtMoney(r.personal)}`)}
    ${row(`${T('depDeduction','Giảm trừ')} ${deps} ${T('depsWord','người phụ thuộc')}`, `− ${fmtMoney(r.dependents)}`)}
    ${row(T('charityRow','Đóng góp từ thiện, nhân đạo, khuyến học'), `− ${fmtMoney(r.charity)}`)}
    ${row(T('taxableIncome','Thu nhập tính thuế'), fmtMoney(r.taxableIncome), true)}
    ${row(T('taxYear','Thuế TNCN cả năm'), fmtMoney(r.tax))}
    ${row(T('withheldRow','Thuế đã khấu trừ trong năm'), `− ${fmtMoney(nz(readWithheld()))}`)}
    ${row(settleLabel, fmtMoney(Math.abs(r.settle)), true)}
  </tbody>`;

  $('#bonus-table').innerHTML = `<tbody>
    ${row(T('bonusRow','Khoản thưởng và thu nhập khác'), fmtMoney(nz(readBonus())))}
    ${row(T('taxWithout','Thuế cả năm nếu không có khoản này'), fmtMoney(r.taxWithoutBonus))}
    ${row(T('bonusTax','Thuế tăng thêm do khoản này'), fmtMoney(r.bonusTax), true)}
    ${row(T('bonusNet','Thực nhận từ khoản này sau thuế'), fmtMoney(r.bonusNet), true)}
  </tbody>`;

  const bandRows = rules.brackets.map((b, i) => {
    const from = i === 0 ? 0 : rules.brackets[i - 1].upTo * 12;
    const to = b.upTo * 12;
    const label = to === Infinity ? `${T('bandOver','Trên')} ${mil(from)}`
      : `${from === 0 ? T('bandUpto','Đến') : `${T('bandOver','Trên')} ${mil(from)} ${T('bandTo','đến')}`} ${mil(to)}`;
    const hit = r.bands[i];
    return `<tr><td>${label}</td><td>${Math.round(b.rate * 100)}%</td><td>${hit ? fmtMoney(hit.taxable) : '—'}</td><td>${hit ? fmtMoney(hit.tax) : '—'}</td></tr>`;
  });
  $('#bands').innerHTML = `<thead><tr><th>${T('th.taxable','Thu nhập tính thuế / năm')}</th><th>${T('th.rate','Thuế suất')}</th><th>${T('th.portion','Phần thu nhập')}</th><th>${T('th.tax','Tiền thuế')}</th></tr></thead>
    <tbody>${bandRows.join('')}</tbody><tfoot><tr><td>${T('total','Tổng')}</td><td></td><td>${fmtMoney(r.taxableIncome)}</td><td>${fmtMoney(r.tax)}</td></tr></tfoot>`;

  $('#rules-note').textContent = `${T('rulesNote1','Áp dụng cho năm')} ${year}: ${T('rulesNote2','giảm trừ bản thân')} ${fmtInt(rules.personal)} đ, ${T('rulesNote3','người phụ thuộc')} ${fmtInt(rules.dependent)} ${T('rulesNote4','đ mỗi tháng; biểu thuế')} ${rules.brackets.length} ${T('rulesNote5','bậc.')}`;
}

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', (e) => e.preventDefault());
render();
