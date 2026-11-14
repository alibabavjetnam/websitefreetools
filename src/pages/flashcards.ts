import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml, setupTabs, storage, toast } from '../ui';
import { pageText } from '../i18n';
import { bindDropzone } from '../lib/files';
import { deckStats, dueQueue, makeCard, makeQuiz, newId, parseBulk, parseCsv, review, shuffle, toCsv, type Card, type Deck, type QuizQ } from '../calc/flashcards';
import { sfx } from '../lib/sfx';

mountLayout({ activeTool: 'flashcards' });
const T = pageText();
const root = $('#tool-root');

interface Saved { decks: Deck[]; current: string; reverse: boolean }
const st = storage<Saved>('flashcards', { decks: [], current: '', reverse: false });
const S = st.get();
S.decks ??= [];
if (!S.decks.length) {
  const demo = parseBulk(T('demo', 'hello - xin chào\nthank you - cảm ơn\ngood morning - chào buổi sáng\nwater - nước\nbook - sách\nfriend - bạn bè')).cards;
  S.decks.push({ id: newId(), name: T('demoName', 'Bộ thẻ mẫu'), lang: 'en-US', cards: demo });
  S.current = S.decks[0].id;
}
const save = () => st.set(S);
const deck = (): Deck => S.decks.find((d) => d.id === S.current) || S.decks[0];

const LANG_OPTIONS: [string, string][] = [['en-US', 'English'], ['vi-VN', 'Tiếng Việt'], ['ja-JP', '日本語'], ['zh-CN', '中文'], ['ko-KR', '한국어'], ['fr-FR', 'Français'], ['de-DE', 'Deutsch'], ['es-ES', 'Español'], ['it-IT', 'Italiano'], ['pt-BR', 'Português'], ['ru-RU', 'Русский'], ['th-TH', 'ไทย'], ['id-ID', 'Bahasa Indonesia'], ['hi-IN', 'हिन्दी'], ['ar-SA', 'العربية'], ['tr-TR', 'Türkçe']];

root.innerHTML = `
  <div class="panel fc-bar">
    <label class="field fc-deck"><span class="field-label">${T('deck', 'Bộ thẻ')}</span><select id="fc-deck"></select></label>
    <button type="button" class="btn btn-sm" id="fc-new">${T('newDeck', '+ Bộ mới')}</button>
    <button type="button" class="btn btn-sm" id="fc-rename">${T('rename', 'Đổi tên')}</button>
    <button type="button" class="btn btn-sm" id="fc-delete">${T('deleteDeck', 'Xoá bộ')}</button>
    <label class="field fc-lang"><span class="field-label">${T('speechLang', 'Ngôn ngữ phát âm')}</span><select id="fc-lang">${LANG_OPTIONS.map(([c, n]) => `<option value="${c}">${n}</option>`).join('')}</select></label>
  </div>
  <div class="tabs" role="tablist" aria-label="${T('aria.tabs', 'Chọn công cụ')}">
    <button type="button" role="tab" data-tab="study">${T('tab.study', 'Học')}</button>
    <button type="button" role="tab" data-tab="quiz">${T('tab.quiz', 'Trắc nghiệm')}</button>
    <button type="button" role="tab" data-tab="cards">${T('tab.cards', 'Thẻ trong bộ')}</button>
  </div>

  <div data-panel="study">
    <div class="panel fc-study">
      <p class="note" id="fc-stats"></p>
      <button type="button" class="fc-card" id="fc-card" aria-live="polite"><span class="fc-face" id="fc-face"></span><span class="fc-hint" id="fc-hint"></span></button>
      <div class="actions" id="fc-actions" hidden>
        <button type="button" class="btn" id="fc-no">${T('study.no', 'Chưa nhớ')}</button>
        <button type="button" class="btn btn-primary" id="fc-yes">${T('study.yes', 'Đã nhớ')}</button>
      </div>
      <div class="actions">
        <button type="button" class="btn btn-sm" id="fc-speak">🔊 ${T('speak', 'Nghe phát âm')}</button>
        <label class="check"><input type="checkbox" id="fc-rev" /><span>${T('reverse', 'Hiện mặt sau trước')}</span></label>
        <button type="button" class="btn btn-sm" id="fc-all">${T('studyAll', 'Ôn tất cả thẻ')}</button>
      </div>
    </div>
  </div>

  <div data-panel="quiz">
    <div class="panel fc-quiz" id="fc-quiz"></div>
  </div>

  <div data-panel="cards">
    <div class="workspace tool-body">
      <div class="panel">
        <label class="field"><span class="field-label">${T('bulk', 'Dán nhiều thẻ, mỗi dòng "mặt trước - mặt sau"')}</span>
          <textarea id="fc-bulk" rows="6" spellcheck="false" placeholder="apple - quả táo"></textarea></label>
        <div class="actions"><button type="button" class="btn btn-primary" id="fc-bulk-add">${T('bulkAdd', 'Thêm các thẻ')}</button></div>
        <div class="form-grid">
          <label class="field"><span class="field-label">${T('front', 'Mặt trước')}</span><input id="fc-f" type="text" maxlength="300" /></label>
          <label class="field"><span class="field-label">${T('back', 'Mặt sau')}</span><input id="fc-b" type="text" maxlength="500" /></label>
        </div>
        <div class="actions"><button type="button" class="btn" id="fc-add">${T('addOne', 'Thêm một thẻ')}</button></div>
        <label class="dropzone" id="fc-drop"><input type="file" id="fc-file" accept=".csv,.txt,text/csv,text/plain" /><span>${T('importCsv', 'Nhập từ file CSV hoặc kéo thả vào đây')}</span></label>
        <div class="actions">
          <button type="button" class="btn" id="fc-export">${T('exportCsv', 'Xuất file CSV')}</button>
          <button type="button" class="btn" id="fc-reset">${T('resetProgress', 'Đặt lại tiến độ học')}</button>
        </div>
        <p class="note">${T('storeNote', 'Thẻ lưu trong trình duyệt này, không gửi lên máy chủ. Hãy xuất CSV để sao lưu.')}</p>
      </div>
      <div class="panel"><p class="note" id="fc-count"></p><ul class="fc-list" id="fc-list"></ul></div>
    </div>
  </div>
`;

// ---------- chọn bộ
function renderDecks(): void {
  const sel = $<HTMLSelectElement>('#fc-deck');
  sel.innerHTML = S.decks.map((d) => `<option value="${d.id}">${escapeHtml(d.name)} (${d.cards.length})</option>`).join('');
  sel.value = deck().id;
  $<HTMLSelectElement>('#fc-lang').value = deck().lang || 'en-US';
}
$('#fc-deck').addEventListener('change', () => { S.current = $<HTMLSelectElement>('#fc-deck').value; save(); refreshAll(); });
$('#fc-lang').addEventListener('change', () => { deck().lang = $<HTMLSelectElement>('#fc-lang').value; save(); });
$('#fc-new').addEventListener('click', () => {
  const name = prompt(T('askName', 'Tên bộ thẻ'), '');
  if (!name?.trim()) return;
  const d: Deck = { id: newId(), name: name.trim().slice(0, 60), lang: 'en-US', cards: [] };
  S.decks.push(d);
  S.current = d.id;
  save();
  refreshAll();
});
$('#fc-rename').addEventListener('click', () => {
  const name = prompt(T('askName', 'Tên bộ thẻ'), deck().name);
  if (!name?.trim()) return;
  deck().name = name.trim().slice(0, 60);
  save();
  renderDecks();
});
$('#fc-delete').addEventListener('click', () => {
  if (!confirm(T('confirmDelete', 'Xoá bộ thẻ này và toàn bộ thẻ trong đó?'))) return;
  S.decks = S.decks.filter((d) => d !== deck());
  if (!S.decks.length) S.decks.push({ id: newId(), name: T('newName', 'Bộ thẻ mới'), lang: 'en-US', cards: [] });
  S.current = S.decks[0].id;
  save();
  refreshAll();
});

// ---------- học
let queue: Card[] = [];
let flipped = false;
let studyAll = false;
const showFront = (c: Card) => (S.reverse ? c.back : c.front);
const showBack = (c: Card) => (S.reverse ? c.front : c.back);

function buildQueue(): void {
  const cards = deck().cards;
  queue = studyAll ? shuffle(cards) : dueQueue(cards, Date.now());
  flipped = false;
}
function renderStudy(): void {
  const stt = deckStats(deck().cards, Date.now());
  $('#fc-stats').textContent = `${T('stat.total', 'Tổng số thẻ')}: ${stt.total} · ${T('stat.due', 'Cần ôn')}: ${stt.due} · ${T('stat.learned', 'Đã thuộc')}: ${stt.learned}`;
  const c = queue[0];
  const card = $('#fc-card');
  $('#fc-actions').hidden = !c || !flipped;
  if (!c) {
    $('#fc-face').textContent = deck().cards.length ? T('study.allDone', 'Đã ôn hết thẻ cần ôn. Giỏi lắm!') : T('study.empty', 'Bộ thẻ chưa có thẻ nào. Sang mục Thẻ trong bộ để thêm.');
    $('#fc-hint').textContent = '';
    card.classList.remove('is-back');
    return;
  }
  $('#fc-face').textContent = flipped ? showBack(c) : showFront(c);
  $('#fc-hint').textContent = flipped ? '' : T('study.tap', 'Bấm vào thẻ để lật');
  card.classList.toggle('is-back', flipped);
}
$('#fc-card').addEventListener('click', () => { if (queue[0] && !flipped) { flipped = true; renderStudy(); } });
function answer(known: boolean): void {
  const c = queue.shift();
  if (!c) return;
  const d = deck();
  const i = d.cards.findIndex((x) => x.id === c.id);
  if (i >= 0 && !studyAll) d.cards[i] = review(c, known, Date.now());
  if (!known) queue.push(d.cards[i] ?? c); // quên thì gặp lại trong lượt này
  sfx(known ? 'coin' : 'tap');
  flipped = false;
  save();
  renderStudy();
}
$('#fc-yes').addEventListener('click', () => answer(true));
$('#fc-no').addEventListener('click', () => answer(false));
$('#fc-all').addEventListener('click', () => { studyAll = true; buildQueue(); renderStudy(); });
$<HTMLInputElement>('#fc-rev').checked = S.reverse;
$('#fc-rev').addEventListener('change', () => { S.reverse = $<HTMLInputElement>('#fc-rev').checked; save(); renderStudy(); });
function speak(text: string): void {
  if (!('speechSynthesis' in window)) { toast(T('noSpeech', 'Trình duyệt này không hỗ trợ đọc to.')); return; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = deck().lang || 'en-US';
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
$('#fc-speak').addEventListener('click', () => { const c = queue[0]; if (c) speak(flipped ? showBack(c) : showFront(c)); });

// ---------- trắc nghiệm
let quiz: QuizQ[] = [];
let qi = 0;
let score = 0;
function startQuiz(): void {
  quiz = makeQuiz(deck().cards, 10);
  qi = 0;
  score = 0;
  renderQuiz();
}
function renderQuiz(): void {
  const box = $('#fc-quiz');
  if (!quiz.length) {
    box.innerHTML = `<p class="note">${T('quiz.need', 'Cần ít nhất 4 thẻ có nghĩa khác nhau để làm trắc nghiệm.')}</p>`;
    return;
  }
  if (qi >= quiz.length) {
    box.innerHTML = `<p class="fc-score">${T('quiz.score', 'Kết quả')}: <b>${score}/${quiz.length}</b></p><div class="actions"><button type="button" class="btn btn-primary" id="fc-qagain">${T('quiz.again', 'Làm lại')}</button></div>`;
    $('#fc-qagain').addEventListener('click', startQuiz);
    return;
  }
  const q = quiz[qi];
  box.innerHTML = `<p class="note">${qi + 1} / ${quiz.length}</p><p class="fc-q">${escapeHtml(q.card.front)}</p>
    <div class="fc-opts">${q.options.map((o, i) => `<button type="button" class="btn fc-opt" data-i="${i}">${escapeHtml(o)}</button>`).join('')}</div>`;
  box.querySelectorAll<HTMLButtonElement>('.fc-opt').forEach((b) =>
    b.addEventListener('click', () => {
      const i = Number(b.dataset.i);
      const ok = i === q.answer;
      if (ok) score++;
      sfx(ok ? 'coin' : 'lose');
      box.querySelectorAll<HTMLButtonElement>('.fc-opt').forEach((x, k) => { x.disabled = true; x.classList.toggle('is-right', k === q.answer); x.classList.toggle('is-wrong', k === i && !ok); });
      setTimeout(() => { qi++; renderQuiz(); }, ok ? 650 : 1400);
    }),
  );
}

// ---------- quản lý thẻ
function renderList(): void {
  const cards = deck().cards;
  $('#fc-count').textContent = `${cards.length} ${T('cardsWord', 'thẻ')}`;
  $('#fc-list').innerHTML = cards.map((c) => `<li data-id="${c.id}"><span class="fc-li-f">${escapeHtml(c.front)}</span><span class="fc-li-b">${escapeHtml(c.back)}</span><button type="button" class="btn btn-sm" data-act="edit">${T('edit', 'Sửa')}</button><button type="button" class="btn btn-sm" data-act="del" aria-label="${T('del', 'Xoá')}">✕</button></li>`).join('');
}
$('#fc-list').addEventListener('click', (e) => {
  const li = (e.target as HTMLElement).closest<HTMLElement>('[data-id]');
  const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
  if (!li || !act) return;
  const d = deck();
  const c = d.cards.find((x) => x.id === li.dataset.id);
  if (!c) return;
  if (act === 'del') d.cards = d.cards.filter((x) => x !== c);
  else {
    const f = prompt(T('front', 'Mặt trước'), c.front);
    if (f === null) return;
    const b = prompt(T('back', 'Mặt sau'), c.back);
    if (b === null) return;
    if (f.trim() && b.trim()) { c.front = f.trim(); c.back = b.trim(); }
  }
  save();
  refreshAll();
});
function addCards(cards: Card[], skipped: number): void {
  if (!cards.length) { toast(T('noneAdded', 'Không có thẻ hợp lệ. Mỗi dòng cần có hai phần ngăn cách bằng dấu gạch ngang.')); return; }
  deck().cards.push(...cards);
  save();
  refreshAll();
  toast(`${T('added', 'Đã thêm')} ${cards.length} ${T('cardsWord', 'thẻ')}${skipped ? ` (${skipped} ${T('skipped', 'dòng bị bỏ qua')})` : ''}`);
}
$('#fc-bulk-add').addEventListener('click', () => {
  const r = parseBulk($<HTMLTextAreaElement>('#fc-bulk').value);
  addCards(r.cards, r.skipped);
  if (r.cards.length) $<HTMLTextAreaElement>('#fc-bulk').value = '';
});
$('#fc-add').addEventListener('click', () => {
  const f = $<HTMLInputElement>('#fc-f');
  const b = $<HTMLInputElement>('#fc-b');
  if (!f.value.trim() || !b.value.trim()) { toast(T('needBoth', 'Nhập cả mặt trước và mặt sau.')); return; }
  addCards([makeCard(f.value, b.value)], 0);
  f.value = '';
  b.value = '';
  f.focus();
});
bindDropzone($('#fc-drop'), $<HTMLInputElement>('#fc-file'), (files) => {
  void files[0].text().then((txt) => { const r = parseCsv(txt); addCards(r.cards, r.skipped); });
});
$('#fc-export').addEventListener('click', () => {
  const d = deck();
  if (!d.cards.length) return;
  downloadBlob(new Blob(['﻿' + toCsv(d.cards)], { type: 'text/csv;charset=utf-8' }), `${d.name.replace(/[\\/:*?"<>|]+/g, '_') || 'flashcards'}.csv`);
});
$('#fc-reset').addEventListener('click', () => {
  if (!confirm(T('confirmReset', 'Đặt lại tiến độ học của mọi thẻ trong bộ này?'))) return;
  deck().cards.forEach((c) => { c.box = 0; c.due = 0; });
  save();
  refreshAll();
});

function refreshAll(): void {
  renderDecks();
  studyAll = false;
  buildQueue();
  renderStudy();
  renderList();
  startQuiz();
}
setupTabs(root);
refreshAll();
