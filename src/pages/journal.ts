import { mountLayout } from '../layout';
import { $, escapeHtml, toast } from '../ui';
import { SheetStore, newId } from '../google/sync';

mountLayout({ activeTool: 'journal' });

interface Entry { id: string; date: string; mood: string; title: string; content: string }
type Data = { entries: Entry[] };

const store = new SheetStore<Data>({
  tag: 'journal',
  title: 'WFTools - Nhật ký',
  empty: { entries: [] },
  tables: {
    entries: { sheet: 'Nhật ký', columns: [
      { key: 'id', label: 'Mã' }, { key: 'date', label: 'Ngày' }, { key: 'mood', label: 'Tâm trạng' },
      { key: 'title', label: 'Tiêu đề' }, { key: 'content', label: 'Nội dung' },
    ] },
  },
});

const MOODS = ['😊', '😐', '😔', '😡', '😴', '🥳', '❤️'];
const todayKey = () => new Date().toLocaleDateString('en-CA');
const fmt = (k: string) => { const [y, m, d] = k.split('-'); return `${d}/${m}/${y}`; };
let editingId = '';

const root = $('#tool-root');
root.innerHTML = `
  <div class="workspace journal-main">
    <div class="panel">
      <div class="panel-title" id="editor-title">Viết hôm nay</div>
      <div class="field-row">
        <label class="field"><span class="field-label">Ngày</span><input type="date" id="date" value="${todayKey()}" /></label>
        <label class="field" style="flex:2"><span class="field-label">Tiêu đề</span><input type="text" id="title" maxlength="120" placeholder="Một ngày của tôi…" /></label>
      </div>
      <fieldset class="field"><legend>Tâm trạng</legend><div class="mood-pick" id="moods">${MOODS.map((m, i) => `<button type="button" class="mood${i === 0 ? ' is-sel' : ''}" data-mood="${m}">${m}</button>`).join('')}</div></fieldset>
      <label class="field"><span class="field-label">Nội dung</span><textarea id="content" rows="10" placeholder="Hôm nay bạn thế nào?"></textarea></label>
      <div class="actions"><button type="button" class="btn btn-primary" id="save">Lưu nhật ký</button><button type="button" class="btn" id="cancel" hidden>Huỷ</button></div>
    </div>
    <section class="preview"><div class="panel"><div class="panel-title">Nhật ký đã viết (<span id="count">0</span>)</div><div id="list"></div></div></section>
  </div>
  <p class="note">Nhật ký lưu trên trình duyệt của bạn. Đăng nhập Google để lưu vào Google Sheet trong Drive riêng của bạn — chỉ mình bạn đọc được, công cụ không gửi nội dung đi đâu khác.</p>
`;
store.mount(root);

let mood = MOODS[0];
$('#moods').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-mood]');
  if (!b) return;
  mood = b.dataset.mood!;
  root.querySelectorAll('#moods .mood').forEach((x) => x.classList.toggle('is-sel', x === b));
});

function resetEditor(): void {
  editingId = '';
  $('#editor-title').textContent = 'Viết hôm nay';
  $('#cancel').hidden = true;
  $<HTMLInputElement>('#date').value = todayKey();
  $<HTMLInputElement>('#title').value = '';
  $<HTMLTextAreaElement>('#content').value = '';
  mood = MOODS[0];
  root.querySelectorAll('#moods .mood').forEach((x, i) => x.classList.toggle('is-sel', i === 0));
}

function render(): void {
  const entries = [...store.get().entries].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  $('#count').textContent = String(entries.length);
  $('#list').innerHTML = entries.length
    ? entries.map((e) => `<div class="journal-item"><div class="ji-head"><span class="ji-mood">${e.mood || '📝'}</span><div><b>${escapeHtml(e.title || '(không tiêu đề)')}</b><span class="note">${fmt(e.date)}</span></div></div>
        <p class="ji-content">${escapeHtml(e.content.length > 160 ? e.content.slice(0, 160) + '…' : e.content)}</p>
        <div class="ji-actions"><button type="button" class="btn btn-sm" data-edit="${e.id}">Mở / sửa</button><button type="button" class="btn btn-sm" data-del="${e.id}">Xoá</button></div></div>`).join('')
    : '<p class="note">Chưa có nhật ký nào.</p>';
}

$('#save').addEventListener('click', () => {
  const content = $<HTMLTextAreaElement>('#content').value.trim();
  const title = $<HTMLInputElement>('#title').value.trim();
  if (!content && !title) { toast('Hãy viết gì đó trước khi lưu'); return; }
  const date = $<HTMLInputElement>('#date').value || todayKey();
  const d = store.get();
  if (editingId) {
    store.set({ entries: d.entries.map((x) => (x.id === editingId ? { ...x, date, mood, title, content } : x)) });
  } else {
    store.set({ entries: [...d.entries, { id: newId(), date, mood, title, content }] });
  }
  resetEditor();
  render();
  toast('Đã lưu nhật ký');
});
$('#cancel').addEventListener('click', resetEditor);
$('#list').addEventListener('click', (e) => {
  const edit = (e.target as HTMLElement).closest<HTMLElement>('[data-edit]')?.dataset.edit;
  const del = (e.target as HTMLElement).closest<HTMLElement>('[data-del]')?.dataset.del;
  const d = store.get();
  if (edit) {
    const en = d.entries.find((x) => x.id === edit)!;
    editingId = edit;
    $('#editor-title').textContent = 'Sửa nhật ký';
    $('#cancel').hidden = false;
    $<HTMLInputElement>('#date').value = en.date;
    $<HTMLInputElement>('#title').value = en.title;
    $<HTMLTextAreaElement>('#content').value = en.content;
    mood = en.mood || MOODS[0];
    root.querySelectorAll('#moods .mood').forEach((x) => x.classList.toggle('is-sel', (x as HTMLElement).dataset.mood === mood));
    $('#date').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else if (del) {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-del]')!;
    if (btn.dataset.confirm !== '1') { btn.dataset.confirm = '1'; btn.textContent = 'Bấm lần nữa'; setTimeout(() => { btn.dataset.confirm = ''; btn.textContent = 'Xoá'; }, 3000); return; }
    store.set({ entries: d.entries.filter((x) => x.id !== del) });
    if (editingId === del) resetEditor();
    render();
  }
});

store.onChange(render);
render();
