import { mountLayout } from '../layout';
import { $, copyText, escapeHtml, setupTabs } from '../ui';
import { CronError, describeCron, nextRuns, parseCron } from '../calc/cron';

mountLayout({ activeTool: 'cron-time' });

const root = $('#tool-root');
root.innerHTML = `
  <div class="tabs" role="tablist" aria-label="Chọn tiện ích">
    <button type="button" role="tab" data-tab="cron">Biểu thức cron</button>
    <button type="button" role="tab" data-tab="timestamp">Unix timestamp</button>
  </div>

  <section class="tool-body" data-panel="cron">
    <div class="workspace">
      <div class="panel">
        <label class="field">
          <span class="field-label">Biểu thức cron (phút giờ ngày tháng thứ)</span>
          <input id="cron-expr" class="mono" type="text" value="30 8 * * 1-5" spellcheck="false" autocomplete="off" />
        </label>
        <div class="form-grid cron-fields">
          ${['Phút', 'Giờ', 'Ngày', 'Tháng', 'Thứ'].map((l, i) => `<label class="field"><span class="field-label">${l}</span><input class="mono" data-part="${i}" type="text" spellcheck="false" /></label>`).join('')}
        </div>
        <div>
          <span class="field-label">Mẫu có sẵn</span>
          <div class="row" id="cron-presets">
            ${[
              ['* * * * *', 'Mỗi phút'],
              ['*/5 * * * *', 'Mỗi 5 phút'],
              ['0 * * * *', 'Mỗi giờ'],
              ['0 0 * * *', 'Nửa đêm mỗi ngày'],
              ['30 8 * * 1-5', '8h30 ngày làm việc'],
              ['0 9 * * 1', '9h sáng thứ Hai'],
              ['0 0 1 * *', 'Ngày 1 hằng tháng'],
              ['0 2 * * 0', '2h sáng Chủ nhật'],
            ].map(([e, l]) => `<button type="button" class="btn btn-sm" data-cron="${e}">${l}</button>`).join('')}
          </div>
        </div>
        <p class="note">Cú pháp: <code>*</code> mọi giá trị, <code>,</code> liệt kê, <code>-</code> khoảng, <code>/</code> bước nhảy. Thứ: 0 hoặc 7 là Chủ nhật, 1 là thứ Hai.</p>
      </div>
      <div class="panel">
        <p class="cron-desc" id="cron-desc" aria-live="polite"></p>
        <p class="error" id="cron-error" hidden></p>
        <div>
          <span class="field-label">5 lần chạy tiếp theo (giờ trên máy bạn)</span>
          <ol class="run-list" id="cron-next"></ol>
        </div>
        <div class="row"><button type="button" class="btn" id="cron-copy">Sao chép biểu thức</button></div>
      </div>
    </div>
  </section>

  <section class="tool-body" data-panel="timestamp" hidden>
    <div class="stat-grid">
      <div class="stat stat--main"><span class="stat-label">Unix timestamp hiện tại (giây)</span><span class="stat-value mono" id="ts-now"></span></div>
      <div class="stat"><span class="stat-label">Mili giây</span><span class="stat-value mono" id="ts-now-ms" style="font-size:1rem"></span></div>
    </div>
    <div class="workspace" style="margin-top:16px">
      <div class="panel">
        <h2 class="panel-title">Timestamp sang ngày giờ</h2>
        <label class="field">
          <span class="field-label">Unix timestamp (giây hoặc mili giây, tự nhận biết)</span>
          <input id="ts-in" class="mono" type="text" inputmode="numeric" autocomplete="off" />
        </label>
        <div class="table-wrap"><table class="data-table" id="ts-out"></table></div>
      </div>
      <div class="panel">
        <h2 class="panel-title">Ngày giờ sang timestamp</h2>
        <label class="field">
          <span class="field-label">Ngày giờ (theo giờ trên máy bạn)</span>
          <input id="dt-in" type="datetime-local" step="1" />
        </label>
        <div class="table-wrap"><table class="data-table" id="dt-out"></table></div>
      </div>
    </div>
  </section>
`;
setupTabs(root);

/* ---------------- Cron ---------------- */
const exprInput = $<HTMLInputElement>('#cron-expr');
const partInputs = [...root.querySelectorAll<HTMLInputElement>('[data-part]')];
const fmtDateTime = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function syncParts(): void {
  const parts = exprInput.value.trim().split(/\s+/);
  partInputs.forEach((p, i) => (p.value = exprInput.value.trim().startsWith('@') ? '' : (parts[i] ?? '')));
}

function renderCron(): void {
  const errorBox = $('#cron-error');
  try {
    const c = parseCron(exprInput.value);
    $('#cron-desc').textContent = describeCron(c);
    const runs = nextRuns(c, new Date(), 5);
    $('#cron-next').innerHTML = runs.length
      ? runs.map((d) => `<li>${escapeHtml(fmtDateTime.format(d))}</li>`).join('')
      : '<li>Không có lần chạy nào trong 5 năm tới (ví dụ ngày 30 tháng 2).</li>';
    errorBox.hidden = true;
  } catch (e) {
    if (!(e instanceof CronError)) throw e;
    $('#cron-desc').textContent = '';
    $('#cron-next').innerHTML = '';
    errorBox.textContent = e.message;
    errorBox.hidden = false;
  }
}

exprInput.addEventListener('input', () => {
  syncParts();
  renderCron();
});
partInputs.forEach((p) =>
  p.addEventListener('input', () => {
    exprInput.value = partInputs.map((x) => x.value.trim() || '*').join(' ');
    renderCron();
  }),
);
$('#cron-presets').addEventListener('click', (e) => {
  const v = (e.target as HTMLElement).closest<HTMLElement>('[data-cron]')?.dataset.cron;
  if (!v) return;
  exprInput.value = v;
  syncParts();
  renderCron();
});
$('#cron-copy').addEventListener('click', () => copyText(exprInput.value.trim()));
syncParts();
renderCron();

/* ---------------- Timestamp ---------------- */
const tsIn = $<HTMLInputElement>('#ts-in');
const dtIn = $<HTMLInputElement>('#dt-in');
const fmtLocal = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full', timeStyle: 'medium' });
const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;

function relative(ms: number): string {
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const units: [number, Intl.RelativeTimeFormatUnit][] = [[31536e6, 'year'], [2592e6, 'month'], [864e5, 'day'], [36e5, 'hour'], [6e4, 'minute'], [1e3, 'second']];
  const rtf = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' });
  for (const [size, unit] of units) if (abs >= size || unit === 'second') return rtf.format(Math.round(diff / size), unit);
  return '';
}

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

function dateTable(d: Date): string {
  return `<tbody>
    <tr><td>Giờ trên máy bạn (${escapeHtml(tzName)})</td><td>${escapeHtml(fmtLocal.format(d))}</td></tr>
    <tr><td>Giờ UTC</td><td class="mono">${d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')}</td></tr>
    <tr><td>ISO 8601</td><td class="mono">${d.toISOString()}</td></tr>
    <tr><td>So với hiện tại</td><td>${escapeHtml(relative(d.getTime()))}</td></tr>
  </tbody>`;
}

function renderTs(): void {
  const raw = tsIn.value.trim();
  const out = $('#ts-out');
  if (!/^-?\d+$/.test(raw)) {
    out.innerHTML = raw ? '<tbody><tr><td class="error-text">Timestamp chỉ gồm chữ số.</td></tr></tbody>' : '';
    return;
  }
  // Từ 12 chữ số trở lên coi là mili giây (năm 2001 trở đi tính bằng giây chỉ có 10 chữ số)
  const n = Number(raw);
  const ms = raw.replace('-', '').length >= 12 ? n : n * 1000;
  const d = new Date(ms);
  out.innerHTML = Number.isNaN(d.getTime())
    ? '<tbody><tr><td class="error-text">Timestamp nằm ngoài khoảng ngày giờ hợp lệ.</td></tr></tbody>'
    : `<tbody><tr><td>Đơn vị nhận biết</td><td>${raw.replace('-', '').length >= 12 ? 'Mili giây' : 'Giây'}</td></tr></tbody>` + dateTable(d);
}

function renderDt(): void {
  const out = $('#dt-out');
  if (!dtIn.value) {
    out.innerHTML = '';
    return;
  }
  const d = new Date(dtIn.value);
  const s = Math.floor(d.getTime() / 1000);
  out.innerHTML = `<tbody>
    <tr><td>Giây</td><td class="mono"><button type="button" class="btn btn-sm" data-copy="${s}">Sao chép</button> ${s}</td></tr>
    <tr><td>Mili giây</td><td class="mono"><button type="button" class="btn btn-sm" data-copy="${d.getTime()}">Sao chép</button> ${d.getTime()}</td></tr>
    <tr><td>Giờ UTC</td><td class="mono">${d.toISOString()}</td></tr>
  </tbody>`;
}

root.addEventListener('click', (e) => {
  const v = (e.target as HTMLElement).closest<HTMLElement>('[data-copy]')?.dataset.copy;
  if (v) copyText(v);
});
tsIn.addEventListener('input', renderTs);
dtIn.addEventListener('input', renderDt);

const now = new Date();
tsIn.value = String(Math.floor(now.getTime() / 1000));
dtIn.value = toLocalInput(now);
renderTs();
renderDt();
function tick(): void {
  const t = Date.now();
  $('#ts-now').textContent = String(Math.floor(t / 1000));
  $('#ts-now-ms').textContent = String(t);
}
tick();
window.setInterval(tick, 1000);
