/** Giao diện dò mìn: bấm mở ô, bấm phải/nhấn giữ/chế độ cờ để cắm cờ, bấm ô số để mở nhanh. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { MINE_LEVELS, Minefield } from '../calc/minesweeper';
import { clearBanner, fmtTime, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { Af, Ah, bestScore } from './arcade-ui';

export function mountMines(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="ms-status"></b><span id="ms-time">0:00</span></div>
        <div class="ms-board gboard" id="ms-board" role="grid"></div>
      </div>
      <div class="game-side">
        <div class="row">
          <button type="button" class="btn" id="ms-flag" aria-pressed="false" data-icon="">🚩 ${Ah('flagMode', 'Cắm cờ')}</button>
          <button type="button" class="btn" id="ms-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>
        </div>
        <p class="note">${Ah('note.minesweeper', 'Bấm một ô để mở. Số trên ô cho biết có bao nhiêu mìn ở 8 ô xung quanh. Cắm cờ lên ô nghi có mìn bằng chuột phải, nhấn giữ hoặc bật chế độ Cắm cờ. Bấm vào ô số đã đủ cờ để mở nhanh các ô còn lại. Mở hết ô không có mìn là thắng.')}</p>
      </div>
    </div>`);
  const boardEl = $('#ms-board');
  const flagBtn = $('#ms-flag') as HTMLButtonElement;
  let level = progressOf(id).unlocked;
  let f = new Minefield(MINE_LEVELS[0]);
  let over = false, flagMode = false;
  let t0 = 0, timer = 0, secs = 0;

  function stopTimer(): void { window.clearInterval(timer); timer = 0; }
  function start(lv: number): void {
    level = lv;
    f = new Minefield(MINE_LEVELS[lv - 1]);
    over = false; secs = 0; stopTimer();
    boardEl.style.setProperty('--w', String(f.w));
    clearBanner(banner);
    renderLevelBar(levelBar, id, level, start);
    render();
  }

  function render(): void {
    let html = '';
    for (let i = 0; i < f.w * f.h; i++) {
      const s = f.state[i];
      let cls = 'ms-cell', txt = '';
      if (s === 1) {
        cls += ' open';
        if (f.mine[i]) { cls += i === f.exploded ? ' boom' : ' mine'; txt = '✹'; }
        else if (f.num[i]) { cls += ` n${f.num[i]}`; txt = String(f.num[i]); }
      } else if (s === 2) { cls += ' flag'; txt = over && !f.mine[i] ? '✕' : '🚩'; }
      else if (over && f.mine[i]) { cls += ' mine'; txt = '✹'; }
      html += `<button type="button" class="${cls}" data-i="${i}">${txt}</button>`;
    }
    boardEl.innerHTML = html;
    $('#ms-status').textContent = Af('minesLeft', 'Mìn: {n}', { n: f.mines - f.flags() });
    $('#ms-time').textContent = fmtTime(secs);
  }

  function finish(win: boolean): void {
    over = true; stopTimer();
    render();
    if (win) {
      bestScore(id, level).put(100000 - secs);
      showBanner(banner, 'win', id, level, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), start, () => start(level));
      renderLevelBar(levelBar, id, level, start);
    } else showBanner(banner, 'lose', id, level, tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), start, () => start(level));
  }

  function act(i: number, flag: boolean): void {
    if (over) return;
    if (!timer && !f.placed && !flag) { t0 = Date.now(); timer = window.setInterval(() => { secs = Math.floor((Date.now() - t0) / 1000); $('#ms-time').textContent = fmtTime(secs); }, 500); }
    if (flag) { f.toggleFlag(i); render(); return; }
    const ok = f.state[i] === 1 ? f.chord(i) : f.state[i] === 2 ? true : f.open(i);
    if (!ok) return finish(false);
    if (f.won()) return finish(true);
    render();
  }

  let pressTimer = 0, longPressed = false;
  boardEl.addEventListener('pointerdown', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.ms-cell');
    if (!el || e.button === 2) return;
    longPressed = false;
    pressTimer = window.setTimeout(() => { longPressed = true; act(Number(el.dataset.i), true); }, 450);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) boardEl.addEventListener(ev, () => window.clearTimeout(pressTimer));
  boardEl.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.ms-cell');
    if (!el) return;
    if (longPressed) { longPressed = false; return; }
    act(Number(el.dataset.i), flagMode);
  });
  boardEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const el = (e.target as HTMLElement).closest<HTMLElement>('.ms-cell');
    if (el) act(Number(el.dataset.i), true);
  });
  flagBtn.addEventListener('click', () => { flagMode = !flagMode; flagBtn.setAttribute('aria-pressed', String(flagMode)); flagBtn.classList.toggle('btn-primary', flagMode); });
  $('#ms-new').addEventListener('click', () => start(level));
  fullscreenButton();
  start(level);
}
