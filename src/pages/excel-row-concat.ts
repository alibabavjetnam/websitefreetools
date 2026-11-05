import { mountLayout } from '../layout';
import { $, downloadBlob } from '../ui';
import { pageText } from '../i18n';
import {
  OutCell, XCell, XSheet, XlsxApi, bookToBlob, buildSheetFromCells, cellHasValue, cellToOutput, detectDataBounds, loadSources, loadXlsx, parseHeaderRows,
} from '../lib/excel-common';
import { bindPicker, fmt, pickerHtml, radioHtml, radioValue, setStatus } from '../lib/excel-ui';

mountLayout({ activeTool: 'excel-row-concat' });
const T = pageText();

$('#tool-root').innerHTML = `
  <div class="workspace xl-wide">
    <div class="panel">
      <p class="note">${T('intro', 'Ghép dọc dữ liệu của nhiều sheet (hoặc sheet đầu của nhiều file) thành một bảng dài, các dòng nối tiếp nhau.')}</p>
      <div class="field"><span class="field-label">${T('type.label', '1. Chọn nguồn dữ liệu')}</span>
        ${radioHtml('ctype', [{ value: 'sheets', label: T('type.sheets', 'Nhiều sheet trong 1 file') }, { value: 'files', label: T('type.files', 'Sheet đầu của nhiều file') }])}
      </div>
      <div id="g-sheets">${pickerHtml('one', T('pick.one', '2. Chọn 1 file Excel (file nhiều sheet)'), T('pick.oneHint', 'Thứ tự nối: đúng thứ tự sheet từ trái qua phải trong file.'), '.xlsx,.xls', false, T('drop', 'Chọn file hoặc kéo thả vào đây'))}</div>
      <div id="g-files" hidden>${pickerHtml('many', T('pick.many', '2. Chọn các file Excel (lấy sheet đầu của mỗi file)'), T('pick.manyHint', 'Thứ tự nối: theo tên file sắp xếp A-Z. Chỉ lấy sheet đầu tiên của mỗi file.'), '.xlsx,.xls', true, T('drop.many', 'Chọn các file hoặc kéo thả vào đây'))}</div>
      <label class="field"><span class="field-label">${T('header.label', 'Số dòng tiêu đề')}</span>
        <input type="number" id="hdr" value="1" min="0" style="width:120px" />
        <span class="field-hint">${T('header.hint', 'Dòng tiêu đề chỉ giữ lại 1 lần ở đầu file kết quả; các nguồn sau tự bỏ số dòng tiêu đề này.')}</span>
      </label>
      <div class="field"><span class="field-label">${T('filter.label', 'Lọc dòng (chỉ áp dụng cho dòng dữ liệu, không áp dụng cho dòng tiêu đề)')}</span>
        <div class="xl-opts">
          <label class="check"><input type="checkbox" id="rm-empty" checked /><span>${T('filter.empty', 'Loại bỏ dòng rỗng')}<small>${T('filter.emptyHint', 'Dòng không có ô nào chứa dữ liệu (ô chỉ có khoảng trắng cũng coi là rỗng).')}</small></span></label>
          <label class="check"><input type="checkbox" id="rm-fempty" checked /><span>${T('filter.fempty', 'Loại bỏ dòng có công thức trả về rỗng')}<small>${T('filter.femptyHint', 'Dòng chỉ chứa các ô công thức có kết quả rỗng (VD: =IF(A5="","",...)), không có ô nào mang giá trị thật.')}</small></span></label>
        </div>
      </div>
      <div class="actions"><button type="button" class="btn btn-primary" id="run">${T('run', 'Nối và tải file kết quả')}</button></div>
      <p class="note" id="status" hidden></p>
    </div>
  </div>
`;

const oneFiles = bindPicker('one', false);
const manyFiles = bindPicker('many', true);
document.querySelectorAll('input[name="ctype"]').forEach((r) => r.addEventListener('change', () => {
  const sheets = radioValue('ctype') === 'sheets';
  $('#g-sheets').hidden = !sheets;
  $('#g-files').hidden = sheets;
}));

/**
 * Đọc sheet thành danh sách dòng, mỗi dòng kèm phân loại:
 *  data: có ít nhất 1 ô mang giá trị thật; empty: không có giá trị và không có công thức;
 *  formulaEmpty: không có giá trị thật nhưng có ô công thức (kết quả rỗng).
 * Luôn đọc từ cột A / dòng 1 để các nguồn thẳng cột với nhau khi nối.
 */
interface RowInfo { values: OutCell[]; kind: 'data' | 'empty' | 'formulaEmpty' }
function readSheetRows(X: XlsxApi, ws: XSheet): RowInfo[] {
  const rows: RowInfo[] = [];
  const bounds = detectDataBounds(X, [{ ws }], true);
  if (!bounds.hasData) return rows;
  for (let r = 0; r <= bounds.maxRow; r++) {
    const values: OutCell[] = [];
    let hasValue = false, hasFormula = false;
    for (let c = 0; c <= bounds.maxCol; c++) {
      const cell = ws[X.utils.encode_cell({ r, c })] as XCell | undefined;
      if (!cell) { values.push(null); continue; }
      if (cell.f) hasFormula = true;
      if (cellHasValue(cell)) { hasValue = true; values.push(cellToOutput(cell)); } else values.push(null);
    }
    rows.push({ values, kind: hasValue ? 'data' : hasFormula ? 'formulaEmpty' : 'empty' });
  }
  return rows;
}

$('#run').addEventListener('click', async () => {
  const btn = $<HTMLButtonElement>('#run');
  btn.disabled = true;
  setStatus('status', T('working', 'Đang xử lý…'), '');
  try {
    const X = await loadXlsx();
    const mode = radioValue('ctype') as 'sheets' | 'files';
    const sources = await loadSources(X, mode, mode === 'sheets' ? oneFiles() : manyFiles());
    const headerRows = parseHeaderRows($<HTMLInputElement>('#hdr').value);
    const removeEmpty = $<HTMLInputElement>('#rm-empty').checked;
    const removeFormulaEmpty = $<HTMLInputElement>('#rm-fempty').checked;

    const result: OutCell[][] = [];
    let removedEmpty = 0, removedFormulaEmpty = 0;
    sources.forEach(({ ws }, idx) => {
      readSheetRows(X, ws).forEach((row, rowIdx) => {
        if (rowIdx < headerRows) { if (idx === 0) result.push(row.values); return; } // tiêu đề chỉ giữ ở nguồn đầu, không bị lọc
        if (removeEmpty && row.kind === 'empty') { removedEmpty++; return; }
        if (removeFormulaEmpty && row.kind === 'formulaEmpty') { removedFormulaEmpty++; return; }
        result.push(row.values);
      });
    });
    if (!result.length) throw new Error(T('err.none', 'Không còn dòng nào sau khi lọc, không tạo file kết quả.'));

    downloadBlob(bookToBlob(X, buildSheetFromCells(X, result), 'Combined'), 'combined-rows.xlsx');
    let msg = fmt(T('done', 'Hoàn thành! Đã nối {n} nguồn theo chiều dọc, tổng cộng {rows} dòng.'), { n: sources.length, rows: result.length });
    if (headerRows > 0 && sources.length > 1) msg += ' ' + fmt(T('done.hdr', 'Đã bỏ {h} dòng tiêu đề lặp lại ở {k} nguồn sau, chỉ giữ 1 lần ở đầu.'), { h: headerRows, k: sources.length - 1 });
    if (removeEmpty) msg += ' ' + fmt(T('done.empty', 'Đã loại {n} dòng rỗng.'), { n: removedEmpty });
    if (removeFormulaEmpty) msg += ' ' + fmt(T('done.fempty', 'Đã loại {n} dòng có công thức trả về rỗng.'), { n: removedFormulaEmpty });
    setStatus('status', msg, 'ok');
  } catch (e) {
    console.error(e);
    setStatus('status', `${T('err.generic', 'Lỗi')}: ${(e as Error).message}`, 'error');
  } finally {
    btn.disabled = false;
  }
});
