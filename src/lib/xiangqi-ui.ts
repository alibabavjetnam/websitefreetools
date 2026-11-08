/** Giao diện cờ tướng: người chơi cầm quân Đỏ (dưới, đi trước), máy cầm quân Đen, 10 cấp. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { Position, xiangqiAiMove, type Move } from '../calc/xiangqi';
import { clearBanner, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';

const CELL = 60, PAD = 40;
const W = 8 * CELL + PAD * 2, H = 9 * CELL + PAD * 2;
const RED = ['', '帥', '仕', '相', '傌', '俥', '炮', '兵'];
const BLK = ['', '將', '士', '象', '馬', '車', '砲', '卒'];
const px = (c: number) => PAD + c * CELL;
const py = (r: number) => PAD + r * CELL;

function boardLines(): string {
  let s = '';
  for (let r = 0; r < 10; r++) s += `<line x1="${px(0)}" y1="${py(r)}" x2="${px(8)}" y2="${py(r)}"/>`;
  for (let c = 0; c < 9; c++) {
    if (c === 0 || c === 8) s += `<line x1="${px(c)}" y1="${py(0)}" x2="${px(c)}" y2="${py(9)}"/>`;
    else s += `<line x1="${px(c)}" y1="${py(0)}" x2="${px(c)}" y2="${py(4)}"/><line x1="${px(c)}" y1="${py(5)}" x2="${px(c)}" y2="${py(9)}"/>`;
  }
  for (const r0 of [0, 7]) {
    s += `<line x1="${px(3)}" y1="${py(r0)}" x2="${px(5)}" y2="${py(r0 + 2)}"/><line x1="${px(5)}" y1="${py(r0)}" x2="${px(3)}" y2="${py(r0 + 2)}"/>`;
  }
  s += `<rect class="xq-frame" x="${px(0) - 6}" y="${py(0) - 6}" width="${8 * CELL + 12}" height="${9 * CELL + 12}"/>`;
  s += `<text class="xq-river" x="${px(2)}" y="${(py(4) + py(5)) / 2 + 9}" text-anchor="middle">楚 河</text><text class="xq-river" x="${px(6)}" y="${(py(4) + py(5)) / 2 + 9}" text-anchor="middle">漢 界</text>`;
  return s;
}

export function mountXiangqi(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="xq-status"></b></div>
        <svg class="xq-board" id="xq-board" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(t('lib.game.xiangqi', 'Bàn cờ tướng'))}"></svg>
      </div>
      <div class="game-side">
        <div class="row">
          <button type="button" class="btn btn-sm" id="xq-undo">${escapeHtml(t('lib.game.undo', 'Đi lại'))}</button>
          <button type="button" class="btn btn-sm" id="xq-resign">${escapeHtml(t('lib.game.resign', 'Đầu hàng'))}</button>
          <button type="button" class="btn btn-sm" id="xq-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>
        </div>
        <p class="note">${escapeHtml(t('lib.game.xqNote', 'Bạn cầm quân Đỏ (phía dưới), đi trước. Bấm quân của bạn rồi bấm ô muốn đến. Hai tướng không được đối mặt nhau; chiếu bí hoặc hết nước đi là thua.'))}</p>
      </div>
    </div>`);
  const svg = $('#xq-board');
  const statusEl = $('#xq-status');
  const lines = boardLines();

  let level = progressOf(id).unlocked;
  let pos = Position.start();
  let moves: Move[] = [];
  let sel = -1;
  let legal: Move[] = [];
  let thinking = false;
  let over = false;
  let token = 0;

  function start(lv: number): void {
    level = lv; token++;
    pos = Position.start(); moves = []; sel = -1; legal = []; thinking = false; over = false;
    clearBanner(banner);
    renderLevelBar(levelBar, id, level, start);
    render();
  }

  function render(): void {
    const last = moves[moves.length - 1];
    const checkSq = pos.inCheck() ? pos.kingSq[pos.turn === 1 ? 0 : 1] : -1;
    const targets = new Set(legal.map((m) => m.to));
    let s = `<rect class="xq-bg" width="${W}" height="${H}" rx="10"/><g class="xq-lines">${lines}</g>`;
    if (last) for (const q of [last.from, last.to]) s += `<rect class="xq-last" x="${px(q % 9) - 27}" y="${py(Math.floor(q / 9)) - 27}" width="54" height="54" rx="8"/>`;
    for (let i = 0; i < 90; i++) {
      const v = pos.b[i], r = Math.floor(i / 9), c = i % 9;
      if (v) {
        const red = v > 0;
        s += `<g class="xq-pc ${red ? 'red' : 'blk'}${i === sel ? ' sel' : ''}${i === checkSq ? ' check' : ''}"><circle cx="${px(c)}" cy="${py(r)}" r="25"/><circle class="in" cx="${px(c)}" cy="${py(r)}" r="20"/><text x="${px(c)}" y="${py(r) + 9}" text-anchor="middle">${(red ? RED : BLK)[Math.abs(v)]}</text></g>`;
      }
      if (targets.has(i)) s += v ? `<circle class="xq-cap" cx="${px(c)}" cy="${py(r)}" r="29"/>` : `<circle class="xq-dot" cx="${px(c)}" cy="${py(r)}" r="8"/>`;
      s += `<circle class="xq-hit" data-i="${i}" cx="${px(c)}" cy="${py(r)}" r="28"/>`;
    }
    svg.innerHTML = s;
    if (over) return;
    statusEl.textContent = thinking ? t('lib.game.thinking', 'Máy đang nghĩ…') : t('lib.game.yourTurn', 'Đến lượt bạn') + (pos.inCheck() ? ` — ${t('lib.game.xqCheck', 'Chiếu tướng!')}` : '');
  }

  function end(kind: 'win' | 'lose' | 'draw', text: string, status: string): void {
    statusEl.textContent = status;
    showBanner(banner, kind, id, level, text, start, () => start(level));
    renderLevelBar(levelBar, id, level, start);
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
    if (st === 'draw') { end('draw', tf('lib.game.draw', 'Hoà — chưa vượt qua cấp {n}.', { n: level }), t('lib.game.chessDraw', 'Ván cờ hoà.')); return; }
    // chiếu bí hoặc hết nước đi: bên đang đến lượt thua
    const msg = st === 'checkmate' ? (byPlayer ? t('lib.game.xqMateWin', 'Chiếu bí! Bạn thắng.') : t('lib.game.xqMateLose', 'Bạn bị chiếu bí.'))
      : (byPlayer ? t('lib.game.xqStaleWin', 'Quân Đen hết nước đi — bạn thắng.') : t('lib.game.xqStaleLose', 'Bạn hết nước đi — bạn thua.'));
    if (byPlayer) end('win', tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), msg);
    else end('lose', tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), msg);
  }

  function aiTurn(my: number): void {
    if (my !== token) return;
    const m = xiangqiAiMove(pos, level);
    if (my !== token || !m) return;
    pos.makeMove(m); moves.push(m);
    afterMove(false);
  }

  svg.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<SVGElement>('.xq-hit');
    if (!el || over || thinking) return;
    const i = Number(el.dataset.i);
    const mv = legal.find((m) => m.to === i);
    if (sel >= 0 && mv) { pos.makeMove(mv); moves.push(mv); afterMove(true); return; }
    if (pos.b[i] > 0) { sel = i; legal = pos.legalMoves().filter((m) => m.from === i); } else { sel = -1; legal = []; }
    render();
  });

  $('#xq-undo').addEventListener('click', () => {
    if (thinking || !moves.length) return;
    token++;
    do { const m = moves.pop() as Move; pos.unrecord(); pos.unmakeMove(m); } while (moves.length && pos.turn !== 1);
    over = false; sel = -1; legal = [];
    clearBanner(banner); render();
  });
  $('#xq-resign').addEventListener('click', () => {
    if (over) return;
    over = true; token++; thinking = false; render();
    end('lose', tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), t('lib.game.resigned', 'Bạn đã đầu hàng.'));
  });
  $('#xq-new').addEventListener('click', () => start(level));

  start(level);
}
