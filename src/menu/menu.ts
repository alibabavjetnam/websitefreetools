/**
 * Menu QR: menu được nén và gói vào phần "#…" của đường link, nên không cần máy chủ lưu menu.
 * Dữ liệu trên link là dữ liệu ngoài (ai cũng sửa được) nên khi hiển thị luôn escape và kiểm tra kiểu.
 */
import { escapeHtml } from '../ui';

export interface MenuItem { name: string; price: number; desc: string }
export interface MenuCategory { title: string; items: MenuItem[] }
export interface Menu {
  name: string;
  info: string;
  note: string;
  accent: string;
  categories: MenuCategory[];
}

export const VIEWER_URL = 'https://websitefreetools.com/m/';
const MAX_ITEMS = 300;

/* ---------- Dạng gọn để link ngắn: mảng thay cho object ---------- */
type Compact = [string, string, string, string, [string, [string, number, string][]][]];

function toCompact(m: Menu): Compact {
  return [m.name, m.info, m.note, m.accent, m.categories.map((c) => [c.title, c.items.map((i) => [i.name, i.price, i.desc] as [string, number, string])])];
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, 1e12) : 0);

function fromCompact(c: unknown): Menu {
  if (!Array.isArray(c)) throw new Error('Dữ liệu menu không hợp lệ.');
  let count = 0;
  const cats = Array.isArray(c[4]) ? c[4] : [];
  return {
    name: str(c[0], 120),
    info: str(c[1], 300),
    note: str(c[2], 500),
    accent: /^#[0-9a-f]{6}$/i.test(String(c[3])) ? String(c[3]) : '#0d6efd',
    categories: cats.slice(0, 50).map((cat: unknown) => {
      const arr = Array.isArray(cat) ? cat : [];
      const items = Array.isArray(arr[1]) ? arr[1] : [];
      return {
        title: str(arr[0], 80),
        items: items
          .filter(() => ++count <= MAX_ITEMS)
          .map((it: unknown) => {
            const x = Array.isArray(it) ? it : [];
            return { name: str(x[0], 120), price: num(x[1]), desc: str(x[2], 300) };
          }),
      };
    }),
  };
}

/* ---------- Nén + base64url ---------- */
const toB64 = (bytes: Uint8Array) => {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64 = (s: string) => {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b + '='.repeat((4 - (b.length % 4)) % 4)), (ch) => ch.charCodeAt(0));
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** Mã hoá menu thành chuỗi đặt sau dấu # ; tiền tố "z" là đã nén, "j" là JSON thường (trình duyệt cũ) */
export async function encodeMenu(m: Menu): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(toCompact(m)));
  if (typeof CompressionStream !== 'undefined') {
    return 'z' + toB64(await pipe(bytes, new CompressionStream('deflate-raw')));
  }
  return 'j' + toB64(bytes);
}

export async function decodeMenu(hash: string): Promise<Menu> {
  const s = hash.replace(/^#/, '');
  if (s.length > 20000) throw new Error('Đường link menu quá dài.');
  const kind = s.charAt(0);
  let bytes: Uint8Array = fromB64(s.slice(1));
  if (kind === 'z') {
    if (typeof DecompressionStream === 'undefined') throw new Error('Trình duyệt này quá cũ để mở menu. Hãy cập nhật trình duyệt.');
    bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  } else if (kind !== 'j') throw new Error('Đường link menu không đúng.');
  return fromCompact(JSON.parse(new TextDecoder().decode(bytes)));
}

const fmtPrice = (n: number) => (n ? new Intl.NumberFormat('vi-VN').format(n) : '');

/**
 * HTML của menu (dùng cho trang khách xem và phần xem trước trong công cụ).
 * Thanh danh mục dùng nút [data-jump] thay vì link "#…", vì phần "#…" của trang đang chứa dữ liệu menu.
 */
export function menuHtml(m: Menu): string {
  const cats = m.categories.filter((c) => c.title || c.items.some((i) => i.name));
  return `
    <header class="mv-head" style="--mv-accent:${m.accent}">
      <h1>${escapeHtml(m.name || 'Tên quán')}</h1>
      ${m.info ? `<p>${escapeHtml(m.info).replace(/\n/g, '<br />')}</p>` : ''}
    </header>
    ${cats.length > 1 ? `<nav class="mv-nav">${cats.map((c, i) => `<button type="button" data-jump="mv-${i}">${escapeHtml(c.title || 'Món')}</button>`).join('')}</nav>` : ''}
    ${cats
      .map(
        (c, i) => `<section class="mv-cat" id="mv-${i}">
        <h2 style="color:${m.accent}">${escapeHtml(c.title)}</h2>
        <ul>${c.items
          .filter((it) => it.name)
          .map((it) => `<li><div class="mv-item"><span class="mv-name">${escapeHtml(it.name)}</span><span class="mv-dots"></span><span class="mv-price">${fmtPrice(it.price)}</span></div>${it.desc ? `<p>${escapeHtml(it.desc)}</p>` : ''}</li>`)
          .join('')}</ul>
      </section>`,
      )
      .join('')}
    ${m.note ? `<p class="mv-note">${escapeHtml(m.note).replace(/\n/g, '<br />')}</p>` : ''}`;
}

/** Gắn xử lý cuộn tới danh mục khi bấm thanh danh mục */
export function bindMenuNav(root: HTMLElement): void {
  root.addEventListener('click', (e) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>('[data-jump]')?.dataset.jump;
    if (id) root.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
