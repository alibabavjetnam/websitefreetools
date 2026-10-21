import { mountLayout } from '../layout';
import { $, escapeHtml, storage, toast } from '../ui';

mountLayout({ activeTool: 'study-timetable' });

interface Cell { subject: string; room: string; color: string }
interface Cfg { title: string; days: string[]; periods: string[]; cells: Record<string, Cell> }

const DEFAULT: Cfg = {
  title: 'Thời khoá biểu',
  days: ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'],
  periods: ['Tiết 1\n7:00', 'Tiết 2\n7:50', 'Tiết 3\n8:40', 'Tiết 4\n9:40', 'Tiết 5\n10:30', 'Chiều 1\n13:30', 'Chiều 2\n14:20'],
  cells: {},
};
const store = storage<Cfg>('timetable', DEFAULT);
const COLORS = ['#e7f0ff', '#e6f7ee', '#fff4e0', '#fdecec', '#f3e8ff', '#e0f7fa', '#fce4ec'];
const BORDER = ['#0d6efd', '#0e7a55', '#b8860b', '#b42318', '#7c3aed', '#0097a7', '#c2185b'];

const root = $('#tool-root');
root.innerHTML = `
  <div class="panel code-toolbar">
    <label class="field field--inline" style="flex:1"><span class="field-label">Tiêu đề</span><input type="text" id="title" maxlength="80" /></label>
    <div class="actions">
      <button type="button" class="btn" id="add-period">+ Dòng</button>
      <button type="button" class="btn" id="print">In / Lưu PDF</button>
      <button type="button" class="btn" id="reset">Xoá hết</button>
    </div>
  </div>
  <div class="table-wrap timetable-wrap" style="margin-top:16px"><table class="timetable" id="grid"></table></div>
  <p class="note">Bấm vào ô để nhập môn học và phòng. Dữ liệu lưu trên trình duyệt của bạn. Dùng nút "In / Lưu PDF" để in ra hoặc lưu thành PDF.</p>

  <dialog id="edit" class="cell-dialog">
    <form method="dialog" class="panel">
      <div class="panel-title">Nội dung tiết học</div>
      <label class="field"><span class="field-label">Môn học</span><input type="text" id="d-subject" maxlength="40" /></label>
      <label class="field"><span class="field-label">Phòng / ghi chú</span><input type="text" id="d-room" maxlength="30" /></label>
      <label class="field"><span class="field-label">Màu</span><div class="color-pick" id="d-colors">${COLORS.map((c, i) => `<button type="button" class="color-dot" data-color="${i}" style="background:${c};border-color:${BORDER[i]}"></button>`).join('')}</div></label>
      <div class="actions"><button class="btn btn-primary" id="d-save" value="save">Lưu</button><button class="btn" value="cancel">Huỷ</button><button type="button" class="btn" id="d-clear">Xoá ô</button></div>
    </form>
  </dialog>
`;

let editing = '';
let pickedColor = 0;

function render(): void {
  const cfg = store.get();
  $<HTMLInputElement>('#title').value = cfg.title;
  const head = `<thead><tr><th class="tt-corner">Tiết</th>${cfg.days.map((d, i) => `<th contenteditable="true" data-day="${i}">${escapeHtml(d)}</th>`).join('')}</tr></thead>`;
  const body = cfg.periods.map((p, pi) => {
    const cells = cfg.days.map((_, di) => {
      const key = `${di}-${pi}`;
      const c = cfg.cells[key];
      if (!c || !c.subject) return `<td class="tt-cell" data-key="${key}"></td>`;
      const idx = COLORS.indexOf(c.color);
      return `<td class="tt-cell tt-filled" data-key="${key}" style="background:${c.color};border-left:3px solid ${BORDER[idx] ?? '#0d6efd'}">
        <b>${escapeHtml(c.subject)}</b>${c.room ? `<span>${escapeHtml(c.room)}</span>` : ''}</td>`;
    }).join('');
    return `<tr><th class="tt-period" contenteditable="true" data-period="${pi}">${escapeHtml(p).replace(/\n/g, '<br>')}</th>${cells}</tr>`;
  }).join('');
  $('#grid').innerHTML = head + `<tbody>${body}</tbody>`;
}

$('#grid').addEventListener('click', (e) => {
  const td = (e.target as HTMLElement).closest<HTMLElement>('.tt-cell');
  if (!td) return;
  editing = td.dataset.key!;
  const c = store.get().cells[editing];
  $<HTMLInputElement>('#d-subject').value = c?.subject ?? '';
  $<HTMLInputElement>('#d-room').value = c?.room ?? '';
  pickedColor = c ? Math.max(0, COLORS.indexOf(c.color)) : 0;
  markColor();
  ($('#edit') as HTMLDialogElement).showModal();
  $<HTMLInputElement>('#d-subject').focus();
});
function markColor(): void {
  root.querySelectorAll<HTMLElement>('#d-colors .color-dot').forEach((b, i) => b.classList.toggle('is-sel', i === pickedColor));
}
$('#d-colors').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-color]');
  if (!b) return;
  pickedColor = Number(b.dataset.color);
  markColor();
});
$('#d-save').addEventListener('click', () => {
  const cfg = store.get();
  const subject = $<HTMLInputElement>('#d-subject').value.trim();
  if (subject) cfg.cells[editing] = { subject, room: $<HTMLInputElement>('#d-room').value.trim(), color: COLORS[pickedColor] };
  else delete cfg.cells[editing];
  store.set(cfg);
  render();
});
$('#d-clear').addEventListener('click', () => {
  const cfg = store.get();
  delete cfg.cells[editing];
  store.set(cfg);
  render();
  ($('#edit') as HTMLDialogElement).close();
});

$('#grid').addEventListener('blur', (e) => {
  const t = e.target as HTMLElement;
  const cfg = store.get();
  if (t.dataset.day !== undefined) { cfg.days[Number(t.dataset.day)] = t.textContent?.trim() || cfg.days[Number(t.dataset.day)]; store.set(cfg); }
  if (t.dataset.period !== undefined) { cfg.periods[Number(t.dataset.period)] = (t.innerText.trim()) || cfg.periods[Number(t.dataset.period)]; store.set(cfg); }
}, true);

$('#title').addEventListener('input', () => { const cfg = store.get(); cfg.title = $<HTMLInputElement>('#title').value; store.set(cfg); document.title = cfg.title + ' — WFTools'; });
$('#add-period').addEventListener('click', () => { const cfg = store.get(); cfg.periods.push(`Tiết ${cfg.periods.length + 1}`); store.set(cfg); render(); });
$('#print').addEventListener('click', () => { document.title = store.get().title; window.print(); });
$('#reset').addEventListener('click', () => {
  if (!confirm('Xoá toàn bộ thời khoá biểu và tạo lại từ đầu?')) return;
  store.set(structuredClone(DEFAULT));
  render();
  toast('Đã tạo lại thời khoá biểu trống');
});

render();
