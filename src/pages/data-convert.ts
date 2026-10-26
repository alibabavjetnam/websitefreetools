import { mountLayout } from '../layout';
import { $, copyText, downloadBlob, escapeHtml, toast } from '../ui';
import { bindDropzone, baseName, extOf, fmtSize, safeFileName } from '../lib/files';
import { CDN, global, loadScript } from '../lib/cdn';
import { parseXml, XmlError } from '../lib/xml';
import { detectDelimiter, parseCsv, toCsv } from '../lib/csv';
import { inferValue, jsonToTable, jsonToXml, rowsToTable, tableToJson, xmlToJson, type Json, type Table } from '../lib/dataconv';
import { pageText, currentLang } from '../i18n';

mountLayout({ activeTool: 'data-convert' });
const T = pageText();
const LOCALE = ({ en: 'en-US', vi: 'vi-VN', ja: 'ja-JP', zh: 'zh-CN', es: 'es-ES', de: 'de-DE', ru: 'ru-RU', fr: 'fr-FR', pt: 'pt-BR', it: 'it-IT', tr: 'tr-TR', nl: 'nl-NL', ko: 'ko-KR', ar: 'ar-AE-u-nu-latn', hi: 'hi-IN', id: 'id-ID', th: 'th-TH-u-ca-gregory', pl: 'pl-PL', uk: 'uk-UA', bn: 'bn-BD-u-nu-latn' } as Record<string, string>)[currentLang()] || 'en-US';

const MAX_BYTES = 30 * 1024 * 1024;
const MAX_TEXTAREA = 200_000;
const PREVIEW_ROWS = 100;

type Format = 'json' | 'xml' | 'csv' | 'xlsx';
const FORMATS: { id: Format; label: string; ext: string; mime: string }[] = [
  { id: 'json', label: 'JSON', ext: 'json', mime: 'application/json' },
  { id: 'xml', label: 'XML', ext: 'xml', mime: 'application/xml' },
  { id: 'csv', label: 'CSV', ext: 'csv', mime: 'text/csv' },
  { id: 'xlsx', label: 'Excel (.xlsx)', ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
];

/* SheetJS: chỉ khai báo phần dùng tới */
interface Sheet { [cell: string]: unknown }
interface Book { SheetNames: string[]; Sheets: Record<string, Sheet> }
interface XlsxApi {
  read(data: ArrayBuffer, o: { type: 'array'; cellDates?: boolean; dense?: boolean }): Book;
  write(b: Book, o: { type: 'array'; bookType: 'xlsx'; compression?: boolean }): ArrayBuffer;
  utils: {
    sheet_to_json<T>(s: Sheet, o: { header: 1; raw: boolean; defval: string; blankrows: boolean }): T[];
    aoa_to_sheet(rows: unknown[][]): Sheet;
    book_new(): Book;
    book_append_sheet(b: Book, s: Sheet, name: string): void;
  };
}
async function xlsx(): Promise<XlsxApi> {
  await loadScript(CDN.xlsx, 'XLSX');
  return global<XlsxApi>('XLSX');
}

const SAMPLE_VI = `[
  { "ma": "SP001", "ten": "Cà phê sữa", "gia": 29000, "con_hang": true, "nhom": { "ma": "DU", "ten": "Đồ uống" } },
  { "ma": "SP002", "ten": "Bánh mì thịt", "gia": 25000, "con_hang": false, "nhom": { "ma": "DA", "ten": "Đồ ăn" } }
]`;

const root = $('#tool-root');
root.innerHTML = `
  <div class="workspace">
    <div class="panel">
      <div class="panel-title">${T('srcTitle','Dữ liệu nguồn')}</div>
      <label class="dropzone dropzone--sm" id="drop">
        <input type="file" id="file" accept=".json,.xml,.csv,.tsv,.txt,.xlsx,.xls,.xlsm,.ods" />
        <b>${T('drop.title','Chọn file hoặc kéo thả')}</b>
        <span>${T('drop.hint','JSON, XML, CSV, Excel (.xlsx, .xls), dưới 30 MB')}</span>
      </label>
      <p class="note" id="src-info"></p>
      <div class="field-row">
        <label class="field" id="f-src-fmt"><span class="field-label">${T('srcFmt','Định dạng nguồn')}</span>
          <select id="src-fmt"><option value="auto">${T('auto','Tự nhận biết')}</option><option value="json">JSON</option><option value="xml">XML</option><option value="csv">CSV</option></select>
        </label>
        <label class="field" id="f-sheet" hidden><span class="field-label">${T('sheet','Trang tính')}</span><select id="sheet"></select></label>
        <label class="field" id="f-in-delim"><span class="field-label">${T('csvDelim','Dấu phân cách CSV')}</span>
          <select id="in-delim"><option value="auto">${T('auto','Tự nhận biết')}</option><option value=",">${T('delim.comma','Dấu phẩy ,')}</option><option value=";">${T('delim.semicolon','Chấm phẩy ;')}</option><option value="\t">${T('delim.tab','Tab')}</option><option value="|">${T('delim.pipe','Gạch đứng |')}</option></select>
        </label>
      </div>
      <label class="check" id="f-header"><input type="checkbox" id="has-header" checked /><span>${T('header','Dòng đầu là tên cột')}</span></label>
      <label class="field"><span class="field-label">${T('orPaste','Hoặc dán dữ liệu')}</span><textarea id="src" class="mono" rows="14" spellcheck="false">${escapeHtml(T('sample', SAMPLE_VI))}</textarea></label>
    </div>

    <div class="panel">
      <div class="panel-title">${T('result','Kết quả')}</div>
      <fieldset class="field">
        <legend>${T('convertTo','Đổi sang')}</legend>
        <div class="format-list">
          ${FORMATS.map((f, i) => `<label class="format-option"><input type="radio" name="target" value="${f.id}"${i === 2 ? ' checked' : ''} /><span class="format-name">${f.label}</span></label>`).join('')}
        </div>
      </fieldset>
      <div class="field-row">
        <label class="field" data-for="csv"><span class="field-label">${T('outDelim','Dấu phân cách')}</span>
          <select id="out-delim"><option value=",">${T('delim.comma','Dấu phẩy ,')}</option><option value=";">${T('delim.semicolonExcel','Chấm phẩy ; (Excel tiếng Việt)')}</option><option value="\t">${T('delim.tab','Tab')}</option></select>
        </label>
        <label class="field" data-for="xml"><span class="field-label">${T('xmlRoot','Tên thẻ gốc')}</span><input type="text" id="xml-root" value="danh_sach" maxlength="60" /></label>
        <label class="field" data-for="xml"><span class="field-label">${T('xmlItem','Tên thẻ mỗi dòng')}</span><input type="text" id="xml-item" value="dong" maxlength="60" /></label>
        <label class="field" data-for="json"><span class="field-label">${T('indent','Thụt lề')}</span>
          <select id="json-indent"><option value="2">${T('indent.2','2 dấu cách')}</option><option value="4">${T('indent.4','4 dấu cách')}</option><option value="0">${T('indent.0','Viết liền một dòng')}</option></select>
        </label>
      </div>
      <label class="check" data-for="csv"><input type="checkbox" id="bom" checked /><span>${T('bom','Mở đúng tiếng Việt bằng Excel (thêm BOM UTF‑8)')}</span></label>
      <label class="check" data-for="json xml xlsx"><input type="checkbox" id="infer" checked /><span>${T('infer','Tự nhận số và true/false (giữ nguyên mã có số 0 đứng đầu)')}</span></label>
      <div class="actions">
        <button type="button" class="btn btn-primary" id="run">${T('run','Chuyển đổi')}</button>
        <button type="button" class="btn" id="copy" disabled>${T('copy','Sao chép')}</button>
        <button type="button" class="btn" id="dl" disabled>${T('dl','Tải file')}</button>
      </div>
      <p class="error" id="err" hidden></p>
      <p class="note" id="out-info"></p>
      <textarea id="out" class="mono" rows="14" readonly spellcheck="false" aria-label="${T('aria.out','Kết quả chuyển đổi')}"></textarea>
    </div>
  </div>
  <section class="tool-body">
    <div class="panel-title" id="preview-title" hidden>${T('previewTitle','Xem trước dạng bảng')}</div>
    <div class="table-wrap" id="preview"></div>
  </section>
`;

const showErr = (msg: string) => {
  $('#err').textContent = msg;
  $('#err').hidden = !msg;
};
const target = () => (root.querySelector<HTMLInputElement>('input[name="target"]:checked')?.value ?? 'csv') as Format;

/** Excel đã mở: giữ trong bộ nhớ thay vì đổ ra ô dán */
let book: { name: string; data: Book } | null = null;
let srcName = 'du-lieu';
let result: { blob: Blob; text: string | null; name: string } | null = null;

function syncOptions(): void {
  const t = target();
  root.querySelectorAll<HTMLElement>('[data-for]').forEach((el) => (el.hidden = !el.dataset.for!.split(' ').includes(t)));
  const fmt = $<HTMLSelectElement>('#src-fmt').value;
  const csvLike = !!book || fmt === 'csv' || (fmt === 'auto' && guessFormat($<HTMLTextAreaElement>('#src').value) === 'csv');
  $('#f-header').hidden = !csvLike;
  $('#f-in-delim').hidden = !!book || !csvLike;
  $('#f-sheet').hidden = !book;
  $('#f-src-fmt').hidden = !!book;
}

function guessFormat(text: string): 'json' | 'xml' | 'csv' {
  const t = text.replace(/^﻿/, '').trimStart();
  if (t.startsWith('{') || t.startsWith('[')) return 'json';
  if (t.startsWith('<')) return 'xml';
  return 'csv';
}

async function loadFile(files: File[]): Promise<void> {
  const f = files[0];
  if (!f) return;
  showErr('');
  if (f.size > MAX_BYTES) return showErr(`${f.name}: ${T('err.tooBig','lớn hơn 30 MB.')}`);
  const ext = extOf(f.name);
  srcName = safeFileName(baseName(f.name));
  try {
    if (['xlsx', 'xls', 'xlsm', 'ods'].includes(ext)) {
      const X = await xlsx();
      let data: Book;
      try {
        data = X.read(await f.arrayBuffer(), { type: 'array', cellDates: true });
      } catch {
        throw new Error(T('err.xlsxRead','Không đọc được file Excel. File có thể bị hỏng hoặc được đặt mật khẩu.'));
      }
      if (!data.SheetNames.length) throw new Error(T('err.xlsxEmpty','File Excel không có trang tính nào.'));
      book = { name: f.name, data };
      $('#sheet').innerHTML = data.SheetNames.map((n) => `<option>${escapeHtml(n)}</option>`).join('');
      const ta = $<HTMLTextAreaElement>('#src');
      ta.value = '';
      ta.placeholder = `${T('xlsx.using','Đang dùng dữ liệu từ file Excel')} "${f.name}". ${T('xlsx.replaceHint','Dán dữ liệu khác vào đây để thay.')}`;
      if (target() === 'xlsx') (root.querySelector('input[name="target"][value="json"]') as HTMLInputElement).checked = true;
      $('#src-info').textContent = `${f.name} · Excel · ${fmtSize(f.size)} · ${data.SheetNames.length} ${T('sheets','trang tính')}`;
    } else {
      const buf = await f.arrayBuffer();
      if (new Uint8Array(buf.slice(0, 4000)).includes(0)) throw new Error(T('err.notText','File không phải dạng chữ (JSON, XML, CSV).'));
      let text: string;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
      } catch {
        text = new TextDecoder('windows-1258').decode(buf); // CSV xuất từ Excel cũ
      }
      book = null;
      $<HTMLTextAreaElement>('#src').value = text;
      const fmt = ext === 'json' || ext === 'xml' ? ext : ext === 'csv' || ext === 'tsv' ? 'csv' : 'auto';
      $<HTMLSelectElement>('#src-fmt').value = fmt;
      if (ext === 'tsv') $<HTMLSelectElement>('#in-delim').value = '\t';
      if (target() === fmt) (root.querySelector(`input[name="target"][value="${fmt === 'csv' ? 'xlsx' : fmt === 'json' ? 'csv' : 'json'}"]`) as HTMLInputElement).checked = true;
      $('#src-info').textContent = `${f.name} · ${fmtSize(f.size)}`;
    }
    syncOptions();
    await run();
  } catch (e) {
    showErr((e as Error).message);
  }
}

/** Đọc nguồn thành cây JSON hoặc bảng */
async function readSource(): Promise<{ tree?: Json; table?: Table; kind: string }> {
  const hasHeader = $<HTMLInputElement>('#has-header').checked;
  if (book) {
    const X = await xlsx();
    const name = $<HTMLSelectElement>('#sheet').value || book.data.SheetNames[0];
    // raw:false lấy đúng chữ như Excel hiển thị (giữ số 0 đầu, định dạng ngày)
    const rows = X.utils.sheet_to_json<string[]>(book.data.Sheets[name], { header: 1, raw: false, defval: '', blankrows: false });
    return { table: rowsToTable(rows.map((r) => r.map((c) => String(c ?? ''))), hasHeader), kind: `${T('kind.excel','Excel, trang')} "${name}"` };
  }
  const text = $<HTMLTextAreaElement>('#src').value.replace(/^﻿/, '');
  if (!text.trim()) throw new Error(T('err.noData','Chưa có dữ liệu. Hãy chọn file hoặc dán nội dung vào ô bên trái.'));
  const sel = $<HTMLSelectElement>('#src-fmt').value;
  const fmt = sel === 'auto' ? guessFormat(text) : sel;
  if (fmt === 'json') {
    try {
      return { tree: JSON.parse(text) as Json, kind: T('kind.json','JSON') };
    } catch (e) {
      const msg = (e as Error).message;
      const m = /position (\d+)/.exec(msg);
      const line = m ? text.slice(0, Number(m[1])).split('\n').length : Number(/line (\d+)/.exec(msg)?.[1] ?? 0);
      throw new Error(`${T('err.jsonInvalid','JSON không hợp lệ')}${line ? ` ${T('err.atLine','ở dòng')} ${line}` : ''}: ${T('err.jsonHint','kiểm tra dấu phẩy, ngoặc kép, ngoặc nhọn.')}`);
    }
  }
  if (fmt === 'xml') {
    try {
      return { tree: xmlToJson(parseXml(text)), kind: T('kind.xml','XML') };
    } catch (e) {
      throw new Error(e instanceof XmlError ? `${T('err.xmlInvalid','XML không hợp lệ')}: ${e.message}` : T('err.xmlInvalid2','XML không hợp lệ.'));
    }
  }
  const dSel = $<HTMLSelectElement>('#in-delim').value;
  const delim = dSel === 'auto' ? detectDelimiter(text) : dSel;
  const rows = parseCsv(text, delim);
  if (!rows.length) throw new Error(T('err.noRows','Không tìm thấy dòng dữ liệu nào.'));
  const names: Record<string, string> = { ',': T('dn.comma','dấu phẩy'), ';': T('dn.semicolon','chấm phẩy'), '\t': T('dn.tab','tab'), '|': T('dn.pipe','gạch đứng') };
  return { table: rowsToTable(rows, hasHeader), kind: `${T('kind.csv','CSV, phân cách bằng')} ${names[delim] ?? delim}` };
}

function renderPreview(t: Table): void {
  $('#preview-title').hidden = false;
  const rows = t.rows.slice(0, PREVIEW_ROWS);
  $('#preview').innerHTML = `<table class="data-table data-table--compact"><thead><tr><th>#</th>${t.header.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td>${r.map((c) => `<td>${escapeHtml(c.length > 200 ? `${c.slice(0, 200)}…` : c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
    ${t.rows.length > PREVIEW_ROWS ? `<p class="note">${T('preview.showing','Đang xem')} ${PREVIEW_ROWS} ${T('preview.of','trên')} ${t.rows.length.toLocaleString(LOCALE)} ${T('preview.rows','dòng.')}</p>` : ''}`;
}

async function run(): Promise<void> {
  showErr('');
  result = null;
  $<HTMLButtonElement>('#copy').disabled = true;
  $<HTMLButtonElement>('#dl').disabled = true;
  const btn = $<HTMLButtonElement>('#run');
  btn.disabled = true;
  try {
    const src = await readSource();
    const t = target();
    const infer = $<HTMLInputElement>('#infer').checked;
    const table = src.table ?? jsonToTable(src.tree as Json);
    const tree = (): Json => src.tree ?? tableToJson(src.table as Table, infer);
    const fmt = FORMATS.find((f) => f.id === t)!;
    const name = `${srcName}.${fmt.ext}`;
    let text: string | null = null;
    let blob: Blob;
    if (t === 'json') {
      const indent = Number($<HTMLSelectElement>('#json-indent').value);
      text = JSON.stringify(tree(), null, indent || undefined);
      blob = new Blob([text], { type: `${fmt.mime};charset=utf-8` });
    } else if (t === 'xml') {
      text = jsonToXml(tree(), $<HTMLInputElement>('#xml-root').value.trim() || 'root', $<HTMLInputElement>('#xml-item').value.trim() || 'item');
      blob = new Blob([text], { type: `${fmt.mime};charset=utf-8` });
    } else if (t === 'csv') {
      if (!table.header.length) throw new Error(T('err.noColsCsv','Không có cột dữ liệu nào để xuất ra CSV.'));
      text = toCsv([table.header, ...table.rows], $<HTMLSelectElement>('#out-delim').value);
      blob = new Blob([$<HTMLInputElement>('#bom').checked ? '﻿' : '', text], { type: `${fmt.mime};charset=utf-8` });
    } else {
      if (!table.header.length) throw new Error(T('err.noColsXlsx','Không có cột dữ liệu nào để xuất ra Excel.'));
      const X = await xlsx();
      // Ô được ghi dạng giá trị (không phải công thức) nên dữ liệu bắt đầu bằng "=" vẫn an toàn
      const aoa: unknown[][] = [table.header, ...table.rows.map((r) => r.map((c) => (infer ? inferValue(c) : c)))];
      const wb = X.utils.book_new();
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa), 'Du lieu');
      blob = new Blob([X.write(wb, { type: 'array', bookType: 'xlsx', compression: true })], { type: fmt.mime });
    }
    result = { blob, text, name };
    const out = $<HTMLTextAreaElement>('#out');
    out.value = text === null ? '' : text.length > MAX_TEXTAREA ? `${text.slice(0, MAX_TEXTAREA)}\n…` : text;
    out.placeholder = text === null ? T('out.xlsxReady','File Excel đã sẵn sàng, bấm "Tải file" để lưu. Bảng xem trước ở bên dưới.') : '';
    $('#out-info').textContent = `${T('outinfo.source','Nguồn:')} ${src.kind} · ${table.rows.length.toLocaleString(LOCALE)} ${T('outinfo.rows','dòng,')} ${table.header.length} ${T('outinfo.cols','cột')} · ${T('outinfo.result','Kết quả')} ${fmtSize(blob.size)}${text && text.length > MAX_TEXTAREA ? ' ' + T('outinfo.trunc','(ô chỉ hiện phần đầu, tải file để có đầy đủ)') : ''}`;
    $<HTMLButtonElement>('#copy').disabled = text === null;
    $<HTMLButtonElement>('#dl').disabled = false;
    renderPreview(table);
  } catch (e) {
    $<HTMLTextAreaElement>('#out').value = '';
    $('#out-info').textContent = '';
    showErr((e as Error).message);
  } finally {
    btn.disabled = false;
  }
}

$('#run').addEventListener('click', () => void run());
$('#copy').addEventListener('click', () => result?.text && copyText(result.text));
$('#dl').addEventListener('click', () => {
  if (!result) return;
  downloadBlob(result.blob, result.name);
  toast(`${T('toast.dl','Đã tải')} ${result.name}`);
});
$('#src').addEventListener('input', () => {
  srcName = 'du-lieu';
  if (book) {
    book = null;
    $('#src-info').textContent = '';
  }
  syncOptions();
});
root.addEventListener('change', (e) => {
  const id = (e.target as HTMLElement).id;
  if (id === 'file' || id === 'src') return;
  syncOptions();
  if ($<HTMLTextAreaElement>('#src').value.trim() || book) void run();
});
bindDropzone($('#drop'), $<HTMLInputElement>('#file'), (f) => void loadFile(f));
syncOptions();
void run();
