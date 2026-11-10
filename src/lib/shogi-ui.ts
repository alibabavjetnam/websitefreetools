/** Giao diện Shogi (cờ Nhật): người cầm quân dưới đi trước, máy 10 cấp. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { KANJI, Shogi, shogiAiMove, type Move } from '../calc/shogi';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Ah } from './arcade-ui';

export function mountShogi(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="sg-status"></b></div>
        <div class="sg-hand" id="sg-hand1"></div>
        <div class="sg-board gboard" id="sg-board" role="grid"></div>
        <div class="sg-hand" id="sg-hand0"></div>
      </div>
      <div class="game-side">
        <div class="row">
          <button type="button" class="btn btn-sm" id="sg-undo">${escapeHtml(t('lib.game.undo', 'Đi lại'))}</button>
          <button type="button" class="btn btn-sm" id="sg-resign">${escapeHtml(t('lib.game.resign', 'Đầu hàng'))}</button>
          <button type="button" class="btn btn-sm" id="sg-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>
        </div>
        <div class="row" id="sg-promo" hidden>
          <button type="button" class="btn btn-primary btn-sm" id="sg-yes">${Ah('sgPromote', 'Thăng cấp')}</button>
          <button type="button" class="btn btn-sm" id="sg-no">${Ah('sgKeep', 'Giữ nguyên')}</button>
        </div>
        <p class="note" id="sg-msg" aria-live="polite"></p>
        <p class="note">${Ah('note.shogi', 'Shogi là cờ tướng kiểu Nhật. Bạn cầm quân phía dưới, đi trước; quân của máy quay ngược đầu. Bắt được quân thì nó vào "tay" bạn và được thả lại lên bất kỳ ô trống nào thay cho một nước đi (không thả tốt vào cột đã có tốt của bạn, không thả quân vào hàng cuối nơi nó không đi tiếp được). Quân đi vào, đi ra hoặc đi trong ba hàng cuối của đối phương được thăng cấp (trừ Vua và Vàng), thăng cấp bắt buộc khi không còn đường đi. Chiếu bí Vua đối phương để thắng. Chữ Hán: 歩 tốt, 香 xe hương, 桂 mã, 銀 bạc, 金 vàng, 角 tượng, 飛 xe, 玉 vua, と 馬 竜 là quân đã thăng cấp.')}</p>
      </div>
    </div>`);
  const boardEl = $('#sg-board'), statusEl = $('#sg-status'), msg = $('#sg-msg'), promo = $('#sg-promo');
  let level = progressOf(id).unlocked;
  let g = new Shogi();
  let moves: Move[] = [];
  let sel = -1, selDrop = 0, legal: Move[] = [], pending: Move[] | null = null;
  let thinking = false, over = false, token = 0;

  function start(lv: number): void {
    level = lv; token++; g = new Shogi(); moves = []; sel = -1; selDrop = 0; legal = []; pending = null; thinking = false; over = false; msg.textContent = '';
    promo.hidden = true; clearBanner(banner); renderLevelBar(levelBar, id, level, start); render();
  }
  function handHtml(side: number): string {
    const h = g.hand[side === 1 ? 0 : 1];
    let s = '';
    for (let t_ = 7; t_ >= 1; t_--) if (h[t_]) s += `<button type="button" class="sg-hp${side === 1 && selDrop === t_ ? ' sel' : ''}${side === 1 ? '' : ' foe'}" ${side === 1 ? `data-drop="${t_}"` : 'disabled'}>${KANJI[t_]}${h[t_] > 1 ? `<i>${h[t_]}</i>` : ''}</button>`;
    return s || `<span class="sg-empty">—</span>`;
  }
  function render(): void {
    const last = moves[moves.length - 1];
    const targets = new Set(legal.map((m) => m.to));
    let html = '';
    for (let i = 0; i < 81; i++) {
      const v = g.b[i];
      const cls = ['sg-sq'];
      if (i === sel) cls.push('sel');
      if (last && (i === last.to || i === last.from)) cls.push('last');
      if (targets.has(i)) cls.push('dot');
      const pc = v ? `<span class="sg-pc ${v > 0 ? 'me' : 'foe'}${Math.abs(v) >= 9 ? ' pr' : ''}">${KANJI[Math.abs(v)]}</span>` : '';
      html += `<button type="button" class="${cls.join(' ')}" data-sq="${i}" role="gridcell">${pc}</button>`;
    }
    boardEl.innerHTML = html;
    $('#sg-hand0').innerHTML = handHtml(1);
    $('#sg-hand1').innerHTML = handHtml(-1);
    if (!over) statusEl.textContent = thinking ? t('lib.game.thinking', 'Máy đang nghĩ…') : g.inCheck(1) ? A('sgCheck', 'Bạn đang bị chiếu!') : t('lib.game.yourTurn', 'Đến lượt bạn');
  }
  function conclude(): boolean {
    const st = g.status();
    if (st === 'play') return false;
    over = true; thinking = false; render();
    if (st === 'draw') showBanner(banner, 'draw', id, level, tf('lib.game.draw', 'Hoà — chưa vượt qua cấp {n}.', { n: level }), start, () => start(level));
    else if (g.turn === -1) { statusEl.textContent = A('sgWin', 'Chiếu bí — bạn thắng.'); showBanner(banner, 'win', id, level, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), start, () => start(level)); }
    else { statusEl.textContent = A('sgLose', 'Bạn bị chiếu bí.'); showBanner(banner, 'lose', id, level, tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), start, () => start(level)); }
    renderLevelBar(levelBar, id, level, start);
    return true;
  }
  function aiTurn(my: number): void {
    if (my !== token) return;
    const m = shogiAiMove(g, level);
    if (my !== token || !m) return;
    g.makeMove(m); moves.push(m); thinking = false;
    if (!conclude()) render();
  }
  function play(m: Move): void {
    g.makeMove(m); moves.push(m); sel = -1; selDrop = 0; legal = []; pending = null; promo.hidden = true; msg.textContent = '';
    if (conclude()) return;
    thinking = true; render(); const my = token; setTimeout(() => aiTurn(my), 60);
  }
  boardEl.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.sg-sq');
    if (!el || over || thinking || g.turn !== 1 || pending) return;
    const sq = Number(el.dataset.sq);
    const mvs = legal.filter((m) => m.to === sq);
    if (mvs.length) {
      if (mvs.length > 1) { pending = mvs; promo.hidden = false; msg.textContent = A('sgAskPromote', 'Thăng cấp quân này?'); return; }
      play(mvs[0]); return;
    }
    if (g.b[sq] > 0) { sel = sq; selDrop = 0; legal = g.legalMoves().filter((m) => m.from === sq); }
    else { sel = -1; selDrop = 0; legal = []; }
    render();
  });
  $('#sg-hand0').addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-drop]');
    if (!el || over || thinking || g.turn !== 1 || pending) return;
    const ty = Number(el.dataset.drop);
    if (selDrop === ty) { selDrop = 0; legal = []; } else { selDrop = ty; sel = -1; legal = g.legalMoves().filter((m) => m.from < 0 && m.type === ty); }
    render();
  });
  const choose = (promote: boolean): void => { if (!pending) return; const m = pending.find((x) => x.promote === promote); if (m) play(m); };
  $('#sg-yes').addEventListener('click', () => choose(true));
  $('#sg-no').addEventListener('click', () => choose(false));
  $('#sg-undo').addEventListener('click', () => {
    if (thinking || !moves.length) return;
    token++;
    do { const m = moves.pop() as Move; g.unmakeMove(m); } while (moves.length && g.turn !== 1);
    over = false; sel = -1; selDrop = 0; legal = []; pending = null; promo.hidden = true; clearBanner(banner); render();
  });
  $('#sg-resign').addEventListener('click', () => {
    if (over) return;
    over = true; token++; thinking = false; render();
    statusEl.textContent = t('lib.game.resigned', 'Bạn đã đầu hàng.');
    showBanner(banner, 'lose', id, level, tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), start, () => start(level));
  });
  $('#sg-new').addEventListener('click', () => start(level));
  fullscreenButton();
  start(level);
}
