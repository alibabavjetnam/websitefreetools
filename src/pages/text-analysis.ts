import { mountLayout } from '../layout';
import { $, copyText, escapeHtml } from '../ui';
import { bindDropzone, fmtSize } from '../lib/files';
import { fileToText } from '../lib/extract';
import { READ_WPM, SPEAK_WPM, countPhrase, fmtDuration, keywords, textStats } from '../calc/text-stats';
import { pageText, currentLang } from '../i18n';

mountLayout({ activeTool: 'text-analysis' });
const T = pageText();
const DUR = { h: T('u.h', '{n} giờ'), m: T('u.m', '{n} phút'), s: T('u.s', '{n} giây') };
const LOCALE = ({ en: 'en-US', vi: 'vi-VN', ja: 'ja-JP', zh: 'zh-CN', es: 'es-ES', de: 'de-DE', ru: 'ru-RU', fr: 'fr-FR', pt: 'pt-BR', it: 'it-IT', tr: 'tr-TR', nl: 'nl-NL', ko: 'ko-KR', ar: 'ar-AE-u-nu-latn', hi: 'hi-IN', id: 'id-ID', th: 'th-TH-u-ca-gregory', pl: 'pl-PL', uk: 'uk-UA', bn: 'bn-BD-u-nu-latn' } as Record<string, string>)[currentLang()] || 'en-US';

const MAX_CHARS = 5_000_000;
const SAMPLE_VI = `Cà phê sữa đá là thức uống quen thuộc của người Việt. Mỗi sáng, hàng triệu người bắt đầu ngày mới bằng một ly cà phê sữa đá đậm đà.

Để pha cà phê sữa đá ngon, bạn cần cà phê rang xay nguyên chất, sữa đặc và nhiều đá. Cà phê được pha bằng phin, nhỏ giọt chậm rãi trong khoảng năm phút.

Ngày nay, cà phê sữa đá còn được bạn bè quốc tế yêu thích và có mặt trong thực đơn của nhiều quán cà phê trên thế giới.`;

const vi = (n: number, d = 0) => n.toLocaleString(LOCALE, { maximumFractionDigits: d, minimumFractionDigits: 0 });

const root = $('#tool-root');
root.innerHTML = `
  <div class="workspace">
    <div class="panel">
      <label class="dropzone dropzone--sm" id="drop">
        <input type="file" id="file" accept=".txt,.md,.docx,.pdf,.html,.htm,.csv,.rtf,text/*,application/pdf" />
        <b>${T('drop.title','Chọn file TXT, Word (.docx), PDF hoặc kéo thả')}</b>
        <span>${T('drop.hint','File dưới 30 MB. PDF phải có lớp chữ (không phải bản scan).')}</span>
      </label>
      <p class="note" id="info"></p>
      <label class="field"><span class="field-label">${T('orPaste','Hoặc dán, gõ văn bản vào đây')}</span><textarea id="text" rows="16" spellcheck="false">${escapeHtml(T('sample', SAMPLE_VI))}</textarea></label>
      <div class="actions">
        <button type="button" class="btn" id="clear">${T('clear','Xoá văn bản')}</button>
      </div>
      <p class="error" id="err" hidden></p>
    </div>
    <section class="preview">
      <div class="stat-grid" id="stats"></div>
      <div class="panel" id="time"></div>
    </section>
  </div>

  <section class="panel kw-panel">
    <div class="panel-title">${T('kwDensity','Mật độ từ khoá')}</div>
    <div class="row">
      <div class="tabs" role="tablist" aria-label="${T('aria.phraseLen','Độ dài cụm từ')}">
        <button type="button" role="tab" data-n="1" aria-selected="true">${T('n1','1 từ')}</button>
        <button type="button" role="tab" data-n="2" aria-selected="false">${T('n2','2 từ')}</button>
        <button type="button" role="tab" data-n="3" aria-selected="false">${T('n3','3 từ')}</button>
        <button type="button" role="tab" data-n="4" aria-selected="false">${T('n4','4 từ')}</button>
      </div>
      <label class="check"><input type="checkbox" id="stop" checked /><span>${T('skipStop','Bỏ qua từ phổ biến (và, của, là, the, of…)')}</span></label>
    </div>
    <div class="field-row">
      <label class="field"><span class="field-label">${T('checkKw','Kiểm tra từ khoá của bạn')}</span><input type="text" id="target" placeholder="${T('checkKwPh','Ví dụ: cà phê sữa đá')}" maxlength="200" /></label>
    </div>
    <p id="target-out" class="kw-target" hidden></p>
    <div class="table-wrap" id="kw"></div>
    <p class="note">${T('note','Mật độ = số lần xuất hiện × số từ trong cụm ÷ tổng số từ. Với bài viết SEO, từ khoá chính thường nằm trong khoảng 1–3%; cao quá dễ bị coi là nhồi nhét từ khoá. Tiếng Việt được đếm theo âm tiết giống Microsoft Word, nên cà phê là 2 từ — hãy xem tab 2 từ, 3 từ để thấy cụm từ có nghĩa.')}</p>
  </section>
`;

const showErr = (msg: string) => {
  $('#err').textContent = msg;
  $('#err').hidden = !msg;
};

let n = 1;

function renderStats(text: string): void {
  const s = textStats(text);
  const stat = (label: string, value: string, main = false) =>
    `<div class="stat${main ? ' stat--main' : ''}"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`;
  $('#stats').innerHTML = [
    stat(T('words','Số từ'), vi(s.words), true),
    stat(T('chars','Ký tự (có dấu cách)'), vi(s.chars)),
    stat(T('charsNoSpace','Ký tự (không dấu cách)'), vi(s.charsNoSpaces)),
    stat(T('sentences','Số câu'), vi(s.sentences)),
    stat(T('paragraphs','Số đoạn'), vi(s.paragraphs)),
    stat(T('uniqueWords','Từ không trùng'), vi(s.uniqueWords)),
    stat(T('avgWordsSent','Từ trung bình mỗi câu'), vi(s.avgWordsPerSentence, 1)),
    stat(T('avgCharsWord','Ký tự trung bình mỗi từ'), vi(s.avgCharsPerWord, 1)),
  ].join('');
  const hint =
    s.avgWordsPerSentence > 25 ? T('hint.long','Câu khá dài, người đọc có thể khó theo dõi. Nên tách bớt câu dài hơn 25 từ.')
      : s.sentences ? T('hint.good','Độ dài câu dễ đọc.') : '';
  $('#time').innerHTML = s.words
    ? `<div class="time-row"><span>${T('readTime','Thời gian đọc')}</span><b>${fmtDuration(Math.max(1, s.readSeconds), DUR)}</b></div>
       <div class="time-row"><span>${T('speakTime','Thời gian đọc thành tiếng, thuyết trình')}</span><b>${fmtDuration(Math.max(1, s.speakSeconds), DUR)}</b></div>
       <p class="note">${T('timeNote1','Ước tính theo tốc độ trung bình')} ${READ_WPM} ${T('timeNote2','từ/phút khi đọc thầm và')} ${SPEAK_WPM} ${T('timeNote3','từ/phút khi nói.')} ${hint}</p>
       ${s.longestSentenceWords > 25 ? `<p class="note"><b>${T('longest','Câu dài nhất')} (${vi(s.longestSentenceWords)} ${T('wordsWord','từ')}):</b> ${escapeHtml(s.longestSentence.length > 300 ? `${s.longestSentence.slice(0, 300)}…` : s.longestSentence)}</p>` : ''}`
    : `<p class="note">${T('noText','Chưa có văn bản để phân tích.')}</p>`;
}

function renderKeywords(text: string): void {
  const rows = keywords(text, n, { skipStopwords: $<HTMLInputElement>('#stop').checked, limit: 30 });
  const max = rows[0]?.density ?? 1;
  $('#kw').innerHTML = rows.length
    ? `<table class="data-table data-table--compact kw-table"><thead><tr><th>#</th><th>${T('th.phrase','Cụm từ')}</th><th>${T('th.count','Số lần')}</th><th>${T('th.density','Mật độ')}</th><th class="kw-bar-col"></th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td>${i + 1}</td><td><button type="button" class="link-btn" data-kw="${escapeHtml(r.phrase)}" title="${T('checkThis','Kiểm tra cụm này')}">${escapeHtml(r.phrase)}</button></td><td>${vi(r.count)}</td><td>${vi(r.density, 2)}%</td>
        <td><span class="kw-bar" style="width:${Math.max(2, (r.density / max) * 100).toFixed(1)}%"></span></td></tr>`).join('')}</tbody></table>`
    : `<p class="note kw-empty">${n > 1 ? `${T('noNgram1','Không có cụm')} ${n} ${T('noNgram2','từ nào lặp lại từ 2 lần trở lên.')}` : T('noWords','Chưa có từ nào.')}</p>`;
  renderTarget(text);
}

function renderTarget(text: string): void {
  const q = $<HTMLInputElement>('#target').value.trim();
  const out = $('#target-out');
  out.hidden = !q;
  if (!q) return;
  const r = countPhrase(text, q);
  if (!r.phrase) {
    out.textContent = T('kwInvalid','Từ khoá phải có chữ hoặc số.');
    return;
  }
  const level = r.density === 0 ? T('lv.none','Chưa xuất hiện trong bài.') : r.density < 0.5 ? T('lv.low','Hơi ít, có thể nhắc thêm.') : r.density <= 3 ? T('lv.ok','Mức hợp lý.') : T('lv.high','Khá dày, cân nhắc giảm bớt.');
  out.innerHTML = `"<b>${escapeHtml(r.phrase)}</b>" ${T('appears','xuất hiện')} <b>${vi(r.count)}</b> ${T('times','lần, mật độ')} <b>${vi(r.density, 2)}%</b>. ${level}`;
}

let timer = 0;
function analyze(): void {
  const text = $<HTMLTextAreaElement>('#text').value;
  if (text.length > MAX_CHARS) return showErr(T('err.tooLong','Văn bản quá dài (trên 5 triệu ký tự).'));
  showErr('');
  renderStats(text);
  renderKeywords(text);
}
const schedule = () => {
  clearTimeout(timer);
  timer = window.setTimeout(analyze, 200);
};

async function loadFile(files: File[]): Promise<void> {
  const f = files[0];
  if (!f) return;
  showErr('');
  $('#info').textContent = `${T('reading','Đang đọc')} ${f.name}…`;
  try {
    const { text, kind } = await fileToText(f, 'text');
    if (text.length > MAX_CHARS) throw new Error(T('err.tooLong','Văn bản quá dài (trên 5 triệu ký tự).'));
    $<HTMLTextAreaElement>('#text').value = text;
    $('#info').textContent = `${f.name} · ${kind} · ${fmtSize(f.size)}`;
    analyze();
  } catch (e) {
    $('#info').textContent = '';
    showErr(`${f.name}: ${(e as Error).message}`);
  }
}

$('#text').addEventListener('input', schedule);
$('#stop').addEventListener('change', analyze);
$('#target').addEventListener('input', () => renderTarget($<HTMLTextAreaElement>('#text').value));
$('#clear').addEventListener('click', () => {
  $<HTMLTextAreaElement>('#text').value = '';
  $('#info').textContent = '';
  analyze();
  $('#text').focus();
});
root.querySelectorAll<HTMLButtonElement>('[data-n]').forEach((b) =>
  b.addEventListener('click', () => {
    n = Number(b.dataset.n);
    root.querySelectorAll('[data-n]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    renderKeywords($<HTMLTextAreaElement>('#text').value);
  }),
);
$('#kw').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-kw]');
  if (!b) return;
  $<HTMLInputElement>('#target').value = b.dataset.kw ?? '';
  renderTarget($<HTMLTextAreaElement>('#text').value);
  void copyText(b.dataset.kw ?? '', T('toast.picked','Đã chọn và sao chép cụm từ'));
});
bindDropzone($('#drop'), $<HTMLInputElement>('#file'), (f) => void loadFile(f));
analyze();
