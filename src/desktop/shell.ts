/**
 * Vỏ Desktop online: màn hình nền, cửa sổ (kéo, đổi cỡ, thu nhỏ, phóng to), thanh tác vụ, menu Start,
 * hộp thoại nhập/xác nhận và thông báo. Không phụ thuộc ứng dụng con cụ thể.
 */
import { escapeHtml } from '../ui';
import { localeTag } from '../i18n';
import type { SortKey } from '../calc/desktop';
import type { DesktopFs, FsNode } from './fs';
import { bindContextMenu, closeMenu, type MenuItem } from './menu';

export type Tr = (key: string, fallback?: string) => string;

export interface AppDef {
  id: string;
  name: () => string;
  /** Phần bên trong thẻ <svg viewBox="0 0 24 24"> */
  icon: string;
  /** Hiện biểu tượng trên màn hình nền */
  pinned?: boolean;
  open(d: Desktop, arg?: FsNode): void;
}

export interface WinOptions {
  app: string;
  title: string;
  icon: string;
  width?: number;
  height?: number;
  /** Mỗi khoá chỉ mở một cửa sổ; mở lại thì đưa cửa sổ cũ lên trước */
  key?: string;
  /** Trả false để huỷ việc đóng (ví dụ còn thay đổi chưa lưu) */
  beforeClose?: () => boolean | Promise<boolean>;
  onClose?: () => void;
}

export const svg = (inner: string, cls = 'wd-ico'): string =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

let winSeq = 0;

export class Win {
  readonly id = `wdw${++winSeq}`;
  readonly el: HTMLElement;
  readonly body: HTMLElement;
  readonly taskBtn: HTMLButtonElement;
  private titleEl: HTMLElement;
  private restoreRect: { left: string; top: string; width: string; height: string } | null = null;
  closed = false;

  constructor(private desk: Desktop, readonly opts: WinOptions) {
    const T = desk.T;
    const el = document.createElement('section');
    el.className = 'wd-win';
    el.id = this.id;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-labelledby', `${this.id}-t`);
    el.innerHTML = `
      <header class="wd-titlebar">
        ${svg(opts.icon)}
        <span class="wd-title" id="${this.id}-t"></span>
        <button type="button" class="wd-wbtn" data-act="min" title="${escapeHtml(T('minimize', 'Thu nhỏ'))}" aria-label="${escapeHtml(T('minimize', 'Thu nhỏ'))}">${svg('<path d="M6 17h12"/>')}</button>
        <button type="button" class="wd-wbtn" data-act="max" title="${escapeHtml(T('maximize', 'Phóng to'))}" aria-label="${escapeHtml(T('maximize', 'Phóng to'))}">${svg('<rect x="6" y="6" width="12" height="12" rx="1"/>')}</button>
        <button type="button" class="wd-wbtn wd-close" data-act="close" title="${escapeHtml(T('close', 'Đóng'))}" aria-label="${escapeHtml(T('close', 'Đóng'))}">${svg('<path d="M7 7l10 10M17 7 7 17"/>')}</button>
      </header>
      <div class="wd-wbody"></div>
      <div class="wd-resize" aria-hidden="true"></div>`;
    this.el = el;
    this.body = el.querySelector('.wd-wbody') as HTMLElement;
    this.titleEl = el.querySelector('.wd-title') as HTMLElement;
    this.setTitle(opts.title);

    const area = desk.layer.getBoundingClientRect();
    const w = Math.min(opts.width ?? 640, Math.max(280, area.width - 16));
    const h = Math.min(opts.height ?? 440, Math.max(220, area.height - 16));
    const n = desk.windows.length % 8;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.left = `${Math.max(0, Math.min(area.width - w, 40 + n * 28))}px`;
    el.style.top = `${Math.max(0, Math.min(area.height - h, 24 + n * 24))}px`;

    this.taskBtn = document.createElement('button');
    this.taskBtn.type = 'button';
    this.taskBtn.className = 'wd-task';
    this.taskBtn.dataset.win = this.id;
    this.taskBtn.innerHTML = `${svg(opts.icon)}<span></span>`;
    (this.taskBtn.lastElementChild as HTMLElement).textContent = opts.title;
    this.taskBtn.addEventListener('click', () => {
      if (this.el.hidden) this.focus();
      else if (desk.active === this) this.minimize();
      else this.focus();
    });

    el.addEventListener('pointerdown', () => this.focus(), true);
    el.querySelector('[data-act="min"]')?.addEventListener('click', () => this.minimize());
    el.querySelector('[data-act="max"]')?.addEventListener('click', () => this.toggleMax());
    el.querySelector('[data-act="close"]')?.addEventListener('click', () => void this.close());
    const bar = el.querySelector('.wd-titlebar') as HTMLElement;
    bar.addEventListener('dblclick', (e) => {
      if (!(e.target as HTMLElement).closest('button')) this.toggleMax();
    });
    this.drag(bar, 'move');
    bindContextMenu(desk.root, bar, (t) => (t.closest('button') ? null : desk.winMenu(this)));
    this.drag(el.querySelector('.wd-resize') as HTMLElement, 'resize');
    if (area.width < 640) this.toggleMax();
  }

  get maximized(): boolean {
    return this.restoreRect !== null;
  }

  setTitle(title: string): void {
    this.titleEl.textContent = title;
    if (this.taskBtn) (this.taskBtn.lastElementChild as HTMLElement).textContent = title;
  }

  focus(): void {
    this.el.hidden = false;
    this.desk.bringToFront(this);
  }

  minimize(): void {
    this.el.hidden = true;
    this.desk.bringToFront(null);
  }

  toggleMax(): void {
    const s = this.el.style;
    if (this.restoreRect) {
      Object.assign(s, this.restoreRect);
      this.restoreRect = null;
      this.el.classList.remove('is-max');
    } else {
      this.restoreRect = { left: s.left, top: s.top, width: s.width, height: s.height };
      Object.assign(s, { left: '0px', top: '0px', width: '100%', height: '100%' });
      this.el.classList.add('is-max');
    }
  }

  async close(force = false): Promise<boolean> {
    if (this.closed) return true;
    if (!force && this.opts.beforeClose && !(await this.opts.beforeClose())) return false;
    this.closed = true;
    this.el.remove();
    this.taskBtn.remove();
    this.desk.forget(this);
    this.opts.onClose?.();
    return true;
  }

  /** Kéo thanh tiêu đề để di chuyển, kéo góc dưới phải để đổi cỡ; giữ cửa sổ trong vùng màn hình */
  private drag(handle: HTMLElement, mode: 'move' | 'resize'): void {
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || (mode === 'move' && (e.target as HTMLElement).closest('button')) || this.restoreRect) return;
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const area = this.desk.layer.getBoundingClientRect();
      const start = { x: e.clientX, y: e.clientY, l: this.el.offsetLeft, t: this.el.offsetTop, w: this.el.offsetWidth, h: this.el.offsetHeight };
      const move = (ev: PointerEvent): void => {
        const dx = ev.clientX - start.x;
        const dy = ev.clientY - start.y;
        if (mode === 'move') {
          // Luôn chừa 60px thanh tiêu đề trong vùng nhìn thấy để còn kéo lại được
          this.el.style.left = `${Math.min(area.width - 60, Math.max(60 - start.w, start.l + dx))}px`;
          this.el.style.top = `${Math.min(area.height - 32, Math.max(0, start.t + dy))}px`;
        } else {
          this.el.style.width = `${Math.max(260, Math.min(area.width - start.l, start.w + dx))}px`;
          this.el.style.height = `${Math.max(180, Math.min(area.height - start.t, start.h + dy))}px`;
        }
      };
      const up = (): void => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    });
  }
}

export interface DeskSettings {
  theme: 'light' | 'dark';
  /** Mã hình nền có sẵn, hoặc "file:<id>" cho ảnh trong kho file */
  wallpaper: string;
  clock24: boolean;
  /** Cỡ biểu tượng trên màn hình nền */
  iconSize: 'small' | 'medium' | 'large';
  /** Cách sắp xếp biểu tượng trên màn hình nền */
  sortBy: SortKey;
}

/** Bộ nhớ tạm của Cắt / Sao chép */
export interface Clip {
  mode: 'copy' | 'cut';
  node: FsNode;
}

export const FS_ICON = {
  enter: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  exit: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
};

export const WALLPAPERS: Record<string, string> = {
  dawn: 'linear-gradient(135deg,#1e3c72 0%,#2a5298 45%,#7f9ed6 100%)',
  aurora: 'linear-gradient(160deg,#0f2027 0%,#203a43 40%,#2c7a6b 100%)',
  sunset: 'linear-gradient(135deg,#ff7e5f 0%,#feb47b 55%,#ffd8a8 100%)',
  lavender: 'linear-gradient(135deg,#654ea3 0%,#9d7ad8 50%,#eaafc8 100%)',
  forest: 'linear-gradient(160deg,#134e5e 0%,#3c8d5a 60%,#a8e063 100%)',
  graphite: 'linear-gradient(160deg,#232526 0%,#414345 100%)',
};

export class Desktop {
  readonly root: HTMLElement;
  readonly screen: HTMLElement;
  readonly layer: HTMLElement;
  readonly icons: HTMLElement;
  private tasks: HTMLElement;
  private startMenu: HTMLElement;
  private clock: HTMLElement;
  windows: Win[] = [];
  active: Win | null = null;
  private z = 10;
  private listeners = new Set<(folder: string) => void>();
  private wallUrl = '';
  private wallKey = '';
  rootId = '';
  clip: Clip | null = null;
  /** Chế độ toàn màn hình giả lập khi trình duyệt không cho (iPhone) */
  private pseudoFull = false;

  constructor(
    host: HTMLElement,
    readonly fs: DesktopFs,
    readonly T: Tr,
    readonly apps: AppDef[],
    public settings: DeskSettings,
    private saveSettings: (s: DeskSettings) => void,
  ) {
    host.innerHTML = `
      <div class="wd" tabindex="-1">
        <div class="wd-screen">
          <div class="wd-icons" role="list"></div>
          <div class="wd-layer"></div>
          <button type="button" class="wd-fsbtn" data-full></button>
        </div>
        <nav class="wd-start" hidden aria-label="${escapeHtml(T('start', 'Start'))}">
          <div class="wd-start-apps"></div>
          <div class="wd-start-foot"></div>
        </nav>
        <footer class="wd-taskbar">
          <button type="button" class="wd-startbtn" aria-haspopup="true" aria-expanded="false">${svg('<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>')}<span>${escapeHtml(T('start', 'Start'))}</span></button>
          <div class="wd-tasks"></div>
          <span class="wd-store" title="${escapeHtml(fs.kind === 'drive' ? T('storeDriveTip', 'File được lưu trong thư mục WFTools/Desktop của Google Drive') : T('storeLocalTip', 'File chỉ được lưu trong trình duyệt trên máy này'))}">${svg(fs.kind === 'drive' ? '<path d="M7 18a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.8-1.3A4.5 4.5 0 0 1 17.5 18Z"/>' : '<rect x="3" y="5" width="18" height="11" rx="1.5"/><path d="M8 20h8M12 16v4"/>')}<span>${escapeHtml(fs.kind === 'drive' ? 'Google Drive' : T('thisDevice', 'Máy này'))}</span></span>
          <button type="button" class="wd-traybtn" data-full></button>
          <button type="button" class="wd-clock" data-open="calendar"></button>
        </footer>
      </div>`;
    this.root = host.querySelector('.wd') as HTMLElement;
    this.screen = host.querySelector('.wd-screen') as HTMLElement;
    this.layer = host.querySelector('.wd-layer') as HTMLElement;
    this.icons = host.querySelector('.wd-icons') as HTMLElement;
    this.tasks = host.querySelector('.wd-tasks') as HTMLElement;
    this.startMenu = host.querySelector('.wd-start') as HTMLElement;
    this.clock = host.querySelector('.wd-clock') as HTMLElement;
    this.applySettings();

    const startBtn = host.querySelector('.wd-startbtn') as HTMLButtonElement;
    startBtn.addEventListener('click', () => this.toggleStart());
    this.root.addEventListener('pointerdown', (e) => {
      if (!this.startMenu.hidden && !(e.target as HTMLElement).closest('.wd-start,.wd-startbtn')) this.toggleStart(false);
    });
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.startMenu.hidden) {
        this.toggleStart(false);
        startBtn.focus();
      }
    });
    this.clock.addEventListener('click', () => this.app('calendar')?.open(this));
    this.root.querySelectorAll('.wd-fsbtn,.wd-traybtn').forEach((b) => b.addEventListener('click', () => this.toggleFullscreen()));
    const onFull = (): void => this.paintFull();
    document.addEventListener('fullscreenchange', onFull);
    document.addEventListener('webkitfullscreenchange', onFull);
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.pseudoFull && !this.root.querySelector('.wd-modal,.wd-menu') && this.startMenu.hidden) this.toggleFullscreen();
      if (e.key === 'F11') {
        e.preventDefault();
        this.toggleFullscreen();
      }
    });
    const bar = host.querySelector('.wd-taskbar') as HTMLElement;
    bindContextMenu(this.root, bar, (t) => {
      const task = t.closest<HTMLElement>('.wd-task');
      const w = task && this.windows.find((x) => x.id === task.dataset.win);
      if (w) return this.winMenu(w);
      if (t.closest('.wd-startbtn,.wd-clock,.wd-traybtn')) return null;
      return this.taskbarMenu();
    });
    this.renderStart();
    this.tick();
    window.setInterval(() => this.tick(), 15_000);
  }

  app(id: string): AppDef | undefined {
    return this.apps.find((a) => a.id === id);
  }

  /* ---------- Cài đặt ---------- */

  setSettings(patch: Partial<DeskSettings>): void {
    this.settings = { ...this.settings, ...patch };
    this.applySettings();
    this.saveSettings(this.settings);
  }

  private applySettings(): void {
    const s = this.settings;
    this.root.dataset.theme = s.theme;
    this.icons.dataset.size = s.iconSize;
    this.tick();
    // Hình nền không đổi thì giữ nguyên, không tải lại ảnh
    if (s.wallpaper === this.wallKey) return;
    this.wallKey = s.wallpaper;
    if (this.wallUrl) URL.revokeObjectURL(this.wallUrl);
    this.wallUrl = '';
    if (s.wallpaper.startsWith('file:')) {
      const id = s.wallpaper.slice(5);
      this.screen.style.background = WALLPAPERS.dawn;
      this.fs.read(id).then((b) => {
        if (this.settings.wallpaper !== s.wallpaper) return;
        this.wallUrl = URL.createObjectURL(b);
        this.screen.style.background = `center / cover no-repeat url("${this.wallUrl}")`;
      }, () => undefined);
    } else {
      this.screen.style.background = WALLPAPERS[s.wallpaper] ?? WALLPAPERS.dawn;
    }
  }

  private tick(): void {
    const now = new Date();
    const loc = localeTag();
    const time = now.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', hour12: !this.settings.clock24 });
    const date = now.toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric' });
    this.clock.innerHTML = `<span>${escapeHtml(time)}</span><small>${escapeHtml(date)}</small>`;
    this.clock.setAttribute('aria-label', `${time} ${date}`);
  }

  /* ---------- Menu Start ---------- */

  private renderStart(): void {
    const box = this.startMenu.querySelector('.wd-start-apps') as HTMLElement;
    box.innerHTML = this.apps
      .map((a) => `<button type="button" class="wd-start-item" data-app="${a.id}">${svg(a.icon)}<span>${escapeHtml(a.name())}</span></button>`)
      .join('');
    box.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-app]');
      if (!b) return;
      this.toggleStart(false);
      this.app(b.dataset.app ?? '')?.open(this);
    });
    const foot = this.startMenu.querySelector('.wd-start-foot') as HTMLElement;
    foot.innerHTML = `<button type="button" class="wd-start-item" data-full></button>`;
    foot.querySelector('[data-full]')?.addEventListener('click', () => {
      this.toggleStart(false);
      this.toggleFullscreen();
    });
    this.paintFull();
  }

  /* ---------- Toàn màn hình ---------- */

  isFullscreen(): boolean {
    const doc = document as Document & { webkitFullscreenElement?: Element | null };
    return this.pseudoFull || (doc.fullscreenElement ?? doc.webkitFullscreenElement) === this.root;
  }

  /** Bật/tắt toàn màn hình; trình duyệt không hỗ trợ (iPhone) thì phủ kín cửa sổ trình duyệt */
  toggleFullscreen(): void {
    closeMenu();
    const doc = document as Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
    const el = this.root as HTMLElement & { webkitRequestFullscreen?: () => void };
    if (this.pseudoFull) {
      this.pseudoFull = false;
    } else if (doc.fullscreenElement ?? doc.webkitFullscreenElement) {
      if (doc.exitFullscreen) void doc.exitFullscreen().catch(() => undefined);
      else doc.webkitExitFullscreen?.();
    } else if (el.requestFullscreen && document.fullscreenEnabled !== false) {
      el.requestFullscreen().catch(() => {
        this.pseudoFull = true;
        this.paintFull();
      });
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else {
      this.pseudoFull = true;
    }
    this.paintFull();
  }

  private paintFull(): void {
    const on = this.isFullscreen();
    this.root.classList.toggle('is-pseudo-full', this.pseudoFull);
    document.documentElement.classList.toggle('wd-noscroll', this.pseudoFull);
    const label = on ? this.T('exitFullscreen', 'Thoát toàn màn hình') : this.T('fullscreen', 'Toàn màn hình');
    this.root.querySelectorAll<HTMLElement>('[data-full]').forEach((b) => {
      if (b.classList.contains('wd-start-item')) b.innerHTML = `${svg(on ? FS_ICON.exit : FS_ICON.enter)}<span>${escapeHtml(label)}</span>`;
      else {
        b.innerHTML = svg(on ? FS_ICON.exit : FS_ICON.enter);
        b.title = label;
        b.setAttribute('aria-label', label);
        b.setAttribute('aria-pressed', String(on));
      }
    });
  }

  /* ---------- Menu chuột phải dùng chung ---------- */

  fullscreenItem(): MenuItem {
    const on = this.isFullscreen();
    return { label: on ? this.T('exitFullscreen', 'Thoát toàn màn hình') : this.T('fullscreen', 'Toàn màn hình'), icon: on ? FS_ICON.exit : FS_ICON.enter, hint: 'F11', run: () => this.toggleFullscreen() };
  }

  winMenu(w: Win): MenuItem[] {
    const T = this.T;
    const min = w.el.hidden === true;
    return [
      { label: T('restore', 'Khôi phục'), icon: '<rect x="5" y="8" width="11" height="11" rx="1"/><path d="M8 8V5h11v11h-3"/>', disabled: !min && !w.maximized, run: () => (min ? w.focus() : w.toggleMax()) },
      { label: T('minimize', 'Thu nhỏ'), icon: '<path d="M6 17h12"/>', disabled: min, run: () => w.minimize() },
      { label: T('maximize', 'Phóng to'), icon: '<rect x="6" y="6" width="12" height="12" rx="1"/>', disabled: w.maximized && !min, run: () => {
        w.focus();
        if (!w.maximized) w.toggleMax();
      } },
      { sep: true },
      { label: T('close', 'Đóng'), icon: '<path d="M7 7l10 10M17 7 7 17"/>', strong: true, run: () => void w.close() },
    ];
  }

  private taskbarMenu(): MenuItem[] {
    const T = this.T;
    return [
      { label: T('showDesktop', 'Hiện màn hình nền'), icon: '<rect x="3" y="4" width="18" height="13" rx="1.5"/><path d="M8 21h8"/>', disabled: !this.windows.some((w) => !w.el.hidden), run: () => this.showDesktop() },
      { label: T('closeAll', 'Đóng tất cả cửa sổ'), icon: '<path d="M7 7l10 10M17 7 7 17"/>', disabled: !this.windows.length, run: () => void this.closeAll() },
      { sep: true },
      this.fullscreenItem(),
      { label: T('appSettings', 'Cài đặt'), icon: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>', run: () => this.app('settings')?.open(this) },
    ];
  }

  showDesktop(): void {
    for (const w of this.windows) w.el.hidden = true;
    this.bringToFront(null);
  }

  /** Đặt bộ nhớ tạm Cắt/Sao chép và báo cho các cửa sổ vẽ lại dấu "đang cắt" */
  setClip(c: Clip | null): void {
    this.clip = c;
    this.changed('clip');
  }

  toggleStart(show: boolean = this.startMenu.hidden === true): void {
    this.startMenu.hidden = !show;
    this.root.querySelector('.wd-startbtn')?.setAttribute('aria-expanded', String(show));
    if (show) (this.startMenu.querySelector('button') as HTMLButtonElement | null)?.focus();
  }

  /* ---------- Cửa sổ ---------- */

  openWindow(opts: WinOptions): Win {
    if (opts.key) {
      const found = this.windows.find((w) => w.opts.key === opts.key);
      if (found) {
        found.focus();
        return found;
      }
    }
    const w = new Win(this, opts);
    this.windows.push(w);
    this.layer.appendChild(w.el);
    this.tasks.appendChild(w.taskBtn);
    w.focus();
    return w;
  }

  bringToFront(w: Win | null): void {
    this.active = w;
    for (const x of this.windows) {
      x.el.classList.toggle('is-active', x === w);
      x.taskBtn.classList.toggle('is-active', x === w);
      x.taskBtn.classList.toggle('is-min', x.el.hidden === true);
    }
    if (w) w.el.style.zIndex = String(++this.z);
  }

  forget(w: Win): void {
    this.windows = this.windows.filter((x) => x !== w);
    if (this.active === w) this.bringToFront(this.windows[this.windows.length - 1] ?? null);
  }

  /** Đóng mọi cửa sổ; trả false nếu người dùng giữ lại một cửa sổ còn thay đổi chưa lưu */
  async closeAll(): Promise<boolean> {
    for (const w of [...this.windows]) if (!(await w.close())) return false;
    return true;
  }

  hasUnsaved(): boolean {
    return this.root.querySelector('.wd-win.is-dirty') !== null;
  }

  /* ---------- Kho file ---------- */

  onChange(cb: (folder: string) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  changed(folder: string): void {
    this.listeners.forEach((cb) => cb(folder));
  }

  /** Chạy một thao tác, báo lỗi dễ hiểu thay vì để lỗi trôi đi */
  async run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    this.root.classList.add('is-busy');
    try {
      return await fn();
    } catch (e) {
      this.notify((e as Error).message || this.T('error', 'Đã có lỗi. Hãy thử lại.'), true);
      return undefined;
    } finally {
      this.root.classList.remove('is-busy');
    }
  }

  /** Như run() cho thao tác không trả về giá trị: true nếu thành công */
  async runOk(fn: () => Promise<unknown>): Promise<boolean> {
    return (await this.run(async () => {
      await fn();
      return true;
    })) === true;
  }

  /* ---------- Hộp thoại & thông báo ---------- */

  notify(msg: string, error = false): void {
    const n = document.createElement('div');
    n.className = `wd-toast${error ? ' is-error' : ''}`;
    n.setAttribute('role', error ? 'alert' : 'status');
    n.textContent = msg;
    this.root.appendChild(n);
    window.setTimeout(() => n.remove(), error ? 6000 : 2600);
  }

  private modal(inner: string, setup: (box: HTMLElement, done: (v: string | null) => void) => void): Promise<string | null> {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'wd-modal';
      wrap.innerHTML = `<form class="wd-dialog" role="alertdialog" aria-modal="true">${inner}</form>`;
      this.root.appendChild(wrap);
      const prev = document.activeElement as HTMLElement | null;
      const done = (v: string | null): void => {
        wrap.remove();
        prev?.focus?.();
        resolve(v);
      };
      const box = wrap.firstElementChild as HTMLElement;
      box.querySelector('[data-cancel]')?.addEventListener('click', () => done(null));
      wrap.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          done(null);
        }
      });
      setup(box, done);
    });
  }

  prompt(title: string, value = '', okLabel = this.T('ok', 'OK'), validate?: (v: string) => string | null): Promise<string | null> {
    return this.modal(
      `<label class="wd-dlabel">${escapeHtml(title)}<input type="text" class="wd-input" maxlength="120" spellcheck="false" /></label>
       <p class="wd-derr" role="alert"></p>
       <div class="wd-dactions"><button type="button" class="btn btn-sm" data-cancel>${escapeHtml(this.T('cancel', 'Huỷ'))}</button><button type="submit" class="btn btn-sm btn-primary">${escapeHtml(okLabel)}</button></div>`,
      (box, done) => {
        const input = box.querySelector('input') as HTMLInputElement;
        const err = box.querySelector('.wd-derr') as HTMLElement;
        input.value = value;
        input.focus();
        // Chọn sẵn phần tên, không chọn phần mở rộng, để gõ đè cho nhanh
        const dot = value.lastIndexOf('.');
        input.setSelectionRange(0, dot > 0 ? dot : value.length);
        box.addEventListener('submit', (e) => {
          e.preventDefault();
          const v = input.value.trim();
          const msg = validate?.(v) ?? null;
          if (msg) {
            err.textContent = msg;
            input.focus();
            return;
          }
          done(v);
        });
      },
    );
  }

  /** Hộp thông tin dạng bảng (Thuộc tính) */
  async info(title: string, icon: string, rows: [string, string][]): Promise<void> {
    await this.modal(
      `<div class="wd-props-head">${icon}<strong>${escapeHtml(title)}</strong></div>
       <dl class="wd-props">${rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>
       <div class="wd-dactions"><button type="submit" class="btn btn-sm btn-primary">${escapeHtml(this.T('ok', 'OK'))}</button></div>`,
      (box, done) => {
        (box.querySelector('[type="submit"]') as HTMLButtonElement).focus();
        box.addEventListener('submit', (e) => {
          e.preventDefault();
          done('ok');
        });
      },
    );
  }

  async confirm(message: string, okLabel: string, danger = false): Promise<boolean> {
    const r = await this.modal(
      `<p class="wd-dmsg">${escapeHtml(message)}</p>
       <div class="wd-dactions"><button type="button" class="btn btn-sm" data-cancel>${escapeHtml(this.T('cancel', 'Huỷ'))}</button><button type="submit" class="btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}">${escapeHtml(okLabel)}</button></div>`,
      (box, done) => {
        (box.querySelector('[type="submit"]') as HTMLButtonElement).focus();
        box.addEventListener('submit', (e) => {
          e.preventDefault();
          done('yes');
        });
      },
    );
    return r === 'yes';
  }

  /** Hộp thoại ba lựa chọn cho thay đổi chưa lưu: lưu / không lưu / huỷ */
  async askSave(name: string): Promise<'save' | 'discard' | null> {
    const T = this.T;
    const r = await this.modal(
      `<p class="wd-dmsg">${escapeHtml(T('unsavedQ', 'Lưu thay đổi của "{name}"?').replace('{name}', name))}</p>
       <div class="wd-dactions"><button type="button" class="btn btn-sm" data-cancel>${escapeHtml(T('cancel', 'Huỷ'))}</button><button type="button" class="btn btn-sm" data-discard>${escapeHtml(T('dontSave', 'Không lưu'))}</button><button type="submit" class="btn btn-sm btn-primary">${escapeHtml(T('save', 'Lưu'))}</button></div>`,
      (box, done) => {
        (box.querySelector('[type="submit"]') as HTMLButtonElement).focus();
        box.querySelector('[data-discard]')?.addEventListener('click', () => done('discard'));
        box.addEventListener('submit', (e) => {
          e.preventDefault();
          done('save');
        });
      },
    );
    return r === 'save' || r === 'discard' ? r : null;
  }
}
