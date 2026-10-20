/** Tạo, đọc, ghi bảng tính Google Sheets trong thư mục "WFTools" của người dùng */
import { gfetch } from './auth';

const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const SHEET_MIME = 'application/vnd.google-apps.spreadsheet';

interface DriveFile { id: string; name: string; webViewLink?: string }

/** Tìm file do WFTools tạo theo nhãn appProperties (quyền drive.file chỉ thấy file của chính WFTools) */
async function findByTag(tag: string, mime: string): Promise<DriveFile | null> {
  const q = `appProperties has { key='wft' and value='${tag}' } and mimeType='${mime}' and trashed=false`;
  const res = await gfetch<{ files: DriveFile[] }>(`${DRIVE}?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)&pageSize=1&orderBy=createdTime`);
  return res.files[0] ?? null;
}

let folderPromise: Promise<string> | null = null;
function ensureFolder(): Promise<string> {
  folderPromise ??= (async () => {
    const found = await findByTag('folder', FOLDER_MIME);
    if (found) return found.id;
    const created = await gfetch<DriveFile>(`${DRIVE}?fields=id`, {
      method: 'POST',
      body: JSON.stringify({ name: 'WFTools', mimeType: FOLDER_MIME, appProperties: { wft: 'folder' } }),
    });
    return created.id;
  })().catch((e) => {
    folderPromise = null;
    throw e;
  });
  return folderPromise;
}

export interface SheetSpec {
  name: string;
  header: string[];
}

export interface SpreadsheetRef { id: string; url: string }

/** Tìm bảng tính đã có của công cụ (không tạo mới) */
export async function findSpreadsheet(tag: string, sheets: SheetSpec[]): Promise<SpreadsheetRef | null> {
  const found = await findByTag(tag, SHEET_MIME);
  if (!found) return null;
  await ensureSheets(found.id, sheets);
  return { id: found.id, url: found.webViewLink ?? `https://docs.google.com/spreadsheets/d/${found.id}/edit` };
}

/** Tìm bảng tính của công cụ, chưa có thì tạo mới với các trang tính và dòng tiêu đề */
export async function ensureSpreadsheet(tag: string, title: string, sheets: SheetSpec[]): Promise<SpreadsheetRef> {
  const found = await findByTag(tag, SHEET_MIME);
  if (found) {
    await ensureSheets(found.id, sheets);
    return { id: found.id, url: found.webViewLink ?? `https://docs.google.com/spreadsheets/d/${found.id}/edit` };
  }
  const folder = await ensureFolder();
  const file = await gfetch<DriveFile>(`${DRIVE}?fields=id,webViewLink`, {
    method: 'POST',
    body: JSON.stringify({ name: title, mimeType: SHEET_MIME, parents: [folder], appProperties: { wft: tag } }),
  });
  await ensureSheets(file.id, sheets, true);
  return { id: file.id, url: file.webViewLink ?? `https://docs.google.com/spreadsheets/d/${file.id}/edit` };
}

/** Bảo đảm bảng tính có đủ các trang tính cần dùng (người dùng có thể đã lỡ xoá) */
async function ensureSheets(id: string, specs: SheetSpec[], fresh = false): Promise<void> {
  const meta = await gfetch<{ sheets: { properties: { sheetId: number; title: string } }[] }>(`${SHEETS}/${id}?fields=sheets.properties(sheetId,title)`);
  const existing = meta.sheets.map((s) => s.properties);
  const requests: unknown[] = [];
  const missing = specs.filter((s) => !existing.some((e) => e.title === s.name));
  missing.forEach((s, i) => {
    // Bảng mới tạo có sẵn "Sheet1": đổi tên thành trang đầu tiên thay vì để thừa
    if (fresh && i === 0 && existing.length === 1) {
      requests.push({ updateSheetProperties: { properties: { sheetId: existing[0].sheetId, title: s.name, gridProperties: { frozenRowCount: 1 } }, fields: 'title,gridProperties.frozenRowCount' } });
    } else {
      requests.push({ addSheet: { properties: { title: s.name, gridProperties: { frozenRowCount: 1 } } } });
    }
  });
  if (requests.length) await gfetch(`${SHEETS}/${id}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests }) });
  for (const s of missing) await writeRows(id, s.name, s.header, []);
}

const range = (sheet: string, a1 = 'A1:ZZ') => encodeURIComponent(`'${sheet.replace(/'/g, "''")}'!${a1}`);

/** Đọc toàn bộ trang tính, bỏ dòng tiêu đề; mỗi dòng trả về dạng object theo tên cột tiêu đề */
export async function readRows(id: string, sheet: string): Promise<Record<string, string>[]> {
  const res = await gfetch<{ values?: string[][] }>(`${SHEETS}/${id}/values/${range(sheet)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`);
  const [header, ...rows] = res.values ?? [];
  if (!header) return [];
  return rows
    .filter((r) => r.some((c) => String(c ?? '').trim() !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [String(h), String(r[i] ?? '')])));
}

/**
 * Ghi đè toàn bộ trang tính bằng dòng tiêu đề + dữ liệu (dữ liệu nhỏ nên ghi cả bảng cho đơn giản, không lệch).
 * Ghi dữ liệu mới trước rồi mới xoá các dòng thừa phía dưới, để lỗi mạng giữa chừng không làm trống bảng.
 */
export async function writeRows(id: string, sheet: string, header: string[], rows: (string | number)[][]): Promise<void> {
  const width = Math.max(header.length, ...rows.map((r) => r.length));
  const pad = (r: (string | number)[]) => [...r, ...Array(width - r.length).fill('')];
  await gfetch(`${SHEETS}/${id}/values/${range(sheet, 'A1')}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [pad(header), ...rows.map(pad)] }),
  });
  await gfetch(`${SHEETS}/${id}/values:batchClear`, {
    method: 'POST',
    body: JSON.stringify({
      ranges: [`'${sheet.replace(/'/g, "''")}'!A${rows.length + 2}:ZZ`, `'${sheet.replace(/'/g, "''")}'!${colName(width + 1)}1:ZZ`],
    }),
  });
}

/** 1 -> A, 27 -> AA */
function colName(n: number): string {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}
