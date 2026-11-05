import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml } from '../ui';
import { pageText } from '../i18n';
import {
  XCell, buildSheetFromCells, bookToBlob, cellDisplayText, cellHasValue, cellToOutput, detectDataBounds, loadSources, loadXlsx, parseHeaderRows, OutCell,
} from '../lib/excel-common';
import { bindPicker, fmt, pickerHtml, radioHtml, radioValue, setStatus } from '../lib/excel-ui';

mountLayout({ activeTool: 'excel-cell-merge' });
const T = pageText();
const MAX_WARN_ROWS = 300;

$('#tool-root').innerHTML = `
  <div class="workspace xl-wide">
    <div class="panel">
      <p class="note">${T('intro', 'Gộp nội dung ô A1 của tất cả các sheet (hoặc sheet đầu của nhiều file) thành một ô A1 chung; tương tự với A2, A3... B1, B2... Nhiều nguồn cùng có dữ liệu ở một ô thì được nối lại, mỗi nguồn một dòng.')}</p>
      <div class="field"><span class="field-label">${T('type.label', '1. Kiểu gộp')}</span>
        ${radioHtml('mtype', [{ value: 'sheets', label: T('type.sheets', 'Gộp các sheet trong 1 file') }, { value: 'files', label: T('type.files', 'Gộp nhiều file Excel') }])}
      </div>
      <div id="g-sheets">${pickerHtml('one', T('pick.one', '2. Chọn 1 file Excel (file nhiều sheet)'), T('pick.oneHint', 'Các sheet được gộp theo thứ tự tab.'), '.xlsx,.xls', false, T('drop', 'Chọn file hoặc kéo thả vào đây'))}</div>
      <div id="g-files" hidden>${pickerHtml('many', T('pick.many', '2. Chọn các file Excel (lấy sheet đầu của mỗi file)'), T('pick.manyHint', 'Thứ tự gộp: theo tên file sắp xếp A-Z.'), '.xlsx,.xls', true, T('drop.many', 'Chọn các file hoặc kéo thả vào đây'))}</div>
      <label class="field"><span class="field-label">${T('header.label', 'Số dòng tiêu đề')}</span>
        <input type="number" id="hdr" value="1" min="0" style="width:120px" />
        <span class="field-hint">${T('header.hint', 'Dòng tiêu đề chỉ lấy từ nguồn đầu tiên, không gộp từ các nguồn sau để tránh lặp chữ.')}</span>
      </label>
      <div class="actions"><button type="button" class="btn btn-primary" id="run">${T('run', 'Gộp và tải file kết quả')}</button></div>
      <p class="note" id="status" hidden></p>
    </div>
    <section class="panel" id="warn-panel" hidden><div id="warn"></div></section>
  </div>
`;

const oneFiles = bindPicker('one', false);
const manyFiles = bindPicker('many', true);
document.querySelectorAll('input[name="mtype"]').forEach((r) => r.addEventListener('change', () => {
  const sheets = radioValue('mtype') === 'sheets';
  $('#g-sheets').hidden = !sheets;
  $('#g-files').hidden = sheets;
}));

interface Warn { cellRef: string; count: number; entries: { label: string; text: string }[] }

function renderWarnings(warnings: Warn[], totalCells: number): void {
  $('#warn-panel').hidden = false;
  const box = $('#warn');
  if (!warnings.length) {
    box.innerHTML = `<p class="note ok">${fmt(T('warn.none', 'Không có ô nào có dữ liệu từ 2 nguồn trở lên (đã kiểm tra {n} ô).'), { n: String(totalCells) })}</p>`;
    return;
  }
  const shown = warnings.slice(0, MAX_WARN_ROWS);
  box.innerHTML = `
    <p class="note warn">${fmt(T('warn.some', 'Có {n} ô chứa dữ liệu từ 2 nguồn trở lên. Dữ liệu các ô này đã được nối lại bằng dấu "." và xuống dòng:'), { n: String(warnings.length) })}</p>
    <div class="table-wrap xl-table"><table class="data-table"><thead><tr><th>${T('col.cell', 'Ô')}</th><th>${T('col.count', 'Số nguồn có dữ liệu')}</th><th>${T('col.detail', 'Chi tiết theo nguồn')}</th></tr></thead><tbody>
      ${shown.map((w) => `<tr><td>${w.cellRef}</td><td>${w.count}</td><td>${escapeHtml(w.entries.map((e) => `${e.label}: ${e.text}`).join(' | '))}</td></tr>`).join('')}
    </tbody></table></div>
    ${warnings.length > shown.length ? `<p class="note">${fmt(T('warn.more', 'Chỉ hiện {n} ô đầu tiên.'), { n: String(shown.length) })}</p>` : ''}`;
}

$('#run').addEventListener('click', async () => {
  const btn = $<HTMLButtonElement>('#run');
  btn.disabled = true;
  setStatus('status', T('working', 'Đang xử lý…'), '');
  $('#warn').innerHTML = '';
  $('#warn-panel').hidden = true;
  try {
    const X = await loadXlsx();
    const mode = radioValue('mtype') as 'sheets' | 'files';
    const sources = await loadSources(X, mode, mode === 'sheets' ? oneFiles() : manyFiles());
    const bounds = detectDataBounds(X, sources, false);
    if (!bounds.hasData) throw new Error(T('err.noData', 'Các nguồn không có ô nào chứa dữ liệu.'));
    const headerRows = parseHeaderRows($<HTMLInputElement>('#hdr').value);

    const rows: OutCell[][] = [];
    const warnings: Warn[] = [];
    for (let r = 0; r <= bounds.maxRow; r++) {
      const row: OutCell[] = [];
      for (let c = 0; c <= bounds.maxCol; c++) {
        const cellRef = X.utils.encode_cell({ r, c });
        const entries: { label: string; cell: XCell; text: string }[] = [];
        for (const { label, ws } of sources) {
          const cell = ws[cellRef] as XCell | undefined;
          if (cellHasValue(cell)) entries.push({ label, cell: cell as XCell, text: cellDisplayText(cell) });
        }
        let merged: OutCell = null;
        if (entries.length) {
          // Dòng tiêu đề chỉ lấy nguồn đầu tiên; ô chỉ có 1 nguồn giữ nguyên kiểu & định dạng
          if (r < headerRows || entries.length === 1) merged = cellToOutput(entries[0].cell);
          else {
            merged = entries.map((e) => e.text).join('.\n');
            warnings.push({ cellRef, count: entries.length, entries });
          }
        }
        row.push(merged);
      }
      rows.push(row);
    }
    downloadBlob(bookToBlob(X, buildSheetFromCells(X, rows), 'Merged'), 'merged-cells.xlsx');
    renderWarnings(warnings, Math.max(bounds.maxRow + 1 - headerRows, 0) * (bounds.maxCol + 1));
    let msg = fmt(T('done', 'Hoàn thành! Đã gộp {n} nguồn, có {w} ô chứa dữ liệu từ 2 nguồn trở lên (đã nối lại).'), { n: String(sources.length), w: String(warnings.length) });
    if (headerRows > 0) msg += ' ' + fmt(T('done.hdr', '{h} dòng tiêu đề chỉ lấy từ nguồn đầu tiên.'), { h: String(headerRows) });
    setStatus('status', msg, 'ok');
  } catch (e) {
    console.error(e);
    setStatus('status', `${T('err.generic', 'Lỗi')}: ${(e as Error).message}`, 'error');
  } finally {
    btn.disabled = false;
  }
});
