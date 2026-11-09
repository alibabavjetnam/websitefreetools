/** Phần thuần (không DOM) của Desktop online: kiểm tên file, đặt tên không trùng, nhận dạng loại file, lưới lịch tháng */

export const MAX_NAME = 120;
/** Ký tự Windows/Drive không cho trong tên file, cộng ký tự điều khiển */
const BAD_CHARS = /[\\/:*?"<>|\u0000-\u001f]/;

export type NameError = 'empty' | 'tooLong' | 'badChars' | 'dots' | 'reserved';

/** Trả về mã lỗi nếu tên file/thư mục không hợp lệ, null nếu dùng được */
export function validateName(raw: string): NameError | null {
  const name = raw.trim();
  if (!name) return 'empty';
  if (name.length > MAX_NAME) return 'tooLong';
  if (BAD_CHARS.test(name)) return 'badChars';
  if (/^\.+$/.test(name)) return 'dots';
  // Tên bắt đầu bằng ".wftdesk" dành cho file cài đặt ẩn của Desktop
  if (name.toLowerCase().startsWith('.wftdesk')) return 'reserved';
  return null;
}

/** Tách tên và phần mở rộng: "a.b.txt" → ["a.b", ".txt"]; file ẩn ".env" không coi là phần mở rộng */
export function splitExt(name: string): [string, string] {
  const i = name.lastIndexOf('.');
  if (i <= 0) return [name, ''];
  return [name.slice(0, i), name.slice(i)];
}

/** Tên không trùng (không phân biệt hoa thường) trong thư mục: "Ghi chú.txt" → "Ghi chú (2).txt" */
export function uniqueName(name: string, existing: Iterable<string>): string {
  const taken = new Set([...existing].map((n) => n.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  const [base, ext] = splitExt(name);
  for (let i = 2; i < 10_000; i++) {
    const candidate = `${base} (${i})${ext}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} (${Date.now()})${ext}`;
}

export type FileKind = 'folder' | 'text' | 'image' | 'pdf' | 'other';

const TEXT_EXT = new Set(['.txt', '.md', '.markdown', '.json', '.csv', '.tsv', '.log', '.xml', '.html', '.htm', '.css', '.js', '.mjs', '.ts', '.py', '.java', '.c', '.cpp', '.h', '.cs', '.go', '.rs', '.php', '.rb', '.sh', '.bat', '.ps1', '.sql', '.yml', '.yaml', '.ini', '.cfg', '.conf', '.env', '.srt', '.vtt']);
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.avif', '.ico']);

/** Loại file để chọn ứng dụng mở; ưu tiên phần mở rộng vì mime do trình duyệt/Drive đoán có thể sai */
export function fileKind(name: string, mime: string, folder = false): FileKind {
  if (folder) return 'folder';
  const ext = splitExt(name)[1].toLowerCase();
  if (TEXT_EXT.has(ext)) return 'text';
  if (IMAGE_EXT.has(ext)) return 'image';
  if (ext === '.pdf') return 'pdf';
  if (mime.startsWith('text/') || mime === 'application/json') return 'text';
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  return 'other';
}

/** Mime đoán theo phần mở rộng khi tạo file mới (Drive cần mime để xem trước đúng) */
export function guessMime(name: string): string {
  const ext = splitExt(name)[1].toLowerCase();
  const map: Record<string, string> = {
    '.txt': 'text/plain', '.md': 'text/markdown', '.json': 'application/json', '.csv': 'text/csv', '.html': 'text/html', '.htm': 'text/html',
    '.css': 'text/css', '.js': 'text/javascript', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf',
  };
  return map[ext] || (TEXT_EXT.has(ext) ? 'text/plain' : 'application/octet-stream');
}

/** Kích thước dễ đọc theo đơn vị 1024: 0 B, 1.5 KB, 2.3 MB */
export function formatBytes(n: number, fmt: (x: number) => string = (x) => String(x)): string {
  if (!Number.isFinite(n) || n < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${fmt(i === 0 ? v : Math.round(v * 10) / 10)} ${units[i]}`;
}

/**
 * Lưới lịch 6 tuần × 7 ngày của một tháng. weekStart: 0 = Chủ nhật, 1 = Thứ hai.
 * Mỗi ô có ngày (Date lúc 00:00 giờ máy) và cờ thuộc tháng đang xem.
 */
export function monthGrid(year: number, month: number, weekStart: 0 | 1): { date: Date; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() - weekStart + 7) % 7;
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - offset + i);
    cells.push({ date: d, inMonth: d.getMonth() === month });
  }
  return cells;
}

export const sameDay = (a: Date, b: Date): boolean => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/* ---------------- Biểu tượng chữ cái theo loại file ---------------- */

export type BadgeCat = 'word' | 'excel' | 'ppt' | 'pdf' | 'text' | 'md' | 'code' | 'data' | 'image' | 'audio' | 'video' | 'archive' | 'app' | 'font' | 'other';

const CAT_EXT: [BadgeCat, string[], string?][] = [
  ['word', ['doc', 'docx', 'docm', 'dot', 'dotx', 'odt', 'rtf', 'pages'], 'W'],
  ['excel', ['xls', 'xlsx', 'xlsm', 'xlsb', 'xlt', 'xltx', 'ods', 'csv', 'tsv', 'numbers'], 'E'],
  ['ppt', ['ppt', 'pptx', 'pptm', 'pps', 'ppsx', 'pot', 'potx', 'odp', 'key'], 'P'],
  ['pdf', ['pdf'], 'PDF'],
  ['text', ['txt', 'log', 'ini', 'cfg', 'conf', 'env', 'srt', 'vtt'], 'T'],
  ['md', ['md', 'markdown'], 'M'],
  ['data', ['json', 'yml', 'yaml', 'xml', 'sql', 'db', 'sqlite']],
  ['code', ['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs', 'php', 'rb', 'sh', 'bat', 'ps1', 'html', 'htm', 'css', 'scss', 'vue', 'kt', 'swift']],
  ['image', ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'ico', 'heic', 'heif', 'tif', 'tiff', 'psd']],
  ['audio', ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'flac', 'aac', 'wma', 'opus', 'mid', 'midi']],
  ['video', ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv', 'm4v', '3gp']],
  ['archive', ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'iso']],
  ['app', ['exe', 'msi', 'apk', 'dmg', 'deb', 'rpm', 'appimage', 'jar']],
  ['font', ['ttf', 'otf', 'woff', 'woff2'], 'Aa'],
];
const EXT_CAT = new Map<string, [BadgeCat, string | undefined]>();
for (const [cat, exts, letter] of CAT_EXT) for (const e of exts) EXT_CAT.set(e, [cat, letter]);

/**
 * Chữ đại diện và nhóm màu cho biểu tượng file: W (Word), E (Excel), P (PowerPoint), PDF, T (văn bản)…
 * Nhóm không có chữ riêng dùng phần mở rộng viết hoa, tối đa 4 ký tự (PNG, MP3, ZIP).
 */
export function fileBadge(name: string): { label: string; cat: BadgeCat } {
  const ext = splitExt(name)[1].slice(1).toLowerCase();
  const hit = EXT_CAT.get(ext);
  if (hit) return { label: hit[1] ?? ext.toUpperCase().slice(0, 4), cat: hit[0] };
  const clean = ext.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase().slice(0, 4);
  return { label: clean || '?', cat: 'other' };
}

/* ---------------- Sắp xếp ---------------- */

export type SortKey = 'name' | 'date' | 'size' | 'type';

interface Sortable { name: string; folder: boolean; size: number; modified: number }

/** Sắp xếp như Windows: thư mục luôn đứng trước; tên so theo ngôn ngữ, số trong tên so theo giá trị (2 < 10) */
export function sortNodes<T extends Sortable>(nodes: T[], by: SortKey, locale?: string): T[] {
  const coll = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  const byName = (a: T, b: T): number => coll.compare(a.name, b.name);
  const cmp: Record<SortKey, (a: T, b: T) => number> = {
    name: byName,
    date: (a, b) => b.modified - a.modified || byName(a, b),
    size: (a, b) => b.size - a.size || byName(a, b),
    type: (a, b) => coll.compare(splitExt(a.name)[1], splitExt(b.name)[1]) || byName(a, b),
  };
  return [...nodes].sort((a, b) => Number(b.folder) - Number(a.folder) || cmp[by](a, b));
}

