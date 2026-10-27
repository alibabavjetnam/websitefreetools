import { mountLayout } from '../layout';
import { $, copyText, downloadBlob, escapeHtml, storage } from '../ui';
import { pageText, localeTag } from '../i18n';

mountLayout({ activeTool: 'speech-to-text' });
const T = pageText();
const LOCALE = localeTag();

/** Ngôn ngữ nhận dạng phổ biến (mã BCP-47 mà Chrome/Edge/Safari hỗ trợ) */
const LANGS = ['vi-VN', 'en-US', 'en-GB', 'ja-JP', 'zh-CN', 'zh-TW', 'ko-KR', 'es-ES', 'es-MX', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'pt-PT', 'ru-RU', 'tr-TR', 'nl-NL', 'pl-PL', 'uk-UA', 'ar-SA', 'hi-IN', 'bn-IN', 'id-ID', 'ms-MY', 'th-TH', 'fil-PH', 'sv-SE', 'da-DK', 'nb-NO', 'fi-FI', 'cs-CZ', 'sk-SK', 'hu-HU', 'ro-RO', 'bg-BG', 'el-GR', 'hr-HR', 'sr-RS', 'lt-LT', 'lv-LV', 'sl-SI', 'he-IL', 'fa-IR', 'ur-PK', 'ta-IN', 'te-IN', 'mr-IN', 'gu-IN', 'kn-IN', 'ml-IN', 'sw-KE', 'ca-ES'];

interface Rec {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;

const cfg = storage<{ lang: string; text: string; punct: boolean }>('stt', { lang: '', text: '', punct: true });
const display = (code: string) => {
  try { return new Intl.DisplayNames([LOCALE], { type: 'language' }).of(code) || code; } catch { return code; }
};

$('#tool-root').innerHTML = `
  <div class="workspace">
    <section class="panel">
      <label class="field"><span class="field-label">${T('lang', 'Ngôn ngữ bạn nói')}</span>
        <select id="lang">${LANGS.map((l) => `<option value="${l}">${escapeHtml(display(l))} (${l})</option>`).join('')}</select>
      </label>
      <label class="check"><input type="checkbox" id="punct" /><span>${T('punct', 'Tự hiểu lệnh dấu câu khi nói "chấm", "phẩy", "xuống dòng"')}</span></label>
      <div class="actions">
        <button type="button" class="btn btn-primary" id="toggle">${T('start', 'Bắt đầu nói')}</button>
      </div>
      <p class="note" id="status">${T('ready', 'Bấm Bắt đầu nói và cho phép dùng micro.')}</p>
      <p class="error" id="err" hidden></p>
      <p class="note">${T('privacy', 'Chrome và Edge gửi âm thanh tới dịch vụ nhận dạng giọng nói của hãng trình duyệt để chuyển thành chữ; WFTools không nhận, không lưu âm thanh của bạn. Safari có thể nhận dạng ngay trên máy. Firefox chưa hỗ trợ tính năng này.')}</p>
    </section>
    <section class="panel">
      <label class="field"><span class="field-label">${T('result', 'Văn bản')}</span>
        <textarea id="out" rows="14" placeholder="${T('outPh', 'Chữ sẽ hiện ở đây khi bạn nói. Bạn có thể sửa trực tiếp.')}"></textarea>
      </label>
      <p class="note" id="interim" aria-live="polite"></p>
      <div class="actions">
        <button type="button" class="btn" id="copy">${T('copy', 'Sao chép')}</button>
        <button type="button" class="btn" id="dl">${T('download', 'Tải file .txt')}</button>
        <button type="button" class="btn" id="clear">${T('clear', 'Xoá')}</button>
      </div>
    </section>
  </div>
`;

const langSel = $<HTMLSelectElement>('#lang');
const out = $<HTMLTextAreaElement>('#out');
const punct = $<HTMLInputElement>('#punct');
const err = $('#err');
const c0 = cfg.get();
langSel.value = c0.lang || LANGS.find((l) => l === LOCALE) || LANGS.find((l) => l.split('-')[0] === LOCALE.split('-')[0]) || 'en-US';
out.value = c0.text;
punct.checked = c0.punct;
const save = () => cfg.set({ lang: langSel.value, text: out.value.slice(0, 50000), punct: punct.checked });

/** Lệnh dấu câu bằng lời theo ngôn ngữ (chỉ áp dụng khi bật tuỳ chọn) */
// \b không hiểu chữ có dấu nên dùng ranh giới theo chữ cái Unicode
const word = (w: string, eatAfter = false) => new RegExp(`\\s*(?<!\\p{L})(?:${w})(?!\\p{L})${eatAfter ? '\\s*' : ''}`, 'giu');
const COMMANDS: Record<string, [RegExp, string][]> = {
  vi: [[word('chấm hỏi'), '?'], [word('chấm than'), '!'], [word('chấm phẩy'), ';'], [word('hai chấm'), ':'], [word('dấu chấm|chấm'), '.'], [word('dấu phẩy|phẩy'), ','], [word('xuống dòng', true), '\n']],
  en: [[word('question mark'), '?'], [word('exclamation (?:mark|point)'), '!'], [word('semicolon'), ';'], [word('colon'), ':'], [word('full stop|period'), '.'], [word('comma'), ','], [word('new (?:line|paragraph)', true), '\n']],
};
function tidy(s: string): string {
  let r = s;
  if (punct.checked) for (const [re, v] of COMMANDS[langSel.value.split('-')[0]] ?? []) r = r.replace(re, v);
  // Viết hoa chữ đầu câu
  return r.replace(/(^\s*|[.!?]\s+|\n\s*)(\p{Ll})/gu, (_, p: string, c: string) => p + c.toLocaleUpperCase(langSel.value));
}

let rec: Rec | null = null;
let listening = false;
let wantOn = false;
let base = '';

function setUi(on: boolean): void {
  listening = on;
  $('#toggle').textContent = on ? T('stop', 'Dừng') : T('start', 'Bắt đầu nói');
  $('#toggle').classList.toggle('btn-primary', !on);
  $('#status').innerHTML = on ? `<span class="rec-dot" aria-hidden="true"></span>${T('listening', 'Đang nghe… hãy nói rõ ràng, gần micro.')}` : T('ready', 'Bấm Bắt đầu nói và cho phép dùng micro.');
  langSel.disabled = on;
}
const showErr = (m: string) => { err.textContent = m; err.hidden = !m; };

function start(): void {
  showErr('');
  if (!Ctor) { showErr(T('noSupport', 'Trình duyệt này chưa hỗ trợ nhận dạng giọng nói. Hãy dùng Chrome, Edge (máy tính, Android) hoặc Safari (iPhone, Mac).')); return; }
  rec = new Ctor();
  rec.lang = langSel.value;
  rec.continuous = true;
  rec.interimResults = true;
  base = out.value && !/\s$/.test(out.value) ? out.value + ' ' : out.value;
  rec.onresult = (e) => {
    let finalText = '';
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (finalText) {
      base = tidy(base + finalText.trim() + ' ');
      out.value = base;
      save();
    }
    $('#interim').textContent = interim;
  };
  rec.onerror = (e) => {
    const map: Record<string, string> = {
      'not-allowed': T('errMic', 'Micro bị chặn. Bấm biểu tượng ổ khoá cạnh địa chỉ trang, cho phép Micro rồi thử lại.'),
      'service-not-allowed': T('errMic', 'Micro bị chặn. Bấm biểu tượng ổ khoá cạnh địa chỉ trang, cho phép Micro rồi thử lại.'),
      'audio-capture': T('errNoMic', 'Không tìm thấy micro. Hãy cắm micro hoặc tai nghe có micro rồi thử lại.'),
      network: T('errNet', 'Mất kết nối tới dịch vụ nhận dạng giọng nói. Kiểm tra mạng rồi thử lại.'),
      'language-not-supported': T('errLang', 'Ngôn ngữ này chưa được hỗ trợ trên trình duyệt của bạn. Hãy chọn ngôn ngữ khác.'),
    };
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    showErr(map[e.error] ?? T('errOther', 'Có lỗi khi nhận dạng giọng nói. Hãy thử lại.'));
    wantOn = false;
  };
  // Trình duyệt tự dừng sau một lúc im lặng: tự bật lại nếu người dùng chưa bấm Dừng
  rec.onend = () => {
    $('#interim').textContent = '';
    if (wantOn) { try { rec?.start(); return; } catch { /* bỏ qua */ } }
    setUi(false);
  };
  wantOn = true;
  try { rec.start(); setUi(true); } catch { showErr(T('errOther', 'Có lỗi khi nhận dạng giọng nói. Hãy thử lại.')); }
}

$('#toggle').addEventListener('click', () => {
  if (listening) { wantOn = false; rec?.stop(); setUi(false); }
  else start();
});
$('#copy').addEventListener('click', () => { if (out.value) void copyText(out.value); });
$('#dl').addEventListener('click', () => { if (out.value) downloadBlob(new Blob([out.value], { type: 'text/plain;charset=utf-8' }), `${T('fileName', 'giong-noi')}.txt`); });
$('#clear').addEventListener('click', () => { out.value = ''; base = ''; save(); });
out.addEventListener('input', () => { base = out.value; save(); });
langSel.addEventListener('change', save);
punct.addEventListener('change', save);
if (!Ctor) showErr(T('noSupport', 'Trình duyệt này chưa hỗ trợ nhận dạng giọng nói. Hãy dùng Chrome, Edge (máy tính, Android) hoặc Safari (iPhone, Mac).'));
