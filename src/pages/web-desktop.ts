import { mountLayout } from '../layout';
import { $, escapeHtml, storage } from '../ui';
import { pageText } from '../i18n';
import { GoogleAuthError, currentUser, getToken, hasLiveToken, signIn, signOut } from '../google/auth';
import { DriveFs, LocalFs, SETTINGS_FILE, type DesktopFs } from '../desktop/fs';
import { Desktop, WALLPAPERS, type DeskSettings } from '../desktop/shell';
import { calcApp, calendarApp, filesApp, imageApp, mountDesktopIcons, nameApps, notepadApp, pdfApp, settingsApp, trashApp } from '../desktop/apps';

mountLayout({ activeTool: 'web-desktop' });
const T = pageText();
const host = $('#tool-root');
const local = storage<DeskSettings>('desktop-settings', { theme: 'light', wallpaper: 'dawn', clock24: true, iconSize: 'medium', sortBy: 'name' });

function sanitize(s: Partial<DeskSettings>): DeskSettings {
  const base = local.get();
  const wall = typeof s.wallpaper === 'string' && (s.wallpaper in WALLPAPERS || /^file:[\w-]+$/.test(s.wallpaper)) ? s.wallpaper : base.wallpaper;
  const size = (v: unknown): DeskSettings['iconSize'] | null => (v === 'small' || v === 'medium' || v === 'large' ? v : null);
  const sort = (v: unknown): DeskSettings['sortBy'] | null => (v === 'name' || v === 'date' || v === 'size' || v === 'type' ? v : null);
  return {
    theme: s.theme === 'dark' ? 'dark' : s.theme === 'light' ? 'light' : base.theme,
    wallpaper: wall,
    clock24: typeof s.clock24 === 'boolean' ? s.clock24 : base.clock24,
    iconSize: size(s.iconSize) ?? size(base.iconSize) ?? 'medium',
    sortBy: sort(s.sortBy) ?? sort(base.sortBy) ?? 'name',
  };
}

/** Cài đặt nằm trong file ẩn ở gốc Desktop trên Drive để dùng chung giữa các máy; luôn có bản sao ở trình duyệt */
async function loadSettings(fs: DesktopFs, root: string): Promise<{ settings: DeskSettings; fileId: string }> {
  if (fs.kind !== 'drive') return { settings: sanitize(local.get()), fileId: '' };
  const f = (await fs.list(root)).find((n) => n.name === SETTINGS_FILE);
  if (!f) return { settings: sanitize(local.get()), fileId: '' };
  try {
    return { settings: sanitize(JSON.parse(await (await fs.read(f.id)).text()) as Partial<DeskSettings>), fileId: f.id };
  } catch {
    return { settings: sanitize(local.get()), fileId: f.id };
  }
}

function settingsSaver(fs: DesktopFs, root: string, fileId: string): (s: DeskSettings) => void {
  let timer = 0;
  let id = fileId;
  return (s) => {
    local.set(s);
    if (fs.kind !== 'drive') return;
    window.clearTimeout(timer);
    // Gộp các lần đổi liên tiếp (bấm thử nhiều hình nền) thành một lần ghi lên Drive
    timer = window.setTimeout(async () => {
      const blob = new Blob([JSON.stringify(s)], { type: 'application/json' });
      try {
        id = id ? (await fs.writeFile(id, blob)).id : (await fs.createFile(root, SETTINGS_FILE, blob)).id;
      } catch {
        /* cài đặt vẫn còn trong trình duyệt; lần sau sẽ ghi lại */
      }
    }, 1500);
  };
}

function gate(title: string, body: string, button: string, onClick: () => void, secondary?: { text: string; run: () => void }): void {
  host.innerHTML = `
    <div class="wd-gate panel">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(body)}</p>
      <p class="wd-gate-err" role="alert"></p>
      <div class="row">
        <button type="button" class="btn btn-primary" data-go>${escapeHtml(button)}</button>
        ${secondary ? `<button type="button" class="btn" data-alt>${escapeHtml(secondary.text)}</button>` : ''}
      </div>
    </div>`;
  host.querySelector('[data-go]')?.addEventListener('click', onClick);
  if (secondary) host.querySelector('[data-alt]')?.addEventListener('click', secondary.run);
}

const showGateError = (e: unknown): void => {
  const el = host.querySelector('.wd-gate-err');
  if (el) el.textContent = e instanceof GoogleAuthError ? e.message : T('error', 'Đã có lỗi. Hãy thử lại.');
};

let desk: Desktop | null = null;

async function start(fs: DesktopFs): Promise<void> {
  host.innerHTML = `<p class="wd-loading">${escapeHtml(T('loading', 'Đang tải…'))}</p>`;
  let root: string;
  let loaded: { settings: DeskSettings; fileId: string };
  try {
    root = await fs.root();
    loaded = await loadSettings(fs, root);
  } catch (e) {
    gate(T('loadFailTitle', 'Chưa mở được Desktop'), (e as Error).message || T('error', 'Đã có lỗi. Hãy thử lại.'), T('retry', 'Thử lại'), () => void start(fs));
    return;
  }
  const user = currentUser();
  const apps = [
    filesApp,
    notepadApp,
    imageApp,
    pdfApp,
    calcApp,
    calendarApp,
    trashApp,
    settingsApp({
      label: () => (fs.kind === 'drive' ? T('storedDrive', 'Đang lưu vào Google Drive của {email}, thư mục WFTools/Desktop.').replace('{email}', user?.email ?? '') : T('storedLocal', 'Đang lưu trong trình duyệt trên máy này. Xoá dữ liệu trình duyệt sẽ mất file; đăng nhập Google để lưu vào Drive.')),
      action: () =>
        fs.kind === 'drive'
          ? { text: T('signOut', 'Đăng xuất Google'), run: () => void switchAccount(() => signOut()) }
          : { text: T('signIn', 'Đăng nhập Google để lưu vào Drive'), run: () => void switchAccount(() => signIn()) },
    }),
  ];
  nameApps(apps, T);
  desk = new Desktop(host, fs, T, apps, loaded.settings, settingsSaver(fs, root, loaded.fileId));
  desk.rootId = root;
  mountDesktopIcons(desk);
}

/** Đăng nhập/đăng xuất đổi nơi lưu: đóng hết cửa sổ (hỏi lưu nếu cần) rồi tải lại trang để làm sạch trạng thái */
async function switchAccount(fn: () => unknown): Promise<void> {
  if (desk && !(await desk.closeAll())) return;
  try {
    await fn();
  } catch (e) {
    desk?.notify(e instanceof GoogleAuthError ? e.message : T('error', 'Đã có lỗi. Hãy thử lại.'), true);
    return;
  }
  location.reload();
}

window.addEventListener('beforeunload', (e) => {
  if (desk?.hasUnsaved()) e.preventDefault();
});
// Đăng nhập/đăng xuất từ menu trên cùng của trang cũng phải đổi nơi lưu
let booted = false;
window.addEventListener('wft-auth-change', () => {
  if (booted && !desk?.hasUnsaved()) location.reload();
});

function boot(): void {
  booted = true;
  if (!currentUser()) {
    gate(
      T('gateTitle', 'Chọn nơi lưu file của bạn'),
      T('gateBody', 'Đăng nhập Google để mọi file bạn tạo trên Desktop được lưu trong thư mục WFTools/Desktop của Google Drive và mở được trên mọi máy. WFTools chỉ thấy các file do chính nó tạo. Hoặc dùng thử ngay, file chỉ lưu trong trình duyệt này.'),
      T('signIn', 'Đăng nhập Google để lưu vào Drive'),
      async () => {
        try {
          await signIn();
          location.reload();
        } catch (e) {
          showGateError(e);
        }
      },
      { text: T('useLocal', 'Dùng thử, lưu trên máy này'), run: () => void start(new LocalFs()) },
    );
    return;
  }
  if (hasLiveToken()) {
    void start(new DriveFs());
    return;
  }
  // Phiên Google đã hết hạn: mở lại cửa sổ Google phải đi từ cú bấm, nếu không trình duyệt chặn
  gate(T('reconnectTitle', 'Kết nối lại Google Drive'), T('reconnectBody', 'Phiên Google đã hết hạn. Bấm nút bên dưới để mở lại các file của bạn.'), T('reconnect', 'Kết nối lại'), async () => {
    try {
      await getToken();
      void start(new DriveFs());
    } catch (e) {
      showGateError(e);
    }
  }, { text: T('useLocal', 'Dùng thử, lưu trên máy này'), run: () => void start(new LocalFs()) });
}

boot();
