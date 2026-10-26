/** Tiện ích giao diện dùng chung cho các trang công cụ */
import { t, currentLang, localeTag } from './i18n';

export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T => {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Không tìm thấy phần tử ${sel}`);
  return el;
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/** Tiền tệ theo ngôn ngữ: mã ISO, số chữ số thập phân, và tỉ giá gần đúng so với VND (chỉ dùng để quy giá trị mẫu). */
const CURRENCY: Record<string, { code: string; dec: number; perUnit: number }> = {
  en: { code: 'USD', dec: 2, perUnit: 25000 }, vi: { code: 'VND', dec: 0, perUnit: 1 }, ja: { code: 'JPY', dec: 0, perUnit: 170 },
  zh: { code: 'CNY', dec: 2, perUnit: 3500 }, es: { code: 'EUR', dec: 2, perUnit: 28000 }, de: { code: 'EUR', dec: 2, perUnit: 28000 },
  ru: { code: 'RUB', dec: 2, perUnit: 300 }, fr: { code: 'EUR', dec: 2, perUnit: 28000 }, pt: { code: 'BRL', dec: 2, perUnit: 4600 },
  it: { code: 'EUR', dec: 2, perUnit: 28000 }, tr: { code: 'TRY', dec: 2, perUnit: 600 }, nl: { code: 'EUR', dec: 2, perUnit: 28000 },
  ko: { code: 'KRW', dec: 0, perUnit: 18 }, ar: { code: 'AED', dec: 2, perUnit: 6800 }, hi: { code: 'INR', dec: 2, perUnit: 300 },
  id: { code: 'IDR', dec: 0, perUnit: 1.6 }, th: { code: 'THB', dec: 2, perUnit: 770 }, pl: { code: 'PLN', dec: 2, perUnit: 6900 },
  uk: { code: 'UAH', dec: 2, perUnit: 600 }, bn: { code: 'BDT', dec: 2, perUnit: 205 },
};
const cur = () => CURRENCY[currentLang()] || CURRENCY.en;
const nf = (opts: Intl.NumberFormatOptions) => new Intl.NumberFormat(localeTag(), opts);

/** Số nguyên theo định dạng của ngôn ngữ đang chọn (mặc định kiểu Mỹ): 1234567 -> "1,234,567" */
export const fmtInt = (n: number): string => (Number.isFinite(n) ? nf({ maximumFractionDigits: 0 }).format(Math.round(n)) : '—');
/** Số thập phân (tối đa 2 chữ số): 1234.5 -> "1,234.5" */
export const fmtDec = (n: number): string => (Number.isFinite(n) ? nf({ maximumFractionDigits: 2 }).format(n) : '—');
/** Số tiền không kèm ký hiệu, đúng số lẻ của đồng tiền (USD 2 số lẻ, VND/JPY 0 số lẻ) */
export const fmtAmt = (n: number): string => (Number.isFinite(n) ? nf({ minimumFractionDigits: cur().dec, maximumFractionDigits: cur().dec }).format(n) : '—');
/** Số tiền để điền vào ô nhập: bỏ số lẻ thừa */
export const fmtField = (n: number): string => (Number.isFinite(n) ? nf({ minimumFractionDigits: 0, maximumFractionDigits: cur().dec }).format(n) : '—');
/** Số tiền kèm ký hiệu của đồng tiền theo ngôn ngữ: "$1,234.50", "1.234,50 €", "1.234 đ" */
export const fmtMoney = (n: number): string => {
  if (!Number.isFinite(n)) return '—';
  if (currentLang() === 'vi') return `${fmtInt(n)} đ`;
  return nf({ style: 'currency', currency: cur().code, minimumFractionDigits: cur().dec, maximumFractionDigits: cur().dec }).format(n);
};
/** Số tiền đồng Việt Nam (dùng cho công cụ tính theo luật Việt Nam) */
export const fmtVnd = (n: number): string => `${fmtInt(n)} đ`;
/** Quy một giá trị mẫu tính theo VND sang đồng tiền của ngôn ngữ, làm tròn gọn (2 chữ số có nghĩa) */
export function sampleMoney(vnd: number): number {
  const v = vnd / cur().perUnit;
  if (v < 10) return Math.max(cur().dec ? 0.5 : 1, Math.round(v * 2) / 2);
  const mag = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.round(v / mag) * mag;
}
/** Làm tròn giá lên bậc "đẹp" của đồng tiền (VND: nghìn; JPY: chục; còn lại: đơn vị) */
export const priceStep = (): number => (currentLang() === 'vi' ? 1000 : cur().dec === 0 ? 10 : 1);
/** Đơn vị tiền ngắn để ghi nhãn (ví dụ "VND", "USD") */
export const currencyCode = (): string => cur().code;

/** Dấu thập phân và dấu nghìn của ngôn ngữ đang chọn */
function separators(): { dec: string; grp: string } {
  const parts = nf({ useGrouping: true, minimumFractionDigits: 1 }).formatToParts(11111.1);
  return { dec: parts.find((p) => p.type === 'decimal')?.value ?? '.', grp: parts.find((p) => p.type === 'group')?.value ?? ',' };
}

/**
 * Đọc số người dùng gõ: chấp nhận "15.000.000", "15,000,000", "15000000", "2,5" và "2.5".
 * Khi chỉ có một loại dấu xuất hiện một lần và dễ nhầm ("1.500"), ưu tiên cách hiểu của ngôn ngữ đang chọn.
 * Trả về NaN nếu không đọc được.
 */
export function parseNumber(raw: string): number {
  let s = raw.trim().replace(/[^\d.,-]/g, '');
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
      const parts = s.split(sep);
      let isThousands: boolean;
      if (parts.length > 2) isThousands = true;
      else if (/^\d{1,3}$/.test(parts[0]) && /^\d{3}$/.test(parts[1])) isThousands = separators().grp.replace(/\s/g, '') === sep || (separators().dec !== sep && s.length > 4);
      else isThousands = false;
      s = isThousands ? parts.join('') : s.replace(sep, '.');
    }
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Ô nhập số tiền: tự thêm dấu phân cách nghìn khi rời ô */
export function moneyInput(input: HTMLInputElement): () => number {
  input.inputMode = 'decimal';
  input.addEventListener('blur', () => {
    const n = parseNumber(input.value);
    if (Number.isFinite(n)) input.value = fmtField(n);
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
