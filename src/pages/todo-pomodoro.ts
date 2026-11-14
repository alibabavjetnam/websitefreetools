import { mountLayout } from '../layout';
import { $, escapeHtml, setupTabs, storage } from '../ui';
import { pageText } from '../i18n';
import { DEFAULT_POMO, clampCfg, dayKey, filterTasks, isOverdue, makeTask, mmss, nextPhase, phaseSeconds, type Filter, type Phase, type Priority, type Task } from '../calc/todo';
import { sfx } from '../lib/sfx';

mountLayout({ activeTool: 'todo-pomodoro' });
const T = pageText();
const root = $('#tool-root');

interface Saved { tasks: Task[]; cfg: typeof DEFAULT_POMO; active: string; filter: Filter; log: Record<string, number>; auto: boolean }
const st = storage<Saved>('todo-pomodoro', { tasks: [], cfg: DEFAULT_POMO, active: '', filter: 'all', log: {}, auto: false });
const S = st.get();
S.cfg = clampCfg({ ...DEFAULT_POMO, ...S.cfg });
S.tasks ??= [];
S.log ??= {};
const save = () => st.set(S);

root.innerHTML = `
  <div class="tabs" role="tablist" aria-label="${T('aria.tabs', 'Chọn công cụ')}">
    <button type="button" role="tab" data-tab="tasks">${T('tab.tasks', 'Việc cần làm')}</button>
    <button type="button" role="tab" data-tab="pomo">${T('tab.pomo', 'Pomodoro')}</button>
  </div>

  <div data-panel="tasks">
    <div class="tool-body td-wrap">
      <form class="panel td-add" id="td-form">
        <input id="td-text" type="text" maxlength="200" placeholder="${T('td.ph', 'Việc cần làm…')}" aria-label="${T('td.ph', 'Việc cần làm…')}" autocomplete="off" />
        <select id="td-prio" aria-label="${T('td.prio', 'Ưu tiên')}">
          <option value="0">${T('td.p0', 'Bình thường')}</option>
          <option value="1">${T('td.p1', 'Quan trọng')}</option>
          <option value="2">${T('td.p2', 'Gấp')}</option>
        </select>
        <input id="td-due" type="date" aria-label="${T('td.due', 'Hạn chót')}" />
        <button type="submit" class="btn btn-primary">${T('td.add', 'Thêm')}</button>
      </form>
      <div class="td-filters" id="td-filters">
        <button type="button" class="btn btn-sm" data-f="all">${T('td.fAll', 'Tất cả')}</button>
        <button type="button" class="btn btn-sm" data-f="active">${T('td.fActive', 'Chưa xong')}</button>
        <button type="button" class="btn btn-sm" data-f="today">${T('td.fToday', 'Đến hạn hôm nay')}</button>
        <button type="button" class="btn btn-sm" data-f="done">${T('td.fDone', 'Đã xong')}</button>
        <span class="note" id="td-count"></span>
        <button type="button" class="btn btn-sm" id="td-clear">${T('td.clear', 'Xoá việc đã xong')}</button>
      </div>
      <ul class="td-list" id="td-list"></ul>
    </div>
  </div>

  <div data-panel="pomo">
    <div class="workspace tool-body">
      <div class="panel pomo-box">
        <div class="pomo-phases" id="pm-phases">
          <button type="button" class="btn btn-sm" data-ph="work">${T('pm.work', 'Tập trung')}</button>
          <button type="button" class="btn btn-sm" data-ph="short">${T('pm.short', 'Nghỉ ngắn')}</button>
          <button type="button" class="btn btn-sm" data-ph="long">${T('pm.long', 'Nghỉ dài')}</button>
        </div>
        <div class="pomo-time" id="pm-time" role="timer" aria-live="off">25:00</div>
        <div class="progress"><i id="pm-bar"></i></div>
        <p class="note" id="pm-task"></p>
        <div class="actions">
          <button type="button" class="btn btn-primary" id="pm-start">${T('pm.start', 'Bắt đầu')}</button>
          <button type="button" class="btn" id="pm-reset">${T('pm.reset', 'Đặt lại')}</button>
          <button type="button" class="btn" id="pm-skip">${T('pm.skip', 'Bỏ qua')}</button>
        </div>
        <p class="note" id="pm-today"></p>
      </div>
      <div class="panel">
        <h3>${T('pm.settings', 'Cài đặt (phút)')}</h3>
        <div class="form-grid">
          <label class="field"><span class="field-label">${T('pm.cWork', 'Tập trung')}</span><input id="c-work" type="number" min="1" max="180" /></label>
          <label class="field"><span class="field-label">${T('pm.cShort', 'Nghỉ ngắn')}</span><input id="c-short" type="number" min="1" max="60" /></label>
          <label class="field"><span class="field-label">${T('pm.cLong', 'Nghỉ dài')}</span><input id="c-long" type="number" min="1" max="120" /></label>
          <label class="field"><span class="field-label">${T('pm.cEvery', 'Số đợt trước khi nghỉ dài')}</span><input id="c-every" type="number" min="2" max="12" /></label>
        </div>
        <label class="check"><input type="checkbox" id="c-auto" /><span>${T('pm.auto', 'Tự chạy giai đoạn kế tiếp')}</span></label>
        <label class="field"><span class="field-label">${T('pm.active', 'Việc đang làm')}</span><select id="pm-active"></select></label>
      </div>
    </div>
  </div>
`;

// ---------- Việc cần làm
const list = $('#td-list');
function renderTasks(): void {
  const today = dayKey();
  const rows = filterTasks(S.tasks, S.filter, today);
  document.querySelectorAll<HTMLElement>('#td-filters [data-f]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === S.filter)));
  const open = S.tasks.filter((t) => !t.done).length;
  $('#td-count').textContent = `${open} / ${S.tasks.length}`;
  list.innerHTML = rows.length
    ? rows.map((t) => `<li class="td-item${t.done ? ' is-done' : ''} p${t.priority}" data-id="${t.id}">
        <label class="td-check"><input type="checkbox" ${t.done ? 'checked' : ''} aria-label="${T('td.toggle', 'Đánh dấu xong')}" /></label>
        <span class="td-text">${escapeHtml(t.text)}</span>
        ${t.priority ? `<span class="td-tag p${t.priority}">${t.priority === 2 ? T('td.p2', 'Gấp') : T('td.p1', 'Quan trọng')}</span>` : ''}
        ${t.due ? `<span class="td-due${isOverdue(t, today) ? ' is-late' : ''}">${escapeHtml(t.due)}</span>` : ''}
        ${t.pomos ? `<span class="td-pomo" title="Pomodoro">🍅 ${t.pomos}</span>` : ''}
        <button type="button" class="btn btn-sm" data-act="focus">${S.active === t.id ? T('td.focusing', 'Đang làm') : T('td.focus', 'Làm việc này')}</button>
        <button type="button" class="btn btn-sm" data-act="del" aria-label="${T('td.del', 'Xoá')}">✕</button>
      </li>`).join('')
    : `<li class="note td-empty">${T('td.empty', 'Chưa có việc nào ở mục này.')}</li>`;
  renderActiveSelect();
  renderPomoTask();
}
$('#td-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const inp = $<HTMLInputElement>('#td-text');
  if (!inp.value.trim()) return;
  S.tasks.push(makeTask(inp.value, Number($<HTMLSelectElement>('#td-prio').value) as Priority, $<HTMLInputElement>('#td-due').value));
  inp.value = '';
  $<HTMLSelectElement>('#td-prio').value = '0';
  $<HTMLInputElement>('#td-due').value = '';
  save();
  renderTasks();
  inp.focus();
});
list.addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  const li = el.closest<HTMLElement>('[data-id]');
  if (!li) return;
  const t = S.tasks.find((x) => x.id === li.dataset.id);
  if (!t) return;
  const act = el.closest<HTMLElement>('[data-act]')?.dataset.act;
  if (act === 'del') S.tasks = S.tasks.filter((x) => x !== t);
  else if (act === 'focus') { S.active = S.active === t.id ? '' : t.id; }
  else if (el instanceof HTMLInputElement) t.done = el.checked;
  else return;
  save();
  renderTasks();
});
$('#td-filters').addEventListener('click', (e) => {
  const f = (e.target as HTMLElement).closest<HTMLElement>('[data-f]')?.dataset.f as Filter | undefined;
  if (f) { S.filter = f; save(); renderTasks(); }
});
$('#td-clear').addEventListener('click', () => { S.tasks = S.tasks.filter((t) => !t.done); save(); renderTasks(); });

// ---------- Pomodoro
let phase: Phase = 'work';
let running = false;
let endAt = 0;
let remaining = phaseSeconds('work', S.cfg);
let tick = 0;
const baseTitle = document.title;
const todayCount = () => S.log[dayKey()] || 0;

function renderActiveSelect(): void {
  const sel = $<HTMLSelectElement>('#pm-active');
  const open = S.tasks.filter((t) => !t.done);
  sel.innerHTML = `<option value="">${T('pm.noTask', '(Không chọn việc)')}</option>` + open.map((t) => `<option value="${t.id}">${escapeHtml(t.text)}</option>`).join('');
  sel.value = open.some((t) => t.id === S.active) ? S.active : '';
}
function renderPomoTask(): void {
  const t = S.tasks.find((x) => x.id === S.active && !x.done);
  $('#pm-task').textContent = t ? `${T('pm.doing', 'Đang làm')}: ${t.text}` : '';
  $('#pm-today').textContent = `${T('pm.today', 'Đợt tập trung hôm nay')}: ${todayCount()}`;
}
function renderTimer(): void {
  const total = phaseSeconds(phase, S.cfg);
  $('#pm-time').textContent = mmss(remaining);
  ($('#pm-bar') as HTMLElement).style.width = `${Math.min(100, ((total - remaining) / total) * 100)}%`;
  document.querySelectorAll<HTMLElement>('#pm-phases [data-ph]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ph === phase)));
  $('#pm-start').textContent = running ? T('pm.pause', 'Tạm dừng') : T('pm.start', 'Bắt đầu');
  document.title = running ? `${mmss(remaining)} · ${baseTitle}` : baseTitle;
}
function setPhase(p: Phase, autostart = false): void {
  phase = p;
  remaining = phaseSeconds(p, S.cfg);
  running = false;
  clearInterval(tick);
  renderTimer();
  if (autostart) start();
}
function start(): void {
  running = true;
  endAt = Date.now() + remaining * 1000;
  clearInterval(tick);
  tick = window.setInterval(onTick, 250);
  renderTimer();
}
function pause(): void {
  running = false;
  clearInterval(tick);
  remaining = Math.max(0, (endAt - Date.now()) / 1000);
  renderTimer();
}
function finish(): void {
  clearInterval(tick);
  running = false;
  sfx('win');
  if (phase === 'work') {
    S.log[dayKey()] = todayCount() + 1;
    const t = S.tasks.find((x) => x.id === S.active);
    if (t) t.pomos += 1;
    save();
    renderTasks();
  }
  const done = todayCount();
  setPhase(nextPhase(phase, done, S.cfg), S.auto);
  renderPomoTask();
}
function onTick(): void {
  remaining = Math.max(0, (endAt - Date.now()) / 1000);
  renderTimer();
  if (remaining <= 0) finish();
}
$('#pm-start').addEventListener('click', () => (running ? pause() : start()));
$('#pm-reset').addEventListener('click', () => setPhase(phase));
$('#pm-skip').addEventListener('click', () => setPhase(nextPhase(phase, todayCount(), S.cfg)));
$('#pm-phases').addEventListener('click', (e) => {
  const p = (e.target as HTMLElement).closest<HTMLElement>('[data-ph]')?.dataset.ph as Phase | undefined;
  if (p) setPhase(p);
});
$('#pm-active').addEventListener('change', () => { S.active = $<HTMLSelectElement>('#pm-active').value; save(); renderTasks(); });
const cfgIds: [string, keyof typeof DEFAULT_POMO][] = [['c-work', 'work'], ['c-short', 'short'], ['c-long', 'long'], ['c-every', 'every']];
cfgIds.forEach(([id, k]) => {
  const el = $<HTMLInputElement>('#' + id);
  el.value = String(S.cfg[k]);
  el.addEventListener('change', () => {
    S.cfg = clampCfg({ ...S.cfg, [k]: Number(el.value) });
    el.value = String(S.cfg[k]);
    save();
    if (!running) setPhase(phase);
  });
});
$<HTMLInputElement>('#c-auto').checked = S.auto;
$('#c-auto').addEventListener('change', () => { S.auto = $<HTMLInputElement>('#c-auto').checked; save(); });
document.addEventListener('visibilitychange', () => { if (running) onTick(); });

setupTabs(root);
renderTasks();
renderTimer();
