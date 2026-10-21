import { mountLayout } from '../layout';
import { $, copyText, downloadBlob, escapeHtml, storage, toast } from '../ui';
import { keywords, splitSentences, wordsOf } from '../calc/text-stats';

mountLayout({ activeTool: 'mindmap' });

interface MNode { id: string; text: string; children: MNode[]; collapsed?: boolean }
const store = storage<MNode>('mindmap', {
  id: 'root',
  text: 'Chủ đề chính',
  children: [
    { id: 'a', text: 'Ý chính 1', children: [{ id: 'a1', text: 'Chi tiết', children: [] }] },
    { id: 'b', text: 'Ý chính 2', children: [] },
  ],
});
const newId = () => Math.random().toString(36).slice(2, 8);

const root = $('#tool-root');
root.innerHTML = `
  <div class="tabs" role="tablist">
    <button type="button" role="tab" data-tab="map">Sơ đồ tư duy</button>
    <button type="button" role="tab" data-tab="sum">Tóm tắt tự động</button>
  </div>

  <section class="tool-body" data-panel="map">
    <div class="panel code-toolbar no-print">
      <p class="note" style="margin:0">Bấm vào một ý để chọn, rồi dùng các nút bên dưới. Bấm đúp (hoặc nút Sửa) để đổi chữ.</p>
      <div class="actions">
        <button type="button" class="btn" id="add-child">+ Ý con</button>
        <button type="button" class="btn" id="add-sib">+ Ý ngang</button>
        <button type="button" class="btn" id="edit-node">Sửa</button>
        <button type="button" class="btn" id="del-node">Xoá</button>
        <button type="button" class="btn" id="print-map">In</button>
      </div>
    </div>
    <div class="mindmap-canvas" id="canvas"></div>
  </section>

  <section class="tool-body" data-panel="sum">
    <div class="workspace">
      <div class="panel">
        <label class="field"><span class="field-label">Dán bài học / văn bản cần tóm tắt</span><textarea id="src" rows="16" spellcheck="false"></textarea></label>
        <div class="field-row">
          <label class="field field--inline"><span class="field-label">Độ dài tóm tắt</span><select id="ratio"><option value="0.2">Ngắn (20%)</option><option value="0.33" selected>Vừa (33%)</option><option value="0.5">Dài (50%)</option></select></label>
          <div class="actions"><button type="button" class="btn btn-primary" id="summarize">Tóm tắt</button></div>
        </div>
      </div>
      <section class="preview"><div class="panel" id="sum-out"><p class="note">Kết quả tóm tắt sẽ hiện ở đây.</p></div></section>
    </div>
    <p class="note">Công cụ tóm tắt theo phương pháp trích câu quan trọng (dựa trên tần suất từ khoá), chạy ngay trên máy, không cần internet. Phù hợp để rút gọn bài đọc; không diễn giải lại như người viết.</p>
  </section>
`;

const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-tab]')];
const panels = [...root.querySelectorAll<HTMLElement>('[data-panel]')];
tabs.forEach((b) => b.addEventListener('click', () => {
  tabs.forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  panels.forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.tab));
}));
tabs[0].setAttribute('aria-selected', 'true');
panels[1].hidden = true;

/* ---- mindmap ---- */
let selected = 'root';
const LEVEL_COLORS = ['#0d6efd', '#0e7a55', '#b8860b', '#7c3aed', '#c2185b'];

function renderNode(n: MNode, level: number): string {
  const color = LEVEL_COLORS[Math.min(level, LEVEL_COLORS.length - 1)];
  const sel = n.id === selected ? ' is-sel' : '';
  const hasKids = n.children.length > 0;
  return `<li class="mm-node">
    <div class="mm-label${sel}" data-id="${n.id}" style="border-color:${color}">
      ${hasKids ? `<button type="button" class="mm-toggle" data-fold="${n.id}">${n.collapsed ? '+' : '–'}</button>` : ''}
      <span class="mm-text">${escapeHtml(n.text)}</span>
    </div>
    ${hasKids && !n.collapsed ? `<ul class="mm-children">${n.children.map((c) => renderNode(c, level + 1)).join('')}</ul>` : ''}
  </li>`;
}
function renderMap(): void {
  $('#canvas').innerHTML = `<ul class="mm-tree">${renderNode(store.get(), 0)}</ul>`;
}
function find(n: MNode, id: string, parent: MNode | null = null): { node: MNode; parent: MNode | null } | null {
  if (n.id === id) return { node: n, parent };
  for (const c of n.children) { const r = find(c, id, n); if (r) return r; }
  return null;
}
$('#canvas').addEventListener('click', (e) => {
  const label = (e.target as HTMLElement).closest<HTMLElement>('[data-id]');
  const fold = (e.target as HTMLElement).closest<HTMLElement>('[data-fold]');
  if (fold) {
    const f = find(store.get(), fold.dataset.fold!);
    if (f) { f.node.collapsed = !f.node.collapsed; store.set(store.get()); renderMap(); }
    return;
  }
  if (label) { selected = label.dataset.id!; renderMap(); }
});
$('#canvas').addEventListener('dblclick', () => editNode());

function editNode(): void {
  const f = find(store.get(), selected);
  if (!f) return;
  const text = prompt('Sửa nội dung:', f.node.text);
  if (text !== null) { f.node.text = text.trim() || f.node.text; store.set(store.get()); renderMap(); }
}
$('#edit-node').addEventListener('click', editNode);
$('#add-child').addEventListener('click', () => {
  const f = find(store.get(), selected);
  if (!f) return;
  const id = newId();
  f.node.children.push({ id, text: 'Ý mới', children: [] });
  f.node.collapsed = false;
  selected = id;
  store.set(store.get());
  renderMap();
});
$('#add-sib').addEventListener('click', () => {
  const f = find(store.get(), selected);
  if (!f || !f.parent) { toast('Không thêm ý ngang cho chủ đề gốc'); return; }
  const id = newId();
  const idx = f.parent.children.indexOf(f.node);
  f.parent.children.splice(idx + 1, 0, { id, text: 'Ý mới', children: [] });
  selected = id;
  store.set(store.get());
  renderMap();
});
$('#del-node').addEventListener('click', () => {
  if (selected === 'root') { toast('Không xoá được chủ đề gốc'); return; }
  const f = find(store.get(), selected);
  if (!f || !f.parent) return;
  f.parent.children = f.parent.children.filter((c) => c !== f.node);
  selected = f.parent.id;
  store.set(store.get());
  renderMap();
});
$('#print-map').addEventListener('click', () => window.print());

/* ---- summarizer ---- */
function summarize(text: string, ratio: number): string[] {
  const sentences = splitSentences(text);
  if (sentences.length <= 3) return sentences;
  // Điểm từ khoá: tần suất từ (bỏ từ phổ biến) -> điểm mỗi câu = tổng điểm từ / số từ
  const freq = new Map<string, number>();
  for (const k of keywords(text, 1, { skipStopwords: true, minCount: 1, limit: 400 })) freq.set(k.phrase, k.count);
  const norm = (w: string) => w.normalize('NFC').toLocaleLowerCase('vi');
  const scored = sentences.map((s, i) => {
    const ws = wordsOf(s).map(norm);
    const score = ws.reduce((a, w) => a + (freq.get(w) ?? 0), 0) / Math.max(1, ws.length);
    // Câu đầu đoạn thường quan trọng hơn
    return { i, s, score: score * (i === 0 ? 1.3 : 1) };
  });
  const keep = Math.max(2, Math.round(sentences.length * ratio));
  const chosen = new Set(scored.slice().sort((a, b) => b.score - a.score).slice(0, keep).map((x) => x.i));
  return scored.filter((x) => chosen.has(x.i)).map((x) => x.s);
}
$('#summarize').addEventListener('click', () => {
  const text = $<HTMLTextAreaElement>('#src').value.trim();
  if (!text) { $('#sum-out').innerHTML = '<p class="note">Hãy dán văn bản cần tóm tắt.</p>'; return; }
  const ratio = Number($<HTMLSelectElement>('#ratio').value);
  const bullets = summarize(text, ratio);
  $('#sum-out').innerHTML = `<div class="panel-title">Tóm tắt (${bullets.length} ý)</div>
    <ul class="sum-list">${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
    <div class="actions"><button type="button" class="btn btn-sm" id="copy-sum">Sao chép</button><button type="button" class="btn btn-sm" id="dl-sum">Tải .txt</button><button type="button" class="btn btn-sm" id="to-map">Tạo sơ đồ từ tóm tắt</button></div>`;
  $('#copy-sum').addEventListener('click', () => copyText(bullets.map((b) => '• ' + b).join('\n')));
  $('#dl-sum').addEventListener('click', () => downloadBlob(new Blob([bullets.map((b) => '• ' + b).join('\n')], { type: 'text/plain;charset=utf-8' }), 'tom-tat.txt'));
  $('#to-map').addEventListener('click', () => {
    const first = wordsOf(text).slice(0, 4).join(' ') || 'Bài học';
    store.set({ id: 'root', text: first, children: bullets.map((b) => ({ id: newId(), text: b.length > 60 ? b.slice(0, 60) + '…' : b, children: [] })) });
    selected = 'root';
    renderMap();
    tabs[0].click();
    toast('Đã tạo sơ đồ tư duy từ tóm tắt');
  });
});

renderMap();
