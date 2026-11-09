/**
 * Giao diện cờ vua. Hai chế độ trong cùng trang:
 *  - Đánh với máy: người chơi cầm Trắng, máy cầm Đen, 10 cấp.
 *  - Chơi với người (online): ai cầm Đen thì bàn được xoay để quân mình ở dưới.
 */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { Position, chessAiMove, type Move } from '../calc/chess';
import { clearBanner, gameShell, modeTabs, progressOf, renderLevelBar, showBanner, type GameMode } from './game-ui';
import { OnlineRoom, resultText, type Color, type OnlineResult } from './online';

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
        <div class="ai-only">
          <div class="row">
            <button type="button" class="btn btn-sm" id="ch-undo">${escapeHtml(t('lib.game.undo', 'Đi lại'))}</button>
            <button type="button" class="btn btn-sm" id="ch-resign">${escapeHtml(t('lib.game.resign', 'Đầu hàng'))}</button>
            <button type="button" class="btn btn-sm" id="ch-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>
          </div>
          <p class="note">${escapeHtml(t('lib.game.chessNote', 'Bạn cầm quân Trắng, đi trước. Bấm quân của bạn rồi bấm ô muốn đến. Tốt tới cuối bàn tự phong thành Hậu. Thắng bằng cách chiếu bí quân Đen.'))}</p>
        </div>
        <div class="online-only" id="ch-online"></div>
      </div>
    </div>`);
  const boardEl = $('#ch-board');
  const statusEl = $('#ch-status');
  const colorNames = (): [string, string] => [t('lib.online.white', 'Trắng'), t('lib.online.black', 'Đen')];

  let mode: GameMode = 'ai';
  let level = progressOf(id).unlocked;
  let pos = Position.start();
  let moves: Move[] = [];
  let sel = -1;
  let legal: Move[] = [];
  let thinking = false;
  let over = false;
  let token = 0;
  let me: Color = 0;
  let onlineReady = false;

  const turnColor = (): Color => (pos.turn === 1 ? 0 : 1);
  const myTurn = (): boolean => {
    if (over || thinking) return false;
    if (mode === 'ai') return pos.turn === 1;
    return onlineReady && room.playing && turnColor() === me;
  };

  function render(): void {
    const last = moves[moves.length - 1];
    const checkSq = pos.inCheck() ? pos.kingSq[pos.turn === 1 ? 0 : 1] : -1;
    const targets = new Map(legal.map((m) => [m.to, m]));
    const flip = me === 1;
    let html = '';
    for (let d = 0; d < 64; d++) {
      const sq = flip ? 63 - d : d;
      const r = sq >> 3, f = sq & 7, v = pos.b[sq];
      const dr = d >> 3, df = d & 7;
      const cls = ['ch-sq', (r + f) % 2 ? 'dark' : 'light'];
      if (sq === sel) cls.push('sel');
      if (last && (sq === last.from || sq === last.to)) cls.push('last');
      if (sq === checkSq) cls.push('check');
      if (targets.has(sq)) cls.push(v ? 'cap' : 'dot');
      const glyph = v ? `<span class="ch-pc ${v > 0 ? 'w' : 'b'}">${GLYPH[Math.abs(v)]}︎</span>` : '';
      const coord = (df === 0 ? `<i class="rk">${8 - r}</i>` : '') + (dr === 7 ? `<i class="fl">${FILES[f]}</i>` : '');
      html += `<button type="button" class="${cls.join(' ')}" data-sq="${sq}" role="gridcell" aria-label="${FILES[f]}${8 - r}">${coord}${glyph}</button>`;
    }
    boardEl.innerHTML = html;
    if (over) return;
    const check = pos.inCheck() ? ` — ${t('lib.game.chessCheck', 'Chiếu!')}` : '';
    if (mode === 'ai') statusEl.textContent = thinking ? t('lib.game.thinking', 'Máy đang nghĩ…') : t('lib.game.yourTurn', 'Đến lượt bạn') + check;
    else if (!onlineReady || !room.playing) statusEl.textContent = t('lib.online.pickTable', 'Tìm đối thủ hoặc mở bàn ở bên cạnh để bắt đầu.');
    else statusEl.textContent = (turnColor() === me ? t('lib.game.yourTurn', 'Đến lượt bạn') : t('lib.online.theirTurn', 'Đến lượt đối thủ')) + check;
  }

  /* --------------------------- Đánh với máy --------------------------- */

  function startAi(lv: number): void {
    level = lv;
    token++;
    me = 0;
    pos = Position.start(); moves = []; sel = -1; legal = []; thinking = false; over = false;
    clearBanner(banner);
    renderLevelBar(levelBar, id, level, startAi);
    render();
  }

  function onlineCheckEnd(): void {
    const st = pos.status();
    if (st === 'play') { render(); return; }
    over = true;
    const mover: Color = turnColor() === 0 ? 1 : 0;
    const res: OnlineResult = st === 'checkmate' ? { winner: mover, reason: 'mate' } : { winner: null, reason: st === 'stalemate' ? 'stalemate' : 'draw' };
    room.finish(res);
    render();
    statusEl.textContent = resultText(res, me, colorNames());
  }

  function afterMove(byMe: boolean): void {
    pos.record();
    sel = -1; legal = [];
    if (mode === 'online') { onlineCheckEnd(); return; }
    const st = pos.status();
    if (st === 'play') {
      if (byMe) { thinking = true; render(); const my = token; setTimeout(() => aiTurn(my), 40); } else { thinking = false; render(); }
      return;
    }
    over = true; thinking = false; render();
    if (st === 'checkmate') {
      if (byMe) endAi('win', tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), t('lib.game.chessMateWin', 'Chiếu bí! Bạn thắng.'));
      else endAi('lose', tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), t('lib.game.chessMateLose', 'Bạn bị chiếu bí.'));
    } else endAi('draw', tf('lib.game.draw', 'Hoà — chưa vượt qua cấp {n}.', { n: level }), t('lib.game.chessDraw', 'Ván cờ hoà.'));
  }

  function endAi(kind: 'win' | 'lose' | 'draw', text: string, status: string): void {
    statusEl.textContent = status;
    showBanner(banner, kind, id, level, text, startAi, () => startAi(level));
    renderLevelBar(levelBar, id, level, startAi);
  }

  function aiTurn(my: number): void {
    if (my !== token) return;
    const m = chessAiMove(pos, level);
    if (my !== token || !m) return;
    pos.makeMove(m); moves.push(m);
    afterMove(false);
  }

  /* --------------------------- Online --------------------------- */

  const room = new OnlineRoom(
    {
      game: 'chess',
      colorNames,
      makeSetup: () => null,
      validSetup: (s) => s === null || s === undefined,
      onStart: (g) => {
        token++;
        me = g.myColor;
        pos = Position.start(); moves = []; sel = -1; legal = []; thinking = false; over = false;
        for (const raw of g.moves) if (!applyRemote(raw, false)) break;
        onlineReady = true;
        clearBanner(banner);
        render();
        if (g.result) {
          over = true;
          statusEl.textContent = resultText(g.result, me, colorNames());
        } else onlineCheckEnd();
      },
      onRemoteMove: (mv) => applyRemote(mv, true),
      onEnd: (r) => {
        over = true; sel = -1; legal = [];
        render();
        statusEl.textContent = resultText(r, me, colorNames());
      },
      onLeave: () => resetOnlineBoard(),
    },
    $('#ch-online'),
  );

  function applyRemote(raw: unknown, live: boolean): boolean {
    const o = raw as { f?: unknown; t?: unknown; p?: unknown };
    const m = pos.legalMoves().find((x) => x.from === o?.f && x.to === o?.t && (x.promo || 0) === (Number(o?.p) || 0));
    if (!m) return false;
    pos.makeMove(m); moves.push(m);
    if (live) afterMove(false);
    else pos.record();
    return true;
  }

  function resetOnlineBoard(): void {
    token++;
    me = 0; onlineReady = false;
    pos = Position.start(); moves = []; sel = -1; legal = []; thinking = false; over = false;
    clearBanner(banner);
    render();
  }

  function setMode(m: GameMode): void {
    mode = m;
    if (m === 'online') {
      levelBar.hidden = true;
      resetOnlineBoard();
      void room.open();
    } else {
      room.close();
      levelBar.hidden = false;
      startAi(level);
    }
  }

  /* --------------------------- Thao tác --------------------------- */

  boardEl.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.ch-sq');
    if (!el || !myTurn()) return;
    const sq = Number(el.dataset.sq);
    const mv = legal.filter((m) => m.to === sq);
    if (sel >= 0 && mv.length) {
      const m = mv.find((x) => x.promo === 5) || mv[0]; // tự phong Hậu
      pos.makeMove(m); moves.push(m);
      if (mode === 'online') room.sendMove({ f: m.from, t: m.to, p: m.promo || 0 });
      afterMove(true);
      return;
    }
    if (pos.b[sq] * pos.turn > 0) {
      sel = sq;
      legal = pos.legalMoves().filter((m) => m.from === sq);
    } else { sel = -1; legal = []; }
    render();
  });

  $('#ch-undo').addEventListener('click', () => {
    if (mode !== 'ai' || thinking || !moves.length) return;
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
    if (mode !== 'ai' || over) return;
    over = true; token++; thinking = false; render();
    endAi('lose', tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), t('lib.game.resigned', 'Bạn đã đầu hàng.'));
  });
  $('#ch-new').addEventListener('click', () => startAi(level));

  const tabs = modeTabs(setMode);
  if (tabs.initial === 'online') setMode('online');
  else startAi(level);
}
