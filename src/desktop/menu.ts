/**
 * Menu chuột phải của Desktop online, giống Windows: mục có biểu tượng, phím tắt gợi ý, mục bị mờ,
 * dấu tích, đường kẻ phân nhóm và menu con. Mở bằng chuột phải, nhấn giữ (màn hình cảm ứng),
 * phím Menu hoặc Shift+F10. Điều khiển bằng phím mũi tên, Enter, Esc.
 */
import { escapeHtml } from '../ui';

export interface MenuItem {
  label?: string;
  /** Phần bên trong <svg viewBox="0 0 24 24"> */
  icon?: string;
  /** Gợi ý phím tắt hiện ở bên phải, ví dụ "Ctrl+C" */
  hint?: string;
  disabled?: boolean;
  /** Mục mặc định (in đậm), như "Mở" */
  strong?: boolean;
  danger?: boolean;
  checked?: boolean;
  sep?: boolean;
  sub?: MenuItem[];
  run?: () => void;
}

const ico = (inner = ''): string =>
  `<svg class="wd-mico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const CHECK = '<path d="m5 12 5 5 9-10"/>';
const ARROW = '<path d="m9 6 6 6-6 6"/>';

let current: { close: () => void } | null = null;
/** Chặn mở hai lần liền nhau (phím Menu có thể phát cả keydown lẫn contextmenu) */
let lastOpenAt = 0;

/** Đóng menu đang mở (nếu có) */
export function closeMenu(): void {
  current?.close();
}

/**
 * Hiện menu tại toạ độ (x, y) tính theo cửa sổ trình duyệt, đặt bên trong `host` (khung Desktop)
 * và luôn nằm gọn trong khung đó.
 */
export function showMenu(host: HTMLElement, x: number, y: number, items: MenuItem[], restoreFocus?: HTMLElement | null): void {
  closeMenu();
  lastOpenAt = Date.now();
  const levels: HTMLElement[] = [];
  let closed = false;
  let hoverTimer = 0;
  const prevFocus = restoreFocus ?? (document.activeElement as HTMLElement | null);

  const close = (): void => {
    closed = true;
    window.clearTimeout(hoverTimer);
    levels.forEach((l) => l.remove());
    levels.length = 0;
    document.removeEventListener('pointerdown', outside, true);
    window.removeEventListener('blur', close);
    window.removeEventListener('resize', close);
    if (current?.close === close) current = null;
  };
  const closeAndFocus = (): void => {
    close();
    prevFocus?.focus?.({ preventScroll: true });
  };
  const outside = (e: PointerEvent): void => {
    if (!levels.some((l) => l.contains(e.target as Node))) close();
  };

  const build = (list: MenuItem[], depth: number, ax: number, ay: number, anchor?: DOMRect): HTMLElement => {
    // Đóng các cấp sâu hơn trước khi mở cấp mới
    levels.splice(depth).forEach((l) => l.remove());
    const box = document.createElement('div');
    box.className = 'wd-menu';
    box.setAttribute('role', 'menu');
    box.tabIndex = -1;
    box.innerHTML = list
      .map((it, i) =>
        it.sep
          ? '<div class="wd-msep" role="separator"></div>'
          : `<button type="button" class="wd-mi${it.strong ? ' is-strong' : ''}${it.danger ? ' is-danger' : ''}" role="${it.checked === undefined ? 'menuitem' : 'menuitemradio'}"${it.checked !== undefined ? ` aria-checked="${it.checked}"` : ''}${it.sub ? ' aria-haspopup="menu" aria-expanded="false"' : ''} data-i="${i}"${it.disabled ? ' disabled aria-disabled="true"' : ''} tabindex="-1">${ico(it.checked ? CHECK : it.icon)}<span class="wd-mlabel">${escapeHtml(it.label ?? '')}</span><span class="wd-mhint">${it.sub ? ico(ARROW) : escapeHtml(it.hint ?? '')}</span></button>`,
      )
      .join('');
    host.appendChild(box);
    levels.push(box);

    // Đặt vị trí, lật sang trái/lên trên nếu tràn khung
    const hr = host.getBoundingClientRect();
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    let left = ax - hr.left;
    let top = ay - hr.top;
    if (anchor) {
      left = anchor.right - hr.left - 4;
      top = anchor.top - hr.top - 5;
      if (left + w > hr.width) left = anchor.left - hr.left - w + 4;
    } else if (left + w > hr.width) left -= w;
    if (top + h > hr.height) top = anchor ? hr.height - h - 4 : top - h;
    box.style.left = `${Math.max(4, Math.min(left, hr.width - w - 4))}px`;
    box.style.top = `${Math.max(4, Math.min(top, hr.height - h - 4))}px`;

    const buttons = (): HTMLButtonElement[] => [...box.querySelectorAll<HTMLButtonElement>('.wd-mi:not([disabled])')];
    const openSub = (btn: HTMLButtonElement, focusFirst: boolean): void => {
      const it = list[Number(btn.dataset.i)];
      if (!it?.sub) return;
      box.querySelectorAll('[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
      btn.setAttribute('aria-expanded', 'true');
      const sub = build(it.sub, depth + 1, 0, 0, btn.getBoundingClientRect());
      if (focusFirst) sub.querySelector<HTMLButtonElement>('.wd-mi:not([disabled])')?.focus();
    };
    const activate = (btn: HTMLButtonElement): void => {
      const it = list[Number(btn.dataset.i)];
      if (!it || it.disabled) return;
      if (it.sub) return openSub(btn, true);
      closeAndFocus();
      it.run?.();
    };

    box.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.wd-mi');
      if (btn) activate(btn);
    });
    box.addEventListener('contextmenu', (e) => e.preventDefault());
    box.addEventListener('pointerover', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.wd-mi');
      if (!btn || e.pointerType === 'touch') return;
      btn.focus({ preventScroll: true });
      window.clearTimeout(hoverTimer);
      hoverTimer = window.setTimeout(() => {
        if (closed || !btn.isConnected) return;
        if (list[Number(btn.dataset.i)]?.sub) openSub(btn, false);
        else levels.splice(depth + 1).forEach((l) => l.remove());
      }, 180);
    });
    box.addEventListener('keydown', (e) => {
      const all = buttons();
      const i = all.indexOf(document.activeElement as HTMLButtonElement);
      const k = e.key;
      if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Home' || k === 'End') {
        e.preventDefault();
        const n = k === 'Home' ? 0 : k === 'End' ? all.length - 1 : (i + (k === 'ArrowDown' ? 1 : -1) + all.length) % all.length;
        all[n]?.focus();
      } else if (k === 'ArrowRight' && i >= 0 && list[Number(all[i].dataset.i)]?.sub) {
        e.preventDefault();
        openSub(all[i], true);
      } else if ((k === 'ArrowLeft' && depth > 0) || (k === 'Escape' && depth > 0)) {
        e.preventDefault();
        e.stopPropagation();
        levels.splice(depth).forEach((l) => l.remove());
        const parent = levels[depth - 1]?.querySelector<HTMLButtonElement>('[aria-expanded="true"]');
        parent?.setAttribute('aria-expanded', 'false');
        parent?.focus();
      } else if (k === 'Escape' || k === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        closeAndFocus();
      } else if (k === 'Enter' || k === ' ') {
        e.preventDefault();
        if (i >= 0) activate(all[i]);
      } else if (k.length === 1 && /\S/.test(k)) {
        // Gõ chữ cái đầu để nhảy tới mục
        const from = i + 1;
        const hit = [...all.slice(from), ...all.slice(0, from)].find((b) => b.textContent?.trim().toLowerCase().startsWith(k.toLowerCase()));
        hit?.focus();
      }
    });
    return box;
  };

  const top = build(items, 0, x, y);
  (top.querySelector<HTMLButtonElement>('.wd-mi:not([disabled])') ?? top).focus({ preventScroll: true });
  document.addEventListener('pointerdown', outside, true);
  window.addEventListener('blur', close);
  window.addEventListener('resize', close);
  current = { close };
}

/**
 * Gắn menu chuột phải cho một vùng. `items` nhận phần tử bị bấm và trả danh sách mục
 * (null = để trình duyệt hiện menu riêng, ví dụ trong ô nhập chữ).
 * Màn hình cảm ứng: nhấn giữ 0,55 giây; cú chạm sau đó không bị tính là bấm.
 */
export function bindContextMenu(host: HTMLElement, area: HTMLElement, items: (target: HTMLElement) => MenuItem[] | null): void {
  const open = (target: HTMLElement, x: number, y: number): boolean => {
    if (current && Date.now() - lastOpenAt < 300) return true;
    const list = items(target);
    if (!list) return false;
    showMenu(host, x, y, list, target.closest<HTMLElement>('[tabindex],button') ?? null);
    return true;
  };
  let lastLong = 0;
  area.addEventListener('contextmenu', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('input,textarea,[contenteditable="true"],iframe')) return;
    e.preventDefault();
    e.stopPropagation();
    if (Date.now() - lastLong < 900) return; // Android cũng phát contextmenu sau khi nhấn giữ
    // Phím Menu / Shift+F10 phát contextmenu ở toạ độ 0: mở cạnh phần tử đang chọn
    if (e.clientX === 0 && e.clientY === 0) {
      const r = t.getBoundingClientRect();
      open(t, r.left + Math.min(24, r.width / 2), r.top + Math.min(24, r.height / 2));
    } else open(t, e.clientX, e.clientY);
  });

  let timer = 0;
  let start = { x: 0, y: 0 };
  let suppress = false;
  const cancel = (): void => window.clearTimeout(timer);
  area.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    const t = e.target as HTMLElement;
    if (t.closest('input,textarea,[contenteditable="true"],.wd-menu')) return;
    start = { x: e.clientX, y: e.clientY };
    cancel();
    timer = window.setTimeout(() => {
      if (open(t, start.x, start.y)) {
        lastLong = Date.now();
        suppress = true;
      }
    }, 550);
  });
  area.addEventListener('pointermove', (e) => {
    if (Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) > 12) cancel();
  });
  area.addEventListener('pointerup', cancel);
  area.addEventListener('pointercancel', cancel);
  area.addEventListener(
    'click',
    (e) => {
      if (!suppress) return;
      suppress = false;
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );
  area.addEventListener('keydown', (e) => {
    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      const t = e.target as HTMLElement;
      if (t.closest('input,textarea')) return;
      e.preventDefault();
      const r = t.getBoundingClientRect();
      open(t, r.left + Math.min(24, r.width / 2), r.top + Math.min(24, r.height / 2));
    }
  });
}
