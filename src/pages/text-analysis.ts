import { mountLayout } from '../layout';
import { $, copyText, escapeHtml } from '../ui';
import { bindDropzone, fmtSize } from '../lib/files';
import { fileToText } from '../lib/extract';
import { READ_WPM, SPEAK_WPM, countPhrase, fmtDuration, keywords, textStats } from '../calc/text-stats';

mountLayout({ activeTool: 'text-analysis' });

const MAX_CHARS = 5_000_000;
const SAMPLE = `Cà phê sữa đá là thức uống quen thuộc của người Việt. Mỗi sáng, hàng triệu người bắt đầu ngày mới bằng một ly cà phê sữa đá đậm đà.

Để pha cà phê sữa đá ngon, bạn cần cà phê rang xay nguyên chất, sữa đặc và nhiều đá. Cà phê được pha bằng phin, nhỏ giọt chậm rãi trong khoảng năm phút.

Ngày nay, cà phê sữa đá còn được bạn bè quốc tế yêu thích và có mặt trong thực đơn của nhiều quán cà phê trên thế giới.`;

const vi = (n: number, d = 0) => n.toLocaleString('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: 0 });

const root = $('#tool-root');
root.innerHTML = `
  <div class="workspace">
    <div class="panel">
      <label class="dropzone dropzone--sm" id="drop">
        <input type="file" id="file" accept=".txt,.md,.docx,.pdf,.html,.htm,.csv,.rtf,text/*,application/pdf" />
        <b>Chọn file TXT, Word (.docx), PDF hoặc kéo thả</b>
        <span>File dưới 30 MB. PDF phải có lớp chữ (không phải bản scan).</span>
      </label>
      <p class="note" id="info"></p>
      <label class="field"><span class="field-label">Hoặc dán, gõ văn bản vào đây</span><textarea id="text" rows="16" spellcheck="false">${escapeHtml(SAMPLE)}</textarea></label>
      <div class="actions">
        <button type="button" class="btn" id="clear">Xoá văn bản</button>
      </div>
      <p class="error" id="err" hidden></p>
    </div>
    <section class="preview">
      <div class="stat-grid" id="stats"></div>
      <div class="panel" id="time"></div>
    </section>
  </div>

  <section class="panel kw-panel">
    <div class="panel-title">Mật độ từ khoá</div>
    <div class="row">
      <div class="tabs" role="tablist" aria-label="Độ dài cụm từ">
        <button type="button" role="tab" data-n="1" aria-selected="true">1 từ</button>
        <button type="button" role="tab" data-n="2" aria-selected="false">2 từ</button>
        <button type="button" role="tab" data-n="3" aria-selected="false">3 từ</button>
        <button type="button" role="tab" data-n="4" aria-selected="false">4 từ</button>
      </div>
      <label class="check"><input type="checkbox" id="stop" checked /><span>Bỏ qua từ phổ biến (và, của, là, the, of…)</span></label>
    </div>
    <div class="field-row">
      <label class="field"><span class="field-label">Kiểm tra từ khoá của bạn</span><input type="text" id="target" placeholder="Ví dụ: cà phê sữa đá" maxlength="200" /></label>
    </div>
    <p id="target-out" class="kw-target" hidden></p>
    <div class="table-wrap" id="kw"></div>
    <p class="note">Mật độ = số lần xuất hiện × số từ trong cụm ÷ tổng số từ. Với bài viết SEO, từ khoá chính thường nằm trong khoảng 1–3%; cao quá dễ bị coi là nhồi nhét từ khoá. Tiếng Việt được đếm theo âm tiết giống Microsoft Word, nên "cà phê" là 2 từ — hãy xem tab 2 từ, 3 từ để thấy cụm từ có nghĩa.</p>
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
    stat('Số từ', vi(s.words), true),
    stat('Ký tự (có dấu cách)', vi(s.chars)),
    stat('Ký tự (không dấu cách)', vi(s.charsNoSpaces)),
    stat('Số câu', vi(s.sentences)),
    stat('Số đoạn', vi(s.paragraphs)),
    stat('Từ không trùng', vi(s.uniqueWords)),
    stat('Từ trung bình mỗi câu', vi(s.avgWordsPerSentence, 1)),
    stat('Ký tự trung bình mỗi từ', vi(s.avgCharsPerWord, 1)),
  ].join('');
  const hint =
    s.avgWordsPerSentence > 25 ? 'Câu khá dài, người đọc có thể khó theo dõi. Nên tách bớt câu dài hơn 25 từ.'
      : s.sentences ? 'Độ dài câu dễ đọc.' : '';
  $('#time').innerHTML = s.words
    ? `<div class="time-row"><span>Thời gian đọc</span><b>${fmtDuration(Math.max(1, s.readSeconds))}</b></div>
       <div class="time-row"><span>Thời gian đọc thành tiếng, thuyết trình</span><b>${fmtDuration(Math.max(1, s.speakSeconds))}</b></div>
       <p class="note">Ước tính theo tốc độ trung bình ${READ_WPM} từ/phút khi đọc thầm và ${SPEAK_WPM} từ/phút khi nói. ${hint}</p>
       ${s.longestSentenceWords > 25 ? `<p class="note"><b>Câu dài nhất (${vi(s.longestSentenceWords)} từ):</b> ${escapeHtml(s.longestSentence.length > 300 ? `${s.longestSentence.slice(0, 300)}…` : s.longestSentence)}</p>` : ''}`
    : '<p class="note">Chưa có văn bản để phân tích.</p>';
}

function renderKeywords(text: string): void {
  const rows = keywords(text, n, { skipStopwords: $<HTMLInputElement>('#stop').checked, limit: 30 });
  const max = rows[0]?.density ?? 1;
  $('#kw').innerHTML = rows.length
    ? `<table class="data-table data-table--compact kw-table"><thead><tr><th>#</th><th>Cụm từ</th><th>Số lần</th><th>Mật độ</th><th class="kw-bar-col"></th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td>${i + 1}</td><td><button type="button" class="link-btn" data-kw="${escapeHtml(r.phrase)}" title="Kiểm tra cụm này">${escapeHtml(r.phrase)}</button></td><td>${vi(r.count)}</td><td>${vi(r.density, 2)}%</td>
        <td><span class="kw-bar" style="width:${Math.max(2, (r.density / max) * 100).toFixed(1)}%"></span></td></tr>`).join('')}</tbody></table>`
    : `<p class="note kw-empty">${n > 1 ? `Không có cụm ${n} từ nào lặp lại từ 2 lần trở lên.` : 'Chưa có từ nào.'}</p>`;
  renderTarget(text);
}

function renderTarget(text: string): void {
  const q = $<HTMLInputElement>('#target').value.trim();
  const out = $('#target-out');
  out.hidden = !q;
  if (!q) return;
  const r = countPhrase(text, q);
  if (!r.phrase) {
    out.textContent = 'Từ khoá phải có chữ hoặc số.';
    return;
  }
  const level = r.density === 0 ? 'Chưa xuất hiện trong bài.' : r.density < 0.5 ? 'Hơi ít, có thể nhắc thêm.' : r.density <= 3 ? 'Mức hợp lý.' : 'Khá dày, cân nhắc giảm bớt.';
  out.innerHTML = `"<b>${escapeHtml(r.phrase)}</b>" xuất hiện <b>${vi(r.count)}</b> lần, mật độ <b>${vi(r.density, 2)}%</b>. ${level}`;
}

let timer = 0;
function analyze(): void {
  const text = $<HTMLTextAreaElement>('#text').value;
  if (text.length > MAX_CHARS) return showErr('Văn bản quá dài (trên 5 triệu ký tự).');
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
  $('#info').textContent = `Đang đọc ${f.name}…`;
  try {
    const { text, kind } = await fileToText(f, 'text');
    if (text.length > MAX_CHARS) throw new Error('Văn bản quá dài (trên 5 triệu ký tự).');
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
  void copyText(b.dataset.kw ?? '', 'Đã chọn và sao chép cụm từ');
});
bindDropzone($('#drop'), $<HTMLInputElement>('#file'), (f) => void loadFile(f));
analyze();
