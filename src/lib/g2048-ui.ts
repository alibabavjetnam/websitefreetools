/** Giao diện trò 2048 */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { LEVELS_2048, canMove, maxTile, move, newBoard, spawn, type Board2048, type Dir } from '../calc/game2048';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah, bestScore, bindKeys, bindSwipe } from './arcade-ui';
import { sfx } from './sfx';

export function mount2048(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="g4-status"></b><span id="g4-score"></span></div>
        <div class="g4-board gboard" id="g4-board" role="grid"></div>
      </div>
      <div class="game-side">
        <div class="row">
          <button type="button" class="btn" id="g4-undo">${escapeHtml(t('lib.game.undo', 'Đi lại'))}</button>
          <button type="button" class="btn" id="g4-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>
        </div>
        <p class="note">${Ah('note.2048', 'Dùng phím mũi tên hoặc vuốt để trượt mọi ô. Hai ô cùng số chạm nhau sẽ gộp thành một. Tạo được ô bằng mục tiêu là qua cấp; hết chỗ trượt là thua.')}</p>
      </div>
    </div>`);
  const boardEl = $('#g4-board');
  let level = progressOf(id).unlocked;
  let b: Board2048 = newBoard(4);
  let prev: Board2048 | null = null;
  let over = false;
  let fresh = -1;
  let merged: number[] = [];

  function start(lv: number): void {
    level = lv;
    b = newBoard(LEVELS_2048[lv - 1].size);
    prev = null; over = false; fresh = -1; merged = [];
    boardEl.style.setProperty('--n', String(b.n));
    clearBanner(banner);
    renderLevelBar(levelBar, id, level, start);
    render();
  }

  function render(): void {
    const L = LEVELS_2048[level - 1];
    boardEl.innerHTML = b.cells.map((v, i) => `<div class="g4-cell${v ? ` v${Math.min(v, 8192)}` : ''}${i === fresh ? ' new' : ''}${merged.includes(i) ? ' pop' : ''}" role="gridcell">${v || ''}</div>`).join('');
    const best = bestScore(id, level);
    $('#g4-status').textContent = Af('target', 'Mục tiêu: {n}', { n: L.target });
    $('#g4-score').textContent = `${Af('score', 'Điểm: {n}', { n: b.score })} · ${Af('best', 'Kỷ lục: {n}', { n: Math.max(best.get(), b.score) })}`;
  }

  function go(dir: Dir): void {
    if (over) return;
    const before: Board2048 = { n: b.n, cells: [...b.cells], score: b.score };
    const r = move(b, dir);
    if (!r.moved) return;
    prev = before;
    merged = r.merged;
    sfx(r.merged.length > 1 ? 'combo' : r.merged.length ? 'coin' : 'tick');
    fresh = spawn(b);
    bestScore(id, level).put(b.score);
    render();
    const L = LEVELS_2048[level - 1];
    if (maxTile(b) >= L.target) {
      over = true;
      showBanner(banner, 'win', id, level, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), start, () => start(level));
      renderLevelBar(levelBar, id, level, start);
    } else if (!canMove(b)) {
      over = true;
      showBanner(banner, 'lose', id, level, tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), start, () => start(level));
    }
  }

  bindKeys(() => true, (k) => { if (k === 'left' || k === 'right' || k === 'up' || k === 'down') go(k); });
  bindSwipe(boardEl, go);
  $('#g4-undo').addEventListener('click', () => {
    if (!prev) return;
    b = prev; prev = null; over = false; fresh = -1; merged = [];
    clearBanner(banner);
    render();
  });
  $('#g4-new').addEventListener('click', () => start(level));
  void A;
  fullscreenButton();
  start(level);
}
