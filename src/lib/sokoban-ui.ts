/** Giao diện Sokoban: đẩy thùng vào ô đích. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { sokoMove, sokoNew, sokoWon, type SokoLevel } from '../calc/puzzles3';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { Af, Ah, bindKeys, bindPad, bindSwipe, padHtml } from './arcade-ui';

export function mountSokoban(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><span id="sk-info"></span></div>
        <div class="sk-board gboard" id="sk-board"></div>
      </div>
      <div class="game-side">
        <div class="row">
          <button type="button" class="btn" id="sk-undo">${escapeHtml(t('lib.game.undo', 'Đi lại'))}</button>
          <button type="button" class="btn" id="sk-restart">${Ah('restartLevel', 'Chơi lại màn')}</button>
          <button type="button" class="btn" id="sk-new">${Ah('newLayout', 'Màn khác')}</button>
        </div>
        ${padHtml(['up', 'left', 'down', 'right'])}
        <p class="note">${Ah('note.sokoban', 'Điều khiển người bằng phím mũi tên/WASD, nút bên dưới hoặc vuốt. Đẩy mọi thùng vào các ô đích (chấm tròn). Chỉ đẩy được một thùng mỗi lần, không kéo được, nên đừng đẩy thùng vào góc. Đi lại để sửa nước sai.')}</p>
      </div>
    </div>`);
  const board = $('#sk-board'), info = $('#sk-info');
  let level = progressOf(id).unlocked;
  let cur: SokoLevel, first: SokoLevel;
  let hist: SokoLevel[] = [];
  let moves = 0, over = false;

  function load(l: SokoLevel): void { first = l; cur = l; hist = []; moves = 0; over = false; clearBanner(banner); render(); }
  function start(lv: number): void { level = lv; renderLevelBar(levelBar, id, level, start); load(sokoNew(level)); }
  function render(): void {
    board.style.setProperty('--w', String(cur.w)); board.style.setProperty('--ar', String(cur.w / cur.h));
    let html = '';
    for (let i = 0; i < cur.w * cur.h; i++) {
      const cls = ['sk-c'];
      if (cur.walls[i]) cls.push('wall'); if (cur.goals[i]) cls.push('goal');
      const inner = i === cur.player ? '<b class="sk-p"></b>' : cur.boxes[i] ? `<b class="sk-b${cur.goals[i] ? ' on' : ''}"></b>` : '';
      html += `<div class="${cls.join(' ')}">${inner}</div>`;
    }
    board.innerHTML = html;
    const done = cur.boxes.filter((b, i) => b && cur.goals[i]).length, total = cur.goals.filter(Boolean).length;
    info.textContent = `${Af('moves', 'Nước đi: {n}', { n: moves })} · ${Af('boxesDone', 'Thùng vào đích: {n}/{t}', { n: done, t: total })}`;
  }
  const step = (d: 0 | 1 | 2 | 3): void => {
    if (over) return;
    const m = sokoMove(cur, d); if (!m) return;
    hist.push(cur); cur = m; moves++; render();
    if (sokoWon(cur)) { over = true; showBanner(banner, 'win', id, level, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), start, () => start(level)); renderLevelBar(levelBar, id, level, start); }
  };
  const dirOf: Record<string, 0 | 1 | 2 | 3> = { up: 0, down: 1, left: 2, right: 3 };
  bindKeys(() => !over, (k) => { if (k in dirOf) step(dirOf[k]); });
  bindPad(document.querySelector('.ar-pad') as HTMLElement, (k) => { if (k in dirOf) step(dirOf[k]); });
  bindSwipe(board, (d) => step(dirOf[d]));
  $('#sk-undo').addEventListener('click', () => { const p = hist.pop(); if (p) { cur = p; moves = Math.max(0, moves - 1); over = false; clearBanner(banner); render(); } });
  $('#sk-restart').addEventListener('click', () => load(first));
  $('#sk-new').addEventListener('click', () => start(level));
  fullscreenButton();
  start(level);
}
