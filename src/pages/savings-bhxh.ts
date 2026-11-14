import { mountLayout } from '../layout';
import { $, downloadBlob, fmtAmt, fmtDec, fmtField, fmtInt, fmtMoney, fmtVnd, moneyInput, parseNumber, sampleMoney, setupTabs } from '../ui';
import { computeSavings, type InterestMode } from '../calc/savings';
import { BHXH_RULES, computeLump, computePension, type Gender } from '../calc/bhxh';
import { pageText } from '../i18n';

mountLayout({ activeTool: 'savings-bhxh' });
const T = pageText();
const root = $('#tool-root');
const thisYear = new Date().getFullYear();

const row = (label: string, value: string, strong = false) =>
  `<tr${strong ? ' class="is-strong"' : ''}><td>${label}</td><td>${strong ? `<b>${value}</b>` : value}</td></tr>`;
const stat = (label: string, value: string, main = false) =>
  `<div class="stat${main ? ' stat--main' : ''}"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`;
const ageText = (months: number) => {
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y} ${T('ageYears','tuổi')} ${m} ${T('ageMonths','tháng')}` : `${y} ${T('ageYears','tuổi')}`;
};
const yearsText = (y: number) => `${fmtDec(y)} ${T('yearsWord','năm')}`;

root.innerHTML = `
  <div class="tabs" role="tablist" aria-label="${T('aria.tabs','Chọn công cụ')}">
    <button type="button" role="tab" data-tab="savings">${T('tab.savings','Lãi gửi tiết kiệm')}</button>
    <button type="button" role="tab" data-tab="pension">${T('tab.pension','Lương hưu')}</button>
    <button type="button" role="tab" data-tab="lump">${T('tab.lump','BHXH một lần')}</button>
  </div>

  <div data-panel="savings">
    <div class="workspace tool-body">
      <form class="panel" id="sv-form" novalidate>
        <label class="field">
          <span class="field-label">${T('sv.principal','Số tiền gửi')}</span>
          <input id="sv-principal" type="text" value="${fmtField(sampleMoney(100000000))}" autocomplete="off" />
        </label>
        <div class="form-grid">
          <label class="field">
            <span class="field-label">${T('sv.term','Kỳ hạn (tháng)')}</span>
            <select id="sv-term">${[1, 3, 6, 9, 12, 13, 15, 18, 24, 36, 48, 60].map((m) => `<option value="${m}"${m === 12 ? ' selected' : ''}>${m}</option>`).join('')}</select>
          </label>
          <label class="field">
            <span class="field-label">${T('sv.rate','Lãi suất (%/năm)')}</span>
            <input id="sv-rate" type="text" inputmode="decimal" value="${fmtDec(6)}" />
          </label>
        </div>
        <fieldset class="field">
          <legend>${T('sv.mode','Cách nhận lãi')}</legend>
          <label class="check"><input type="radio" name="sv-mode" value="maturity" checked /><span>${T('sv.maturity','Lãi cuối kỳ')}</span></label>
          <label class="check"><input type="radio" name="sv-mode" value="monthly" /><span>${T('sv.monthly','Lãi trả hằng tháng')}</span></label>
        </fieldset>
        <label class="field" id="sv-roll-wrap">
          <span class="field-label">${T('sv.roll','Số kỳ tái tục gốc và lãi (1 = không tái tục)')}</span>
          <input id="sv-roll" type="number" min="1" max="20" step="1" value="1" />
        </label>
        <details class="options">
          <summary>${T('sv.early','Rút trước hạn')}</summary>
          <div class="options-body">
            <label class="check"><input type="checkbox" id="sv-early" /><span>${T('sv.earlyOn','Tính trường hợp rút trước hạn')}</span></label>
            <div class="form-grid">
              <label class="field">
                <span class="field-label">${T('sv.earlyDays','Số ngày đã gửi')}</span>
                <input id="sv-days" type="number" min="1" max="1825" step="1" value="90" />
              </label>
              <label class="field">
                <span class="field-label">${T('sv.earlyRate','Lãi suất không kỳ hạn (%/năm)')}</span>
                <input id="sv-erate" type="text" inputmode="decimal" value="${fmtDec(0.1)}" />
              </label>
            </div>
          </div>
        </details>
      </form>
      <section class="preview" aria-live="polite">
        <div class="stat-grid" id="sv-summary"></div>
        <p class="error" id="sv-error" hidden></p>
        <p class="note" id="sv-note"></p>
      </section>
    </div>
    <div class="row" style="margin-top:32px; justify-content: space-between">
      <h2 class="section-title" style="margin:0">${T('sv.schedule','Chi tiết lãi từng kỳ')}</h2>
      <button type="button" class="btn btn-sm" id="sv-export">${T('exportCsv','Tải bảng (CSV)')}</button>
    </div>
    <div class="table-wrap is-tall" style="margin-top:12px"><table class="data-table" id="sv-table"></table></div>
    <p class="note" style="margin-top:12px">${T('sv.foot','Kết quả để tham khảo. Mỗi tháng tính bằng 1/12 năm; rút trước hạn tính theo số ngày thực gửi chia 365. Lãi tiền gửi ngân hàng của cá nhân hiện được miễn thuế thu nhập cá nhân. Lãi suất thực tế do từng ngân hàng công bố.')}</p>
  </div>

  <div data-panel="pension" hidden>
    <p class="note" style="margin-bottom:12px"><b>${T('vnOnly','Dành cho Việt Nam.')}</b> ${T('vnOnlyNote','Phần lương hưu và BHXH tính theo Luật Bảo hiểm xã hội 2024 của Việt Nam (tiền Việt Nam đồng, đ).')}</p>
    <div class="workspace tool-body">
      <form class="panel" id="pn-form" novalidate>
        <fieldset class="field">
          <legend>${T('pn.gender','Giới tính')}</legend>
          <label class="check"><input type="radio" name="pn-gender" value="male" checked /><span>${T('pn.male','Nam')}</span></label>
          <label class="check"><input type="radio" name="pn-gender" value="female" /><span>${T('pn.female','Nữ')}</span></label>
        </fieldset>
        <div class="form-grid">
          <label class="field">
            <span class="field-label">${T('pn.years','Số năm đóng BHXH')}</span>
            <input id="pn-years" type="number" min="0" max="60" step="1" value="25" />
          </label>
          <label class="field">
            <span class="field-label">${T('pn.months','Số tháng lẻ')}</span>
            <input id="pn-months" type="number" min="0" max="11" step="1" value="0" />
          </label>
        </div>
        <label class="field">
          <span class="field-label">${T('pn.avg','Mức bình quân tiền lương làm căn cứ đóng BHXH (mỗi tháng)')}</span>
          <input id="pn-avg" type="text" value="${fmtInt(10000000)}" autocomplete="off" />
        </label>
        <label class="field">
          <span class="field-label">${T('pn.year','Năm dự kiến nghỉ hưu')}</span>
          <input id="pn-year" type="number" min="2025" max="2100" step="1" value="${thisYear}" />
        </label>
      </form>
      <section class="preview" aria-live="polite">
        <div class="stat-grid" id="pn-summary"></div>
        <p class="error" id="pn-error" hidden></p>
        <div class="table-wrap"><table class="data-table" id="pn-detail"></table></div>
      </section>
    </div>
    <p class="note" style="margin-top:12px">${T('pn.foot','Kết quả để tham khảo theo Luật Bảo hiểm xã hội 2024 (hiệu lực từ 01/7/2025). Chưa tính hệ số trượt giá, nghỉ hưu trước tuổi (bị giảm tỷ lệ) và các trường hợp đặc biệt. Số tiền chính thức do cơ quan bảo hiểm xã hội xác định.')}</p>
  </div>

  <div data-panel="lump" hidden>
    <p class="note" style="margin-bottom:12px"><b>${T('vnOnly','Dành cho Việt Nam.')}</b> ${T('vnOnlyNote','Phần lương hưu và BHXH tính theo Luật Bảo hiểm xã hội 2024 của Việt Nam (tiền Việt Nam đồng, đ).')}</p>
    <div class="workspace tool-body">
      <form class="panel" id="lp-form" novalidate>
        <div class="form-grid">
          <label class="field">
            <span class="field-label">${T('lp.before','Số tháng đã đóng trước 01/01/2014')}</span>
            <input id="lp-before" type="number" min="0" max="600" step="1" value="36" />
          </label>
          <label class="field">
            <span class="field-label">${T('lp.from','Số tháng đã đóng từ 01/01/2014')}</span>
            <input id="lp-from" type="number" min="0" max="600" step="1" value="96" />
          </label>
        </div>
        <label class="field">
          <span class="field-label">${T('pn.avg','Mức bình quân tiền lương làm căn cứ đóng BHXH (mỗi tháng)')}</span>
          <input id="lp-avg" type="text" value="${fmtInt(8000000)}" autocomplete="off" />
        </label>
      </form>
      <section class="preview" aria-live="polite">
        <div class="stat-grid" id="lp-summary"></div>
        <p class="error" id="lp-error" hidden></p>
        <div class="table-wrap"><table class="data-table" id="lp-detail"></table></div>
      </section>
    </div>
    <p class="note" style="margin-top:12px">${T('lp.foot','Kết quả để tham khảo. Rút BHXH một lần làm mất thời gian đã đóng để tính lương hưu và quyền lợi bảo hiểm y tế sau này, hãy cân nhắc kỹ. Số tiền chính thức do cơ quan bảo hiểm xã hội xác định.')}</p>
  </div>
`;

/* ---------- Lãi tiết kiệm ---------- */
const svForm = $<HTMLFormElement>('#sv-form');
const readSv = moneyInput($<HTMLInputElement>('#sv-principal'));
let svRows: ReturnType<typeof computeSavings>['rows'] = [];

function renderSavings(): void {
  const principal = readSv();
  const term = Number($<HTMLSelectElement>('#sv-term').value);
  const rate = parseNumber($<HTMLInputElement>('#sv-rate').value);
  const mode = (svForm.querySelector<HTMLInputElement>('input[name="sv-mode"]:checked')?.value ?? 'maturity') as InterestMode;
  const roll = Math.floor(Number($<HTMLInputElement>('#sv-roll').value));
  const earlyOn = $<HTMLInputElement>('#sv-early').checked;
  const days = Number($<HTMLInputElement>('#sv-days').value);
  const erate = parseNumber($<HTMLInputElement>('#sv-erate').value);
  $('#sv-roll-wrap').hidden = mode === 'monthly';

  const problem =
    !Number.isFinite(principal) || principal <= 0 ? T('sv.err.principal','Hãy nhập số tiền gửi lớn hơn 0.')
    : !Number.isFinite(rate) || rate < 0 || rate > 100 ? T('sv.err.rate','Lãi suất phải từ 0 đến 100 %/năm.')
    : mode === 'maturity' && (!Number.isFinite(roll) || roll < 1 || roll > 20) ? T('sv.err.roll','Số kỳ tái tục phải từ 1 đến 20.')
    : earlyOn && (!Number.isFinite(days) || days < 1 || days > 1825) ? T('sv.err.days','Số ngày đã gửi phải từ 1 đến 1825.')
    : earlyOn && (!Number.isFinite(erate) || erate < 0 || erate > 100) ? T('sv.err.erate','Lãi suất không kỳ hạn phải từ 0 đến 100 %/năm.')
    : '';
  $('#sv-error').textContent = problem;
  ($('#sv-error') as HTMLElement).hidden = !problem;
  if (problem) return;

  const res = computeSavings({
    principal, termMonths: term, annualRate: rate, mode, rollovers: mode === 'maturity' ? roll : 1,
    early: earlyOn ? { days, rate: erate } : null,
  });
  svRows = res.rows;

  $('#sv-summary').innerHTML =
    stat(T('sv.totalInterest','Tổng tiền lãi'), fmtMoney(res.totalInterest), true) +
    stat(T('sv.totalReceived','Tổng nhận (gốc + lãi)'), fmtMoney(res.totalReceived)) +
    stat(T('sv.effective','Lãi suất thực nhận (%/năm)'), `${fmtDec(Math.round(res.effectiveRate * 100) / 100)}%`) +
    (earlyOn
      ? stat(T('sv.loss','Lãi bị mất so với gửi đủ kỳ hạn'), fmtMoney(res.earlyLoss))
      : stat(mode === 'monthly' ? T('sv.perMonth','Lãi mỗi tháng') : T('sv.perTerm','Lãi mỗi kỳ hạn'), fmtMoney(res.rows[0]?.interest ?? 0)));
  $('#sv-note').textContent = earlyOn
    ? T('sv.note.early','Rút trước hạn chỉ được hưởng lãi không kỳ hạn theo số ngày thực gửi.')
    : mode === 'monthly'
      ? T('sv.note.monthly','Lãi trả vào tài khoản mỗi tháng, gốc nhận lại khi đáo hạn.')
      : roll > 1
        ? T('sv.note.roll','Hết mỗi kỳ hạn, gốc và lãi được gộp lại để gửi tiếp cùng lãi suất.')
        : T('sv.note.maturity','Nhận gốc và toàn bộ lãi khi đáo hạn.');

  const first = earlyOn ? T('sv.th.early','Rút sớm') : mode === 'monthly' ? T('th.month','Tháng') : T('th.term','Kỳ');
  $('#sv-table').innerHTML = `
    <thead><tr><th>${first}</th><th>${T('th.interest','Tiền lãi')}</th><th>${mode === 'monthly' && !earlyOn ? T('th.accrued','Lãi đã nhận') : T('th.balance','Số dư (gốc + lãi)')}</th></tr></thead>
    <tbody>${res.rows.map((r) => `<tr><td>${r.index}</td><td>${fmtAmt(r.interest)}</td><td>${fmtAmt(r.balance)}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td>${T('total','Tổng')}</td><td>${fmtAmt(res.totalInterest)}</td><td>${fmtAmt(res.totalReceived)}</td></tr></tfoot>`;
}

$('#sv-export').addEventListener('click', () => {
  if (!svRows.length) return;
  const lines = ['Ky,Tien lai,So du'];
  svRows.forEach((r) => lines.push([r.index, Math.round(r.interest), Math.round(r.balance)].join(',')));
  downloadBlob(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }), 'lai-tiet-kiem.csv');
});
svForm.addEventListener('input', renderSavings);
svForm.addEventListener('change', renderSavings);
svForm.addEventListener('submit', (e) => e.preventDefault());

/* ---------- Lương hưu ---------- */
const pnForm = $<HTMLFormElement>('#pn-form');
const readPnAvg = moneyInput($<HTMLInputElement>('#pn-avg'));

function renderPension(): void {
  const gender = (pnForm.querySelector<HTMLInputElement>('input[name="pn-gender"]:checked')?.value ?? 'male') as Gender;
  const years = Math.floor(Number($<HTMLInputElement>('#pn-years').value));
  const extra = Math.floor(Number($<HTMLInputElement>('#pn-months').value) || 0);
  const avg = readPnAvg();
  const retireYear = Math.floor(Number($<HTMLInputElement>('#pn-year').value));
  const problem =
    !Number.isFinite(years) || years < 0 || years > 60 ? T('pn.err.years','Số năm đóng BHXH phải từ 0 đến 60.')
    : extra < 0 || extra > 11 ? T('pn.err.months','Số tháng lẻ phải từ 0 đến 11.')
    : !Number.isFinite(avg) || avg <= 0 ? T('pn.err.avg','Hãy nhập mức bình quân tiền lương lớn hơn 0, ví dụ 10.000.000.')
    : !Number.isFinite(retireYear) || retireYear < 2025 || retireYear > 2100 ? T('pn.err.year','Năm nghỉ hưu phải từ 2025 đến 2100.')
    : '';
  $('#pn-error').textContent = problem;
  ($('#pn-error') as HTMLElement).hidden = !problem;
  if (problem) return;

  const r = computePension({ gender, totalMonths: years * 12 + extra, avgSalary: avg, retireYear });
  const maxYears = gender === 'female' ? BHXH_RULES.female.maxYears : BHXH_RULES.male.maxYears;
  $('#pn-summary').innerHTML = r.eligible
    ? stat(T('pn.monthly','Lương hưu mỗi tháng'), fmtVnd(r.monthly), true) +
      stat(T('pn.rate','Tỷ lệ hưởng'), `${fmtDec(Math.round(r.rate * 10000) / 100)}%`) +
      stat(T('pn.yearly','Lương hưu mỗi năm'), fmtVnd(r.yearly)) +
      stat(T('pn.age','Tuổi nghỉ hưu bình thường'), ageText(r.retireAgeMonths))
    : stat(T('pn.notEligible','Chưa đủ điều kiện lương hưu'), T('pn.needYears','Cần đóng đủ 15 năm'), true) +
      stat(T('pn.age','Tuổi nghỉ hưu bình thường'), ageText(r.retireAgeMonths));
  $('#pn-detail').innerHTML = `<tbody>
    ${row(T('pn.countedYears','Số năm đóng được tính (tháng lẻ 1–6 tính nửa năm, 7–11 tính một năm)'), yearsText(r.years))}
    ${row(T('pn.avgRow','Mức bình quân tiền lương đóng BHXH'), fmtVnd(avg))}
    ${row(T('pn.rate','Tỷ lệ hưởng'), r.eligible ? `${fmtDec(Math.round(r.rate * 10000) / 100)}%` : '—')}
    ${row(T('pn.monthly','Lương hưu mỗi tháng'), fmtVnd(r.monthly), true)}
    ${row(`${T('pn.extraYears','Số năm đóng vượt mức tối đa')} (${maxYears})`, yearsText(r.extraYears))}
    ${row(T('pn.extraLump','Trợ cấp một lần khi nghỉ hưu (0,5 tháng lương bình quân mỗi năm vượt)'), fmtVnd(r.extraLump), r.extraLump > 0)}
  </tbody>`;
}
pnForm.addEventListener('input', renderPension);
pnForm.addEventListener('change', renderPension);
pnForm.addEventListener('submit', (e) => e.preventDefault());

/* ---------- BHXH một lần ---------- */
const lpForm = $<HTMLFormElement>('#lp-form');
const readLpAvg = moneyInput($<HTMLInputElement>('#lp-avg'));

function renderLump(): void {
  const before = Math.floor(Number($<HTMLInputElement>('#lp-before').value) || 0);
  const from = Math.floor(Number($<HTMLInputElement>('#lp-from').value) || 0);
  const avg = readLpAvg();
  const problem =
    before < 0 || before > 600 || from < 0 || from > 600 ? T('lp.err.months','Số tháng đóng phải từ 0 đến 600.')
    : before + from < 1 ? T('lp.err.none','Hãy nhập ít nhất một tháng đã đóng BHXH.')
    : !Number.isFinite(avg) || avg <= 0 ? T('pn.err.avg','Hãy nhập mức bình quân tiền lương lớn hơn 0, ví dụ 10.000.000.')
    : '';
  $('#lp-error').textContent = problem;
  ($('#lp-error') as HTMLElement).hidden = !problem;
  if (problem) return;

  const r = computeLump({ monthsBefore2014: before, monthsFrom2014: from, avgSalary: avg });
  $('#lp-summary').innerHTML =
    stat(T('lp.total','BHXH một lần nhận được'), fmtVnd(r.total), true) +
    stat(T('lp.contributed','Tổng tiền đã đóng BHXH (người lao động và doanh nghiệp, 22%)'), fmtVnd(r.contributed));
  $('#lp-detail').innerHTML = r.underOneYear
    ? `<tbody>${row(T('lp.under','Đóng chưa đủ 1 năm: nhận bằng số tiền đã đóng, tối đa 2 tháng lương bình quân'), fmtVnd(r.total), true)}</tbody>`
    : `<tbody>
        ${row(`${T('lp.rowBefore','Trước 2014')}: ${yearsText(r.yearsBefore)} × ${fmtDec(1.5)} ${T('lp.monthsAvg','tháng lương bình quân')}`, fmtVnd(r.amountBefore))}
        ${row(`${T('lp.rowFrom','Từ 2014')}: ${yearsText(r.yearsFrom)} × 2 ${T('lp.monthsAvg','tháng lương bình quân')}`, fmtVnd(r.amountFrom))}
        ${row(T('lp.total','BHXH một lần nhận được'), fmtVnd(r.total), true)}
      </tbody>`;
}
lpForm.addEventListener('input', renderLump);
lpForm.addEventListener('change', renderLump);
lpForm.addEventListener('submit', (e) => e.preventDefault());

setupTabs(root, (tab) => {
  if (tab === 'savings') renderSavings();
  else if (tab === 'pension') renderPension();
  else renderLump();
});
