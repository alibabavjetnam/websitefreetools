/** Giao diện đợt 5 (cờ/bàn): Kalah, Rắn & thang, Cờ cối, Hải chiến. Đánh với máy, 10 cấp. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import {
  BS_N, KALAH_AI, NMM_ADJ, NMM_MILLS, NMM_XY, bsAiPick, bsAllSunk, bsNew, bsShoot, bsSunk, kalahAi, kalahMoves, kalahNew, kalahPlay, kalahWinner, nmmAi, nmmApply, nmmMoves, nmmNew, nmmWinner,
  slCell, slMove, slNew, slPlayers, type BsBoard, type Kalah, type Nmm, type NmmMove, type Snl,
} from '../calc/games5';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah } from './arcade-ui';
import { sfx } from './sfx';

const WIN = (n: number): string => tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n });
const LOSE = (n: number): string => tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n });
const wait = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));
const newBtn = (id: string): string => `<button type="button" class="btn" id="${id}">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>`;

/* ================================ Kalah ================================ */
export function mountKalah(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="ka-status"></b><span id="ka-score"></span></div>
        <div class="ka-board gboard" id="ka-board"></div>
      </div>
      <div class="game-side"><div class="row">${newBtn('ka-new')}</div>
        <p class="note">${Ah('note.kalah', 'Bạn chơi hàng dưới, máy hàng trên; ô lớn bên phải là kho của bạn. Bấm một ô để bốc hết hạt và rải ngược chiều kim đồng hồ, mỗi ô một hạt (bỏ qua kho của đối thủ). Hạt cuối rơi vào kho của mình thì được đi tiếp; rơi vào ô trống của mình đối diện ô có hạt thì ăn cả hạt đối diện. Khi một bên hết hạt, bên kia gom hạt còn lại về kho; ai nhiều hạt hơn thắng.')}</p></div>
    </div>`);
  const board = $('#ka-board');
  let level = progressOf(id).unlocked, s: Kalah = kalahNew(0), disp = s.p.slice(), busy = false, token = 0, last = -1;
  function render(): void {
    const mv = !busy && !s.over && s.turn === 0 ? kalahMoves(s) : [];
    const pit = (i: number): string => `<button type="button" class="ka-pit${mv.includes(i) ? ' can' : ''}${i === last ? ' last' : ''}" data-i="${i}" style="grid-area:${i < 6 ? `2 / ${i + 2}` : `1 / ${14 - i}`}" ${mv.includes(i) ? '' : 'disabled'} aria-label="${disp[i]}">${disp[i]}</button>`;
    board.innerHTML = `<div class="ka-store opp" style="grid-area:1 / 1 / 3 / 2">${disp[13]}</div>${[12, 11, 10, 9, 8, 7].map(pit).join('')}${[0, 1, 2, 3, 4, 5].map(pit).join('')}<div class="ka-store" style="grid-area:1 / 8 / 3 / 9">${disp[6]}</div>`;
    $('#ka-score').textContent = Af('youVsAi', 'Bạn {a} – Máy {b}', { a: s.p[6], b: s.p[13] });
    if (!s.over) $('#ka-status').textContent = s.turn === 0 && !busy ? t('lib.game.yourTurn', 'Đến lượt bạn') : t('lib.game.thinking', 'Máy đang nghĩ…');
  }
  async function play(i: number, my: number): Promise<void> {
    busy = true; const r = kalahPlay(s, i); disp = s.p.slice(); disp[i] = 0; last = i; render(); sfx('select');
    for (const k of r.path) { await wait(150); if (my !== token) return; disp[k]++; last = k; render(); sfx('tick'); }
    if (r.captured) { sfx('capture'); await wait(300); } else if (r.extra) sfx('coin');
    s = r.s; disp = s.p.slice(); busy = false; render();
    if (s.over) {
      const w = kalahWinner(s); sfx('select');
      if (w === 0) showBanner(banner, 'win', id, level, WIN(level), start, () => start(level));
      else if (w === 1) showBanner(banner, 'lose', id, level, LOSE(level), start, () => start(level));
      else showBanner(banner, 'draw', id, level, tf('lib.game.draw', 'Hoà — chưa vượt qua cấp {n}.', { n: level }), start, () => start(level));
      renderLevelBar(levelBar, id, level, start); $('#ka-status').textContent = ''; return;
    }
    if (s.turn === 1) { await wait(450); if (my === token) void play(kalahAi(s, level), my); }
  }
  function start(lv: number): void {
    level = lv; const my = ++token; s = kalahNew(Math.random() < 0.5 ? 0 : 1); disp = s.p.slice(); busy = false; last = -1;
    clearBanner(banner); renderLevelBar(levelBar, id, level, start); render();
    if (s.turn === 1) { busy = true; render(); void wait(500).then(() => { if (my === token) void play(kalahAi(s, level), my); }); }
  }
  board.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('.ka-pit.can'); if (b && !busy && s.turn === 0) void play(Number(b.dataset.i), token); });
  $('#ka-new').addEventListener('click', () => start(level));
  void KALAH_AI; fullscreenButton(); start(level);
}

/* ================================ Rắn & thang ================================ */
export function mountSnakes(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="sl-status"></b><span id="sl-info"></span></div>
        <div class="sl-wrap gboard"><div class="sl-board" id="sl-board"></div><svg class="sl-svg" id="sl-svg" viewBox="0 0 100 100" aria-hidden="true"></svg></div>
      </div>
      <div class="game-side">
        <div class="row"><button type="button" class="btn btn-primary" id="sl-roll">${Ah('roll', 'Tung xúc xắc')}</button><span class="sl-die" id="sl-die">🎲</span>${newBtn('sl-new')}</div>
        <p class="note" id="sl-msg" aria-live="polite"></p>
        <p class="note">${Ah('note.snakes', 'Tung xúc xắc rồi đi theo số chấm, từ ô 1 đến ô 100. Gặp chân thang thì leo lên, gặp đầu rắn thì tụt xuống. Từ cấp 4 phải tung đúng số để vào ô 100. Cấp càng cao càng nhiều rắn, ít thang và nhiều đối thủ. Về đích đầu tiên là thắng.')}</p>
      </div>
    </div>`);
  const board = $('#sl-board'), svg = $('#sl-svg') as unknown as SVGSVGElement;
  const COL = ['#e03131', '#1971c2', '#2f9e44', '#f08c00'], NAME = ['cRed', 'cBlue', 'cGreen', 'cYellow'] as const;
  let level = progressOf(id).unlocked, s: Snl = slNew(1), busy = false, token = 0, turns = 0;
  const cx = (n: number): [number, number] => { const { r, c } = slCell(n); return [c * 10 + 5, (9 - r) * 10 + 5]; };
  function build(): void {
    const cells: string[] = [];
    for (let row = 9; row >= 0; row--) for (let col = 0; col < 10; col++) { const n = row % 2 === 0 ? row * 10 + col + 1 : row * 10 + (9 - col) + 1; cells.push(`<div class="sl-cell${(row + col) % 2 ? ' alt' : ''}" data-n="${n}"><i>${n}</i></div>`); }
    board.innerHTML = cells.join('');
    let g = '';
    for (const [a, b] of Object.entries(s.ladders)) { const [x1, y1] = cx(+a), [x2, y2] = cx(b); const dx = (y2 - y1) * 0.04, dy = (x1 - x2) * 0.04; g += `<g stroke="#8d5524" stroke-width="1.1" stroke-linecap="round"><line x1="${x1 - dx}" y1="${y1 - dy}" x2="${x2 - dx}" y2="${y2 - dy}"/><line x1="${x1 + dx}" y1="${y1 + dy}" x2="${x2 + dx}" y2="${y2 + dy}"/></g>`; const n = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / 4)); for (let k = 1; k < n; k++) { const f = k / n; g += `<line x1="${x1 + (x2 - x1) * f - dx}" y1="${y1 + (y2 - y1) * f - dy}" x2="${x1 + (x2 - x1) * f + dx}" y2="${y1 + (y2 - y1) * f + dy}" stroke="#a9733a" stroke-width=".9"/>`; } }
    for (const [a, b] of Object.entries(s.snakes)) { const [x1, y1] = cx(+a), [x2, y2] = cx(b); const mx = (x1 + x2) / 2 + (y2 - y1) * 0.18, my = (y1 + y2) / 2 - (x2 - x1) * 0.18; g += `<path d="M${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}" fill="none" stroke="#c92a2a" stroke-width="2" stroke-linecap="round" opacity=".85"/><circle cx="${x1}" cy="${y1}" r="1.8" fill="#c92a2a"/>`; }
    svg.innerHTML = g;
  }
  function tokens(): void {
    board.querySelectorAll('.sl-tk').forEach((e) => e.remove());
    s.pos.forEach((p, i) => { const cell = board.querySelector(`[data-n="${p}"]`); if (cell) cell.insertAdjacentHTML('beforeend', `<b class="sl-tk" style="background:${COL[i]};--o:${i}">${i === 0 ? '★' : ''}</b>`); });
    $('#sl-status').textContent = s.winner >= 0 ? '' : s.turn === 0 ? t('lib.game.yourTurn', 'Đến lượt bạn') : tf('lib.arcade.turnOf', 'Lượt của {c}…', { c: A(NAME[s.turn], ['Đỏ', 'Xanh dương', 'Xanh lá', 'Vàng'][s.turn]) });
    $('#sl-info').textContent = `${Af('square', 'Ô {n}', { n: s.pos[0] })}`;
    ($('#sl-roll') as HTMLButtonElement).disabled = busy || s.turn !== 0 || s.winner >= 0;
  }
  async function turn(my: number): Promise<void> {
    while (my === token && s.winner < 0) {
      const who = s.turn; busy = true; tokens();
      if (who !== 0) await wait(600);
      const die = $('#sl-die'); sfx('roll');
      for (let k = 0; k < 6; k++) { die.textContent = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][ri6()]; await wait(60); if (my !== token) return; }
      const roll = 1 + ri6(); die.textContent = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][roll - 1];
      const m = slMove(s, who, roll); $('#sl-msg').textContent = '';
      for (const q of m.steps) { await wait(110); if (my !== token) return; s.pos[who] = q; tokens(); sfx('tick'); }
      if (m.jump !== m.end) { await wait(350); s.pos[who] = m.jump; tokens(); const up = m.jump > m.end; sfx(up ? 'coin' : 'whoosh'); $('#sl-msg').textContent = up ? A('ladderUp', 'Leo thang!') : A('snakeDown', 'Rắn nuốt!'); }
      else if (!m.steps.length) $('#sl-msg').textContent = A('needExact', 'Cần tung đúng số để vào ô 100.');
      if (s.pos[who] === 100) {
        s.winner = who; busy = false; tokens();
        if (who === 0) showBanner(banner, 'win', id, level, WIN(level), start, () => start(level)); else showBanner(banner, 'lose', id, level, LOSE(level), start, () => start(level));
        renderLevelBar(levelBar, id, level, start); return;
      }
      s.turn = (who + 1) % s.pos.length; turns++; busy = false; tokens();
      if (s.turn === 0) return;
    }
  }
  const ri6 = (): number => Math.floor(Math.random() * 6);
  function start(lv: number): void {
    level = lv; const my = ++token; s = slNew(lv); busy = false; turns = 0; $('#sl-msg').textContent = '';
    clearBanner(banner); renderLevelBar(levelBar, id, level, start); build(); tokens(); void my;
  }
  $('#sl-roll').addEventListener('click', () => { if (!busy && s.turn === 0 && s.winner < 0) void turn(token); });
  $('#sl-new').addEventListener('click', () => start(level));
  void slPlayers; void turns; fullscreenButton(); start(level);
}

/* ================================ Cờ cối ================================ */
export function mountNmm(id: string): void {
  const SZ = 360, P = 30, STEP = (SZ - 2 * P) / 6;
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="nm-status"></b><span id="nm-info"></span></div>
        <div class="nm-wrap gboard"><svg class="nm-svg" id="nm-svg" viewBox="0 0 ${SZ} ${SZ}"></svg></div>
      </div>
      <div class="game-side"><div class="row">${newBtn('nm-new')}</div>
        <p class="note">${Ah('note.nmm', 'Mỗi bên có 9 quân. Giai đoạn 1: lần lượt đặt quân lên các điểm trống. Giai đoạn 2: di chuyển một quân sang điểm kề trống. Khi chỉ còn 3 quân, được "bay" tới bất kỳ điểm trống nào. Xếp được 3 quân thẳng hàng (một "cối") thì được bốc một quân đối thủ (ưu tiên quân không nằm trong cối). Đối thủ còn dưới 3 quân hoặc không đi được nữa là thua. Bạn cầm quân trắng, đi trước.')}</p></div>
    </div>`);
  const svg = $('#nm-svg');
  let level = progressOf(id).unlocked, s: Nmm = nmmNew(), sel = -1, to = -1, over = false, thinking = false, token = 0, last = -1, removeFrom: NmmMove[] = [];
  const xy = (i: number): [number, number] => [P + NMM_XY[i][0] * STEP, P + NMM_XY[i][1] * STEP];
  function render(): void {
    let g = '<g stroke="#8d6e3f" stroke-width="3" stroke-linecap="round">';
    const seen = new Set<string>();
    NMM_ADJ.forEach((ns, i) => ns.forEach((k) => { const key = [i, k].sort().join('-'); if (seen.has(key)) return; seen.add(key); const [a, b] = xy(i), [c, d] = xy(k); g += `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}"/>`; }));
    g += '</g>';
    const my = !over && !thinking && s.turn === 1, moves = my ? nmmMoves(s) : [];
    const targets = new Set<number>(), froms = new Set<number>(), removable = new Set(removeFrom.map((m) => m.remove));
    if (to < 0 && my) for (const m of moves) { if (s.hand[0] > 0) targets.add(m.to); else if (sel < 0) froms.add(m.from); else if (m.from === sel) targets.add(m.to); }
    for (let i = 0; i < 24; i++) {
      const [x, y] = xy(i), v = s.b[i];
      const cls = ['nm-pt', v === 1 ? 'w' : v === 2 ? 'b' : '', i === sel ? 'sel' : '', targets.has(i) || froms.has(i) ? 'can' : '', removable.has(i) ? 'rem' : '', i === last ? 'last' : ''].filter(Boolean).join(' ');
      g += `<circle class="${cls}" data-i="${i}" cx="${x}" cy="${y}" r="${v ? 15 : 9}"/>`;
    }
    svg.innerHTML = g;
    $('#nm-info').textContent = `${Af('inHand', 'Chưa đặt: {a} · {b}', { a: s.hand[0], b: s.hand[1] })}`;
    if (!over) $('#nm-status').textContent = removeFrom.length ? A('removePiece', 'Chọn một quân đối thủ để bốc.') : thinking || s.turn === 2 ? t('lib.game.thinking', 'Máy đang nghĩ…') : t('lib.game.yourTurn', 'Đến lượt bạn');
  }
  function after(m: NmmMove): void {
    const before = s; s = nmmApply(s, m); last = m.to; sel = -1; to = -1; removeFrom = [];
    sfx(m.remove >= 0 ? 'capture' : 'place'); render();
    void before;
    const w = nmmWinner(s);
    if (w) { over = true; $('#nm-status').textContent = ''; if (w === 1) showBanner(banner, 'win', id, level, WIN(level), start, () => start(level)); else showBanner(banner, 'lose', id, level, LOSE(level), start, () => start(level)); renderLevelBar(levelBar, id, level, start); return; }
    if (s.turn === 2) { thinking = true; render(); const my = token; window.setTimeout(() => { if (my !== token) return; const am = nmmAi(s, level); thinking = false; after(am); }, 350); }
  }
  svg.addEventListener('click', (e) => {
    const el = (e.target as Element).closest('[data-i]'); if (!el || over || thinking || s.turn !== 1) return;
    const i = Number((el as HTMLElement).dataset.i ?? el.getAttribute('data-i'));
    if (removeFrom.length) { const m = removeFrom.find((x) => x.remove === i); if (m) after(m); return; }
    const moves = nmmMoves(s);
    if (s.hand[0] === 0 && (sel < 0 || s.b[i] === 1)) { if (s.b[i] === 1 && moves.some((m) => m.from === i)) { sel = i; sfx('select'); render(); } return; }
    const cand = moves.filter((m) => m.from === sel && m.to === i);
    if (!cand.length) { if (s.hand[0] === 0) { sel = -1; render(); } return; }
    if (cand.length === 1 && cand[0].remove < 0) return after(cand[0]);
    to = i; removeFrom = cand; sfx('check'); render();
  });
  function start(lv: number): void {
    level = lv; token++; s = nmmNew(); sel = -1; to = -1; over = false; thinking = false; last = -1; removeFrom = [];
    clearBanner(banner); renderLevelBar(levelBar, id, level, start); render();
  }
  $('#nm-new').addEventListener('click', () => start(level));
  void NMM_MILLS; fullscreenButton(); start(level);
}

/* ================================ Hải chiến ================================ */
export function mountBattleship(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="bs-status"></b><span id="bs-info"></span></div>
        <h4 class="bs-h">${Ah('enemyWaters', 'Vùng biển địch (bấm để bắn)')}</h4>
        <div class="bs-grid gboard" id="bs-enemy"></div>
        <h4 class="bs-h">${Ah('yourFleet', 'Hạm đội của bạn')}</h4>
        <div class="bs-grid mine" id="bs-mine"></div>
      </div>
      <div class="game-side"><div class="row">${newBtn('bs-new')}</div>
        <p class="note" id="bs-msg" aria-live="polite"></p>
        <p class="note">${Ah('note.battleship', 'Mỗi bên có 5 tàu (dài 5, 4, 3, 3, 2 ô) xếp ngẫu nhiên trên lưới 10x10. Lần lượt bắn vào một ô: trúng thì ô đỏ, trượt thì ô xanh nhạt; trúng hết các ô của một tàu là nhấn chìm nó. Ai nhấn chìm hết hạm đội đối phương trước thì thắng. Cấp càng cao máy càng biết suy luận vị trí tàu.')}</p></div>
    </div>`);
  const enemyEl = $('#bs-enemy'), mineEl = $('#bs-mine');
  let level = progressOf(id).unlocked, foe: BsBoard = bsNew(), me: BsBoard = bsNew(), turn = 0, over = false, token = 0, shots = 0;
  function draw(): void {
    const own = new Set(me.ships.flatMap((s) => s.cells)), sunkE = new Set(foe.ships.filter((s) => bsSunk(foe, s)).flatMap((s) => s.cells));
    enemyEl.innerHTML = Array.from({ length: 100 }, (_, i) => { const r = foe.shots[i]; return `<button type="button" class="bs-c ${r ?? ''}${sunkE.has(i) ? ' sunk' : ''}" data-i="${i}" ${r || over || turn !== 0 ? 'disabled' : ''} aria-label="${i + 1}"></button>`; }).join('');
    mineEl.innerHTML = Array.from({ length: 100 }, (_, i) => `<div class="bs-c ${own.has(i) ? 'ship ' : ''}${me.shots[i] ?? ''}"></div>`).join('');
    const left = (b: BsBoard): number => b.ships.filter((s) => !bsSunk(b, s)).length;
    $('#bs-info').textContent = Af('shipsLeft', 'Tàu còn: bạn {a} · địch {b}', { a: left(me), b: left(foe) });
    if (!over) $('#bs-status').textContent = turn === 0 ? t('lib.game.yourTurn', 'Đến lượt bạn') : t('lib.game.thinking', 'Máy đang nghĩ…');
  }
  const say = (m: string): void => { $('#bs-msg').textContent = m; };
  function result(win: boolean): void {
    over = true; draw(); $('#bs-status').textContent = '';
    if (win) showBanner(banner, 'win', id, level, WIN(level), start, () => start(level)); else showBanner(banner, 'lose', id, level, LOSE(level), start, () => start(level));
    renderLevelBar(levelBar, id, level, start);
  }
  const fx = (r: 'miss' | 'hit' | 'sunk'): void => { sfx('shoot'); window.setTimeout(() => sfx(r === 'miss' ? 'whoosh' : r === 'sunk' ? 'boom' : 'hit'), 160); };
  async function aiTurn(my: number): Promise<void> {
    await wait(650); if (my !== token) return;
    const i = bsAiPick(me, level), r = bsShoot(me, i); if (!r) return;
    fx(r.res); say(r.res === 'sunk' ? A('theySunk', 'Địch nhấn chìm một tàu của bạn!') : r.res === 'hit' ? A('theyHit', 'Địch bắn trúng tàu của bạn.') : A('theyMiss', 'Địch bắn trượt.'));
    if (bsAllSunk(me)) return result(false);
    turn = 0; draw();
  }
  enemyEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.bs-c'); if (!b || over || turn !== 0) return;
    const r = bsShoot(foe, Number(b.dataset.i)); if (!r) return; shots++;
    fx(r.res); say(r.res === 'sunk' ? A('youSunk', 'Bạn nhấn chìm một tàu địch!') : r.res === 'hit' ? A('youHit', 'Trúng rồi!') : A('youMiss', 'Trượt.'));
    if (bsAllSunk(foe)) return result(true);
    turn = 1; draw(); void aiTurn(token);
  });
  function start(lv: number): void {
    level = lv; token++; foe = bsNew(); me = bsNew(); turn = 0; over = false; shots = 0; say('');
    clearBanner(banner); renderLevelBar(levelBar, id, level, start); draw();
  }
  $('#bs-new').addEventListener('click', () => start(level));
  void BS_N; void shots; fullscreenButton(); start(level);
}
