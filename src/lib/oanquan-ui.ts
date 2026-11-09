/** Giao diện Ô ăn quan: người chơi ở hàng dưới, máy ở hàng trên; vòng 12 ô, 10 cấp. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { oqAiMove, oqMoves, oqNew, oqPlay, oqWinner, ownSquares, type OqMove, type OqState } from '../calc/oanquan';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah } from './arcade-ui';

export function mountOanQuan(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="oq-status"></b><span id="oq-score"></span></div>
        <div class="oq-board gboard" id="oq-board"></div>
      </div>
      <div class="game-side">
        <div class="row">
          <button type="button" class="btn" id="oq-undo">${escapeHtml(t('lib.game.undo', 'Đi lại'))}</button>
          <button type="button" class="btn" id="oq-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>
        </div>
        <p class="note" id="oq-msg" aria-live="polite"></p>
        <p class="note">${Ah('note.oanquan', 'Trò dân gian Việt Nam. Hàng dưới là của bạn, hàng trên của máy; hai đầu là ô Quan. Bấm một ô dân của bạn rồi chọn hướng rải: lấy hết dân trong ô và rải mỗi ô một viên. Rải xong, nếu ô kế tiếp có dân thì bốc tiếp rải tiếp; nếu ô kế tiếp trống và liền sau nó có dân hoặc quan thì ăn hết ô đó (ăn liên tiếp nếu lại cách một ô trống). Gặp ô Quan hoặc hai ô trống liền nhau thì dừng. Quan = 10 điểm, dân = 1 điểm. Hết dân ở phía mình thì lấy 5 điểm đã ăn rải lại. Hai ô Quan bị ăn hết, ván kết thúc; ai nhiều điểm hơn thắng.')}</p>
      </div>
    </div>`);
  const boardEl = $('#oq-board'), statusEl = $('#oq-status'), msg = $('#oq-msg');
  let level = progressOf(id).unlocked;
  let s: OqState = oqNew(0);
  let hist: OqState[] = [];
  let sel = -1, last: OqMove | null = null;
  let thinking = false, over = false, token = 0;

  function start(lv: number): void {
    level = lv; token++; const first = Math.random() < 0.5 ? 0 : 1;
    s = oqNew(first); hist = []; sel = -1; last = null; thinking = false; over = false; msg.textContent = '';
    clearBanner(banner); renderLevelBar(levelBar, id, level, start); render();
    if (first === 1) aiLater();
  }
  const dots = (n: number): string => `<span class="oq-dots">${Array.from({ length: Math.min(n, 24) }, () => '<i></i>').join('')}</span>`;
  const cell = (i: number): string => {
    const big = i === 0 || i === 6;
    const mine = ownSquares(0).includes(i);
    const can = mine && !over && !thinking && s.turn === 0 && s.dan[i] > 0;
    const cls = ['oq-sq', big ? 'big' : '', i === sel ? 'sel' : '', can ? 'can' : '', last && last.sq === i ? 'last' : ''].filter(Boolean).join(' ');
    const q = s.quan[i] ? '<b class="oq-quan"></b>' : '';
    const dirs = i === sel ? `<span class="oq-dirs"><button type="button" data-dir="-1" aria-label="${escapeHtml(A('left', 'Sang trái'))}">◀</button><button type="button" data-dir="1" aria-label="${escapeHtml(A('right', 'Sang phải'))}">▶</button></span>` : '';
    return `<div class="${cls}" data-sq="${i}" style="grid-area:${gridArea(i)}">${q}${dots(s.dan[i])}<em>${s.dan[i] || ''}</em>${dirs}</div>`;
  };
  // Lưới 7 cột × 2 hàng: ô quan 0 ở cột 1 (hai hàng), ô quan 6 ở cột 7; hàng dưới 1..5; hàng trên 11..7
  function gridArea(i: number): string {
    if (i === 0) return '1 / 1 / 3 / 2';
    if (i === 6) return '1 / 7 / 3 / 8';
    if (i <= 5) return `2 / ${i + 1} / 3 / ${i + 2}`;
    return `1 / ${13 - i} / 2 / ${14 - i}`;
  }
  function render(): void {
    boardEl.innerHTML = Array.from({ length: 12 }, (_, i) => cell(i)).join('');
    $('#oq-score').textContent = Af('youVsAi', 'Bạn {a} – Máy {b}', { a: s.score[0], b: s.score[1] });
    if (!over) statusEl.textContent = thinking || s.turn === 1 ? t('lib.game.thinking', 'Máy đang nghĩ…') : t('lib.game.yourTurn', 'Đến lượt bạn');
  }
  function conclude(): boolean {
    if (!s.over) return false;
    over = true; thinking = false; render();
    const w = oqWinner(s);
    const kind = w > 0 ? 'win' : w < 0 ? 'lose' : 'draw';
    statusEl.textContent = kind === 'win' ? A('oqWin', 'Ván kết thúc — bạn nhiều điểm hơn.') : kind === 'lose' ? A('oqLose', 'Ván kết thúc — máy nhiều điểm hơn.') : A('oqDraw', 'Ván kết thúc — hoà điểm.');
    const text = kind === 'win' ? tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }) : kind === 'lose' ? tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }) : tf('lib.game.draw', 'Hoà — chưa vượt qua cấp {n}.', { n: level });
    showBanner(banner, kind, id, level, text, start, () => start(level));
    renderLevelBar(levelBar, id, level, start);
    return true;
  }
  function aiLater(): void {
    thinking = true; render(); const my = token;
    setTimeout(() => {
      if (my !== token) return;
      const m = oqAiMove(s, level);
      if (!m) { thinking = false; conclude(); return; }
      s = oqPlay(s, m); last = m; thinking = false; render();
      if (conclude()) return;
      if (s.turn === 1) aiLater();
    }, 450);
  }
  boardEl.addEventListener('click', (e) => {
    if (over || thinking || s.turn !== 0) return;
    const d = (e.target as HTMLElement).closest<HTMLElement>('[data-dir]');
    if (d && sel >= 0) {
      hist.push(s);
      const m: OqMove = { sq: sel, dir: Number(d.dataset.dir) as 1 | -1 };
      s = oqPlay(s, m); last = m; sel = -1; msg.textContent = ''; render();
      if (conclude()) return;
      if (s.turn === 1) aiLater();
      return;
    }
    const el = (e.target as HTMLElement).closest<HTMLElement>('.oq-sq');
    if (!el) return;
    const i = Number(el.dataset.sq);
    sel = ownSquares(0).includes(i) && s.dan[i] > 0 && i !== sel ? i : -1;
    msg.textContent = sel >= 0 ? A('oqPick', 'Chọn hướng rải: ◀ hoặc ▶.') : '';
    render();
  });
  $('#oq-undo').addEventListener('click', () => {
    if (thinking || !hist.length) return;
    token++; s = hist.pop() as OqState; over = false; sel = -1; last = null; clearBanner(banner); render();
  });
  $('#oq-new').addEventListener('click', () => start(level));
  void oqMoves;
  fullscreenButton();
  start(level);
}
