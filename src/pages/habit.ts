import { mountLayout } from '../layout';
import { $, escapeHtml } from '../ui';
import { SheetStore, newId } from '../google/sync';
import { habitStats } from '../calc/habit';
import { pageText, currentLang } from '../i18n';

mountLayout({ activeTool: 'habit' });
const T = pageText();
const LOCALE = ({ en: 'en-US', vi: 'vi-VN', ja: 'ja-JP', zh: 'zh-CN', es: 'es-ES', de: 'de-DE' } as Record<string, string>)[currentLang()] || 'en-US';

interface Habit { id: string; name: string; created: string }
interface Log { id: string; habitId: string; date: string }
type Data = { habits: Habit[]; logs: Log[] };

const store = new SheetStore<Data>({
  tag: 'habit',
  title: 'WFTools - Thói quen',
  empty: { habits: [], logs: [] },
  tables: {
    habits: { sheet: 'Thói quen', columns: [{ key: 'id', label: 'Mã' }, { key: 'name', label: 'Tên thói quen' }, { key: 'created', label: 'Ngày bắt đầu' }] },
    logs: { sheet: 'Nhật ký', columns: [{ key: 'id', label: 'Mã' }, { key: 'habitId', label: 'Mã thói quen' }, { key: 'date', label: 'Ngày hoàn thành' }] },
  },
});

const DAYS_SHOWN = 14;
const dayKey = (d: Date) => d.toLocaleDateString('en-CA');
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const DOW = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(LOCALE, { weekday: 'short' }).format(new Date(2023, 0, 1 + i)));

const root = $('#tool-root');
root.innerHTML = `
  <div class="tool-body">
    <form class="panel habit-add" id="add-form" novalidate>
      <label class="field" style="flex:1">
        <span class="field-label">${T('newHabit','Thói quen mới')}</span>
        <input id="habit-name" type="text" maxlength="80" placeholder="${T('newHabitPh','Ví dụ: Đọc sách 20 phút, Chạy bộ, Học tiếng Anh')}" autocomplete="off" />
      </label>
      <button type="submit" class="btn btn-primary">${T('add','Thêm thói quen')}</button>
    </form>
    <div class="stat-grid" id="summary" style="margin-top:16px"></div>
    <div class="table-wrap habit-wrap" style="margin-top:16px"><table class="data-table habit-table" id="grid"></table></div>
    <p class="note" style="margin-top:10px">${T('note','Bấm vào ô để đánh dấu đã làm trong ngày. Chuỗi ngày (streak) tính đến hôm nay; nếu hôm nay chưa đánh dấu, chuỗi vẫn giữ đến hết ngày.')}</p>
  </div>
`;
store.mount(root);

function render(): void {
  const d = store.get();
  const todayDate = new Date();
  const today = dayKey(todayDate);
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(todayDate, i - DAYS_SHOWN + 1));
  const done = new Set(d.logs.map((l) => `${l.habitId}|${l.date}`));

  const doneToday = d.habits.filter((h) => done.has(`${h.id}|${today}`)).length;
  $('#summary').innerHTML = d.habits.length
    ? `<div class="stat stat--main"><span class="stat-label">${T('today','Hôm nay')}</span><span class="stat-value">${doneToday}/${d.habits.length} ${T('habits','thói quen')}</span></div>`
    : '';

  if (!d.habits.length) {
    $('#grid').innerHTML = `<tbody><tr><td class="note">${T('empty','Chưa có thói quen nào. Thêm thói quen đầu tiên ở ô phía trên.')}</td></tr></tbody>`;
    return;
  }
  const head = `<thead><tr><th>${T('th.habit','Thói quen')}</th>${days
    .map((x) => `<th class="${dayKey(x) === today ? 'is-today' : ''}">${DOW[x.getDay()]}<br />${x.getDate()}/${x.getMonth() + 1}</th>`)
    .join('')}<th>${T('th.current','Chuỗi hiện tại')}</th><th>${T('th.best','Dài nhất')}</th><th>${T('th.last30','30 ngày')}</th><th></th></tr></thead>`;
  const body = d.habits
    .map((h) => {
      const dates = d.logs.filter((l) => l.habitId === h.id).map((l) => l.date);
      const s = habitStats(dates, today);
      const cells = days
        .map((x) => {
          const k = dayKey(x);
          const on = done.has(`${h.id}|${k}`);
          return `<td class="${k === today ? 'is-today' : ''}"><button type="button" class="habit-cell${on ? ' is-on' : ''}" data-toggle="${escapeHtml(h.id)}|${k}"
            aria-pressed="${on}" aria-label="${escapeHtml(h.name)} ${x.getDate()}/${x.getMonth() + 1}">${on ? '✓' : ''}</button></td>`;
        })
        .join('');
      return `<tr><td><b>${escapeHtml(h.name)}</b></td>${cells}
        <td><b>${s.current}</b> ${T('days','ngày')}</td><td>${s.best} ${T('days','ngày')}</td><td>${s.last30}%</td>
        <td><button type="button" class="btn btn-sm" data-del="${escapeHtml(h.id)}">${T('del','Xoá')}</button></td></tr>`;
    })
    .join('');
  $('#grid').innerHTML = head + `<tbody>${body}</tbody>`;
}

$('#add-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $<HTMLInputElement>('#habit-name');
  const name = input.value.trim();
  if (!name) return input.focus();
  const d = store.get();
  store.set({ ...d, habits: [...d.habits, { id: newId(), name, created: dayKey(new Date()) }] });
  input.value = '';
  render();
});

$('#grid').addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const toggle = t.closest<HTMLElement>('[data-toggle]')?.dataset.toggle;
  const del = t.closest<HTMLElement>('[data-del]')?.dataset.del;
  const d = store.get();
  if (toggle) {
    const [habitId, date] = toggle.split('|');
    const exists = d.logs.some((l) => l.habitId === habitId && l.date === date);
    store.set({ ...d, logs: exists ? d.logs.filter((l) => !(l.habitId === habitId && l.date === date)) : [...d.logs, { id: newId(), habitId, date }] });
    render();
  } else if (del) {
    const h = d.habits.find((x) => x.id === del);
    if (!h) return;
    // Xoá cần bấm hai lần để tránh xoá nhầm cả lịch sử
    const btn = t.closest<HTMLButtonElement>('[data-del]') as HTMLButtonElement;
    if (btn.dataset.confirm !== '1') {
      btn.dataset.confirm = '1';
      btn.textContent = T('del.confirm','Bấm lần nữa để xoá');
      setTimeout(() => { btn.dataset.confirm = ''; btn.textContent = T('del','Xoá'); }, 3000);
      return;
    }
    store.set({ habits: d.habits.filter((x) => x.id !== del), logs: d.logs.filter((l) => l.habitId !== del) });
    render();
  }
});

store.onChange(render);
render();
