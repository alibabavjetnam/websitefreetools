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
}
const w = window as unknown as W;

export const LANGS = ['en', 'vi', 'ja', 'zh'] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_NAMES: Record<string, string> = { en: 'English', vi: 'Tiếng Việt', ja: '日本語', zh: '中文' };

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
