/** Thanh chia sẻ liên kết công cụ lên mạng xã hội (đặt ở đầu trang công cụ). */
import { t } from './i18n';

interface Net { id: string; name: string; color: string; icon: string; url: (u: string, title: string) => string }
const e = encodeURIComponent;
const NETS: Net[] = [
  { id: 'facebook', name: 'Facebook', color: '#1877f2', icon: '<path fill="#fff" d="M13.4 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.7v3h2.6V21z"/>', url: (u) => `https://www.facebook.com/sharer/sharer.php?u=${e(u)}` },
  { id: 'x', name: 'X (Twitter)', color: '#000', icon: '<path fill="#fff" d="M16.9 4h2.8l-6.1 7 7.2 9h-5.6l-4.4-5.7L5.7 20H2.9l6.5-7.5L2.5 4h5.7l4 5.2zm-1 14.4h1.5L7.4 5.5H5.8z"/>', url: (u, s) => `https://twitter.com/intent/tweet?url=${e(u)}&text=${e(s)}` },
  { id: 'reddit', name: 'Reddit', color: '#ff4500', icon: '<ellipse cx="12" cy="14" rx="7" ry="4.8" fill="#fff"/><circle cx="18" cy="10.5" r="1.6" fill="#fff"/><circle cx="6" cy="10.5" r="1.6" fill="#fff"/><circle cx="16.5" cy="5" r="1.3" fill="#fff"/><path d="M12 9.3l1.1-4.1 3.4.8" stroke="#fff" stroke-width="1.1" fill="none"/><circle cx="9.5" cy="13.3" r="1.1" fill="#ff4500"/><circle cx="14.5" cy="13.3" r="1.1" fill="#ff4500"/><path d="M9.6 16.1c1.4.9 3.4.9 4.8 0" stroke="#ff4500" stroke-width="1" fill="none" stroke-linecap="round"/>', url: (u, s) => `https://www.reddit.com/submit?url=${e(u)}&title=${e(s)}` },
  { id: 'threads', name: 'Threads', color: '#000', icon: '<path fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" d="M16.8 8.6C15.9 6.3 14 5 11.9 5 8.4 5 6.2 7.7 6.2 12s2.2 7 5.8 7c2.9 0 5.2-1.6 5.2-4.2 0-2.2-1.7-3.5-4.5-3.5-2 0-3.3 1-3.3 2.4 0 1.3 1.1 2.1 2.5 2.1 2.2 0 3.3-1.7 3.3-4.6"/>', url: (u, s) => `https://www.threads.net/intent/post?text=${e(`${s} ${u}`)}` },
  { id: 'linkedin', name: 'LinkedIn', color: '#0a66c2', icon: '<path fill="#fff" d="M6.9 9.3V18H4.2V9.3zM5.6 5a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2zM9 9.3h2.6v1.2c.4-.7 1.3-1.4 2.8-1.4 2.9 0 3.4 1.9 3.4 4.3V18h-2.7v-4.1c0-1 0-2.3-1.4-2.3s-1.6 1.1-1.6 2.2V18H9z"/>', url: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${e(u)}` },
  { id: 'pinterest', name: 'Pinterest', color: '#e60023', icon: '<path fill="#fff" d="M12.3 3.5c-4.8 0-7.3 3.3-7.3 6.1 0 1.7.6 3.2 2 3.7.2.1.4 0 .5-.2l.2-.8c.1-.2 0-.3-.1-.5-.4-.5-.7-1.1-.7-2 0-2.6 1.9-4.9 5-4.9 2.7 0 4.2 1.7 4.2 3.9 0 2.9-1.3 5.4-3.2 5.4-1 0-1.8-.9-1.6-2 .3-1.3.9-2.7.9-3.6 0-.8-.4-1.5-1.4-1.5-1.1 0-2 1.1-2 2.7 0 1 .3 1.6.3 1.6l-1.4 5.7c-.4 1.7-.1 3.7 0 3.9 0 .1.2.2.3 0 .1-.2 1.4-1.8 1.9-3.4l.7-2.8c.4.7 1.4 1.3 2.5 1.3 3.3 0 5.6-3 5.6-7.1 0-3.1-2.6-5.9-6.4-5.9z"/>', url: (u, s) => `https://pinterest.com/pin/create/button/?url=${e(u)}&description=${e(s)}` },
  { id: 'tumblr', name: 'Tumblr', color: '#36465d', icon: '<path fill="#fff" d="M14.6 20c-2.6 0-4.5-1.3-4.5-4.5v-5H7.7V7.8c2.6-.7 3.7-2.9 3.8-4.8h2.7v4.3h3.1v3.2h-3.1v4.4c0 1.3.7 1.8 1.7 1.8h1.5V20z"/>', url: (u, s) => `https://www.tumblr.com/widgets/share/tool?canonicalUrl=${e(u)}&title=${e(s)}` },
  { id: 'telegram', name: 'Telegram', color: '#26a5e4', icon: '<path fill="#fff" d="M4.3 11.6l13.5-5.2c.6-.2 1.2.2 1 1.1l-2.3 10.8c-.2.8-.6.9-1.3.6l-3.5-2.6-1.7 1.6c-.2.2-.3.3-.7.3l.2-3.6 6.5-5.9c.3-.3-.1-.4-.4-.2l-8.1 5.1-3.5-1.1c-.8-.2-.8-.7.3-1z"/>', url: (u, s) => `https://t.me/share/url?url=${e(u)}&text=${e(s)}` },
];

const esc = (s: string): string => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] as string);

/** Gắn thanh chia sẻ vào đầu trang. Liên kết chia sẻ bỏ phần ?query và #hash (không lộ mã bàn riêng, dữ liệu trên URL). */
export function mountShareBar(host: HTMLElement, title: string): void {
  const url = location.origin + location.pathname;
  const label = t('share.label', 'Chia sẻ');
  const links = NETS.map((n) => `<a class="sh-btn sh-${n.id}" style="--c:${n.color}" href="${esc(n.url(url, title))}" target="_blank" rel="noopener noreferrer" title="${esc(`${label}: ${n.name}`)}" aria-label="${esc(`${label}: ${n.name}`)}"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">${n.icon}</svg></a>`).join('');
  host.insertAdjacentHTML('afterbegin', `<div class="share-bar" role="group" aria-label="${esc(label)}"><span class="sh-label">${esc(label)}</span>${links}</div>`);
}
