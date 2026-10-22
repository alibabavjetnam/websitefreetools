import { mountLayout } from '../layout';
import { $, copyText, downloadBlob, setupTabs, toast } from '../ui';
import { loadBeautify } from '../lib/codetools';
import { pageText } from '../i18n';

mountLayout({ activeTool: 'code-format' });
const T = pageText();

type Lang = 'js' | 'html' | 'css' | 'json';
const EXT: Record<Lang, string> = { js: 'js', html: 'html', css: 'css', json: 'json' };
const SAMPLE: Record<Lang, string> = {
  js: T('sample.js', `function chao(ten){console.log("Xin chào "+ten)}\nconst ds=[1,2,3].map(x=>x*2);chao("WFTools")`),
  html: T('sample.html', `<ul><li>Một</li><li>Hai</li></ul><p class="note">Xin chào</p>`),
  css: `.box{display:flex;gap:8px;color:#0d6efd}a:hover{text-decoration:underline}`,
  json: T('sample.json', `{"ten":"WFTools","cong_cu":["QR","Mã vạch"],"mien_phi":true}`),
};

const root = $('#tool-root');
root.innerHTML = `
  <div class="tabs" role="tablist" aria-label="${T('aria.lang','Chọn ngôn ngữ')}">
    <button type="button" role="tab" data-tab="js">JavaScript</button>
    <button type="button" role="tab" data-tab="html">HTML</button>
    <button type="button" role="tab" data-tab="css">CSS</button>
    <button type="button" role="tab" data-tab="json">JSON</button>
  </div>
  <div class="panel code-toolbar">
    <label class="field field--inline"><span class="field-label">${T('indent','Thụt lề')}</span>
      <select id="indent"><option value="2">${T('indent.2','2 dấu cách')}</option><option value="4">${T('indent.4','4 dấu cách')}</option><option value="tab">${T('indent.tab','Tab')}</option></select>
    </label>
    <label class="check"><input type="checkbox" id="minify" /><span>${T('minify','Nén lại (một dòng, bỏ khoảng trắng)')}</span></label>
    <div class="actions">
      <button type="button" class="btn btn-primary" id="run">${T('run','Định dạng')}</button>
      <button type="button" class="btn" id="copy">${T('copy','Sao chép')}</button>
      <button type="button" class="btn" id="dl">${T('dl','Tải file')}</button>
    </div>
  </div>
  <div class="workspace code-workspace">
    <label class="field"><span class="field-label">${T('source','Mã nguồn')}</span><textarea id="in" class="mono code-area" rows="20" spellcheck="false"></textarea></label>
    <label class="field"><span class="field-label">${T('result','Kết quả')}</span><textarea id="out" class="mono code-area" rows="20" spellcheck="false" readonly></textarea></label>
  </div>
  <p class="error" id="err" hidden></p>
`;

let lang: Lang = 'js';

const showErr = (msg: string) => {
  $('#err').textContent = msg;
  $('#err').hidden = !msg;
};

function minifyJson(text: string): string {
  return JSON.stringify(JSON.parse(text));
}
function minifyCss(text: string): string {
  // Bỏ ghi chú và khoảng trắng thừa; giữ chuỗi nguyên vẹn
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .replace(/\s+/g, ' ')
    .trim();
}

async function run(): Promise<void> {
  showErr('');
  const src = $<HTMLTextAreaElement>('#in').value;
  if (!src.trim()) { $<HTMLTextAreaElement>('#out').value = ''; return; }
  const indent = $<HTMLSelectElement>('#indent').value;
  const minify = $<HTMLInputElement>('#minify').checked && lang !== 'html';
  const size = indent === 'tab' ? 1 : Number(indent);
  const opts = { indent_size: size, indent_with_tabs: indent === 'tab', end_with_newline: false, preserve_newlines: true, max_preserve_newlines: 2 };
  try {
    let out: string;
    if (lang === 'json') {
      const parsed = JSON.parse(src);
      out = minify ? minifyJson(src) : JSON.stringify(parsed, null, indent === 'tab' ? '\t' : size);
    } else if (minify && lang === 'css') {
      out = minifyCss(src);
    } else if (minify && lang === 'js') {
      const b = await loadBeautify();
      // js-beautify không nén; dồn các dòng lại một cách an toàn tối thiểu
      out = b.js(src, { ...opts, indent_size: 0, preserve_newlines: false }).replace(/\n\s*/g, ' ').replace(/ ?([{};,]) ?/g, '$1').trim();
    } else {
      const b = await loadBeautify();
      out = lang === 'js' ? b.js(src, opts) : lang === 'css' ? b.css(src, opts) : b.html(src, { ...opts, indent_inner_html: true });
    }
    $<HTMLTextAreaElement>('#out').value = out;
  } catch (e) {
    const msg = (e as Error).message;
    showErr(lang === 'json' ? `${T('err.json','JSON không hợp lệ')}: ${msg}. ${T('err.jsonHint','Hãy dùng công cụ Kiểm tra lỗi để tìm vị trí.')}` : `${T('err.format','Không định dạng được')}: ${msg}`);
    $<HTMLTextAreaElement>('#out').value = '';
  }
}

$<HTMLTextAreaElement>('#in').value = SAMPLE.js;
$('#run').addEventListener('click', () => void run());
$('#in').addEventListener('input', () => void run());
root.querySelector('#indent')!.addEventListener('change', () => void run());
$('#minify').addEventListener('change', () => void run());
$('#copy').addEventListener('click', () => {
  const v = $<HTMLTextAreaElement>('#out').value;
  if (v) void copyText(v);
});
$('#dl').addEventListener('click', () => {
  const v = $<HTMLTextAreaElement>('#out').value;
  if (!v) return;
  downloadBlob(new Blob([v], { type: 'text/plain;charset=utf-8' }), `dinh-dang.${EXT[lang]}`);
  toast(T('toast.dl','Đã tải file'));
});
void run();

setupTabs(root, (tab) => {
  lang = tab as Lang;
  const ta = $<HTMLTextAreaElement>('#in');
  if (!ta.value.trim() || Object.values(SAMPLE).includes(ta.value)) ta.value = SAMPLE[lang];
  $<HTMLInputElement>('#minify').parentElement!.hidden = lang === 'html';
  void run();
});
