/**
 * Kho dữ liệu cho một công cụ: luôn lưu trên trình duyệt; khi người dùng kết nối Google thì đồng bộ
 * với một bảng tính trong Google Drive của họ (Google Sheets là bản chính, tự lưu sau mỗi thay đổi).
 */
import { GoogleAuthError, currentUser, hasLiveToken, signIn } from './auth';
import { ensureSpreadsheet, readRows, writeRows, type SpreadsheetRef } from './sheets';
import { escapeHtml, storage, toast } from '../ui';

export interface Column<T> {
  key: keyof T & string;
  label: string;
  type?: 'number' | 'text';
}

export interface TableDef<T> {
  sheet: string;
  columns: Column<T>[];
}

type Row = Record<string, string | number>;
type Data = Record<string, Row[]>;
/** Mỗi khoá là một bảng: danh sách các dòng (object) */
export type TableData<D> = { [K in keyof D]: object[] };

export interface StoreOptions<D extends TableData<D>> {
  /** Mã duy nhất của công cụ, dùng làm khoá lưu trữ và nhãn file trên Drive */
  tag: string;
  /** Tên bảng tính tạo trong Drive */
  title: string;
  tables: { [K in keyof D]: TableDef<D[K][number]> };
  empty: D;
}

type Status = 'local' | 'connect' | 'syncing' | 'synced' | 'error';

export class SheetStore<D extends TableData<D>> {
  private data: D;
  private local;
  private link;
  /** Có thay đổi trên máy chưa được lưu lên Sheets (sống qua các lần tải trang) */
  private pending;
  private ref: SpreadsheetRef | null = null;
  private status: Status = 'local';
  private message = '';
  private saveTimer: number | undefined;
  private dirty = false;
  private bar: HTMLElement | null = null;
  private listeners: ((d: D) => void)[] = [];

  constructor(private opts: StoreOptions<D>) {
    this.local = storage<D>(`data:${opts.tag}`, opts.empty);
    this.link = storage<{ email: string; id: string; url: string } | null>(`link:${opts.tag}`, null);
    this.pending = storage<boolean>(`pending:${opts.tag}`, false);
    this.data = { ...opts.empty, ...this.local.get() };
    window.addEventListener('wft-auth-change', () => {
      if (!currentUser()) {
        this.ref = null;
        this.setStatus('local');
      } else this.refreshStatus();
    });
  }

  get(): D {
    return this.data;
  }

  /** Đăng ký nhận dữ liệu mới (sau khi tải từ Google Sheets) */
  onChange(fn: (d: D) => void): void {
    this.listeners.push(fn);
  }

  set(next: D): void {
    this.data = next;
    this.local.set(next);
    if (this.link.get()) this.pending.set(true);
    if (this.ref) {
      this.dirty = true;
      window.clearTimeout(this.saveTimer);
      this.saveTimer = window.setTimeout(() => void this.push(), 1200);
    }
  }

  /** Gắn thanh trạng thái đồng bộ vào trang và tự kết nối lại nếu còn phiên đăng nhập */
  mount(container: HTMLElement): void {
    this.bar = document.createElement('div');
    this.bar.className = 'sync-bar';
    container.prepend(this.bar);
    this.bar.addEventListener('click', (e) => {
      const action = (e.target as HTMLElement).closest<HTMLElement>('[data-sync]')?.dataset.sync;
      if (action === 'connect') void this.connect(true);
      if (action === 'retry') void this.push();
    });
    window.addEventListener('beforeunload', (e) => {
      if (this.dirty && this.status === 'syncing') e.preventDefault();
    });
    this.refreshStatus();
    const linked = this.link.get();
    const user = currentUser();
    if (linked && user && linked.email === user.email && hasLiveToken()) void this.connect(false);
  }

  private refreshStatus(): void {
    const user = currentUser();
    const linked = this.link.get();
    if (!user) this.setStatus('local');
    else if (this.ref) this.setStatus('synced');
    else this.setStatus('connect', linked && linked.email === user.email ? 'Bấm để mở lại kết nối với Google Sheets.' : '');
  }

  private setStatus(s: Status, message = ''): void {
    this.status = s;
    this.message = message;
    this.renderBar();
  }

  private renderBar(): void {
    if (!this.bar) return;
    const user = currentUser();
    const sheetLink = this.ref ? `<a href="${escapeHtml(this.ref.url)}" target="_blank" rel="noopener">Mở trong Google Sheets</a>` : '';
    const map: Record<Status, string> = {
      local: `<span class="sync-dot"></span><span>Dữ liệu đang lưu trên trình duyệt này.</span>
        <button type="button" class="btn btn-sm btn-primary" data-sync="connect">Đăng nhập Google để lưu vào Google Sheets</button>`,
      connect: `<span class="sync-dot"></span><span>Đã đăng nhập ${escapeHtml(user?.email ?? '')}. ${escapeHtml(this.message || 'Chưa kết nối với Google Sheets.')}</span>
        <button type="button" class="btn btn-sm btn-primary" data-sync="connect">Kết nối Google Sheets</button>`,
      syncing: `<span class="sync-dot is-busy"></span><span>Đang lưu vào Google Sheets…</span> ${sheetLink}`,
      synced: `<span class="sync-dot is-ok"></span><span>Đã đồng bộ với Google Sheets${this.message ? `, ${escapeHtml(this.message)}` : ''}.</span> ${sheetLink}`,
      error: `<span class="sync-dot is-error"></span><span>${escapeHtml(this.message)}</span>
        <button type="button" class="btn btn-sm" data-sync="${this.ref ? 'retry' : 'connect'}">Thử lại</button>`,
    };
    this.bar.dataset.status = this.status;
    this.bar.innerHTML = map[this.status];
  }

  /** Kết nối: đăng nhập nếu cần, tìm/tạo bảng tính, gộp dữ liệu trên máy với dữ liệu trên Sheets */
  async connect(interactive: boolean): Promise<void> {
    try {
      if (interactive && !hasLiveToken()) await signIn();
      this.setStatus('syncing');
      const specs = (Object.values(this.opts.tables) as TableDef<Row>[]).map((t) => ({ name: t.sheet, header: t.columns.map((c) => c.label) }));
      this.ref = await ensureSpreadsheet(this.opts.tag, this.opts.title, specs);
      const remote = {} as Data;
      for (const [name, def] of Object.entries(this.opts.tables) as [string, TableDef<Row>][]) {
        const rows = await readRows(this.ref.id, def.sheet);
        remote[name] = rows.map((r) => fromSheet(r, def.columns));
      }
      // Đã từng liên kết và không còn thay đổi chờ lưu: Sheets là bản chính (kể cả dòng đã xoá trên Sheets).
      // Lần đầu liên kết hoặc còn thay đổi chưa lưu: gộp để không mất dữ liệu nhập trên máy.
      const linked = this.link.get();
      const sameSheet = linked?.id === this.ref.id;
      const merged = (sameSheet && !this.pending.get() ? { ...this.opts.empty, ...remote } : mergeData(this.data as unknown as Data, remote)) as unknown as D;
      this.data = merged;
      this.local.set(merged);
      this.link.set({ email: currentUser()?.email ?? '', id: this.ref.id, url: this.ref.url });
      this.listeners.forEach((fn) => fn(merged));
      // Có dòng chỉ nằm trên máy này: đẩy lên để Sheets đầy đủ
      if (JSON.stringify(merged) !== JSON.stringify(remote)) await this.push();
      else this.setStatus('synced', `lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`);
    } catch (e) {
      this.ref = null;
      this.setStatus('error', e instanceof GoogleAuthError ? e.message : `Không kết nối được Google Sheets (${(e as Error).message}).`);
    }
  }

  private async push(): Promise<void> {
    if (!this.ref) return;
    this.dirty = false;
    this.setStatus('syncing');
    try {
      for (const [name, def] of Object.entries(this.opts.tables) as [string, TableDef<Row>][]) {
        const cols = def.columns;
        await writeRows(this.ref.id, def.sheet, cols.map((c) => c.label), ((this.data as unknown as Data)[name] ?? []).map((r) => cols.map((c) => r[c.key] ?? '')));
      }
      this.pending.set(false);
      this.setStatus('synced', `lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`);
    } catch (e) {
      this.dirty = true;
      const msg = e instanceof GoogleAuthError ? e.message : (e as Error).message;
      this.setStatus('error', `Chưa lưu được lên Google Sheets: ${msg} Dữ liệu vẫn còn trên trình duyệt.`);
      if (e instanceof GoogleAuthError) toast('Cần đăng nhập lại Google để tiếp tục lưu');
    }
  }
}

function fromSheet(r: Record<string, string>, cols: Column<Row>[]): Row {
  const out: Row = {};
  for (const c of cols) {
    const v = r[c.label] ?? '';
    out[c.key] = c.type === 'number' ? (v === '' ? 0 : Number(String(v).replace(',', '.')) || 0) : v;
  }
  return out;
}

/** Gộp theo cột "id": dòng có trên Sheets được ưu tiên (người dùng có thể đã sửa trực tiếp trên Sheets) */
function mergeData(local: Data, remote: Data): Data {
  const out: Data = {};
  for (const name of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const r = remote[name] ?? [];
    const l = local[name] ?? [];
    const hasId = [...r, ...l].every((x) => x.id !== undefined && x.id !== '');
    if (!hasId) {
      out[name] = r.length ? r : l;
      continue;
    }
    const ids = new Set(r.map((x) => String(x.id)));
    out[name] = [...r, ...l.filter((x) => !ids.has(String(x.id)))];
  }
  return out;
}

/** Mã ngẫu nhiên ngắn cho mỗi dòng dữ liệu */
export const newId = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
