/** Các ứng dụng con của Desktop online: Tệp, Notepad, Xem ảnh, Xem PDF, Máy tính, Lịch, Thùng rác, Cài đặt */
import { downloadBlob, escapeHtml, fmtInt } from '../ui';
import { localeTag } from '../i18n';
import { ExprError, evaluate, normalize } from '../calc/expr';
import { fileBadge, fileKind, formatBytes, monthGrid, sameDay, sortNodes, splitExt, uniqueName, validateName, type NameError, type SortKey } from '../calc/desktop';
import { MAX_UPLOAD, isHidden, type FsNode } from './fs';
import { WALLPAPERS, svg, type AppDef, type Desktop, type Win } from './shell';
import { bindContextMenu, type MenuItem } from './menu';

const ICONS = {
  files: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  notepad: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/>',
  pdf: '<path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v4h4"/><path d="M9 14h6M9 17h4"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><rect x="8" y="6" width="8" height="3" rx=".5"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 17h.01M12 17h.01M15.5 17h.01"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  file: '<path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v4h4"/>',
  folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.2l2 2h8.8A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5Z" fill="#f6c343" stroke="#d39e00"/><path d="M3.2 10h17.6" stroke="#dca516"/>',
  cut: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8 16.5 17 4M16 16.5 7 4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  paste: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6"/>',
  rename: '<path d="M4 20h4L19 9l-4-4L4 16Z"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  open: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.4-5.7L20 8.5M20 4v4.5h-4.5"/>',
  props: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  view: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  sort: '<path d="M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3"/>',
  newItem: '<path d="M12 5v14M5 12h14"/>',
  newFolder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M12 11v5M9.5 13.5h5"/>',
  newText: '<path d="M6 3h8l4 4v14H6Z"/><path d="M12 11v6M9 14h6"/>',
  personalize: '<path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.6 0-1-.8-1.4-.8-2.3 0-.9.7-1.6 1.6-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
  wallpaper: '<rect x="3" y="4" width="18" height="13" rx="1.5"/><path d="M8 21h8"/>',
  restore: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5M4 4v4.5h4.5"/>',
  remove: '<path d="M7 7l10 10M17 7 7 17"/>',
};

/** Notepad không mở file lớn hơn mức này (textarea sẽ rất chậm) */
const MAX_TEXT = 5 * 1024 * 1024;

/** Biểu tượng của một mục: thư mục vàng, file là trang giấy gắn chữ đại diện (W, E, P, PDF, T, PNG…) */
export const nodeIco = (n: Pick<FsNode, 'name' | 'folder'>): string => {
  if (n.folder) return svg(ICONS.folder, 'wd-ico wd-k-folder');
  const b = fileBadge(n.name);
  const len = [...b.label].length;
  return `<span class="wd-ico wd-fi wd-c-${b.cat}${len > 2 ? ` is-l${Math.min(4, len)}` : ''}" aria-hidden="true"><b>${escapeHtml(b.label)}</b></span>`;
};

const byName = (a: FsNode, b: FsNode): number => Number(b.folder) - Number(a.folder) || a.name.localeCompare(b.name, localeTag(), { numeric: true, sensitivity: 'base' });
const sorted = (list: FsNode[], by: SortKey): FsNode[] => sortNodes(list, by, localeTag());

function nameError(d: Desktop, code: NameError | null): string | null {
  const T = d.T;
  if (!code) return null;
  return {
    empty: T('nameEmpty', 'Hãy nhập tên.'),
    tooLong: T('nameLong', 'Tên dài quá 120 ký tự, hãy rút ngắn.'),
    badChars: T('nameChars', 'Tên không được chứa các ký tự \\ / : * ? " < > |. Hãy bỏ chúng đi.'),
    dots: T('nameDots', 'Tên không được chỉ gồm dấu chấm.'),
    reserved: T('nameReserved', 'Tên này dành cho file hệ thống của Desktop, hãy chọn tên khác.'),
  }[code];
}

/** Hỏi tên mới, kiểm tra hợp lệ và không trùng trong thư mục */
async function askName(d: Desktop, title: string, initial: string, folder: string, ignoreId = ''): Promise<string | null> {
  const siblings = await d.run(() => d.fs.list(folder));
  if (!siblings) return null;
  const others = siblings.filter((s) => s.id !== ignoreId).map((s) => s.name.toLowerCase());
  return d.prompt(title, initial, d.T('ok', 'OK'), (v) => nameError(d, validateName(v)) ?? (others.includes(v.toLowerCase()) ? d.T('nameTaken', 'Đã có file hoặc thư mục trùng tên ở đây. Hãy chọn tên khác.') : null));
}

/** Mở một mục bằng ứng dụng phù hợp; thư mục mở trong trình quản lý file */
export function openNode(d: Desktop, n: FsNode): void {
  const kind = fileKind(n.name, n.mime, n.folder);
  if (kind === 'folder') return filesApp.open(d, n);
  if (kind === 'text') return notepadApp.open(d, n);
  if (kind === 'image') return imageApp.open(d, n);
  if (kind === 'pdf') return pdfApp.open(d, n);
  void d.run(async () => downloadBlob(await d.fs.read(n.id), n.name));
}

/** Tải lên nhiều file vào thư mục, tự đổi tên nếu trùng */
async function uploadFiles(d: Desktop, folder: string, files: File[]): Promise<void> {
  if (!files.length) return;
  await d.run(async () => {
    const names = (await d.fs.list(folder)).map((n) => n.name);
    let done = 0;
    for (const f of files) {
      if (f.size > MAX_UPLOAD) {
        d.notify(d.T('tooBig', '"{name}" lớn hơn 100 MB nên không tải lên được.').replace('{name}', f.name), true);
        continue;
      }
      const clean = f.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(-120) || 'file';
      const name = uniqueName(clean, names);
      names.push(name);
      await d.fs.createFile(folder, name, f);
      done++;
    }
    if (done) d.notify(d.T('uploaded', 'Đã tải lên {n} file.').replace('{n}', fmtInt(done)));
    d.changed(folder);
  });
}

function bindDrop(d: Desktop, el: HTMLElement, folder: () => string): void {
  el.addEventListener('dragover', (e) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    el.classList.add('is-drop');
  });
  el.addEventListener('dragleave', (e) => {
    if (!el.contains(e.relatedTarget as Node)) el.classList.remove('is-drop');
  });
  el.addEventListener('drop', (e) => {
    if (!e.dataTransfer?.files.length) return;
    e.preventDefault();
    el.classList.remove('is-drop');
    void uploadFiles(d, folder(), [...e.dataTransfer.files]);
  });
}

/* ===================== Thao tác dùng chung cho mọi nơi hiện file ===================== */

/** Đi ngược từ `folder` lên gốc: true nếu gặp `id` (không cho dán thư mục vào bên trong chính nó) */
async function isInside(d: Desktop, folder: string, id: string): Promise<boolean> {
  let cur = folder;
  for (let i = 0; i < 64 && cur; i++) {
    if (cur === id) return true;
    if (cur === d.rootId) return false;
    cur = (await d.fs.get(cur)).parent;
  }
  return false;
}

async function copyTree(d: Desktop, n: FsNode, folder: string, name: string): Promise<void> {
  if (!n.folder) {
    await d.fs.createFile(folder, name, await d.fs.read(n.id));
    return;
  }
  const f = await d.fs.mkdir(folder, name);
  for (const k of await d.fs.list(n.id)) if (!isHidden(k)) await copyTree(d, k, f.id, k.name);
}

/** Dán mục đang Cắt/Sao chép vào thư mục; trùng tên thì tự thêm (2), (3)… */
export async function pasteInto(d: Desktop, folder: string): Promise<void> {
  const c = d.clip;
  if (!c) return;
  const T = d.T;
  const ok = await d.runOk(async () => {
    if (c.node.folder && (await isInside(d, folder, c.node.id))) throw new Error(T('pasteInside', 'Không dán được thư mục vào bên trong chính nó. Hãy chọn thư mục khác.'));
    const names = (await d.fs.list(folder)).map((x) => x.name);
    if (c.mode === 'cut') {
      if (c.node.parent === folder) return;
      const name = uniqueName(c.node.name, names);
      if (name !== c.node.name) await d.fs.rename(c.node.id, name);
      await d.fs.move(c.node.id, folder);
    } else {
      await copyTree(d, c.node, folder, uniqueName(c.node.name, names));
    }
  });
  if (!ok) return;
  if (c.mode === 'cut') {
    d.setClip(null);
    d.changed(c.node.parent);
  }
  d.changed(folder);
  d.notify(T('pasted', 'Đã dán.'));
}

async function renameNode(d: Desktop, n: FsNode): Promise<void> {
  const name = await askName(d, d.T('renameTo', 'Tên mới'), n.name, n.parent || d.rootId, n.id);
  if (name && name !== n.name && (await d.run(() => d.fs.rename(n.id, name)))) d.changed(n.parent || d.rootId);
}

async function trashNode(d: Desktop, n: FsNode): Promise<void> {
  const T = d.T;
  if (!(await d.confirm(T('trashQ', 'Chuyển "{name}" vào Thùng rác? Bạn có thể khôi phục lại sau.').replace('{name}', n.name), T('delete', 'Xoá'), true))) return;
  if (await d.runOk(() => d.fs.trash(n.id))) {
    if (d.clip?.node.id === n.id) d.setClip(null);
    d.changed(n.parent || d.rootId);
    d.changed('trash');
  }
}

function downloadNode(d: Desktop, n: FsNode): void {
  if (n.folder) d.notify(d.T('noFolderDl', 'Chưa tải được cả thư mục. Hãy mở thư mục rồi tải từng file.'), true);
  else void d.run(async () => downloadBlob(await d.fs.read(n.id), n.name));
}

/** Đường dẫn dễ đọc từ gốc Desktop tới thư mục chứa mục */
async function locationOf(d: Desktop, folder: string): Promise<string> {
  const rootName = d.fs.kind === 'drive' ? 'Google Drive › Desktop' : d.T('thisDevice', 'Máy này');
  const parts: string[] = [];
  let cur = folder;
  for (let i = 0; i < 64 && cur && cur !== d.rootId; i++) {
    const f = await d.fs.get(cur);
    parts.unshift(f.name);
    cur = f.parent;
  }
  return [rootName, ...parts].join(' › ');
}

export async function showProps(d: Desktop, n: FsNode, isRoot = false): Promise<void> {
  const T = d.T;
  const rows = await d.run(async () => {
    const ext = splitExt(n.name)[1].slice(1).toUpperCase();
    const out: [string, string][] = [
      [T('colName', 'Tên'), isRoot ? (d.fs.kind === 'drive' ? 'Desktop' : T('thisDevice', 'Máy này')) : n.name],
      [T('colType', 'Loại'), n.folder ? T('typeFolder', 'Thư mục') : ext ? T('typeFile', 'File {ext}').replace('{ext}', ext) : T('typeFileNoExt', 'File')],
    ];
    if (!isRoot) out.push([T('propLocation', 'Vị trí'), await locationOf(d, n.parent || d.rootId)]);
    if (n.folder) out.push([T('propContains', 'Chứa'), T('itemsCount', '{n} mục').replace('{n}', fmtInt((await d.fs.list(n.id)).filter((x) => !isHidden(x)).length))]);
    else out.push([T('colSize', 'Kích thước'), `${formatBytes(n.size, fmtInt)}${n.size >= 1024 ? ` (${fmtInt(n.size)} B)` : ''}`]);
    if (!isRoot) out.push([T('colDate', 'Ngày sửa đổi'), new Date(n.modified).toLocaleString(localeTag(), { dateStyle: 'medium', timeStyle: 'short' })]);
    return out;
  });
  if (rows) await d.info(rows[0][1], nodeIco(n), rows);
}

async function newFolderIn(d: Desktop, folder: string): Promise<void> {
  const T = d.T;
  const names = await d.run(async () => (await d.fs.list(folder)).map((x) => x.name));
  if (!names) return;
  const name = await askName(d, T('newFolderName', 'Tên thư mục mới'), uniqueName(T('newFolderDefault', 'Thư mục mới'), names), folder);
  if (name && (await d.run(() => d.fs.mkdir(folder, name)))) d.changed(folder);
}

async function newTextIn(d: Desktop, folder: string): Promise<void> {
  const T = d.T;
  const names = await d.run(async () => (await d.fs.list(folder)).map((x) => x.name));
  if (!names) return;
  const name = await askName(d, T('newTextName', 'Tên file văn bản mới'), uniqueName(T('newTextDefault', 'Văn bản mới.txt'), names), folder);
  if (!name) return;
  const f = await d.run(() => d.fs.createFile(folder, name, new Blob([''], { type: 'text/plain' })));
  if (f) {
    d.changed(folder);
    notepadApp.open(d, f);
  }
}

/** Menu chuột phải của một file/thư mục */
function nodeMenu(d: Desktop, n: FsNode, opts: { open: () => void; openNewWindow?: () => void }): MenuItem[] {
  const T = d.T;
  const kind = fileKind(n.name, n.mime, n.folder);
  const items: MenuItem[] = [{ label: T('open', 'Mở'), icon: ICONS.open, strong: true, hint: 'Enter', run: opts.open }];
  if (n.folder && opts.openNewWindow) items.push({ label: T('openNewWin', 'Mở trong cửa sổ mới'), icon: ICONS.files, run: opts.openNewWindow });
  if (kind === 'other') items.push({ label: T('openWithNotepad', 'Mở bằng Notepad'), icon: ICONS.notepad, disabled: n.size > MAX_TEXT, run: () => notepadApp.open(d, n) });
  if (kind === 'image') items.push({ label: T('setWallpaper', 'Đặt làm hình nền'), icon: ICONS.wallpaper, run: () => {
    d.setSettings({ wallpaper: `file:${n.id}` });
    d.notify(T('wallSet', 'Đã đặt làm hình nền.'));
  } });
  items.push(
    { sep: true },
    { label: T('cut', 'Cắt'), icon: ICONS.cut, hint: 'Ctrl+X', run: () => d.setClip({ mode: 'cut', node: n }) },
    { label: T('copy', 'Sao chép'), icon: ICONS.copy, hint: 'Ctrl+C', run: () => d.setClip({ mode: 'copy', node: n }) },
  );
  if (n.folder) items.push({ label: T('paste', 'Dán'), icon: ICONS.paste, disabled: !d.clip, run: () => void pasteInto(d, n.id) });
  else items.push({ label: T('download', 'Tải về'), icon: ICONS.download, run: () => downloadNode(d, n) });
  items.push(
    { sep: true },
    { label: T('rename', 'Đổi tên'), icon: ICONS.rename, hint: 'F2', run: () => void renameNode(d, n) },
    { label: T('delete', 'Xoá'), icon: ICONS.trash, hint: 'Del', danger: true, run: () => void trashNode(d, n) },
    { sep: true },
    { label: T('properties', 'Thuộc tính'), icon: ICONS.props, hint: 'Alt+Enter', run: () => void showProps(d, n) },
  );
  return items;
}

/** Mục "Sắp xếp theo" dùng chung cho màn hình nền và Tệp */
function sortMenu(d: Desktop, cur: SortKey, set: (k: SortKey) => void): MenuItem {
  const T = d.T;
  const opt = (k: SortKey, label: string): MenuItem => ({ label, checked: cur === k, run: () => set(k) });
  return {
    label: T('sortBy', 'Sắp xếp theo'),
    icon: ICONS.sort,
    sub: [opt('name', T('colName', 'Tên')), opt('date', T('colDate', 'Ngày sửa đổi')), opt('size', T('colSize', 'Kích thước')), opt('type', T('colType', 'Loại'))],
  };
}

function newMenu(d: Desktop, folder: () => string): MenuItem {
  const T = d.T;
  return {
    label: T('ctxNew', 'Mới'),
    icon: ICONS.newItem,
    sub: [
      { label: T('newFolderShort', 'Thư mục'), icon: ICONS.newFolder, run: () => void newFolderIn(d, folder()) },
      { label: T('newTextShort', 'Tài liệu văn bản'), icon: ICONS.newText, run: () => void newTextIn(d, folder()) },
    ],
  };
}

/** Phím tắt kiểu Windows cho vùng hiện file; trả true nếu đã xử lý */
function fileKeys(d: Desktop, e: KeyboardEvent, n: FsNode | undefined, folder: string, refresh: () => void): boolean {
  const k = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  if (mod && k === 'c' && n) d.setClip({ mode: 'copy', node: n });
  else if (mod && k === 'x' && n) d.setClip({ mode: 'cut', node: n });
  else if (mod && k === 'v') void pasteInto(d, folder);
  else if (e.key === 'F5') refresh();
  else if (e.key === 'Delete' && n) void trashNode(d, n);
  else if (e.key === 'F2' && n) void renameNode(d, n);
  else if (e.key === 'Enter' && e.altKey && n) void showProps(d, n);
  else return false;
  e.preventDefault();
  return true;
}

/** Làm mờ mục đang được Cắt, như Windows */
function markCut(d: Desktop, box: HTMLElement): void {
  const id = d.clip?.mode === 'cut' ? d.clip.node.id : '';
  box.querySelectorAll<HTMLElement>('[data-id]').forEach((el) => el.classList.toggle('is-cut', el.dataset.id === id));
}

/** Thanh công cụ dùng chung: nút có biểu tượng + chữ */
const tbtn = (act: string, icon: string, label: string, extra = ''): string =>
  `<button type="button" class="wd-tb" data-act="${act}" ${extra}>${svg(icon)}<span>${escapeHtml(label)}</span></button>`;

const touch = (): boolean => window.matchMedia('(pointer: coarse)').matches;

/* =============================== Tệp =============================== */

export const filesApp: AppDef = {
  id: 'files',
  name: () => '',
  icon: ICONS.files,
  pinned: true,
  open(d, arg) {
    const T = d.T;
    const w = d.openWindow({ app: 'files', title: T('appFiles', 'Tệp'), icon: ICONS.files, width: 720, height: 460 });
    let trail: { id: string; name: string }[] = [];
    let items: FsNode[] = [];
    let selected = '';
    let view: 'grid' | 'list' = 'grid';
    let sortBy: SortKey = 'name';
    w.body.innerHTML = `
      <div class="wd-toolbar">
        ${tbtn('up', '<path d="M12 19V5M6 11l6-6 6 6"/>', T('up', 'Lên'), 'disabled')}
        ${tbtn('newFolder', ICONS.newFolder, T('newFolder', 'Thư mục mới'))}
        ${tbtn('newText', ICONS.newText, T('newText', 'File văn bản mới'))}
        ${tbtn('upload', ICONS.upload, T('upload', 'Tải lên'))}
        <span class="wd-sep"></span>
        ${tbtn('open', ICONS.open, T('open', 'Mở'), 'data-sel disabled')}
        ${tbtn('download', ICONS.download, T('download', 'Tải về'), 'data-sel disabled')}
        ${tbtn('rename', ICONS.rename, T('rename', 'Đổi tên'), 'data-sel disabled')}
        ${tbtn('delete', ICONS.trash, T('delete', 'Xoá'), 'data-sel disabled')}
        <span class="wd-sep"></span>
        ${tbtn('view', '<path d="M4 6h16M4 12h16M4 18h16"/>', T('view', 'Kiểu xem'))}
        <input type="file" multiple hidden />
      </div>
      <nav class="wd-crumbs" aria-label="${escapeHtml(T('path', 'Đường dẫn'))}"></nav>
      <div class="wd-files" role="listbox" tabindex="0" aria-label="${escapeHtml(T('appFiles', 'Tệp'))}"></div>
      <div class="wd-status"></div>`;
    const list = w.body.querySelector('.wd-files') as HTMLElement;
    const crumbs = w.body.querySelector('.wd-crumbs') as HTMLElement;
    const status = w.body.querySelector('.wd-status') as HTMLElement;
    const input = w.body.querySelector('input[type=file]') as HTMLInputElement;
    const cur = (): string => trail[trail.length - 1]?.id ?? d.rootId;
    const btn = (a: string) => w.body.querySelector(`[data-act="${a}"]`) as HTMLButtonElement;

    const paint = (): void => {
      list.className = `wd-files is-${view}`;
      list.innerHTML = items.length
        ? items
            .map(
              (n) => `<div class="wd-item${n.id === selected ? ' is-sel' : ''}" role="option" aria-selected="${n.id === selected}" data-id="${n.id}" tabindex="-1">${nodeIco(n)}<span class="wd-iname">${escapeHtml(n.name)}</span><span class="wd-imeta">${n.folder ? '' : escapeHtml(formatBytes(n.size, fmtInt))}</span><span class="wd-imeta">${escapeHtml(new Date(n.modified).toLocaleDateString(localeTag()))}</span></div>`,
            )
            .join('')
        : `<p class="wd-empty">${escapeHtml(T('emptyFolder', 'Thư mục trống. Kéo thả file vào đây hoặc bấm Tải lên.'))}</p>`;
      markCut(d, list);
      crumbs.innerHTML = [{ id: d.rootId, name: d.fs.kind === 'drive' ? 'Google Drive › Desktop' : T('thisDevice', 'Máy này') }, ...trail]
        .map((c, i) => `<button type="button" data-crumb="${i}">${escapeHtml(c.name)}</button>`)
        .join('<span aria-hidden="true">›</span>');
      w.body.querySelectorAll<HTMLButtonElement>('[data-sel]').forEach((b) => (b.disabled = !selected));
      btn('up').disabled = !trail.length;
      status.textContent = T('itemsCount', '{n} mục').replace('{n}', fmtInt(items.length));
      w.setTitle(trail.length ? trail[trail.length - 1].name : T('appFiles', 'Tệp'));
    };

    const load = async (): Promise<void> => {
      const r = await d.run(() => d.fs.list(cur()));
      if (!r) return;
      items = sorted(r.filter((n) => !isHidden(n)), sortBy);
      if (!items.some((n) => n.id === selected)) selected = '';
      paint();
    };
    const go = (t: { id: string; name: string }[]): void => {
      trail = t;
      selected = '';
      void load();
    };
    const sel = (): FsNode | undefined => items.find((n) => n.id === selected);

    /** Đổi chọn mà không vẽ lại danh sách: vẽ lại giữa hai lần bấm sẽ làm mất sự kiện nhấp đúp */
    const markSel = (): void => {
      list.querySelectorAll<HTMLElement>('.wd-item').forEach((el) => {
        el.classList.toggle('is-sel', el.dataset.id === selected);
        el.setAttribute('aria-selected', String(el.dataset.id === selected));
      });
      w.body.querySelectorAll<HTMLButtonElement>('[data-sel]').forEach((b) => (b.disabled = !selected));
    };
    list.addEventListener('click', (e) => {
      const it = (e.target as HTMLElement).closest<HTMLElement>('.wd-item');
      selected = it?.dataset.id ?? '';
      markSel();
      if (it && touch()) activate();
    });
    list.addEventListener('dblclick', (e) => {
      if ((e.target as HTMLElement).closest('.wd-item')) activate();
    });
    list.addEventListener('keydown', (e) => {
      const i = items.findIndex((n) => n.id === selected);
      if (fileKeys(d, e, sel(), cur(), () => void load())) return;
      if (e.key === 'Enter' && selected) activate();
      else if (e.key === 'Backspace' && trail.length) go(trail.slice(0, -1));
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
        const n = items[Math.max(0, Math.min(items.length - 1, i + step))];
        if (n) {
          selected = n.id;
          markSel();
          list.querySelector<HTMLElement>(`[data-id="${n.id}"]`)?.scrollIntoView({ block: 'nearest' });
        }
      } else return;
    });
    crumbs.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-crumb]');
      if (b) go(trail.slice(0, Number(b.dataset.crumb)));
    });
    const openItem = (n: FsNode): void => {
      if (n.folder) go([...trail, { id: n.id, name: n.name }]);
      else openNode(d, n);
    };
    const activate = (): void => {
      const n = sel();
      if (n) openItem(n);
    };

    const act = async (a: string): Promise<void> => {
      const n = sel();
      if (a === 'up') go(trail.slice(0, -1));
      else if (a === 'open') activate();
      else if (a === 'upload') input.click();
      else if (a === 'view') {
        view = view === 'grid' ? 'list' : 'grid';
        paint();
      } else if (a === 'newFolder') await newFolderIn(d, cur());
      else if (a === 'newText') await newTextIn(d, cur());
      else if (!n) return;
      else if (a === 'download') downloadNode(d, n);
      else if (a === 'rename') await renameNode(d, n);
      else if (a === 'delete') await trashNode(d, n);
    };
    w.body.querySelector('.wd-toolbar')?.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-act]');
      if (b && !b.disabled) void act(b.dataset.act ?? '');
    });
    input.addEventListener('change', () => {
      void uploadFiles(d, cur(), [...(input.files ?? [])]);
      input.value = '';
    });
    bindDrop(d, list, cur);

    bindContextMenu(d.root, list, (t) => {
      const it = t.closest<HTMLElement>('.wd-item');
      const n = it ? items.find((x) => x.id === it.dataset.id) : undefined;
      selected = n?.id ?? '';
      markSel();
      if (n) {
        return nodeMenu(d, n, {
          open: () => openItem(n),
          openNewWindow: () => filesApp.open(d, n),
        });
      }
      const here: FsNode = { id: d.rootId, name: '', parent: '', folder: true, mime: '', size: 0, modified: Date.now() };
      return [
        {
          label: T('ctxView', 'Xem'),
          icon: ICONS.view,
          sub: [
            { label: T('viewIcons', 'Biểu tượng'), checked: view === 'grid', run: () => ((view = 'grid'), paint()) },
            { label: T('viewDetails', 'Chi tiết'), checked: view === 'list', run: () => ((view = 'list'), paint()) },
          ],
        },
        sortMenu(d, sortBy, (k) => {
          sortBy = k;
          items = sorted(items, k);
          paint();
        }),
        { label: T('refresh', 'Làm mới'), icon: ICONS.refresh, hint: 'F5', run: () => void load() },
        { sep: true },
        { label: T('paste', 'Dán'), icon: ICONS.paste, hint: 'Ctrl+V', disabled: !d.clip, run: () => void pasteInto(d, cur()) },
        newMenu(d, cur),
        { label: T('upload', 'Tải lên'), icon: ICONS.upload, run: () => input.click() },
        { sep: true },
        {
          label: T('properties', 'Thuộc tính'),
          icon: ICONS.props,
          run: () =>
            void (async () => {
              const node = trail.length ? await d.run(() => d.fs.get(cur())) : here;
              if (node) await showProps(d, node, !trail.length);
            })(),
        },
      ];
    });

    const off = d.onChange((f) => {
      if (f === 'clip') markCut(d, list);
      else if (f === cur() || f === '*') void load();
    });
    w.opts.onClose = off;
    if (arg?.folder && arg.id !== d.rootId) trail = [{ id: arg.id, name: arg.name }];
    void load();
  },
};

/* =============================== Notepad =============================== */

export const notepadApp: AppDef = {
  id: 'notepad',
  name: () => '',
  icon: ICONS.notepad,
  pinned: true,
  open(d, arg) {
    const T = d.T;
    let node: FsNode | null = arg ?? null;
    let saved = '';
    let w: Win;
    const untitled = (): string => T('untitled', 'Chưa đặt tên.txt');
    const dirty = (): boolean => ta.value !== saved;
    const refresh = (): void => {
      const name = node?.name ?? untitled();
      w.setTitle(`${dirty() ? '● ' : ''}${name} — Notepad`);
      w.el.classList.toggle('is-dirty', dirty());
      const lines = ta.value ? ta.value.split('\n').length : 0;
      st.textContent = `${T('chars', '{n} ký tự').replace('{n}', fmtInt(ta.value.length))} · ${T('lines', '{n} dòng').replace('{n}', fmtInt(lines))}${dirty() ? '' : ` · ${T('savedState', 'Đã lưu')}`}`;
    };
    const saveAs = async (): Promise<boolean> => {
      const folder = node?.parent || d.rootId;
      const name = await askName(d, T('saveAsName', 'Lưu với tên'), node?.name ?? untitled(), folder);
      if (!name) return false;
      const text = ta.value;
      const f = await d.run(() => d.fs.createFile(folder, name, new Blob([text], { type: 'text/plain;charset=utf-8' })));
      if (!f) return false;
      node = f;
      saved = text;
      d.changed(folder);
      refresh();
      return true;
    };
    const save = async (): Promise<boolean> => {
      if (!node) return saveAs();
      const text = ta.value;
      const id = node.id;
      const f = await d.run(() => d.fs.writeFile(id, new Blob([text], { type: node?.mime.startsWith('text/') ? node.mime : 'text/plain;charset=utf-8' })));
      if (!f) return false;
      node = { ...f, parent: f.parent || node.parent };
      saved = text;
      d.changed(node.parent);
      refresh();
      d.notify(T('savedOk', 'Đã lưu.'));
      return true;
    };
    w = d.openWindow({
      app: 'notepad',
      key: arg ? `np:${arg.id}` : undefined,
      title: 'Notepad',
      icon: ICONS.notepad,
      width: 640,
      height: 440,
      beforeClose: async () => {
        if (!dirty()) return true;
        const r = await d.askSave(node?.name ?? untitled());
        if (r === 'discard') return true;
        if (r === 'save') return save();
        return false;
      },
    });
    if (w.body.childElementCount) return; // cửa sổ của file này đã mở sẵn
    w.body.innerHTML = `
      <div class="wd-toolbar">
        ${tbtn('new', '<path d="M6 3h8l4 4v14H6Z"/><path d="M12 11v6M9 14h6"/>', T('new', 'Mới'))}
        ${tbtn('save', '<path d="M5 3h11l3 3v15H5Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>', T('save', 'Lưu'))}
        ${tbtn('saveAs', '<path d="M5 3h11l3 3v15H5Z"/><path d="M9 14h6M12 11v6"/>', T('saveAs', 'Lưu thành…'))}
        ${tbtn('download', '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>', T('download', 'Tải về'))}
        <span class="wd-sep"></span>
        <label class="wd-check"><input type="checkbox" data-wrap checked /> ${escapeHtml(T('wrap', 'Xuống dòng tự động'))}</label>
      </div>
      <textarea class="wd-text" spellcheck="false" aria-label="${escapeHtml(T('textArea', 'Nội dung văn bản'))}"></textarea>
      <div class="wd-status"></div>`;
    const ta = w.body.querySelector('textarea') as HTMLTextAreaElement;
    const st = w.body.querySelector('.wd-status') as HTMLElement;
    ta.addEventListener('input', refresh);
    ta.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void (e.shiftKey ? saveAs() : save());
      } else if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        ta.setRangeText('\t', ta.selectionStart, ta.selectionEnd, 'end');
        refresh();
      }
    });
    (w.body.querySelector('[data-wrap]') as HTMLInputElement).addEventListener('change', (e) => ta.classList.toggle('is-nowrap', !(e.target as HTMLInputElement).checked));
    w.body.querySelector('.wd-toolbar')?.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (a === 'new') notepadApp.open(d);
      else if (a === 'save') void save();
      else if (a === 'saveAs') void saveAs();
      else if (a === 'download') downloadBlob(new Blob([ta.value], { type: 'text/plain;charset=utf-8' }), node?.name ?? untitled());
    });
    refresh();
    ta.focus();
    if (node) {
      const n = node;
      if (n.size > MAX_TEXT) {
        ta.disabled = true;
        ta.value = T('textTooBig', 'File lớn hơn 5 MB, Notepad không mở được. Hãy tải về để mở bằng phần mềm trên máy.');
        saved = ta.value;
        refresh();
        return;
      }
      ta.disabled = true;
      void d.run(async () => {
        const text = await (await d.fs.read(n.id)).text();
        ta.value = saved = text;
        ta.disabled = false;
        refresh();
        ta.focus();
      });
    }
  },
};

/* =============================== Xem ảnh =============================== */

export const imageApp: AppDef = {
  id: 'image',
  name: () => '',
  icon: ICONS.image,
  open(d, arg) {
    const T = d.T;
    if (!arg) {
      filesApp.open(d);
      d.notify(T('pickImage', 'Hãy mở một file ảnh trong Tệp.'));
      return;
    }
    let url = '';
    let node = arg;
    let siblings: FsNode[] = [];
    let zoom = 0; // 0 = vừa khung
    const w = d.openWindow({ app: 'image', title: node.name, icon: ICONS.image, width: 680, height: 500, onClose: () => url && URL.revokeObjectURL(url) });
    w.body.innerHTML = `
      <div class="wd-toolbar">
        ${tbtn('prev', '<path d="M15 6l-6 6 6 6"/>', T('prev', 'Trước'))}
        ${tbtn('next', '<path d="M9 6l6 6-6 6"/>', T('next', 'Sau'))}
        <span class="wd-sep"></span>
        ${tbtn('fit', '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', T('fit', 'Vừa khung'))}
        ${tbtn('zoomIn', '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5M11 8v6M8 11h6"/>', T('zoomIn', 'Phóng to'))}
        ${tbtn('zoomOut', '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5M8 11h6"/>', T('zoomOut', 'Thu nhỏ'))}
        <span class="wd-sep"></span>
        ${tbtn('wall', '<rect x="3" y="4" width="18" height="13" rx="1.5"/><path d="M8 21h8"/>', T('setWallpaper', 'Đặt làm hình nền'))}
        ${tbtn('download', '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>', T('download', 'Tải về'))}
      </div>
      <div class="wd-viewer"><img alt="" /></div>
      <div class="wd-status"></div>`;
    const img = w.body.querySelector('img') as HTMLImageElement;
    const box = w.body.querySelector('.wd-viewer') as HTMLElement;
    const st = w.body.querySelector('.wd-status') as HTMLElement;
    const applyZoom = (): void => {
      img.classList.toggle('is-fit', zoom === 0);
      img.style.width = zoom ? `${img.naturalWidth * zoom}px` : '';
      st.textContent = `${node.name} · ${img.naturalWidth}×${img.naturalHeight} · ${zoom ? `${Math.round(zoom * 100)}%` : T('fit', 'Vừa khung')}`;
    };
    img.addEventListener('load', applyZoom);
    img.addEventListener('error', () => (st.textContent = T('imgFail', 'Không hiển thị được ảnh này. Hãy tải về để mở bằng phần mềm khác.')));
    const show = async (n: FsNode): Promise<void> => {
      node = n;
      w.setTitle(n.name);
      const blob = await d.run(() => d.fs.read(n.id));
      if (!blob) return;
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      zoom = 0;
      img.alt = n.name;
      img.src = url;
    };
    void d.run(async () => {
      siblings = (await d.fs.list(arg.parent || d.rootId)).filter((n) => fileKind(n.name, n.mime) === 'image').sort(byName);
    });
    w.body.querySelector('.wd-toolbar')?.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      const i = siblings.findIndex((s) => s.id === node.id);
      if ((a === 'prev' || a === 'next') && siblings.length > 1) void show(siblings[(i + (a === 'next' ? 1 : -1) + siblings.length) % siblings.length]);
      else if (a === 'fit') zoom = 0;
      else if (a === 'zoomIn') zoom = Math.min(8, (zoom || img.width / Math.max(1, img.naturalWidth)) * 1.25);
      else if (a === 'zoomOut') zoom = Math.max(0.05, (zoom || img.width / Math.max(1, img.naturalWidth)) / 1.25);
      else if (a === 'wall') {
        d.setSettings({ wallpaper: `file:${node.id}` });
        d.notify(T('wallSet', 'Đã đặt làm hình nền.'));
      } else if (a === 'download') void d.run(async () => downloadBlob(await d.fs.read(node.id), node.name));
      if (a === 'fit' || a === 'zoomIn' || a === 'zoomOut') applyZoom();
    });
    box.addEventListener('dblclick', () => {
      zoom = zoom ? 0 : 1;
      applyZoom();
    });
    void show(arg);
  },
};

/* =============================== Xem PDF =============================== */

export const pdfApp: AppDef = {
  id: 'pdf',
  name: () => '',
  icon: ICONS.pdf,
  open(d, arg) {
    const T = d.T;
    if (!arg) {
      filesApp.open(d);
      d.notify(T('pickPdf', 'Hãy mở một file PDF trong Tệp.'));
      return;
    }
    let url = '';
    const w = d.openWindow({ app: 'pdf', key: `pdf:${arg.id}`, title: arg.name, icon: ICONS.pdf, width: 760, height: 540, onClose: () => url && URL.revokeObjectURL(url) });
    if (w.body.childElementCount) return;
    w.body.innerHTML = `
      <div class="wd-toolbar">
        ${tbtn('newTab', '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>', T('newTab', 'Mở ở tab mới'))}
        ${tbtn('download', '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>', T('download', 'Tải về'))}
      </div>
      <div class="wd-pdf"><p class="wd-empty">${escapeHtml(T('loading', 'Đang tải…'))}</p></div>`;
    const box = w.body.querySelector('.wd-pdf') as HTMLElement;
    void d.run(async () => {
      const blob = await d.fs.read(arg.id);
      url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      // Trình duyệt máy tính có sẵn trình xem PDF; điện thoại thường không hiện trong khung nên kèm lời nhắc
      box.innerHTML = `<iframe title="${escapeHtml(arg.name)}" src="${url}"></iframe><p class="wd-pdf-note">${escapeHtml(T('pdfHint', 'Không thấy nội dung? Bấm "Mở ở tab mới" hoặc "Tải về".'))}</p>`;
    });
    w.body.querySelector('.wd-toolbar')?.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (a === 'newTab' && url) window.open(url, '_blank', 'noopener');
      else if (a === 'download') void d.run(async () => downloadBlob(await d.fs.read(arg.id), arg.name));
    });
  },
};

/* =============================== Máy tính =============================== */

export const calcApp: AppDef = {
  id: 'calc',
  name: () => '',
  icon: ICONS.calc,
  pinned: true,
  open(d) {
    const T = d.T;
    const w = d.openWindow({ app: 'calc', key: 'calc', title: T('appCalc', 'Máy tính'), icon: ICONS.calc, width: 300, height: 420 });
    if (w.body.childElementCount) return;
    const keys = ['C', '⌫', '(', ')', '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '%', '+', '√', '^', 'π', '='];
    w.body.innerHTML = `
      <div class="wd-calc">
        <input class="wd-calc-in" type="text" inputmode="decimal" spellcheck="false" aria-label="${escapeHtml(T('expr', 'Biểu thức'))}" />
        <output class="wd-calc-out" aria-live="polite">0</output>
        <div class="wd-calc-keys">${keys.map((k) => `<button type="button" data-k="${k}"${k === '=' ? ' class="is-eq"' : ''}>${k}</button>`).join('')}</div>
      </div>`;
    const input = w.body.querySelector('input') as HTMLInputElement;
    const out = w.body.querySelector('output') as HTMLOutputElement;
    let ans = 0;
    const errText: Record<ExprError['code'], string> = {
      syntax: T('calcSyntax', 'Biểu thức chưa đúng'),
      paren: T('calcParen', 'Thiếu dấu ngoặc'),
      domain: T('calcDomain', 'Ngoài miền xác định'),
      divzero: T('calcDiv0', 'Không chia được cho 0'),
      empty: '0',
      overflow: T('calcOverflow', 'Số quá lớn'),
    };
    const compute = (final: boolean): void => {
      try {
        const v = evaluate(normalize(input.value), 'deg', ans);
        out.textContent = Number.isFinite(v) ? String(Number(v.toPrecision(12))) : errText.overflow;
        out.classList.remove('is-err');
        if (final) {
          ans = v;
          input.value = out.textContent;
        }
      } catch (e) {
        const code = e instanceof ExprError ? e.code : 'syntax';
        if (final || code === 'empty') {
          out.textContent = errText[code];
          out.classList.toggle('is-err', code !== 'empty');
        }
      }
    };
    w.body.querySelector('.wd-calc-keys')?.addEventListener('click', (e) => {
      const k = (e.target as HTMLElement).closest<HTMLElement>('[data-k]')?.dataset.k;
      if (!k) return;
      if (k === 'C') input.value = '';
      else if (k === '⌫') input.value = input.value.slice(0, -1);
      else if (k === '=') return compute(true);
      else input.value += k === '√' ? '√(' : k;
      compute(false);
      input.focus();
    });
    input.addEventListener('input', () => compute(false));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        compute(true);
      } else if (e.key === 'Escape' && input.value) {
        e.stopPropagation();
        input.value = '';
        compute(false);
      }
    });
    input.focus();
  },
};

/* =============================== Lịch =============================== */

export const calendarApp: AppDef = {
  id: 'calendar',
  name: () => '',
  icon: ICONS.calendar,
  pinned: true,
  open(d) {
    const T = d.T;
    const w = d.openWindow({ app: 'calendar', key: 'calendar', title: T('appCalendar', 'Lịch'), icon: ICONS.calendar, width: 360, height: 400 });
    if (w.body.childElementCount) return;
    const loc = localeTag();
    // Mỹ, Canada, Nhật, Hàn, Trung, Đài, Brazil, Israel, Ấn, Philippines… quen tuần bắt đầu Chủ nhật
    const region = loc.split('-')[1] ?? '';
    const weekStart: 0 | 1 = ['US', 'CA', 'JP', 'KR', 'CN', 'TW', 'HK', 'BR', 'IL', 'IN', 'PH', 'MX', 'ZA', 'SA', 'AU'].includes(region) ? 0 : 1;
    const today = new Date();
    let y = today.getFullYear();
    let m = today.getMonth();
    w.body.innerHTML = `
      <div class="wd-cal">
        <div class="wd-cal-head">
          <button type="button" class="wd-tb" data-nav="-1" aria-label="${escapeHtml(T('prevMonth', 'Tháng trước'))}">${svg('<path d="M15 6l-6 6 6 6"/>')}</button>
          <strong aria-live="polite"></strong>
          <button type="button" class="wd-tb" data-nav="1" aria-label="${escapeHtml(T('nextMonth', 'Tháng sau'))}">${svg('<path d="M9 6l6 6-6 6"/>')}</button>
          <button type="button" class="wd-tb" data-nav="0">${escapeHtml(T('today', 'Hôm nay'))}</button>
        </div>
        <div class="wd-cal-grid" role="grid"></div>
        <p class="wd-cal-today"></p>
      </div>`;
    const head = w.body.querySelector('.wd-cal-head strong') as HTMLElement;
    const grid = w.body.querySelector('.wd-cal-grid') as HTMLElement;
    const wd = new Intl.DateTimeFormat(loc, { weekday: 'short' });
    const paint = (): void => {
      head.textContent = new Date(y, m, 1).toLocaleDateString(loc, { month: 'long', year: 'numeric' });
      const days = [...Array(7)].map((_, i) => wd.format(new Date(2024, 0, 7 + weekStart + i))); // 7/1/2024 là Chủ nhật
      grid.innerHTML =
        days.map((x) => `<span class="wd-cal-dow" role="columnheader">${escapeHtml(x)}</span>`).join('') +
        monthGrid(y, m, weekStart)
          .map((c) => `<span role="gridcell" class="${c.inMonth ? '' : 'is-out'}${sameDay(c.date, today) ? ' is-today' : ''}">${c.date.getDate()}</span>`)
          .join('');
    };
    w.body.querySelector('.wd-cal-head')?.addEventListener('click', (e) => {
      const n = (e.target as HTMLElement).closest<HTMLElement>('[data-nav]')?.dataset.nav;
      if (n === undefined) return;
      if (n === '0') {
        y = today.getFullYear();
        m = today.getMonth();
      } else {
        const dt = new Date(y, m + Number(n), 1);
        y = dt.getFullYear();
        m = dt.getMonth();
      }
      paint();
    });
    (w.body.querySelector('.wd-cal-today') as HTMLElement).textContent = today.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    paint();
  },
};

/* =============================== Thùng rác =============================== */

export const trashApp: AppDef = {
  id: 'trash',
  name: () => '',
  icon: ICONS.trash,
  pinned: true,
  open(d) {
    const T = d.T;
    const w = d.openWindow({ app: 'trash', key: 'trash', title: T('appTrash', 'Thùng rác'), icon: ICONS.trash, width: 560, height: 380 });
    if (w.body.childElementCount) return;
    let items: FsNode[] = [];
    let selected = '';
    w.body.innerHTML = `
      <div class="wd-toolbar">
        ${tbtn('restore', '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5M4 4v4.5h4.5"/>', T('restore', 'Khôi phục'), 'data-sel disabled')}
        ${tbtn('remove', '<path d="M7 7l10 10M17 7 7 17"/>', T('deleteForever', 'Xoá vĩnh viễn'), 'data-sel disabled')}
        <span class="wd-sep"></span>
        ${tbtn('empty', ICONS.trash, T('emptyTrash', 'Dọn sạch thùng rác'))}
      </div>
      <div class="wd-files is-list" role="listbox" tabindex="0" aria-label="${escapeHtml(T('appTrash', 'Thùng rác'))}"></div>
      <div class="wd-status">${escapeHtml(d.fs.kind === 'drive' ? T('trashDriveNote', 'Mục trong thùng rác vẫn tính vào dung lượng Drive cho tới khi xoá vĩnh viễn.') : '')}</div>`;
    const list = w.body.querySelector('.wd-files') as HTMLElement;
    const paint = (): void => {
      list.innerHTML = items.length
        ? items.map((n) => `<div class="wd-item${n.id === selected ? ' is-sel' : ''}" role="option" aria-selected="${n.id === selected}" data-id="${n.id}">${nodeIco(n)}<span class="wd-iname">${escapeHtml(n.name)}</span><span class="wd-imeta">${n.folder ? '' : escapeHtml(formatBytes(n.size, fmtInt))}</span><span class="wd-imeta">${escapeHtml(new Date(n.modified).toLocaleDateString(localeTag()))}</span></div>`).join('')
        : `<p class="wd-empty">${escapeHtml(T('trashEmpty', 'Thùng rác trống.'))}</p>`;
      w.body.querySelectorAll<HTMLButtonElement>('[data-sel]').forEach((b) => (b.disabled = !selected));
    };
    const load = async (): Promise<void> => {
      const r = await d.run(() => d.fs.listTrash());
      if (!r) return;
      items = r.filter((n) => !isHidden(n)).sort(byName);
      if (!items.some((n) => n.id === selected)) selected = '';
      paint();
    };
    const markSel = (): void => {
      list.querySelectorAll<HTMLElement>('.wd-item').forEach((el) => {
        el.classList.toggle('is-sel', el.dataset.id === selected);
        el.setAttribute('aria-selected', String(el.dataset.id === selected));
      });
      w.body.querySelectorAll<HTMLButtonElement>('[data-sel]').forEach((b) => (b.disabled = !selected));
    };
    list.addEventListener('click', (e) => {
      selected = (e.target as HTMLElement).closest<HTMLElement>('.wd-item')?.dataset.id ?? '';
      markSel();
    });
    /** Xoá vĩnh viễn ảnh đang làm hình nền (hoặc thư mục chứa nó) thì quay về hình nền mặc định */
    const wallIn = async (ids: string[]): Promise<boolean> => {
      const w = d.settings.wallpaper;
      if (!w.startsWith('file:')) return false;
      const id = w.slice(5);
      for (const x of ids) if (await isInside(d, id, x).catch(() => false)) return true;
      return false;
    };
    const resetWall = (): void => d.setSettings({ wallpaper: 'dawn' });
    const run = async (a: string): Promise<void> => {
      const n = items.find((x) => x.id === selected);
      if (a === 'restore' && n) {
        if ((await d.runOk(() => d.fs.restore(n.id)))) d.changed('*');
      } else if (a === 'remove' && n) {
        if (!(await d.confirm(T('removeQ', 'Xoá vĩnh viễn "{name}"? Không thể hoàn tác.').replace('{name}', n.name), T('deleteForever', 'Xoá vĩnh viễn'), true))) return;
        const wall = await wallIn([n.id]);
        if ((await d.runOk(() => d.fs.remove(n.id)))) {
          if (wall) resetWall();
          d.changed('trash');
        }
      } else if (a === 'empty' && items.length) {
        if (!(await d.confirm(T('emptyQ', 'Xoá vĩnh viễn {n} mục trong thùng rác? Không thể hoàn tác.').replace('{n}', fmtInt(items.length)), T('emptyTrash', 'Dọn sạch thùng rác'), true))) return;
        const wall = await wallIn(items.map((x) => x.id));
        const done = await d.runOk(async () => {
          for (const x of items) await d.fs.remove(x.id);
        });
        if (done && wall) resetWall();
        d.changed('trash');
      }
    };
    w.body.querySelector('.wd-toolbar')?.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-act]');
      if (b && !b.disabled) void run(b.dataset.act ?? '');
    });
    list.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' && selected) void run('remove');
      else if (e.key === 'F5') void load();
      else return;
      e.preventDefault();
    });
    bindContextMenu(d.root, list, (t) => {
      const it = t.closest<HTMLElement>('.wd-item');
      selected = it?.dataset.id ?? '';
      markSel();
      if (it) {
        return [
          { label: T('restore', 'Khôi phục'), icon: ICONS.restore, strong: true, run: () => void run('restore') },
          { label: T('deleteForever', 'Xoá vĩnh viễn'), icon: ICONS.remove, hint: 'Del', danger: true, run: () => void run('remove') },
        ];
      }
      return [
        { label: T('refresh', 'Làm mới'), icon: ICONS.refresh, hint: 'F5', run: () => void load() },
        { sep: true },
        { label: T('emptyTrash', 'Dọn sạch thùng rác'), icon: ICONS.trash, danger: true, disabled: !items.length, run: () => void run('empty') },
      ];
    });
    const off = d.onChange((f) => {
      if (f === 'trash' || f === '*') void load();
    });
    w.opts.onClose = off;
    void load();
  },
};

/* =============================== Cài đặt =============================== */

export interface AccountHooks {
  /** Dòng mô tả nơi lưu, ví dụ email đang đăng nhập */
  label: () => string;
  /** Nút chuyển nơi lưu: đăng nhập Google hoặc đăng xuất */
  action: () => { text: string; run: () => void };
}

const WALL_NAMES: Record<string, string> = { dawn: 'Bình minh', aurora: 'Cực quang', sunset: 'Hoàng hôn', lavender: 'Oải hương', forest: 'Rừng xanh', graphite: 'Than chì' };

export function settingsApp(account: AccountHooks): AppDef {
  return {
    id: 'settings',
    name: () => '',
    icon: ICONS.settings,
    pinned: true,
    open(d) {
      const T = d.T;
      const w = d.openWindow({ app: 'settings', key: 'settings', title: T('appSettings', 'Cài đặt'), icon: ICONS.settings, width: 520, height: 470 });
      if (w.body.childElementCount) return;
      const s = d.settings;
      const act = account.action();
      w.body.innerHTML = `
        <div class="wd-settings">
          <fieldset><legend>${escapeHtml(T('wallpaper', 'Hình nền'))}</legend>
            <div class="wd-walls">${Object.entries(WALLPAPERS)
              .map(([k, v]) => `<button type="button" class="wd-wall${s.wallpaper === k ? ' is-sel' : ''}" data-wall="${k}" style="background:${v}" aria-label="${escapeHtml(T(`wall.${k}`, WALL_NAMES[k] ?? k))}" aria-pressed="${s.wallpaper === k}"></button>`)
              .join('')}</div>
            <p class="wd-hint">${escapeHtml(T('wallHint', 'Muốn dùng ảnh riêng? Mở ảnh trong Tệp rồi bấm "Đặt làm hình nền".'))}</p>
          </fieldset>
          <fieldset><legend>${escapeHtml(T('appearance', 'Giao diện'))}</legend>
            <label class="wd-check"><input type="radio" name="wd-theme" value="light"${s.theme === 'light' ? ' checked' : ''} /> ${escapeHtml(T('themeLight', 'Sáng'))}</label>
            <label class="wd-check"><input type="radio" name="wd-theme" value="dark"${s.theme === 'dark' ? ' checked' : ''} /> ${escapeHtml(T('themeDark', 'Tối'))}</label>
            <label class="wd-check"><input type="checkbox" data-clock24${s.clock24 ? ' checked' : ''} /> ${escapeHtml(T('clock24', 'Đồng hồ 24 giờ'))}</label>
          </fieldset>
          <fieldset><legend>${escapeHtml(T('storage', 'Nơi lưu file'))}</legend>
            <p>${escapeHtml(account.label())}</p>
            <button type="button" class="btn btn-sm" data-account>${escapeHtml(act.text)}</button>
          </fieldset>
        </div>`;
      w.body.addEventListener('click', (e) => {
        const el = e.target as HTMLElement;
        const wall = el.closest<HTMLElement>('[data-wall]')?.dataset.wall;
        if (wall) {
          d.setSettings({ wallpaper: wall });
          w.body.querySelectorAll<HTMLElement>('[data-wall]').forEach((b) => {
            b.classList.toggle('is-sel', b.dataset.wall === wall);
            b.setAttribute('aria-pressed', String(b.dataset.wall === wall));
          });
        }
        if (el.closest('[data-account]')) act.run();
      });
      w.body.addEventListener('change', (e) => {
        const el = e.target as HTMLInputElement;
        if (el.name === 'wd-theme') d.setSettings({ theme: el.value === 'dark' ? 'dark' : 'light' });
        if (el.hasAttribute('data-clock24')) d.setSettings({ clock24: el.checked });
      });
    },
  };
}

/* ======================== Biểu tượng trên màn hình nền ======================== */

/** Vẽ biểu tượng ứng dụng ghim + file/thư mục ở gốc Desktop; tự vẽ lại khi kho file đổi */
export function mountDesktopIcons(d: Desktop): void {
  let nodes: FsNode[] = [];
  let selected = '';
  const T = d.T;
  const label = (id: string): string => d.app(id)?.name() ?? id;
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.hidden = true;
  d.screen.appendChild(input);
  input.addEventListener('change', () => {
    void uploadFiles(d, d.rootId, [...(input.files ?? [])]);
    input.value = '';
  });
  const paint = (): void => {
    const apps = d.apps.filter((a) => a.pinned);
    d.icons.innerHTML =
      apps.map((a) => `<button type="button" class="wd-dicon${selected === `app:${a.id}` ? ' is-sel' : ''}" role="listitem" data-app="${a.id}">${svg(a.icon)}<span>${escapeHtml(label(a.id))}</span></button>`).join('') +
      nodes.map((n) => `<button type="button" class="wd-dicon${selected === n.id ? ' is-sel' : ''}" role="listitem" data-id="${n.id}" title="${escapeHtml(n.name)}">${nodeIco(n)}<span>${escapeHtml(n.name)}</span></button>`).join('');
    markCut(d, d.icons);
  };
  const load = async (): Promise<void> => {
    const r = await d.run(() => d.fs.list(d.rootId));
    if (!r) return;
    nodes = sorted(r.filter((n) => !isHidden(n)), d.settings.sortBy);
    paint();
  };
  const nodeOf = (b: HTMLElement | null): FsNode | undefined => (b?.dataset.id ? nodes.find((x) => x.id === b.dataset.id) : undefined);
  const activate = (b: HTMLElement): void => {
    if (b.dataset.app) d.app(b.dataset.app)?.open(d);
    else {
      const n = nodeOf(b);
      if (n) openNode(d, n);
    }
  };
  const select = (b: HTMLElement | null): void => {
    selected = b ? (b.dataset.app ? `app:${b.dataset.app}` : (b.dataset.id ?? '')) : '';
    d.icons.querySelectorAll<HTMLElement>('.wd-dicon').forEach((el) => el.classList.toggle('is-sel', el === b));
  };
  d.icons.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.wd-dicon');
    select(b);
    if (b && touch()) activate(b);
  });
  d.icons.addEventListener('dblclick', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.wd-dicon');
    if (b) activate(b);
  });
  // Enter trên nút: trình duyệt phát "click" nên cần chặn để Enter mở như nhấp đúp
  d.icons.addEventListener('keydown', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.wd-dicon');
    if (fileKeys(d, e, nodeOf(b), d.rootId, () => void load())) return;
    if (b && e.key === 'Enter') {
      e.preventDefault();
      activate(b);
    }
  });
  bindDrop(d, d.icons, () => d.rootId);

  bindContextMenu(d.root, d.icons, (t) => {
    const b = t.closest<HTMLElement>('.wd-dicon');
    select(b);
    if (b?.dataset.app) {
      const app = d.app(b.dataset.app);
      return [{ label: T('open', 'Mở'), icon: app?.icon ?? ICONS.open, strong: true, run: () => app?.open(d) }];
    }
    const n = nodeOf(b);
    if (n) return nodeMenu(d, n, { open: () => openNode(d, n), openNewWindow: () => filesApp.open(d, n) });
    const size = d.settings.iconSize;
    const opt = (k: typeof size, text: string): MenuItem => ({ label: text, checked: size === k, run: () => d.setSettings({ iconSize: k }) });
    return [
      { label: T('ctxView', 'Xem'), icon: ICONS.view, sub: [opt('large', T('iconLarge', 'Biểu tượng lớn')), opt('medium', T('iconMedium', 'Biểu tượng vừa')), opt('small', T('iconSmall', 'Biểu tượng nhỏ'))] },
      sortMenu(d, d.settings.sortBy, (k) => {
        d.setSettings({ sortBy: k });
        nodes = sorted(nodes, k);
        paint();
      }),
      { label: T('refresh', 'Làm mới'), icon: ICONS.refresh, hint: 'F5', run: () => void load() },
      { sep: true },
      { label: T('paste', 'Dán'), icon: ICONS.paste, hint: 'Ctrl+V', disabled: !d.clip, run: () => void pasteInto(d, d.rootId) },
      newMenu(d, () => d.rootId),
      { label: T('upload', 'Tải lên'), icon: ICONS.upload, run: () => input.click() },
      { sep: true },
      { label: T('personalize', 'Cá nhân hoá'), icon: ICONS.personalize, run: () => d.app('settings')?.open(d) },
      d.fullscreenItem(),
    ];
  });
  d.onChange((f) => {
    if (f === 'clip') markCut(d, d.icons);
    else if (f === d.rootId || f === '*') void load();
  });
  d.icons.setAttribute('aria-label', T('desktopIcons', 'Biểu tượng trên màn hình'));
  paint();
  void load();
}

/** Gán tên hiển thị theo ngôn ngữ cho các ứng dụng (đọc lúc chạy, không ở top-level module) */
export function nameApps(apps: AppDef[], T: (k: string, f?: string) => string): void {
  const names: Record<string, string> = {
    files: T('appFiles', 'Tệp'),
    notepad: 'Notepad',
    image: T('appImage', 'Xem ảnh'),
    pdf: T('appPdf', 'Xem PDF'),
    calc: T('appCalc', 'Máy tính'),
    calendar: T('appCalendar', 'Lịch'),
    trash: T('appTrash', 'Thùng rác'),
    settings: T('appSettings', 'Cài đặt'),
  };
  for (const a of apps) a.name = () => names[a.id] ?? a.id;
}
