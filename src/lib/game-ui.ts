/** Phần giao diện dùng chung cho nhóm Game giải trí: thanh chọn cấp 1-10, lưu tiến độ, thông báo thắng/thua. */
import { $, escapeHtml, storage } from '../ui';
import { t, tf } from '../i18n';

export const LEVELS = 10;

interface Progress { unlocked: number; done: number[] }

const store = (id: string) => storage<Progress>(`game-${id}`, { unlocked: 1, done: [] });

export const progressOf = (id: string): Progress => {
  const p = store(id).get();
  return { unlocked: Math.min(LEVELS, Math.max(1, p.unlocked || 1)), done: Array.isArray(p.done) ? p.done : [] };
};

/** Ghi nhận thắng cấp `level`, mở cấp kế. Trả về true nếu đã xong cả 10 cấp. */
export function recordWin(id: string, level: number): boolean {
  const st = store(id);
  const p = progressOf(id);
  if (!p.done.includes(level)) p.done.push(level);
  p.unlocked = Math.max(p.unlocked, Math.min(LEVELS, level + 1));
  st.set(p);
  return p.done.length >= LEVELS;
}

export function renderLevelBar(host: HTMLElement, id: string, current: number, onPick: (level: number) => void): void {
  const p = progressOf(id);
  let html = `<span class="game-levels-label">${escapeHtml(t('lib.game.levels', 'Cấp độ'))}</span>`;
  for (let lv = 1; lv <= LEVELS; lv++) {
    const locked = lv > p.unlocked;
    const cls = ['lv', lv === current ? 'on' : '', p.done.includes(lv) ? 'done' : '', locked ? 'lock' : ''].filter(Boolean).join(' ');
    html += `<button type="button" class="${cls}" data-lv="${lv}" ${locked ? 'disabled' : ''} aria-label="${escapeHtml(tf('lib.game.level', 'Cấp {n}', { n: lv }))}" ${lv === current ? 'aria-current="true"' : ''}>${lv}</button>`;
  }
  if (p.unlocked < LEVELS) html += `<button type="button" class="btn btn-sm" data-act="unlock">${escapeHtml(t('lib.game.unlockAll', 'Mở hết các cấp'))}</button>`;
  host.className = 'game-levels';
  host.setAttribute('role', 'group');
  host.innerHTML = html;
  host.querySelectorAll<HTMLButtonElement>('button[data-lv]').forEach((b) => b.addEventListener('click', () => onPick(Number(b.dataset.lv))));
  host.querySelector('[data-act="unlock"]')?.addEventListener('click', () => {
    const st = store(id);
    st.set({ ...progressOf(id), unlocked: LEVELS });
    renderLevelBar(host, id, current, onPick);
  });
}

export type Outcome = 'win' | 'lose' | 'draw';

/** Hiện thông báo kết quả ván/cấp, kèm nút chơi tiếp. */
export function showBanner(host: HTMLElement, kind: Outcome, id: string, level: number, text: string, onNext: (level: number) => void, onRetry: () => void): void {
  const allDone = kind === 'win' && recordWin(id, level) && level === LEVELS;
  host.innerHTML = `<div class="game-banner ${kind}" role="status">
      <strong>${escapeHtml(text)}</strong>
      ${allDone ? `<span>${escapeHtml(t('lib.game.allDone', 'Chúc mừng! Bạn đã vượt qua cả 10 cấp.'))}</span>` : ''}
      <span class="row">
        ${kind === 'win' && level < LEVELS ? `<button type="button" class="btn btn-primary" data-act="next">${escapeHtml(t('lib.game.nextLevel', 'Cấp tiếp theo'))}</button>` : ''}
        <button type="button" class="btn" data-act="retry">${escapeHtml(t('lib.game.retry', 'Chơi lại'))}</button>
      </span></div>`;
  host.querySelector('[data-act="next"]')?.addEventListener('click', () => onNext(level + 1));
  host.querySelector('[data-act="retry"]')?.addEventListener('click', onRetry);
}

export const clearBanner = (host: HTMLElement): void => { host.innerHTML = ''; };

export const fmtTime = (sec: number): string => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** Mẫu trang chung: thanh cấp + vùng game; trả về các phần tử để trang gắn logic. */
export function gameShell(html: string): { levelBar: HTMLElement; banner: HTMLElement } {
  $('#tool-root').innerHTML = `<div class="game-wrap"><div id="lv-bar"></div>${html}<div id="game-banner" aria-live="polite"></div></div>`;
  return { levelBar: $('#lv-bar'), banner: $('#game-banner') };
}

export type GameMode = 'ai' | 'online';

/**
 * Thanh chọn chế độ cho các game cờ hai người: Đánh với máy / Chơi với người (online).
 * Địa chỉ có ?id= (link mời) thì mở thẳng chế độ online.
 */
const MODE_IC = {
  ai: '<svg class="bi" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  online: '<svg class="bi" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2A5 5 0 0 1 21.5 19"/></svg>',
};

export function modeTabs(onChange: (m: GameMode) => void): { el: HTMLElement; initial: GameMode; set: (m: GameMode) => void } {
  const el = document.createElement('div');
  el.className = 'game-modes';
  el.setAttribute('role', 'tablist');
  el.innerHTML = `<button type="button" role="tab" data-mode="ai">${MODE_IC.ai}${escapeHtml(t('lib.online.modeAi', 'Đánh với máy'))}</button><button type="button" role="tab" data-mode="online">${MODE_IC.online}${escapeHtml(t('lib.online.modeOnline', 'Chơi với người'))}</button>`;
  const wrap = document.querySelector('.game-wrap');
  wrap?.insertBefore(el, wrap.firstChild);
  const set = (m: GameMode): void => {
    el.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => {
      const on = b.dataset.mode === m;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    });
    document.querySelector('.game-wrap')?.setAttribute('data-mode', m);
  };
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-mode]');
    if (!b || b.classList.contains('on')) return;
    const m = b.dataset.mode as GameMode;
    set(m);
    onChange(m);
  });
  const initial: GameMode = /[?&]id=/.test(location.search) ? 'online' : 'ai';
  set(initial);
  return { el, initial, set };
}

/**
 * Nút toàn màn hình ở góc phải dòng trạng thái của game cờ: phóng cả vùng game (bàn + bảng bên cạnh).
 * Trình duyệt không cho (iPhone) thì phủ kín cửa sổ trình duyệt; Esc để thoát.
 */
export function fullscreenButton(): void {
  const wrap = document.querySelector<HTMLElement>('.game-wrap');
  const bar = document.querySelector<HTMLElement>('.game-status');
  if (!wrap || !bar) return;
  const ENTER = '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>';
  const EXIT = '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'game-fs';
  bar.appendChild(btn);
  bar.classList.add('has-fs');
  // Thanh trạng thái (chứa nút toàn màn hình) rộng đúng bằng bàn cờ, nên nút nằm ngay phía trên, góc phải bàn cờ
  const col = bar.parentElement as HTMLElement;
  const board = col.querySelector<HTMLElement>('.chess-board, .xq-board, .go-board, .sudoku, .mm-grid, .gboard');
  if (board) {
    const fit = (): void => {
      const b = board.getBoundingClientRect(), c = col.getBoundingClientRect();
      if (!b.width) return;
      bar.style.width = `${Math.round(b.width)}px`;
      if (getComputedStyle(col).direction === 'rtl') bar.style.marginRight = `${Math.round(c.right - b.right)}px`;
      else bar.style.marginLeft = `${Math.round(b.left - c.left)}px`;
    };
    new ResizeObserver(fit).observe(board);
    new ResizeObserver(fit).observe(col);
    fit();
  }
  const doc = document as Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
  const el = wrap as HTMLElement & { webkitRequestFullscreen?: () => void };
  const isOn = (): boolean => wrap.classList.contains('is-pseudo-full') || (doc.fullscreenElement ?? doc.webkitFullscreenElement) === wrap;
  const paint = (): void => {
    const on = isOn();
    const label = on ? t('lib.game.exitFullscreen', 'Thoát toàn màn hình') : t('lib.game.fullscreen', 'Toàn màn hình');
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${on ? EXIT : ENTER}</svg>`;
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.setAttribute('aria-pressed', String(on));
    document.documentElement.classList.toggle('wd-noscroll', wrap.classList.contains('is-pseudo-full'));
  };
  const pseudo = (on: boolean): void => {
    wrap.classList.toggle('is-pseudo-full', on);
    paint();
  };
  btn.addEventListener('click', () => {
    if (wrap.classList.contains('is-pseudo-full')) return pseudo(false);
    if (doc.fullscreenElement ?? doc.webkitFullscreenElement) {
      if (doc.exitFullscreen) void doc.exitFullscreen().catch(() => undefined);
      else doc.webkitExitFullscreen?.();
    } else if (el.requestFullscreen && document.fullscreenEnabled !== false) {
      el.requestFullscreen().catch(() => pseudo(true));
    } else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else pseudo(true);
  });
  document.addEventListener('fullscreenchange', paint);
  document.addEventListener('webkitfullscreenchange', paint);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && wrap.classList.contains('is-pseudo-full')) pseudo(false);
  });
  paint();
}
