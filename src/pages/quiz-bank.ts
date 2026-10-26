import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml, storage, toast } from '../ui';
import { pageText, localeTag } from '../i18n';

mountLayout({ activeTool: 'quiz-bank' });
const T = pageText();
const LOCALE = localeTag();

interface Question { id: string; text: string; options: string[]; correct: number }
interface Bank { title: string; questions: Question[] }
const store = storage<Bank>('quiz-bank', { title: T('defaultTitle', 'Đề trắc nghiệm'), questions: [] });
const newId = () => Math.random().toString(36).slice(2, 8);
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const root = $('#tool-root');
root.innerHTML = `
  <div class="tabs" role="tablist">
    <button type="button" role="tab" data-tab="edit">${T('tab.edit','Soạn câu hỏi')}</button>
    <button type="button" role="tab" data-tab="quiz">${T('tab.quiz','Làm thử')}</button>
    <button type="button" role="tab" data-tab="print">${T('tab.print','In đề')}</button>
  </div>

  <section class="tool-body" data-panel="edit">
    <div class="panel code-toolbar">
      <label class="field field--inline" style="flex:1"><span class="field-label">${T('quizTitle','Tên đề')}</span><input type="text" id="title" maxlength="100" /></label>
      <div class="actions">
        <button type="button" class="btn" id="export">${T('export','Xuất file')}</button>
        <label class="btn" style="cursor:pointer">${T('import','Nhập file')}<input type="file" id="import" accept="application/json,.json" hidden /></label>
      </div>
    </div>
    <div class="workspace" style="margin-top:16px">
      <form class="panel" id="qform" novalidate>
        <div class="panel-title" id="form-title">${T('addQ','Thêm câu hỏi')}</div>
        <label class="field"><span class="field-label">${T('question','Câu hỏi')}</span><textarea id="q-text" rows="2" maxlength="500"></textarea></label>
        <div id="opt-list"></div>
        <button type="button" class="btn btn-sm" id="add-opt">${T('addOpt','+ Thêm đáp án')}</button>
        <div class="actions"><button type="button" class="btn btn-primary" id="save-q">${T('saveQ','Lưu câu hỏi')}</button><button type="button" class="btn" id="cancel-q" hidden>${T('cancelEdit','Huỷ sửa')}</button></div>
        <p class="error" id="q-err" hidden></p>
      </form>
      <section class="preview"><div class="panel"><div class="panel-title">${T('qList','Danh sách câu hỏi')} (<span id="count">0</span>)</div><div id="q-list"></div></div></section>
    </div>
  </section>

  <section class="tool-body" data-panel="quiz">
    <div class="panel code-toolbar">
      <label class="check"><input type="checkbox" id="shuffle" checked /><span>${T('shuffle','Trộn thứ tự câu hỏi')}</span></label>
      <div class="actions"><button type="button" class="btn btn-primary" id="start-quiz">${T('start','Bắt đầu / Làm lại')}</button></div>
    </div>
    <div id="quiz-area" style="margin-top:16px"></div>
  </section>

  <section class="tool-body" data-panel="print">
    <div class="panel code-toolbar no-print">
      <label class="check"><input type="checkbox" id="p-shuffle" /><span>${T('pShuffle','Trộn câu hỏi')}</span></label>
      <label class="check"><input type="checkbox" id="p-key" /><span>${T('pKey','Hiện đáp án')}</span></label>
      <div class="actions"><button type="button" class="btn" id="do-print">${T('print','In / Lưu PDF')}</button></div>
    </div>
    <div id="print-area" class="print-sheet" style="margin-top:16px"></div>
  </section>
`;

/* tabs */
const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-tab]')];
const panels = [...root.querySelectorAll<HTMLElement>('[data-panel]')];
function selectTab(tab: string): void {
  tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  panels.forEach((p) => (p.hidden = p.dataset.panel !== tab));
  if (tab === 'quiz') startQuiz();
  if (tab === 'print') renderPrint();
}
tabs.forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.tab!)));

/* editor */
let optCount = 4;
let editingId = '';
function renderOptForm(opts: string[] = ['', '', '', ''], correct = 0): void {
  optCount = opts.length;
  $('#opt-list').innerHTML = opts.map((o, i) => `<div class="opt-row">
    <input type="radio" name="correct" value="${i}"${i === correct ? ' checked' : ''} aria-label="${T('correctAns','Đáp án đúng')} ${LETTERS[i]}" />
    <span class="opt-letter">${LETTERS[i]}</span>
    <input type="text" class="opt-text" data-opt="${i}" maxlength="200" value="${escapeHtml(o)}" placeholder="${T('answer','Đáp án')} ${LETTERS[i]}" />
    ${opts.length > 2 ? `<button type="button" class="btn btn-sm" data-rmopt="${i}">✕</button>` : ''}
  </div>`).join('');
}
renderOptForm();

$('#add-opt').addEventListener('click', () => {
  if (optCount >= 6) return;
  const opts = currentOpts();
  opts.push('');
  renderOptForm(opts, currentCorrect());
});
$('#opt-list').addEventListener('click', (e) => {
  const rm = (e.target as HTMLElement).closest<HTMLElement>('[data-rmopt]')?.dataset.rmopt;
  if (rm === undefined) return;
  const opts = currentOpts();
  opts.splice(Number(rm), 1);
  renderOptForm(opts, 0);
});
const currentOpts = () => [...root.querySelectorAll<HTMLInputElement>('.opt-text')].map((i) => i.value);
const currentCorrect = () => Number(root.querySelector<HTMLInputElement>('input[name="correct"]:checked')?.value ?? 0);

$('#save-q').addEventListener('click', () => {
  const text = $<HTMLTextAreaElement>('#q-text').value.trim();
  const opts = currentOpts().map((o) => o.trim());
  const filled = opts.filter((o) => o);
  const err = $('#q-err');
  if (!text) { err.textContent = T('err.noText','Nhập nội dung câu hỏi.'); err.hidden = false; return; }
  if (filled.length < 2) { err.textContent = T('err.min2','Cần ít nhất 2 đáp án.'); err.hidden = false; return; }
  if (!opts[currentCorrect()]) { err.textContent = T('err.correctEmpty','Đáp án đúng đang để trống.'); err.hidden = false; return; }
  err.hidden = true;
  const correct = currentCorrect();
  // Bỏ các ô trống ở cuối nhưng giữ đủ tới ô đáp án đúng, để chỉ số đáp án không bị lệch
  let last = opts.length - 1;
  while (last > 1 && last > correct && opts[last] === '') last--;
  const bank = store.get();
  const q: Question = { id: editingId || newId(), text, options: opts.slice(0, last + 1), correct };
  if (editingId) bank.questions = bank.questions.map((x) => (x.id === editingId ? q : x));
  else bank.questions.push(q);
  store.set(bank);
  resetForm();
  renderList();
});
function resetForm(): void {
  editingId = '';
  $('#form-title').textContent = T('addQ','Thêm câu hỏi');
  $('#cancel-q').hidden = true;
  $<HTMLTextAreaElement>('#q-text').value = '';
  renderOptForm();
}
$('#cancel-q').addEventListener('click', resetForm);

function renderList(): void {
  const bank = store.get();
  $<HTMLInputElement>('#title').value = bank.title;
  $('#count').textContent = String(bank.questions.length);
  $('#q-list').innerHTML = bank.questions.length
    ? bank.questions.map((q, i) => `<div class="q-item">
        <div class="q-head"><b>${T('qn','Câu')} ${i + 1}.</b> <span>${escapeHtml(q.text)}</span></div>
        <div class="q-opts">${q.options.map((o, oi) => `<span class="${oi === q.correct ? 'q-correct' : ''}">${LETTERS[oi]}. ${escapeHtml(o)}</span>`).join('')}</div>
        <div class="q-actions"><button type="button" class="btn btn-sm" data-edit="${q.id}">${T('edit','Sửa')}</button><button type="button" class="btn btn-sm" data-del="${q.id}">${T('del','Xoá')}</button></div>
      </div>`).join('')
    : `<p class="note">${T('empty','Chưa có câu hỏi nào.')}</p>`;
}
$('#q-list').addEventListener('click', (e) => {
  const edit = (e.target as HTMLElement).closest<HTMLElement>('[data-edit]')?.dataset.edit;
  const del = (e.target as HTMLElement).closest<HTMLElement>('[data-del]')?.dataset.del;
  const bank = store.get();
  if (edit) {
    const q = bank.questions.find((x) => x.id === edit)!;
    editingId = edit;
    $('#form-title').textContent = T('editQ','Sửa câu hỏi');
    $('#cancel-q').hidden = false;
    $<HTMLTextAreaElement>('#q-text').value = q.text;
    renderOptForm(q.options, q.correct);
    $('#qform').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else if (del) {
    store.set({ ...bank, questions: bank.questions.filter((x) => x.id !== del) });
    renderList();
  }
});
$('#title').addEventListener('input', () => { const b = store.get(); b.title = $<HTMLInputElement>('#title').value; store.set(b); });

$('#export').addEventListener('click', () => {
  downloadBlob(new Blob([JSON.stringify(store.get(), null, 2)], { type: 'application/json' }), T('fn.export', 'de-trac-nghiem.json'));
  toast(T('toast.exported','Đã xuất file đề'));
});
$('#import').addEventListener('change', async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text()) as Bank;
    if (!Array.isArray(data.questions)) throw new Error('bad');
    store.set({ title: data.title || T('importedTitle','Đề nhập vào'), questions: data.questions.map((q) => ({ id: q.id || newId(), text: String(q.text), options: q.options, correct: q.correct })) });
    renderList();
    toast(T('toast.imported','Đã nhập đề'));
  } catch { toast(T('toast.badFile','File không đúng định dạng đề')); }
  (e.target as HTMLInputElement).value = '';
});

/* quiz mode */
const shuffle = <T>(a: T[]): T[] => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map(([, v]) => v);
let quizOrder: Question[] = [];
function startQuiz(): void {
  const bank = store.get();
  if (!bank.questions.length) { $('#quiz-area').innerHTML = `<p class="note">${T('quizEmpty','Chưa có câu hỏi. Hãy soạn câu hỏi ở tab Soạn câu hỏi.')}</p>`; return; }
  quizOrder = $<HTMLInputElement>('#shuffle').checked ? shuffle(bank.questions) : [...bank.questions];
  $('#quiz-area').innerHTML = `<form id="quiz-form">${quizOrder.map((q, i) => `<div class="panel q-take" data-q="${i}">
    <div class="q-head"><b>${T('qn','Câu')} ${i + 1}.</b> ${escapeHtml(q.text)}</div>
    <div class="q-choices">${q.options.map((o, oi) => `<label class="q-choice"><input type="radio" name="q${i}" value="${oi}" /><span>${LETTERS[oi]}. ${escapeHtml(o)}</span></label>`).join('')}</div>
  </div>`).join('')}<div class="actions"><button type="button" class="btn btn-primary" id="submit-quiz">${T('submit','Nộp bài')}</button></div><div id="result"></div></form>`;
}
$('#start-quiz').addEventListener('click', startQuiz);
$('#quiz-area').addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest('#submit-quiz')) return;
  let correct = 0;
  quizOrder.forEach((q, i) => {
    const chosen = Number(root.querySelector<HTMLInputElement>(`input[name="q${i}"]:checked`)?.value ?? -1);
    const box = root.querySelector<HTMLElement>(`.q-take[data-q="${i}"]`)!;
    box.classList.remove('q-right', 'q-wrong');
    if (chosen === q.correct) { correct++; box.classList.add('q-right'); }
    else box.classList.add('q-wrong');
    box.querySelectorAll<HTMLElement>('.q-choice').forEach((c, oi) => {
      c.classList.toggle('is-correct', oi === q.correct);
      c.classList.toggle('is-chosen-wrong', oi === chosen && chosen !== q.correct);
    });
  });
  const score = (correct / quizOrder.length) * 10;
  $('#result').innerHTML = `<div class="panel quiz-result"><b>${T('resultLabel','Kết quả')}: ${correct}/${quizOrder.length} ${T('correctCount','câu đúng')}</b> — ${T('scoreLabel','điểm')} ${score.toLocaleString(LOCALE, { maximumFractionDigits: 2 })}/10</div>`;
  $('#result').scrollIntoView({ behavior: 'smooth' });
});

/* print mode */
function renderPrint(): void {
  const bank = store.get();
  const qs = $<HTMLInputElement>('#p-shuffle').checked ? shuffle(bank.questions) : bank.questions;
  const key = $<HTMLInputElement>('#p-key').checked;
  $('#print-area').innerHTML = `<h2 class="print-title">${escapeHtml(bank.title)}</h2>
    <p class="print-meta">${T('print.name','Họ tên')}: ...................................................... ${T('print.class','Lớp')}: ................ ${T('print.score','Điểm')}: ..........</p>
    ${qs.map((q, i) => `<div class="print-q"><p><b>${T('qn','Câu')} ${i + 1}.</b> ${escapeHtml(q.text)}</p>
      <div class="print-opts">${q.options.map((o, oi) => `<span class="${key && oi === q.correct ? 'print-key' : ''}">${LETTERS[oi]}. ${escapeHtml(o)}</span>`).join('')}</div></div>`).join('')}
    ${key ? `<div class="print-answers"><b>${T('print.answers','Đáp án')}:</b> ${qs.map((q, i) => `${i + 1}${LETTERS[q.correct]}`).join(', ')}</div>` : ''}`;
}
root.querySelectorAll('#p-shuffle,#p-key').forEach((el) => el.addEventListener('change', renderPrint));
$('#do-print').addEventListener('click', () => { document.title = store.get().title; window.print(); });

renderList();
selectTab('edit');
