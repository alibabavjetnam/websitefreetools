import { mountLayout } from '../layout';
import { $, escapeHtml, setupTabs } from '../ui';
import { checkCss, checkHtml, checkJs, checkJson, type CodeIssue } from '../lib/codetools';

mountLayout({ activeTool: 'code-check' });

type Lang = 'js' | 'html' | 'css' | 'json';
const SAMPLE: Record<Lang, string> = {
  js: `function tong(a, b) {\n  return a + b\n}\nconst ket_qua = tong(2, 3;`,
  html: `<div class="box">\n  <p>Xin chào\n  <ul><li>Một</li></ul>\n</div>`,
  css: `.box {\n  color: #0d6efd\n  margin: 0;\n}`,
  json: `{\n  "ten": "WFTools",\n  "so": 12,\n}`,
};

const root = $('#tool-root');
root.innerHTML = `
  <div class="tabs" role="tablist" aria-label="Chọn ngôn ngữ">
    <button type="button" role="tab" data-tab="js">JavaScript</button>
    <button type="button" role="tab" data-tab="html">HTML</button>
    <button type="button" role="tab" data-tab="css">CSS</button>
    <button type="button" role="tab" data-tab="json">JSON</button>
  </div>
  <div class="panel code-toolbar">
    <label class="check" id="f-module" hidden><input type="checkbox" id="module" /><span>Mã dạng module (có import/export)</span></label>
    <div class="actions"><button type="button" class="btn btn-primary" id="run">Kiểm tra</button></div>
    <div id="verdict" class="check-verdict" aria-live="polite"></div>
  </div>
  <div class="workspace code-workspace">
    <label class="field"><span class="field-label">Mã nguồn</span><textarea id="in" class="mono code-area" rows="20" spellcheck="false"></textarea></label>
    <div class="field"><span class="field-label">Kết quả kiểm tra</span><div id="out" class="issue-box"></div></div>
  </div>
`;

let lang: Lang = 'js';
let timer = 0;

async function run(): Promise<void> {
  const src = $<HTMLTextAreaElement>('#in').value;
  let issues: CodeIssue[] = [];
  try {
    if (lang === 'json') issues = checkJson(src);
    else if (lang === 'css') issues = checkCss(src);
    else if (lang === 'html') issues = checkHtml(src);
    else issues = await checkJs(src, $<HTMLInputElement>('#module').checked);
  } catch (e) {
    issues = [{ line: 1, column: 1, severity: 'error', message: (e as Error).message }];
  }
  render(issues, src);
}

function render(issues: CodeIssue[], src: string): void {
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warns = issues.length - errors;
  const verdict = $('#verdict');
  if (!src.trim()) {
    verdict.innerHTML = '';
    $('#out').innerHTML = '<p class="note issue-empty">Nhập mã để kiểm tra.</p>';
    return;
  }
  if (!issues.length) {
    verdict.innerHTML = '<span class="badge badge-ok">✓ Không phát hiện lỗi</span>';
    $('#out').innerHTML = '<p class="note issue-empty">Mã hợp lệ về cú pháp và cấu trúc.</p>';
    return;
  }
  verdict.innerHTML = `${errors ? `<span class="badge badge-err">${errors} lỗi</span>` : ''}${warns ? `<span class="badge badge-warn">${warns} cảnh báo</span>` : ''}`;
  const lines = src.split('\n');
  $('#out').innerHTML = `<ul class="issue-list">${issues
    .sort((a, b) => a.line - b.line || a.column - b.column)
    .map((i) => {
      const code = lines[i.line - 1] ?? '';
      const caret = ' '.repeat(Math.max(0, i.column - 1)) + '^';
      return `<li class="issue issue--${i.severity}">
        <div class="issue-head"><span class="issue-tag">${i.severity === 'error' ? 'Lỗi' : 'Cảnh báo'}</span><span class="issue-loc">dòng ${i.line}, cột ${i.column}</span></div>
        <div class="issue-msg">${escapeHtml(i.message)}</div>
        ${code.trim() ? `<pre class="issue-code">${escapeHtml(code.length > 200 ? code.slice(0, 200) + '…' : code)}\n<span class="issue-caret">${escapeHtml(caret)}</span></pre>` : ''}
      </li>`;
    })
    .join('')}</ul>`;
}

$<HTMLTextAreaElement>('#in').value = SAMPLE.js;
const schedule = () => { clearTimeout(timer); timer = window.setTimeout(() => void run(), 250); };
$('#run').addEventListener('click', () => void run());
$('#in').addEventListener('input', schedule);
$('#module').addEventListener('change', () => void run());
void run();

setupTabs(root, (tab) => {
  lang = tab as Lang;
  const ta = $<HTMLTextAreaElement>('#in');
  if (!ta.value.trim() || Object.values(SAMPLE).includes(ta.value)) ta.value = SAMPLE[lang];
  $('#f-module').hidden = lang !== 'js';
  void run();
});
