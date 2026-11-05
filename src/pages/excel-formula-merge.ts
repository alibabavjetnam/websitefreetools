import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml, storage } from '../ui';
import { pageText, t } from '../i18n';
import {
  OutCell, XCell, XSheet, bookToBlob, buildSheetFromCells, cellDisplayText, cellHasValue, detectDataBounds, isDateCell, loadSources, loadXlsx,
} from '../lib/excel-common';
import { bindPicker, fmt, pickerHtml, radioHtml, radioValue, setStatus } from '../lib/excel-ui';
import { EntriesMap, FORMULA_NAMES, createEvaluator, formulaTemplate } from '../calc/excel-formula';

mountLayout({ activeTool: 'excel-formula-merge' });
const T = pageText();
const MAX_CELLS = 30000;

/** [tên hàm, mô tả, ví dụ] */
const HELP: [string, string, string][] = [
  ['FIRST / LAST', T('h.firstlast', 'Chỉ lấy giá trị của nguồn đầu tiên / cuối cùng có chứa dữ liệu'), 'FIRST(A1)'],
  ['MIN / MAX', T('h.minmax', 'Tìm giá trị số nhỏ nhất / lớn nhất trong tất cả các nguồn'), 'MAX(A1)'],
  ['UNIQUE', T('h.unique', 'Lấy danh sách các giá trị, tự động loại bỏ các giá trị trùng lặp'), 'UNIQUE(A1)'],
  ['SUM', T('h.sum', 'Tính tổng tất cả các số thu được từ các nguồn tại ô A1'), 'SUM(A1)'],
  ['COUNT', T('h.count', 'Đếm xem có bao nhiêu nguồn chứa dữ liệu tại ô A1'), 'COUNT(A1)'],
  ['AVERAGE / MEDIAN', T('h.avg', 'Tính giá trị trung bình / trung vị của các số'), 'AVERAGE(A1)'],
  ['GROUP_BY', T('h.group', 'Nhóm các giá trị giống nhau và đếm số lượng mỗi loại'), 'GROUP_BY(A1)'],
  ['IF', T('h.if', 'Kiểm tra điều kiện: đúng lấy giá trị 1, sai lấy giá trị 2'), T('hx.if', 'IF(>0, Đạt, Rớt, A1)\nIF(B1="Nam", Ông, Bà)')],
  ['SUM_IF / COUNT_IF', T('h.sumif', 'Tính tổng / Đếm các giá trị thỏa mãn một điều kiện cho trước'), 'SUM_IF(>5, A1)'],
  ['AVERAGE_IF', T('h.avgif', 'Tính trung bình cộng các giá trị thỏa mãn điều kiện'), 'AVERAGE_IF(>5, A1)'],
  ['ANY / ALL', T('h.anyall', 'Kiểm tra xem có bất kỳ / hoặc tất cả các nguồn thỏa điều kiện không (trả về TRUE/FALSE)'), 'ANY(>0, A1)'],
  ['CONCAT', T('h.concat', 'Nối các văn bản lại với nhau bằng ký tự phân cách (VD: dấu gạch ngang)'), 'CONCAT( - , A1)'],
  ['JOIN_UNIQUE', T('h.join', 'Nối các văn bản nhưng bỏ qua những văn bản trùng lặp'), 'JOIN_UNIQUE( - , A1)'],
  ['TRIM / UPPER', T('h.trim', 'Xóa khoảng trắng thừa ở hai đầu / CHUYỂN THÀNH CHỮ IN HOA'), 'UPPER(A1)'],
  ['REPLACE', T('h.replace', 'Tìm và thay thế một từ/cụm từ cũ thành từ mới'), T('hx.replace', 'REPLACE(cu, moi, A1)')],
  ['MIN_DATE / MAX_DATE', T('h.mindate', 'Tìm ngày cũ nhất (nhỏ nhất) / ngày mới nhất (lớn nhất)'), 'MIN_DATE(A1)'],
  ['YEAR / MONTH', T('h.year', 'Lấy số Năm / số Tháng từ ngày của nguồn đầu tiên có ngày (nhận ngày Excel hoặc chữ dd/mm/yyyy)'), 'YEAR(A1)'],
  ['DATE_RANGE', T('h.range', 'Tạo khoảng thời gian từ ngày nhỏ nhất đến ngày lớn nhất'), 'DATE_RANGE(A1)'],
  ['MISSING / DUPLICATE', T('h.missing', 'Báo "Thiếu" nếu không có dữ liệu / Báo "Trùng" nếu phát hiện lặp dữ liệu'), 'MISSING(A1)'],
  ['VALID / EXISTS', T('h.valid', 'Báo "Hợp lệ" hoặc "TRUE" nếu ô đó có tồn tại dữ liệu'), 'VALID(A1)'],
];
const NEST: [string, string, string][] = [
  ['CONCAT / IF', T('n.1', 'Nối chuỗi và điều kiện logic'), T('nx.1', 'CONCAT(A1, IF(B1="Nam"," - Nam"," - Nữ"), ". ")')],
  ['UPPER / CONCAT', T('n.2', 'Chuyển hoa kết hợp nối chuỗi'), 'UPPER(CONCAT(FIRST(A1), " - "))'],
  ['SUM / COUNT', T('n.3', 'Tính toán số học'), 'SUM(A1)  |  COUNT(A1)'],
];
const helpRows = (rows: [string, string, string][]): string =>
  rows.map(([f, d, x]) => `<tr><td><b>${escapeHtml(f)}</b></td><td>${escapeHtml(d)}</td><td><code>${escapeHtml(x)}</code></td></tr>`).join('');

$('#tool-root').innerHTML = `
  <div class="workspace xl-wide">
    <div class="panel">
      <details>
        <summary class="field-label" style="cursor:pointer">${T('help.title', 'Bảng công thức hỗ trợ')}</summary>
        <div class="table-wrap xl-help"><table class="data-table"><thead><tr><th>${T('help.fn', 'Công thức')}</th><th>${T('help.what', 'Chức năng')}</th><th>${T('help.ex', 'Ví dụ')}</th></tr></thead><tbody>${helpRows(HELP)}</tbody></table></div>
        <p class="field-label" style="margin-top:12px">${T('nest.title', 'Lồng hàm (tối đa 3 tầng)')}</p>
        <div class="table-wrap xl-help"><table class="data-table"><thead><tr><th>${T('help.fn', 'Công thức')}</th><th>${T('help.what', 'Chức năng')}</th><th>${T('help.ex', 'Ví dụ')}</th></tr></thead><tbody>${helpRows(NEST)}</tbody></table></div>
      </details>
      <div class="field"><span class="field-label">${T('type.label', '1. Chọn nguồn dữ liệu')}</span>
        ${radioHtml('ftype', [{ value: 'sheets', label: T('type.sheets', 'Nhiều sheet trong 1 file') }, { value: 'files', label: T('type.files', 'Nhiều file Excel') }])}
      </div>
      <div id="g-sheets">${pickerHtml('one', T('pick.one', '2. Chọn 1 file Excel (file nhiều sheet)'), T('pick.oneHint', 'Thứ tự nguồn (ảnh hưởng FIRST/LAST): theo thứ tự sheet.'), '.xlsx,.xls', false, T('drop', 'Chọn file hoặc kéo thả vào đây'))}</div>
      <div id="g-files" hidden>${pickerHtml('many', T('pick.many', '2. Chọn các file Excel (lấy sheet đầu của mỗi file)'), T('pick.manyHint', 'Thứ tự nguồn (ảnh hưởng FIRST/LAST): theo tên file sắp xếp A-Z.'), '.xlsx,.xls', true, T('drop.many', 'Chọn các file hoặc kéo thả vào đây'))}</div>
      <div class="field"><span class="field-label">${T('topic.label', 'Tên chuyên đề (gõ tên sẽ hiện công thức đã lưu)')}</span>
        <div class="xl-toolbar"><input type="text" id="topic" placeholder="${T('topic.ph', 'VD: Báo cáo tháng')}" style="flex:1;min-width:180px" /><button type="button" class="btn" id="save">${T('save', 'Lưu công thức')}</button></div>
        <p class="note" id="topic-status" style="min-height:1.4em"></p>
      </div>
      <div class="actions"><button type="button" class="btn btn-primary" id="scan">${T('scan', '3. Quét file và hiện bảng công thức')}</button></div>
      <p class="note" id="status" hidden></p>
    </div>
    <section class="panel" id="table-wrap" hidden>
      <div class="xl-toolbar">
        <span class="field-label" style="margin:0">${T('all.label', 'Áp dụng công thức cho tất cả ô:')}</span>
        <select id="all-fn">${FORMULA_NAMES.map((n) => `<option value="${n}">${n}</option>`).join('')}</select>
        <button type="button" class="btn btn-sm" id="apply-all">${T('all.apply', 'Áp dụng')}</button>
      </div>
      <div class="table-wrap xl-table" style="margin-top:10px"><table class="data-table"><thead><tr>
        <th>${T('col.cell', 'Ô')}<input class="xl-filter" id="f-cell" placeholder="${T('f.cell', 'Lọc ô…')}" /></th>
        <th>${T('col.count', 'Số nguồn có dữ liệu')}<input class="xl-filter" id="f-count" placeholder="${T('f.count', 'Lọc số nguồn…')}" /></th>
        <th>${T('col.formula', 'Công thức (hỗ trợ lồng hàm)')}<input class="xl-filter" id="f-formula" placeholder="${T('f.formula', 'Lọc công thức…')}" /></th>
      </tr></thead><tbody id="tbody"></tbody></table></div>
      <div class="actions" style="margin-top:12px"><button type="button" class="btn btn-primary" id="dl">${T('dl', 'Tải file Excel kết quả')}</button></div>
      <p class="note" id="dl-status" hidden></p>
    </section>
  </div>
`;

const oneFiles = bindPicker('one', false);
const manyFiles = bindPicker('many', true);
document.querySelectorAll('input[name="ftype"]').forEach((r) => r.addEventListener('change', () => {
  const sheets = radioValue('ftype') === 'sheets';
  $('#g-sheets').hidden = !sheets;
  $('#g-files').hidden = sheets;
}));

/* ---------- Công thức đã lưu theo chuyên đề ---------- */
interface Saved { maxRow: number; maxCol: number; formulas: Record<string, string> }
const store = storage<Record<string, Saved>>('excel-formulas', {});

let entriesMap: EntriesMap = {};
let bounds = { maxRow: 0, maxCol: 0 };
const inputs = new Map<string, HTMLInputElement>();
let lastTopic: string | null = null;

const hasTable = (): boolean => inputs.size > 0;

function applyFormulas(formulas: Record<string, string>): void {
  inputs.forEach((inp) => { inp.value = ''; });
  Object.entries(formulas).forEach(([ref, f]) => { const inp = inputs.get(ref); if (inp) inp.value = f; });
  filterTable();
}

function topicChanged(): void {
  const name = $<HTMLInputElement>('#topic').value.trim();
  if (!name || name === lastTopic) return; // change + blur cùng bắn: bỏ qua lần gọi lặp
  lastTopic = name;
  const saved = store.get()[name];
  if (!saved) return setStatus('topic-status', fmt(T('topic.new', 'Chuyên đề mới "{name}". Nhập công thức rồi bấm "Lưu công thức".'), { name }), 'ok', true);
  if (hasTable()) {
    applyFormulas(saved.formulas);
    setStatus('topic-status', fmt(T('topic.loaded', 'Đã tải công thức cho chuyên đề "{name}".'), { name }), 'ok', true);
  } else setStatus('topic-status', fmt(T('topic.found', 'Tìm thấy công thức cho "{name}". Sẽ áp dụng sau khi quét file.'), { name }), 'ok', true);
}
$('#topic').addEventListener('change', topicChanged);
$('#topic').addEventListener('blur', topicChanged);
$('#topic').addEventListener('input', () => { lastTopic = null; });

$('#save').addEventListener('click', () => {
  const name = $<HTMLInputElement>('#topic').value.trim();
  if (!name) return setStatus('topic-status', T('save.noName', 'Hãy nhập tên chuyên đề trước khi lưu.'), 'error', true);
  if (!hasTable()) return setStatus('topic-status', T('save.noTable', 'Chưa có bảng công thức. Hãy quét file trước khi lưu.'), 'error', true);
  const formulas: Record<string, string> = {};
  inputs.forEach((inp, ref) => { const v = inp.value.trim(); if (v) formulas[ref] = v; });
  const all = store.get();
  all[name] = { maxRow: bounds.maxRow, maxCol: bounds.maxCol, formulas };
  store.set(all);
  lastTopic = name;
  setStatus('topic-status', fmt(T('save.ok', 'Đã lưu {n} công thức cho chuyên đề "{name}".'), { n: Object.keys(formulas).length, name }), 'ok', true);
});

/* ---------- Quét file, dựng bảng ---------- */
function cellValue(X: Awaited<ReturnType<typeof loadXlsx>>, cell: XCell): unknown {
  if (cell.t === 'e') return cellDisplayText(cell);
  // Ngày đổi sang dd/mm/yyyy để hiển thị đúng và hàm ngày đọc được
  if (isDateCell(X, cell) && typeof cell.v === 'number') return X.SSF.format('dd/mm/yyyy', cell.v);
  return cell.v;
}

function buildTable(X: Awaited<ReturnType<typeof loadXlsx>>, sources: { label: string; ws: XSheet }[]): void {
  const tbody = $('#tbody');
  tbody.innerHTML = '';
  inputs.clear();
  entriesMap = {};
  const frag = document.createDocumentFragment();
  for (let c = 0; c <= bounds.maxCol; c++) {
    for (let r = 0; r <= bounds.maxRow; r++) {
      const ref = X.utils.encode_cell({ r, c });
      const entries: EntriesMap[string] = [];
      sources.forEach(({ label, ws }, src) => {
        const cell = ws[ref] as XCell | undefined;
        if (cellHasValue(cell)) entries.push({ label, value: cellValue(X, cell as XCell), src });
      });
      entriesMap[ref] = entries;
      const tr = document.createElement('tr');
      const td1 = document.createElement('td'); td1.textContent = ref;
      const td2 = document.createElement('td'); td2.textContent = String(entries.length);
      const td3 = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'xl-formula';
      inp.placeholder = fmt(T('formula.ph', 'VD: SUM({ref}) hoặc lồng hàm'), { ref });
      inp.addEventListener('input', () => { if ($<HTMLInputElement>('#f-formula').value) filterTable(); });
      td3.appendChild(inp);
      tr.append(td1, td2, td3);
      frag.appendChild(tr);
      inputs.set(ref, inp);
    }
  }
  tbody.appendChild(frag);
}

function filterTable(): void {
  const fc = $<HTMLInputElement>('#f-cell').value.toUpperCase();
  const fn = $<HTMLInputElement>('#f-count').value.toUpperCase();
  const ff = $<HTMLInputElement>('#f-formula').value.toUpperCase();
  document.querySelectorAll<HTMLTableRowElement>('#tbody tr').forEach((tr) => {
    const inp = tr.querySelector<HTMLInputElement>('input');
    const ok = tr.cells[0].textContent!.toUpperCase().includes(fc) && tr.cells[1].textContent!.toUpperCase().includes(fn) && (inp?.value ?? '').toUpperCase().includes(ff);
    tr.style.display = ok ? '' : 'none';
  });
}
['#f-cell', '#f-count', '#f-formula'].forEach((s) => $(s).addEventListener('input', filterTable));

$('#scan').addEventListener('click', async () => {
  const btn = $<HTMLButtonElement>('#scan');
  btn.disabled = true;
  setStatus('status', T('scanning', 'Đang quét…'), '');
  $('#table-wrap').hidden = true;
  try {
    const X = await loadXlsx();
    const mode = radioValue('ftype') as 'sheets' | 'files';
    const sources = await loadSources(X, mode, mode === 'sheets' ? oneFiles() : manyFiles());
    const b = detectDataBounds(X, sources, false);
    const cells = (b.maxRow + 1) * (b.maxCol + 1);
    if (cells > MAX_CELLS) throw new Error(fmt(T('err.tooMany', 'Bảng có {n} ô, vượt giới hạn {max} ô. Hãy tách bớt dữ liệu rồi thử lại.'), { n: cells, max: MAX_CELLS }));
    bounds = b;
    buildTable(X, sources);
    $('#table-wrap').hidden = false;
    let msg = fmt(T('scan.done', 'Đã quét xong {n} nguồn, phát hiện {cells} ô.'), { n: sources.length, cells });
    const name = $<HTMLInputElement>('#topic').value.trim();
    const saved = name ? store.get()[name] : undefined;
    if (saved) { applyFormulas(saved.formulas); msg += ' ' + fmt(T('scan.applied', 'Đã áp dụng công thức đã lưu của chuyên đề "{name}".'), { name }); }
    setStatus('status', msg, 'ok');
  } catch (e) {
    console.error(e);
    setStatus('status', `${T('err.generic', 'Lỗi')}: ${(e as Error).message}`, 'error');
  } finally {
    btn.disabled = false;
    filterTable();
  }
});

$('#apply-all').addEventListener('click', () => {
  const name = $<HTMLSelectElement>('#all-fn').value;
  document.querySelectorAll<HTMLTableRowElement>('#tbody tr').forEach((tr) => {
    if (tr.style.display === 'none') return;
    const inp = tr.querySelector<HTMLInputElement>('input');
    if (inp) inp.value = formulaTemplate(name, tr.cells[0].textContent as string);
  });
  filterTable();
});

$('#dl').addEventListener('click', async () => {
  const btn = $<HTMLButtonElement>('#dl');
  btn.disabled = true;
  try {
    const X = await loadXlsx();
    const evaluate = createEvaluator(entriesMap, {
      missing: t('lib.excel.missing', 'Thiếu'), duplicate: t('lib.excel.duplicate', 'Trùng'),
      valid: t('lib.excel.valid', 'Hợp lệ'), invalid: t('lib.excel.invalid', 'Không hợp lệ'),
    });
    const rows: OutCell[][] = [];
    for (let r = 0; r <= bounds.maxRow; r++) {
      const row: OutCell[] = [];
      for (let c = 0; c <= bounds.maxCol; c++) {
        const ref = X.utils.encode_cell({ r, c });
        row.push(evaluate(inputs.get(ref)?.value.trim() ?? '', ref) as OutCell);
      }
      rows.push(row);
    }
    downloadBlob(bookToBlob(X, buildSheetFromCells(X, rows), 'Result'), 'formula-merge.xlsx');
    setStatus('dl-status', T('dl.done', 'Hoàn thành! Đã tải xuống file kết quả.'), 'ok');
  } catch (e) {
    console.error(e);
    setStatus('dl-status', `${T('err.generic', 'Lỗi')}: ${(e as Error).message}`, 'error');
  } finally {
    btn.disabled = false;
  }
});
