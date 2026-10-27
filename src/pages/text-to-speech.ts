import { mountLayout } from '../layout';
import { $, escapeHtml, storage } from '../ui';
import { pageText, localeTag } from '../i18n';

mountLayout({ activeTool: 'text-to-speech' });
const T = pageText();
const LOCALE = localeTag();

const cfg = storage<{ text: string; voice: string; rate: number; pitch: number; volume: number }>('tts', { text: '', voice: '', rate: 1, pitch: 1, volume: 1 });
const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;

$('#tool-root').innerHTML = `
  <div class="workspace">
    <section class="panel">
      <label class="field"><span class="field-label">${T('text', 'Văn bản cần đọc')}</span>
        <textarea id="text" rows="12" maxlength="100000" placeholder="${T('placeholder', 'Dán văn bản vào đây…')}"></textarea>
      </label>
      <div class="row"><span class="note" id="count"></span></div>
      <div class="actions">
        <button type="button" class="btn btn-primary" id="play">${T('play', 'Đọc')}</button>
        <button type="button" class="btn" id="pause" disabled>${T('pause', 'Tạm dừng')}</button>
        <button type="button" class="btn" id="stop" disabled>${T('stop', 'Dừng')}</button>
      </div>
      <div class="progress" aria-hidden="true"><i id="bar"></i></div>
      <p class="error" id="err" hidden></p>
    </section>
    <section class="panel">
      <label class="field"><span class="field-label">${T('lang', 'Ngôn ngữ')}</span><select id="lang"></select></label>
      <label class="field"><span class="field-label">${T('voice', 'Giọng đọc')}</span><select id="voice"></select></label>
      <label class="field"><span class="field-label">${T('rate', 'Tốc độ')}: <output id="rate-out"></output></span><input type="range" id="rate" min="0.5" max="2" step="0.05" /></label>
      <label class="field"><span class="field-label">${T('pitch', 'Cao độ')}: <output id="pitch-out"></output></span><input type="range" id="pitch" min="0.5" max="1.5" step="0.05" /></label>
      <label class="field"><span class="field-label">${T('volume', 'Âm lượng')}: <output id="vol-out"></output></span><input type="range" id="volume" min="0" max="1" step="0.05" /></label>
      <p class="note">${T('note', 'Giọng đọc có sẵn khác nhau theo trình duyệt và hệ điều hành. Không thấy giọng tiếng Việt: trên Windows vào Cài đặt > Thời gian và ngôn ngữ > Giọng nói để thêm; trên điện thoại cài thêm giọng trong phần Chuyển văn bản thành giọng nói. Trình duyệt không cho tải file âm thanh, nếu cần file hãy dùng công cụ Quay màn hình kèm âm thanh.')}</p>
    </section>
  </div>
`;

const text = $<HTMLTextAreaElement>('#text');
const langSel = $<HTMLSelectElement>('#lang');
const voiceSel = $<HTMLSelectElement>('#voice');
const err = $('#err');
const showErr = (m: string) => { err.textContent = m; err.hidden = !m; };

const c0 = cfg.get();
text.value = c0.text || T('sample', 'Xin chào! Đây là công cụ đọc văn bản thành giọng nói của WFTools. Bạn có thể dán bất kỳ đoạn văn nào và bấm Đọc để nghe.');
for (const [id, v] of [['rate', c0.rate], ['pitch', c0.pitch], ['volume', c0.volume]] as const) $<HTMLInputElement>('#' + id).value = String(v);

let voices: SpeechSynthesisVoice[] = [];
const langName = (code: string) => {
  try { return new Intl.DisplayNames([LOCALE], { type: 'language' }).of(code) || code; } catch { return code; }
};

function loadVoices(): void {
  if (!synth) return;
  voices = synth.getVoices();
  if (!voices.length) return;
  const langs = [...new Set(voices.map((v) => v.lang.replace('_', '-')))].sort((x, y) => langName(x).localeCompare(langName(y), LOCALE));
  const prev = langSel.value || voices.find((v) => v.name === c0.voice)?.lang.replace('_', '-') || '';
  const pref = prev || langs.find((l) => l.toLowerCase() === LOCALE.toLowerCase()) || langs.find((l) => l.split('-')[0] === LOCALE.split('-')[0]) || langs[0];
  langSel.innerHTML = langs.map((l) => `<option value="${escapeHtml(l)}">${escapeHtml(langName(l))} (${escapeHtml(l)})</option>`).join('');
  langSel.value = pref;
  fillVoices();
}
function fillVoices(): void {
  const list = voices.filter((v) => v.lang.replace('_', '-') === langSel.value);
  voiceSel.innerHTML = list.map((v) => `<option value="${escapeHtml(v.name)}">${escapeHtml(v.name)}${v.localService ? '' : ' ☁'}</option>`).join('');
  if (list.some((v) => v.name === cfg.get().voice)) voiceSel.value = cfg.get().voice;
}

function save(): void {
  cfg.set({ text: text.value.slice(0, 20000), voice: voiceSel.value, rate: +$<HTMLInputElement>('#rate').value, pitch: +$<HTMLInputElement>('#pitch').value, volume: +$<HTMLInputElement>('#volume').value });
  $('#rate-out').textContent = `${(+$<HTMLInputElement>('#rate').value).toFixed(2)}×`;
  $('#pitch-out').textContent = (+$<HTMLInputElement>('#pitch').value).toFixed(2);
  $('#vol-out').textContent = `${Math.round(+$<HTMLInputElement>('#volume').value * 100)}%`;
  $('#count').textContent = `${text.value.length.toLocaleString(LOCALE)} ${T('chars', 'ký tự')}`;
}

/** Chia văn bản dài thành đoạn ngắn: nhiều trình duyệt tự dừng khi một câu đọc quá dài */
function chunks(s: string): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = [];
  const re = /[^.!?。！？\n]+[.!?。！？]*\s*|\n+/g;
  let m: RegExpExecArray | null;
  let buf = '';
  let bufStart = 0;
  while ((m = re.exec(s))) {
    if (!buf) bufStart = m.index;
    buf += m[0];
    if (buf.length > 180) { out.push({ text: buf, start: bufStart }); buf = ''; }
  }
  if (buf.trim()) out.push({ text: buf, start: bufStart });
  // Câu quá dài không có dấu chấm: cắt tiếp theo dấu phẩy / khoảng trắng
  return out.flatMap((c) => {
    if (c.text.length <= 260) return [c];
    const parts: { text: string; start: number }[] = [];
    let i = 0;
    while (i < c.text.length) {
      let end = Math.min(c.text.length, i + 220);
      if (end < c.text.length) {
        const cut = Math.max(c.text.lastIndexOf(',', end), c.text.lastIndexOf(' ', end));
        if (cut > i + 60) end = cut + 1;
      }
      parts.push({ text: c.text.slice(i, end), start: c.start + i });
      i = end;
    }
    return parts;
  });
}

let queue: { text: string; start: number }[] = [];
let idx = 0;
let running = false;
let total = 1;

function setState(on: boolean): void {
  running = on;
  $<HTMLButtonElement>('#pause').disabled = !on;
  $<HTMLButtonElement>('#stop').disabled = !on;
  $('#play').textContent = on ? T('restart', 'Đọc lại từ đầu') : T('play', 'Đọc');
  if (!on) $('#pause').textContent = T('pause', 'Tạm dừng');
}

function speakNext(): void {
  if (!synth || !running) return;
  if (idx >= queue.length) { setState(false); $<HTMLElement>('#bar').style.width = '100%'; return; }
  const part = queue[idx];
  const u = new SpeechSynthesisUtterance(part.text);
  const v = voices.find((x) => x.name === voiceSel.value);
  if (v) u.voice = v;
  u.lang = v?.lang || langSel.value || LOCALE;
  u.rate = +$<HTMLInputElement>('#rate').value;
  u.pitch = +$<HTMLInputElement>('#pitch').value;
  u.volume = +$<HTMLInputElement>('#volume').value;
  u.onend = () => { idx++; $<HTMLElement>('#bar').style.width = `${(part.start + part.text.length) / total * 100}%`; speakNext(); };
  u.onerror = (e) => {
    if (e.error === 'interrupted' || e.error === 'canceled') return;
    showErr(T('errSpeak', 'Không đọc được bằng giọng này. Hãy chọn giọng khác hoặc thử trình duyệt Chrome, Edge, Safari.'));
    setState(false);
  };
  synth.speak(u);
}

$('#play').addEventListener('click', () => {
  showErr('');
  if (!synth) { showErr(T('noSupport', 'Trình duyệt này không hỗ trợ đọc văn bản. Hãy dùng Chrome, Edge, Safari hoặc Firefox bản mới.')); return; }
  if (!text.value.trim()) { showErr(T('empty', 'Hãy nhập văn bản cần đọc.')); return; }
  synth.cancel();
  queue = chunks(text.value);
  total = Math.max(1, text.value.length);
  idx = 0;
  $<HTMLElement>('#bar').style.width = '0';
  setState(true);
  speakNext();
});
$('#pause').addEventListener('click', () => {
  if (!synth) return;
  if (synth.paused) { synth.resume(); $('#pause').textContent = T('pause', 'Tạm dừng'); }
  else { synth.pause(); $('#pause').textContent = T('resume', 'Tiếp tục'); }
});
$('#stop').addEventListener('click', () => { setState(false); synth?.cancel(); });
langSel.addEventListener('change', () => { fillVoices(); save(); });
voiceSel.addEventListener('change', save);
['rate', 'pitch', 'volume'].forEach((id) => $('#' + id).addEventListener('input', save));
text.addEventListener('input', save);
window.addEventListener('beforeunload', () => synth?.cancel());

if (synth) {
  loadVoices();
  synth.addEventListener?.('voiceschanged', loadVoices);
  // Một số trình duyệt nạp danh sách giọng chậm
  setTimeout(() => { if (!voices.length) { loadVoices(); if (!voices.length) showErr(T('noVoices', 'Chưa thấy giọng đọc nào trên máy. Thử tải lại trang hoặc cài thêm giọng nói trong cài đặt hệ điều hành.')); } }, 1500);
} else {
  showErr(T('noSupport', 'Trình duyệt này không hỗ trợ đọc văn bản. Hãy dùng Chrome, Edge, Safari hoặc Firefox bản mới.'));
}
save();
