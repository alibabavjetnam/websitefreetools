import './styles.css';
import { CATEGORIES, TOOLS, type ToolInfo } from './tools';
import { encodeQr, qrToSvg } from './lib/qr';
import { barcodeToSvg, encodeBarcode } from './lib/barcode';

/** Đường dẫn về thư mục gốc, khai báo bằng data-root trên <body> ("." hoặc "..") */
export function rootPath(): string {
  return document.body.dataset.root ?? '.';
}

export function toolHref(tool: ToolInfo): string {
  return `${rootPath()}/${tool.path}`;
}

/** Biểu tượng công cụ được vẽ bằng chính mã thật */
export function toolIcon(tool: ToolInfo): string {
  if (tool.id === 'qr-code') {
    return qrToSvg(encodeQr(tool.iconSample, 'L'), { margin: 0, fg: 'currentColor', bg: 'transparent', px: 28 });
  }
  if (tool.id === 'barcode') {
    const svg = barcodeToSvg(encodeBarcode('CODE39', tool.iconSample), {
      moduleWidth: 1, height: 40, showText: false, quietZone: 0, fg: 'currentColor', bg: 'transparent',
    });
    return svg.replace(/width="[\d.]+" height="[\d.]+"/, 'width="28" height="28" preserveAspectRatio="none"');
  }
  return '';
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
        <button class="sidebar-toggle" type="button" aria-controls="sidebar" aria-expanded="false">Công cụ</button>
      </div>
    </header>`;
}

function renderSidebar(activeTool?: string): string {
  const root = rootPath();
  const groups = CATEGORIES.map((cat) => {
    const items = TOOLS.filter((t) => t.category === cat)
      .map(
        (t) => `
        <li data-name="${escapeHtml(t.name.toLowerCase())}">
          <a href="${toolHref(t)}" class="side-link"${t.id === activeTool ? ' aria-current="page"' : ''}>
            <span class="side-icon" aria-hidden="true">${toolIcon(t)}</span>
            <span>${escapeHtml(t.name)}</span>
          </a>
        </li>`,
      )
      .join('');
    return `<div class="side-group"><h2 class="side-heading">${escapeHtml(cat)}</h2><ul class="side-list">${items}</ul></div>`;
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

  // Tìm kiếm trong menu trái
  const sidebar = document.getElementById('sidebar') as HTMLElement;
  const search = sidebar.querySelector('input') as HTMLInputElement;
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
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
