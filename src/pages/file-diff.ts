import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml, toast } from '../ui';
import { bindDropzone, fmtSize } from '../lib/files';
import { fileToText, type HtmlMode } from '../lib/extract';
import { diffText, type DiffResult, type Row, type Segment } from '../calc/diff';
import { pageText, currentLang } from '../i18n';

mountLayout({ activeTool: 'file-diff' });
const T = pageText();
const LOCALE = ({ en: 'en-US', vi: 'vi-VN', ja: 'ja-JP', zh: 'zh-CN', es: 'es-ES', de: 'de-DE' } as Record<string, string>)[currentLang()] || 'en-US';
const nf = (n: number) => n.toLocaleString(LOCALE);

const CONTEXT = 3;
const MAX_RENDER_ROWS = 4000;

const side = (id: 'a' | 'b', title: string, sample: string) => `
  <div class="panel diff-side">
    <div class="panel-title">${title}</div>
    <label class="dropzone dropzone--sm" id="${id}-drop">
      <input type="file" id="${id}-file" accept=".txt,.md,.csv,.json,.xml,.html,.htm,.docx,.pdf,.js,.ts,.css,.sql,.log,.ini,.yml,.yaml,text/*,application/pdf" />
      <b>${T('drop.title','Chọn file hoặc kéo thả')}</b>
      <span>${T('drop.hint','TXT, Word (.docx), HTML, PDF có chữ, mã nguồn… dưới 30 MB')}</span>
    </label>
    <p class="note" id="${id}-info"></p>
    <label class="field"><span class="field-label">${T('orPaste','Hoặc dán nội dung')}</span><textarea id="${id}-text" class="mono" rows="10" spellcheck="false">${sample}</textarea></label>
  </div>`;

const root = $('#tool-root');
root.innerHTML = `
  <div class="workspace diff-inputs">
    ${side('a', T('sideA','Bản A (bản gốc)'), escapeHtml(T('sample.a', 'Hợp đồng mua bán\nBên A: Công ty ABC\nGiá: 29.000 đồng\nThời hạn: 30 ngày\nKý tại Hà Nội')))}
    ${side('b', T('sideB','Bản B (bản mới)'), escapeHtml(T('sample.b', 'Hợp đồng mua bán\nBên A: Công ty ABC Việt Nam\nGiá: 32.000 đồng\nKý tại Hà Nội\nHiệu lực từ ngày ký')))}
  </div>
  <div class="panel diff-options">
    <div class="row">
      <label class="check"><input type="checkbox" id="o-case" /><span>${T('o.case','Bỏ qua chữ hoa, chữ thường')}</span></label>
      <label class="check"><input type="checkbox" id="o-space" /><span>${T('o.space','Bỏ qua khác biệt dấu cách')}</span></label>
      <label class="check"><input type="checkbox" id="o-blank" /><span>${T('o.blank','Bỏ qua dòng trống')}</span></label>
      <label class="check"><input type="checkbox" id="o-only" checked /><span>${T('o.only','Chỉ hiện chỗ khác nhau')}</span></label>
    </div>
    <div class="row">
      <label class="field field--inline"><span class="field-label">${T('o.view','Cách xem')}</span>
        <select id="o-view"><option value="split">${T('view.split','Hai cột song song')}</option><option value="unified">${T('view.unified','Một cột')}</option></select>
      </label>
      <label class="field field--inline"><span class="field-label">${T('o.html','File HTML')}</span>
        <select id="o-html"><option value="text">${T('html.text','So phần chữ hiển thị')}</option><option value="source">${T('html.source','So cả mã nguồn')}</option></select>
      </label>
    </div>
    <div class="actions">
      <button type="button" class="btn btn-primary" id="run">${T('run','So sánh')}</button>
      <button type="button" class="btn" id="swap">${T('swap','Đổi chỗ A ↔ B')}</button>
      <button type="button" class="btn" id="report" disabled>${T('report','Tải báo cáo (.html)')}</button>
    </div>
    <p class="error" id="err" hidden></p>
  </div>
  <div class="stat-grid" id="summary"></div>
  <div class="diff-out" id="out"></div>
`;

const showErr = (msg: string) => {
  $('#err').textContent = msg;
  $('#err').hidden = !msg;
};

/** File gốc của từng bên, đọc lại khi đổi cách so HTML */
const files: Record<'a' | 'b', File | null> = { a: null, b: null };
const htmlMode = () => $<HTMLSelectElement>('#o-html').value as HtmlMode;

async function loadSide(id: 'a' | 'b', file: File): Promise<void> {
  showErr('');
  $(`#${id}-info`).textContent = `${T('reading','Đang đọc')} ${file.name}…`;
  try {
    const { text, kind } = await fileToText(file, htmlMode());
    files[id] = file;
    $<HTMLTextAreaElement>(`#${id}-text`).value = text;
    $(`#${id}-info`).textContent = `${file.name} · ${kind} · ${fmtSize(file.size)} · ${nf(text.split('\n').length)} ${T('rows','dòng')}`;
  } catch (e) {
    files[id] = null;
    $(`#${id}-info`).textContent = '';
    showErr(`${file.name}: ${(e as Error).message}`);
  }
}

for (const id of ['a', 'b'] as const) {
  bindDropzone($(`#${id}-drop`), $<HTMLInputElement>(`#${id}-file`), (f) => void loadSide(id, f[0]));
  // Người dùng sửa tay nội dung thì không còn gắn với file nữa
  $(`#${id}-text`).addEventListener('input', () => {
    if (files[id]) $(`#${id}-info`).textContent += ' ' + T('editedManually','(đã sửa tay)');
    files[id] = null;
  });
}
$('#o-html').addEventListener('change', async () => {
  for (const id of ['a', 'b'] as const) {
    const f = files[id];
    if (f && /\.html?$/i.test(f.name)) await loadSide(id, f);
  }
});

const segHtml = (segs: Segment[] | undefined) =>
  (segs ?? []).map((s) => (s.op === 'equal' ? escapeHtml(s.text) : s.op === 'delete' ? `<del>${escapeHtml(s.text)}</del>` : `<ins>${escapeHtml(s.text)}</ins>`)).join('') || '&nbsp;';

/** Chọn dòng hiển thị: khi chỉ xem chỗ khác, giữ vài dòng giống xung quanh và gộp phần còn lại */
function visibleRows(rows: Row[], onlyChanges: boolean): (Row | { gap: number })[] {
  if (!onlyChanges) return rows;
  const keep = new Uint8Array(rows.length);
  rows.forEach((r, i) => {
    if (r.kind === 'equal') return;
    for (let k = Math.max(0, i - CONTEXT); k <= Math.min(rows.length - 1, i + CONTEXT); k++) keep[k] = 1;
  });
  const out: (Row | { gap: number })[] = [];
  let gap = 0;
  rows.forEach((r, i) => {
    if (keep[i]) {
      if (gap) out.push({ gap });
      gap = 0;
      out.push(r);
    } else gap++;
  });
  if (gap) out.push({ gap });
  return out;
}

const KIND_LABEL: Record<Row['kind'], string> = { equal: '', change: T('k.change','Sửa'), insert: T('k.insert','Thêm'), delete: T('k.delete','Xoá') };

function renderTable(res: DiffResult, view: 'split' | 'unified', onlyChanges: boolean, limit = MAX_RENDER_ROWS): string {
  const items = visibleRows(res.rows, onlyChanges);
  const shown = items.slice(0, limit);
  const gapRow = (n: number, cols: number) => `<tr class="diff-gap"><td colspan="${cols}">··· ${nf(n)} ${T('sameRows','dòng giống nhau')} ···</td></tr>`;
  let body: string;
  if (view === 'split') {
    body = shown
      .map((r) => ('gap' in r ? gapRow(r.gap, 4) : `<tr class="diff-${r.kind}" title="${KIND_LABEL[r.kind]}">
          <td class="ln">${r.leftNo ?? ''}</td><td class="code${r.left ? '' : ' empty'}">${r.left ? segHtml(r.left) : ''}</td>
          <td class="ln">${r.rightNo ?? ''}</td><td class="code${r.right ? '' : ' empty'}">${r.right ? segHtml(r.right) : ''}</td></tr>`))
      .join('');
    body = `<colgroup><col class="ln-col" /><col /><col class="ln-col" /><col /></colgroup><tbody>${body}</tbody>`;
  } else {
    body = shown
      .map((r) => {
        if ('gap' in r) return gapRow(r.gap, 4);
        if (r.kind === 'equal') return `<tr class="diff-equal"><td class="ln">${r.leftNo}</td><td class="ln">${r.rightNo}</td><td class="sign"></td><td class="code">${segHtml(r.left)}</td></tr>`;
        const del = r.left ? `<tr class="diff-delete"><td class="ln">${r.leftNo}</td><td class="ln"></td><td class="sign">−</td><td class="code">${segHtml(r.left)}</td></tr>` : '';
        const ins = r.right ? `<tr class="diff-insert"><td class="ln"></td><td class="ln">${r.rightNo}</td><td class="sign">+</td><td class="code">${segHtml(r.right)}</td></tr>` : '';
        return del + ins;
      })
      .join('');
    body = `<colgroup><col class="ln-col" /><col class="ln-col" /><col class="sign-col" /><col /></colgroup><tbody>${body}</tbody>`;
  }
  const more = items.length > shown.length ? `<p class="note">${T('onlyShowing','Chỉ hiển thị')} ${nf(MAX_RENDER_ROWS)} ${T('firstRows','dòng đầu. Tải báo cáo để xem toàn bộ.')}</p>` : '';
  return `<div class="table-wrap"><table class="diff-table diff-${view}">${body}</table></div>${more}`;
}

let last: DiffResult | null = null;

function run(): void {
  showErr('');
  const a = $<HTMLTextAreaElement>('#a-text').value;
  const b = $<HTMLTextAreaElement>('#b-text').value;
  if (!a.trim() && !b.trim()) return showErr(T('err.both','Hãy chọn file hoặc dán nội dung vào cả hai bên.'));
  try {
    last = diffText(a, b, {
      ignoreCase: $<HTMLInputElement>('#o-case').checked,
      ignoreWhitespace: $<HTMLInputElement>('#o-space').checked,
      ignoreBlankLines: $<HTMLInputElement>('#o-blank').checked,
    });
  } catch (e) {
    last = null;
    $('#out').innerHTML = '';
    $('#summary').innerHTML = '';
    return showErr((e as Error).message);
  }
  const r = last;
  const diffCount = r.added + r.removed + r.changed;
  $('#summary').innerHTML = `
    <div class="stat stat--main"><span class="stat-label">${T('conclusion','Kết luận')}</span><span class="stat-value">${diffCount ? `${nf(diffCount)} ${T('diffRows','dòng khác nhau')}` : T('identical','Giống hệt nhau')}</span></div>
    <div class="stat"><span class="stat-label">${T('rowsChanged','Dòng sửa')}</span><span class="stat-value diff-c-change">${nf(r.changed)}</span></div>
    <div class="stat"><span class="stat-label">${T('rowsAdded','Dòng thêm')}</span><span class="stat-value diff-c-insert">${nf(r.added)}</span></div>
    <div class="stat"><span class="stat-label">${T('rowsRemoved','Dòng xoá')}</span><span class="stat-value diff-c-delete">${nf(r.removed)}</span></div>
    <div class="stat"><span class="stat-label">${T('rowsSame','Dòng giống')}</span><span class="stat-value">${nf(r.same)}</span></div>`;
  $('#out').innerHTML = diffCount || !$<HTMLInputElement>('#o-only').checked
    ? renderTable(r, $<HTMLSelectElement>('#o-view').value as 'split' | 'unified', $<HTMLInputElement>('#o-only').checked)
    : `<p class="note">${T('sameByOpts','Hai bản có nội dung giống nhau theo các tuỳ chọn đã chọn.')}</p>`;
  $<HTMLButtonElement>('#report').disabled = false;
}

$('#run').addEventListener('click', run);
['#o-view', '#o-only'].forEach((s) => $(s).addEventListener('change', () => last && run()));
['#o-case', '#o-space', '#o-blank'].forEach((s) => $(s).addEventListener('change', () => last && run()));
$('#swap').addEventListener('click', () => {
  const ta = $<HTMLTextAreaElement>('#a-text');
  const tb = $<HTMLTextAreaElement>('#b-text');
  [ta.value, tb.value] = [tb.value, ta.value];
  [files.a, files.b] = [files.b, files.a];
  const ia = $('#a-info');
  const ib = $('#b-info');
  [ia.textContent, ib.textContent] = [ib.textContent, ia.textContent];
  if (last) run();
});

$('#report').addEventListener('click', () => {
  if (!last) return;
  const nameA = files.a?.name ?? T('nameA','Bản A');
  const nameB = files.b?.name ?? T('nameB','Bản B');
  const table = renderTable(last, 'split', $<HTMLInputElement>('#o-only').checked, Infinity);
  // Báo cáo tự chứa: có CSS riêng để mở bằng trình duyệt bất kỳ
  const html = `<!doctype html><html lang="${currentLang()}"><head><meta charset="utf-8"><title>${T('rpt.compare','So sánh')} ${escapeHtml(nameA)} - ${escapeHtml(nameB)}</title>
<style>body{font:14px/1.5 system-ui,sans-serif;color:#16233a;margin:24px}table{border-collapse:collapse;width:100%;table-layout:fixed}td{vertical-align:top;padding:1px 8px;font-family:ui-monospace,Consolas,monospace;white-space:pre-wrap;word-break:break-word}
.ln{width:48px;color:#8a94a6;text-align:right;user-select:none}.diff-change .code{background:#fff8e1}.diff-insert .code{background:#e6f7ee}.diff-delete .code{background:#fdecec}.empty{background:#f3f4f6!important}
ins{background:#a8e6c1;text-decoration:none}del{background:#f5b5b5}.diff-gap td{text-align:center;color:#8a94a6;background:#f6f8fb}</style></head>
<body><h1>${T('rpt.compare','So sánh')}: ${escapeHtml(nameA)} ↔ ${escapeHtml(nameB)}</h1><p>${T('k.change','Sửa')} ${last.changed} · ${T('k.insert','Thêm')} ${last.added} · ${T('k.delete','Xoá')} ${last.removed} · ${T('rpt.same','Giống')} ${last.same} ${T('rows','dòng')}. ${T('rpt.by','Tạo bởi')} websitefreetools.com</p>${table}</body></html>`;
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), T('fn.report', 'so-sanh.html'));
  toast(T('toast.report','Đã tải báo cáo so sánh'));
});

run();
