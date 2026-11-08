/** Giao diện cờ vua: người chơi cầm quân Trắng, máy cầm quân Đen, 10 cấp. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { Position, chessAiMove, type Move } from '../calc/chess';
import { clearBanner, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';

const GLYPH = ['', '♟', '♞', '♝', '♜', '♛', '♚'];
const FILES = 'abcdefgh';

export function mountChess(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="ch-status"></b></div>
        <div class="chess-board" id="ch-board" role="grid"></div>
      </div>
      <div class="game-side">
        <div class="row">
          <button type="button" class="btn btn-sm" id="ch-undo">${escapeHtml(t('lib.game.undo', 'Đi lại'))}</button>
          <button type="button" class="btn btn-sm" id="ch-resign">${escapeHtml(t('lib.game.resign', 'Đầu hàng'))}</button>
          <button type="button" class="btn btn-sm" id="ch-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>
        </div>
        <p class="note">${escapeHtml(t('lib.game.chessNote', 'Bạn cầm quân Trắng, đi trước. Bấm quân của bạn rồi bấm ô muốn đến. Tốt tới cuối bàn tự phong thành Hậu. Thắng bằng cách chiếu bí quân Đen.'))}</p>
      </div>
    </div>`);
  const boardEl = $('#ch-board');
  const statusEl = $('#ch-status');

  let level = progressOf(id).unlocked;
  let pos = Position.start();
  let moves: Move[] = [];
  let sel = -1;
  let legal: Move[] = [];
  let thinking = false;
  let over = false;
  let token = 0;

  function start(lv: number): void {
    level = lv;
    token++;
    pos = Position.start(); moves = []; sel = -1; legal = []; thinking = false; over = false;
    clearBanner(banner);
    renderLevelBar(levelBar, id, level, start);
    render();
  }

  function render(): void {
    const last = moves[moves.length - 1];
    const checkSq = pos.inCheck() ? pos.kingSq[pos.turn === 1 ? 0 : 1] : -1;
    const targets = new Map(legal.map((m) => [m.to, m]));
    let html = '';
    for (let sq = 0; sq < 64; sq++) {
      const r = sq >> 3, f = sq & 7, v = pos.b[sq];
      const cls = ['ch-sq', (r + f) % 2 ? 'dark' : 'light'];
      if (sq === sel) cls.push('sel');
      if (last && (sq === last.from || sq === last.to)) cls.push('last');
      if (sq === checkSq) cls.push('check');
      if (targets.has(sq)) cls.push(v ? 'cap' : 'dot');
      const glyph = v ? `<span class="ch-pc ${v > 0 ? 'w' : 'b'}">${GLYPH[Math.abs(v)]}︎</span>` : '';
      const coord = (f === 0 ? `<i class="rk">${8 - r}</i>` : '') + (r === 7 ? `<i class="fl">${FILES[f]}</i>` : '');
      html += `<button type="button" class="${cls.join(' ')}" data-sq="${sq}" role="gridcell" aria-label="${FILES[f]}${8 - r}">${coord}${glyph}</button>`;
    }
    boardEl.innerHTML = html;
    if (over) return;
    statusEl.textContent = thinking ? t('lib.game.thinking', 'Máy đang nghĩ…') : t('lib.game.yourTurn', 'Đến lượt bạn') + (pos.inCheck() ? ` — ${t('lib.game.chessCheck', 'Chiếu!')}` : '');
  }

  function afterMove(byPlayer: boolean): void {
    pos.record();
    sel = -1; legal = [];
    const st = pos.status();
    if (st === 'play') {
      if (byPlayer) { thinking = true; render(); const my = token; setTimeout(() => aiTurn(my), 40); } else { thinking = false; render(); }
      return;
    }
    over = true; thinking = false; render();
    if (st === 'checkmate') {
      if (byPlayer) end('win', tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), t('lib.game.chessMateWin', 'Chiếu bí! Bạn thắng.'));
      else end('lose', tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), t('lib.game.chessMateLose', 'Bạn bị chiếu bí.'));
    } else end('draw', tf('lib.game.draw', 'Hoà — chưa vượt qua cấp {n}.', { n: level }), t('lib.game.chessDraw', 'Ván cờ hoà.'));
  }

  function end(kind: 'win' | 'lose' | 'draw', text: string, status: string): void {
    statusEl.textContent = status;
    showBanner(banner, kind, id, level, text, start, () => start(level));
    renderLevelBar(levelBar, id, level, start);
  }

  function aiTurn(my: number): void {
    if (my !== token) return;
    const m = chessAiMove(pos, level);
    if (my !== token) return;
    if (!m) return;
    pos.makeMove(m); moves.push(m);
    afterMove(false);
  }

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.ch-sq');
    if (!el || over || thinking) return;
    const sq = Number(el.dataset.sq);
    const mv = legal.filter((m) => m.to === sq);
    if (sel >= 0 && mv.length) {
      const m = mv.find((x) => x.promo === 5) || mv[0]; // tự phong Hậu
      pos.makeMove(m); moves.push(m);
      afterMove(true);
      return;
    }
    if (pos.b[sq] > 0) {
      sel = sq;
      legal = pos.legalMoves().filter((m) => m.from === sq);
    } else { sel = -1; legal = []; }
    render();
  });

  $('#ch-undo').addEventListener('click', () => {
    if (thinking || !moves.length) return;
    token++;
    do {
      const m = moves.pop() as Move;
      pos.unrecord(); pos.unmakeMove(m);
    } while (moves.length && pos.turn !== 1);
    over = false; sel = -1; legal = [];
    clearBanner(banner);
    render();
  });
  $('#ch-resign').addEventListener('click', () => {
    if (over) return;
    over = true; token++; thinking = false; render();
    end('lose', tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), t('lib.game.resigned', 'Bạn đã đầu hàng.'));
  });
  $('#ch-new').addEventListener('click', () => start(level));

  start(level);
}
