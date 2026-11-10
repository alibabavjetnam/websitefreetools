/** Giao diện cờ nhảy (Chinese checkers) đánh với máy, 10 cấp. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { CELLS, apply, aiMove, allMoves, cell, newBoard, reach, undo, won, type Board, type Mv } from '../calc/chinesechk';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Ah } from './arcade-ui';

const D = 34;
const px = (k: number): [number, number] => { const c = cell(k); return [(c.q + c.r / 2) * D, c.r * D * 0.866]; };

export function mountChineseChk(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="cc-status"></b></div>
        <div class="cc-board gboard" id="cc-board"></div>
      </div>
      <div class="game-side">
        <div class="row">
          <button type="button" class="btn btn-sm" id="cc-undo">${escapeHtml(t('lib.game.undo', 'Đi lại'))}</button>
          <button type="button" class="btn btn-sm" id="cc-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>
        </div>
        <p class="note" id="cc-msg" aria-live="polite"></p>
        <p class="note">${Ah('note.chinesechk', 'Bạn cầm quân xanh ở góc phải, đưa cả 10 quân sang góc trái đối diện trước máy. Mỗi lượt đi một quân: bước sang ô trống kề bên, hoặc nhảy qua một quân bất kỳ để tới ô trống ngay sau nó, và được nhảy liên tiếp nhiều lần. Bấm quân của bạn rồi bấm ô chấm sáng để đi.')}</p>
      </div>
    </div>`);
  const boardEl = $('#cc-board'), statusEl = $('#cc-status'), msg = $('#cc-msg');
  let level = progressOf(id).unlocked;
  let b: Board = newBoard();
  let hist: Mv[][] = [];
  let sel = -1, targets: number[] = [], last: Mv | null = null, turns = 0;
  let thinking = false, over = false, token = 0;
  const MAX_TURNS = 120;

  function start(lv: number): void {
    level = lv; token++; b = newBoard(); hist = []; sel = -1; targets = []; last = null; turns = 0; thinking = false; over = false; msg.textContent = '';
    clearBanner(banner); renderLevelBar(levelBar, id, level, start); render();
  }
  function render(): void {
    const xs = CELLS.map((c) => (c.q + c.r / 2) * D), ys = CELLS.map((c) => c.r * D * 0.866);
    const pad = D, x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, w = Math.max(...xs) - x0 + pad, h = Math.max(...ys) - y0 + pad;
    let svg = `<svg viewBox="${x0} ${y0} ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="grid">`;
    const tset = new Set(targets);
    for (const c of CELLS) {
      const k = (c.q + 8) * 17 + (c.r + 8), [x, y] = px(k);
      const mine = b.p.has(k), theirs = b.a.has(k);
      const cls = ['cc-c', mine ? 'p' : theirs ? 'a' : '', k === sel ? 'sel' : '', tset.has(k) ? 'tg' : '', last && (last.from === k || last.to === k) ? 'lm' : ''].filter(Boolean).join(' ');
      svg += `<circle class="${cls}" data-k="${k}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(D * 0.4).toFixed(1)}"/>`;
    }
    boardEl.innerHTML = svg + '</svg>';
    statusEl.textContent = thinking ? t('lib.game.thinking', 'Máy đang nghĩ…') : over ? '' : tf('lib.arcade.ccTurn', 'Lượt của bạn · Lượt {n}', { n: turns + 1 });
  }
  function end(kind: 'win' | 'lose' | 'draw', text: string): void {
    over = true;
    showBanner(banner, kind, id, level, text, start, () => start(level));
    renderLevelBar(levelBar, id, level, start);
    render();
  }
  function aiTurn(): void {
    const tk = token;
    thinking = true; render();
    window.setTimeout(() => {
      if (tk !== token) return;
      const m = aiMove(b, level);
      thinking = false;
      if (!m) { end('win', tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level })); return; }
      apply(b, 'a', m); last = m;
      (hist[hist.length - 1] ||= []).push(m);
      if (won(b, 'a')) { end('lose', tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level })); return; }
      turns++;
      if (turns >= MAX_TURNS) { end('draw', A('ccDraw', 'Hết số lượt, hai bên hoà.')); return; }
      render();
    }, 350);
  }
  boardEl.addEventListener('click', (e) => {
    if (over || thinking) return;
    const el = (e.target as Element).closest<SVGElement>('[data-k]');
    if (!el) return;
    const k = Number(el.dataset.k);
    if (b.p.has(k)) { sel = k; targets = reach(b, k); render(); return; }
    if (sel >= 0 && targets.includes(k)) {
      const m: Mv = { from: sel, to: k };
      apply(b, 'p', m); last = m; hist.push([m]); sel = -1; targets = [];
      if (won(b, 'p')) { end('win', tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level })); return; }
      aiTurn(); return;
    }
    sel = -1; targets = []; render();
  });
  $('#cc-undo').addEventListener('click', () => {
    if (over || thinking || !hist.length) return;
    const h = hist.pop() as Mv[];
    if (h[1]) undo(b, 'a', h[1]);
    undo(b, 'p', h[0]);
    sel = -1; targets = []; last = null; turns = Math.max(0, turns - 1); render();
  });
  $('#cc-new').addEventListener('click', () => start(level));
  void allMoves;
  fullscreenButton();
  start(level);
}
