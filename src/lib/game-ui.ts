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
export function modeTabs(onChange: (m: GameMode) => void): { el: HTMLElement; initial: GameMode; set: (m: GameMode) => void } {
  const el = document.createElement('div');
  el.className = 'game-modes';
  el.setAttribute('role', 'tablist');
  el.innerHTML = `<button type="button" role="tab" data-mode="ai">${escapeHtml(t('lib.online.modeAi', 'Đánh với máy'))}</button><button type="button" role="tab" data-mode="online">${escapeHtml(t('lib.online.modeOnline', 'Chơi với người'))}</button>`;
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
