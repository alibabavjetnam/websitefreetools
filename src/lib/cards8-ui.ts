/** Giao diện đợt 8: Domino, Hearts (bài), Texas Hold'em (xu ảo, không tiền thật). */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { SUIT, RANK, type Card } from '../calc/solitaire';
import { dominoAi, dominoDraw, dominoMoves, dominoNew, dominoPass, dominoPlay, pips, type DMove, type Domino, type Tile } from '../calc/games8';
import { cardPts, heartsAi, heartsCollect, heartsLegal, heartsNew, heartsNext, heartsPlay, trickWinner, type Hearts } from '../calc/games8';
import { HAND_NAMES, HOLD_START, hLabel, holdemAct, holdemAi, holdemDeal, holdemNew, maxRaiseTo, minRaiseTo, potOf, toCall, type HCard, type Holdem } from '../calc/holdem';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah } from './arcade-ui';
import { back, face } from './casino-ui';
import { sfx } from './sfx';

const WIN = (n: number): string => tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n });
const LOSE = (n: number): string => tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n });
const wait = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));
const newBtn = (id: string): string => `<button type="button" class="btn" id="${id}">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>`;

/* ================================ Domino ================================ */
const PIPS: number[][] = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
const half = (n: number): string => `<span class="dm-h">${Array.from({ length: 9 }, (_, i) => `<i${PIPS[n].includes(i) ? ' class="on"' : ''}></i>`).join('')}</span>`;
const tileHtml = (tl: Tile, cls = '', attrs = ''): string => `<div class="dm-t ${cls}" ${attrs} role="img" aria-label="${tl.a}-${tl.b}">${half(tl.a)}<b></b>${half(tl.b)}</div>`;

export function mountDomino(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main"><div class="game-board-col">
      <div class="game-status"><b id="dm-status"></b><span id="dm-info"></span></div>
      <div class="dm-board gboard" id="dm-board"></div>
    </div><div class="game-side">
      <div class="row" id="dm-choose" hidden></div>
      <div class="row"><button type="button" class="btn btn-primary" id="dm-draw" hidden>${Ah('dmDraw', 'Bốc quân')}</button><button type="button" class="btn" id="dm-pass" hidden>${Ah('dmPass', 'Bỏ lượt')}</button>${newBtn('dm-new')}</div>
      <p class="note" id="dm-msg" aria-live="polite"></p>
      <p class="note">${Ah('note.domino', 'Mỗi người có 7 quân. Ai có đôi lớn nhất đi trước. Đặt quân có số khớp với một trong hai đầu của chuỗi. Không có quân để đi thì bốc từ kho cho tới khi đi được; hết kho thì bỏ lượt. Ai hết quân trước thắng; nếu cả hai bị chặn, bên có tổng chấm ít hơn thắng.')}</p>
    </div></div>`);
  let level = progressOf(id).unlocked, g: Domino = dominoNew(1), pending = -1, busy = false, token = 0, over = false;
  const board = $('#dm-board');
  function render(): void {
    const can = !busy && !over && g.turn === 0, mv = can ? dominoMoves(g, 0) : [];
    board.innerHTML = `<div class="dm-row"><span class="cz-lbl">${escapeHtml(A('opponent', 'Đối thủ'))} · ${g.hands[1].length}</span><div class="dm-hand">${g.hands[1].map(() => '<div class="dm-t down"></div>').join('')}</div></div>
      <div class="dm-chain">${g.chain.length ? g.chain.map((x) => tileHtml(x, 'h')).join('') : `<em>${escapeHtml(A('dmEmpty', 'Chưa có quân nào'))}</em>`}</div>
      <div class="dm-row"><span class="cz-lbl">${Ah('you', 'Bạn')} · ${g.hands[0].length}</span><div class="dm-hand">${g.hands[0].map((x, i) => tileHtml(x, mv.some((m) => m.i === i) ? 'playable' : '', `data-i="${i}"`)).join('')}</div></div>`;
    $('#dm-info').textContent = Af('dmYard', 'Kho: {n} quân', { n: g.yard.length });
    if (!over) $('#dm-status').textContent = g.turn === 0 ? t('lib.game.yourTurn', 'Đến lượt bạn') : t('lib.game.thinking', 'Máy đang nghĩ…');
    const noMove = can && !mv.length;
    ($('#dm-draw') as HTMLElement).hidden = !(noMove && g.yard.length); ($('#dm-pass') as HTMLElement).hidden = !(noMove && !g.yard.length);
    const ch = $('#dm-choose'); ch.hidden = pending < 0;
    ch.innerHTML = pending >= 0 ? `<button type="button" class="btn" data-side="l">◀ ${escapeHtml(A('dmLeft', 'Đầu trái'))}</button><button type="button" class="btn" data-side="r">${escapeHtml(A('dmRight', 'Đầu phải'))} ▶</button>` : '';
  }
  function end(): void {
    over = true; render(); $('#dm-status').textContent = '';
    if (g.winner === 0) { showBanner(banner, 'win', id, level, WIN(level), start, () => start(level)); renderLevelBar(levelBar, id, level, start); }
    else if (g.winner === 1) showBanner(banner, 'lose', id, level, LOSE(level), start, () => start(level));
    else showBanner(banner, 'draw', id, level, A('dmTie', 'Hoà! Hai bên bằng điểm.'), start, () => start(level));
  }
  async function ai(my: number): Promise<void> {
    while (my === token && !over && g.turn === 1) {
      busy = true; render(); await wait(800); if (my !== token) return;
      let m = dominoAi(g, 1, level);
      while (!m && g.yard.length) { dominoDraw(g, 1); sfx('deal'); render(); await wait(400); if (my !== token) return; m = dominoAi(g, 1, level); }
      if (m) { dominoPlay(g, 1, m); sfx('place'); $('#dm-msg').textContent = ''; } else { dominoPass(g, 1); $('#dm-msg').textContent = A('aiPass', 'Máy bỏ lượt.'); }
      if (g.winner >= 0) { busy = false; return end(); }
    }
    busy = false; render();
  }
  function afterPlayer(): void { pending = -1; render(); if (g.winner >= 0) return end(); void ai(token); }
  board.addEventListener('click', (e) => {
    if (busy || over || g.turn !== 0) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]'); if (!el) return;
    const i = Number(el.dataset.i), mv = dominoMoves(g, 0).filter((m) => m.i === i);
    if (!mv.length) { sfx('error'); return; }
    const sides = new Set(mv.map((m) => m.side));
    if (sides.size === 1) { dominoPlay(g, 0, mv[0]); sfx('place'); $('#dm-msg').textContent = ''; afterPlayer(); } else { pending = i; sfx('select'); render(); }
  });
  $('#dm-choose').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-side]'); if (!b || pending < 0) return;
    const m = dominoMoves(g, 0).find((x) => x.i === pending && x.side === b.dataset.side) as DMove; dominoPlay(g, 0, m); sfx('place'); afterPlayer();
  });
  $('#dm-draw').addEventListener('click', () => { if (dominoDraw(g, 0)) { sfx('deal'); render(); } });
  $('#dm-pass').addEventListener('click', () => { dominoPass(g, 0); $('#dm-msg').textContent = A('youPass', 'Bạn bỏ lượt.'); if (g.winner >= 0) return end(); render(); void ai(token); });
  function start(l: number): void {
    level = l; token++; g = dominoNew(l); pending = -1; busy = false; over = false; $('#dm-msg').textContent = ''; clearBanner(banner); renderLevelBar(levelBar, id, level, start); render();
    if (g.turn === 1) void ai(token);
  }
  $('#dm-new').addEventListener('click', () => start(level));
  void pips; fullscreenButton(); start(level);
}

/* ================================ Hearts ================================ */
export function mountHearts(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main"><div class="game-board-col">
      <div class="game-status"><b id="hr-status"></b><span id="hr-info"></span></div>
      <div class="sol-board gboard cz-board hr-board" id="hr-board" style="--cw:56px"></div>
    </div><div class="game-side">
      <div class="row">${newBtn('hr-new')}</div>
      <p class="note" id="hr-msg" aria-live="polite"></p>
      <p class="note">${Ah('note.hearts', 'Bốn người chơi, mỗi người 13 lá. Bài 2 chuồn đi trước. Phải đánh cùng chất với lá dẫn nếu có. Mỗi lá cơ là 1 điểm, Q bích là 13 điểm; ai ăn dãy bài thì nhận điểm đó. Điểm càng thấp càng tốt, ăn hết 26 điểm thì các bạn kia bị 26. Không được dẫn cơ khi chưa có cơ nào xuất hiện. Hết các ván, bạn thắng nếu điểm thấp nhất (hoặc bằng thấp nhất).')}</p>
    </div></div>`);
  let level = progressOf(id).unlocked, g: Hearts = heartsNew(1), busy = false, token = 0, over = false;
  const board = $('#hr-board'), name = (i: number): string => (i === 0 ? A('you', 'Bạn') : `${A('opponent', 'Đối thủ')} ${i}`);
  function render(): void {
    const legal = !busy && !over && g.turn === 0 && g.trick.length < 4 ? heartsLegal(g, 0) : [];
    const slots = [0, 1, 2, 3].map((p) => { const t2 = g.trick.find((x) => x.who === p); return `<div class="hr-slot"><span class="cz-lbl">${escapeHtml(name(p))}${p === g.lead && g.trick.length ? ' ◂' : ''}</span>${t2 ? face(t2.card) : '<div class="cd ghost rel"></div>'}</div>`; }).join('');
    board.innerHTML = `<div class="hr-scores">${[0, 1, 2, 3].map((p) => `<span>${escapeHtml(name(p))}: <b>${g.scores[p]}</b> <small>(${g.hands[p].length})</small></span>`).join('')}</div>
      <div class="hr-trick">${slots}</div>
      <div class="cz-row"><span class="cz-lbl">${Ah('you', 'Bạn')}</span><div class="cz-hand ce-hand">${g.hands[0].map((c) => face(c, legal.some((l) => l.id === c.id) ? 'playable' : '', `data-id="${c.id}"`)).join('')}</div></div>`;
    $('#hr-info').textContent = Af('hrHand', 'Ván {n}/{t}', { n: g.handNo, t: g.hands_total }) + (g.broken ? ' · ♥' : '');
    if (!over) $('#hr-status').textContent = g.turn === 0 && g.trick.length < 4 ? t('lib.game.yourTurn', 'Đến lượt bạn') : t('lib.game.thinking', 'Máy đang nghĩ…');
  }
  async function finishTrick(my: number): Promise<boolean> {
    await wait(1000); if (my !== token) return false;
    const w = trickWinner(g.trick), pts = g.trick.reduce((s, x) => s + cardPts(x.card), 0);
    heartsCollect(g); sfx(pts >= 13 ? 'boom' : pts ? 'hit' : 'tick');
    $('#hr-msg').textContent = Af('hrTook', '{p} ăn dãy bài ({n} điểm).', { p: name(w), n: pts });
    render();
    if (g.handOver) {
      if (g.over) { end(); return false; }
      await wait(1600); if (my !== token) return false; heartsNext(g); $('#hr-msg').textContent = ''; render();
    }
    return true;
  }
  function end(): void {
    over = true; render(); $('#hr-status').textContent = '';
    const mine = g.scores[0], best = Math.min(...g.scores);
    if (mine <= best) { showBanner(banner, 'win', id, level, WIN(level), start, () => start(level)); renderLevelBar(levelBar, id, level, start); } else showBanner(banner, 'lose', id, level, LOSE(level), start, () => start(level));
  }
  async function run(my: number): Promise<void> {
    busy = true;
    while (my === token && !over) {
      if (g.trick.length === 4) { if (!(await finishTrick(my))) break; continue; }
      if (g.turn === 0) break;
      render(); await wait(650); if (my !== token) return;
      const c = heartsAi(g, g.turn, level); const full = heartsPlay(g, g.turn, c); sfx('flip');
      render();
      if (full) { if (!(await finishTrick(my))) break; }
    }
    if (my === token) { busy = false; if (!over) render(); }
  }
  board.addEventListener('click', (e) => {
    if (busy || over || g.turn !== 0 || g.trick.length >= 4) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-id]'); if (!el) return;
    const c = g.hands[0].find((x) => x.id === Number(el.dataset.id)); if (!c) return;
    if (!heartsLegal(g, 0).some((l) => l.id === c.id)) { sfx('error'); $('#hr-msg').textContent = A('hrIllegal', 'Lá này chưa được đánh (phải theo chất, hoặc chưa được dẫn cơ).'); return; }
    $('#hr-msg').textContent = ''; const full = heartsPlay(g, 0, c); sfx('flip'); render(); void (async () => { const my = token; if (full) { busy = true; if (!(await finishTrick(my))) return; } void run(my); })();
  });
  function start(l: number): void { level = l; token++; g = heartsNew(l); busy = false; over = false; $('#hr-msg').textContent = ''; clearBanner(banner); renderLevelBar(levelBar, id, level, start); render(); void run(token); }
  $('#hr-new').addEventListener('click', () => start(level));
  void SUIT; void RANK; fullscreenButton(); start(level);
}

/* ================================ Texas Hold'em ================================ */
const hFace = (c: HCard): string => face({ r: c.r === 14 ? 1 : c.r, s: c.s, up: true, id: 0 } as Card);
export function mountHoldem(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main"><div class="game-board-col">
      <div class="game-status"><b id="th-status"></b><span id="th-info"></span></div>
      <div class="sol-board gboard cz-board th-board" id="th-board" style="--cw:54px"></div>
    </div><div class="game-side">
      <div class="th-actions" id="th-act"></div>
      <div class="row">${newBtn('th-new')}</div>
      <p class="note" id="th-msg" aria-live="polite"></p>
      <p class="note">${Ah('note.holdem', "Đấu tay đôi với máy, chỉ dùng xu ảo. Mỗi người có 2 lá riêng, 5 lá chung mở dần (flop, turn, river); ghép 5 lá tốt nhất. Mỗi vòng bạn có thể bỏ bài, theo (hoặc xem bài) hoặc tố thêm. Mức cược tối thiểu tăng sau mỗi 4 ván. Thắng khi đối thủ hết xu, hoặc có nhiều xu hơn sau số ván giới hạn. Không dùng tiền thật.")}</p>
    </div></div>`);
  let level = progressOf(id).unlocked, g: Holdem = holdemNew(1), busy = false, token = 0, over = false, raiseTo = 0;
  const board = $('#th-board'), act = $('#th-act'), nm = (h: string): string => A('hand.' + h, h);
  const drain = (): void => { for (const e of g.ev) sfx(e as never); g.ev.length = 0; };
  function render(): void {
    const sd = g.showdown, mine = g.hole[0], opp = g.hole[1];
    board.innerHTML = `<div class="cz-row"><span class="cz-lbl">${escapeHtml(A('opponent', 'Đối thủ'))} · ${Af('chips', 'Xu: {n}', { n: g.stacks[1] })}${g.button === 1 ? ' (D)' : ''}${g.bet[1] ? ` · ${A('bet', 'Cược')} ${g.bet[1]}` : ''}</span><div class="cz-hand">${opp.length ? (sd || g.winner >= 0 && g.msg !== 'fold' ? opp.map(hFace).join('') : opp.map(() => back()).join('')) : ''}</div></div>
      <div class="cz-row th-mid"><span class="cz-lbl">${Af('pot', 'Tổng cược: {n}', { n: potOf(g) })}</span><div class="cz-hand">${Array.from({ length: 5 }, (_, i) => (g.board[i] ? hFace(g.board[i]) : '<div class="cd ghost rel"></div>')).join('')}</div></div>
      <div class="cz-row"><span class="cz-lbl">${escapeHtml(A('you', 'Bạn'))} · ${Af('chips', 'Xu: {n}', { n: g.stacks[0] })}${g.button === 0 ? ' (D)' : ''}${g.bet[0] ? ` · ${A('bet', 'Cược')} ${g.bet[0]}` : ''}</span><div class="cz-hand">${mine.map(hFace).join('')}</div></div>`;
    $('#th-info').textContent = Af('hrHand', 'Ván {n}/{t}', { n: g.handNo, t: g.maxHands }) + ` · ${Af('blinds', 'Mù: {n}', { n: g.bb })}`;
    if (!over) $('#th-status').textContent = g.status === 'play' ? (g.toAct === 0 ? t('lib.game.yourTurn', 'Đến lượt bạn') : t('lib.game.thinking', 'Máy đang nghĩ…')) : '';
    // nút hành động
    if (g.status === 'play' && g.toAct === 0 && !busy && !over) {
      const need = toCall(g, 0), lo = minRaiseTo(g, 0), hi = maxRaiseTo(g, 0), canRaise = hi > g.bet[0] + need && g.stacks[0] > need;
      raiseTo = Math.min(hi, Math.max(lo, raiseTo));
      act.innerHTML = `<button type="button" class="btn" data-a="fold">${Ah('fold', 'Bỏ bài')}</button><button type="button" class="btn btn-primary" data-a="call">${need ? Af('callN', 'Theo {n}', { n: need }) : Ah('check', 'Xem bài')}</button>
        ${canRaise ? `<div class="th-raise"><input type="range" id="th-rng" min="${lo}" max="${hi}" step="${Math.max(1, g.bb / 2)}" value="${raiseTo}" aria-label="${escapeHtml(A('raiseTo', 'Tố tới'))}"><button type="button" class="btn" data-a="raise">${Af('raiseN', 'Tố tới {n}', { n: raiseTo })}</button></div>` : ''}`;
    } else if (g.status === 'hand' && !over) act.innerHTML = `<button type="button" class="btn btn-primary" data-a="next">${Ah('nextHand', 'Ván tiếp theo')}</button>`;
    else act.innerHTML = '';
  }
  function resultMsg(): string {
    if (g.msg === 'fold') return g.winner === 0 ? A('thOppFold', 'Máy bỏ bài, bạn thắng ván này.') : A('thYouFold', 'Bạn đã bỏ bài.');
    const [a, b] = g.msg.split('|'), who = g.winner === 0 ? A('thYouWin', 'Bạn thắng ván này') : g.winner === 1 ? A('thOppWin', 'Máy thắng ván này') : A('thSplit', 'Hoà, chia đều');
    return `${who} — ${A('you', 'Bạn')}: ${nm(a)} · ${A('opponent', 'Đối thủ')}: ${nm(b)}`;
  }
  function checkEnd(): boolean {
    drain();
    if (g.status === 'play') return false;
    $('#th-msg').textContent = resultMsg(); render();
    if (g.status === 'match') {
      over = true; $('#th-status').textContent = '';
      if (g.matchWinner === 0) { showBanner(banner, 'win', id, level, WIN(level), start, () => start(level)); renderLevelBar(levelBar, id, level, start); }
      else if (g.matchWinner === 1) showBanner(banner, 'lose', id, level, LOSE(level), start, () => start(level));
      else showBanner(banner, 'draw', id, level, A('dmTie', 'Hoà! Hai bên bằng điểm.'), start, () => start(level));
    }
    return true;
  }
  async function ai(my: number): Promise<void> {
    while (my === token && g.status === 'play' && g.toAct === 1) {
      busy = true; render(); await wait(900); if (my !== token) return;
      const a = holdemAi(g, 1, level); holdemAct(g, 1, a);
      $('#th-msg').textContent = a.t === 'fold' ? A('thAiFold', 'Máy bỏ bài.') : a.t === 'raise' ? Af('thAiRaise', 'Máy tố tới {n}.', { n: g.bet[1] || 0 }) : A('thAiCall', 'Máy theo / xem bài.');
      if (checkEnd()) { busy = false; return; }
    }
    busy = false; render();
  }
  act.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-a]'); if (!b || busy || over) return;
    const a = b.dataset.a, my = token;
    if (a === 'next') { holdemDeal(g); $('#th-msg').textContent = ''; if (checkEnd()) return; render(); void ai(my); return; }
    if (g.status !== 'play' || g.toAct !== 0) return;
    if (a === 'fold') holdemAct(g, 0, { t: 'fold' }); else if (a === 'call') holdemAct(g, 0, { t: 'call' }); else if (a === 'raise') holdemAct(g, 0, { t: 'raise', to: raiseTo });
    $('#th-msg').textContent = '';
    if (checkEnd()) return;
    render(); void ai(my);
  });
  act.addEventListener('input', (e) => { const r = e.target as HTMLInputElement; if (r.id === 'th-rng') { raiseTo = Number(r.value); const b = act.querySelector<HTMLElement>('[data-a="raise"]'); if (b) b.textContent = Af('raiseN', 'Tố tới {n}', { n: raiseTo }); } });
  function start(l: number): void {
    level = l; token++; g = holdemNew(l); busy = false; over = false; raiseTo = 0; $('#th-msg').textContent = ''; clearBanner(banner); renderLevelBar(levelBar, id, level, start);
    holdemDeal(g); if (checkEnd()) return; render(); void ai(token);
  }
  $('#th-new').addEventListener('click', () => start(level));
  void HAND_NAMES; void hLabel; void HOLD_START; fullscreenButton(); start(level);
}
