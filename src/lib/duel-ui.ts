/** Giao diện ba trò cờ đánh với máy: Cờ caro, Reversi, Nối 4. Người chơi luôn đi trước. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { BOARD_AI_LEVELS, C4_COLS, C4_ROWS, Connect4, GK, Gomoku, Reversi, connect4Ai, gomokuAi, reversiAi } from '../calc/boardgames';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah } from './arcade-ui';

type Kind = 'gomoku' | 'reversi' | 'connect4';

const NOTES: Record<Kind, [string, string]> = {
  gomoku: ['note.gomoku', 'Bạn cầm quân X, đi trước; máy cầm O. Hai bên lần lượt đặt quân vào ô trống trên bàn 15×15. Ai có 5 quân liên tiếp theo hàng ngang, dọc hoặc chéo trước là thắng.'],
  reversi: ['note.reversi', 'Bạn cầm quân Đen, đi trước. Đặt quân sao cho kẹp được một hay nhiều quân Trắng giữa quân mới và quân Đen có sẵn (ngang, dọc, chéo); các quân bị kẹp đổi sang màu của bạn. Không có chỗ đặt hợp lệ thì mất lượt. Hết bàn, ai nhiều quân hơn thắng.'],
  connect4: ['note.connect4', 'Bạn cầm quân đỏ, đi trước. Bấm một cột để thả quân, quân rơi xuống ô thấp nhất còn trống. Ai có 4 quân liên tiếp theo hàng ngang, dọc hoặc chéo trước là thắng.'],
};

export function mountDuel(id: string, kind: Kind): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="du-status"></b><span id="du-score"></span></div>
        <div class="du-board du-${kind} gboard" id="du-board" role="grid"></div>
      </div>
      <div class="game-side">
        <div class="row">
          <button type="button" class="btn" id="du-undo">${escapeHtml(t('lib.game.undo', 'Đi lại'))}</button>
          <button type="button" class="btn" id="du-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>
        </div>
        <p class="note" id="du-msg" aria-live="polite"></p>
        <p class="note">${Ah(NOTES[kind][0], NOTES[kind][1])}</p>
      </div>
    </div>`);
  const boardEl = $('#du-board');
  const statusEl = $('#du-status');
  const msg = $('#du-msg');
  let level = progressOf(id).unlocked;
  let gk = new Gomoku(), rv = new Reversi(), c4 = new Connect4();
  let hist: unknown[] = [];
  let thinking = false, over = false, token = 0;
  let last = -1;
  let winCells: number[] = [];

  const snapshot = (): unknown => (kind === 'gomoku' ? { b: gk.b.slice(), t: gk.turn, m: [...gk.moves] } : kind === 'reversi' ? rv.clone() : { b: c4.b.slice(), t: c4.turn, m: c4.moves });
  function restore(s: unknown): void {
    if (kind === 'gomoku') { const x = s as { b: Int8Array; t: number; m: number[] }; gk = new Gomoku(); gk.b.set(x.b); gk.turn = x.t; gk.moves = x.m; }
    else if (kind === 'reversi') rv = (s as Reversi).clone();
    else { const x = s as { b: Int8Array; t: number; m: number }; c4 = new Connect4(); c4.b.set(x.b); c4.turn = x.t; c4.moves = x.m; }
  }

  function start(lv: number): void {
    level = lv; token++;
    gk = new Gomoku(); rv = new Reversi(); c4 = new Connect4();
    hist = []; thinking = false; over = false; last = -1; winCells = [];
    msg.textContent = '';
    clearBanner(banner);
    renderLevelBar(levelBar, id, level, start);
    render();
  }

  function render(): void {
    let html = '';
    if (kind === 'gomoku') {
      boardEl.style.setProperty('--n', String(GK));
      for (let i = 0; i < GK * GK; i++) {
        const v = gk.b[i];
        html += `<button type="button" class="du-cell${i === last ? ' last' : ''}${winCells.includes(i) ? ' win' : ''}" data-i="${i}">${v === 1 ? '<i class="gx">✕</i>' : v === -1 ? '<i class="go">◯</i>' : ''}</button>`;
      }
    } else if (kind === 'reversi') {
      const legal = !over && !thinking && rv.turn === 1 ? new Set(rv.legal(1)) : new Set<number>();
      for (let i = 0; i < 64; i++) {
        const v = rv.b[i];
        html += `<button type="button" class="du-cell${legal.has(i) ? ' hint' : ''}${i === last ? ' last' : ''}" data-i="${i}">${v ? `<i class="disc ${v === 1 ? 'b' : 'w'}"></i>` : ''}</button>`;
      }
    } else {
      for (let r = 0; r < C4_ROWS; r++) for (let c = 0; c < C4_COLS; c++) {
        const i = r * C4_COLS + c, v = c4.b[i];
        html += `<button type="button" class="du-cell${winCells.includes(i) ? ' win' : ''}${i === last ? ' last' : ''}" data-c="${c}">${v ? `<i class="disc ${v === 1 ? 'r' : 'y'}"></i>` : ''}</button>`;
      }
    }
    boardEl.innerHTML = html;
    if (kind === 'reversi') $('#du-score').textContent = Af('youVsAi', 'Bạn {a} – Máy {b}', { a: rv.count(1), b: rv.count(-1) });
    if (!over) statusEl.textContent = thinking ? t('lib.game.thinking', 'Máy đang nghĩ…') : t('lib.game.yourTurn', 'Đến lượt bạn');
  }

  function end(kindOut: 'win' | 'lose' | 'draw'): void {
    over = true; thinking = false; render();
    const text = kindOut === 'win' ? tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }) : kindOut === 'lose' ? tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }) : tf('lib.game.draw', 'Hoà — chưa vượt qua cấp {n}.', { n: level });
    statusEl.textContent = text;
    showBanner(banner, kindOut, id, level, text, start, () => start(level));
    renderLevelBar(levelBar, id, level, start);
  }

  /** Kiểm tra kết thúc sau nước của `who` (1 người, -1 máy); trả về true nếu đã hết ván */
  function checkEnd(who: number): boolean {
    if (kind === 'gomoku') {
      const w = gk.fiveAt(last);
      if (w) { winCells = w; end(who === 1 ? 'win' : 'lose'); return true; }
      if (gk.full()) { end('draw'); return true; }
    } else if (kind === 'connect4') {
      const w = c4.winner();
      if (w) { winCells = w.cells; end(w.who === 1 ? 'win' : 'lose'); return true; }
      if (c4.full()) { end('draw'); return true; }
    } else if (rv.over()) {
      const a = rv.count(1), b = rv.count(-1);
      end(a > b ? 'win' : a < b ? 'lose' : 'draw'); return true;
    }
    return false;
  }

  function aiTurn(my: number): void {
    if (my !== token || over) return;
    const lv = BOARD_AI_LEVELS[level - 1];
    if (kind === 'gomoku') { last = gomokuAi(gk, lv); gk.play(last); }
    else if (kind === 'connect4') { const c = connect4Ai(c4, lv); const r = c4.play(c); last = r * C4_COLS + c; }
    else {
      const m = reversiAi(rv, lv);
      if (m < 0) { rv.pass(); msg.textContent = A('aiNoMove', 'Máy không còn chỗ đặt, đến lượt bạn.'); }
      else { rv.play(m); last = m; }
    }
    thinking = false;
    if (checkEnd(-1)) return;
    if (kind === 'reversi' && !rv.legal(1).length) {
      rv.pass();
      msg.textContent = A('mustPass', 'Bạn không còn chỗ đặt — mất lượt.');
      thinking = true; render();
      window.setTimeout(() => aiTurn(my), 500);
      return;
    }
    render();
  }

  boardEl.addEventListener('click', (e) => {
    if (over || thinking) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('.du-cell');
    if (!el) return;
    const before = snapshot();
    if (kind === 'gomoku') {
      const i = Number(el.dataset.i);
      if (gk.b[i]) return;
      gk.play(i); last = i;
    } else if (kind === 'connect4') {
      const c = Number(el.dataset.c);
      if (c4.dropRow(c) < 0) return;
      const r = c4.play(c); last = r * C4_COLS + c;
    } else {
      const i = Number(el.dataset.i);
      if (!rv.legal(1).includes(i)) return;
      rv.play(i); last = i;
    }
    hist.push(before);
    msg.textContent = '';
    if (checkEnd(1)) return;
    thinking = true; render();
    const my = ++token;
    window.setTimeout(() => aiTurn(my), 60);
  });

  $('#du-undo').addEventListener('click', () => {
    if (thinking || !hist.length) return;
    token++;
    restore(hist.pop());
    over = false; winCells = []; last = -1; msg.textContent = '';
    clearBanner(banner);
    render();
  });
  $('#du-new').addEventListener('click', () => start(level));
  fullscreenButton();
  start(level);
}
