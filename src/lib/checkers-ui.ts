/** Giao diện cờ đam 8x8 (luật Anh): người cầm Đỏ đi trước, máy cầm Đen, 10 cấp. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { Checkers, checkersAiMove, type Move } from '../calc/checkers';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Ah } from './arcade-ui';

export function mountCheckers(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="ck-status"></b></div>
        <div class="ck-board gboard" id="ck-board" role="grid"></div>
      </div>
      <div class="game-side">
        <div class="row">
          <button type="button" class="btn btn-sm" id="ck-undo">${escapeHtml(t('lib.game.undo', 'Đi lại'))}</button>
          <button type="button" class="btn btn-sm" id="ck-resign">${escapeHtml(t('lib.game.resign', 'Đầu hàng'))}</button>
          <button type="button" class="btn btn-sm" id="ck-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>
        </div>
        <p class="note" id="ck-msg" aria-live="polite"></p>
        <p class="note">${Ah('note.checkers', 'Bạn cầm quân Đỏ (phía dưới), đi trước. Quân đi chéo tiến một ô vào ô trống. Nếu có thể nhảy qua quân đối phương thì bắt buộc phải ăn, và được ăn liên tiếp nhiều quân. Quân tới hàng cuối của đối phương được phong Vua, đi và ăn được cả lùi. Hết quân hoặc hết nước đi là thua.')}</p>
      </div>
    </div>`);
  const boardEl = $('#ck-board'), statusEl = $('#ck-status'), msg = $('#ck-msg');
  let level = progressOf(id).unlocked;
  let g = new Checkers();
  let moves: Move[] = [];
  let sel = -1, legal: Move[] = [], mustFrom = new Set<number>();
  let thinking = false, over = false, token = 0;

  function start(lv: number): void {
    level = lv; token++; g = new Checkers(); moves = []; sel = -1; legal = []; thinking = false; over = false; msg.textContent = '';
    clearBanner(banner); renderLevelBar(levelBar, id, level, start); refresh();
  }
  function refresh(): void {
    const all = g.turn === 1 ? g.legalMoves() : [];
    mustFrom = new Set(all.map((m) => m.from));
    render();
  }
  function render(): void {
    const last = moves[moves.length - 1];
    const targets = new Set(legal.map((m) => m.to));
    let html = '';
    for (let i = 0; i < 64; i++) {
      const r = i >> 3, c = i & 7, v = g.b[i], dark = (r + c) % 2 === 1;
      const cls = ['ck-sq', dark ? 'dark' : 'light'];
      if (i === sel) cls.push('sel');
      if (last && (i === last.from || i === last.to)) cls.push('last');
      if (targets.has(i)) cls.push('dot');
      if (!over && !thinking && g.turn === 1 && mustFrom.has(i) && sel < 0) cls.push('can');
      const pc = v ? `<span class="ck-pc ${v > 0 ? 'r' : 'b'}${Math.abs(v) === 2 ? ' k' : ''}">${Math.abs(v) === 2 ? '♛' : ''}</span>` : '';
      html += `<button type="button" class="${cls.join(' ')}" data-sq="${i}" role="gridcell" ${dark ? '' : 'tabindex="-1"'}>${pc}</button>`;
    }
    boardEl.innerHTML = html;
    if (!over) statusEl.textContent = thinking ? t('lib.game.thinking', 'Máy đang nghĩ…') : t('lib.game.yourTurn', 'Đến lượt bạn');
  }
  function conclude(): boolean {
    const st = g.status();
    if (st === 'play') return false;
    over = true; thinking = false; refresh();
    if (st === 'draw') { statusEl.textContent = A('ckDraw', 'Ván cờ hoà.'); showBanner(banner, 'draw', id, level, tf('lib.game.draw', 'Hoà — chưa vượt qua cấp {n}.', { n: level }), start, () => start(level)); }
    else if (g.turn === -1) { statusEl.textContent = A('ckWin', 'Quân Đen hết nước đi — bạn thắng.'); showBanner(banner, 'win', id, level, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), start, () => start(level)); }
    else { statusEl.textContent = A('ckLose', 'Bạn hết nước đi — bạn thua.'); showBanner(banner, 'lose', id, level, tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), start, () => start(level)); }
    renderLevelBar(levelBar, id, level, start);
    return true;
  }
  function aiTurn(my: number): void {
    if (my !== token) return;
    const m = checkersAiMove(g, level);
    if (my !== token || !m) return;
    g.makeMove(m); g.record(); moves.push(m); thinking = false; sel = -1; legal = [];
    if (!conclude()) refresh();
  }
  boardEl.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.ck-sq');
    if (!el || over || thinking || g.turn !== 1) return;
    const sq = Number(el.dataset.sq);
    const mv = legal.find((m) => m.to === sq);
    if (sel >= 0 && mv) {
      g.makeMove(mv); g.record(); moves.push(mv); sel = -1; legal = []; msg.textContent = '';
      if (conclude()) return;
      thinking = true; refresh(); const my = token; setTimeout(() => aiTurn(my), 60);
      return;
    }
    if (g.b[sq] > 0) {
      const ms = g.legalMoves().filter((m) => m.from === sq);
      if (!ms.length) { msg.textContent = mustFrom.size ? A('ckMust', 'Bạn phải ăn quân khi có thể — hãy chọn quân đang nhấp nháy.') : ''; sel = -1; legal = []; }
      else { sel = sq; legal = ms; msg.textContent = ''; }
    } else { sel = -1; legal = []; }
    render();
  });
  $('#ck-undo').addEventListener('click', () => {
    if (thinking || !moves.length) return;
    token++;
    do { const m = moves.pop() as Move; g.unrecord(); g.unmakeMove(m); } while (moves.length && g.turn !== 1);
    over = false; sel = -1; legal = []; clearBanner(banner); refresh();
  });
  $('#ck-resign').addEventListener('click', () => {
    if (over) return;
    over = true; token++; thinking = false; refresh();
    statusEl.textContent = t('lib.game.resigned', 'Bạn đã đầu hàng.');
    showBanner(banner, 'lose', id, level, tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), start, () => start(level));
  });
  $('#ck-new').addEventListener('click', () => start(level));
  fullscreenButton();
  start(level);
}
