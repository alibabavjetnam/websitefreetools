/** Giao diện phá gạch (canvas): điều khiển thanh đỡ bằng chuột, chạm hoặc phím ←→, phá hết gạch để qua cấp. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah, bestScore, bindKeys, setupCanvas } from './arcade-ui';
import { sfx } from './sfx';

const W = 480, H = 600, BR = 7;
const COLORS = ['#fa5252', '#fd7e14', '#fcc419', '#40c057', '#228be6', '#7950f2', '#e64980'];

/** Bố cục gạch mỗi cấp: chuỗi các hàng, '#' gạch thường, '2' gạch 2 lần chạm, '.' trống */
const LAYOUTS: string[][] = [
  ['##########', '##########', '##########'],
  ['##########', '##########', '##########', '##########'],
  ['..######..', '.########.', '##########', '##########', '.########.'],
  ['#.#.#.#.#.', '.#.#.#.#.#', '#.#.#.#.#.', '.#.#.#.#.#', '#.#.#.#.#.'],
  ['2222222222', '##########', '##########', '##########', '##########'],
  ['2########2', '#2######2#', '##2####2##', '###2##2###', '####22####'],
  ['##########', '#22222222#', '#2######2#', '#2######2#', '#22222222#', '##########'],
  ['2.2.2.2.2.', '##########', '.2.2.2.2.2', '##########', '2.2.2.2.2.', '##########'],
  ['2222222222', '2########2', '2#222222#2', '2#2####2#2', '2#222222#2', '2222222222'],
  ['2222222222', '2222222222', '##########', '2222222222', '##########', '2222222222', '##########'],
];

interface Brick { x: number; y: number; w: number; h: number; hp: number; c: string }

export function mountBreakout(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="bo-status"></b><span id="bo-score"></span></div>
        <div class="ar-stage gboard" id="bo-stage" style="--ar:${W / H}"><canvas id="bo-cv" aria-label="${escapeHtml(A('breakoutBoard', 'Sân phá gạch'))}"></canvas><div class="ar-overlay" id="bo-ov" hidden></div></div>
      </div>
      <div class="game-side">
        <div class="row">
          <button type="button" class="btn btn-primary" id="bo-start">${escapeHtml(t('lib.game.start', 'Bắt đầu'))}</button>
          <button type="button" class="btn" id="bo-pause">${Ah('pause', 'Tạm dừng')}</button>
        </div>
        <p class="note">${Ah('note.breakout', 'Di chuột, kéo ngón tay trên sân hoặc dùng phím ← → để điều khiển thanh đỡ, giữ cho bóng không rơi. Phá hết gạch là qua cấp; gạch viền đậm cần đánh hai lần. Bạn có 3 mạng. Phím cách để bắt đầu hoặc tạm dừng.')}</p>
      </div>
    </div>`);
  const cv = $('#bo-cv') as HTMLCanvasElement;
  const ctx = setupCanvas(cv, W, H);
  const ov = $('#bo-ov');
  let level = progressOf(id).unlocked;
  let bricks: Brick[] = [];
  let px = W / 2, pw = 90, bx = 0, by = 0, vx = 0, vy = 0, stuck = true;
  let lives = 3, score = 0, keyDir = 0;
  let running = false, paused = false, over = true, raf = 0, last = 0;

  const speed = (): number => 330 + level * 22;
  function build(): void {
    const rows = LAYOUTS[level - 1];
    const cols = 10, bw = (W - 20) / cols, bh = 20;
    bricks = [];
    rows.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === '.') return;
      bricks.push({ x: 10 + c * bw + 2, y: 60 + r * (bh + 4), w: bw - 4, h: bh, hp: ch === '2' ? 2 : 1, c: COLORS[r % COLORS.length] });
    }));
  }
  function resetBall(): void { stuck = true; bx = px; by = H - 44 - BR; vx = 0; vy = 0; }
  function start(lv: number): void {
    level = lv; cancelAnimationFrame(raf);
    pw = Math.max(64, 100 - lv * 3);
    px = W / 2; lives = 3; score = 0;
    build(); resetBall();
    running = false; paused = false; over = false;
    clearBanner(banner);
    renderLevelBar(levelBar, id, level, start);
    ov.hidden = false; ov.textContent = t('lib.game.start', 'Bắt đầu');
    draw();
  }
  function launch(): void {
    if (!stuck) return;
    stuck = false;
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    vx = Math.cos(a) * speed(); vy = Math.sin(a) * speed();
  }
  function play(): void {
    if (over) start(level);
    if (running && !paused) { launch(); return; }
    running = true; paused = false; ov.hidden = true;
    launch();
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function togglePause(): void {
    if (!running || over) return;
    paused = !paused;
    ov.hidden = !paused; ov.textContent = A('paused', 'Đang tạm dừng');
    if (!paused) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }
  function end(win: boolean): void {
    over = true; running = false; draw();
    bestScore(id, level).put(score);
    if (win) {
      showBanner(banner, 'win', id, level, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), start, () => start(level));
      renderLevelBar(levelBar, id, level, start);
    } else showBanner(banner, 'lose', id, level, tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), start, () => start(level));
  }
  function loop(now: number): void {
    if (!running || paused || over) return;
    let dt = Math.min(0.033, (now - last) / 1000); last = now;
    px = Math.max(pw / 2, Math.min(W - pw / 2, px + keyDir * 520 * dt));
    if (stuck) { bx = px; by = H - 44 - BR; }
    else {
      // chia nhỏ bước để bóng không xuyên gạch khi nhanh
      const steps = Math.ceil((Math.hypot(vx, vy) * dt) / 5);
      dt /= steps;
      for (let s = 0; s < steps && !over; s++) physics(dt);
    }
    draw();
    if (!over) raf = requestAnimationFrame(loop);
  }
  function physics(dt: number): void {
    bx += vx * dt; by += vy * dt;
    if (bx < BR) { bx = BR; vx = Math.abs(vx); sfx('tick'); }
    if (bx > W - BR) { bx = W - BR; vx = -Math.abs(vx); sfx('tick'); }
    if (by < BR) { by = BR; vy = Math.abs(vy); }
    const py = H - 44;
    if (vy > 0 && by + BR >= py && by + BR <= py + 14 && bx >= px - pw / 2 - BR && bx <= px + pw / 2 + BR) {
      const rel = (bx - px) / (pw / 2);
      const a = -Math.PI / 2 + Math.max(-1, Math.min(1, rel)) * 1.05;
      const sp = Math.hypot(vx, vy);
      vx = Math.cos(a) * sp; vy = Math.sin(a) * sp; by = py - BR; sfx('bounce');
    }
    if (by > H + 20) {
      lives--; sfx(lives > 0 ? 'warn' : 'boom');
      if (lives <= 0) return end(false);
      resetBall();
      return;
    }
    for (const b of bricks) {
      if (b.hp <= 0) continue;
      const cx = Math.max(b.x, Math.min(bx, b.x + b.w)), cy = Math.max(b.y, Math.min(by, b.y + b.h));
      if ((bx - cx) ** 2 + (by - cy) ** 2 > BR * BR) continue;
      const overlapX = Math.min(bx + BR - b.x, b.x + b.w - (bx - BR));
      const overlapY = Math.min(by + BR - b.y, b.y + b.h - (by - BR));
      if (overlapX < overlapY) vx = -vx; else vy = -vy;
      b.hp--; sfx(b.hp ? 'bounce' : 'brick'); score += b.hp ? 5 : 10 * level;
      if (bricks.every((x) => x.hp <= 0)) return end(true);
      // tăng tốc nhẹ
      vx *= 1.004; vy *= 1.004;
      break;
    }
  }
  function draw(): void {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#14213d'); g.addColorStop(1, '#0b132b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const b of bricks) {
      if (b.hp <= 0) continue;
      ctx.fillStyle = b.c;
      ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, 4);
      if (b.hp > 1) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3); }
    }
    ctx.fillStyle = '#e9ecef';
    ctx.beginPath(); ctx.roundRect(px - pw / 2, H - 44, pw, 12, 6); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(bx, by, BR, 0, Math.PI * 2); ctx.fill();
    $('#bo-status').textContent = `${t('lib.game.lives', 'Mạng')}: ${'♥'.repeat(Math.max(0, lives))}`;
    $('#bo-score').textContent = `${Af('score', 'Điểm: {n}', { n: score })} · ${Af('best', 'Kỷ lục: {n}', { n: Math.max(bestScore(id, level).get(), score) })}`;
  }
  const toX = (clientX: number): number => { const r = cv.getBoundingClientRect(); return ((clientX - r.left) / r.width) * W; };
  const stage = $('#bo-stage');
  stage.addEventListener('pointermove', (e) => { if (running && !paused) px = Math.max(pw / 2, Math.min(W - pw / 2, toX(e.clientX))); if (stuck) draw(); });
  stage.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).id === 'bo-ov') return;
    if (!running || over) { play(); return; }
    if (paused) { togglePause(); return; }
    px = Math.max(pw / 2, Math.min(W - pw / 2, toX(e.clientX)));
    launch();
  });
  stage.style.touchAction = 'none';
  bindKeys(() => true, (k) => {
    if (k === 'pause') return togglePause();
    if (k === 'space') { if (!running || over) play(); else if (stuck) launch(); else togglePause(); }
    if (k === 'left' || k === 'right') { if (!running) play(); keyDir = k === 'left' ? -1 : 1; }
  });
  document.addEventListener('keyup', (e) => { if (/^(ArrowLeft|ArrowRight|a|d|A|D)$/.test(e.key)) keyDir = 0; });
  ov.addEventListener('click', () => (paused ? togglePause() : play()));
  $('#bo-start').addEventListener('click', () => { if (running) start(level); play(); });
  $('#bo-pause').addEventListener('click', togglePause);
  document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused) togglePause(); });
  fullscreenButton();
  start(level);
}
