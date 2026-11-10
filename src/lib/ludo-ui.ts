/** Giao diện cờ cá ngựa: người cầm Đỏ, 1–3 máy cầm các màu còn lại theo cấp. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import {
  BASE, FINISH, HOME, LUDO_OPPONENTS, RING, SAFE, START_IDX, ludoAiPick, ludoMove, ludoMovable, ludoNew, ludoPass, tokenCell, type LudoState,
} from '../calc/ludo';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah } from './arcade-ui';
import { sfx } from './sfx';

const CNAME = ['Đỏ', 'Xanh lá', 'Vàng', 'Xanh dương'];
const CKEY = ['cRed', 'cGreen', 'cYellow', 'cBlue'];
const DIE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function mountLudo(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="ld-status"></b></div>
        <div class="ludo-board gboard" id="ld-board"></div>
      </div>
      <div class="game-side">
        <div class="ld-die" id="ld-die" aria-live="polite">⚀</div>
        <div class="row"><button type="button" class="btn btn-primary" id="ld-roll">${Ah('roll', 'Tung xúc xắc')}</button><button type="button" class="btn" id="ld-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button></div>
        <p class="note" id="ld-msg" aria-live="polite"></p>
        <p class="note">${Ah('note.ludo', 'Bạn cầm quân Đỏ, các màu khác do máy điều khiển. Tung xúc xắc: ra 6 mới được đưa một quân ra khỏi chuồng, và được tung tiếp (ra 6 ba lần liền thì mất lượt). Quân đi theo chiều kim đồng hồ quanh bàn rồi rẽ vào đường về nhà của màu mình; cần số chấm vừa đủ để vào ô đích giữa bàn. Dừng đúng ô có quân đối phương thì đá nó về chuồng (trừ ô ngôi sao và ô xuất phát). Ai đưa đủ 4 quân về đích trước thắng.')}</p>
      </div>
    </div>`);
  const boardEl = $('#ld-board'), statusEl = $('#ld-status'), msg = $('#ld-msg'), dieEl = $('#ld-die'), rollBtn = $('#ld-roll') as HTMLButtonElement;
  let level = progressOf(id).unlocked;
  let s: LudoState = ludoNew(1);
  let opts: number[] = [];
  let busy = false, over = false, token = 0;
  const cname = (c: number): string => A(CKEY[c], CNAME[c]);

  function start(lv: number): void {
    level = lv; token++; s = ludoNew(LUDO_OPPONENTS[level - 1]); opts = []; busy = false; over = false; msg.textContent = ''; dieEl.textContent = DIE[1];
    clearBanner(banner); renderLevelBar(levelBar, id, level, start); render();
  }
  function render(): void {
    const cells = new Map<string, string[]>();
    const put = (xy: [number, number], html: string): void => { const k = xy.join(','); (cells.get(k) || cells.set(k, []).get(k) as string[]).push(html); };
    s.players.forEach((c) => s.tokens[c].forEach((rel, k) => {
      const can = c === 0 && opts.includes(k) && !busy && !over;
      put(tokenCell(c, k, rel), `<button type="button" class="lt c${c}${can ? ' go' : ''}${rel === FINISH ? ' fin' : ''}" data-k="${k}" ${can ? '' : 'tabindex="-1"'} aria-label="${escapeHtml(cname(c))} ${k + 1}"></button>`);
    }));
    let html = '';
    const area = (x: number, y: number, w = 1, h = 1): string => `grid-area:${y + 1} / ${x + 1} / ${y + 1 + h} / ${x + 1 + w}`;
    const quad: [number, number][] = [[0, 0], [9, 0], [9, 9], [0, 9]];
    [0, 1, 2, 3].forEach((c) => { if (s.players.includes(c) || true) html += `<div class="ld-quad c${c}${s.players.includes(c) ? '' : ' off'}" style="${area(quad[c][0], quad[c][1], 6, 6)}"></div>`; });
    RING.forEach((xy, i) => {
      const start = START_IDX.indexOf(i);
      html += `<div class="ld-c${start >= 0 ? ' st c' + start : ''}" style="${area(xy[0], xy[1])}">${SAFE.has(i) && start < 0 ? '<u>★</u>' : ''}${(cells.get(xy.join(',')) || []).join('')}</div>`;
    });
    [0, 1, 2, 3].forEach((c) => HOME[c].forEach((xy, i) => { html += `<div class="ld-c hm c${c}${i === 5 ? ' end' : ''}" style="${area(xy[0], xy[1])}">${(cells.get(xy.join(',')) || []).join('')}</div>`; }));
    [0, 1, 2, 3].forEach((c) => BASE[c].forEach((xy) => { html += `<div class="ld-nest c${c}" style="${area(xy[0], xy[1])}">${(cells.get(xy.join(',')) || []).join('')}</div>`; }));
    html += `<div class="ld-mid" style="${area(6, 6, 3, 3)}"></div>`;
    boardEl.innerHTML = html;
    const cur = s.players[s.turn];
    if (!over) statusEl.textContent = cur === 0 ? (s.rolled ? A('pickToken', 'Chọn một quân để đi.') : t('lib.game.yourTurn', 'Đến lượt bạn')) : Af('turnOf', 'Lượt của {c}…', { c: cname(cur) });
    rollBtn.disabled = over || busy || cur !== 0 || s.rolled;
  }
  function endIf(): boolean {
    if (s.winner < 0) return false;
    over = true; busy = false; render();
    const win = s.winner === 0;
    statusEl.textContent = win ? A('ldWin', 'Cả 4 quân của bạn đã về đích!') : Af('ldLose', '{c} đã về đích trước.', { c: cname(s.winner) });
    showBanner(banner, win ? 'win' : 'lose', id, level, win ? tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }) : tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), start, () => start(level));
    renderLevelBar(levelBar, id, level, start);
    return true;
  }
  const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

  /** Tung xúc xắc cho người đang đến lượt; trả về số chấm */
  async function rollFor(my: number): Promise<number> {
    sfx('roll');
    for (let i = 0; i < 6; i++) { dieEl.textContent = DIE[1 + Math.floor(Math.random() * 6)]; await wait(55); if (my !== token) return 0; }
    const d = 1 + Math.floor(Math.random() * 6);
    dieEl.textContent = DIE[d]; dieEl.className = `ld-die c${s.players[s.turn]}`;
    return d;
  }
  async function turn(): Promise<void> {
    const my = token;
    while (!over && my === token) {
      const color = s.players[s.turn];
      if (color === 0) { busy = false; render(); return; }
      busy = true; render();
      await wait(500); if (my !== token) return;
      const d = await rollFor(my); if (my !== token) return;
      s.die = d;
      if (d === 6 && s.sixes >= 2) { s = ludoPass(s); render(); await wait(350); continue; }
      const mv = ludoMovable(s, color, d);
      if (!mv.length) { s = ludoPass(s); render(); await wait(350); continue; }
      await wait(350); if (my !== token) return;
      const k = ludoAiPick(s, color, d, level);
      s = ludoMove(s, color, k, d).s;
      render(); if (endIf()) return;
      await wait(250);
    }
  }
  async function humanRoll(): Promise<void> {
    const my = token;
    busy = true; rollBtn.disabled = true;
    const d = await rollFor(my); if (my !== token) return;
    s.die = d;
    if (d === 6 && s.sixes >= 2) { msg.textContent = A('threeSix', 'Ba lần 6 liền — mất lượt.'); s = ludoPass(s); render(); await wait(700); void turn(); return; }
    opts = ludoMovable(s, 0, d);
    if (!opts.length) { msg.textContent = A('noMove', 'Không có quân nào đi được.'); s = ludoPass(s); opts = []; render(); await wait(800); msg.textContent = ''; void turn(); return; }
    msg.textContent = '';
    s.rolled = true; busy = false;
    if (opts.length === 1) { await wait(350); if (my !== token) return; play(opts[0]); return; }
    render();
  }
  function play(k: number): void {
    if (!s.rolled || !opts.includes(k)) return;
    const d = s.die;
    s = ludoMove(s, 0, k, d).s; opts = [];
    render(); if (endIf()) return;
    void turn();
  }
  rollBtn.addEventListener('click', () => { if (!over && !busy && s.players[s.turn] === 0 && !s.rolled) void humanRoll(); });
  boardEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.lt.go');
    if (b && !busy && !over) play(Number(b.dataset.k));
  });
  $('#ld-new').addEventListener('click', () => start(level));
  fullscreenButton();
  start(level);
}
