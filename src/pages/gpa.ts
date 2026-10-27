import { mountLayout } from '../layout';
import { $, escapeHtml, fmtDec, parseNumber, storage } from '../ui';
import { pageText, currentLang } from '../i18n';
import { LETTER_POINTS, vn10, pct100, gpa, vnRank, type Course } from '../calc/gpa';

mountLayout({ activeTool: 'gpa' });
const T = pageText();

type Scale = 'letter' | 'vn10' | 'pct' | 'p4';
interface Row { name: string; credits: string; grade: string }
interface State { scale: Scale; rows: Row[]; prevGpa: string; prevCredits: string; target: string }

const isVi = currentLang() === 'vi';
const sample = (): Row[] =>
  isVi
    ? [{ name: 'Giải tích 1', credits: '3', grade: '8.2' }, { name: 'Tiếng Anh 1', credits: '2', grade: '7.5' }, { name: 'Lập trình C', credits: '4', grade: '9.0' }, { name: 'Triết học', credits: '3', grade: '6.8' }]
    : [{ name: T('ex1', 'Calculus I'), credits: '4', grade: 'A-' }, { name: T('ex2', 'English Composition'), credits: '3', grade: 'B+' }, { name: T('ex3', 'Intro to Programming'), credits: '3', grade: 'A' }, { name: T('ex4', 'World History'), credits: '3', grade: 'B' }];
const st = storage<State>('gpa', { scale: isVi ? 'vn10' : 'letter', rows: [], prevGpa: '', prevCredits: '', target: '' });
const s = st.get();
if (!s.rows.length) s.rows = sample();

const SCALES: [Scale, string][] = [
  ['letter', T('sLetter', 'Điểm chữ A, B, C, D, F (hệ 4)')],
  ['vn10', T('sVn10', 'Thang 10 (quy đổi theo quy chế tín chỉ Việt Nam)')],
  ['pct', T('sPct', 'Phần trăm 0–100')],
  ['p4', T('sP4', 'Nhập trực tiếp điểm hệ 4')],
];

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:28px">
    <label class="field" style="max-width:460px"><span class="field-label">${T('scale', 'Kiểu điểm')}</span>
      <select id="scale">${SCALES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
    </label>
    <div class="table-wrap"><table class="data-table" id="tbl"></table></div>
    <div class="row">
      <button type="button" class="btn btn-sm" id="add">${T('add', '+ Thêm môn')}</button>
      <button type="button" class="btn btn-sm" id="reset">${T('reset', 'Xoá hết, làm lại')}</button>
    </div>
  </div>
  <div class="workspace">
    <section class="panel">
      <div class="panel-title" style="margin:0">${T('cumTitle', 'Tính GPA tích luỹ (không bắt buộc)')}</div>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('prevGpa', 'GPA tích luỹ hiện tại (hệ 4)')}</span><input type="text" inputmode="decimal" id="prev-gpa" class="input-inline" placeholder="3.2" /></label>
        <label class="field"><span class="field-label">${T('prevCredits', 'Số tín chỉ đã tích luỹ')}</span><input type="text" inputmode="decimal" id="prev-cr" class="input-inline" placeholder="60" /></label>
      </div>
      <label class="field"><span class="field-label">${T('target', 'GPA mục tiêu cuối khoá (hệ 4)')}</span><input type="text" inputmode="decimal" id="target" class="input-inline" placeholder="3.2" /></label>
      <p class="note" id="target-note"></p>
    </section>
    <section class="preview">
      <div class="stat-grid" id="out"></div>
      <p class="note" id="rank"></p>
      <details class="options"><summary>${T('tableTitle', 'Bảng quy đổi điểm')}</summary><div class="options-body" id="conv"></div></details>
    </section>
  </div>
`;

const scaleEl = $<HTMLSelectElement>('#scale');
scaleEl.value = s.scale;
$<HTMLInputElement>('#prev-gpa').value = s.prevGpa;
$<HTMLInputElement>('#prev-cr').value = s.prevCredits;
$<HTMLInputElement>('#target').value = s.target;

/** Quy đổi một điểm nhập theo thang đang chọn → {chữ, hệ 4}; null nếu không hợp lệ */
function convert(raw: string): { letter: string; p4: number } | null {
  const v = raw.trim();
  if (!v) return null;
  if (s.scale === 'letter') {
    const hit = LETTER_POINTS.find(([l]) => l === v.toUpperCase().replace('−', '-'));
    return hit ? { letter: hit[0], p4: hit[1] } : null;
  }
  const n = parseNumber(v);
  if (!Number.isFinite(n)) return null;
  if (s.scale === 'vn10') return n < 0 || n > 10 ? null : vn10(n);
  if (s.scale === 'pct') return n < 0 || n > 100 ? null : pct100(n);
  return n < 0 || n > 4 ? null : { letter: '', p4: n };
}

function gradeInput(i: number, val: string): string {
  if (s.scale === 'letter') {
    return `<select data-i="${i}" data-k="grade" aria-label="${T('grade', 'Điểm')}">${LETTER_POINTS.map(([l]) => `<option${l === val ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  }
  const ph = s.scale === 'vn10' ? '8.5' : s.scale === 'pct' ? '92' : '3.5';
  return `<input type="text" inputmode="decimal" class="input-inline" style="width:90px" data-i="${i}" data-k="grade" value="${escapeHtml(val)}" placeholder="${ph}" aria-label="${T('grade', 'Điểm')}" />`;
}

function renderTable(): void {
  $('#tbl').innerHTML = `
    <thead><tr><th>${T('course', 'Môn học')}</th><th>${T('credits', 'Tín chỉ')}</th><th>${T('grade', 'Điểm')}</th><th>${T('conv', 'Quy đổi')}</th><th></th></tr></thead>
    <tbody>${s.rows.map((r, i) => `
      <tr>
        <td><input type="text" class="input-inline" style="width:100%;min-width:140px" data-i="${i}" data-k="name" value="${escapeHtml(r.name)}" placeholder="${T('coursePh', 'Tên môn')} ${i + 1}" /></td>
        <td><input type="text" inputmode="decimal" class="input-inline" style="width:70px" data-i="${i}" data-k="credits" value="${escapeHtml(r.credits)}" /></td>
        <td>${gradeInput(i, r.grade)}</td>
        <td data-conv="${i}"></td>
        <td><button type="button" class="btn btn-sm" data-del="${i}" aria-label="${T('del', 'Xoá môn')}">✕</button></td>
      </tr>`).join('')}</tbody>`;
}

function compute(): void {
  const courses: Course[] = [];
  s.rows.forEach((r, i) => {
    const c = convert(r.grade);
    const cr = parseNumber(r.credits);
    const cell = document.querySelector(`[data-conv="${i}"]`);
    if (cell) cell.textContent = c ? `${c.letter ? c.letter + ' · ' : ''}${fmtDec(c.p4)}` : r.grade.trim() ? T('bad', 'Điểm không hợp lệ') : '';
    if (c && cr > 0) courses.push({ credits: cr, p4: c.p4, counts: true });
  });
  const term = gpa(courses);
  const pg = parseNumber($<HTMLInputElement>('#prev-gpa').value);
  const pc = parseNumber($<HTMLInputElement>('#prev-cr').value);
  const hasPrev = pg >= 0 && pg <= 4 && pc > 0;
  const cumCredits = term.credits + (hasPrev ? pc : 0);
  const cum = hasPrev ? (term.points + pg * pc) / cumCredits : term.gpa;
  const stat = (l: string, v: string, main = false) => `<div class="stat${main ? ' stat--main' : ''}"><span class="stat-label">${l}</span><span class="stat-value">${v}</span></div>`;
  $('#out').innerHTML = [
    stat(T('termGpa', 'GPA học kỳ (hệ 4)'), Number.isFinite(term.gpa) ? term.gpa.toFixed(2) : '—', true),
    stat(T('termCredits', 'Tín chỉ học kỳ'), fmtDec(term.credits)),
    ...(hasPrev ? [stat(T('cumGpa', 'GPA tích luỹ mới'), cum.toFixed(2)), stat(T('cumCredits', 'Tổng tín chỉ'), fmtDec(cumCredits))] : []),
  ].join('');
  const g = hasPrev ? cum : term.gpa;
  if (Number.isFinite(g) && (s.scale === 'vn10' || isVi)) {
    const names = { excellent: T('rExcellent', 'Xuất sắc'), veryGood: T('rVeryGood', 'Giỏi'), good: T('rGood', 'Khá'), average: T('rAverage', 'Trung bình'), weak: T('rWeak', 'Yếu') };
    $('#rank').innerHTML = `${T('rankLabel', 'Xếp loại theo quy chế đại học Việt Nam')}: <b>${names[vnRank(g)]}</b>`;
  } else $('#rank').textContent = '';
  // Cần đạt bao nhiêu ở phần còn lại để chạm mục tiêu: hỏi thêm tổng tín chỉ cả khoá thì phức tạp, nên chỉ báo mức cần cho học kỳ này
  const target = parseNumber($<HTMLInputElement>('#target').value);
  const tn = $('#target-note');
  if (hasPrev && target > 0 && target <= 4 && term.credits > 0) {
    const need = (target * cumCredits - pg * pc) / term.credits;
    tn.textContent = need > 4
      ? T('needImpossible', 'Học kỳ này chưa đủ để đạt mục tiêu, kể cả khi đạt điểm tối đa; cần thêm học kỳ sau.')
      : `${T('needTpl', 'Để GPA tích luỹ đạt mục tiêu, học kỳ này cần GPA tối thiểu')} ${Math.max(0, need).toFixed(2)}.`;
  } else tn.textContent = T('targetHint', 'Nhập GPA và tín chỉ tích luỹ để xem GPA mới và mức điểm cần đạt.');
  st.set(s);
}

function renderConv(): void {
  const rows = s.scale === 'vn10'
    ? [['8.5 – 10', 'A', '4.0'], ['8.0 – 8.4', 'B+', '3.5'], ['7.0 – 7.9', 'B', '3.0'], ['6.5 – 6.9', 'C+', '2.5'], ['5.5 – 6.4', 'C', '2.0'], ['5.0 – 5.4', 'D+', '1.5'], ['4.0 – 4.9', 'D', '1.0'], ['< 4.0', 'F', '0']]
    : s.scale === 'pct'
      ? [['97–100', 'A+', '4.0'], ['93–96', 'A', '4.0'], ['90–92', 'A-', '3.7'], ['87–89', 'B+', '3.3'], ['83–86', 'B', '3.0'], ['80–82', 'B-', '2.7'], ['77–79', 'C+', '2.3'], ['73–76', 'C', '2.0'], ['70–72', 'C-', '1.7'], ['67–69', 'D+', '1.3'], ['63–66', 'D', '1.0'], ['60–62', 'D-', '0.7'], ['< 60', 'F', '0']]
      : LETTER_POINTS.map(([l, p]) => ['', l, p.toFixed(1)]);
  $('#conv').innerHTML = `<table class="data-table"><tbody>${rows.map((r) => `<tr>${r[0] ? `<td>${r[0]}</td>` : ''}<td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table>
    <p class="note">${T('convNote', 'Mỗi trường có thể quy đổi hơi khác; hãy đối chiếu quy chế của trường bạn.')}</p>`;
}

$('#tbl').addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  const i = Number(el.dataset.i);
  if (Number.isNaN(i)) return;
  s.rows[i][el.dataset.k as keyof Row] = el.value;
  compute();
});
$('#tbl').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-del]');
  if (!b) return;
  s.rows.splice(Number(b.dataset.del), 1);
  renderTable();
  compute();
});
$('#add').addEventListener('click', () => {
  s.rows.push({ name: '', credits: '3', grade: s.scale === 'letter' ? 'A' : '' });
  renderTable();
  compute();
});
$('#reset').addEventListener('click', () => {
  s.rows = [{ name: '', credits: '3', grade: s.scale === 'letter' ? 'A' : '' }];
  renderTable();
  compute();
});
scaleEl.addEventListener('change', () => {
  s.scale = scaleEl.value as Scale;
  // Đổi kiểu điểm: điểm cũ có thể không hợp lệ ở thang mới nên đặt lại ô điểm
  s.rows.forEach((r) => { if (!convert(r.grade)) r.grade = s.scale === 'letter' ? 'A' : ''; });
  renderTable();
  renderConv();
  compute();
});
['prev-gpa', 'prev-cr', 'target'].forEach((id) => $('#' + id).addEventListener('input', () => {
  s.prevGpa = $<HTMLInputElement>('#prev-gpa').value;
  s.prevCredits = $<HTMLInputElement>('#prev-cr').value;
  s.target = $<HTMLInputElement>('#target').value;
  compute();
}));
renderTable();
renderConv();
compute();
