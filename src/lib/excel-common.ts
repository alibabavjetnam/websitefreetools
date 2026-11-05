/**
 * Phần dùng chung của nhóm công cụ xử lý dữ liệu Excel (gộp ô, nối dòng, trộn công thức, điền Word).
 * Đọc/ghi .xlsx bằng SheetJS (nạp từ CDN khi bấm xử lý).
 */
import { CDN, global, loadScript } from './cdn';
import { t, tf } from '../i18n';

export interface XCell { v?: unknown; t?: string; w?: string; z?: string; f?: string }
export type XSheet = Record<string, unknown>;
export interface XBook { SheetNames: string[]; Sheets: Record<string, XSheet> }
export interface XlsxApi {
  read(data: Uint8Array, o: { type: 'array'; cellNF?: boolean; dateNF?: string }): XBook;
  write(b: XBook, o: { type: 'array'; bookType: 'xlsx'; compression?: boolean }): ArrayBuffer;
  SSF: { is_date(fmt: string): boolean; format(fmt: string, v: number): string };
  utils: {
    sheet_to_json<R>(s: XSheet, o: { header: 1; raw: boolean; defval: string }): R[];
    aoa_to_sheet(rows: unknown[][]): XSheet;
    book_new(): XBook;
    book_append_sheet(b: XBook, s: XSheet, name: string): void;
    encode_cell(c: { r: number; c: number }): string;
    decode_cell(a: string): { r: number; c: number };
  };
}

export async function loadXlsx(): Promise<XlsxApi> {
  await loadScript(CDN.xlsx, 'XLSX');
  return global<XlsxApi>('XLSX');
}

export const MAX_EXCEL_BYTES = 40 * 1024 * 1024;

export function readFileBytes(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(new Error(tf('lib.excel.readFail', 'Không đọc được file {name}.', { name: file.name })));
    r.readAsArrayBuffer(file);
  });
}

/** cellNF giữ định dạng số/ngày của ô; dateNF dùng kiểu ngày/tháng/năm thay vì m/d/yy của Mỹ */
export function readWorkbook(X: XlsxApi, buffer: ArrayBuffer): XBook {
  try {
    return X.read(new Uint8Array(buffer), { type: 'array', cellNF: true, dateNF: 'dd/mm/yyyy' });
  } catch {
    throw new Error(t('lib.excel.badFile', 'File Excel không đúng định dạng hoặc bị hỏng.'));
  }
}

/** Thứ tự chọn file trong hộp thoại không ổn định giữa các trình duyệt, nên luôn sắp tên file A-Z */
export function sortFilesByName(files: File[]): File[] {
  return [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

export interface Source { label: string; ws: XSheet }

/** Nguồn dữ liệu: các sheet của 1 file (theo thứ tự tab) hoặc sheet đầu tiên của nhiều file (theo tên A-Z) */
export async function loadSources(X: XlsxApi, mode: 'sheets' | 'files', files: File[]): Promise<Source[]> {
  const sources: Source[] = [];
  if (mode === 'sheets') {
    if (!files.length) throw new Error(t('lib.excel.pickOne', 'Hãy chọn 1 file Excel trước.'));
    const wb = readWorkbook(X, await readFileBytes(files[0]));
    for (const name of wb.SheetNames || []) if (wb.Sheets[name]) sources.push({ label: name, ws: wb.Sheets[name] });
  } else {
    if (!files.length) throw new Error(t('lib.excel.pickMany', 'Hãy chọn ít nhất 1 file Excel trước.'));
    for (const file of sortFilesByName(files)) {
      const wb = readWorkbook(X, await readFileBytes(file));
      const name = (wb.SheetNames || [])[0];
      if (name && wb.Sheets[name]) sources.push({ label: file.name, ws: wb.Sheets[name] });
    }
  }
  if (!sources.length) throw new Error(t('lib.excel.noSheet', 'Không tìm thấy trang tính nào có dữ liệu.'));
  return sources;
}

export const isBlank = (v: unknown): boolean => v === undefined || v === null || String(v).trim() === '';
export const cellHasValue = (c: unknown): boolean => !!c && !isBlank((c as XCell).v);

export function isDateCell(X: XlsxApi, cell: XCell): boolean {
  if (cell.t === 'd') return true;
  return cell.t === 'n' && typeof cell.z === 'string' && X.SSF.is_date(cell.z);
}

/** Chữ đang hiển thị trong Excel (đúng định dạng số/ngày), dùng khi phải nối nhiều giá trị thành chuỗi */
export function cellDisplayText(cell: XCell | undefined): string {
  if (!cell || !cellHasValue(cell)) return '';
  if (cell.w !== undefined && cell.w !== null && String(cell.w).trim() !== '') return String(cell.w);
  return String(cell.v);
}

export type OutCell = null | string | number | boolean | { v: unknown; z?: string };

/** Giá trị ghi ra file kết quả: giữ giá trị gốc + định dạng. Ô lỗi (#DIV/0!...) lấy chữ hiển thị. */
export function cellToOutput(cell: XCell | undefined): OutCell {
  if (!cell || !cellHasValue(cell)) return null;
  if (cell.t === 'e') return cellDisplayText(cell);
  return { v: cell.v, z: cell.z };
}

/** rows: mảng 2 chiều; null/'' = ô trống (không tạo ô, tránh ô chuỗi rỗng làm sai COUNTA) */
export function buildSheetFromCells(X: XlsxApi, rows: OutCell[][]): XSheet {
  const aoa = rows.map((r) => r.map((c) => {
    if (c === undefined || c === null || c === '') return null;
    if (typeof c === 'object') return (c as { v: unknown }).v;
    return c;
  }));
  const ws = X.utils.aoa_to_sheet(aoa);
  rows.forEach((r, ri) => r.forEach((c, ci) => {
    if (c && typeof c === 'object') {
      const z = (c as { z?: string }).z;
      if (z && z !== 'General') {
        const out = ws[X.utils.encode_cell({ r: ri, c: ci })] as XCell | undefined;
        if (out && out.t === 'n') out.z = z;
      }
    }
  }));
  return ws;
}

/**
 * Ô cuối cùng thực sự có dữ liệu (không tin !ref vì hay bị phình do định dạng thừa,
 * và không dừng khi gặp nhiều dòng trống để không mất dữ liệu phía dưới).
 */
export function detectDataBounds(X: XlsxApi, sources: { ws: XSheet }[], includeFormulaCells: boolean): { maxRow: number; maxCol: number; hasData: boolean } {
  let maxRow = -1, maxCol = -1;
  for (const { ws } of sources) {
    for (const key of Object.keys(ws)) {
      if (key[0] === '!') continue;
      const cell = ws[key] as XCell;
      if (!cellHasValue(cell) && !(includeFormulaCells && cell && cell.f)) continue;
      const pos = X.utils.decode_cell(key);
      if (pos.r > maxRow) maxRow = pos.r;
      if (pos.c > maxCol) maxCol = pos.c;
    }
  }
  return { maxRow: Math.max(maxRow, 0), maxCol: Math.max(maxCol, 0), hasData: maxRow >= 0 };
}

export function bookToBlob(X: XlsxApi, ws: XSheet, sheetName: string): Blob {
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, sheetName);
  const data = X.write(wb, { type: 'array', bookType: 'xlsx', compression: true });
  return new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function parseHeaderRows(raw: string): number {
  const n = parseInt(raw, 10);
  return Number.isNaN(n) || n < 0 ? 0 : n;
}
