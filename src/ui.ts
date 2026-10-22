/** Tiện ích giao diện dùng chung cho các trang công cụ */
import { t } from './i18n';

export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T => {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Không tìm thấy phần tử ${sel}`);
  return el;
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

const vnNumber = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const vnDecimal = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

/** 1234567 -> "1.234.567" */
export const fmtInt = (n: number): string => (Number.isFinite(n) ? vnNumber.format(Math.round(n)) : '—');
/** 1234.5 -> "1.234,5" */
export const fmtDec = (n: number): string => (Number.isFinite(n) ? vnDecimal.format(n) : '—');
export const fmtMoney = (n: number): string => `${fmtInt(n)} đ`;

/**
 * Đọc số người dùng gõ: chấp nhận "15.000.000", "15,000,000", "15000000", "2,5" (thập phân kiểu Việt)
 * và "2.5" (thập phân kiểu Anh). Trả về NaN nếu không đọc được.
 */
export function parseNumber(raw: string): number {
  let s = raw.trim().replace(/\s|đ|vnđ|vnd/gi, '');
  if (!s) return NaN;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    // Có cả hai dấu: dấu xuất hiện sau cùng là dấu thập phân ("1.234,5" hoặc "1,234.5")
    const [thousands, decimal] = lastComma > lastDot ? ['.', ','] : [',', '.'];
    s = s.split(thousands).join('').replace(decimal, '.');
  } else {
    const sep = lastDot >= 0 ? '.' : lastComma >= 0 ? ',' : '';
    if (sep) {
      const count = s.split(sep).length - 1;
      const isThousands = count > 1 || (/^\d{1,3}$/.test(s.split(sep)[0]) && /^\d{3}$/.test(s.split(sep)[1]) && s.length > 4);
      // "15.000.000", "15,000,000", "1.500" là phân cách nghìn; "2,5", "2.5" là thập phân
      s = isThousands ? s.split(sep).join('') : s.replace(sep, '.');
    }
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Ô nhập số tiền: tự thêm dấu chấm phân cách nghìn khi rời ô */
export function moneyInput(input: HTMLInputElement): () => number {
  input.inputMode = 'numeric';
  input.addEventListener('blur', () => {
    const n = parseNumber(input.value);
    if (Number.isFinite(n)) input.value = fmtInt(n);
  });
  return () => parseNumber(input.value);
}

let toastTimer: number | undefined;
export function toast(message: string): void {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el?.classList.remove('is-visible'), 1800);
}

export async function copyText(text: string, done = t('lib.ui.copied', 'Đã sao chép')): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    // Trình duyệt chặn clipboard: dùng cách cũ qua ô ẩn
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    toast(ok ? done : t('lib.ui.copyFail', 'Không sao chép được, hãy chọn và sao chép thủ công'));
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Lưu trữ cục bộ an toàn (không lỗi khi trình duyệt chặn bộ nhớ) */
export function storage<T>(key: string, fallback: T) {
  const k = `wft:${key}`;
  return {
    get(): T {
      try {
        const v = localStorage.getItem(k);
        return v === null ? fallback : (JSON.parse(v) as T);
      } catch {
        return fallback;
      }
    },
    set(value: T): void {
      try {
        localStorage.setItem(k, JSON.stringify(value));
      } catch {
        /* bộ nhớ đầy hoặc bị chặn: bỏ qua, công cụ vẫn chạy */
      }
    },
  };
}

/** Thanh chuyển tab đơn giản: các nút [data-tab] điều khiển các khối [data-panel] */
export function setupTabs(root: HTMLElement, onChange?: (tab: string) => void): void {
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-tab]')];
  const panels = [...root.querySelectorAll<HTMLElement>('[data-panel]')];
  const select = (tab: string) => {
    buttons.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    panels.forEach((p) => (p.hidden = p.dataset.panel !== tab));
    onChange?.(tab);
  };
  buttons.forEach((b) => b.addEventListener('click', () => select(b.dataset.tab as string)));
  const fromHash = location.hash.slice(1);
  select(buttons.some((b) => b.dataset.tab === fromHash) ? fromHash : (buttons[0]?.dataset.tab as string));
}
