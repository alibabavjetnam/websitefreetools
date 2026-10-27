import { mountLayout } from '../layout';
import { $, escapeHtml, fmtInt, storage } from '../ui';
import { pageText, currentLang } from '../i18n';

mountLayout({ activeTool: 'typing-test' });
const T = pageText();

/** Đoạn văn mẫu. Bản dịch theo ngôn ngữ: các đoạn ngăn bằng dấu | */
const VI_TEXTS = [
  'Mỗi buổi sáng tôi thường dậy sớm để chạy bộ quanh hồ. Không khí trong lành giúp đầu óc tỉnh táo, sẵn sàng cho một ngày làm việc mới. Sau đó tôi ăn sáng cùng gia đình, đọc vài trang sách rồi mới bắt đầu công việc. Thói quen nhỏ nhưng đều đặn mỗi ngày sẽ tạo nên thay đổi lớn theo thời gian.',
  'Việt Nam có đường bờ biển dài hơn ba nghìn ki lô mét với nhiều bãi tắm đẹp nổi tiếng. Du khách có thể tắm biển ở Nha Trang, khám phá hang động ở Quảng Bình, thưởng thức ẩm thực ở Hội An hay ngắm ruộng bậc thang ở Sa Pa. Mỗi vùng đất đều mang một nét riêng khó quên.',
  'Học gõ mười ngón là một kỹ năng hữu ích cho bất kỳ ai làm việc với máy tính. Khi đã quen, bạn sẽ không cần nhìn bàn phím, tốc độ gõ tăng lên đáng kể và ít mắc lỗi hơn. Hãy luyện tập đều đặn mỗi ngày khoảng mười lăm phút, tập trung vào độ chính xác trước rồi mới tăng dần tốc độ.',
];
const passages = (): string[] => {
  const tr = T('texts', '');
  if (tr && currentLang() !== 'vi') return tr.split('|').map((x) => x.trim()).filter(Boolean);
  return VI_TEXTS;
};

const st = storage<{ dur: number; best: number; results: { wpm: number; acc: number; at: string }[] }>('typing-test', { dur: 60, best: 0, results: [] });
const s = st.get();

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:28px">
    <div class="row" style="justify-content:space-between">
      <div class="segmented" role="radiogroup" aria-label="${T('duration', 'Thời gian')}">
        ${[30, 60, 120, 300].map((d) => `<label><input type="radio" name="dur" value="${d}" /><span>${d < 60 ? `${d} ${T('s', 'giây')}` : `${d / 60} ${T('m', 'phút')}`}</span></label>`).join('')}
      </div>
      <div class="row">
        <span class="stat-value" id="timer" style="font-size:1.6rem;font-variant-numeric:tabular-nums">60</span>
        <button type="button" class="btn" id="restart">${T('restart', 'Làm lại')}</button>
      </div>
    </div>
    <div class="type-text" id="target" aria-hidden="true"></div>
    <label class="field"><span class="field-label">${T('typeHere', 'Gõ vào đây (đồng hồ bắt đầu khi bạn gõ chữ đầu tiên)')}</span>
      <textarea id="input" rows="3" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea>
    </label>
    <div class="stat-grid" id="live"></div>
  </div>
  <div class="workspace">
    <section class="panel" id="result" hidden></section>
    <section class="panel">
      <div class="panel-title" style="margin:0">${T('historyTitle', 'Kết quả gần đây')} · ${T('best', 'Tốt nhất')}: <span id="best"></span></div>
      <div class="table-wrap"><table class="data-table" id="hist"></table></div>
      <p class="note">${T('howTo', 'WPM = số từ đúng mỗi phút (mỗi 5 ký tự gõ đúng tính là 1 từ). Gõ được tiếng Việt bằng Unikey, bộ gõ Telex/VNI của máy. Mức tham khảo: 40 WPM là khá, 60 WPM là nhanh, trên 80 WPM là rất nhanh.')}</p>
    </section>
  </div>
`;

const target = $('#target');
const input = $<HTMLTextAreaElement>('#input');
let text = '';
let started = 0;
let timer = 0;
let done = false;
let keystrokes = 0;
let errorsMade = 0;
let prevLen = 0;

const dur = () => Number(document.querySelector<HTMLInputElement>('input[name=dur]:checked')?.value || 60);

function newText(): void {
  const list = passages();
  // Ghép nhiều đoạn để đủ dài cho bài 5 phút
  const order = [...list].sort(() => (crypto.getRandomValues(new Uint8Array(1))[0] > 127 ? 1 : -1));
  text = order.join(' ');
  while (text.length < dur() * 12) text += ' ' + order.join(' ');
}

function reset(): void {
  clearInterval(timer);
  started = 0;
  done = false;
  keystrokes = 0;
  errorsMade = 0;
  prevLen = 0;
  input.value = '';
  input.disabled = false;
  newText();
  $('#timer').textContent = String(dur());
  $('#result').hidden = true;
  renderText();
  renderLive();
}

function counts(): { correct: number; wrong: number; typed: number } {
  const v = input.value;
  let correct = 0;
  let wrong = 0;
  for (let i = 0; i < v.length; i++) (v[i] === text[i] ? correct++ : wrong++);
  return { correct, wrong, typed: v.length };
}

function renderText(): void {
  const v = input.value;
  // Chỉ hiện một cửa sổ quanh vị trí đang gõ cho nhẹ
  const from = Math.max(0, v.length - 160);
  const to = Math.min(text.length, v.length + 320);
  let html = from > 0 ? '…' : '';
  for (let i = from; i < to; i++) {
    const c = escapeHtml(text[i]);
    if (i < v.length) html += `<span class="${v[i] === text[i] ? 'ok' : 'bad'}">${text[i] === ' ' && v[i] !== ' ' ? '·' : c}</span>`;
    else if (i === v.length) html += `<span class="cur">${c}</span>`;
    else html += `<span class="todo">${c}</span>`;
  }
  target.innerHTML = html;
}

function stats(elapsedMs: number) {
  const { correct, typed } = counts();
  const min = Math.max(elapsedMs, 1000) / 60000;
  const wpm = correct / 5 / min;
  const raw = typed / 5 / min;
  // Độ chính xác theo trạng thái hiện tại: bộ gõ tiếng Việt (Telex/VNI) sửa ký tự trước đó khi thêm dấu
  const acc = typed ? (correct / typed) * 100 : 100;
  return { wpm, raw, acc, correct, typed };
}

function renderLive(): void {
  const el = started ? Date.now() - started : 0;
  const r = stats(el);
  const box = (l: string, v: string) => `<div class="stat"><span class="stat-label">${l}</span><span class="stat-value">${v}</span></div>`;
  $('#live').innerHTML = [
    box('WPM', started ? fmtInt(r.wpm) : '0'),
    box(T('accuracy', 'Độ chính xác'), `${fmtInt(r.acc)}%`),
    box(T('chars', 'Ký tự đúng'), fmtInt(r.correct)),
    box(T('errors', 'Lỗi đã gõ'), fmtInt(errorsMade)),
  ].join('');
}

function finish(): void {
  if (done) return;
  done = true;
  clearInterval(timer);
  input.disabled = true;
  const el = Math.min(Date.now() - started, dur() * 1000);
  const r = stats(el);
  const level = r.wpm >= 80 ? T('lv4', 'Rất nhanh, như người gõ chuyên nghiệp') : r.wpm >= 60 ? T('lv3', 'Nhanh') : r.wpm >= 40 ? T('lv2', 'Khá, trên mức trung bình') : r.wpm >= 25 ? T('lv1', 'Trung bình') : T('lv0', 'Cần luyện thêm');
  const isBest = r.wpm > s.best;
  if (isBest) s.best = Math.round(r.wpm);
  s.results.unshift({ wpm: Math.round(r.wpm), acc: Math.round(r.acc), at: new Date().toISOString() });
  s.results = s.results.slice(0, 15);
  st.set(s);
  const box = $('#result');
  box.hidden = false;
  box.innerHTML = `
    <div class="panel-title" style="margin:0">${isBest ? T('newBest', '🏆 Kỷ lục mới!') : T('yourResult', 'Kết quả của bạn')}</div>
    <div class="stat stat--main"><span class="stat-label">${T('speed', 'Tốc độ')}</span><span class="stat-value">${fmtInt(r.wpm)} WPM</span></div>
    <div class="stat-grid">
      <div class="stat"><span class="stat-label">${T('accuracy', 'Độ chính xác')}</span><span class="stat-value">${fmtInt(r.acc)}%</span></div>
      <div class="stat"><span class="stat-label">${T('rawWpm', 'Tốc độ thô (kể cả lỗi)')}</span><span class="stat-value">${fmtInt(r.raw)} WPM</span></div>
      <div class="stat"><span class="stat-label">CPM</span><span class="stat-value">${fmtInt(r.correct / (el / 60000))}</span></div>
      <div class="stat"><span class="stat-label">${T('level', 'Đánh giá')}</span><span class="stat-value" style="font-size:1rem">${level}</span></div>
    </div>
    <button type="button" class="btn btn-primary" id="again">${T('again', 'Thử lại')}</button>`;
  $('#again').addEventListener('click', () => { reset(); input.focus(); });
  renderLive();
  renderHist();
}

function renderHist(): void {
  $('#best').textContent = s.best ? `${s.best} WPM` : '—';
  $('#hist').innerHTML = s.results.length
    ? `<thead><tr><th>WPM</th><th>${T('accuracy', 'Độ chính xác')}</th><th>${T('when', 'Lúc')}</th></tr></thead><tbody>${s.results.map((r) => `<tr><td>${r.wpm}</td><td>${r.acc}%</td><td>${new Date(r.at).toLocaleString()}</td></tr>`).join('')}</tbody>`
    : `<tbody><tr><td class="note">${T('noHist', 'Chưa có kết quả.')}</td></tr></tbody>`;
}

input.addEventListener('input', () => {
  if (done) return;
  if (!started && input.value.length) {
    started = Date.now();
    timer = window.setInterval(() => {
      const left = Math.max(0, dur() - Math.floor((Date.now() - started) / 1000));
      $('#timer').textContent = String(left);
      renderLive();
      if (left <= 0) finish();
    }, 250);
  }
  // Đếm lỗi khi một ký tự đã "chốt" (đã gõ sang ký tự sau), để bộ gõ có dấu không bị tính lỗi oan
  const v = input.value;
  if (v.length > prevLen) {
    for (let i = Math.max(0, prevLen - 1); i < v.length - 1; i++) { keystrokes++; if (v[i] !== text[i]) errorsMade++; }
  }
  prevLen = v.length;
  renderText();
  renderLive();
  if (v.length >= text.length) finish();
});
// Không cho dán để kết quả trung thực
input.addEventListener('paste', (e) => e.preventDefault());
document.querySelectorAll<HTMLInputElement>('input[name=dur]').forEach((r) => {
  r.checked = Number(r.value) === s.dur;
  r.addEventListener('change', () => { s.dur = Number(r.value); st.set(s); reset(); input.focus(); });
});
$('#restart').addEventListener('click', () => { reset(); input.focus(); });
reset();
renderHist();
