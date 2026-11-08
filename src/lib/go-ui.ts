/** Giao diện cờ vây: người chơi cầm quân Đen (đi trước), máy cầm quân Trắng; bàn 5x5, 7x7, 9x9 theo cấp. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { BLACK, EMPTY, GO_LEVELS, WHITE, areaScore, candidateMoves, goAiMove, play } from '../calc/go';
import { clearBanner, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';

const CELL = 60, PAD = 40;

interface Snap { cells: Uint8Array; ko: number; capB: number; capW: number; last: number; passes: number }

export function mountGo(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="go-status"></b><span id="go-caps"></span></div>
        <svg class="go-board" id="go-board" role="img" aria-label="${escapeHtml(t('lib.game.goBoard', 'Bàn cờ vây'))}"></svg>
      </div>
      <div class="game-side">
        <div class="row">
          <button type="button" class="btn btn-primary btn-sm" id="go-pass">${escapeHtml(t('lib.game.pass', 'Bỏ lượt'))}</button>
          <button type="button" class="btn btn-sm" id="go-undo">${escapeHtml(t('lib.game.undo', 'Đi lại'))}</button>
          <button type="button" class="btn btn-sm" id="go-resign">${escapeHtml(t('lib.game.resign', 'Đầu hàng'))}</button>
          <button type="button" class="btn btn-sm" id="go-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>
        </div>
        <p class="note" id="go-msg" aria-live="polite"></p>
        <p class="note" id="go-note"></p>
      </div>
    </div>`);
  const svg = $('#go-board');
  const statusEl = $('#go-status');
  const msg = $('#go-msg');

  let level = progressOf(id).unlocked;
  let n = 9, komi = 6.5;
  let cells = new Uint8Array(81);
  let ko = -1, capB = 0, capW = 0, last = -1, passes = 0;
  let history: Snap[] = [];
  let thinking = false, over = false, token = 0;

  const snap = (): Snap => ({ cells: cells.slice(), ko, capB, capW, last, passes });
  const restore = (s: Snap) => { cells = s.cells.slice(); ko = s.ko; capB = s.capB; capW = s.capW; last = s.last; passes = s.passes; };

  function start(lv: number): void {
    level = lv; token++;
    ({ size: n, komi } = GO_LEVELS[level - 1]);
    cells = new Uint8Array(n * n); ko = -1; capB = 0; capW = 0; last = -1; passes = 0; history = [];
    thinking = false; over = false; msg.textContent = '';
    $('#go-note').textContent = tf('lib.game.goNote', 'Bàn {n}×{n}. Bạn cầm quân Đen, đi trước. Chấm điểm theo diện tích (quân + vùng trống bao kín); quân Trắng được cộng komi {k}. Hãy bắt hết quân chết của đối thủ trước khi bỏ lượt. Không được tự sát, và không được cướp lại ngay (ko). Hai bên liên tiếp bỏ lượt thì ván kết thúc.', { n, k: komi });
    clearBanner(banner);
    renderLevelBar(levelBar, id, level, start);
    render();
  }

  function render(): void {
    const w = (n - 1) * CELL + PAD * 2;
    svg.setAttribute('viewBox', `0 0 ${w} ${w}`);
    const p = (k: number) => PAD + k * CELL;
    let s = `<rect class="go-bg" width="${w}" height="${w}" rx="10"/><g class="go-lines">`;
    for (let k = 0; k < n; k++) s += `<line x1="${p(0)}" y1="${p(k)}" x2="${p(n - 1)}" y2="${p(k)}"/><line x1="${p(k)}" y1="${p(0)}" x2="${p(k)}" y2="${p(n - 1)}"/>`;
    s += '</g>';
    const stars = n === 9 ? [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]] : n === 7 ? [[3, 3]] : [[2, 2]];
    for (const [r, c] of stars) s += `<circle class="go-star" cx="${p(c)}" cy="${p(r)}" r="5"/>`;
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n), c = i % n, v = cells[i];
      if (v) {
        s += `<circle class="go-stone ${v === BLACK ? 'b' : 'w'}" cx="${p(c)}" cy="${p(r)}" r="26"/>`;
        if (i === last) s += `<circle class="go-last ${v === BLACK ? 'on-b' : 'on-w'}" cx="${p(c)}" cy="${p(r)}" r="9"/>`;
      } else if (!over && !thinking) s += `<circle class="go-hit" data-i="${i}" cx="${p(c)}" cy="${p(r)}" r="28"/>`;
    }
    svg.innerHTML = s;
    $('#go-caps').textContent = tf('lib.game.goCaps', 'Quân đã bắt — Đen: {b} · Trắng: {w}', { b: capB, w: capW });
    if (!over) statusEl.textContent = thinking ? t('lib.game.thinking', 'Máy đang nghĩ…') : t('lib.game.yourTurn', 'Đến lượt bạn');
  }

  function finish(resigned = false): void {
    over = true; thinking = false; token++;
    render();
    const sc = areaScore(cells, n);
    const text = tf('lib.game.goScore', 'Điểm — Đen: {b}, Trắng: {w} + komi {k} = {wt}', { b: sc.black, w: sc.white, k: komi, wt: sc.white + komi });
    statusEl.textContent = resigned ? t('lib.game.resigned', 'Bạn đã đầu hàng.') : text;
    const won = !resigned && sc.black > sc.white + komi;
    if (won) showBanner(banner, 'win', id, level, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), start, () => start(level));
    else showBanner(banner, 'lose', id, level, tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), start, () => start(level));
    renderLevelBar(levelBar, id, level, start);
  }

  function aiTurn(my: number): void {
    if (my !== token) return;
    const mv = goAiMove(cells, n, ko, WHITE, level, passes > 0, komi);
    if (my !== token) return;
    thinking = false;
    if (mv < 0) {
      passes++;
      if (passes >= 2) { finish(); return; }
      ko = -1; last = -1;
      msg.textContent = t('lib.game.aiPassed', 'Máy bỏ lượt. Nếu bạn cũng bỏ lượt, ván kết thúc và chấm điểm.');
      render();
      return;
    }
    const r = play(cells, n, ko, mv, WHITE);
    if (!r) { render(); return; }
    capW += r.captured.length; ko = r.ko; last = mv; passes = 0; msg.textContent = '';
    if (cells.reduce((a, v) => a + (v ? 1 : 0), 0) >= n * n * 0.85 && !candidateMoves(cells, n, ko, BLACK).length) { finish(); return; }
    render();
  }

  function playerMove(i: number): void {
    const before = snap();
    const r = play(cells, n, ko, i, BLACK);
    if (!r) { msg.textContent = t('lib.game.illegal', 'Nước đi không hợp lệ (tự sát hoặc cướp lại ngay).'); return; }
    history.push(before);
    capB += r.captured.length; ko = r.ko; last = i; passes = 0; msg.textContent = '';
    thinking = true; render();
    const my = token;
    setTimeout(() => aiTurn(my), 40);
  }

  svg.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<SVGElement>('.go-hit');
    if (!el || over || thinking) return;
    playerMove(Number(el.dataset.i));
  });

  $('#go-pass').addEventListener('click', () => {
    if (over || thinking) return;
    history.push(snap());
    passes++; ko = -1; last = -1;
    if (passes >= 2) { finish(); return; }
    msg.textContent = '';
    thinking = true; render();
    const my = token;
    setTimeout(() => aiTurn(my), 40);
  });
  $('#go-undo').addEventListener('click', () => {
    if (thinking || !history.length) return;
    token++;
    restore(history.pop() as Snap);
    over = false; msg.textContent = '';
    clearBanner(banner); render();
  });
  $('#go-resign').addEventListener('click', () => { if (!over) finish(true); });
  $('#go-new').addEventListener('click', () => start(level));

  void EMPTY;
  start(level);
}
