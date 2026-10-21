import './styles.css';
import { GROUPS, TOOLS, type ToolInfo } from './tools';
import { lineIcon } from './icons';
import { GoogleAuthError, currentUser, signIn, signOut } from './google/auth';
import { encodeQr, qrToSvg } from './lib/qr';
import { barcodeToSvg, encodeBarcode } from './lib/barcode';
import { LANGS, LANG_NAMES, currentLang, groupName, homeHref, langBase, staticHref, t, toolDesc, toolName } from './i18n';

export function toolHref(tool: ToolInfo): string {
  return `${langBase()}/${tool.path}`;
}

/** Đường dẫn trang hiện tại sang một ngôn ngữ khác (thay/thêm tiền tố /<lang>/) */
function switchLangHref(lang: string): string {
  const parts = location.pathname.split('/');
  if ((LANGS as readonly string[]).includes(parts[1])) parts[1] = lang;
  else parts.splice(1, 0, lang);
  let path = parts.join('/');
  if (!/\.html$/.test(path)) path = path.replace(/\/$/, '') + '/index.html';
  return path + location.hash;
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

function renderLangSwitch(): string {
  const cur = currentLang();
  const items = LANGS.map((l) => `<a href="${escapeHtml(switchLangHref(l))}" hreflang="${l}" class="lang-item${l === cur ? ' is-active' : ''}">${escapeHtml(LANG_NAMES[l] ?? l)}</a>`).join('');
  return `
    <div class="lang-switch">
      <button type="button" class="lang-btn" data-lang-toggle aria-haspopup="true" aria-expanded="false" aria-label="${escapeHtml(t('lang.label', 'Language'))}">
        <span aria-hidden="true">🌐</span><span class="lang-cur">${escapeHtml(LANG_NAMES[cur] ?? cur)}</span>
      </button>
      <div class="lang-menu" hidden>${items}</div>
    </div>`;
}

function renderHeader(active: string): string {
  const home = homeHref();
  const link = (href: string, label: string, key: string) =>
    `<a href="${href}" class="topnav-link"${key === active ? ' aria-current="page"' : ''}>${escapeHtml(label)}</a>`;
  return `
    <a class="skip-link" href="#content">${escapeHtml(t('nav.skip', 'Skip to menu'))}</a>
    <header class="topbar">
      <div class="topbar-inner">
        <a href="${home}" class="brand" aria-label="WFTools">
          <span class="brand-mark" aria-hidden="true"></span>
          <span class="brand-name">WFTools</span>
        </a>
        <nav class="topnav" aria-label="${escapeHtml(t('nav.menu', 'Main menu'))}">
          ${link(home, t('nav.home', 'Home'), 'home')}
          ${link(`${home}#cong-cu`, t('nav.tools', 'All tools'), 'tools')}
          ${link(`${home}#gioi-thieu`, t('nav.about', 'About'), 'about')}
          ${link(`${home}#huong-dan`, t('nav.guide', 'Guide'), 'guide')}
        </nav>
        ${renderLangSwitch()}
        <div class="account" id="account"></div>
        <button class="sidebar-toggle" type="button" aria-controls="sidebar" aria-expanded="false">${escapeHtml(t('nav.toggle', 'Tools'))}</button>
      </div>
    </header>`;
}

function renderSidebar(activeTool?: string): string {
  const home = homeHref();
  const groups = GROUPS.map((g) => {
    const items = TOOLS.filter((tool) => tool.group === g.id)
      .map((tool) => {
        const name = toolName(tool.id, tool.name);
        return `
        <li data-name="${escapeHtml(foldText(`${name} ${toolDesc(tool.id, tool.description)}`))}">
          <a href="${toolHref(tool)}" class="side-link"${tool.id === activeTool ? ' aria-current="page"' : ''}>
            <span class="side-icon" aria-hidden="true">${toolIcon(tool)}</span>
            <span>${escapeHtml(name)}</span>
          </a>
        </li>`;
      })
      .join('');
    if (!items) return '';
    return `<div class="side-group"><h2 class="side-heading">${escapeHtml(groupName(g.id, g.name))}</h2><ul class="side-list">${items}</ul></div>`;
  }).join('');

  return `
    <aside class="sidebar" id="sidebar" aria-label="${escapeHtml(t('side.toolsLabel', 'All tools'))}">
      <nav class="side-mainnav" aria-label="${escapeHtml(t('nav.menu', 'Main menu'))}">
        <a href="${home}">${escapeHtml(t('nav.home', 'Home'))}</a>
        <a href="${home}#gioi-thieu">${escapeHtml(t('nav.about', 'About'))}</a>
        <a href="${home}#huong-dan">${escapeHtml(t('nav.guide', 'Guide'))}</a>
      </nav>
      <label class="side-search">
        <span class="visually-hidden">${escapeHtml(t('search.label', 'Search tools'))}</span>
        <input type="search" placeholder="${escapeHtml(t('search.placeholder', 'Search tools…'))}" autocomplete="off" />
      </label>
      ${groups}
      <p class="side-empty" hidden>${escapeHtml(t('side.empty', 'No matching tools.'))}</p>
    </aside>`;
}

function renderFooter(): string {
  const home = homeHref();
  return `
    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <a href="${home}" class="brand" aria-label="WFTools">
            <span class="brand-mark" aria-hidden="true"></span>
            <span class="brand-name">WFTools</span>
          </a>
          <p>${escapeHtml(t('footer.tagline', 'Free online tools you use right in your browser. No install, no account.'))}</p>
          <p class="footer-privacy">${escapeHtml(t('footer.privacy', 'What you enter is processed on your device and never sent to a server.'))}</p>
        </div>
        <nav class="footer-col" aria-label="${escapeHtml(t('footer.info', 'Information'))}">
          <h2>${escapeHtml(t('footer.info', 'Information'))}</h2>
          <ul>
            <li><a href="${home}#cong-cu">${escapeHtml(t('footer.allTools', 'All tools'))}</a></li>
            <li><a href="${home}#gioi-thieu">${escapeHtml(t('footer.about', 'About'))}</a></li>
            <li><a href="${home}#huong-dan">${escapeHtml(t('footer.guide', 'Guide'))}</a></li>
          </ul>
        </nav>
        <nav class="footer-col" aria-label="${escapeHtml(t('footer.legal', 'Legal'))}">
          <h2>${escapeHtml(t('footer.legal', 'Legal'))}</h2>
          <ul>
            <li><a href="${staticHref('chinh-sach-bao-mat.html')}">${escapeHtml(t('footer.privacyPolicy', 'Privacy Policy'))}</a></li>
            <li><a href="${staticHref('dieu-khoan.html')}">${escapeHtml(t('footer.terms', 'Terms of Use'))}</a></li>
          </ul>
        </nav>
      </div>
      <div class="footer-bottom">
        <p>© ${new Date().getFullYear()} WFTools, websitefreetools.com</p>
        <p>${escapeHtml(t('footer.trademark', 'QR Code is a registered trademark of Denso Wave Incorporated.'))}</p>
      </div>
    </footer>`;
}

/** Nút đăng nhập Google / tài khoản trên menu ngang */
function renderAccount(): void {
  const box = document.getElementById('account');
  if (!box) return;
  const user = currentUser();
  if (!user) {
    box.innerHTML = `<button type="button" class="account-btn" data-account="login">${escapeHtml(t('account.login', 'Sign in'))}</button>`;
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
      <p class="note">${escapeHtml(t('account.driveNote', 'Tool data is saved in the WFTools folder in your Google Drive.'))}</p>
      <a href="https://drive.google.com/drive/search?q=WFTools" target="_blank" rel="noopener">${escapeHtml(t('account.openDrive', 'Open Google Drive'))}</a>
      <button type="button" class="btn btn-sm" data-account="logout">${escapeHtml(t('account.logout', 'Sign out'))}</button>
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
        alertMessage(err instanceof GoogleAuthError ? err.message : t('account.loginFail', 'Sign-in failed.'));
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

  // Nút chuyển ngôn ngữ
  const langBtn = document.querySelector<HTMLButtonElement>('[data-lang-toggle]');
  const langMenu = document.querySelector<HTMLElement>('.lang-menu');
  if (langBtn && langMenu) {
    langBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      langMenu.hidden = !langMenu.hidden;
      langBtn.setAttribute('aria-expanded', String(!langMenu.hidden));
    });
    document.addEventListener('click', (e) => {
      if (!langMenu.hidden && !(e.target as HTMLElement).closest('.lang-switch')) langMenu.hidden = true;
    });
  }
}
