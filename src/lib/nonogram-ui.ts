/** Giao diện Nonogram (Picross): tô ô theo số gợi ý ở hàng và cột. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { nonoClues, nonoLineOk, nonoNew } from '../calc/puzzles3';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah } from './arcade-ui';

export function mountNonogram(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><span id="no-info"></span></div>
        <div class="no-wrap gboard" id="no-board"></div>
      </div>
      <div class="game-side">
        <div class="row">
          <button type="button" class="btn btn-primary" id="no-fill" aria-pressed="true">${Ah('modeFill', 'Tô ô')}</button>
          <button type="button" class="btn" id="no-mark" aria-pressed="false">${Ah('modeMark', 'Đánh dấu ✕')}</button>
        </div>
        <div class="row">
          <button type="button" class="btn" id="no-clear">${Ah('clearAll', 'Xoá hết')}</button>
          <button type="button" class="btn" id="no-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>
        </div>
        <p class="note" id="no-msg" aria-live="polite"></p>
        <p class="note">${Ah('note.nonogram', 'Các số ở đầu mỗi hàng và cột cho biết độ dài các dãy ô liên tiếp được tô trong hàng/cột đó, theo thứ tự, giữa các dãy có ít nhất một ô trống. Bấm hoặc kéo để tô ô; chuyển sang “Đánh dấu ✕” để ghi chú ô chắc chắn trống. Tô đúng mọi gợi ý là thắng.')}</p>
      </div>
    </div>`);
  const board = $('#no-board'), info = $('#no-info');
  let level = progressOf(id).unlocked;
  let n = 5, sol: boolean[] = [], cells: number[] = []; // 0 trống, 1 tô, 2 dấu
  let clues = { rows: [] as number[][], cols: [] as number[][] };
  let mode: 1 | 2 = 1, over = false;
  let paint: number | null = null;

  function start(lv: number): void {
    level = lv; over = false;
    const g = nonoNew(level); n = g.n; sol = g.sol; cells = new Array(n * n).fill(0);
    clues = nonoClues(sol, n);
    clearBanner(banner); renderLevelBar(levelBar, id, level, start); $('#no-msg').textContent = ''; render();
  }
  function lineGot(get: (k: number) => number): number[] {
    const out: number[] = []; let run = 0;
    for (let k = 0; k < n; k++) { if (get(k) === 1) run++; else if (run) { out.push(run); run = 0; } }
    if (run) out.push(run);
    return out.length ? out : [0];
  }
  function render(): void {
    board.style.setProperty('--n', String(n));
    const rowOk = clues.rows.map((c, r) => nonoLineOk(c, lineGot((k) => cells[r * n + k])));
    const colOk = clues.cols.map((c, k) => nonoLineOk(c, lineGot((r) => cells[r * n + k])));
    let html = '<div class="no-corner"></div>';
    html += clues.cols.map((c, k) => `<div class="no-clue col${colOk[k] ? ' ok' : ''}">${c.map((v) => `<b>${v}</b>`).join('')}</div>`).join('');
    for (let r = 0; r < n; r++) {
      html += `<div class="no-clue row${rowOk[r] ? ' ok' : ''}">${clues.rows[r].map((v) => `<b>${v}</b>`).join('')}</div>`;
      for (let k = 0; k < n; k++) {
        const v = cells[r * n + k];
        html += `<button type="button" class="no-cell${v === 1 ? ' on' : v === 2 ? ' x' : ''}${(k + 1) % 5 === 0 && k < n - 1 ? ' bR' : ''}${(r + 1) % 5 === 0 && r < n - 1 ? ' bB' : ''}" data-i="${r * n + k}">${v === 2 ? '✕' : ''}</button>`;
      }
    }
    board.innerHTML = html;
    info.textContent = Af('size', 'Bàn {n}×{n}', { n });
    if (!over && rowOk.every(Boolean) && colOk.every(Boolean)) {
      over = true;
      showBanner(banner, 'win', id, level, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), start, () => start(level));
      renderLevelBar(levelBar, id, level, start);
    }
  }
  const apply = (i: number): void => {
    const cur = cells[i];
    if (paint === null) paint = cur === mode ? 0 : mode;
    if (cells[i] === paint) return;
    if (paint !== 0 && cur !== 0 && cur !== paint && false) return;
    cells[i] = paint; render();
  };
  board.addEventListener('pointerdown', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('.no-cell'); if (!c || over) return;
    e.preventDefault(); paint = null; apply(Number(c.dataset.i));
  });
  board.addEventListener('pointerover', (e) => {
    if (paint === null || over || !(e.buttons & 1)) return;
    const c = (e.target as HTMLElement).closest<HTMLElement>('.no-cell'); if (c) apply(Number(c.dataset.i));
  });
  board.addEventListener('contextmenu', (e) => { e.preventDefault(); });
  document.addEventListener('pointerup', () => { paint = null; });
  const setMode = (m: 1 | 2): void => {
    mode = m;
    $('#no-fill').classList.toggle('btn-primary', m === 1); $('#no-mark').classList.toggle('btn-primary', m === 2);
    $('#no-fill').setAttribute('aria-pressed', String(m === 1)); $('#no-mark').setAttribute('aria-pressed', String(m === 2));
  };
  $('#no-fill').addEventListener('click', () => setMode(1));
  $('#no-mark').addEventListener('click', () => setMode(2));
  $('#no-clear').addEventListener('click', () => { if (!over) { cells = new Array(n * n).fill(0); render(); } });
  $('#no-new').addEventListener('click', () => start(level));
  void A;
  fullscreenButton();
  start(level);
}
