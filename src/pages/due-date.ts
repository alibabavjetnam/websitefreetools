import { mountLayout } from '../layout';
import { $, fmtInt, storage } from '../ui';
import { pageText, localeTag } from '../i18n';
import { parseKey, toKey, todayKey, daysBetween, addDays } from '../calc/dates';

mountLayout({ activeTool: 'due-date' });
const T = pageText();
const LOCALE = localeTag();

type Method = 'lmp' | 'conception' | 'ultrasound' | 'ivf';
const st = storage<{ method: Method; date: string; cycle: string; usW: string; usD: string; ivfDay: string }>('due-date', { method: 'lmp', date: '', cycle: '28', usW: '8', usD: '0', ivfDay: '5' });
const s = st.get();

$('#tool-root').innerHTML = `
  <div class="workspace">
    <form class="panel" id="form" novalidate>
      <label class="field"><span class="field-label">${T('method', 'Tính theo')}</span>
        <select id="method">
          <option value="lmp">${T('mLmp', 'Ngày đầu kỳ kinh cuối')}</option>
          <option value="conception">${T('mConc', 'Ngày thụ thai')}</option>
          <option value="ultrasound">${T('mUs', 'Kết quả siêu âm')}</option>
          <option value="ivf">${T('mIvf', 'Ngày chuyển phôi (IVF)')}</option>
        </select>
      </label>
      <label class="field"><span class="field-label" id="date-label"></span><input type="date" id="date" /></label>
      <label class="field" data-show="lmp"><span class="field-label">${T('cycle', 'Độ dài chu kỳ kinh (ngày)')}</span><input type="number" id="cycle" min="20" max="45" step="1" /></label>
      <div class="field-row" data-show="ultrasound">
        <label class="field"><span class="field-label">${T('usWeeks', 'Tuổi thai khi siêu âm: tuần')}</span><input type="number" id="us-w" min="4" max="42" step="1" /></label>
        <label class="field"><span class="field-label">${T('usDays', 'ngày')}</span><input type="number" id="us-d" min="0" max="6" step="1" /></label>
      </div>
      <label class="field" data-show="ivf"><span class="field-label">${T('ivfDay', 'Phôi ngày')}</span>
        <select id="ivf-day"><option value="3">${T('day3', 'Phôi ngày 3')}</option><option value="5">${T('day5', 'Phôi ngày 5')}</option><option value="6">${T('day6', 'Phôi ngày 6')}</option></select>
      </label>
      <p class="note">${T('disclaimer', 'Kết quả chỉ để tham khảo. Chỉ khoảng 4% em bé chào đời đúng ngày dự sinh; phần lớn sinh trong khoảng 37–42 tuần. Hãy theo dõi với bác sĩ sản khoa.')}</p>
    </form>
    <section class="preview">
      <div class="stat stat--main"><span class="stat-label">${T('due', 'Ngày dự sinh')}</span><span class="stat-value" id="due">—</span></div>
      <div class="stat-grid" id="stats"></div>
      <div class="progress" aria-hidden="true"><i id="bar"></i></div>
      <div class="panel"><div class="panel-title" style="margin:0">${T('milestones', 'Các mốc quan trọng')}</div><div class="table-wrap"><table class="data-table" id="ms"></table></div></div>
    </section>
  </div>
`;
const $i = <E extends HTMLElement = HTMLInputElement>(id: string) => $<E>('#' + id);
$i<HTMLSelectElement>('method').value = s.method;
$i('date').value = s.date || toKey(addDays(parseKey(todayKey()) as Date, -70));
$i('cycle').value = s.cycle;
$i('us-w').value = s.usW;
$i('us-d').value = s.usD;
$i<HTMLSelectElement>('ivf-day').value = s.ivfDay;

const shortDate = (d: Date) => d.toLocaleDateString(LOCALE, { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' });
const fmtDate = (d: Date) => d.toLocaleDateString(LOCALE, { timeZone: 'UTC', weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
const LABELS: Record<Method, string> = {
  lmp: T('lLmp', 'Ngày đầu tiên của kỳ kinh cuối'),
  conception: T('lConc', 'Ngày thụ thai (ước tính)'),
  ultrasound: T('lUs', 'Ngày siêu âm'),
  ivf: T('lIvf', 'Ngày chuyển phôi'),
};

function render(): void {
  const m = $i<HTMLSelectElement>('method').value as Method;
  document.querySelectorAll<HTMLElement>('[data-show]').forEach((el) => (el.hidden = el.dataset.show !== m));
  $('#date-label').textContent = LABELS[m];
  st.set({ method: m, date: $i('date').value, cycle: $i('cycle').value, usW: $i('us-w').value, usD: $i('us-d').value, ivfDay: $i<HTMLSelectElement>('ivf-day').value });
  const d = parseKey($i('date').value);
  if (!d) { $('#due').textContent = '—'; return; }
  // Quy về "ngày đầu kỳ kinh cuối" tương đương (LMP), từ đó dự sinh = LMP + 280 ngày (quy tắc Naegele)
  let lmp: Date;
  if (m === 'lmp') {
    const cycle = Math.min(45, Math.max(20, Number($i('cycle').value) || 28));
    lmp = addDays(d, cycle - 28);
  } else if (m === 'conception') lmp = addDays(d, -14);
  else if (m === 'ultrasound') {
    const ga = (Number($i('us-w').value) || 0) * 7 + Math.min(6, Number($i('us-d').value) || 0);
    lmp = addDays(d, -ga);
  } else {
    const day = Number($i<HTMLSelectElement>('ivf-day').value) || 5;
    lmp = addDays(d, -(14 + day));
  }
  const due = addDays(lmp, 280);
  const today = parseKey(todayKey()) as Date;
  const ga = daysBetween(lmp, today);
  const left = daysBetween(today, due);
  $('#due').textContent = fmtDate(due);
  const tri = ga < 0 ? '—' : ga < 14 * 7 ? T('t1', 'Tam cá nguyệt 1') : ga < 28 * 7 ? T('t2', 'Tam cá nguyệt 2') : T('t3', 'Tam cá nguyệt 3');
  const stat = (l: string, v: string) => `<div class="stat"><span class="stat-label">${l}</span><span class="stat-value">${v}</span></div>`;
  $('#stats').innerHTML = [
    stat(T('ga', 'Tuổi thai hôm nay'), ga < 0 ? '—' : ga > 300 ? T('passed', 'Đã qua ngày dự sinh') : `${fmtInt(Math.floor(ga / 7))} ${T('w', 'tuần')} ${ga % 7} ${T('d', 'ngày')}`),
    stat(T('left', 'Còn lại'), left >= 0 ? `${fmtInt(left)} ${T('d', 'ngày')}` : `${fmtInt(-left)} ${T('dOver', 'ngày quá dự sinh')}`),
    stat(T('tri', 'Giai đoạn'), tri),
    stat(T('conceived', 'Ngày thụ thai ước tính'), fmtDate(addDays(lmp, 14))),
  ].join('');
  $<HTMLElement>('#bar').style.width = `${Math.max(0, Math.min(100, (ga / 280) * 100))}%`;
  const ms: [number, number, string][] = [
    [6 * 7, 8 * 7, T('ms1', 'Siêu âm xác nhận tim thai')],
    [11 * 7, 13 * 7 + 6, T('ms2', 'Đo độ mờ da gáy, sàng lọc quý 1')],
    [14 * 7, 14 * 7, T('ms3', 'Bắt đầu tam cá nguyệt 2')],
    [18 * 7, 22 * 7, T('ms4', 'Siêu âm hình thái chi tiết')],
    [24 * 7, 28 * 7, T('ms5', 'Xét nghiệm tiểu đường thai kỳ')],
    [28 * 7, 28 * 7, T('ms6', 'Bắt đầu tam cá nguyệt 3')],
    [37 * 7, 37 * 7, T('ms7', 'Thai đủ tháng (37 tuần)')],
    [40 * 7, 40 * 7, T('ms8', 'Ngày dự sinh (40 tuần)')],
    [42 * 7, 42 * 7, T('ms9', 'Quá ngày dự sinh 2 tuần (42 tuần)')],
  ];
  $('#ms').innerHTML = `<tbody>${ms.map(([a, b, label]) => {
    const da = addDays(lmp, a);
    const db = addDays(lmp, b);
    const done = daysBetween(db, today) > 0;
    return `<tr${done ? ' style="opacity:.55"' : ''}><td style="white-space:normal">${label}</td><td style="white-space:nowrap">${a === b ? shortDate(da) : `${shortDate(da)} – ${shortDate(db)}`}</td></tr>`;
  }).join('')}</tbody>`;
}
$('#form').addEventListener('input', render);
render();
