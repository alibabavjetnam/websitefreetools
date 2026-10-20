import { mountLayout } from '../layout';
import { $, copyText, escapeHtml, setupTabs } from '../ui';

mountLayout({ activeTool: 'dev-tools' });

const root = $('#tool-root');
root.innerHTML = `
  <div class="tabs" role="tablist" aria-label="Chọn tiện ích">
    <button type="button" role="tab" data-tab="json">JSON</button>
    <button type="button" role="tab" data-tab="base64">Base64</button>
    <button type="button" role="tab" data-tab="regex">Regex</button>
  </div>

  <section class="tool-body" data-panel="json">
    <div class="workspace">
      <div class="panel">
        <label class="field">
          <span class="field-label">Dán JSON vào đây</span>
          <textarea id="json-in" class="mono" rows="14" spellcheck="false">{"ten":"WFTools","congCu":["QR","Mã vạch"],"mienPhi":true,"phienBan":2}</textarea>
        </label>
        <div class="row">
          <label class="field" style="flex-direction:row;align-items:center;gap:8px">
            <span class="field-label" style="margin:0">Thụt lề</span>
            <select id="json-indent"><option value="2">2 dấu cách</option><option value="4">4 dấu cách</option><option value="tab">Tab</option></select>
          </label>
          <button type="button" class="btn btn-primary" id="json-format">Định dạng đẹp</button>
          <button type="button" class="btn" id="json-minify">Rút gọn 1 dòng</button>
          <button type="button" class="btn" id="json-sort">Sắp xếp khoá A–Z</button>
        </div>
      </div>
      <div class="panel">
        <p class="code-meta" id="json-status" aria-live="polite"></p>
        <pre class="output" id="json-out"></pre>
        <div class="row"><button type="button" class="btn" id="json-copy">Sao chép kết quả</button></div>
      </div>
    </div>
  </section>

  <section class="tool-body" data-panel="base64" hidden>
    <div class="workspace">
      <div class="panel">
        <label class="field">
          <span class="field-label">Nội dung</span>
          <textarea id="b64-in" class="mono" rows="10" spellcheck="false">Xin chào WFTools</textarea>
        </label>
        <div class="row">
          <button type="button" class="btn btn-primary" id="b64-encode">Mã hoá sang Base64</button>
          <button type="button" class="btn" id="b64-decode">Giải mã Base64</button>
          <label class="check"><input type="checkbox" id="b64-url" /><span>Dạng an toàn cho URL</span></label>
        </div>
      </div>
      <div class="panel">
        <p class="code-meta" id="b64-status" aria-live="polite"></p>
        <pre class="output" id="b64-out"></pre>
        <div class="row"><button type="button" class="btn" id="b64-copy">Sao chép kết quả</button></div>
      </div>
    </div>
  </section>

  <section class="tool-body" data-panel="regex" hidden>
    <div class="panel">
      <div class="form-grid">
        <label class="field span-all">
          <span class="field-label">Biểu thức chính quy</span>
          <input id="re-pattern" class="mono" type="text" spellcheck="false" value="(\\d{2})/(\\d{2})/(\\d{4})" />
        </label>
        <fieldset class="field span-all">
          <legend>Tuỳ chọn</legend>
          <div class="row">
            <label class="check"><input type="checkbox" data-flag="g" checked /><span>Tìm tất cả (g)</span></label>
            <label class="check"><input type="checkbox" data-flag="i" /><span>Không phân biệt hoa thường (i)</span></label>
            <label class="check"><input type="checkbox" data-flag="m" /><span>Nhiều dòng (m)</span></label>
            <label class="check"><input type="checkbox" data-flag="s" /><span>Dấu chấm khớp xuống dòng (s)</span></label>
            <label class="check"><input type="checkbox" data-flag="u" checked /><span>Unicode (u)</span></label>
          </div>
        </fieldset>
        <label class="field span-all">
          <span class="field-label">Văn bản để thử</span>
          <textarea id="re-text" rows="6" spellcheck="false">Hạn nộp hồ sơ 20/10/2026, họp lại 05/11/2026 và nghiệm thu 31/12/2026.</textarea>
        </label>
      </div>
      <p class="code-meta" id="re-status" aria-live="polite"></p>
      <pre class="output re-highlight" id="re-highlight"></pre>
      <div class="table-wrap"><table class="data-table" id="re-matches"></table></div>
    </div>
  </section>
`;
setupTabs(root);

/* ---------------- JSON ---------------- */
const jsonIn = $<HTMLTextAreaElement>('#json-in');
const jsonOut = $('#json-out');
const jsonStatus = $('#json-status');

/** Vị trí lỗi dạng "dòng X, cột Y" từ thông báo của trình duyệt (nếu có số vị trí) */
function jsonErrorPosition(text: string, message: string): string {
  const m = message.match(/position (\d+)/i) ?? message.match(/column (\d+)/i);
  const lineCol = message.match(/line (\d+) column (\d+)/i);
  if (lineCol) return ` (dòng ${lineCol[1]}, cột ${lineCol[2]})`;
  if (!m) return '';
  const pos = Number(m[1]);
  const before = text.slice(0, pos);
  const line = before.split('\n').length;
  const col = pos - before.lastIndexOf('\n');
  return ` (dòng ${line}, cột ${col})`;
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object')
    return Object.fromEntries(Object.keys(v as object).sort((a, b) => a.localeCompare(b)).map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]));
  return v;
}

function runJson(mode: 'format' | 'minify' | 'sort'): void {
  const text = jsonIn.value;
  if (!text.trim()) {
    jsonStatus.textContent = 'Hãy dán nội dung JSON vào ô bên trái.';
    jsonOut.textContent = '';
    return;
  }
  try {
    let data = JSON.parse(text);
    if (mode === 'sort') data = sortKeys(data);
    const indentSel = $<HTMLSelectElement>('#json-indent').value;
    const indent = indentSel === 'tab' ? '\t' : Number(indentSel);
    jsonOut.textContent = mode === 'minify' ? JSON.stringify(data) : JSON.stringify(data, null, indent);
    jsonStatus.innerHTML = '<span class="ok-text">JSON hợp lệ.</span>';
  } catch (e) {
    const msg = (e as Error).message;
    jsonStatus.innerHTML = `<span class="error-text">JSON không hợp lệ${escapeHtml(jsonErrorPosition(text, msg))}: ${escapeHtml(msg)}</span>`;
    jsonOut.textContent = '';
  }
}
$('#json-format').addEventListener('click', () => runJson('format'));
$('#json-minify').addEventListener('click', () => runJson('minify'));
$('#json-sort').addEventListener('click', () => runJson('sort'));
$('#json-copy').addEventListener('click', () => jsonOut.textContent && copyText(jsonOut.textContent));
runJson('format');

/* ---------------- Base64 (hỗ trợ tiếng Việt qua UTF-8) ---------------- */
const b64In = $<HTMLTextAreaElement>('#b64-in');
const b64Out = $('#b64-out');
const b64Status = $('#b64-status');

function encodeBase64(text: string, urlSafe: boolean): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  const out = btoa(bin);
  return urlSafe ? out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : out;
}

function decodeBase64(input: string): string {
  let s = input.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*=*$/.test(s)) throw new Error('Chuỗi có ký tự không thuộc Base64.');
  s += '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

$('#b64-encode').addEventListener('click', () => {
  b64Out.textContent = encodeBase64(b64In.value, $<HTMLInputElement>('#b64-url').checked);
  b64Status.innerHTML = '<span class="ok-text">Đã mã hoá.</span>';
});
$('#b64-decode').addEventListener('click', () => {
  try {
    b64Out.textContent = decodeBase64(b64In.value);
    b64Status.innerHTML = '<span class="ok-text">Đã giải mã.</span>';
  } catch (e) {
    const msg = e instanceof TypeError ? 'Kết quả giải mã không phải văn bản UTF-8 (có thể là file nhị phân).' : (e as Error).message;
    b64Status.innerHTML = `<span class="error-text">Không giải mã được: ${escapeHtml(msg)}</span>`;
    b64Out.textContent = '';
  }
});
$('#b64-copy').addEventListener('click', () => b64Out.textContent && copyText(b64Out.textContent));
$('#b64-encode').click();

/* ---------------- Regex ---------------- */
const MAX_MATCHES = 1000;
const reStatus = $('#re-status');

function runRegex(): void {
  const pattern = $<HTMLInputElement>('#re-pattern').value;
  const text = $<HTMLTextAreaElement>('#re-text').value;
  const flags = [...root.querySelectorAll<HTMLInputElement>('[data-flag]')].filter((c) => c.checked).map((c) => c.dataset.flag).join('');
  const hl = $('#re-highlight');
  const table = $('#re-matches');
  if (!pattern) {
    reStatus.textContent = 'Hãy nhập biểu thức chính quy.';
    hl.textContent = text;
    table.innerHTML = '';
    return;
  }
  let re: RegExp;
  try {
    re = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
  } catch (e) {
    reStatus.innerHTML = `<span class="error-text">Biểu thức lỗi: ${escapeHtml((e as Error).message)}</span>`;
    hl.textContent = text;
    table.innerHTML = '';
    return;
  }
  const matches: RegExpExecArray[] = [];
  for (const m of text.matchAll(re)) {
    matches.push(m as RegExpExecArray);
    if (!flags.includes('g') || matches.length >= MAX_MATCHES) break;
  }

  let html = '';
  let last = 0;
  for (const m of matches) {
    const start = m.index ?? 0;
    html += escapeHtml(text.slice(last, start)) + `<mark>${escapeHtml(m[0]) || '<span class="empty-match">∅</span>'}</mark>`;
    last = start + m[0].length;
  }
  hl.innerHTML = html + escapeHtml(text.slice(last));
  reStatus.innerHTML = matches.length
    ? `<span class="ok-text">Tìm thấy ${matches.length}${matches.length >= MAX_MATCHES ? '+' : ''} kết quả.</span>`
    : 'Không có kết quả khớp.';

  const groupCount = Math.max(0, ...matches.map((m) => m.length - 1));
  const head = `<tr><th>#</th><th>Vị trí</th><th>Khớp</th>${Array.from({ length: groupCount }, (_, i) => `<th>Nhóm ${i + 1}</th>`).join('')}</tr>`;
  table.innerHTML = matches.length
    ? `<thead>${head}</thead><tbody>${matches
        .slice(0, 200)
        .map((m, i) => `<tr><td>${i + 1}</td><td>${m.index}</td><td class="mono">${escapeHtml(m[0])}</td>${Array.from({ length: groupCount }, (_, g) => `<td class="mono">${escapeHtml(m[g + 1] ?? '')}</td>`).join('')}</tr>`)
        .join('')}</tbody>`
    : '';
}
['#re-pattern', '#re-text'].forEach((s) => $(s).addEventListener('input', runRegex));
root.querySelectorAll('[data-flag]').forEach((c) => c.addEventListener('change', runRegex));
runRegex();
