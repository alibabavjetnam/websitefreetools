/** Giao diện ghép 3: bấm hai ô kề nhau (hoặc vuốt) để đổi chỗ; đạt điểm mục tiêu trong số lượt cho phép. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { M3, M3_LEVELS, Match3 } from '../calc/match3';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah, bestScore } from './arcade-ui';
import { sfx } from './sfx';

// Viên kẹo vẽ bằng SVG: mỗi màu một hình để người mù màu vẫn phân biệt được
const GEM = [
  ['#e03131', '<circle cx="12" cy="12" r="8"/>'],
  ['#1971c2', '<rect x="5" y="5" width="14" height="14" rx="3"/>'],
  ['#2f9e44', '<path d="M12 3l9 16H3z"/>'],
  ['#f08c00', '<path d="M12 3l8.5 6.2-3.2 10H6.7L3.5 9.2z"/>'],
  ['#9c36b5', '<path d="M12 3l9 9-9 9-9-9z"/>'],
  ['#0c8599', '<path d="M12 4l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L12 16.4 7 19.2l1.2-5.6L4 9.8l5.6-.6z"/>'],
  ['#e64980', '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>'],
];
const gemSvg = (v: number): string => (v < 0 ? '' : `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="${GEM[v][0]}" stroke="rgba(0,0,0,.18)" stroke-width="1">${GEM[v][1]}</g><path d="M8 7.5c1.5-1.4 3.6-1.7 5-1.2" stroke="rgba(255,255,255,.75)" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`);

export function mountMatch3(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="m3-status"></b><span id="m3-score"></span></div>
        <div class="m3-board gboard" id="m3-board" role="grid"></div>
      </div>
      <div class="game-side">
        <div class="row">
          <button type="button" class="btn" id="m3-hint">${escapeHtml(t('lib.game.hint', 'Gợi ý'))}</button>
          <button type="button" class="btn" id="m3-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>
        </div>
        <p class="note" id="m3-msg" aria-live="polite"></p>
        <p class="note">${Ah('note.match3', 'Đổi chỗ hai viên kề nhau (bấm lần lượt hoặc vuốt) để tạo hàng từ 3 viên cùng loại trở lên; hàng đó nổ và các viên phía trên rơi xuống. Nổ dây chuyền được nhân điểm. Đạt điểm mục tiêu trước khi hết lượt là qua cấp.')}</p>
      </div>
    </div>`);
  const boardEl = $('#m3-board');
  const msg = $('#m3-msg');
  let level = progressOf(id).unlocked;
  let g = new Match3(5);
  let movesLeft = 0, sel = -1, busy = false, over = false, hint: number[] = [];
  let popping = new Set<number>();

  function start(lv: number): void {
    level = lv;
    const L = M3_LEVELS[lv - 1];
    g = new Match3(L.colors);
    movesLeft = L.moves; sel = -1; busy = false; over = false; hint = []; popping = new Set();
    msg.textContent = '';
    clearBanner(banner);
    renderLevelBar(levelBar, id, level, start);
    render();
  }
  function render(): void {
    boardEl.innerHTML = g.b.map((v, i) => `<button type="button" class="m3-cell${i === sel ? ' sel' : ''}${hint.includes(i) ? ' hint' : ''}${popping.has(i) ? ' pop' : ''}" data-i="${i}">${gemSvg(v)}</button>`).join('');
    const L = M3_LEVELS[level - 1];
    $('#m3-status').textContent = `${Af('target', 'Mục tiêu: {n}', { n: L.target })} · ${Af('movesLeft', 'Còn {n} lượt', { n: movesLeft })}`;
    $('#m3-score').textContent = Af('score', 'Điểm: {n}', { n: g.score });
  }
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  async function swap(a: number, b: number): Promise<void> {
    if (busy || over) return;
    if (!g.trySwap(a, b)) { sel = -1; sfx('error'); render(); return; }
    busy = true; sel = -1; hint = []; movesLeft--;
    let chain = 1;
    for (;;) {
      popping = g.matches();
      if (!popping.size) break;
      sfx(chain > 2 ? 'combo' : 'pop'); render(); await sleep(220);
      popping = new Set();
      g.resolve(chain++);
      render(); await sleep(160);
    }
    if (!g.hasMove()) { g.reshuffle(); msg.textContent = A('shuffled', 'Hết nước đi — đã xáo lại bàn.'); }
    busy = false;
    render();
    const L = M3_LEVELS[level - 1];
    bestScore(id, level).put(g.score);
    if (g.score >= L.target) {
      over = true;
      showBanner(banner, 'win', id, level, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), start, () => start(level));
      renderLevelBar(levelBar, id, level, start);
    } else if (movesLeft <= 0) {
      over = true;
      showBanner(banner, 'lose', id, level, tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), start, () => start(level));
    }
  }

  let downAt = -1, sx = 0, sy = 0;
  boardEl.addEventListener('pointerdown', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.m3-cell');
    downAt = el ? Number(el.dataset.i) : -1; sx = e.clientX; sy = e.clientY;
  });
  boardEl.addEventListener('pointerup', (e) => {
    if (downAt < 0 || busy || over) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 18) {
      const r = Math.floor(downAt / M3), c = downAt % M3;
      const [rr, cc] = Math.abs(dx) > Math.abs(dy) ? [r, c + (dx > 0 ? 1 : -1)] : [r + (dy > 0 ? 1 : -1), c];
      if (rr >= 0 && rr < M3 && cc >= 0 && cc < M3) void swap(downAt, rr * M3 + cc);
      downAt = -1;
      return;
    }
    const i = downAt; downAt = -1;
    if (sel < 0) { sel = i; render(); return; }
    if (sel === i) { sel = -1; render(); return; }
    if (g.adjacent(sel, i)) void swap(sel, i);
    else { sel = i; render(); }
  });
  boardEl.style.touchAction = 'none';
  $('#m3-hint').addEventListener('click', () => { const m = g.findMove(); if (m && !busy) { hint = m; render(); } });
  $('#m3-new').addEventListener('click', () => start(level));
  fullscreenButton();
  start(level);
}
