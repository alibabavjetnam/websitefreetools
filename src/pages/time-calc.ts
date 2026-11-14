import { mountLayout } from '../layout';
import { $, copyText, fmtDec, fmtInt, fmtMoney, parseNumber, sampleMoney, setupTabs } from '../ui';
import { currentLang, pageText, localeTag } from '../i18n';
import { dateToUnix, formatDuration, parseClock, parseDurationText, splitSeconds, unixToDate, workTime } from '../calc/timecalc';
import { CAN_VI, CAN_ZH, CHI_VI, CHI_ZH, dayCanChi, lunarToSolar, solarToLunar, yearCanChi } from '../calc/lunar';

mountLayout({ activeTool: 'time-calc' });
const T = pageText();
const root = $('#tool-root');
const LOCALE = localeTag();
const isVi = currentLang() === 'vi';
const canChi = (c: [number, number]) => (isVi ? `${CAN_VI[c[0]]} ${CHI_VI[c[1]]}` : `${CAN_ZH[c[0]]}${CHI_ZH[c[1]]}`);
const pad = (n: number) => String(n).padStart(2, '0');
const stat = (label: string, value: string, main = false) =>
  `<div class="stat${main ? ' stat--main' : ''}"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`;
const now = new Date();
const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

root.innerHTML = `
  <div class="tabs" role="tablist" aria-label="${T('aria.tabs', 'Chọn công cụ')}">
    <button type="button" role="tab" data-tab="dur">${T('tab.dur', 'Cộng trừ thời lượng')}</button>
    <button type="button" role="tab" data-tab="work">${T('tab.work', 'Giờ làm việc')}</button>
    <button type="button" role="tab" data-tab="unix">${T('tab.unix', 'Unix timestamp')}</button>
    <button type="button" role="tab" data-tab="lunar">${T('tab.lunar', 'Âm lịch')}</button>
  </div>

  <div data-panel="dur">
    <div class="workspace tool-body">
      <div class="panel">
        <label class="field"><span class="field-label">${T('dur.lines', 'Mỗi dòng một khoảng thời gian (giờ:phút:giây). Thêm dấu - để trừ.')}</span>
          <textarea id="dur-in" rows="8" spellcheck="false">1:30:00\n0:45:30\n-0:20:00</textarea></label>
        <p class="note">${T('dur.hint', 'Nhập được 1:30:15, 90:00 (phút:giây), 1h 30m hoặc 45 (giây).')}</p>
        <p class="error" id="dur-err" hidden></p>
      </div>
      <div class="panel" id="dur-out"></div>
    </div>
  </div>

  <div data-panel="work">
    <div class="workspace tool-body">
      <div class="panel">
        <div class="form-grid">
          <label class="field"><span class="field-label">${T('work.start', 'Giờ vào')}</span><input id="w-start" type="time" value="08:00" /></label>
          <label class="field"><span class="field-label">${T('work.end', 'Giờ ra')}</span><input id="w-end" type="time" value="17:30" /></label>
          <label class="field"><span class="field-label">${T('work.break', 'Nghỉ (phút)')}</span><input id="w-break" type="text" inputmode="numeric" value="60" /></label>
          <label class="field"><span class="field-label">${T('work.days', 'Số ngày làm')}</span><input id="w-days" type="text" inputmode="numeric" value="1" /></label>
          <label class="field span-all"><span class="field-label">${T('work.rate', 'Lương mỗi giờ (không bắt buộc)')}</span><input id="w-rate" type="text" inputmode="decimal" placeholder="${fmtInt(sampleMoney(30000))}" /></label>
        </div>
        <p class="error" id="w-err" hidden></p>
      </div>
      <div class="panel" id="w-out"></div>
    </div>
  </div>

  <div data-panel="unix">
    <div class="workspace tool-body">
      <div class="panel">
        <label class="field"><span class="field-label">${T('unix.ts', 'Unix timestamp (giây hoặc mili giây)')}</span><input id="u-ts" type="text" inputmode="numeric" /></label>
        <div class="actions"><button type="button" class="btn" id="u-now">${T('unix.now', 'Lấy thời điểm hiện tại')}</button></div>
        <label class="field"><span class="field-label">${T('unix.dt', 'Hoặc chọn ngày giờ (theo giờ máy)')}</span><input id="u-dt" type="datetime-local" step="1" /></label>
        <p class="error" id="u-err" hidden></p>
      </div>
      <div class="panel" id="u-out"></div>
    </div>
  </div>

  <div data-panel="lunar">
    <div class="workspace tool-body">
      <div class="panel">
        <h3>${T('lunar.s2l', 'Dương lịch → âm lịch')}</h3>
        <label class="field"><span class="field-label">${T('lunar.solar', 'Ngày dương lịch')}</span><input id="l-solar" type="date" value="${todayIso}" /></label>
        <h3>${T('lunar.l2s', 'Âm lịch → dương lịch')}</h3>
        <div class="form-grid">
          <label class="field"><span class="field-label">${T('lunar.day', 'Ngày')}</span><input id="l-d" type="number" min="1" max="30" value="1" /></label>
          <label class="field"><span class="field-label">${T('lunar.month', 'Tháng')}</span><input id="l-m" type="number" min="1" max="12" value="1" /></label>
          <label class="field"><span class="field-label">${T('lunar.year', 'Năm')}</span><input id="l-y" type="number" min="1900" max="2199" value="${now.getFullYear()}" /></label>
        </div>
        <label class="check"><input type="checkbox" id="l-leap" /><span>${T('lunar.leap', 'Tháng nhuận')}</span></label>
      </div>
      <div class="panel" id="l-out"></div>
    </div>
  </div>
`;

// ---- Cộng trừ thời lượng
function renderDur(): void {
  const lines = ($<HTMLTextAreaElement>('#dur-in').value || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let total = 0;
  const bad: number[] = [];
  lines.forEach((l, i) => {
    const sec = parseDurationText(l.replace(/^\+/, ''));
    if (Number.isNaN(sec)) bad.push(i + 1);
    else total += sec;
  });
  const err = $('#dur-err');
  err.hidden = !bad.length;
  err.textContent = bad.length ? `${T('dur.bad', 'Không đọc được dòng')}: ${bad.join(', ')}` : '';
  const sp = splitSeconds(total);
  const days = sp.days ? `${fmtInt(sp.days)} ${T('unit.d', 'ngày')} ` : '';
  $('#dur-out').innerHTML = `<div class="stat-grid">
    ${stat(T('dur.total', 'Tổng'), `${total < 0 ? '-' : ''}${formatDuration(Math.abs(total))}`, true)}
    ${stat(T('dur.human', 'Dạng đọc'), `${total < 0 ? '-' : ''}${days}${sp.hours} ${T('unit.h', 'giờ')} ${sp.minutes} ${T('unit.m', 'phút')} ${sp.seconds} ${T('unit.s', 'giây')}`)}
    ${stat(T('dur.hours', 'Số giờ thập phân'), fmtDec(Math.round((total / 3600) * 10000) / 10000))}
    ${stat(T('dur.minutes', 'Tổng số phút'), fmtDec(Math.round((total / 60) * 100) / 100))}
    ${stat(T('dur.seconds', 'Tổng số giây'), fmtInt(Math.round(total)))}
  </div>`;
}
$('#dur-in').addEventListener('input', renderDur);

// ---- Giờ làm việc
function renderWork(): void {
  const err = $('#w-err');
  const a = parseClock($<HTMLInputElement>('#w-start').value);
  const b = parseClock($<HTMLInputElement>('#w-end').value);
  const brk = parseNumber($<HTMLInputElement>('#w-break').value) || 0;
  const days = Math.max(1, Math.floor(parseNumber($<HTMLInputElement>('#w-days').value) || 1));
  const rateText = $<HTMLInputElement>('#w-rate').value.trim();
  const rate = rateText ? parseNumber(rateText) : null;
  if (a == null || b == null) { err.hidden = false; err.textContent = T('work.errTime', 'Chọn giờ vào và giờ ra.'); $('#w-out').innerHTML = ''; return; }
  err.hidden = true;
  const r = workTime(a, b, brk, rate != null && Number.isFinite(rate) ? rate : null);
  const hm = (min: number) => `${Math.floor(min / 60)}:${pad(min % 60)}`;
  $('#w-out').innerHTML = `<div class="stat-grid">
    ${stat(T('work.net', 'Giờ làm thực tế'), `${hm(r.netMinutes)}`, true)}
    ${stat(T('work.decimal', 'Số giờ thập phân'), fmtDec(r.decimalHours))}
    ${stat(T('work.gross', 'Tổng thời gian ở nơi làm'), hm(r.grossMinutes))}
    ${days > 1 ? stat(T('work.totalDays', 'Tổng giờ các ngày'), fmtDec(Math.round(r.decimalHours * days * 100) / 100)) : ''}
    ${r.pay != null ? stat(T('work.pay', 'Tiền công'), fmtMoney(r.pay * days)) : ''}
  </div>${r.overnight ? `<p class="note">${T('work.overnight', 'Ca làm qua nửa đêm: giờ ra được tính vào ngày hôm sau.')}</p>` : ''}`;
}
['#w-start', '#w-end', '#w-break', '#w-days', '#w-rate'].forEach((s) => $(s).addEventListener('input', renderWork));

// ---- Unix
const fmtLocal = (d: Date) => d.toLocaleString(LOCALE, { dateStyle: 'full', timeStyle: 'medium' });
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
function showUnix(d: Date | null): void {
  const err = $('#u-err');
  if (!d) { err.hidden = false; err.textContent = T('unix.bad', 'Giá trị không hợp lệ.'); $('#u-out').innerHTML = ''; return; }
  err.hidden = true;
  const u = dateToUnix(d);
  $('#u-out').innerHTML = `<div class="stat-grid">
    ${stat(T('unix.local', 'Giờ máy của bạn'), fmtLocal(d), true)}
    ${stat('UTC', d.toISOString())}
    ${stat(T('unix.secs', 'Giây'), `<button type="button" class="link-btn" data-copy="${u.seconds}">${u.seconds}</button>`)}
    ${stat(T('unix.ms', 'Mili giây'), `<button type="button" class="link-btn" data-copy="${u.millis}">${u.millis}</button>`)}
  </div>`;
}
$('#u-out').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-copy]');
  if (b) void copyText(b.dataset.copy || '');
});
$('#u-ts').addEventListener('input', () => {
  const v = $<HTMLInputElement>('#u-ts').value.trim();
  if (!v) { $('#u-out').innerHTML = ''; $('#u-err').hidden = true; return; }
  const d = unixToDate(Number(v));
  if (d) $<HTMLInputElement>('#u-dt').value = toLocalInput(d);
  showUnix(d);
});
$('#u-dt').addEventListener('input', () => {
  const v = $<HTMLInputElement>('#u-dt').value;
  if (!v) return;
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) $<HTMLInputElement>('#u-ts').value = String(dateToUnix(d).seconds);
  showUnix(Number.isNaN(d.getTime()) ? null : d);
});
$('#u-now').addEventListener('click', () => {
  const d = new Date();
  $<HTMLInputElement>('#u-ts').value = String(dateToUnix(d).seconds);
  $<HTMLInputElement>('#u-dt').value = toLocalInput(d);
  showUnix(d);
});

// ---- Âm lịch
function renderLunar(): void {
  const sv = $<HTMLInputElement>('#l-solar').value;
  let html = '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sv);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (y >= 1900 && y <= 2199) {
      const l = solarToLunar(d, mo, y);
      const wd = new Date(y, mo - 1, d).toLocaleDateString(LOCALE, { weekday: 'long' });
      html += `<div class="stat-grid">
        ${stat(T('lunar.result', 'Âm lịch'), `${l.day}/${l.month}${l.leap ? ` (${T('lunar.leapShort', 'nhuận')})` : ''}/${l.year}`, true)}
        ${stat(T('lunar.yearCC', 'Năm'), canChi(yearCanChi(l.year)))}
        ${stat(T('lunar.dayCC', 'Ngày'), canChi(dayCanChi(d, mo, y)))}
        ${stat(T('lunar.weekday', 'Thứ trong tuần'), wd)}
      </div>`;
    }
  }
  const ld = Number($<HTMLInputElement>('#l-d').value);
  const lm = Number($<HTMLInputElement>('#l-m').value);
  const ly = Number($<HTMLInputElement>('#l-y').value);
  const leap = $<HTMLInputElement>('#l-leap').checked;
  const sol = ly >= 1900 && ly <= 2199 && lm >= 1 && lm <= 12 ? lunarToSolar(ld, lm, ly, leap) : null;
  html += sol
    ? `<div class="stat-grid">${stat(T('lunar.solarResult', 'Dương lịch tương ứng'), new Date(sol[2], sol[1] - 1, sol[0]).toLocaleDateString(LOCALE, { dateStyle: 'full' }), true)}</div>`
    : `<p class="note">${T('lunar.none', 'Ngày âm lịch này không tồn tại (kiểm tra ngày 30 hoặc tháng nhuận).')}</p>`;
  $('#l-out').innerHTML = html;
}
['#l-solar', '#l-d', '#l-m', '#l-y', '#l-leap'].forEach((s) => $(s).addEventListener('input', renderLunar));

setupTabs(root);
renderDur();
renderWork();
renderLunar();
$('#u-now').click();
