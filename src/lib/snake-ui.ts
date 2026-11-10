/** Giao diện rắn săn mồi (canvas): ăn mồi để dài ra, tránh tường, chướng ngại và thân mình. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah, bestScore, bindKeys, bindPad, bindSwipe, padHtml, setupCanvas } from './arcade-ui';
import { sfx } from './sfx';

const N = 20, CELL = 24;
/** ms mỗi bước, độ dài cần đạt, có tường bao (đâm là thua) hay đi xuyên, số chướng ngại */
const LV = [
  { ms: 170, len: 10, walls: false, obs: 0 }, { ms: 150, len: 14, walls: false, obs: 0 }, { ms: 140, len: 16, walls: true, obs: 0 },
  { ms: 130, len: 18, walls: true, obs: 4 }, { ms: 120, len: 20, walls: true, obs: 6 }, { ms: 110, len: 22, walls: true, obs: 8 },
  { ms: 100, len: 24, walls: true, obs: 10 }, { ms: 90, len: 26, walls: true, obs: 12 }, { ms: 80, len: 28, walls: true, obs: 14 },
  { ms: 70, len: 32, walls: true, obs: 16 },
];

export function mountSnake(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="sn-status"></b><span id="sn-score"></span></div>
        <div class="ar-stage gboard" id="sn-stage"><canvas id="sn-cv" aria-label="${escapeHtml(A('snakeBoard', 'Bàn rắn săn mồi'))}"></canvas><div class="ar-overlay" id="sn-ov" hidden></div></div>
        ${padHtml(['left', 'up', 'down', 'right'])}
      </div>
      <div class="game-side">
        <div class="row">
          <button type="button" class="btn btn-primary" id="sn-start">${escapeHtml(t('lib.game.start', 'Bắt đầu'))}</button>
          <button type="button" class="btn" id="sn-pause">${Ah('pause', 'Tạm dừng')}</button>
        </div>
        <p class="note">${Ah('note.snake', 'Điều khiển rắn bằng phím mũi tên, WASD, nút bên dưới hoặc vuốt. Ăn mồi đỏ để dài ra; đạt đủ độ dài là qua cấp. Từ cấp 3 đâm vào tường là thua; cấp cao có thêm chướng ngại. Đừng cắn vào thân mình.')}</p>
      </div>
    </div>`);
  const cv = $('#sn-cv') as HTMLCanvasElement;
  const ctx = setupCanvas(cv, N * CELL, N * CELL);
  const ov = $('#sn-ov');
  let level = progressOf(id).unlocked;
  let snake: number[] = [], dir = 1, queue: number[] = [], food = -1, obs = new Set<number>();
  let running = false, paused = false, over = true, score = 0;
  let raf = 0, last = 0, acc = 0;

  const free = (): number => {
    const taken = new Set([...snake, ...obs]);
    const cells: number[] = [];
    for (let i = 0; i < N * N; i++) if (!taken.has(i)) cells.push(i);
    return cells[Math.floor(Math.random() * cells.length)];
  };

  function start(lv: number): void {
    level = lv;
    cancelAnimationFrame(raf);
    const mid = Math.floor(N / 2) * N + 4;
    snake = [mid, mid - 1, mid - 2]; dir = 1; queue = []; score = 0;
    obs = new Set();
    const L = LV[lv - 1];
    while (obs.size < L.obs) {
      const p = Math.floor(Math.random() * N * N);
      const r = Math.floor(p / N);
      if (Math.abs(r - N / 2) <= 1 || snake.includes(p)) continue;
      obs.add(p);
    }
    food = free();
    running = false; paused = false; over = false;
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
    const L = LV[level - 1];
    while (acc >= L.ms) { acc -= L.ms; step(); if (over) return; }
    draw();
    raf = requestAnimationFrame(loop);
  }
  function end(win: boolean): void {
    over = true; running = false; draw();
    bestScore(id, level).put(score);
    if (win) {
      showBanner(banner, 'win', id, level, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), start, () => start(level));
      renderLevelBar(levelBar, id, level, start);
    } else showBanner(banner, 'lose', id, level, tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), start, () => start(level));
  }
  // dir: 0 lên, 1 phải, 2 xuống, 3 trái
  function step(): void {
    const L = LV[level - 1];
    while (queue.length) { const d = queue.shift() as number; if ((d + 2) % 4 !== dir) { dir = d; break; } }
    const h = snake[0];
    let r = Math.floor(h / N) + [-1, 0, 1, 0][dir], c = (h % N) + [0, 1, 0, -1][dir];
    if (r < 0 || r >= N || c < 0 || c >= N) {
      if (L.walls) { sfx('hit'); return end(false); }
      r = (r + N) % N; c = (c + N) % N;
    }
    const nh = r * N + c;
    const eat = nh === food;
    const body = eat ? snake : snake.slice(0, -1);
    if (body.includes(nh) || obs.has(nh)) { sfx('hit'); return end(false); }
    snake.unshift(nh);
    if (eat) {
      sfx('eat');
      score += 10 * level;
      if (snake.length >= L.len) return end(true);
      food = free();
    } else snake.pop();
  }
  function draw(): void {
    const L = LV[level - 1];
    ctx.fillStyle = '#0f2a1d';
    ctx.fillRect(0, 0, N * CELL, N * CELL);
    for (let i = 0; i < N * N; i++) if ((Math.floor(i / N) + i) % 2) { ctx.fillStyle = 'rgba(255,255,255,.03)'; ctx.fillRect((i % N) * CELL, Math.floor(i / N) * CELL, CELL, CELL); }
    if (L.walls) { ctx.strokeStyle = '#e8590c'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, N * CELL - 4, N * CELL - 4); }
    ctx.fillStyle = '#868e96';
    for (const o of obs) ctx.fillRect((o % N) * CELL + 2, Math.floor(o / N) * CELL + 2, CELL - 4, CELL - 4);
    if (food >= 0) {
      ctx.fillStyle = '#fa5252';
      ctx.beginPath(); ctx.arc((food % N) * CELL + CELL / 2, Math.floor(food / N) * CELL + CELL / 2, CELL / 2.6, 0, Math.PI * 2); ctx.fill();
    }
    snake.forEach((p, k) => {
      ctx.fillStyle = k === 0 ? '#b2f2bb' : k % 2 ? '#51cf66' : '#40c057';
      const x = (p % N) * CELL, y = Math.floor(p / N) * CELL;
      ctx.beginPath(); ctx.roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 6); ctx.fill();
    });
    $('#sn-status').textContent = Af('length', 'Độ dài: {n}/{t}', { n: snake.length, t: L.len });
    $('#sn-score').textContent = `${Af('score', 'Điểm: {n}', { n: score })} · ${Af('best', 'Kỷ lục: {n}', { n: Math.max(bestScore(id, level).get(), score) })}`;
  }
  function key(k: string): void {
    if (k === 'pause') return togglePause();
    const d = { up: 0, right: 1, down: 2, left: 3 }[k];
    if (d !== undefined) {
      if (!running) play();
      if (queue.length < 3) queue.push(d);
      return;
    }
    if (k === 'space') { if (!running) play(); else togglePause(); }
  }
  bindKeys(() => true, key);
  bindPad($('#sn-stage').parentElement as HTMLElement, key);
  bindSwipe($('#sn-stage'), (d) => key(d));
  ov.addEventListener('click', () => (paused ? togglePause() : play()));
  $('#sn-start').addEventListener('click', () => { if (running) start(level); play(); });
  $('#sn-pause').addEventListener('click', togglePause);
  document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused) togglePause(); });
  fullscreenButton();
  start(level);
}
