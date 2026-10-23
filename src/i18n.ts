/**
 * i18n phía trình duyệt. Từ điển ngôn ngữ được nạp sẵn qua thẻ <script src="/language/<lang>.js">
 * (file này gán window.__WFT_I18N__), còn mã ngôn ngữ nằm ở window.__WFT_LANG__.
 * Nếu thiếu (khi chạy dev), t() trả về chuỗi dự phòng truyền vào.
 */
export interface Dict {
  lang: string;
  ui: Record<string, string>;
  groups: Record<string, { name: string; desc: string }>;
  tools: Record<string, { name: string; desc: string }>;
}

interface W {
  __WFT_LANG__?: string;
  __WFT_I18N__?: Dict;
  /** Chuỗi bên trong của riêng trang công cụ hiện tại (nạp qua /language/<lang>/s/<id>.js) */
  __WFT_S__?: Record<string, string>;
}
const w = window as unknown as W;

/**
 * Trả về hàm dịch chuỗi nội bộ của một công cụ. Mỗi trang chỉ nạp từ điển của chính nó.
 * fallback (thường là bản gốc tiếng Việt) được dùng khi chưa có bản dịch.
 */
export function pageText(): (key: string, fallback?: string) => string {
  const s = w.__WFT_S__;
  return (key: string, fallback = '') => s?.[key] ?? fallback;
}

export const LANGS = ['en', 'vi', 'ja', 'zh', 'es', 'de', 'ru', 'fr', 'pt', 'it', 'tr', 'nl'] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_NAMES: Record<string, string> = { en: 'English', vi: 'Tiếng Việt', ja: '日本語', zh: '中文', es: 'Español', de: 'Deutsch', ru: 'Русский', fr: 'Français', pt: 'Português', it: 'Italiano', tr: 'Türkçe', nl: 'Nederlands' };

export const currentLang = (): string => w.__WFT_LANG__ || document.documentElement.lang || 'en';
/** Tiền tố đường dẫn theo ngôn ngữ, ví dụ "/vi". Khi chạy dev không có tiền tố thì trả "". */
export function langBase(): string {
  const l = w.__WFT_LANG__;
  return l ? `/${l}` : '';
}

const dict = (): Dict | undefined => w.__WFT_I18N__;

/** Lấy chuỗi giao diện theo khoá; không có thì trả fallback. */
export function t(key: string, fallback = ''): string {
  return dict()?.ui?.[key] ?? fallback;
}
/** Như t() nhưng thay các chỗ {tên} bằng giá trị trong vars. */
export function tf(key: string, fallback: string, vars: Record<string, string | number>): string {
  let s = t(key, fallback);
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
/** Mã locale cho Intl / toLocaleString theo ngôn ngữ hiện tại. */
export const localeTag = (): string => (({ en: 'en-US', vi: 'vi-VN', ja: 'ja-JP', zh: 'zh-CN', es: 'es-ES', de: 'de-DE', ru: 'ru-RU', fr: 'fr-FR', pt: 'pt-BR', it: 'it-IT', tr: 'tr-TR', nl: 'nl-NL' } as Record<string, string>)[currentLang()] || 'en-US');
export function groupName(id: string, fallback: string): string {
  return dict()?.groups?.[id]?.name ?? fallback;
}
export function groupDesc(id: string, fallback: string): string {
  return dict()?.groups?.[id]?.desc ?? fallback;
}
export function toolName(id: string, fallback: string): string {
  return dict()?.tools?.[id]?.name ?? fallback;
}
export function toolDesc(id: string, fallback: string): string {
  return dict()?.tools?.[id]?.desc ?? fallback;
}

/** Đường dẫn trang chủ và trang tĩnh theo ngôn ngữ hiện tại */
export const homeHref = (): string => `${langBase()}/index.html`;
export const staticHref = (file: string): string => `${langBase()}/${file}`;

/**
 * Dịch các phần tử tĩnh trong HTML đánh dấu sẵn:
 *  - data-i18n="key"        → đổi textContent
 *  - data-i18n-ph="key"     → đổi placeholder
 *  - data-i18n-attr="attr:key;attr2:key2" → đổi thuộc tính (title, aria-label…)
 * Chuỗi gốc trong HTML được dùng làm fallback khi chưa có bản dịch.
 */
export function applyI18n(root: ParentNode = document): void {
  const s = w.__WFT_S__;
  if (!s) return;
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const v = s[el.dataset.i18n as string];
    if (v != null) el.textContent = v;
  });
  root.querySelectorAll<HTMLInputElement>('[data-i18n-ph]').forEach((el) => {
    const v = s[el.dataset.i18nPh as string];
    if (v != null) el.placeholder = v;
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-attr]').forEach((el) => {
    for (const pair of (el.dataset.i18nAttr as string).split(';')) {
      const [attr, key] = pair.split(':');
      const v = s[key];
      if (attr && v != null) el.setAttribute(attr.trim(), v);
    }
  });
}
