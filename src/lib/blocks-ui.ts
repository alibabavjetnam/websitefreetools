/** Giao diện xếp gạch rơi (canvas) */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { BLOCK_LEVELS, BlockGame, COLOR, COLS, ROWS, cellsOf } from '../calc/blocks';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah, bestScore, bindKeys, bindPad, padHtml, setupCanvas } from './arcade-ui';
import { sfx } from './sfx';

const CELL = 28;

export function mountBlocks(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="bk-status"></b><span id="bk-score"></span></div>
        <div class="ar-stage gboard" id="bk-stage" style="--ar:${COLS / ROWS}"><canvas id="bk-cv" aria-label="${escapeHtml(A('blocksBoard', 'Bàn xếp gạch'))}"></canvas><div class="ar-overlay" id="bk-ov" hidden></div></div>
        ${padHtml(['left', 'rotate', 'right', 'down', 'drop'])}
      </div>
      <div class="game-side">
        <div class="bk-next"><span>${Ah('next', 'Khối tiếp theo')}</span><canvas id="bk-next"></canvas></div>
        <div class="row">
          <button type="button" class="btn btn-primary" id="bk-start">${escapeHtml(t('lib.game.start', 'Bắt đầu'))}</button>
          <button type="button" class="btn" id="bk-pause">${Ah('pause', 'Tạm dừng')}</button>
        </div>
        <p class="note">${Ah('note.blocks', 'Xoay và xếp các khối rơi để lấp kín hàng ngang; hàng đầy sẽ biến mất. Phím ← → để di chuyển, ↑ để xoay, ↓ rơi nhanh, phím cách thả thẳng xuống, P để tạm dừng. Xoá đủ số hàng là qua cấp; khối chạm đỉnh là thua.')}</p>
      </div>
    </div>`);
  const cv = $('#bk-cv') as HTMLCanvasElement;
  const ctx = setupCanvas(cv, COLS * CELL, ROWS * CELL);
  const nv = $('#bk-next') as HTMLCanvasElement;
  const nctx = setupCanvas(nv, 4 * 18, 3 * 4 * 18);
  const ov = $('#bk-ov');
  let level = progressOf(id).unlocked;
  let g = new BlockGame();
  let running = false, paused = false, over = true;
  let raf = 0, last = 0, acc = 0;

  function start(lv: number): void {
    level = lv;
    g = new BlockGame();
    running = false; paused = false; over = false;
    cancelAnimationFrame(raf);
    clearBanner(banner);
    renderLevelBar(levelBar, id, level, start);
    ov.hidden = false; ov.textContent = t('lib.game.start', 'Bắt đầu');
    draw();
  }

  function play(): void {
    if (over) start(level);
    if (running && !paused) return;
    running = true; paused = false; ov.hidden = true;
    last = performance.now(); acc = 0;
    raf = requestAnimationFrame(loop);
  }

  function togglePause(): void {
    if (!running || over) return;
    paused = !paused;
    ov.hidden = !paused; ov.textContent = A('paused', 'Đang tạm dừng');
    if (!paused) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }

  function loop(now: number): void {
    if (!running || paused || over) return;
    acc += now - last; last = now;
    const ms = BLOCK_LEVELS[level - 1].ms;
    while (acc >= ms) { acc -= ms; after(g.step()); if (over) return; }
    draw();
    raf = requestAnimationFrame(loop);
  }

  function after(cleared: number): void {
    if (cleared < 0 && !g.over) return;
    if (cleared >= 4) sfx('clear'); else if (cleared > 0) sfx('line'); else sfx('drop');
    const L = BLOCK_LEVELS[level - 1];
    bestScore(id, level).put(g.score);
    if (g.lines >= L.lines) {
      over = true; running = false; draw();
      showBanner(banner, 'win', id, level, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), start, () => start(level));
      renderLevelBar(levelBar, id, level, start);
    } else if (g.over) {
      over = true; running = false; draw();
      showBanner(banner, 'lose', id, level, tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), start, () => start(level));
    }
  }

  function cell(c: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, alpha = 1): void {
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
    c.fillStyle = 'rgba(255,255,255,.28)';
    c.fillRect(x * s + 1, y * s + 1, s - 2, 4);
    c.globalAlpha = 1;
  }

  function draw(): void {
    ctx.fillStyle = '#101828';
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
    ctx.strokeStyle = 'rgba(255,255,255,.05)';
    for (let x = 1; x < COLS; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, ROWS * CELL); ctx.stroke(); }
    for (let y = 1; y < ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(COLS * CELL, y * CELL); ctx.stroke(); }
    for (let i = 0; i < COLS * ROWS; i++) if (g.grid[i]) cell(ctx, i % COLS, Math.floor(i / COLS), CELL, COLOR[g.grid[i]]);
    if (!g.over && running) {
      const gy = g.ghostY();
      for (const [x, y] of cellsOf({ ...g.cur, y: gy })) if (y >= 0) cell(ctx, x, y, CELL, COLOR[g.cur.kind], 0.22);
    }
    if (!g.over) for (const [x, y] of cellsOf(g.cur)) if (y >= 0) cell(ctx, x, y, CELL, COLOR[g.cur.kind]);
    nctx.clearRect(0, 0, 72, 216);
    g.next.forEach((k, n) => { for (const [x, y] of cellsOf({ kind: k, rot: 0, x: 0, y: 0 })) cell(nctx, x, y + n * 4, 18, COLOR[k]); });
    const L = BLOCK_LEVELS[level - 1];
    $('#bk-status').textContent = Af('lines', 'Hàng: {n}/{t}', { n: g.lines, t: L.lines });
    $('#bk-score').textContent = `${Af('score', 'Điểm: {n}', { n: g.score })} · ${Af('best', 'Kỷ lục: {n}', { n: Math.max(bestScore(id, level).get(), g.score) })}`;
  }

  function key(k: string): void {
    if (k === 'pause') return togglePause();
    if (!running) { if (k === 'space' || k === 'drop') play(); return; }
    if (paused || over) return;
    if (k === 'left') { g.shift(-1); sfx('tick'); }
    else if (k === 'right') { g.shift(1); sfx('tick'); }
    else if (k === 'up' || k === 'rotate') { g.rotate(1); sfx('select'); }
    else if (k === 'down') { const r = g.step(); if (r < 0) g.score += 1; after(r); }
    else if (k === 'space' || k === 'drop') after(g.hardDrop());
    if (!over) draw();
  }

  bindKeys(() => running || !over, key);
  bindPad($('#bk-stage').parentElement as HTMLElement, key, ['left', 'right', 'down']);
  ov.addEventListener('click', () => (paused ? togglePause() : play()));
  $('#bk-start').addEventListener('click', () => { if (running) start(level); play(); });
  $('#bk-pause').addEventListener('click', togglePause);
  document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused) togglePause(); });
  fullscreenButton();
  start(level);
}
