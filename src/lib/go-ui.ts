/**
 * Giao diện cờ vây. Hai chế độ trong cùng trang:
 *  - Đánh với máy: người chơi cầm Đen (đi trước), máy cầm Trắng; bàn 5x5, 7x7, 9x9 theo cấp.
 *  - Chơi với người (online): chọn bàn 9x9, 13x13 hoặc 19x19, komi 6,5.
 */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { BLACK, GO_LEVELS, WHITE, areaScore, candidateMoves, goAiMove, play } from '../calc/go';
import { clearBanner, fullscreenButton, gameShell, modeTabs, progressOf, renderLevelBar, showBanner, type GameMode } from './game-ui';
import { OnlineRoom, resultText, type Color, type OnlineResult } from './online';

const CELL = 60, PAD = 40;
const ONLINE_SIZES = [9, 13, 19];
const ONLINE_KOMI = 6.5;

interface Snap { cells: Uint8Array; ko: number; capB: number; capW: number; last: number; passes: number }

function starPoints(n: number): [number, number][] {
  if (n === 19) return [3, 9, 15].flatMap((r) => [3, 9, 15].map((c) => [r, c] as [number, number]));
  if (n === 13) return [[3, 3], [3, 9], [9, 3], [9, 9], [6, 6]];
  if (n === 9) return [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]];
  if (n === 7) return [[3, 3]];
  return [[2, 2]];
}

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
          <button type="button" class="btn btn-sm ai-only" id="go-undo">${escapeHtml(t('lib.game.undo', 'Đi lại'))}</button>
          <button type="button" class="btn btn-sm ai-only" id="go-resign">${escapeHtml(t('lib.game.resign', 'Đầu hàng'))}</button>
          <button type="button" class="btn btn-sm ai-only" id="go-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>
        </div>
        <p class="note" id="go-msg" aria-live="polite"></p>
        <div class="online-only" id="go-online"></div>
        <p class="note" id="go-note"></p>
      </div>
    </div>`);
  const svg = $('#go-board');
  const statusEl = $('#go-status');
  const msg = $('#go-msg');
  const colorNames = (): [string, string] => [t('lib.online.black', 'Đen'), t('lib.online.white', 'Trắng')];

  let mode: GameMode = 'ai';
  let level = progressOf(id).unlocked;
  let n = 9, komi = 6.5;
  let cells = new Uint8Array(81);
  let ko = -1, capB = 0, capW = 0, last = -1, passes = 0;
  let history: Snap[] = [];
  let thinking = false, over = false, token = 0;
  /** Màu người chơi trên máy này: 0 = Đen, 1 = Trắng */
  let me: Color = 0;
  let onlineReady = false;

  const snap = (): Snap => ({ cells: cells.slice(), ko, capB, capW, last, passes });
  const restore = (s: Snap) => { cells = s.cells.slice(); ko = s.ko; capB = s.capB; capW = s.capW; last = s.last; passes = s.passes; };
  /** Lượt hiện tại theo số nước đã đi (Đen đi trước) */
  let ply = 0;
  const turnColor = (): Color => (ply % 2 === 0 ? 0 : 1);
  const stoneOf = (c: Color) => (c === 0 ? BLACK : WHITE);
  const myTurn = (): boolean => {
    if (over || thinking) return false;
    if (mode === 'ai') return true;
    return onlineReady && room.playing && turnColor() === me;
  };

  function reset(size: number, k: number): void {
    n = size; komi = k;
    cells = new Uint8Array(n * n); ko = -1; capB = 0; capW = 0; last = -1; passes = 0; history = []; ply = 0;
    thinking = false; over = false; msg.textContent = '';
  }

  function setNote(): void {
    $('#go-note').textContent =
      mode === 'ai'
        ? tf('lib.game.goNote', 'Bàn {n}×{n}. Bạn cầm quân Đen, đi trước. Chấm điểm theo diện tích (quân + vùng trống bao kín); quân Trắng được cộng komi {k}. Hãy bắt hết quân chết của đối thủ trước khi bỏ lượt. Không được tự sát, và không được cướp lại ngay (ko). Hai bên liên tiếp bỏ lượt thì ván kết thúc.', { n, k: komi })
        : tf('lib.online.goNote', 'Bàn {n}×{n}, Đen đi trước, Trắng được cộng komi {k}. Chấm điểm theo diện tích; hãy bắt hết quân chết trước khi bỏ lượt. Hai bên liên tiếp bỏ lượt thì ván kết thúc.', { n, k: komi });
  }

  function render(): void {
    const w = (n - 1) * CELL + PAD * 2;
    svg.setAttribute('viewBox', `0 0 ${w} ${w}`);
    const p = (k: number) => PAD + k * CELL;
    const rad = 26;
    let s = `<rect class="go-bg" width="${w}" height="${w}" rx="10"/><g class="go-lines">`;
    for (let k = 0; k < n; k++) s += `<line x1="${p(0)}" y1="${p(k)}" x2="${p(n - 1)}" y2="${p(k)}"/><line x1="${p(k)}" y1="${p(0)}" x2="${p(k)}" y2="${p(n - 1)}"/>`;
    s += '</g>';
    for (const [r, c] of starPoints(n)) s += `<circle class="go-star" cx="${p(c)}" cy="${p(r)}" r="5"/>`;
    const canClick = myTurn();
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n), c = i % n, v = cells[i];
      if (v) {
        s += `<circle class="go-stone ${v === BLACK ? 'b' : 'w'}" cx="${p(c)}" cy="${p(r)}" r="${rad}"/>`;
        if (i === last) s += `<circle class="go-last ${v === BLACK ? 'on-b' : 'on-w'}" cx="${p(c)}" cy="${p(r)}" r="9"/>`;
      } else if (canClick) s += `<circle class="go-hit" data-i="${i}" cx="${p(c)}" cy="${p(r)}" r="28"/>`;
    }
    svg.innerHTML = s;
    $('#go-caps').textContent = tf('lib.game.goCaps', 'Quân đã bắt — Đen: {b} · Trắng: {w}', { b: capB, w: capW });
    ($('#go-pass') as HTMLButtonElement).disabled = !canClick;
    if (over) return;
    if (mode === 'ai') statusEl.textContent = thinking ? t('lib.game.thinking', 'Máy đang nghĩ…') : t('lib.game.yourTurn', 'Đến lượt bạn');
    else if (!onlineReady || !room.playing) statusEl.textContent = t('lib.online.pickTable', 'Tìm đối thủ hoặc mở bàn ở bên cạnh để bắt đầu.');
    else statusEl.textContent = turnColor() === me ? t('lib.game.yourTurn', 'Đến lượt bạn') : t('lib.online.theirTurn', 'Đến lượt đối thủ');
  }

  function scoreText(): { text: string; blackWins: boolean } {
    const sc = areaScore(cells, n);
    return { text: tf('lib.game.goScore', 'Điểm — Đen: {b}, Trắng: {w} + komi {k} = {wt}', { b: sc.black, w: sc.white, k: komi, wt: sc.white + komi }), blackWins: sc.black > sc.white + komi };
  }

  /* --------------------------- Đánh với máy --------------------------- */

  function startAi(lv: number): void {
    level = lv; token++;
    me = 0;
    const g = GO_LEVELS[level - 1];
    reset(g.size, g.komi);
    setNote();
    clearBanner(banner);
    renderLevelBar(levelBar, id, level, startAi);
    render();
  }

  function finishAi(resigned = false): void {
    over = true; thinking = false; token++;
    render();
    const sc = scoreText();
    statusEl.textContent = resigned ? t('lib.game.resigned', 'Bạn đã đầu hàng.') : sc.text;
    const won = !resigned && sc.blackWins;
    if (won) showBanner(banner, 'win', id, level, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), startAi, () => startAi(level));
    else showBanner(banner, 'lose', id, level, tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), startAi, () => startAi(level));
    renderLevelBar(levelBar, id, level, startAi);
  }

  function aiTurn(my: number): void {
    if (my !== token) return;
    const mv = goAiMove(cells, n, ko, WHITE, level, passes > 0, komi);
    if (my !== token) return;
    thinking = false;
    ply++;
    if (mv < 0) {
      passes++;
      if (passes >= 2) { finishAi(); return; }
      ko = -1; last = -1;
      msg.textContent = t('lib.game.aiPassed', 'Máy bỏ lượt. Nếu bạn cũng bỏ lượt, ván kết thúc và chấm điểm.');
      render();
      return;
    }
    const r = play(cells, n, ko, mv, WHITE);
    if (!r) { render(); return; }
    capW += r.captured.length; ko = r.ko; last = mv; passes = 0; msg.textContent = '';
    if (cells.reduce((a, v) => a + (v ? 1 : 0), 0) >= n * n * 0.85 && !candidateMoves(cells, n, ko, BLACK).length) { finishAi(); return; }
    render();
  }

  /* --------------------------- Online --------------------------- */

  /** Đặt quân hoặc bỏ lượt cho màu `c`; trả false nếu không hợp lệ */
  function applyMove(i: number, c: Color): boolean {
    if (i < 0) {
      passes++; ko = -1; last = -1; ply++;
      return true;
    }
    if (!Number.isInteger(i) || i >= n * n) return false;
    const r = play(cells, n, ko, i, stoneOf(c));
    if (!r) return false;
    if (c === 0) capB += r.captured.length; else capW += r.captured.length;
    ko = r.ko; last = i; passes = 0; ply++;
    return true;
  }

  function onlineCheckEnd(): void {
    if (passes < 2) { render(); return; }
    over = true;
    const sc = scoreText();
    const res: OnlineResult = { winner: sc.blackWins ? 0 : 1, reason: 'score', detail: sc.text };
    room.finish(res);
    render();
    statusEl.textContent = `${resultText(res, me, colorNames())} ${sc.text}`;
  }

  const room = new OnlineRoom(
    {
      game: 'go',
      colorNames,
      makeSetup: () => null,
      validSetup: (s, o) => (s === null || s === undefined) && ONLINE_SIZES.includes(Number(o.size)),
      optionsHtml: () => `<label class="on-opt">${escapeHtml(t('lib.online.boardSize', 'Cỡ bàn'))} <select name="size">${ONLINE_SIZES.map((s) => `<option value="${s}"${s === 9 ? ' selected' : ''}>${s}×${s}</option>`).join('')}</select></label>`,
      readOptions: (root) => ({ size: Number((root.querySelector('select[name="size"]') as HTMLSelectElement | null)?.value ?? 9) }),
      validOptions: (o) => ONLINE_SIZES.includes(Number(o.size)),
      describeOptions: (o) => `${Number(o.size)}×${Number(o.size)}`,
      onStart: (g) => {
        token++;
        me = g.myColor;
        reset(Number(g.opts.size) || 9, ONLINE_KOMI);
        setNote();
        for (const raw of g.moves) if (!applyMove(Number((raw as { i?: unknown })?.i), turnColor())) break;
        onlineReady = true;
        clearBanner(banner);
        render();
        if (g.result) {
          over = true;
          render();
          statusEl.textContent = `${resultText(g.result, me, colorNames())} ${g.result.detail ?? ''}`;
        } else onlineCheckEnd();
      },
      onRemoteMove: (mv) => {
        const i = Number((mv as { i?: unknown })?.i);
        if (!applyMove(i, turnColor())) return false;
        msg.textContent = i < 0 ? t('lib.online.oppPassed', 'Đối thủ bỏ lượt. Nếu bạn cũng bỏ lượt, ván kết thúc và chấm điểm.') : '';
        onlineCheckEnd();
        return true;
      },
      onEnd: (r) => {
        over = true;
        render();
        statusEl.textContent = resultText(r, me, colorNames());
      },
      onLeave: () => resetOnlineBoard(),
    },
    $('#go-online'),
  );

  function resetOnlineBoard(): void {
    token++;
    me = 0; onlineReady = false;
    reset(9, ONLINE_KOMI);
    setNote();
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

  svg.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<SVGElement>('.go-hit');
    if (!el || !myTurn()) return;
    const i = Number(el.dataset.i);
    if (mode === 'online') {
      if (!applyMove(i, me)) { msg.textContent = t('lib.game.illegal', 'Nước đi không hợp lệ (tự sát hoặc cướp lại ngay).'); return; }
      msg.textContent = '';
      room.sendMove({ i });
      onlineCheckEnd();
      return;
    }
    const before = snap();
    if (!applyMove(i, 0)) { msg.textContent = t('lib.game.illegal', 'Nước đi không hợp lệ (tự sát hoặc cướp lại ngay).'); return; }
    history.push(before);
    msg.textContent = '';
    thinking = true; render();
    const my = token;
    setTimeout(() => aiTurn(my), 40);
  });

  $('#go-pass').addEventListener('click', () => {
    if (!myTurn()) return;
    if (mode === 'online') {
      applyMove(-1, me);
      msg.textContent = '';
      room.sendMove({ i: -1 });
      onlineCheckEnd();
      return;
    }
    history.push(snap());
    applyMove(-1, 0);
    if (passes >= 2) { finishAi(); return; }
    msg.textContent = '';
    thinking = true; render();
    const my = token;
    setTimeout(() => aiTurn(my), 40);
  });
  $('#go-undo').addEventListener('click', () => {
    if (mode !== 'ai' || thinking || !history.length) return;
    token++;
    restore(history.pop() as Snap);
    ply = 0; // trong chế độ máy luôn tới lượt người chơi sau khi đi lại
    over = false; msg.textContent = '';
    clearBanner(banner); render();
  });
  $('#go-resign').addEventListener('click', () => { if (mode === 'ai' && !over) finishAi(true); });
  $('#go-new').addEventListener('click', () => startAi(level));

  fullscreenButton();
  const tabs = modeTabs(setMode);
  if (tabs.initial === 'online') setMode('online');
  else startAi(level);
}
