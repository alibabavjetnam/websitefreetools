import { mountLayout } from '../layout';
import { $, escapeHtml } from '../ui';
import { SheetStore, newId } from '../google/sync';

mountLayout({ activeTool: 'attendance' });

interface Student { id: string; name: string }
interface Mark { id: string; studentId: string; date: string; status: string }
type Data = { students: Student[]; marks: Mark[] };

const store = new SheetStore<Data>({
  tag: 'attendance',
  title: 'WFTools - Điểm danh',
  empty: { students: [], marks: [] },
  tables: {
    students: { sheet: 'Học viên', columns: [{ key: 'id', label: 'Mã' }, { key: 'name', label: 'Họ tên' }] },
    marks: { sheet: 'Điểm danh', columns: [{ key: 'id', label: 'Mã' }, { key: 'studentId', label: 'Mã học viên' }, { key: 'date', label: 'Ngày' }, { key: 'status', label: 'Trạng thái' }] },
  },
});

const STATUS = [
  { code: '', label: '—', cls: '' },
  { code: 'present', label: 'Có mặt', cls: 'att-present', mark: '✓' },
  { code: 'absent', label: 'Vắng', cls: 'att-absent', mark: 'V' },
  { code: 'late', label: 'Muộn', cls: 'att-late', mark: 'M' },
  { code: 'excused', label: 'Có phép', cls: 'att-excused', mark: 'P' },
];
const nextStatus = (c: string) => STATUS[(STATUS.findIndex((s) => s.code === c) + 1) % STATUS.length].code;
const todayKey = () => new Date().toLocaleDateString('en-CA');
let date = todayKey();

const root = $('#tool-root');
root.innerHTML = `
  <div class="tool-body">
    <div class="panel code-toolbar">
      <form id="add-form" class="field field--inline" style="flex:1"><span class="field-label">Thêm học viên</span><input id="name" type="text" maxlength="80" placeholder="Nhập họ tên rồi Enter (mỗi dòng một người khi dán nhiều)" autocomplete="off" /></form>
      <label class="field field--inline"><span class="field-label">Ngày điểm danh</span><input type="date" id="date" value="${date}" /></label>
    </div>
    <div class="stat-grid" id="summary" style="margin-top:16px"></div>
    <div class="table-wrap" style="margin-top:16px"><table class="data-table att-table" id="grid"></table></div>
    <p class="note" style="margin-top:10px">Bấm vào ô trạng thái để chuyển lần lượt: Có mặt → Vắng → Muộn → Có phép. Cột tổng hợp đếm toàn bộ lịch sử. Đăng nhập Google để lưu vào Google Sheet.</p>
  </div>
`;
store.mount(root);

function render(): void {
  const d = store.get();
  const markMap = new Map(d.marks.map((m) => [`${m.studentId}|${m.date}`, m.status]));
  const todayMarks = d.marks.filter((m) => m.date === date);
  const present = todayMarks.filter((m) => m.status === 'present' || m.status === 'late').length;
  $('#summary').innerHTML = d.students.length
    ? `<div class="stat stat--main"><span class="stat-label">Ngày ${date.split('-').reverse().join('/')}</span><span class="stat-value">${present}/${d.students.length} có mặt</span></div>
       <div class="stat"><span class="stat-label">Vắng</span><span class="stat-value">${todayMarks.filter((m) => m.status === 'absent').length}</span></div>
       <div class="stat"><span class="stat-label">Muộn</span><span class="stat-value">${todayMarks.filter((m) => m.status === 'late').length}</span></div>`
    : '';
  if (!d.students.length) {
    $('#grid').innerHTML = '<tbody><tr><td class="note">Chưa có học viên. Thêm tên ở ô phía trên (có thể dán nhiều dòng).</td></tr></tbody>';
    return;
  }
  const count = (sid: string, st: string) => d.marks.filter((m) => m.studentId === sid && m.status === st).length;
  $('#grid').innerHTML = `<thead><tr><th>#</th><th>Họ tên</th><th>Hôm nay</th><th>Có mặt</th><th>Vắng</th><th>Muộn</th><th></th></tr></thead>
    <tbody>${d.students.map((s, i) => {
      const st = markMap.get(`${s.id}|${date}`) ?? '';
      const info = STATUS.find((x) => x.code === st)!;
      return `<tr><td>${i + 1}</td><td><b>${escapeHtml(s.name)}</b></td>
        <td><button type="button" class="att-cell ${info.cls}" data-toggle="${s.id}" title="Bấm để đổi">${info.mark ?? '—'}</button></td>
        <td>${count(s.id, 'present') + count(s.id, 'late')}</td><td>${count(s.id, 'absent')}</td><td>${count(s.id, 'late')}</td>
        <td><button type="button" class="btn btn-sm" data-del="${s.id}">Xoá</button></td></tr>`;
    }).join('')}</tbody>`;
}

$('#add-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $<HTMLInputElement>('#name');
  const names = input.value.split('\n').map((n) => n.trim()).filter(Boolean);
  if (!names.length) return;
  const d = store.get();
  store.set({ ...d, students: [...d.students, ...names.map((name) => ({ id: newId(), name }))] });
  input.value = '';
  render();
});
$('#grid').addEventListener('click', (e) => {
  const toggle = (e.target as HTMLElement).closest<HTMLElement>('[data-toggle]')?.dataset.toggle;
  const del = (e.target as HTMLElement).closest<HTMLElement>('[data-del]')?.dataset.del;
  const d = store.get();
  if (toggle) {
    const existing = d.marks.find((m) => m.studentId === toggle && m.date === date);
    const ns = nextStatus(existing?.status ?? '');
    let marks = d.marks.filter((m) => !(m.studentId === toggle && m.date === date));
    if (ns) marks = [...marks, { id: existing?.id ?? newId(), studentId: toggle, date, status: ns }];
    store.set({ ...d, marks });
    render();
  } else if (del) {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-del]')!;
    if (btn.dataset.confirm !== '1') { btn.dataset.confirm = '1'; btn.textContent = 'Bấm lần nữa'; setTimeout(() => { btn.dataset.confirm = ''; btn.textContent = 'Xoá'; }, 3000); return; }
    store.set({ students: d.students.filter((x) => x.id !== del), marks: d.marks.filter((m) => m.studentId !== del) });
    render();
  }
});
$('#date').addEventListener('change', () => { date = $<HTMLInputElement>('#date').value || todayKey(); render(); });
store.onChange(render);
render();
