import { mountLayout } from '../layout';
import { $, fmtInt, fmtMoney, moneyInput, parseNumber } from '../ui';
import { compoundGrowth, type Compounding } from '../calc/compound';

mountLayout({ activeTool: 'compound' });

$('#tool-root').innerHTML = `
  <div class="workspace tool-body">
    <form class="panel" id="cp-form" novalidate>
      <div class="form-grid">
        <label class="field">
          <span class="field-label">Số tiền ban đầu</span>
          <input id="initial" type="text" value="100.000.000" autocomplete="off" />
        </label>
        <label class="field">
          <span class="field-label">Góp thêm mỗi tháng</span>
          <input id="monthly" type="text" value="5.000.000" autocomplete="off" />
        </label>
        <label class="field">
          <span class="field-label">Lợi suất (%/năm)</span>
          <input id="rate" type="text" inputmode="decimal" value="7" />
        </label>
        <label class="field">
          <span class="field-label">Số năm</span>
          <input id="years" type="number" min="1" max="60" step="1" value="10" />
        </label>
        <label class="field span-all">
          <span class="field-label">Nhập lãi vào gốc</span>
          <select id="freq">
            <option value="12">Hằng tháng</option>
            <option value="4">Hằng quý</option>
            <option value="1" selected>Hằng năm</option>
          </select>
        </label>
      </div>
      <p class="note">Tiền góp thêm được tính vào cuối mỗi tháng. Lợi suất là con số giả định, kết quả thực tế có thể khác.</p>
    </form>

    <section class="preview" aria-live="polite">
      <div class="stat-grid" id="summary"></div>
      <p class="error" id="cp-error" hidden></p>
      <div id="chart" class="chart-box" role="img" aria-label="Biểu đồ tăng trưởng theo năm"></div>
    </section>
  </div>

  <h2 class="section-title" style="margin-top:32px">Chi tiết từng năm</h2>
  <div class="table-wrap is-tall"><table class="data-table" id="table"></table></div>
`;

const form = $<HTMLFormElement>('#cp-form');
const readInitial = moneyInput($<HTMLInputElement>('#initial'));
const readMonthly = moneyInput($<HTMLInputElement>('#monthly'));
const errorBox = $('#cp-error');

/** Biểu đồ cột chồng: phần tiền góp và phần lãi theo từng năm */
function chart(years: { year: number; contributed: number; interest: number; balance: number }[]): string {
  const W = 560, H = 240, padL = 8, padB = 22, padT = 10;
  const max = Math.max(...years.map((y) => y.balance), 1);
  const bw = (W - padL) / years.length;
  const bars = years
    .map((y, i) => {
      const x = padL + i * bw + bw * 0.15;
      const w = bw * 0.7;
      const hC = ((H - padB - padT) * Math.max(0, y.contributed)) / max;
      const hI = ((H - padB - padT) * Math.max(0, y.interest)) / max;
      const label = years.length <= 15 || i % Math.ceil(years.length / 12) === 0 || i === years.length - 1
        ? `<text x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${y.year}</text>` : '';
      return `<rect x="${x}" y="${H - padB - hC}" width="${w}" height="${hC}" class="bar-a"><title>Năm ${y.year}: góp ${fmtInt(y.contributed)}</title></rect>
        <rect x="${x}" y="${H - padB - hC - hI}" width="${w}" height="${hI}" class="bar-b"><title>Năm ${y.year}: lãi ${fmtInt(y.interest)}</title></rect>${label}`;
    })
    .join('');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${bars}</svg>
    <div class="legend"><span><i class="bar-a"></i>Tiền đã góp</span><span><i class="bar-b"></i>Tiền lãi</span></div>`;
}

function render(): void {
  const initial = readInitial();
  const monthly = readMonthly();
  const rate = parseNumber($<HTMLInputElement>('#rate').value);
  const years = Math.round(Number($<HTMLInputElement>('#years').value));
  const freq = Number($<HTMLSelectElement>('#freq').value) as Compounding;

  const problem =
    !Number.isFinite(initial) || initial < 0 ? 'Số tiền ban đầu phải từ 0 trở lên.'
    : !Number.isFinite(monthly) || monthly < 0 ? 'Số tiền góp thêm phải từ 0 trở lên.'
    : initial === 0 && monthly === 0 ? 'Hãy nhập số tiền ban đầu hoặc số tiền góp mỗi tháng.'
    : !Number.isFinite(rate) || rate < -50 || rate > 100 ? 'Lợi suất phải từ -50 đến 100 %/năm.'
    : !Number.isFinite(years) || years < 1 || years > 60 ? 'Số năm phải từ 1 đến 60.'
    : '';
  errorBox.textContent = problem;
  errorBox.hidden = !problem;
  if (problem) return;

  const res = compoundGrowth({ initial, monthly, annualRate: rate, years, compounding: freq });
  $('#summary').innerHTML = `
    <div class="stat stat--main"><span class="stat-label">Sau ${years} năm bạn có</span><span class="stat-value">${fmtMoney(res.finalBalance)}</span></div>
    <div class="stat"><span class="stat-label">Tổng tiền đã góp</span><span class="stat-value">${fmtMoney(res.totalContributed)}</span></div>
    <div class="stat"><span class="stat-label">Tiền lãi sinh ra</span><span class="stat-value">${fmtMoney(res.totalInterest)}</span></div>`;
  $('#chart').innerHTML = chart(res.years);
  $('#table').innerHTML = `
    <thead><tr><th>Năm</th><th>Tổng đã góp</th><th>Tổng tiền lãi</th><th>Số dư cuối năm</th></tr></thead>
    <tbody>${res.years.map((y) => `<tr><td>${y.year}</td><td>${fmtInt(y.contributed)}</td><td>${fmtInt(y.interest)}</td><td>${fmtInt(y.balance)}</td></tr>`).join('')}</tbody>`;
}

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', (e) => e.preventDefault());
render();
