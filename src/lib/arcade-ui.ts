/** Phần dùng chung cho các game một người mới (2048, dò mìn, xếp gạch, rắn, bài, ghép 3, phá gạch, cờ caro…). */
import { escapeHtml, storage } from '../ui';
import { t, tf } from '../i18n';

/** Chuỗi dùng chung: ui['lib.arcade.<key>'] */
export const A = (key: string, fallback: string): string => t(`lib.arcade.${key}`, fallback);
export const Af = (key: string, fallback: string, vars: Record<string, string | number>): string => tf(`lib.arcade.${key}`, fallback, vars);
export const Ah = (key: string, fallback: string): string => escapeHtml(A(key, fallback));

/** Kỷ lục điểm theo game + cấp */
export function bestScore(id: string, level: number): { get: () => number; put: (v: number) => boolean } {
  const st = storage<Record<string, number>>(`best-${id}`, {});
  return {
    get: () => Number(st.get()[level] || 0),
    put: (v: number) => {
      const all = st.get();
      if (v <= Number(all[level] || 0)) return false;
      all[level] = v; st.set(all); return true;
    },
  };
}

const ARROW: Record<string, string> = {
  left: '<path d="M15 5l-7 7 7 7"/>', right: '<path d="M9 5l7 7-7 7"/>', up: '<path d="M5 15l7-7 7 7"/>', down: '<path d="M5 9l7 7 7-7"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.3-5.7L20 8.5"/><path d="M20 3.5v5h-5"/>', drop: '<path d="M12 4v13M6 11l6 6 6-6"/><path d="M5 20h14"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
};
const LABEL: Record<string, [string, string]> = {
  left: ['left', 'Sang trái'], right: ['right', 'Sang phải'], up: ['up', 'Lên'], down: ['down', 'Xuống'],
  rotate: ['rotate', 'Xoay'], drop: ['drop', 'Thả nhanh'], pause: ['pause', 'Tạm dừng'],
};

/** Hàng nút điều khiển trên màn hình cảm ứng; trả về HTML, mỗi nút có data-k="<tên>" */
export function padHtml(keys: string[]): string {
  return `<div class="ar-pad" role="group">${keys.map((k) => {
    const [key, vi] = LABEL[k];
    const label = A(key, vi);
    return `<button type="button" class="ar-key" data-k="${k}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ARROW[k]}</svg></button>`;
  }).join('')}</div>`;
}

/** Gắn nút điều khiển (bấm giữ để lặp với các phím di chuyển) */
export function bindPad(host: HTMLElement, onKey: (k: string) => void, repeat: string[] = []): void {
  let timer = 0;
  const stop = (): void => { window.clearInterval(timer); timer = 0; };
  host.querySelectorAll<HTMLButtonElement>('.ar-key').forEach((b) => {
    const k = b.dataset.k as string;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onKey(k);
      if (repeat.includes(k)) { stop(); timer = window.setInterval(() => onKey(k), 110); }
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stop);
  });
}

/** Phím bàn phím → tên điều khiển; chặn cuộn trang khi đang chơi */
export function bindKeys(isActive: () => boolean, onKey: (k: string) => void): void {
  const map: Record<string, string> = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down',
    A: 'left', D: 'right', W: 'up', S: 'down', ' ': 'space', p: 'pause', P: 'pause', Escape: 'pause',
  };
  document.addEventListener('keydown', (e) => {
    if (!isActive()) return;
    const tg = e.target as HTMLElement;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable)) return;
    const k = map[e.key];
    if (!k) return;
    e.preventDefault();
    // Nút vừa bấm còn giữ tiêu điểm: phím cách sẽ "bấm" lại nút đó (vd. Bắt đầu lại ván) — bỏ tiêu điểm
    if (tg && tg.tagName === 'BUTTON') tg.blur();
    onKey(k);
  });
}

/** Vuốt trên phần tử → hướng */
export function bindSwipe(el: HTMLElement, onDir: (d: 'left' | 'right' | 'up' | 'down') => void): void {
  let sx = 0, sy = 0, on = false;
  el.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; on = true; });
  el.addEventListener('pointerup', (e) => {
    if (!on) return;
    on = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    onDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  });
  el.style.touchAction = 'none';
}

/** Canvas sắc nét theo devicePixelRatio, co theo bề rộng phần tử cha */
export function setupCanvas(cv: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** Trang đang hiện và không có ô nhập đang gõ */
export const pageActive = (): boolean => document.visibilityState === 'visible';
