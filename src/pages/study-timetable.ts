import { mountLayout } from '../layout';
import { $, escapeHtml, toast } from '../ui';
import { SheetStore } from '../google/sync';

mountLayout({ activeTool: 'study-timetable' });

interface Setting { id: string; title: string; days: string; periodCount: number; morningCount: number; minutes: number; morningStart: string; afternoonStart: string }
interface Cell { id: string; day: number; period: number; subject: string; room: string }
type Data = { settings: Setting[]; cells: Cell[] };

const DEFAULT_DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const DEFAULT: Setting = { id: 'main', title: 'Thời khoá biểu', days: JSON.stringify(DEFAULT_DAYS), periodCount: 10, morningCount: 5, minutes: 45, morningStart: '07:00', afternoonStart: '13:30' };

const store = new SheetStore<Data>({
  tag: 'timetable',
  title: 'WFTools - Thời khoá biểu',
  empty: { settings: [], cells: [] },
  tables: {
    settings: { sheet: 'Cấu hình', columns: [
      { key: 'id', label: 'Mã' }, { key: 'title', label: 'Tiêu đề' }, { key: 'days', label: 'Các ngày' },
      { key: 'periodCount', label: 'Số tiết', type: 'number' }, { key: 'morningCount', label: 'Số tiết sáng', type: 'number' },
      { key: 'minutes', label: 'Phút mỗi tiết', type: 'number' }, { key: 'morningStart', label: 'Bắt đầu sáng' }, { key: 'afternoonStart', label: 'Bắt đầu chiều' },
    ] },
    cells: { sheet: 'Nội dung', columns: [
      { key: 'id', label: 'Mã' }, { key: 'day', label: 'Ngày', type: 'number' }, { key: 'period', label: 'Tiết', type: 'number' },
      { key: 'subject', label: 'Môn học' }, { key: 'room', label: 'Phòng' },
    ] },
  },
});

// Màu: tiết buổi sáng xanh dương, tiết buổi chiều cam
const MORNING = { bg: '#e7f0ff', border: '#0d6efd' };
const AFTERNOON = { bg: '#fff4e0', border: '#d97706' };
const pad = (n: number) => String(n).padStart(2, '0');

function settings(): Setting {
  return store.get().settings.find((s) => s.id === 'main') ?? { ...DEFAULT };
}
function saveSettings(patch: Partial<Setting>): void {
  const cur = settings();
  const next: Setting = { ...cur, ...patch, id: 'main' };
  const d = store.get();
  store.set({ ...d, settings: [next] });
}
function days(s: Setting): string[] {
  try { const a = JSON.parse(s.days); return Array.isArray(a) && a.length ? a : DEFAULT_DAYS; } catch { return DEFAULT_DAYS; }
}
function periodTimes(s: Setting): string[] {
  const times: string[] = [];
  for (let i = 0; i < s.periodCount; i++) {
    const morning = i < s.morningCount;
    const [h, m] = (morning ? s.morningStart : s.afternoonStart).split(':').map(Number);
    const idx = morning ? i : i - s.morningCount;
    const total = h * 60 + m + idx * s.minutes;
    times.push(`${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`);
  }
  return times;
}
const isMorning = (period: number, s: Setting) => period < s.morningCount;

const root = $('#tool-root');
root.innerHTML = `
  <div class="panel code-toolbar no-print">
    <label class="field field--inline" style="flex:1"><span class="field-label">Tiêu đề</span><input type="text" id="title" maxlength="80" /></label>
    <div class="actions">
      <button type="button" class="btn" id="toggle-setup">Thiết lập</button>
      <button type="button" class="btn" id="print">In / Lưu PDF</button>
    </div>
  </div>

  <form class="panel tt-setup no-print" id="setup" hidden>
    <div class="panel-title">Thiết lập tiết học</div>
    <div class="field-row">
      <label class="field"><span class="field-label">Tổng số tiết/ngày</span><input type="number" id="s-count" min="1" max="16" /></label>
      <label class="field"><span class="field-label">Số tiết buổi sáng</span><input type="number" id="s-morning" min="0" max="16" /></label>
      <label class="field"><span class="field-label">Phút mỗi tiết</span><input type="number" id="s-minutes" min="20" max="120" step="5" /></label>
    </div>
    <div class="field-row">
      <label class="field"><span class="field-label">Giờ bắt đầu buổi sáng</span><input type="time" id="s-mstart" /></label>
      <label class="field"><span class="field-label">Giờ bắt đầu buổi chiều</span><input type="time" id="s-astart" /></label>
    </div>
    <div class="actions"><button type="button" class="btn btn-primary" id="apply-setup">Lưu cấu hình</button></div>
    <p class="note">Giờ mỗi tiết được tính tự động từ giờ bắt đầu và số phút mỗi tiết. Đăng nhập Google để lưu cấu hình và thời khoá biểu theo tài khoản, dùng được trên mọi thiết bị.</p>
  </form>

  <div class="table-wrap timetable-wrap" style="margin-top:16px"><table class="timetable" id="grid"></table></div>
  <p class="note no-print">Bấm vào ô để nhập môn học và phòng. Tiết buổi sáng tô xanh dương, buổi chiều tô cam. Bấm vào tên ngày để sửa.</p>

  <dialog id="edit" class="cell-dialog">
    <form method="dialog" class="panel">
      <div class="panel-title" id="dlg-title">Nội dung tiết học</div>
      <label class="field"><span class="field-label">Môn học</span><input type="text" id="d-subject" maxlength="40" /></label>
      <label class="field"><span class="field-label">Phòng / ghi chú</span><input type="text" id="d-room" maxlength="30" /></label>
      <div class="actions"><button class="btn btn-primary" id="d-save" value="save">Lưu</button><button class="btn" value="cancel">Huỷ</button><button type="button" class="btn" id="d-clear">Xoá ô</button></div>
    </form>
  </dialog>
`;
store.mount(root);

let editing = '';

function render(): void {
  const s = settings();
  const dayList = days(s);
  const times = periodTimes(s);
  $<HTMLInputElement>('#title').value = s.title;
  const cellMap = new Map(store.get().cells.map((c) => [c.id, c]));

  const head = `<thead><tr><th class="tt-corner">Tiết</th>${dayList.map((d, i) => `<th contenteditable="true" data-day="${i}">${escapeHtml(d)}</th>`).join('')}</tr></thead>`;
  const body = times.map((time, pi) => {
    const col = isMorning(pi, s) ? MORNING : AFTERNOON;
    const cells = dayList.map((_, di) => {
      const key = `${di}-${pi}`;
      const c = cellMap.get(key);
      if (!c || !c.subject) return `<td class="tt-cell" data-key="${key}"></td>`;
      return `<td class="tt-cell tt-filled" data-key="${key}" style="background:${col.bg};border-left:3px solid ${col.border}">
        <b>${escapeHtml(c.subject)}</b>${c.room ? `<span>${escapeHtml(c.room)}</span>` : ''}</td>`;
    }).join('');
    return `<tr><th class="tt-period" style="border-left:3px solid ${col.border}">Tiết ${pi + 1}<br>${time}</th>${cells}</tr>`;
  }).join('');
  $('#grid').innerHTML = head + `<tbody>${body}</tbody>`;
}

/* chọn ô để sửa nội dung */
$('#grid').addEventListener('click', (e) => {
  const td = (e.target as HTMLElement).closest<HTMLElement>('.tt-cell');
  if (!td) return;
  editing = td.dataset.key!;
  const c = store.get().cells.find((x) => x.id === editing);
  $<HTMLInputElement>('#d-subject').value = c?.subject ?? '';
  $<HTMLInputElement>('#d-room').value = c?.room ?? '';
  ($('#edit') as HTMLDialogElement).showModal();
  $<HTMLInputElement>('#d-subject').focus();
});
$('#d-save').addEventListener('click', () => {
  const subject = $<HTMLInputElement>('#d-subject').value.trim();
  const room = $<HTMLInputElement>('#d-room').value.trim();
  const [day, period] = editing.split('-').map(Number);
  const d = store.get();
  const cells = d.cells.filter((c) => c.id !== editing);
  if (subject) cells.push({ id: editing, day, period, subject, room });
  store.set({ ...d, cells });
  render();
});
$('#d-clear').addEventListener('click', () => {
  const d = store.get();
  store.set({ ...d, cells: d.cells.filter((c) => c.id !== editing) });
  render();
  ($('#edit') as HTMLDialogElement).close();
});

/* sửa tên ngày */
$('#grid').addEventListener('blur', (e) => {
  const t = e.target as HTMLElement;
  if (t.dataset.day === undefined) return;
  const s = settings();
  const list = days(s);
  list[Number(t.dataset.day)] = t.textContent?.trim() || list[Number(t.dataset.day)];
  saveSettings({ days: JSON.stringify(list) });
}, true);

$('#title').addEventListener('input', () => { saveSettings({ title: $<HTMLInputElement>('#title').value }); document.title = $<HTMLInputElement>('#title').value + ' — WFTools'; });

/* thiết lập */
function fillSetup(): void {
  const s = settings();
  $<HTMLInputElement>('#s-count').value = String(s.periodCount);
  $<HTMLInputElement>('#s-morning').value = String(s.morningCount);
  $<HTMLInputElement>('#s-minutes').value = String(s.minutes);
  $<HTMLInputElement>('#s-mstart').value = s.morningStart;
  $<HTMLInputElement>('#s-astart').value = s.afternoonStart;
}
$('#toggle-setup').addEventListener('click', () => { const f = $('#setup'); f.hidden = !f.hidden; if (!f.hidden) fillSetup(); });
$('#apply-setup').addEventListener('click', () => {
  const periodCount = Math.max(1, Math.min(16, Number($<HTMLInputElement>('#s-count').value) || 10));
  const morningCount = Math.max(0, Math.min(periodCount, Number($<HTMLInputElement>('#s-morning').value) || 0));
  const minutes = Math.max(20, Math.min(120, Number($<HTMLInputElement>('#s-minutes').value) || 45));
  const morningStart = $<HTMLInputElement>('#s-mstart').value || '07:00';
  const afternoonStart = $<HTMLInputElement>('#s-astart').value || '13:30';
  // Cắt bỏ các ô vượt quá số tiết mới để không để lại dữ liệu thừa
  const d = store.get();
  const cells = d.cells.filter((c) => c.period < periodCount);
  store.set({ ...d, cells });
  saveSettings({ periodCount, morningCount, minutes, morningStart, afternoonStart });
  render();
  toast('Đã lưu cấu hình tiết học');
});

$('#print').addEventListener('click', () => { document.title = settings().title; window.print(); });

store.onChange(render);
render();
