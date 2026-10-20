import './styles.css';
import { GROUPS, TOOLS, type ToolInfo } from './tools';
import { lineIcon } from './icons';
import { GoogleAuthError, currentUser, signIn, signOut } from './google/auth';
import { encodeQr, qrToSvg } from './lib/qr';
import { barcodeToSvg, encodeBarcode } from './lib/barcode';

/** Đường dẫn về thư mục gốc, khai báo bằng data-root trên <body> ("." hoặc "..") */
export function rootPath(): string {
  return document.body.dataset.root ?? '.';
}

export function toolHref(tool: ToolInfo): string {
  return `${rootPath()}/${tool.path}`;
}

/** Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu ("ma qr" vẫn tìm ra "Mã QR") */
export function foldText(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

/** Biểu tượng công cụ: QR và mã vạch được vẽ bằng chính mã thật, còn lại dùng biểu tượng nét */
export function toolIcon(tool: ToolInfo): string {
  if (tool.id === 'qr-code' && tool.iconSample) {
    return qrToSvg(encodeQr(tool.iconSample, 'L'), { margin: 0, fg: 'currentColor', bg: 'transparent', px: 28 });
  }
  if (tool.id === 'barcode' && tool.iconSample) {
    const svg = barcodeToSvg(encodeBarcode('CODE39', tool.iconSample), {
      moduleWidth: 1, height: 40, showText: false, quietZone: 0, fg: 'currentColor', bg: 'transparent',
    });
    return svg.replace(/width="[\d.]+" height="[\d.]+"/, 'width="28" height="28" preserveAspectRatio="none"');
  }
  return lineIcon(tool.id);
}

function escapeHtml(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] as string);
}

function renderHeader(active: string): string {
  const root = rootPath();
  const link = (href: string, label: string, key: string) =>
    `<a href="${href}" class="topnav-link"${key === active ? ' aria-current="page"' : ''}>${label}</a>`;
  return `
    <a class="skip-link" href="#content">Bỏ qua menu</a>
    <header class="topbar">
      <div class="topbar-inner">
        <a href="${root}/index.html" class="brand" aria-label="WFTools, về trang chủ">
          <span class="brand-mark" aria-hidden="true"></span>
          <span class="brand-name">WFTools</span>
        </a>
        <nav class="topnav" aria-label="Menu chính">
          ${link(`${root}/index.html`, 'Trang chủ', 'home')}
          ${link(`${root}/index.html#cong-cu`, 'Tất cả công cụ', 'tools')}
          ${link(`${root}/index.html#gioi-thieu`, 'Giới thiệu', 'about')}
          ${link(`${root}/index.html#huong-dan`, 'Hướng dẫn', 'guide')}
        </nav>
        <div class="account" id="account"></div>
        <button class="sidebar-toggle" type="button" aria-controls="sidebar" aria-expanded="false">Công cụ</button>
      </div>
    </header>`;
}

function renderSidebar(activeTool?: string): string {
  const root = rootPath();
  const groups = GROUPS.map((g) => {
    const items = TOOLS.filter((t) => t.group === g.id)
      .map(
        (t) => `
        <li data-name="${escapeHtml(foldText(`${t.name} ${t.description}`))}">
          <a href="${toolHref(t)}" class="side-link"${t.id === activeTool ? ' aria-current="page"' : ''}>
            <span class="side-icon" aria-hidden="true">${toolIcon(t)}</span>
            <span>${escapeHtml(t.name)}</span>
          </a>
        </li>`,
      )
      .join('');
    if (!items) return '';
    return `<div class="side-group"><h2 class="side-heading">${escapeHtml(g.name)}</h2><ul class="side-list">${items}</ul></div>`;
  }).join('');

  return `
    <aside class="sidebar" id="sidebar" aria-label="Danh sách công cụ">
      <nav class="side-mainnav" aria-label="Menu chính">
        <a href="${root}/index.html">Trang chủ</a>
        <a href="${root}/index.html#gioi-thieu">Giới thiệu</a>
        <a href="${root}/index.html#huong-dan">Hướng dẫn</a>
      </nav>
      <label class="side-search">
        <span class="visually-hidden">Tìm công cụ</span>
        <input type="search" placeholder="Tìm công cụ…" autocomplete="off" />
      </label>
      ${groups}
      <p class="side-empty" hidden>Không có công cụ nào khớp.</p>
    </aside>`;
}

function renderFooter(): string {
  const root = rootPath();
  return `
    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <a href="${root}/index.html" class="brand" aria-label="WFTools, về trang chủ">
            <span class="brand-mark" aria-hidden="true"></span>
            <span class="brand-name">WFTools</span>
          </a>
          <p>Công cụ trực tuyến miễn phí, dùng ngay trên trình duyệt. Không cần cài đặt, không cần tài khoản.</p>
          <p class="footer-privacy">Nội dung bạn nhập được xử lý ngay trên máy của bạn, không gửi lên máy chủ.</p>
        </div>
        <nav class="footer-col" aria-label="Thông tin">
          <h2>Thông tin</h2>
          <ul>
            <li><a href="${root}/index.html#cong-cu">Tất cả công cụ</a></li>
            <li><a href="${root}/index.html#gioi-thieu">Giới thiệu</a></li>
            <li><a href="${root}/index.html#huong-dan">Hướng dẫn</a></li>
          </ul>
        </nav>
        <nav class="footer-col" aria-label="Pháp lý">
          <h2>Pháp lý</h2>
          <ul>
            <li><a href="${root}/chinh-sach-bao-mat.html">Chính sách bảo mật</a></li>
            <li><a href="${root}/dieu-khoan.html">Điều khoản sử dụng</a></li>
          </ul>
        </nav>
      </div>
      <div class="footer-bottom">
        <p>© ${new Date().getFullYear()} WFTools, websitefreetools.com</p>
        <p>QR Code là nhãn hiệu đã đăng ký của Denso Wave Incorporated.</p>
      </div>
    </footer>`;
}

/** Nút đăng nhập Google / tài khoản trên menu ngang */
function renderAccount(): void {
  const box = document.getElementById('account');
  if (!box) return;
  const user = currentUser();
  if (!user) {
    box.innerHTML = '<button type="button" class="account-btn" data-account="login">Đăng nhập</button>';
    return;
  }
  const initial = escapeHtml((user.name || user.email).trim().charAt(0).toUpperCase());
  const avatar = user.picture
    ? `<img src="${escapeHtml(user.picture)}" alt="" referrerpolicy="no-referrer" />`
    : `<span>${initial}</span>`;
  box.innerHTML = `
    <button type="button" class="account-btn account-btn--user" data-account="menu" aria-expanded="false" aria-haspopup="true">
      <span class="account-avatar">${avatar}</span><span class="account-name">${escapeHtml(user.name)}</span>
    </button>
    <div class="account-menu" hidden>
      <p><b>${escapeHtml(user.name)}</b><br />${escapeHtml(user.email)}</p>
      <p class="note">Dữ liệu các công cụ được lưu trong thư mục WFTools trên Google Drive của bạn.</p>
      <a href="https://drive.google.com/drive/search?q=WFTools" target="_blank" rel="noopener">Mở Google Drive</a>
      <button type="button" class="btn btn-sm" data-account="logout">Đăng xuất</button>
    </div>`;
}

function setupAccount(): void {
  const box = document.getElementById('account');
  if (!box) return;
  renderAccount();
  window.addEventListener('wft-auth-change', renderAccount);
  box.addEventListener('click', async (e) => {
    const action = (e.target as HTMLElement).closest<HTMLElement>('[data-account]')?.dataset.account;
    const menu = box.querySelector<HTMLElement>('.account-menu');
    if (action === 'login') {
      try {
        await signIn();
      } catch (err) {
        alertMessage(err instanceof GoogleAuthError ? err.message : 'Đăng nhập không thành công.');
      }
    } else if (action === 'menu' && menu) {
      menu.hidden = !menu.hidden;
      box.querySelector('[data-account="menu"]')?.setAttribute('aria-expanded', String(!menu.hidden));
    } else if (action === 'logout') {
      signOut();
    }
  });
  document.addEventListener('click', (e) => {
    const menu = box.querySelector<HTMLElement>('.account-menu');
    if (menu && !menu.hidden && !box.contains(e.target as Node)) menu.hidden = true;
  });
}

/** Thông báo ngắn ở cuối màn hình (dùng chung cho lỗi đăng nhập) */
function alertMessage(text: string): void {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('is-visible');
  window.setTimeout(() => el?.classList.remove('is-visible'), 4000);
}

/**
 * Dựng khung trang: menu ngang trên cùng + menu công cụ bên trái.
 * Nội dung riêng của mỗi trang nằm sẵn trong <main id="content"> của file HTML.
 */
export function mountLayout(opts: { activeNav?: string; activeTool?: string } = {}): void {
  const main = document.getElementById('content');
  if (!main) throw new Error('Thiếu <main id="content">');

  const shell = document.createElement('div');
  shell.className = 'shell';
  shell.innerHTML = renderSidebar(opts.activeTool);
  main.replaceWith(shell);
  shell.appendChild(main);
  document.body.insertAdjacentHTML('afterbegin', renderHeader(opts.activeNav ?? ''));
  shell.insertAdjacentHTML('afterend', renderFooter());
  setupAccount();

  // Tìm kiếm trong menu trái
  const sidebar = document.getElementById('sidebar') as HTMLElement;
  const search = sidebar.querySelector('input') as HTMLInputElement;
  search.addEventListener('input', () => {
    const q = foldText(search.value.trim());
    let shown = 0;
    sidebar.querySelectorAll<HTMLLIElement>('li[data-name]').forEach((li) => {
      const match = !q || (li.dataset.name ?? '').includes(q);
      li.hidden = !match;
      if (match) shown++;
    });
    sidebar.querySelectorAll<HTMLElement>('.side-group').forEach((g) => {
      g.hidden = !g.querySelector('li:not([hidden])');
    });
    (sidebar.querySelector('.side-empty') as HTMLElement).hidden = shown > 0;
  });

  // Mở/đóng menu trái trên màn hình nhỏ
  const toggle = document.querySelector('.sidebar-toggle') as HTMLButtonElement;
  toggle.addEventListener('click', () => {
    const open = document.body.classList.toggle('sidebar-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}
