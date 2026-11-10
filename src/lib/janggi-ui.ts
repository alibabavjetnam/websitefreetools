/** Giao diện Janggi (cờ tướng Hàn): người cầm quân xanh (dưới) đi trước, máy 10 cấp. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { JG_CHARS, Janggi, janggiAiMove, type Move } from '../calc/janggi';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Ah } from './arcade-ui';

const S = 52, P = 34;
const X = (c: number): number => P + c * S, Y = (r: number): number => P + r * S;

export function mountJanggi(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="jg-status"></b></div>
        <div class="jg-board gboard" id="jg-board"></div>
      </div>
      <div class="game-side">
        <div class="row">
          <button type="button" class="btn btn-sm" id="jg-undo">${escapeHtml(t('lib.game.undo', 'Đi lại'))}</button>
          <button type="button" class="btn btn-sm" id="jg-resign">${escapeHtml(t('lib.game.resign', 'Đầu hàng'))}</button>
          <button type="button" class="btn btn-sm" id="jg-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>
        </div>
        <p class="note" id="jg-msg" aria-live="polite"></p>
        <p class="note">${Ah('note.janggi', 'Janggi là cờ tướng kiểu Hàn Quốc. Bạn cầm quân xanh phía dưới, đi trước. Khác cờ tướng thường: không có sông, hai bên đều có đường chéo trong cung; Tướng và Sĩ đi một ô theo đường kẻ trong cung (kể cả chéo); Xe đi và ăn cả theo đường chéo trong cung; Pháo phải nhảy qua đúng một quân (không phải Pháo) để đi hoặc ăn, và không ăn được Pháo; Mã đi 1 ô thẳng rồi 1 ô chéo; Tượng đi 1 ô thẳng rồi 2 ô chéo, đều bị cản nếu có quân chắn trên đường; Tốt đi tiến hoặc ngang, trong cung đối phương được đi chéo tiến. Hai Tướng không được nhìn thẳng nhau. Chiếu bí Tướng đối phương để thắng. Máy không dùng nước bỏ lượt.')}</p>
      </div>
    </div>`);
  const boardEl = $('#jg-board'), statusEl = $('#jg-status'), msg = $('#jg-msg');
  let level = progressOf(id).unlocked;
  let g = new Janggi();
  let moves: Move[] = [];
  let sel = -1, legal: Move[] = [];
  let thinking = false, over = false, token = 0;

  function start(lv: number): void {
    level = lv; token++; g = new Janggi(); moves = []; sel = -1; legal = []; thinking = false; over = false; msg.textContent = '';
    clearBanner(banner); renderLevelBar(levelBar, id, level, start); render();
  }
  function render(): void {
    const w = P * 2 + 8 * S, h = P * 2 + 9 * S;
    let svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="grid"><rect x="4" y="4" width="${w - 8}" height="${h - 8}" rx="8" fill="#e8c985"/>`;
    for (let r = 0; r < 10; r++) svg += `<line x1="${X(0)}" y1="${Y(r)}" x2="${X(8)}" y2="${Y(r)}" class="jg-ln"/>`;
    for (let c = 0; c < 9; c++) svg += `<line x1="${X(c)}" y1="${Y(0)}" x2="${X(c)}" y2="${Y(9)}" class="jg-ln"/>`;
    for (const r0 of [0, 7]) svg += `<line x1="${X(3)}" y1="${Y(r0)}" x2="${X(5)}" y2="${Y(r0 + 2)}" class="jg-ln"/><line x1="${X(5)}" y1="${Y(r0)}" x2="${X(3)}" y2="${Y(r0 + 2)}" class="jg-ln"/>`;
    const last = moves[moves.length - 1];
    const targets = new Set(legal.map((m) => m.to));
    if (last) for (const k of [last.from, last.to]) svg += `<rect x="${X(k % 9) - 22}" y="${Y(k / 9 | 0) - 22}" width="44" height="44" rx="6" class="jg-last"/>`;
    for (let i = 0; i < 90; i++) {
      const r = i / 9 | 0, c = i % 9, v = g.b[i];
      if (v) {
        const big = Math.abs(v) === 7, side = v > 0 ? 'me' : 'foe';
        svg += `<g class="jg-pc ${side}${i === sel ? ' sel' : ''}"><circle cx="${X(c)}" cy="${Y(r)}" r="${big ? 24 : 20}"/><text x="${X(c)}" y="${Y(r) + 8}" text-anchor="middle" font-size="${big ? 26 : 22}">${JG_CHARS[Math.abs(v)]}</text></g>`;
      }
      if (targets.has(i)) svg += `<circle cx="${X(c)}" cy="${Y(r)}" r="${v ? 26 : 8}" class="jg-dot${v ? ' cap' : ''}"/>`;
      svg += `<rect x="${X(c) - S / 2}" y="${Y(r) - S / 2}" width="${S}" height="${S}" fill="transparent" data-sq="${i}"/>`;
    }
    boardEl.innerHTML = svg + '</svg>';
    if (!over) statusEl.textContent = thinking ? t('lib.game.thinking', 'Máy đang nghĩ…') : g.inCheck(1) ? A('jgCheck', 'Bạn đang bị chiếu!') : t('lib.game.yourTurn', 'Đến lượt bạn');
  }
  function conclude(): boolean {
    const st = g.status();
    if (st === 'play') return false;
    over = true; thinking = false; render();
    if (st === 'draw') showBanner(banner, 'draw', id, level, tf('lib.game.draw', 'Hoà — chưa vượt qua cấp {n}.', { n: level }), start, () => start(level));
    else if (g.turn === -1) { statusEl.textContent = A('jgWin', 'Chiếu bí — bạn thắng.'); showBanner(banner, 'win', id, level, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), start, () => start(level)); }
    else { statusEl.textContent = A('jgLose', 'Bạn bị chiếu bí.'); showBanner(banner, 'lose', id, level, tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), start, () => start(level)); }
    renderLevelBar(levelBar, id, level, start);
    return true;
  }
  function aiTurn(my: number): void {
    if (my !== token) return;
    const m = janggiAiMove(g, level);
    if (my !== token || !m) return;
    g.makeMove(m); moves.push(m); thinking = false;
    if (!conclude()) render();
  }
  boardEl.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<SVGElement>('[data-sq]');
    if (!el || over || thinking || g.turn !== 1) return;
    const sq = Number(el.getAttribute('data-sq'));
    const mv = legal.find((m) => m.to === sq);
    if (sel >= 0 && mv) {
      g.makeMove(mv); moves.push(mv); sel = -1; legal = []; msg.textContent = '';
      if (conclude()) return;
      thinking = true; render(); const my = token; setTimeout(() => aiTurn(my), 60);
      return;
    }
    if (g.b[sq] > 0) { sel = sq; legal = g.legalMoves().filter((m) => m.from === sq); } else { sel = -1; legal = []; }
    render();
  });
  $('#jg-undo').addEventListener('click', () => {
    if (thinking || !moves.length) return;
    token++;
    do { const m = moves.pop() as Move; g.unmakeMove(m); } while (moves.length && g.turn !== 1);
    over = false; sel = -1; legal = []; clearBanner(banner); render();
  });
  $('#jg-resign').addEventListener('click', () => {
    if (over) return;
    over = true; token++; thinking = false; render();
    statusEl.textContent = t('lib.game.resigned', 'Bạn đã đầu hàng.');
    showBanner(banner, 'lose', id, level, tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), start, () => start(level));
  });
  $('#jg-new').addEventListener('click', () => start(level));
  fullscreenButton();
  start(level);
}
