/**
 * Tự gắn biểu tượng SVG vào các nút (.btn) trong vùng nội dung công cụ.
 * Cách chọn biểu tượng không phụ thuộc ngôn ngữ đang xem:
 *  1. Chữ trên nút → tra ngược ra khoá dịch (trong từ điển của ngôn ngữ hiện tại) → biểu tượng
 *     (bảng khoá → biểu tượng sinh sẵn từ chữ tiếng Việt gốc: scripts/btn-icons.mjs).
 *  2. Nút chưa dịch (chữ tiếng Việt) → so luật trong src/btn-icon-rules.json.
 *  3. Nút có sẵn data-icon="tên" → dùng luôn; data-icon="" → không gắn.
 */
import MAP from './btn-icons.json';
import RULES from './btn-icon-rules.json';

const P: Record<string, string> = {
  download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 19h16"/>',
  upload: '<path d="M12 16V5M7 10l5-5 5 5"/><path d="M4 19h16"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  paste: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="M9 11h6M9 15h4"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  'log-in': '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l4-4-4-4M14 12H4"/>',
  'log-out': '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M16 16l4-4-4-4M20 12H10"/>',
  'user-plus': '<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M19 8v6M16 11h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  handshake: '<path d="M3 11l4-4 4 2 3-2 7 5"/><path d="M7 7v6l5 5 2-2M11 13l3 3 2-2M13 11l3 3 2-2 3-1"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20v-4h-4"/>',
  unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.7-1.5"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  maximize: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  printer: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  lightbulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>',
  shuffle: '<path d="M4 7h3c4 0 6 10 10 10h3M17 14l3 3-3 3"/><path d="M4 17h3c1.6 0 2.8-1.6 3.8-3.5M13.2 9.5C14.2 7.6 15.4 7 17 7h3M17 4l3 3-3 3"/>',
  calculator: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
  compress: '<path d="M4 14h6v6M20 10h-6V4M14 10l6-6M4 20l6-6"/>',
  merge: '<path d="M6 4v5a4 4 0 0 0 4 4h8M14 9l4 4-4 4"/><path d="M6 20v-3"/>',
  scissors: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.5L20 18M8 16.5L20 6"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.3-5.7L20 8.5"/><path d="M20 3.5v5h-5"/>',
  swap: '<path d="M7 4L3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7"/>',
  sort: '<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>',
  convert: '<path d="M4 9h13l-3-3M20 15H7l3 3"/>',
  check: '<path d="M4.5 12.5l5 5L19.5 7"/>',
  'arrow-left': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  eye: '<path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  skip: '<path d="M5 5l9 7-9 7z"/><path d="M18 5v14"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  'arrow-up': '<path d="M12 19V5M6 11l6-6 6 6"/>',
  'arrow-down': '<path d="M12 5v14M6 13l6 6 6-6"/>',
  minus: '<path d="M5 12h14"/>',
  sparkles: '<path d="M10 3l1.8 4.7L16.5 9.5l-4.7 1.8L10 16l-1.8-4.7L3.5 9.5l4.7-1.8z"/><path d="M18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9z"/>',
};

export const iconSvg = (name: string, cls = 'bi'): string =>
  P[name] ? `<svg class="${cls}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name]}</svg>` : '';

const norm = (s: string): string =>
  s.normalize('NFC').toLowerCase().trim()
    .replace(/òa/g, 'oà').replace(/óa/g, 'oá').replace(/ỏa/g, 'oả').replace(/õa/g, 'oã').replace(/ọa/g, 'oạ')
    .replace(/ùy/g, 'uỳ').replace(/úy/g, 'uý').replace(/ủy/g, 'uỷ').replace(/ũy/g, 'uỹ').replace(/ụy/g, 'uỵ');
const VI_CHARS = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;
const rules = (RULES as [string, string][]).map(([n, r]) => [n, new RegExp(r, 'u')] as const);

interface W { __WFT_I18N__?: { ui?: Record<string, string> }; __WFT_S__?: Record<string, string>; __WFT_LANG__?: string }

let rev: Map<string, string> | null = null;
function reverseMap(tool: string): Map<string, string> {
  if (rev) return rev;
  rev = new Map();
  const w = window as unknown as W;
  const m = MAP as { ui: Record<string, string>; s: Record<string, Record<string, string>> };
  const ui = w.__WFT_I18N__?.ui || {};
  for (const [k, ic] of Object.entries(m.ui)) if (ui[k]) rev.set(ui[k].trim(), ic);
  const s = w.__WFT_S__ || {};
  for (const [k, ic] of Object.entries(m.s[tool] || {})) if (s[k]) rev.set(s[k].trim(), ic);
  return rev;
}

function pick(text: string, tool: string): string | null {
  const hit = reverseMap(tool).get(text);
  if (hit) return hit;
  const w = window as unknown as W;
  if ((w.__WFT_LANG__ || 'vi') !== 'vi' && !VI_CHARS.test(text)) return null;
  const s = norm(text);
  for (const [n, r] of rules) if (r.test(s)) return n;
  return null;
}

const SKIP_START = /^[\p{Extended_Pictographic}←-⇿☀-➿⬀-⯿+\-×÷=<>«»▶■●◀]/u;

function decorate(root: ParentNode, tool: string): void {
  root.querySelectorAll<HTMLElement>('button.btn, a.btn, label.btn').forEach((b) => {
    if (b.querySelector(':scope > svg, :scope > img')) return;
    const want = b.dataset.icon;
    if (want === '') return;
    let text = (b.textContent || '').replace(/\s+/g, ' ').trim();
    // "+ Thêm …" / "− Bớt …": thay dấu +/− đầu chữ bằng biểu tượng
    const sign = /^([+−-])\s*(?=\p{L})/u.exec(text);
    if (!want && sign) {
      const tn = [...b.childNodes].find((n) => n.nodeType === 3 && n.textContent!.trim()) as Text | undefined;
      if (tn) {
        tn.textContent = tn.textContent!.replace(/^\s*[+−-]\s*/u, '');
        b.insertAdjacentHTML('afterbegin', iconSvg(sign[1] === '+' ? 'plus' : 'minus'));
        b.classList.add('has-bi');
        return;
      }
    }
    const name = want || (text && text.length <= 48 && !SKIP_START.test(text) ? pick(text, tool) : null);
    if (!name || !P[name]) return;
    b.insertAdjacentHTML('afterbegin', iconSvg(name));
    b.classList.add('has-bi');
  });
}

/** Gắn biểu tượng cho nút trong root và theo dõi nút sinh ra về sau. */
export function autoButtonIcons(root: HTMLElement, tool: string): void {
  decorate(root, tool);
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; decorate(root, tool); });
  }).observe(root, { childList: true, subtree: true, characterData: true });
}
