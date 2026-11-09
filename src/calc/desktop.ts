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
