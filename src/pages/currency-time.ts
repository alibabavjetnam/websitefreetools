import { mountLayout } from '../layout';
import { $, escapeHtml, fmtDec, moneyInput, setupTabs, storage } from '../ui';

mountLayout({ activeTool: 'currency-time' });

const root = $('#tool-root');
root.innerHTML = `
  <div class="tabs" role="tablist" aria-label="Chọn tiện ích">
    <button type="button" role="tab" data-tab="currency">Đổi tiền tệ</button>
    <button type="button" role="tab" data-tab="time">Giờ thế giới</button>
  </div>

  <section class="tool-body" data-panel="currency">
    <div class="workspace">
      <form class="panel" id="fx-form" novalidate>
        <label class="field">
          <span class="field-label">Số tiền</span>
          <input id="fx-amount" type="text" value="100" autocomplete="off" />
        </label>
        <div class="fx-pair">
          <label class="field"><span class="field-label">Từ</span><select id="fx-from"></select></label>
          <button type="button" class="btn" id="fx-swap" aria-label="Đảo chiều">⇄</button>
          <label class="field"><span class="field-label">Sang</span><select id="fx-to"></select></label>
        </div>
        <p class="note" id="fx-updated"></p>
      </form>
      <section class="preview" aria-live="polite">
        <div class="stat stat--main"><span class="stat-label" id="fx-label">Kết quả</span><span class="stat-value" id="fx-result">…</span></div>
        <p class="note" id="fx-rate"></p>
        <p class="error" id="fx-error" hidden></p>
        <div class="table-wrap"><table class="data-table" id="fx-table"></table></div>
      </section>
    </div>
    <p class="note" style="margin-top:12px">Tỷ giá tham khảo, cập nhật mỗi ngày, có thể khác tỷ giá mua bán thực tế tại ngân hàng. <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener">Rates By Exchange Rate API</a></p>
  </section>

  <section class="tool-body" data-panel="time" hidden>
    <div class="panel">
      <div class="form-grid">
        <label class="field"><span class="field-label">Mốc thời gian</span><input id="tz-dt" type="datetime-local" /></label>
        <label class="field"><span class="field-label">Theo giờ tại</span><select id="tz-src"></select></label>
        <div class="field" style="justify-content:flex-end"><button type="button" class="btn" id="tz-now">Về thời điểm hiện tại</button></div>
      </div>
      <p class="note">Mặc định hiển thị giờ hiện tại và tự chạy. Chọn một mốc thời gian để xem giờ đó ở các nơi khác.</p>
    </div>
    <div class="clock-grid" id="tz-grid" aria-live="off"></div>
  </section>
`;
setupTabs(root);

/* ---------------- Tiền tệ ---------------- */
const POPULAR = ['VND', 'USD', 'EUR', 'JPY', 'KRW', 'CNY', 'THB', 'SGD', 'GBP', 'AUD', 'TWD', 'HKD', 'CAD', 'CHF', 'MYR', 'LAK', 'KHR', 'INR', 'PHP', 'IDR', 'NZD', 'RUB', 'AED'];
const API_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_MS = 6 * 3600 * 1000;

interface RatesCache { fetchedAt: number; updatedUnix: number; rates: Record<string, number> }
const cache = storage<RatesCache | null>('fx-rates', null);
const prefs = storage<{ from: string; to: string }>('fx-pair', { from: 'USD', to: 'VND' });

let names: Intl.DisplayNames | null = null;
try { names = new Intl.DisplayNames(['vi'], { type: 'currency' }); } catch { /* trình duyệt cũ: chỉ hiện mã */ }
const nameOf = (code: string) => { try { return names?.of(code) ?? code; } catch { return code; } };

const fromSel = $<HTMLSelectElement>('#fx-from');
const toSel = $<HTMLSelectElement>('#fx-to');
const readAmount = moneyInput($<HTMLInputElement>('#fx-amount'));
let rates: Record<string, number> | null = null;

function fillSelects(codes: string[]): void {
  const sorted = [...POPULAR.filter((c) => codes.includes(c)), ...codes.filter((c) => !POPULAR.includes(c)).sort()];
  const opts = sorted.map((c) => `<option value="${c}">${c}, ${escapeHtml(nameOf(c))}</option>`).join('');
  fromSel.innerHTML = opts;
  toSel.innerHTML = opts;
  const p = prefs.get();
  fromSel.value = codes.includes(p.from) ? p.from : 'USD';
  toSel.value = codes.includes(p.to) ? p.to : 'VND';
}

const fmtFx = (n: number) => (Math.abs(n) >= 100 ? fmtDec(Math.round(n)) : n.toLocaleString('vi-VN', { maximumSignificantDigits: 6 }));

function renderFx(): void {
  if (!rates) return;
  const amount = readAmount();
  const from = fromSel.value;
  const to = toSel.value;
  prefs.set({ from, to });
  const errorBox = $('#fx-error');
  if (!Number.isFinite(amount) || amount < 0) {
    errorBox.textContent = 'Hãy nhập số tiền hợp lệ, ví dụ 100 hoặc 1.500.000.';
    errorBox.hidden = false;
    return;
  }
  errorBox.hidden = true;
  const rate = rates[to] / rates[from];
  $('#fx-label').textContent = `${fmtFx(amount)} ${from} bằng`;
  $('#fx-result').textContent = `${fmtFx(amount * rate)} ${to}`;
  $('#fx-rate').textContent = `1 ${from} = ${fmtFx(rate)} ${to}   ·   1 ${to} = ${fmtFx(1 / rate)} ${from}`;
  const others = POPULAR.filter((c) => c !== from && rates?.[c]).slice(0, 12);
  $('#fx-table').innerHTML = `<thead><tr><th>${fmtFx(amount)} ${from} đổi ra</th><th>Số tiền</th></tr></thead><tbody>${others
    .map((c) => `<tr><td>${c}, ${escapeHtml(nameOf(c))}</td><td>${fmtFx((amount * (rates as Record<string, number>)[c]) / (rates as Record<string, number>)[from])}</td></tr>`)
    .join('')}</tbody>`;
}

async function loadRates(): Promise<void> {
  const cached = cache.get();
  const show = (c: RatesCache) => {
    rates = c.rates;
    fillSelects(Object.keys(c.rates));
    $('#fx-updated').textContent = `Tỷ giá cập nhật lúc ${new Date(c.updatedUnix * 1000).toLocaleString('vi-VN')}.`;
    renderFx();
  };
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return show(cached);
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { result: string; time_last_update_unix: number; rates: Record<string, number> };
    if (data.result !== 'success' || !data.rates?.VND) throw new Error('dữ liệu không hợp lệ');
    const fresh: RatesCache = { fetchedAt: Date.now(), updatedUnix: data.time_last_update_unix, rates: data.rates };
    cache.set(fresh);
    show(fresh);
  } catch (e) {
    if (cached) {
      show(cached);
      $('#fx-updated').textContent += ' Chưa lấy được tỷ giá mới, đang dùng bản đã lưu.';
    } else {
      $('#fx-result').textContent = '—';
      const errorBox = $('#fx-error');
      errorBox.textContent = `Không tải được tỷ giá (${(e as Error).message}). Kiểm tra kết nối mạng rồi tải lại trang.`;
      errorBox.hidden = false;
    }
  }
}

$('#fx-swap').addEventListener('click', () => {
  [fromSel.value, toSel.value] = [toSel.value, fromSel.value];
  renderFx();
});
$('#fx-form').addEventListener('input', renderFx);
$('#fx-form').addEventListener('change', renderFx);
$('#fx-form').addEventListener('submit', (e) => e.preventDefault());
void loadRates();

/* ---------------- Giờ thế giới ---------------- */
const CITIES: [string, string][] = [
  ['Hà Nội, TP.HCM', 'Asia/Ho_Chi_Minh'], ['Bangkok', 'Asia/Bangkok'], ['Singapore', 'Asia/Singapore'],
  ['Bắc Kinh, Thượng Hải', 'Asia/Shanghai'], ['Đài Bắc', 'Asia/Taipei'], ['Seoul', 'Asia/Seoul'], ['Tokyo', 'Asia/Tokyo'],
  ['Sydney', 'Australia/Sydney'], ['Dubai', 'Asia/Dubai'], ['Ấn Độ (New Delhi)', 'Asia/Kolkata'], ['Moskva', 'Europe/Moscow'],
  ['Berlin, Paris', 'Europe/Berlin'], ['London', 'Europe/London'], ['New York', 'America/New_York'],
  ['Chicago', 'America/Chicago'], ['Los Angeles', 'America/Los_Angeles'], ['UTC', 'UTC'],
];
const srcSel = $<HTMLSelectElement>('#tz-src');
const dtInput = $<HTMLInputElement>('#tz-dt');
srcSel.innerHTML = CITIES.map(([n, z]) => `<option value="${z}">${escapeHtml(n)}</option>`).join('');
const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
srcSel.value = CITIES.some(([, z]) => z === localZone) ? localZone : 'Asia/Ho_Chi_Minh';

/** Độ lệch (ms) của múi giờ tz so với UTC tại thời điểm ms */
function tzOffset(ms: number, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** "2026-10-20T09:00" hiểu theo giờ tại tz -> thời điểm UTC */
function zonedToUtc(local: string, tz: string): number {
  const [d, t] = local.split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, da, h, mi);
  let utc = guess - tzOffset(guess, tz);
  utc = guess - tzOffset(utc, tz); // lặp lại một lần để xử lý thời điểm đổi giờ mùa hè
  return utc;
}

let pinned: number | null = null;

function renderClocks(): void {
  const at = pinned ?? Date.now();
  const baseDay = new Intl.DateTimeFormat('en-CA', { timeZone: srcSel.value }).format(at);
  $('#tz-grid').innerHTML = CITIES.map(([name, tz]) => {
    const time = new Intl.DateTimeFormat('vi-VN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
    const date = new Intl.DateTimeFormat('vi-VN', { timeZone: tz, weekday: 'short', day: '2-digit', month: '2-digit' }).format(at);
    const off = tzOffset(at, tz) / 3600000;
    const offText = `UTC${off >= 0 ? '+' : '−'}${Math.floor(Math.abs(off))}${Math.abs(off) % 1 ? `:${String(Math.round((Math.abs(off) % 1) * 60)).padStart(2, '0')}` : ''}`;
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(at);
    const dayNote = day > baseDay ? 'Hôm sau' : day < baseDay ? 'Hôm trước' : '';
    const hour = Number(time.slice(0, 2));
    const night = hour < 6 || hour >= 22;
    return `<div class="clock${tz === srcSel.value ? ' is-source' : ''}${night ? ' is-night' : ''}">
      <span class="clock-city">${escapeHtml(name)}</span>
      <span class="clock-time">${time}</span>
      <span class="clock-meta">${escapeHtml(date)}, ${offText}${dayNote ? `, ${dayNote}` : ''}</span>
    </div>`;
  }).join('');
}

dtInput.addEventListener('input', () => {
  pinned = dtInput.value ? zonedToUtc(dtInput.value, srcSel.value) : null;
  renderClocks();
});
srcSel.addEventListener('change', () => {
  if (dtInput.value) pinned = zonedToUtc(dtInput.value, srcSel.value);
  renderClocks();
});
$('#tz-now').addEventListener('click', () => {
  pinned = null;
  dtInput.value = '';
  renderClocks();
});
renderClocks();
window.setInterval(() => pinned === null && renderClocks(), 15_000);
