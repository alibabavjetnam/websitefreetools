/**
 * Kho file của Desktop online. Hai nơi lưu cùng một giao diện:
 *  - DriveFs: thư mục "WFTools/Desktop" trong Google Drive của người dùng (quyền drive.file: WFTools chỉ thấy file do chính nó tạo)
 *  - LocalFs: IndexedDB của trình duyệt, cho người chưa đăng nhập
 */
import { GoogleAuthError, getToken, gfetch } from '../google/auth';
import { ensureFolder } from '../google/sheets';
import { pageText, tf } from '../i18n';
import { guessMime } from '../calc/desktop';

export interface FsNode {
  id: string;
  name: string;
  parent: string;
  folder: boolean;
  mime: string;
  size: number;
  /** ms kể từ 1970 */
  modified: number;
}

export interface DesktopFs {
  readonly kind: 'drive' | 'local';
  root(): Promise<string>;
  list(parent: string): Promise<FsNode[]>;
  get(id: string): Promise<FsNode>;
  read(id: string): Promise<Blob>;
  mkdir(parent: string, name: string): Promise<FsNode>;
  createFile(parent: string, name: string, data: Blob): Promise<FsNode>;
  writeFile(id: string, data: Blob): Promise<FsNode>;
  rename(id: string, name: string): Promise<FsNode>;
  /** Đưa vào thùng rác (khôi phục được) */
  trash(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  /** Xoá hẳn, kể cả nội dung thư mục */
  remove(id: string): Promise<void>;
  listTrash(): Promise<FsNode[]>;
}

/** Tên file cài đặt ẩn của Desktop (không hiện trong trình quản lý file) */
export const SETTINGS_FILE = '.wftdesk-settings.json';
export const isHidden = (n: FsNode): boolean => n.name.startsWith('.wftdesk');

/** Giới hạn tải lên mỗi file: Drive nhận lớn hơn nhiều, nhưng upload một lần qua trình duyệt cần vừa bộ nhớ */
export const MAX_UPLOAD = 100 * 1024 * 1024;

/* ------------------------------ Google Drive ------------------------------ */

const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FIELDS = 'id,name,mimeType,size,modifiedTime,parents';
/** Nhãn gắn vào mọi file của Desktop để tìm thùng rác (Drive không cho tìm theo thư mục cha đã xoá) */
const TAG = { key: 'wftd', value: '1' };

interface DriveFile { id: string; name: string; mimeType: string; size?: string; modifiedTime?: string; parents?: string[]; explicitlyTrashed?: boolean }

const toNode = (f: DriveFile): FsNode => ({
  id: f.id,
  name: f.name,
  parent: f.parents?.[0] ?? '',
  folder: f.mimeType === FOLDER_MIME,
  mime: f.mimeType,
  size: Number(f.size ?? 0),
  modified: f.modifiedTime ? Date.parse(f.modifiedTime) : Date.now(),
});

/** Gọi Drive và nhận dữ liệu nhị phân (gfetch chỉ đọc JSON) */
async function driveBlob(url: string): Promise<Blob> {
  const token = await getToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new GoogleAuthError(tf('google.error', 'Lỗi từ Google ({detail}).', { detail: String(res.status) }));
  return res.blob();
}

/** Tải lên dạng multipart (metadata + nội dung) hoặc chỉ nội dung khi cập nhật file có sẵn */
async function driveUpload(method: 'POST' | 'PATCH', url: string, meta: object | null, data: Blob): Promise<DriveFile> {
  const token = await getToken();
  let body: Blob;
  let type: string;
  if (meta) {
    const boundary = `wftd${Math.random().toString(36).slice(2)}`;
    body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
      `--${boundary}\r\nContent-Type: ${data.type || 'application/octet-stream'}\r\n\r\n`,
      data,
      `\r\n--${boundary}--`,
    ]);
    type = `multipart/related; boundary=${boundary}`;
  } else {
    body = data;
    type = data.type || 'application/octet-stream';
  }
  const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': type }, body });
  if (!res.ok) {
    let detail = String(res.status);
    try {
      detail += `: ${((await res.json()) as { error?: { message?: string } }).error?.message ?? ''}`;
    } catch {
      /* không có nội dung lỗi */
    }
    throw new GoogleAuthError(tf('google.error', 'Lỗi từ Google ({detail}).', { detail }));
  }
  return (await res.json()) as DriveFile;
}

export class DriveFs implements DesktopFs {
  readonly kind = 'drive' as const;
  private rootPromise: Promise<string> | null = null;

  root(): Promise<string> {
    this.rootPromise ??= (async () => {
      const parent = await ensureFolder();
      const q = `'${parent}' in parents and appProperties has { key='wft' and value='desktop' } and mimeType='${FOLDER_MIME}' and trashed=false`;
      const res = await gfetch<{ files: DriveFile[] }>(`${DRIVE}?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1&orderBy=createdTime`);
      if (res.files[0]) return res.files[0].id;
      const created = await gfetch<DriveFile>(`${DRIVE}?fields=id`, {
        method: 'POST',
        body: JSON.stringify({ name: 'Desktop', mimeType: FOLDER_MIME, parents: [parent], appProperties: { wft: 'desktop' } }),
      });
      return created.id;
    })().catch((e) => {
      this.rootPromise = null;
      throw e;
    });
    return this.rootPromise;
  }

  private async query(q: string, extra = ''): Promise<DriveFile[]> {
    const out: DriveFile[] = [];
    let page = '';
    do {
      const res = await gfetch<{ files: DriveFile[]; nextPageToken?: string }>(
        `${DRIVE}?q=${encodeURIComponent(q)}&fields=nextPageToken,files(${FIELDS}${extra})&pageSize=1000${page ? `&pageToken=${page}` : ''}`,
      );
      out.push(...res.files);
      page = res.nextPageToken ?? '';
    } while (page);
    return out;
  }

  async list(parent: string): Promise<FsNode[]> {
    // id do Drive cấp chỉ gồm chữ, số, - và _; vẫn chặn để không thể chèn vào câu truy vấn
    if (!/^[\w-]+$/.test(parent)) throw new Error('bad id');
    return (await this.query(`'${parent}' in parents and trashed=false`)).map(toNode);
  }

  async get(id: string): Promise<FsNode> {
    return toNode(await gfetch<DriveFile>(`${DRIVE}/${encodeURIComponent(id)}?fields=${FIELDS}`));
  }

  read(id: string): Promise<Blob> {
    return driveBlob(`${DRIVE}/${encodeURIComponent(id)}?alt=media`);
  }

  async mkdir(parent: string, name: string): Promise<FsNode> {
    return toNode(await gfetch<DriveFile>(`${DRIVE}?fields=${FIELDS}`, {
      method: 'POST',
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parent], appProperties: { [TAG.key]: TAG.value } }),
    }));
  }

  async createFile(parent: string, name: string, data: Blob): Promise<FsNode> {
    const mime = data.type || guessMime(name);
    const meta = { name, mimeType: mime, parents: [parent], appProperties: { [TAG.key]: TAG.value } };
    return toNode(await driveUpload('POST', `${UPLOAD}?uploadType=multipart&fields=${FIELDS}`, meta, data.type ? data : new Blob([data], { type: mime })));
  }

  async writeFile(id: string, data: Blob): Promise<FsNode> {
    return toNode(await driveUpload('PATCH', `${UPLOAD}/${encodeURIComponent(id)}?uploadType=media&fields=${FIELDS}`, null, data));
  }

  private patch(id: string, body: object): Promise<DriveFile> {
    return gfetch<DriveFile>(`${DRIVE}/${encodeURIComponent(id)}?fields=${FIELDS}`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  async rename(id: string, name: string): Promise<FsNode> {
    return toNode(await this.patch(id, { name }));
  }

  async trash(id: string): Promise<void> {
    await this.patch(id, { trashed: true });
  }

  async restore(id: string): Promise<void> {
    await this.patch(id, { trashed: false });
  }

  async remove(id: string): Promise<void> {
    await gfetch<void>(`${DRIVE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async listTrash(): Promise<FsNode[]> {
    // Chỉ lấy mục bị bỏ vào thùng rác trực tiếp; con của thư mục đã xoá đi theo thư mục cha
    const files = await this.query(`trashed=true and appProperties has { key='${TAG.key}' and value='${TAG.value}' }`, ',explicitlyTrashed');
    return files.filter((f) => f.explicitlyTrashed !== false).map(toNode);
  }
}

/* ------------------------------ IndexedDB ------------------------------ */

interface LocalRec extends FsNode {
  trashed: boolean;
  blob?: Blob;
}

const DB_NAME = 'wft-desktop';
const STORE = 'nodes';
const LOCAL_ROOT = 'root';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error(pageText()('noIdb', 'Trình duyệt không hỗ trợ lưu file cục bộ. Hãy đăng nhập Google để lưu vào Drive.')));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('parent', 'parent');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB'));
  });
}

const newId = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

export class LocalFs implements DesktopFs {
  readonly kind = 'local' as const;
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    this.dbPromise ??= openDb();
    return this.dbPromise;
  }

  private async tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
    const db = await this.db();
    return new Promise<T>((resolve, reject) => {
      const tr = db.transaction(STORE, mode);
      const req = fn(tr.objectStore(STORE));
      tr.oncomplete = () => resolve(req ? req.result : (undefined as T));
      tr.onerror = () => reject(tr.error ?? new Error('IndexedDB'));
      tr.onabort = () => reject(tr.error ?? new Error(pageText()('quota', 'Bộ nhớ trình duyệt đã đầy. Hãy xoá bớt file hoặc đăng nhập Google để lưu vào Drive.')));
    });
  }

  private async rec(id: string): Promise<LocalRec> {
    const r = await this.tx<LocalRec | undefined>('readonly', (s) => s.get(id));
    if (!r) throw new Error(pageText()('notFound', 'Không tìm thấy file. Có thể nó đã bị xoá.'));
    return r;
  }

  private strip(r: LocalRec): FsNode {
    return { id: r.id, name: r.name, parent: r.parent, folder: r.folder, mime: r.mime, size: r.size, modified: r.modified };
  }

  async root(): Promise<string> {
    return LOCAL_ROOT;
  }

  async list(parent: string): Promise<FsNode[]> {
    const all = await this.tx<LocalRec[]>('readonly', (s) => s.index('parent').getAll(parent));
    return all.filter((r) => !r.trashed).map((r) => this.strip(r));
  }

  async get(id: string): Promise<FsNode> {
    return this.strip(await this.rec(id));
  }

  async read(id: string): Promise<Blob> {
    const r = await this.rec(id);
    return r.blob ?? new Blob([], { type: r.mime });
  }

  private async put(r: LocalRec): Promise<FsNode> {
    await this.tx('readwrite', (s) => s.put(r));
    return this.strip(r);
  }

  mkdir(parent: string, name: string): Promise<FsNode> {
    return this.put({ id: newId(), name, parent, folder: true, mime: 'folder', size: 0, modified: Date.now(), trashed: false });
  }

  createFile(parent: string, name: string, data: Blob): Promise<FsNode> {
    const mime = data.type || guessMime(name);
    return this.put({ id: newId(), name, parent, folder: false, mime, size: data.size, modified: Date.now(), trashed: false, blob: data });
  }

  async writeFile(id: string, data: Blob): Promise<FsNode> {
    const r = await this.rec(id);
    return this.put({ ...r, blob: data, size: data.size, mime: data.type || r.mime, modified: Date.now() });
  }

  async rename(id: string, name: string): Promise<FsNode> {
    const r = await this.rec(id);
    return this.put({ ...r, name, modified: Date.now() });
  }

  async trash(id: string): Promise<void> {
    const r = await this.rec(id);
    await this.put({ ...r, trashed: true });
  }

  async restore(id: string): Promise<void> {
    const r = await this.rec(id);
    await this.put({ ...r, trashed: false });
  }

  async remove(id: string): Promise<void> {
    // Thu thập cả cây con trước rồi xoá trong một giao dịch
    const ids: string[] = [];
    const walk = async (pid: string): Promise<void> => {
      ids.push(pid);
      const kids = await this.tx<LocalRec[]>('readonly', (s) => s.index('parent').getAll(pid));
      for (const k of kids) await walk(k.id);
    };
    await walk(id);
    await this.tx('readwrite', (s) => {
      ids.forEach((x) => s.delete(x));
    });
  }

  async listTrash(): Promise<FsNode[]> {
    const all = await this.tx<LocalRec[]>('readonly', (s) => s.getAll());
    return all.filter((r) => r.trashed).map((r) => this.strip(r));
  }
}
