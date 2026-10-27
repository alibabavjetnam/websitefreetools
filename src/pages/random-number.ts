import { mountLayout } from '../layout';
import { $, copyText, fmtInt, storage } from '../ui';
import { pageText, localeTag } from '../i18n';

mountLayout({ activeTool: 'random-number' });
const T = pageText();
const LOCALE = localeTag();

const st = storage<{ min: string; max: string; count: string; unique: boolean; sort: boolean; decimals: string; exclude: string; history: string[] }>('random-number', {
  min: '1', max: '100', count: '1', unique: true, sort: false, decimals: '0', exclude: '', history: [],
});
const s = st.get();

$('#tool-root').innerHTML = `
  <div class="workspace">
    <form class="panel" id="form" novalidate>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('min', 'Từ số')}</span><input type="number" id="min" step="any" /></label>
        <label class="field"><span class="field-label">${T('max', 'Đến số')}</span><input type="number" id="max" step="any" /></label>
      </div>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('count', 'Số lượng cần lấy')}</span><input type="number" id="count" min="1" max="10000" step="1" /></label>
        <label class="field"><span class="field-label">${T('decimals', 'Số chữ số thập phân')}</span><input type="number" id="decimals" min="0" max="6" step="1" /></label>
      </div>
      <label class="check"><input type="checkbox" id="unique" /><span>${T('unique', 'Không lấy trùng số')}</span></label>
      <label class="check"><input type="checkbox" id="sort" /><span>${T('sortOpt', 'Sắp xếp kết quả từ nhỏ đến lớn')}</span></label>
      <label class="field"><span class="field-label">${T('exclude', 'Loại trừ các số (cách nhau bằng dấu phẩy)')}</span><input type="text" id="exclude" class="input-inline" placeholder="7, 13, 49" /></label>
      <div class="row">
        <span class="note">${T('presets', 'Nhanh:')}</span>
        <button type="button" class="btn btn-sm" data-p="1,10,1">1–10</button>
        <button type="button" class="btn btn-sm" data-p="1,100,1">1–100</button>
        <button type="button" class="btn btn-sm" data-p="1,6,1">${T('dice', 'Xúc xắc')}</button>
        <button type="button" class="btn btn-sm" data-p="1,45,6">${T('lotto645', 'Vé 6/45')}</button>
        <button type="button" class="btn btn-sm" data-p="0,99,1">${T('twoDigit', '2 số cuối 00–99')}</button>
      </div>
    </form>
    <section class="preview">
      <div class="panel" style="align-items:center">
        <div class="big-number" id="out" aria-live="polite"><span>?</span></div>
        <div class="actions">
          <button type="button" class="btn btn-primary" id="go">${T('go', 'Quay số')}</button>
          <button type="button" class="btn" id="copy">${T('copy', 'Sao chép')}</button>
        </div>
        <p class="error" id="err" hidden></p>
      </div>
      <div class="panel"><div class="panel-title" style="margin:0">${T('history', 'Các lần quay trước')}</div><ol class="plain-list" id="hist"></ol></div>
      <p class="note">${T('fair', 'Dùng bộ sinh số ngẫu nhiên an toàn của trình duyệt (crypto.getRandomValues), không thiên vị số nào.')}</p>
    </section>
  </div>
`;

const ids = ['min', 'max', 'count', 'decimals', 'exclude'] as const;
for (const id of ids) $<HTMLInputElement>('#' + id).value = s[id];
$<HTMLInputElement>('#unique').checked = s.unique;
$<HTMLInputElement>('#sort').checked = s.sort;

/** Số nguyên ngẫu nhiên đều trong [0, n) — loại bỏ phần dư để không thiên vị */
function randInt(n: number): number {
  if (n <= 1) return 0;
  if (n > 2 ** 32) return Math.floor((crypto.getRandomValues(new Uint32Array(2)).reduce((a, b) => a * 2 ** 32 + b, 0) / 2 ** 64) * n);
  const limit = Math.floor(2 ** 32 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

let last: number[] = [];
function save(): void {
  for (const id of ids) (s as Record<string, unknown>)[id] = $<HTMLInputElement>('#' + id).value;
  s.unique = $<HTMLInputElement>('#unique').checked;
  s.sort = $<HTMLInputElement>('#sort').checked;
  st.set(s);
}
const showErr = (m: string) => { const e = $('#err'); e.textContent = m; e.hidden = !m; };

function go(): void {
  save();
  showErr('');
  const dec = Math.min(6, Math.max(0, Math.floor(Number(s.decimals) || 0)));
  const scale = 10 ** dec;
  let lo = Math.ceil(Number(s.min) * scale);
  let hi = Math.floor(Number(s.max) * scale);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) { showErr(T('errRange', 'Nhập đủ số nhỏ nhất và lớn nhất.')); return; }
  if (lo > hi) [lo, hi] = [hi, lo];
  const count = Math.min(10000, Math.max(1, Math.floor(Number(s.count) || 1)));
  const excl = new Set(s.exclude.split(/[,;\s]+/).filter(Boolean).map((x) => Math.round(Number(x) * scale)).filter(Number.isFinite));
  const span = hi - lo + 1;
  const pool = span - [...excl].filter((x) => x >= lo && x <= hi).length;
  if (pool <= 0) { showErr(T('errEmpty', 'Không còn số nào trong khoảng sau khi loại trừ.')); return; }
  if (s.unique && count > pool) { showErr(`${T('errUnique', 'Khoảng này chỉ có')} ${fmtInt(pool)} ${T('errUnique2', 'số khác nhau; hãy giảm số lượng hoặc bỏ chọn "Không lấy trùng".')}`); return; }
  const out: number[] = [];
  const used = new Set<number>();
  let guard = 0;
  while (out.length < count && guard++ < count * 200 + 1000) {
    const v = lo + randInt(span);
    if (excl.has(v) || (s.unique && used.has(v))) continue;
    used.add(v);
    out.push(v);
  }
  if (s.unique && out.length < count) {
    // Khoảng hẹp, gần hết số: lấy theo cách xáo trộn danh sách còn lại
    const rest: number[] = [];
    for (let v = lo; v <= hi && rest.length < 2_000_000; v++) if (!excl.has(v) && !used.has(v)) rest.push(v);
    while (out.length < count && rest.length) out.push(rest.splice(randInt(rest.length), 1)[0]);
  }
  if (s.sort) out.sort((a, b) => a - b);
  last = out.map((v) => v / scale);
  const box = $('#out');
  box.classList.toggle('is-many', last.length > 6);
  const text = last.map((v) => v.toLocaleString(LOCALE, { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: false }));
  const show = text.slice(0, 500);
  box.innerHTML = show.map((t) => `<span>${t}</span>`).join('') + (text.length > show.length ? `<p class="note">+${fmtInt(text.length - show.length)} ${T('more', 'số nữa (bấm Sao chép để lấy đủ)')}</p>` : '');
  s.history.unshift(text.slice(0, 20).join(', ') + (text.length > 20 ? ' …' : ''));
  s.history = s.history.slice(0, 15);
  st.set(s);
  renderHist();
}
function renderHist(): void {
  $('#hist').innerHTML = s.history.map((h) => `<li>${h}</li>`).join('') || `<li class="note" style="list-style:none">${T('noHist', 'Chưa quay lần nào.')}</li>`;
}

$('#go').addEventListener('click', go);
$('#form').addEventListener('input', save);
$('#form').addEventListener('submit', (e) => { e.preventDefault(); go(); });
$('#copy').addEventListener('click', () => { if (last.length) void copyText(last.join(', ')); });
document.querySelectorAll<HTMLButtonElement>('[data-p]').forEach((b) => b.addEventListener('click', () => {
  const [a, z, c] = (b.dataset.p as string).split(',');
  $<HTMLInputElement>('#min').value = a;
  $<HTMLInputElement>('#max').value = z;
  $<HTMLInputElement>('#count').value = c;
  $<HTMLInputElement>('#decimals').value = '0';
  $<HTMLInputElement>('#unique').checked = true;
  $<HTMLInputElement>('#sort').checked = c !== '1';
  go();
}));
renderHist();
