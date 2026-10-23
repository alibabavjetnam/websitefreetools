import { mountLayout } from '../layout';
import { $, escapeHtml, toast } from '../ui';
import { SheetStore } from '../google/sync';
import { pageText, currentLang } from '../i18n';

mountLayout({ activeTool: 'study-timetable' });
const T = pageText();
const LOCALE = ({ en: 'en-US', vi: 'vi-VN', ja: 'ja-JP', zh: 'zh-CN', es: 'es-ES', de: 'de-DE', ru: 'ru-RU' } as Record<string, string>)[currentLang()] || 'en-US';

interface Setting { id: string; title: string; days: string; morningCount: number; times: string }
interface Cell { id: string; day: number; period: number; subject: string; room: string }
type Data = { settings: Setting[]; cells: Cell[] };

const DEFAULT_DAYS = [1, 2, 3, 4, 5, 6, 0].map((d) => new Intl.DateTimeFormat(LOCALE, { weekday: 'long' }).format(new Date(2024, 0, 1 + ((d + 6) % 7))));
const DEFAULT_TIMES = ['07:00', '07:45', '08:30', '09:15', '10:00', '13:30', '14:15', '15:00', '15:45', '16:30'];
const DEFAULT: Setting = { id: 'main', title: T('defaultTitle', 'Thời khoá biểu'), days: JSON.stringify(DEFAULT_DAYS), morningCount: 5, times: JSON.stringify(DEFAULT_TIMES) };

const store = new SheetStore<Data>({
  tag: 'timetable',
  title: T('sheetTitle', 'WFTools - Thời khoá biểu'),
  empty: { settings: [], cells: [] },
  tables: {
    settings: { sheet: 'Cấu hình', columns: [
      { key: 'id', label: 'Mã' }, { key: 'title', label: 'Tiêu đề' }, { key: 'days', label: 'Các ngày' },
      { key: 'morningCount', label: 'Số tiết sáng', type: 'number' }, { key: 'times', label: 'Giờ các tiết' },
    ] },
    cells: { sheet: 'Nội dung', columns: [
      { key: 'id', label: 'Mã' }, { key: 'day', label: 'Ngày', type: 'number' }, { key: 'period', label: 'Tiết', type: 'number' },
      { key: 'subject', label: 'Môn học' }, { key: 'room', label: 'Phòng' },
    ] },
  },
});

// Tiết buổi sáng tô xanh dương, buổi chiều tô cam (ranh giới theo "số tiết buổi sáng")
const MORNING = { bg: '#e7f0ff', border: '#0d6efd' };
const AFTERNOON = { bg: '#fff4e0', border: '#d97706' };
const pad = (n: number) => String(n).padStart(2, '0');

const parseJson = <T>(s: string, fb: T): T => { try { const v = JSON.parse(s); return v ?? fb; } catch { return fb; } };

/** Đọc cấu hình, tự chuyển dữ liệu kiểu cũ (có periodCount/minutes/morningStart) sang danh sách giờ từng tiết. */
function settings(): Setting {
  const raw = store.get().settings.find((s) => s.id === 'main') as (Setting & { periodCount?: number; minutes?: number; morningStart?: string; afternoonStart?: string }) | undefined;
  if (!raw) return { ...DEFAULT };
  let times = parseJson<string[]>(raw.times ?? '', []);
  if (!Array.isArray(times) || !times.length) {
    // Chuyển từ cấu hình cũ (sinh giờ theo công thức) nếu có
    if (raw.periodCount) {
      times = [];
      const mc = Number(raw.morningCount ?? 5);
      const min = Number(raw.minutes ?? 45);
      for (let i = 0; i < Number(raw.periodCount); i++) {
        const morning = i < mc;
        const [h, m] = ((morning ? raw.morningStart : raw.afternoonStart) ?? (morning ? '07:00' : '13:30')).split(':').map(Number);
        const idx = morning ? i : i - mc;
        const total = h * 60 + m + idx * min;
        times.push(`${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`);
      }
    }
    if (!times.length) times = [...DEFAULT_TIMES];
  }
  return { id: 'main', title: raw.title || DEFAULT.title, days: raw.days || DEFAULT.days, morningCount: Number(raw.morningCount ?? 5), times: JSON.stringify(times) };
}
function saveSettings(patch: Partial<Setting>): void {
  const next: Setting = { ...settings(), ...patch, id: 'main' };
  store.set({ ...store.get(), settings: [next] });
}
const getDays = (s: Setting): string[] => { const a = parseJson<string[]>(s.days, DEFAULT_DAYS); return a.length ? a : DEFAULT_DAYS; };
const getTimes = (s: Setting): string[] => parseJson<string[]>(s.times, DEFAULT_TIMES);

const root = $('#tool-root');
root.innerHTML = `
  <div class="panel code-toolbar no-print">
    <label class="field field--inline" style="flex:1"><span class="field-label">${T('title','Tiêu đề')}</span><input type="text" id="title" maxlength="80" /></label>
    <div class="actions">
      <button type="button" class="btn" id="toggle-setup">${T('setup','Thiết lập')}</button>
      <button type="button" class="btn" id="print">${T('print','In / Lưu PDF')}</button>
    </div>
  </div>

  <form class="panel tt-setup no-print" id="setup" hidden>
    <div class="panel-title">${T('setupTitle','Thiết lập tiết học')}</div>
    <label class="field field--inline"><span class="field-label">${T('morningCount','Số tiết tô màu buổi sáng (xanh)')}</span><input type="number" id="s-morning" min="0" max="16" style="max-width:90px" /></label>
    <p class="note" style="margin:10px 0 4px">${T('setTimesHint','Đặt giờ bắt đầu cho từng tiết (không cần theo quy luật, có thể có hoặc không có giờ nghỉ giữa các tiết):')}</p>
    <div class="tt-period-list" id="period-list"></div>
    <div class="actions" style="margin-top:4px">
      <button type="button" class="btn btn-sm" id="add-period">${T('addPeriod','+ Thêm tiết')}</button>
      <button type="button" class="btn btn-sm" id="del-period">${T('delPeriod','− Bớt tiết')}</button>
    </div>
    <div class="tt-autofill">
      <span class="field-label">${T('autofillLabel','Tiện ích: tự điền đều từ tiết đầu, mỗi tiết')} </span>
      <input type="number" id="auto-min" min="20" max="120" step="5" value="45" style="max-width:70px" /> ${T('minutes','phút')}
      <button type="button" class="btn btn-sm" id="autofill">${T('autofill','Điền đều')}</button>
    </div>
    <div class="actions" style="margin-top:12px"><button type="button" class="btn btn-primary" id="apply-setup">${T('saveConfig','Lưu cấu hình')}</button></div>
    <p class="note">${T('syncNote','Đăng nhập Google để lưu cấu hình và thời khoá biểu theo tài khoản, dùng được trên mọi thiết bị.')}</p>
  </form>

  <div class="table-wrap timetable-wrap" style="margin-top:16px"><table class="timetable" id="grid"></table></div>
  <p class="note no-print">${T('gridHint','Bấm vào ô để nhập môn học và phòng. Bấm vào tên ngày để sửa.')}</p>

  <dialog id="edit" class="cell-dialog">
    <form method="dialog" class="panel">
      <div class="panel-title">${T('cellTitle','Nội dung tiết học')}</div>
      <label class="field"><span class="field-label">${T('subject','Môn học')}</span><input type="text" id="d-subject" maxlength="40" /></label>
      <label class="field"><span class="field-label">${T('room','Phòng / ghi chú')}</span><input type="text" id="d-room" maxlength="30" /></label>
      <div class="actions"><button class="btn btn-primary" id="d-save" value="save">${T('save','Lưu')}</button><button class="btn" value="cancel">${T('cancel','Huỷ')}</button><button type="button" class="btn" id="d-clear">${T('clearCell','Xoá ô')}</button></div>
    </form>
  </dialog>
`;
store.mount(root);

let editing = '';
// Giờ đang chỉnh trong phần thiết lập (chưa lưu cho tới khi bấm "Lưu cấu hình")
let draftTimes: string[] = [];

function render(): void {
  const s = settings();
  const dayList = getDays(s);
  const times = getTimes(s);
  $<HTMLInputElement>('#title').value = s.title;
  const cellMap = new Map(store.get().cells.map((c) => [c.id, c]));

  const head = `<thead><tr><th class="tt-corner">${T('periodWord','Tiết')}</th>${dayList.map((d, i) => `<th contenteditable="true" data-day="${i}">${escapeHtml(d)}</th>`).join('')}</tr></thead>`;
  const body = times.map((time, pi) => {
    const col = pi < s.morningCount ? MORNING : AFTERNOON;
    const cells = dayList.map((_, di) => {
      const key = `${di}-${pi}`;
      const c = cellMap.get(key);
      if (!c || !c.subject) return `<td class="tt-cell" data-key="${key}"></td>`;
      return `<td class="tt-cell tt-filled" data-key="${key}" style="background:${col.bg};border-left:3px solid ${col.border}">
        <b>${escapeHtml(c.subject)}</b>${c.room ? `<span>${escapeHtml(c.room)}</span>` : ''}</td>`;
    }).join('');
    return `<tr><th class="tt-period" style="border-left:3px solid ${col.border}">${T('periodWord','Tiết')} ${pi + 1}<br>${escapeHtml(time)}</th>${cells}</tr>`;
  }).join('');
  $('#grid').innerHTML = head + `<tbody>${body}</tbody>`;
}

/* ----- chọn ô ----- */
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

/* ----- sửa tên ngày ----- */
$('#grid').addEventListener('blur', (e) => {
  const t = e.target as HTMLElement;
  if (t.dataset.day === undefined) return;
  const list = getDays(settings());
  list[Number(t.dataset.day)] = t.textContent?.trim() || list[Number(t.dataset.day)];
  saveSettings({ days: JSON.stringify(list) });
}, true);

$('#title').addEventListener('input', () => { saveSettings({ title: $<HTMLInputElement>('#title').value }); document.title = $<HTMLInputElement>('#title').value + ' — WFTools'; });

/* ----- thiết lập giờ từng tiết ----- */
function renderPeriodList(): void {
  $('#period-list').innerHTML = draftTimes.map((t, i) => `
    <div class="tt-period-row">
      <span class="tt-period-name">${T('periodWord','Tiết')} ${i + 1}</span>
      <input type="time" data-time="${i}" value="${escapeHtml(t)}" />
    </div>`).join('');
}
function openSetup(): void {
  const s = settings();
  draftTimes = [...getTimes(s)];
  $<HTMLInputElement>('#s-morning').value = String(s.morningCount);
  renderPeriodList();
}
$('#toggle-setup').addEventListener('click', () => { const f = $('#setup'); f.hidden = !f.hidden; if (!f.hidden) openSetup(); });
$('#period-list').addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.dataset.time !== undefined) draftTimes[Number(t.dataset.time)] = t.value;
});
$('#add-period').addEventListener('click', () => {
  // gợi ý giờ tiết mới = tiết cuối + 45 phút
  const last = draftTimes[draftTimes.length - 1] ?? '07:00';
  const [h, m] = last.split(':').map(Number);
  const total = h * 60 + m + 45;
  draftTimes.push(`${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`);
  renderPeriodList();
});
$('#del-period').addEventListener('click', () => { if (draftTimes.length > 1) { draftTimes.pop(); renderPeriodList(); } });
$('#autofill').addEventListener('click', () => {
  const min = Math.max(5, Number($<HTMLInputElement>('#auto-min').value) || 45);
  const [h, m] = (draftTimes[0] || '07:00').split(':').map(Number);
  let total = h * 60 + m;
  draftTimes = draftTimes.map(() => { const v = `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`; total += min; return v; });
  renderPeriodList();
});
$('#apply-setup').addEventListener('click', () => {
  const times = draftTimes.map((t) => t || '07:00');
  const morningCount = Math.max(0, Math.min(times.length, Number($<HTMLInputElement>('#s-morning').value) || 0));
  // bỏ các ô vượt quá số tiết mới
  const d = store.get();
  const cells = d.cells.filter((c) => c.period < times.length);
  store.set({ ...d, cells });
  saveSettings({ times: JSON.stringify(times), morningCount });
  render();
  toast(T('toast.saved','Đã lưu cấu hình tiết học'));
});

$('#print').addEventListener('click', () => { document.title = settings().title; window.print(); });

store.onChange(render);
render();
