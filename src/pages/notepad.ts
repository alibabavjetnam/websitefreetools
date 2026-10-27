import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml, fmtInt, storage, toast } from '../ui';
import { pageText, localeTag } from '../i18n';
import { safeFilename } from '../lib/download';
import { bindDropzone } from '../lib/files';

mountLayout({ activeTool: 'notepad' });
const T = pageText();
const LOCALE = localeTag();

interface Note { id: string; title: string; body: string; updated: number; pinned?: boolean }
const st = storage<{ notes: Note[]; current: string; font: number; mono: boolean }>('notepad', { notes: [], current: '', font: 16, mono: false });
const s = st.get();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
if (!s.notes.length) {
  const n = { id: uid(), title: T('welcomeTitle', 'Ghi chú đầu tiên'), body: T('welcomeBody', 'Gõ ghi chú của bạn ở đây. Mọi thay đổi tự lưu trên trình duyệt này.\n\nMẹo: bấm "Ghi chú mới" để tạo thêm, dùng ô tìm kiếm để lọc, tải về file .txt khi cần mang sang máy khác.'), updated: Date.now() };
  s.notes.push(n);
  s.current = n.id;
}

$('#tool-root').innerHTML = `
  <div class="notes">
    <aside class="panel" style="padding:12px;gap:10px">
      <button type="button" class="btn btn-primary" id="new">${T('new', '+ Ghi chú mới')}</button>
      <input type="search" id="q" class="input-inline" placeholder="${T('search', 'Tìm trong ghi chú…')}" aria-label="${T('search', 'Tìm trong ghi chú…')}" />
      <ul class="note-list" id="list"></ul>
      <label class="dropzone" id="drop" style="padding:14px 8px"><input type="file" id="file" accept=".txt,.md,.csv,.json,.html,.log,text/*" /><span>${T('open', 'Mở file .txt hoặc kéo thả vào đây')}</span></label>
    </aside>
    <section class="panel note-editor">
      <input type="text" class="note-title" id="title" placeholder="${T('titlePh', 'Tiêu đề')}" maxlength="120" />
      <textarea id="body" spellcheck="true" placeholder="${T('bodyPh', 'Bắt đầu viết…')}"></textarea>
      <div class="row" style="justify-content:space-between">
        <span class="note" id="meta"></span>
        <div class="row">
          <button type="button" class="btn btn-sm" id="pin"></button>
          <button type="button" class="btn btn-sm" id="smaller" aria-label="${T('smaller', 'Chữ nhỏ hơn')}">A−</button>
          <button type="button" class="btn btn-sm" id="bigger" aria-label="${T('bigger', 'Chữ lớn hơn')}">A+</button>
          <button type="button" class="btn btn-sm" id="mono">${T('mono', 'Phông đều')}</button>
          <button type="button" class="btn btn-sm" id="dl">${T('download', 'Tải .txt')}</button>
          <button type="button" class="btn btn-sm" id="dl-all">${T('downloadAll', 'Tải tất cả')}</button>
          <button type="button" class="btn btn-sm" id="del" style="color:var(--danger)">${T('delete', 'Xoá')}</button>
        </div>
      </div>
      <p class="note">${T('privacy', 'Ghi chú chỉ lưu trong trình duyệt trên máy này (không đồng bộ sang máy khác). Xoá dữ liệu duyệt web sẽ mất ghi chú, nên tải về những ghi chú quan trọng.')}</p>
    </section>
  </div>
`;

const titleEl = $<HTMLInputElement>('#title');
const bodyEl = $<HTMLTextAreaElement>('#body');
const cur = () => s.notes.find((n) => n.id === s.current) ?? s.notes[0];
let saveTimer = 0;

function persist(): void {
  try {
    localStorage.setItem('wft:notepad', JSON.stringify(s));
  } catch {
    toast(T('full', 'Bộ nhớ trình duyệt đã đầy. Hãy tải về và xoá bớt ghi chú cũ.'));
  }
}
const preview = (n: Note) => (n.title.trim() || n.body.trim().split('\n')[0] || T('untitled', 'Không tiêu đề')).slice(0, 60);
const when = (t: number) => new Date(t).toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' });

function renderList(): void {
  const q = $<HTMLInputElement>('#q').value.trim().toLocaleLowerCase();
  const list = s.notes
    .filter((n) => !q || (n.title + '\n' + n.body).toLocaleLowerCase().includes(q))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updated - a.updated);
  $('#list').innerHTML = list.length
    ? list.map((n) => `<li><button type="button" data-id="${n.id}" aria-current="${n.id === s.current}"><b>${n.pinned ? '📌 ' : ''}${escapeHtml(preview(n))}</b><small>${when(n.updated)}</small></button></li>`).join('')
    : `<li class="note" style="padding:10px">${T('noMatch', 'Không có ghi chú nào khớp.')}</li>`;
}
function renderEditor(): void {
  const n = cur();
  s.current = n.id;
  titleEl.value = n.title;
  bodyEl.value = n.body;
  bodyEl.style.fontSize = `${s.font}px`;
  bodyEl.style.fontFamily = s.mono ? 'var(--mono)' : '';
  $('#pin').textContent = n.pinned ? T('unpin', 'Bỏ ghim') : T('pin', 'Ghim');
  renderMeta();
}
function renderMeta(): void {
  const b = bodyEl.value;
  const words = b.trim() ? b.trim().split(/\s+/).length : 0;
  $('#meta').textContent = `${fmtInt(words)} ${T('words', 'từ')} · ${fmtInt([...b].length)} ${T('chars', 'ký tự')} · ${T('saved', 'Đã lưu')} ${when(cur().updated)}`;
}
function onEdit(): void {
  const n = cur();
  n.title = titleEl.value;
  n.body = bodyEl.value;
  n.updated = Date.now();
  renderMeta();
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => { persist(); renderList(); }, 300);
}
function newNote(title = '', body = ''): void {
  const n = { id: uid(), title, body, updated: Date.now() };
  s.notes.push(n);
  s.current = n.id;
  persist();
  renderList();
  renderEditor();
  (title ? bodyEl : titleEl).focus();
}

titleEl.addEventListener('input', onEdit);
bodyEl.addEventListener('input', onEdit);
// Phím Tab chèn khoảng thụt dòng thay vì nhảy ô
bodyEl.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey) {
    e.preventDefault();
    bodyEl.setRangeText('\t', bodyEl.selectionStart, bodyEl.selectionEnd, 'end');
    onEdit();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); persist(); toast(T('savedToast', 'Đã lưu')); }
});
$('#list').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-id]');
  if (!b) return;
  s.current = b.dataset.id as string;
  persist();
  renderList();
  renderEditor();
});
$('#new').addEventListener('click', () => newNote());
$('#q').addEventListener('input', renderList);
$('#pin').addEventListener('click', () => { const n = cur(); n.pinned = !n.pinned; persist(); renderList(); renderEditor(); });
$('#bigger').addEventListener('click', () => { s.font = Math.min(28, s.font + 1); persist(); renderEditor(); });
$('#smaller').addEventListener('click', () => { s.font = Math.max(12, s.font - 1); persist(); renderEditor(); });
$('#mono').addEventListener('click', () => { s.mono = !s.mono; persist(); renderEditor(); });
$('#dl').addEventListener('click', () => {
  const n = cur();
  downloadBlob(new Blob([(n.title ? n.title + '\n\n' : '') + n.body], { type: 'text/plain;charset=utf-8' }), `${safeFilename(preview(n), 'note')}.txt`);
});
$('#dl-all').addEventListener('click', () => {
  const all = s.notes.map((n) => `=== ${n.title || T('untitled', 'Không tiêu đề')} (${when(n.updated)}) ===\n${n.body}`).join('\n\n');
  downloadBlob(new Blob([all], { type: 'text/plain;charset=utf-8' }), `${T('allFile', 'tat-ca-ghi-chu')}.txt`);
});
$('#del').addEventListener('click', () => {
  const n = cur();
  if ((n.body.trim() || n.title.trim()) && !confirm(T('confirmDel', 'Xoá ghi chú này? Không khôi phục được.'))) return;
  s.notes = s.notes.filter((x) => x.id !== n.id);
  if (!s.notes.length) s.notes.push({ id: uid(), title: '', body: '', updated: Date.now() });
  s.current = s.notes.sort((a, b) => b.updated - a.updated)[0].id;
  persist();
  renderList();
  renderEditor();
});
bindDropzone($('#drop'), $<HTMLInputElement>('#file'), async (files) => {
  for (const f of files.slice(0, 10)) {
    if (f.size > 2 * 1024 * 1024) { toast(T('tooBig', 'File lớn hơn 2 MB, không mở được trong sổ ghi chú.')); continue; }
    newNote(f.name.replace(/\.[^.]+$/, ''), await f.text());
  }
});
// Lưu khi rời trang hoặc chuyển tab
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
window.addEventListener('beforeunload', persist);
// Ghi chú sửa ở tab khác: cập nhật danh sách
window.addEventListener('storage', (e) => {
  if (e.key !== 'wft:notepad' || !e.newValue) return;
  try { Object.assign(s, JSON.parse(e.newValue)); renderList(); renderEditor(); } catch { /* bỏ qua */ }
});
renderList();
renderEditor();
