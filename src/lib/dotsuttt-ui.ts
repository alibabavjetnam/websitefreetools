/** Giao diện Nối điểm (Dots and Boxes) và Ultimate Tic-Tac-Toe, đánh với máy qua 10 cấp. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { DOTS_SIZE, dotsAi, dotsBase, dotsNew, dotsOver, dotsPlay, dotsScore, utAi, utMoves, utNew, utPlay, type Dots, type Ut } from '../calc/dotsuttt';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah } from './arcade-ui';

export function mountDots(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="dt-status"></b><span id="dt-score"></span></div>
        <div class="dt-board gboard" id="dt-board"></div>
      </div>
      <div class="game-side">
        <div class="row"><button type="button" class="btn" id="dt-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button></div>
        <p class="note">${Ah('note.dots', 'Lần lượt nối hai chấm kề nhau bằng một đường. Ai nối đường thứ tư khép kín một ô vuông sẽ chiếm ô đó (màu của mình) và được đi tiếp. Hết đường, ai chiếm nhiều ô hơn thắng. Đừng nối đường thứ ba của một ô, kẻo đối thủ chiếm mất.')}</p>
      </div>
    </div>`);
  const board = $('#dt-board'), status = $('#dt-status');
  let level = progressOf(id).unlocked;
  let d: Dots = dotsNew(3);
  let thinking = false, over = false, token = 0;

  function start(lv: number): void {
    level = lv; token++; d = dotsNew(DOTS_SIZE[level - 1]); thinking = false; over = false;
    clearBanner(banner); renderLevelBar(levelBar, id, level, start); render();
  }
  function render(): void {
    const n = d.n, base = dotsBase(n);
    board.style.setProperty('--n', String(n));
    let html = '';
    for (let r = 0; r <= 2 * n; r++) for (let c = 0; c <= 2 * n; c++) {
      const rr = r >> 1, cc = c >> 1;
      if (r % 2 === 0 && c % 2 === 0) html += '<i class="dt-dot"></i>';
      else if (r % 2 === 0) { const l = rr * n + cc; html += `<button type="button" class="dt-line h p${d.line[l]}" data-l="${l}" ${d.line[l] ? 'disabled' : ''} aria-label="line"></button>`; }
      else if (c % 2 === 0) { const l = base + rr * (n + 1) + cc; html += `<button type="button" class="dt-line v p${d.line[l]}" data-l="${l}" ${d.line[l] ? 'disabled' : ''} aria-label="line"></button>`; }
      else html += `<span class="dt-box p${d.box[rr * n + cc]}"></span>`;
    }
    board.innerHTML = html;
    const [a, b] = dotsScore(d);
    $('#dt-score').textContent = Af('youVsAi', 'Bạn {a} – Máy {b}', { a, b });
    if (!over) status.textContent = thinking ? t('lib.game.thinking', 'Máy đang nghĩ…') : t('lib.game.yourTurn', 'Đến lượt bạn');
  }
  function finish(): boolean {
    if (!dotsOver(d)) return false;
    over = true; thinking = false; render();
    const [a, b] = dotsScore(d);
    const kind = a > b ? 'win' : a < b ? 'lose' : 'draw';
    showBanner(banner, kind, id, level, kind === 'win' ? tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }) : kind === 'lose' ? tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }) : tf('lib.game.draw', 'Hoà — chưa vượt qua cấp {n}.', { n: level }), start, () => start(level));
    renderLevelBar(levelBar, id, level, start);
    return true;
  }
  function aiLoop(): void {
    thinking = true; render(); const my = token;
    setTimeout(() => {
      if (my !== token) return;
      const l = dotsAi(d, level);
      const got = dotsPlay(d, l, 2); render();
      if (finish()) return;
      if (got) aiLoop(); else { thinking = false; render(); }
    }, 420);
  }
  board.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.dt-line'); if (!b || over || thinking) return;
    const got = dotsPlay(d, Number(b.dataset.l), 1); render();
    if (finish()) return;
    if (!got) aiLoop();
  });
  $('#dt-new').addEventListener('click', () => start(level));
  fullscreenButton();
  start(level);
}

export function mountUltimate(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="ut-status"></b></div>
        <div class="ut-board gboard" id="ut-board"></div>
      </div>
      <div class="game-side">
        <div class="row"><button type="button" class="btn" id="ut-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button></div>
        <p class="note">${Ah('note.ultimate', 'Bàn gồm 9 bàn caro nhỏ. Bạn cầm X, đi trước. Ô bạn chọn trong bàn nhỏ quyết định bàn nhỏ mà đối thủ phải đi tiếp (bàn được tô sáng); nếu bàn đó đã xong thì được đi bất cứ đâu. Thắng một bàn nhỏ để chiếm nó; chiếm 3 bàn nhỏ thành hàng ngang, dọc hoặc chéo là thắng cả ván.')}</p>
      </div>
    </div>`);
  const board = $('#ut-board'), status = $('#ut-status');
  let level = progressOf(id).unlocked;
  let s: Ut = utNew(), last = -1;
  let thinking = false, over = false, token = 0;

  function start(lv: number): void {
    level = lv; token++; s = utNew(); last = -1; thinking = false; over = false;
    clearBanner(banner); renderLevelBar(levelBar, id, level, start); render();
  }
  function render(): void {
    const legal = new Set(over || thinking || s.turn !== 1 ? [] : utMoves(s));
    let html = '';
    for (let b = 0; b < 9; b++) {
      const lw = s.local[b];
      const active = !s.winner && (s.next < 0 ? !lw : s.next === b);
      html += `<div class="ut-local${active ? ' active' : ''}${lw ? ' w' + lw : ''}">`;
      for (let c = 0; c < 9; c++) {
        const i = b * 9 + c, v = s.cells[i];
        html += `<button type="button" class="ut-c${v === 1 ? ' x' : v === 2 ? ' o' : ''}${i === last ? ' last' : ''}${legal.has(i) ? ' can' : ''}" data-i="${i}">${v === 1 ? '✕' : v === 2 ? '◯' : ''}</button>`;
      }
      html += `${lw ? `<span class="ut-big">${lw === 1 ? '✕' : lw === 2 ? '◯' : '–'}</span>` : ''}</div>`;
    }
    board.innerHTML = html;
    if (!over) status.textContent = thinking ? t('lib.game.thinking', 'Máy đang nghĩ…') : t('lib.game.yourTurn', 'Đến lượt bạn');
  }
  function finish(): boolean {
    if (!s.winner) return false;
    over = true; thinking = false; render();
    const kind = s.winner === 1 ? 'win' : s.winner === 2 ? 'lose' : 'draw';
    showBanner(banner, kind, id, level, kind === 'win' ? tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }) : kind === 'lose' ? tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }) : tf('lib.game.draw', 'Hoà — chưa vượt qua cấp {n}.', { n: level }), start, () => start(level));
    renderLevelBar(levelBar, id, level, start);
    return true;
  }
  board.addEventListener('click', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('.ut-c.can'); if (!c || over || thinking) return;
    const m = Number(c.dataset.i); utPlay(s, m); last = m; thinking = true; render();
    if (finish()) return;
    const my = token;
    setTimeout(() => {
      if (my !== token) return;
      const mv = utAi(s, level); utPlay(s, mv); last = mv; thinking = false; render(); finish();
    }, 60);
  });
  $('#ut-new').addEventListener('click', () => start(level));
  void A;
  fullscreenButton();
  start(level);
}
