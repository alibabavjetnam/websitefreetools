/**
 * Kho dữ liệu cho một công cụ: luôn lưu trên trình duyệt; khi người dùng kết nối Google thì đồng bộ
 * với một bảng tính trong Google Drive của họ (Google Sheets là bản chính, tự lưu sau mỗi thay đổi).
 */
import { GoogleAuthError, currentUser, hasLiveToken, signIn } from './auth';
import { ensureSpreadsheet, findSpreadsheet, readRows, writeRows, type SpreadsheetRef } from './sheets';
import { escapeHtml, storage, toast } from '../ui';
import { t, tf, localeTag } from '../i18n';

export interface Column<T> {
  key: keyof T & string;
  label: string;
  /** Tên cột cũ (tiếng Việt) để vẫn đọc được bảng tính tạo từ phiên bản trước */
  legacy?: string;
  type?: 'number' | 'text';
}

export interface TableDef<T> {
  sheet: string;
  /** Tên trang tính cũ (tiếng Việt): nếu bảng tính còn tên này thì được đổi sang tên mới, không mất dữ liệu */
  legacySheet?: string;
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
  /** Đã kết nối Google trong phiên này (có thể chưa có bảng tính nếu người dùng chưa nhập gì) */
  private connected = false;
  private connecting = false;

  constructor(private opts: StoreOptions<D>) {
    this.local = storage<D>(`data:${opts.tag}`, opts.empty);
    this.link = storage<{ email: string; id: string; url: string } | null>(`link:${opts.tag}`, null);
    this.pending = storage<boolean>(`pending:${opts.tag}`, false);
    this.data = { ...opts.empty, ...this.local.get() };
    // Đăng nhập ở menu ngang đã xin luôn quyền Drive: kết nối ngay, không bắt bấm thêm lần nữa
    window.addEventListener('wft-auth-change', () => {
      if (!currentUser()) {
        this.ref = null;
        this.connected = false;
        this.setStatus('local');
      } else if (this.bar && !this.connected && hasLiveToken()) void this.connect(false);
      else this.refreshStatus();
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
    if (this.connected) {
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
    if (currentUser() && hasLiveToken()) void this.connect(false);
  }

  private refreshStatus(): void {
    const user = currentUser();
    const linked = this.link.get();
    if (!user) this.setStatus('local');
    else if (this.connected) this.setStatus('synced');
    // Còn tên tài khoản nhưng phiên Google đã hết (đóng trình duyệt, quá 1 giờ): cần một cú bấm để Google cấp phiên mới
    else this.setStatus('connect', linked && linked.email === user.email ? t('sync.expired', 'Phiên kết nối Google đã hết hạn.') : t('sync.notConnected', 'Chưa kết nối với Google Sheets.'));
  }

  private setStatus(s: Status, message = ''): void {
    this.status = s;
    this.message = message;
    this.renderBar();
  }

  private renderBar(): void {
    if (!this.bar) return;
    const user = currentUser();
    const sheetLink = this.ref ? `<a href="${escapeHtml(this.ref.url)}" target="_blank" rel="noopener">${escapeHtml(t('sync.sheetLink', 'Mở trong Google Sheets'))}</a>` : '';
    const map: Record<Status, string> = {
      local: `<span class="sync-dot"></span><span>${escapeHtml(t('sync.local', 'Dữ liệu đang lưu trên trình duyệt này.'))}</span>
        <button type="button" class="btn btn-sm btn-primary" data-sync="connect">${escapeHtml(t('sync.signIn', 'Đăng nhập Google để lưu vào Google Sheets'))}</button>`,
      connect: `<span class="sync-dot"></span><span>${escapeHtml(tf('sync.signedIn', 'Đã đăng nhập {email}. {message}', { email: user?.email ?? '', message: this.message || t('sync.notConnected', 'Chưa kết nối với Google Sheets.') }))}</span>
        <button type="button" class="btn btn-sm btn-primary" data-sync="connect">${escapeHtml(t('sync.continue', 'Tiếp tục đồng bộ'))}</button>`,
      syncing: `<span class="sync-dot is-busy"></span><span>${escapeHtml(t('sync.saving', 'Đang lưu vào Google Sheets…'))}</span> ${sheetLink}`,
      synced: this.ref
        ? `<span class="sync-dot is-ok"></span><span>${escapeHtml(this.message ? tf('sync.syncedAt', 'Đã đồng bộ với Google Sheets, lúc {time}.', { time: this.message }) : t('sync.synced', 'Đã đồng bộ với Google Sheets.'))}</span> ${sheetLink}`
        : `<span class="sync-dot is-ok"></span><span>${escapeHtml(t('sync.ready', 'Đã kết nối Google. Bảng tính sẽ được tạo trong Drive của bạn khi bạn thêm dữ liệu đầu tiên.'))}</span>`,
      error: `<span class="sync-dot is-error"></span><span>${escapeHtml(this.message)}</span>
        <button type="button" class="btn btn-sm" data-sync="${this.connected ? 'retry' : 'connect'}">${escapeHtml(t('sync.retry', 'Thử lại'))}</button>`,
    };
    this.bar.dataset.status = this.status;
    this.bar.innerHTML = map[this.status];
  }

  /** Kết nối: đăng nhập nếu cần, tìm/tạo bảng tính, gộp dữ liệu trên máy với dữ liệu trên Sheets */
  async connect(interactive: boolean): Promise<void> {
    if (this.connecting) return;
    this.connecting = true;
    try {
      if (interactive && !hasLiveToken()) await signIn();
      this.setStatus('syncing');
      const found = await findSpreadsheet(this.opts.tag, this.specs());
      if (!found) {
        // Chưa có bảng tính: chỉ tạo khi có dữ liệu, tránh rải file trống vào Drive khi người dùng chỉ ghé xem
        this.connected = true;
        if (this.hasData()) await this.push();
        else this.setStatus('synced');
        return;
      }
      this.ref = found;
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
      this.connected = true;
      this.listeners.forEach((fn) => fn(merged));
      // Có dòng chỉ nằm trên máy này: đẩy lên để Sheets đầy đủ
      if (JSON.stringify(merged) !== JSON.stringify(remote)) await this.push();
      else this.setStatus('synced', new Date().toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      this.ref = null;
      this.connected = false;
      this.setStatus('error', e instanceof GoogleAuthError ? e.message : tf('sync.connectFail', 'Không kết nối được Google Sheets ({detail}).', { detail: (e as Error).message }));
    } finally {
      this.connecting = false;
    }
  }

  private specs() {
    return (Object.values(this.opts.tables) as TableDef<Row>[]).map((t) => ({ name: t.sheet, legacyName: t.legacySheet, header: t.columns.map((c) => c.label) }));
  }

  private hasData(): boolean {
    return Object.values(this.data as unknown as Data).some((rows) => rows.length > 0);
  }

  private async push(): Promise<void> {
    if (!this.connected) return;
    this.dirty = false;
    this.setStatus('syncing');
    try {
      if (!this.ref) {
        this.ref = await ensureSpreadsheet(this.opts.tag, this.opts.title, this.specs());
        this.link.set({ email: currentUser()?.email ?? '', id: this.ref.id, url: this.ref.url });
      }
      for (const [name, def] of Object.entries(this.opts.tables) as [string, TableDef<Row>][]) {
        const cols = def.columns;
        await writeRows(this.ref.id, def.sheet, cols.map((c) => c.label), ((this.data as unknown as Data)[name] ?? []).map((r) => cols.map((c) => r[c.key] ?? '')));
      }
      this.pending.set(false);
      this.setStatus('synced', new Date().toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      this.dirty = true;
      const msg = e instanceof GoogleAuthError ? e.message : (e as Error).message;
      this.setStatus('error', tf('sync.saveFail', 'Chưa lưu được lên Google Sheets: {detail} Dữ liệu vẫn còn trên trình duyệt.', { detail: msg }));
      if (e instanceof GoogleAuthError) toast(t('sync.reauth', 'Cần đăng nhập lại Google để tiếp tục lưu'));
    }
  }
}

function fromSheet(r: Record<string, string>, cols: Column<Row>[]): Row {
  const out: Row = {};
  for (const c of cols) {
    const v = c.label in r ? r[c.label] : c.legacy && c.legacy in r ? r[c.legacy] : '';
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
