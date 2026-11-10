/** Khung chơi canvas dùng chung cho các game arcade đợt 4: vòng lặp, phím, chạm, nút cảm ứng, tạm dừng, thắng/thua. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Ah, bestScore, padHtml, setupCanvas } from './arcade-ui';
import { sfx, type Sfx } from './sfx';
import type { Input, Result } from '../calc/arcade4';

export interface CanvasGame<S extends { ev: string[] }> {
  id: string; W: number; H: number;
  pad: string[];                 // nút cảm ứng (xem LABEL trong arcade-ui)
  noteKey: string; noteFb: string;
  init(level: number): S;
  step(s: S, dt: number, inp: Input): Result;
  draw(c: CanvasRenderingContext2D, s: S, level: number, time: number): void;
  hud(s: S): [string, string];   // [trạng thái trái, điểm phải]
  score(s: S): number;
  /** phím tắt dùng được ('tap' = chạm vào sân) */
  tapIsAction?: boolean;
}

const KEYMAP: Record<string, string> = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down',
  A: 'left', D: 'right', W: 'up', S: 'down', ' ': 'space', Enter: 'fire', z: 'fire', Z: 'fire',
};

export function mountCanvasGame<S extends { ev: string[] }>(g: CanvasGame<S>): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="cg-status"></b><span id="cg-score"></span></div>
        <div class="ar-stage gboard" id="cg-stage" style="--ar:${g.W / g.H}"><canvas id="cg-cv" aria-label="${escapeHtml(A('gameArea', 'Khu vực chơi'))}"></canvas><div class="ar-overlay" id="cg-ov" hidden></div></div>
        ${g.pad.length ? padHtml(g.pad) : ''}
      </div>
      <div class="game-side">
        <div class="row">
          <button type="button" class="btn btn-primary" id="cg-start">${escapeHtml(t('lib.game.start', 'Bắt đầu'))}</button>
          <button type="button" class="btn" id="cg-pause">${Ah('pause', 'Tạm dừng')}</button>
        </div>
        <p class="note">${escapeHtml(A(g.noteKey, g.noteFb))}</p>
      </div>
    </div>`);
  document.querySelector<HTMLElement>('.game-wrap')?.setAttribute('data-sfx', 'own');
  const cv = $('#cg-cv') as HTMLCanvasElement;
  const ctx = setupCanvas(cv, g.W, g.H);
  const ov = $('#cg-ov'), stage = $('#cg-stage');
  const inp: Input = { x: -1, y: -1, down: false, keys: new Set(), pressed: new Set() };
  let level = progressOf(g.id).unlocked;
  let s = g.init(level);
  let running = false, paused = false, over = true, raf = 0, last = 0, clock = 0;

  const drain = (): void => { for (const e of s.ev) sfx(e as Sfx); s.ev.length = 0; };
  function hud(): void {
    const [l, r] = g.hud(s);
    $('#cg-status').textContent = l;
    $('#cg-score').textContent = `${r} · ${tf('lib.arcade.best', 'Kỷ lục: {n}', { n: Math.max(bestScore(g.id, level).get(), g.score(s)) })}`;
  }
  function start(lv: number): void {
    level = lv; cancelAnimationFrame(raf);
    s = g.init(lv); inp.keys.clear(); inp.pressed.clear(); inp.x = inp.y = -1; clock = 0;
    running = false; paused = false; over = false;
    clearBanner(banner);
    renderLevelBar(levelBar, g.id, level, start);
    ov.hidden = false; ov.textContent = t('lib.game.start', 'Bắt đầu');
    g.draw(ctx, s, level, 0); hud();
  }
  function play(): void {
    if (over) start(level);
    if (running && !paused) return;
    running = true; paused = false; ov.hidden = true;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function togglePause(): void {
    if (!running || over) return;
    paused = !paused;
    ov.hidden = !paused; ov.textContent = A('paused', 'Đang tạm dừng');
    if (!paused) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }
  function finish(r: 'win' | 'lose'): void {
    over = true; running = false; drain(); g.draw(ctx, s, level, clock); hud();
    bestScore(g.id, level).put(g.score(s));
    if (r === 'win') {
      showBanner(banner, 'win', g.id, level, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), start, () => start(level));
      renderLevelBar(levelBar, g.id, level, start);
    } else showBanner(banner, 'lose', g.id, level, tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), start, () => start(level));
  }
  function loop(now: number): void {
    if (!running || paused || over) return;
    const dt = Math.min(0.033, (now - last) / 1000); last = now; clock += dt;
    const r = g.step(s, dt, inp);
    inp.pressed.clear();
    drain();
    g.draw(ctx, s, level, clock); hud();
    if (r) return finish(r);
    raf = requestAnimationFrame(loop);
  }

  // Bàn phím
  document.addEventListener('keydown', (e) => {
    if (over && !running) { if (e.key === ' ' && document.activeElement === document.body) { e.preventDefault(); play(); } return; }
    const tg = e.target as HTMLElement;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable)) return;
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { e.preventDefault(); togglePause(); return; }
    const k = KEYMAP[e.key];
    if (!k) return;
    e.preventDefault();
    if (tg && tg.tagName === 'BUTTON') tg.blur();
    if (!running) { play(); }
    else if (paused) { togglePause(); return; }
    if (!inp.keys.has(k)) inp.pressed.add(k);
    inp.keys.add(k);
  });
  document.addEventListener('keyup', (e) => { const k = KEYMAP[e.key]; if (k) inp.keys.delete(k); });
  window.addEventListener('blur', () => inp.keys.clear());
  // Con trỏ / chạm
  const pos = (e: PointerEvent): void => {
    const r = cv.getBoundingClientRect();
    inp.x = ((e.clientX - r.left) / r.width) * g.W; inp.y = ((e.clientY - r.top) / r.height) * g.H;
  };
  stage.style.touchAction = 'none';
  stage.addEventListener('pointermove', pos);
  stage.addEventListener('pointerdown', (e) => {
    pos(e); inp.down = true; inp.pressed.add('tap');
    sx = e.clientX; sy = e.clientY;
  });
  let sx = 0, sy = 0;
  stage.addEventListener('pointerup', (e) => {
    inp.down = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= 24) inp.pressed.add(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    else if (g.tapIsAction) inp.pressed.add('space');
  });
  stage.addEventListener('pointerleave', () => { inp.down = false; });
  // Nút cảm ứng
  document.querySelectorAll<HTMLButtonElement>('.ar-key').forEach((b) => {
    const k = b.dataset.k === 'drop' ? 'fire' : b.dataset.k === 'jump' ? 'up' : (b.dataset.k as string);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!running) play(); inp.keys.add(k); inp.pressed.add(k); if (k === 'fire') inp.keys.add('space'); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { inp.keys.delete(k); if (k === 'fire') inp.keys.delete('space'); });
  });
  ov.addEventListener('click', () => (paused ? togglePause() : play()));
  $('#cg-start').addEventListener('click', () => { if (running) start(level); play(); });
  $('#cg-pause').addEventListener('click', togglePause);
  document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused) togglePause(); });
  fullscreenButton();
  start(level);
}
