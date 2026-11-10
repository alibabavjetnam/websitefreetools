/** Giao diện đợt 5 (bài, xu ảo, xúc xắc): Bầu cua, Baccarat, Bài cào, Bingo, Yahtzee, Bài 8 lá. Chỉ dùng xu ảo, không có tiền thật. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { RANK, SUIT, shuffle, type Card } from '../calc/solitaire';
import {
  BAC_LEVELS, BAC_START, BC_LEVELS, BC_START, BC_SYMBOLS, CAO_LEVELS, CAO_START, Y_CATS, Y_TARGETS,
  bacDeal, bacPayout, bacTotal, bcPayout, bcRoll, bingoCard, bingoCfg, bingoCompleteAt, bingoHasLine, caoCompare, caoDealerTie, caoRank, crazyAiChoose, crazyCanPlay, crazyDraw, crazyNew, crazyPlay,
  newBacShoe, yScore, yTotal, type BacHand, type Crazy, type YCat,
} from '../calc/games5';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah } from './arcade-ui';
import { back, face } from './casino-ui';
import { sfx } from './sfx';

const WIN = (n: number): string => tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n });
const LOSE = (n: number): string => tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n });
const wait = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));
const newBtn = (id: string): string => `<button type="button" class="btn" id="${id}">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>`;
const fmt = (n: number): string => String(Math.round(n));

/** Mẫu chung cho trò xu ảo: thanh thông tin Xu / Mục tiêu / Số ván còn lại, và kiểm tra thắng thua */
function coinInfo(chips: number, target: number, left: number): string {
  return `${Af('chips', 'Xu: {n}', { n: chips })} · ${Af('target', 'Mục tiêu: {n}', { n: target })} · ${Af('handsLeft', 'Còn {n} ván', { n: left })}`;
}

/* ================================ Bầu cua ================================ */
export function mountBauCua(id: string): void {
  const NAMES = [['bcGourd', 'Bầu'], ['bcCrab', 'Cua'], ['bcShrimp', 'Tôm'], ['bcFish', 'Cá'], ['bcRooster', 'Gà'], ['bcDeer', 'Nai']];
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><span id="bc-info"></span></div>
        <div class="bc-table gboard" id="bc-table"></div>
        <div class="bc-dice" id="bc-dice" aria-live="polite"></div>
      </div>
      <div class="game-side">
        <div class="row" id="bc-chips"></div>
        <div class="row"><button type="button" class="btn btn-primary" id="bc-roll">${Ah('shake', 'Lắc')}</button><button type="button" class="btn" id="bc-clear">${Ah('clearBets', 'Xoá cược')}</button>${newBtn('bc-new')}</div>
        <p class="note" id="bc-msg" aria-live="polite"></p>
        <p class="note">${Ah('note.bau-cua', 'Chơi bằng xu ảo, không có tiền thật. Chọn mệnh giá rồi bấm vào các linh vật để đặt cược, sau đó bấm Lắc. Mỗi xúc xắc trùng với linh vật bạn cược thì bạn nhận lại tiền cược cộng thêm đúng bằng tiền cược cho mỗi lần trùng. Đạt số xu mục tiêu trong số ván cho phép để qua cấp.')}</p>
      </div>
    </div>`);
  let level = progressOf(id).unlocked, chips = BC_START, played = 0, bets = Array(6).fill(0) as number[], unit = 10, busy = false, over = false, dice: number[] = [], token = 0;
  const lv = (): (typeof BC_LEVELS)[number] => BC_LEVELS[level - 1];
  const total = (): number => bets.reduce((a, b) => a + b, 0);
  function render(): void {
    $('#bc-table').innerHTML = BC_SYMBOLS.map((s, i) => `<button type="button" class="bc-tile${dice.includes(i) && busy === false && dice.length ? ' hit' : ''}" data-i="${i}" aria-label="${escapeHtml(A(NAMES[i][0], NAMES[i][1]))}"><span class="bc-sym">${s}</span><em>${escapeHtml(A(NAMES[i][0], NAMES[i][1]))}</em><b>${bets[i] || ''}</b></button>`).join('');
    $('#bc-dice').innerHTML = dice.map((d) => `<span class="bc-die">${BC_SYMBOLS[d]}</span>`).join('');
    $('#bc-chips').innerHTML = [10, 50, 100].map((u) => `<button type="button" class="btn btn-sm${u === unit ? ' btn-primary' : ''}" data-u="${u}">${u}</button>`).join('');
    $('#bc-info').textContent = coinInfo(chips - total(), lv().target, lv().rounds - played);
    ($('#bc-roll') as HTMLButtonElement).disabled = busy || over || total() < lv().minBet;
  }
  $('#bc-table').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.bc-tile'); if (!b || busy || over) return;
    const i = Number(b.dataset.i);
    if (chips - total() < unit) { sfx('error'); return; }
    bets[i] += unit; sfx('coin'); dice = []; render();
  });
  $('#bc-chips').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-u]'); if (b) { unit = Number(b.dataset.u); sfx('tap'); render(); } });
  $('#bc-clear').addEventListener('click', () => { if (!busy) { bets = Array(6).fill(0); render(); } });
  $('#bc-roll').addEventListener('click', async () => {
    if (busy || over || total() < lv().minBet) return;
    busy = true; const my = token, stake = total(); render(); sfx('roll');
    for (let k = 0; k < 8; k++) { dice = bcRoll(); render(); await wait(90); if (my !== token) return; }
    dice = bcRoll(); const back_ = bcPayout(bets, dice), delta = back_ - stake;
    chips += delta; played++; busy = false;
    sfx(delta > 0 ? 'win' : delta === 0 ? 'coin' : 'lose'); if (delta > 0) window.setTimeout(() => sfx('coin'), 300);
    $('#bc-msg').textContent = delta > 0 ? Af('won', 'Thắng {n} xu', { n: delta }) : delta < 0 ? Af('lost', 'Thua {n} xu', { n: -delta }) : A('even', 'Hoà vốn');
    bets = Array(6).fill(0); render();
    if (chips >= lv().target) { over = true; showBanner(banner, 'win', id, level, WIN(level), start, () => start(level)); renderLevelBar(levelBar, id, level, start); }
    else if (chips < lv().minBet || played >= lv().rounds) { over = true; showBanner(banner, 'lose', id, level, LOSE(level), start, () => start(level)); }
  });
  function start(l: number): void { level = l; token++; chips = BC_START; played = 0; bets = Array(6).fill(0); dice = []; busy = false; over = false; $('#bc-msg').textContent = ''; clearBanner(banner); renderLevelBar(levelBar, id, level, start); render(); }
  $('#bc-new').addEventListener('click', () => start(level));
  fullscreenButton(); start(level);
}

/* ================================ Baccarat ================================ */
export function mountBaccarat(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><span id="bk-info"></span></div>
        <div class="sol-board gboard cz-board" id="bk-board" style="--cw:64px"></div>
      </div>
      <div class="game-side">
        <div class="row" id="bk-side"></div>
        <div class="row"><button type="button" class="btn" id="bk-minus" aria-label="-">−</button><b id="bk-bet" class="cz-amt"></b><button type="button" class="btn" id="bk-plus" aria-label="+">+</button><button type="button" class="btn" id="bk-max">${Ah('betMax', 'Tối đa')}</button></div>
        <div class="row"><button type="button" class="btn btn-primary" id="bk-deal">${Ah('deal', 'Chia bài')}</button>${newBtn('bk-new')}</div>
        <p class="note" id="bk-msg" aria-live="polite"></p>
        <p class="note">${Ah('note.baccarat', 'Chơi bằng xu ảo, không có tiền thật. Đặt cược vào cửa Con, cửa Cái hoặc Hoà rồi bấm Chia bài. Điểm của bài là tổng điểm lấy chữ số hàng đơn vị (A = 1, 2–9 tính theo số, 10/J/Q/K = 0); bên gần 9 hơn thắng, bài tự rút thêm theo luật chuẩn. Cược Con ăn 1:1, Cái ăn 0,95:1, Hoà ăn 8:1 (cược Con/Cái được hoàn lại khi Hoà). Đạt số xu mục tiêu trong số ván cho phép để qua cấp.')}</p>
      </div>
    </div>`);
  let level = progressOf(id).unlocked, chips = BAC_START, played = 0, bet = 10, side: 'P' | 'B' | 'T' = 'P', shoe = newBacShoe(), hand: BacHand | null = null, busy = false, over = false, token = 0;
  const lv = (): (typeof BAC_LEVELS)[number] => BAC_LEVELS[level - 1];
  const cards = (cs: Card[]): string => cs.map((c) => face(c)).join('') || '<div class="cd slot rel"></div>';
  function render(shownP = hand?.player.length ?? 0, shownB = hand?.banker.length ?? 0): void {
    const p = hand ? hand.player.slice(0, shownP) : [], b = hand ? hand.banker.slice(0, shownB) : [];
    $('#bk-board').innerHTML = `<div class="cz-row"><span class="cz-lbl">${Ah('banker', 'Cái')}${b.length ? ` · ${bacTotal(b)}` : ''}</span><div class="cz-hand">${cards(b)}</div></div>
      <div class="cz-row"><span class="cz-lbl">${Ah('player', 'Con')}${p.length ? ` · ${bacTotal(p)}` : ''}</span><div class="cz-hand">${cards(p)}</div></div>`;
    $('#bk-side').innerHTML = (['P', 'B', 'T'] as const).map((k) => `<button type="button" class="btn${side === k ? ' btn-primary' : ''}" data-s="${k}" ${busy ? 'disabled' : ''}>${escapeHtml(A(k === 'P' ? 'player' : k === 'B' ? 'banker' : 'tie', k === 'P' ? 'Con' : k === 'B' ? 'Cái' : 'Hoà'))}</button>`).join('');
    bet = Math.max(lv().minBet, Math.min(bet, Math.max(lv().minBet, chips)));
    $('#bk-bet').textContent = String(bet);
    $('#bk-info').textContent = coinInfo(chips, lv().target, lv().rounds - played);
    ($('#bk-deal') as HTMLButtonElement).disabled = busy || over || bet > chips;
  }
  $('#bk-side').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-s]'); if (b && !busy) { side = b.dataset.s as 'P' | 'B' | 'T'; render(); } });
  $('#bk-minus').addEventListener('click', () => { bet = Math.max(lv().minBet, bet - lv().minBet); render(); });
  $('#bk-plus').addEventListener('click', () => { bet = Math.min(chips, bet + lv().minBet); render(); });
  $('#bk-max').addEventListener('click', () => { bet = chips; render(); });
  $('#bk-deal').addEventListener('click', async () => {
    if (busy || over || bet > chips || bet < lv().minBet) return;
    busy = true; const my = token; if (shoe.length < 30) shoe = newBacShoe();
    hand = bacDeal(shoe); $('#bk-msg').textContent = ''; render(0, 0);
    const order: [number, number][] = [[1, 0], [1, 1], [2, 1], [2, 2]];
    for (const [pp, bb] of order.slice(0, 4)) { await wait(380); if (my !== token) return; sfx('deal'); render(Math.min(pp, hand.player.length), Math.min(bb, hand.banker.length)); }
    if (hand.player.length > 2) { await wait(450); sfx('flip'); render(3, 2); }
    if (hand.banker.length > 2) { await wait(450); sfx('flip'); render(hand.player.length, 3); }
    await wait(300); if (my !== token) return;
    const back_ = bacPayout(side, bet, hand.result), delta = back_ - bet;
    chips += delta; played++; busy = false;
    sfx(delta > 0 ? 'win' : delta === 0 ? 'coin' : 'lose');
    const who = hand.result === 'P' ? A('player', 'Con') : hand.result === 'B' ? A('banker', 'Cái') : A('tie', 'Hoà');
    $('#bk-msg').textContent = `${who} — ${delta > 0 ? Af('won', 'Thắng {n} xu', { n: delta }) : delta < 0 ? Af('lost', 'Thua {n} xu', { n: -delta }) : A('even', 'Hoà vốn')}`;
    render();
    if (chips >= lv().target) { over = true; showBanner(banner, 'win', id, level, WIN(level), start, () => start(level)); renderLevelBar(levelBar, id, level, start); }
    else if (chips < lv().minBet || played >= lv().rounds) { over = true; showBanner(banner, 'lose', id, level, LOSE(level), start, () => start(level)); }
  });
  function start(l: number): void { level = l; token++; chips = BAC_START; played = 0; bet = lv().minBet; hand = null; busy = false; over = false; $('#bk-msg').textContent = ''; clearBanner(banner); renderLevelBar(levelBar, id, level, start); render(); }
  $('#bk-new').addEventListener('click', () => start(level));
  void BAC_START; void fmt; fullscreenButton(); start(level);
}

/* ================================ Bài cào ================================ */
export function mountBaiCao(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><span id="bcao-info"></span></div>
        <div class="sol-board gboard cz-board" id="bcao-board" style="--cw:64px"></div>
      </div>
      <div class="game-side">
        <div class="row"><button type="button" class="btn" id="bcao-minus" aria-label="-">−</button><b id="bcao-bet" class="cz-amt"></b><button type="button" class="btn" id="bcao-plus" aria-label="+">+</button><button type="button" class="btn" id="bcao-max">${Ah('betMax', 'Tối đa')}</button></div>
        <div class="row"><button type="button" class="btn btn-primary" id="bcao-deal">${Ah('deal', 'Chia bài')}</button><button type="button" class="btn" id="bcao-open">${Ah('openCards', 'Mở bài')}</button>${newBtn('bcao-new')}</div>
        <p class="note" id="bcao-msg" aria-live="polite"></p>
        <p class="note">${Ah('note.bai-cao', 'Chơi bằng xu ảo, không có tiền thật. Mỗi bên 3 lá. Điểm là tổng điểm lấy chữ số hàng đơn vị (A = 1, 2–9 theo số, 10/J/Q/K = 10, tức 0 nút). Thứ hạng: Sáp (3 lá cùng số) cao nhất, rồi Ba tiên (3 lá J/Q/K), rồi điểm 9 xuống 0. Đặt cược, bấm Chia bài rồi Mở bài để so với nhà cái. Từ cấp 6 nhà cái ăn khi hoà. Đạt số xu mục tiêu trong số ván cho phép để qua cấp.')}</p>
      </div>
    </div>`);
  let level = progressOf(id).unlocked, chips = CAO_START, played = 0, bet = 10, p: Card[] = [], d: Card[] = [], shoe: Card[] = [], phase: 'bet' | 'dealt' = 'bet', over = false;
  const lv = (): (typeof CAO_LEVELS)[number] => CAO_LEVELS[level - 1];
  const label = (cs: Card[]): string => { const r = caoRank(cs); return r.label === 'sap' ? A('caoSap', 'Sáp') : r.label === 'ba-tien' ? A('caoBaTien', 'Ba tiên') : Af('caoPts', '{n} nút', { n: r.pts }); };
  function render(showD = false): void {
    $('#bcao-board').innerHTML = `<div class="cz-row"><span class="cz-lbl">${Ah('dealer', 'Nhà cái')}${showD && d.length ? ` · ${label(d)}` : ''}</span><div class="cz-hand">${d.length ? d.map((c) => (showD ? face(c) : back())).join('') : '<div class="cd slot rel"></div>'}</div></div>
      <div class="cz-row"><span class="cz-lbl">${Ah('you', 'Bạn')}${p.length ? ` · ${label(p)}` : ''}</span><div class="cz-hand">${p.length ? p.map((c) => face(c)).join('') : '<div class="cd slot rel"></div>'}</div></div>`;
    bet = Math.max(lv().minBet, Math.min(bet, Math.max(lv().minBet, chips)));
    $('#bcao-bet').textContent = String(bet);
    $('#bcao-info').textContent = coinInfo(chips, lv().target, lv().rounds - played);
    ($('#bcao-deal') as HTMLButtonElement).disabled = over || phase !== 'bet' || bet > chips;
    ($('#bcao-open') as HTMLButtonElement).disabled = over || phase !== 'dealt';
  }
  $('#bcao-minus').addEventListener('click', () => { if (phase === 'bet') { bet = Math.max(lv().minBet, bet - lv().minBet); render(); } });
  $('#bcao-plus').addEventListener('click', () => { if (phase === 'bet') { bet = Math.min(chips, bet + lv().minBet); render(); } });
  $('#bcao-max').addEventListener('click', () => { if (phase === 'bet') { bet = chips; render(); } });
  $('#bcao-deal').addEventListener('click', () => {
    if (over || phase !== 'bet' || bet > chips) return;
    if (shoe.length < 10) shoe = shuffle(newBacShoe().slice(0, 52));
    p = [shoe.pop() as Card, shoe.pop() as Card, shoe.pop() as Card]; d = [shoe.pop() as Card, shoe.pop() as Card, shoe.pop() as Card];
    phase = 'dealt'; $('#bcao-msg').textContent = ''; sfx('deal'); window.setTimeout(() => sfx('deal'), 120); window.setTimeout(() => sfx('deal'), 240); render();
  });
  $('#bcao-open').addEventListener('click', () => {
    if (over || phase !== 'dealt') return;
    sfx('flip'); const res = caoCompare(p, d, caoDealerTie(level)), delta = res === 'win' ? bet : res === 'lose' ? -bet : 0;
    chips += delta; played++; phase = 'bet'; render(true);
    sfx(delta > 0 ? 'win' : delta < 0 ? 'lose' : 'coin');
    $('#bcao-msg').textContent = delta > 0 ? Af('won', 'Thắng {n} xu', { n: delta }) : delta < 0 ? Af('lost', 'Thua {n} xu', { n: -delta }) : A('even', 'Hoà vốn');
    if (chips >= lv().target) { over = true; showBanner(banner, 'win', id, level, WIN(level), start, () => start(level)); renderLevelBar(levelBar, id, level, start); render(true); }
    else if (chips < lv().minBet || played >= lv().rounds) { over = true; showBanner(banner, 'lose', id, level, LOSE(level), start, () => start(level)); render(true); }
  });
  function start(l: number): void { level = l; chips = CAO_START; played = 0; bet = lv().minBet; p = []; d = []; phase = 'bet'; over = false; shoe = shuffle(newBacShoe().slice(0, 52)); $('#bcao-msg').textContent = ''; clearBanner(banner); renderLevelBar(levelBar, id, level, start); render(); }
  $('#bcao-new').addEventListener('click', () => start(level));
  fullscreenButton(); start(level);
}

/* ================================ Bingo ================================ */
export function mountBingo(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="bg-status"></b><span id="bg-info"></span></div>
        <div class="bg-wrap gboard"><div class="bg-head"><span>B</span><span>I</span><span>N</span><span>G</span><span>O</span></div><div class="bg-card" id="bg-card"></div></div>
      </div>
      <div class="game-side">
        <div class="bg-call" id="bg-call" aria-live="polite">–</div>
        <div class="bg-recent" id="bg-recent"></div>
        <div class="row"><button type="button" class="btn btn-primary" id="bg-claim">BINGO!</button>${newBtn('bg-new')}</div>
        <p class="note" id="bg-msg" aria-live="polite"></p>
        <p class="note">${Ah('note.bingo', 'Máy lần lượt gọi các số từ 1 đến 75. Khi số được gọi có trên thẻ của bạn, hãy bấm vào ô đó để đánh dấu (ô giữa tính sẵn). Đủ một hàng ngang, dọc hoặc chéo thì bấm BINGO! — phải nhanh hơn các đối thủ máy. Bấm BINGO! khi chưa đủ hàng sẽ bị khoá nút vài giây. Cấp càng cao số gọi càng nhanh và càng nhiều đối thủ.')}</p>
      </div>
    </div>`);
  let level = progressOf(id).unlocked, card: number[] = [], calls: number[] = [], marked = new Set<number>(), aiAt: number[] = [], over = false, token = 0, locked = 0, timer = 0, aiWin = -1;
  function render(): void {
    const cur = calls[calls.length - 1];
    $('#bg-card').innerHTML = card.map((n) => `<button type="button" class="bg-cell${n === 0 || marked.has(n) ? ' on' : ''}${n === 0 ? ' free' : ''}" data-n="${n}" ${over ? 'disabled' : ''}>${n === 0 ? '★' : n}</button>`).join('');
    $('#bg-call').textContent = cur ? `${'BINGO'[Math.floor((cur - 1) / 15)]} ${cur}` : '–';
    $('#bg-recent').textContent = calls.slice(-8, -1).reverse().join('  ');
    $('#bg-info').textContent = Af('opponentsN', 'Đối thủ: {n}', { n: aiAt.length });
    ($('#bg-claim') as HTMLButtonElement).disabled = over || performance.now() < locked;
  }
  function finish(win: boolean): void {
    over = true; window.clearInterval(timer); render(); $('#bg-status').textContent = '';
    if (win) showBanner(banner, 'win', id, level, WIN(level), start, () => start(level)); else showBanner(banner, 'lose', id, level, LOSE(level), start, () => start(level));
    renderLevelBar(levelBar, id, level, start);
  }
  $('#bg-card').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.bg-cell'); if (!b || over) return;
    const n = Number(b.dataset.n); if (!n) return;
    if (!calls.includes(n)) { sfx('error'); return; }
    if (marked.has(n)) marked.delete(n); else { marked.add(n); sfx('pop'); }
    render();
  });
  $('#bg-claim').addEventListener('click', () => {
    if (over || performance.now() < locked) return;
    if (bingoHasLine(card, marked)) { sfx('win'); finish(true); }
    else { locked = performance.now() + 3000; sfx('error'); $('#bg-msg').textContent = A('falseBingo', 'Chưa đủ hàng! Nút bị khoá 3 giây.'); render(); window.setTimeout(render, 3050); }
  });
  function start(l: number): void {
    level = l; const my = ++token; over = false; window.clearInterval(timer); aiWin = -1; locked = 0; $('#bg-msg').textContent = '';
    const cfg = bingoCfg(level); card = bingoCard(); marked = new Set(); calls = [];
    const seq = shuffle(Array.from({ length: 75 }, (_, i) => i + 1)); const order = seq.slice();
    aiAt = Array.from({ length: cfg.ais }, () => bingoCompleteAt(bingoCard(), order));
    clearBanner(banner); renderLevelBar(levelBar, id, level, start); render();
    $('#bg-status').textContent = A('bingoGo', 'Bắt đầu gọi số!');
    let k = 0;
    timer = window.setInterval(() => {
      if (my !== token || over) return;
      if (k >= order.length) return finish(false);
      calls.push(order[k++]); sfx('coin'); render();
      const cnt = k; window.setTimeout(() => { if (my === token && !over && aiAt.some((a) => a <= cnt)) { aiWin = 1; sfx('lose'); finish(false); } }, cfg.every * 0.8);
    }, cfg.every);
  }
  $('#bg-new').addEventListener('click', () => start(level));
  void aiWin; fullscreenButton(); start(level);
}

/* ================================ Yahtzee ================================ */
export function mountYahtzee(id: string): void {
  const NAME: Record<YCat, [string, string]> = {
    ones: ['yOnes', 'Một'], twos: ['yTwos', 'Hai'], threes: ['yThrees', 'Ba'], fours: ['yFours', 'Bốn'], fives: ['yFives', 'Năm'], sixes: ['ySixes', 'Sáu'],
    three: ['yThree', 'Ba giống nhau'], four: ['yFour', 'Bốn giống nhau'], full: ['yFull', 'Cù lũ (25)'], small: ['ySmall', 'Sảnh nhỏ (30)'], large: ['yLarge', 'Sảnh lớn (40)'], yahtzee: ['yYahtzee', 'Yahtzee (50)'], chance: ['yChance', 'Tuỳ ý'],
  };
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="yz-status"></b><span id="yz-total"></span></div>
        <div class="yz-dice gboard" id="yz-dice"></div>
        <div class="row"><button type="button" class="btn btn-primary" id="yz-roll"></button>${newBtn('yz-new')}</div>
        <p class="note" id="yz-msg" aria-live="polite"></p>
      </div>
      <div class="game-side"><table class="yz-table" id="yz-table"></table>
        <p class="note">${Ah('note.yahtzee', 'Mỗi lượt tung 5 xúc xắc tối đa 3 lần: bấm vào xúc xắc để giữ lại, bấm Tung để tung các viên còn lại. Sau đó chọn một ô trong bảng để ghi điểm (mỗi ô dùng một lần, ô nào không hợp lệ sẽ ghi 0). 13 lượt. Nhóm Một–Sáu cộng từ 63 trở lên được thưởng 35. Đạt số điểm mục tiêu của cấp để thắng.')}</p></div>
    </div>`);
  let level = progressOf(id).unlocked, dice = [1, 1, 1, 1, 1], held = [false, false, false, false, false], rolls = 0, scores: Partial<Record<YCat, number>> = {}, over = false, rolling = false;
  const FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  function render(): void {
    $('#yz-dice').innerHTML = dice.map((d, i) => `<button type="button" class="yz-die${held[i] ? ' held' : ''}" data-i="${i}" ${rolls === 0 || over ? 'disabled' : ''} aria-pressed="${held[i]}">${rolls === 0 && !rolling ? '?' : FACES[d]}</button>`).join('');
    const tot = yTotal(scores), done = Object.keys(scores).length;
    $('#yz-total').textContent = `${Af('score', 'Điểm: {n}', { n: tot.total })} · ${Af('target', 'Mục tiêu: {n}', { n: Y_TARGETS[level - 1] })}`;
    $('#yz-status').textContent = Af('turnN', 'Lượt {n}/13', { n: Math.min(13, done + 1) });
    const rb = $('#yz-roll') as HTMLButtonElement; rb.textContent = rolls >= 3 ? A('pickCat', 'Chọn một ô để ghi điểm') : Af('rollsLeft', 'Tung ({n} lần còn lại)', { n: 3 - rolls }); rb.disabled = over || rolling || rolls >= 3;
    $('#yz-table').innerHTML = Y_CATS.map((c) => {
      const has = scores[c] !== undefined, pot = rolls > 0 && !has ? yScore(c, dice) : null;
      return `<tr class="${has ? 'done' : rolls > 0 ? 'can' : ''}" data-c="${c}"><td>${escapeHtml(A(NAME[c][0], NAME[c][1]))}</td><td>${has ? scores[c] : pot !== null ? `<i>${pot}</i>` : ''}</td></tr>`;
    }).join('') + `<tr class="sum"><td>${Ah('upperBonus', 'Thưởng nhóm Một–Sáu')}</td><td>${tot.upper}/63${tot.bonus ? ` +${tot.bonus}` : ''}</td></tr>`;
  }
  async function roll(): Promise<void> {
    if (over || rolling || rolls >= 3) return;
    rolling = true; sfx('roll');
    for (let k = 0; k < 5; k++) { dice = dice.map((d, i) => (held[i] ? d : 1 + Math.floor(Math.random() * 6))); render(); await wait(70); }
    rolls++; rolling = false; render();
  }
  $('#yz-roll').addEventListener('click', () => { void roll(); });
  $('#yz-dice').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('.yz-die'); if (!b || rolls === 0 || rolling || over) return; const i = Number(b.dataset.i); held[i] = !held[i]; sfx('tap'); render(); });
  $('#yz-table').addEventListener('click', (e) => {
    const tr = (e.target as HTMLElement).closest<HTMLElement>('tr[data-c]'); if (!tr || rolls === 0 || rolling || over) return;
    const c = tr.dataset.c as YCat; if (scores[c] !== undefined) return;
    const v = yScore(c, dice); scores[c] = v; sfx(v === 0 ? 'error' : c === 'yahtzee' ? 'win' : v >= 25 ? 'combo' : 'coin');
    $('#yz-msg').textContent = Af('scored', 'Ghi {n} điểm', { n: v }); rolls = 0; held = [false, false, false, false, false]; dice = [1, 1, 1, 1, 1]; render();
    if (Object.keys(scores).length >= Y_CATS.length) {
      over = true; render(); const tot = yTotal(scores).total;
      if (tot >= Y_TARGETS[level - 1]) { showBanner(banner, 'win', id, level, WIN(level), start, () => start(level)); renderLevelBar(levelBar, id, level, start); }
      else showBanner(banner, 'lose', id, level, LOSE(level), start, () => start(level));
    }
  });
  function start(l: number): void { level = l; dice = [1, 1, 1, 1, 1]; held = [false, false, false, false, false]; rolls = 0; scores = {}; over = false; rolling = false; $('#yz-msg').textContent = ''; clearBanner(banner); renderLevelBar(levelBar, id, level, start); render(); }
  $('#yz-new').addEventListener('click', () => start(level));
  fullscreenButton(); start(level);
}

/* ================================ Bài 8 lá ================================ */
export function mountCrazyEights(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="ce-status"></b><span id="ce-info"></span></div>
        <div class="sol-board gboard cz-board ce-board" id="ce-board" style="--cw:60px"></div>
      </div>
      <div class="game-side">
        <div class="row" id="ce-suits" hidden></div>
        <div class="row">${newBtn('ce-new')}</div>
        <p class="note" id="ce-msg" aria-live="polite"></p>
        <p class="note">${Ah('note.crazy-eights', 'Đánh một lá cùng chất hoặc cùng số với lá trên cùng của chồng bài đánh. Lá 8 là lá chủ: đánh được bất cứ lúc nào và bạn chọn chất mới. Không có lá hợp lệ thì bốc bài từ chồng (tối đa 3 lá), vẫn không có thì bỏ lượt. Ai hết bài trước là thắng. Cấp càng cao càng nhiều đối thủ và máy chơi càng khôn.')}</p>
      </div>
    </div>`);
  let level = progressOf(id).unlocked, g: Crazy = crazyNew(1), draws = 0, busy = false, token = 0, pending: Card | null = null, over = false;
  const board = $('#ce-board');
  function render(): void {
    const top = g.pile[g.pile.length - 1], mine = g.hands[0];
    const opp = g.hands.slice(1).map((h, i) => `<div class="cz-row"><span class="cz-lbl">${escapeHtml(A('opponent', 'Đối thủ'))} ${i + 1} · ${h.length}</span><div class="cz-hand">${h.map(() => back()).join('')}</div></div>`).join('');
    const can = !busy && !over && g.turn === 0 && !pending;
    board.innerHTML = `${opp}<div class="cz-row ce-mid"><div class="ce-draw ${can && !mine.some((c) => crazyCanPlay(g, c)) ? 'can' : ''}" data-draw="1">${back()}<b>${g.draw.length}</b></div><div class="cz-hand">${face(top)}</div><div class="ce-suit ${top.s === 1 || top.s === 2 ? 'red' : ''}">${SUIT[g.suit]}</div></div>
      <div class="cz-row"><span class="cz-lbl">${Ah('you', 'Bạn')} · ${mine.length}</span><div class="cz-hand ce-hand">${mine.map((c) => face(c, can && crazyCanPlay(g, c) ? 'playable' : '', `data-id="${c.id}"`)).join('')}</div></div>`;
    $('#ce-info').textContent = Af('pileLeft', 'Chồng bốc: {n}', { n: g.draw.length });
    if (!over) $('#ce-status').textContent = g.turn === 0 ? (pending ? A('pickSuit', 'Chọn chất mới') : t('lib.game.yourTurn', 'Đến lượt bạn')) : t('lib.game.thinking', 'Máy đang nghĩ…');
    const sb = $('#ce-suits'); sb.hidden = !pending; sb.innerHTML = pending ? SUIT.map((s, i) => `<button type="button" class="btn${i === 1 || i === 2 ? ' red' : ''}" data-s="${i}">${s}</button>`).join('') : '';
  }
  function end(): void {
    over = true; render(); $('#ce-status').textContent = '';
    if (g.winner === 0) { showBanner(banner, 'win', id, level, WIN(level), start, () => start(level)); renderLevelBar(levelBar, id, level, start); } else showBanner(banner, 'lose', id, level, LOSE(level), start, () => start(level));
  }
  async function aiTurns(my: number): Promise<void> {
    while (my === token && !over && g.turn !== 0) {
      busy = true; render(); await wait(750); if (my !== token) return;
      const who = g.turn; let ch = crazyAiChoose(g, who, level), d = 0;
      while (!ch && d < 3) { crazyDraw(g, who); sfx('deal'); d++; render(); await wait(350); if (my !== token) return; ch = crazyAiChoose(g, who, level); }
      if (ch) { crazyPlay(g, who, ch.card, ch.suit); sfx(ch.card.r === 8 ? 'combo' : 'flip'); if (ch.card.r === 8) $('#ce-msg').textContent = Af('aiSuit', 'Máy chọn chất {s}', { s: SUIT[ch.suit] }); else $('#ce-msg').textContent = ''; }
      else { g.turn = (who + 1) % g.n; $('#ce-msg').textContent = A('aiPass', 'Máy bỏ lượt.'); }
      if (g.winner >= 0) { busy = false; return end(); }
    }
    busy = false; draws = 0; render();
  }
  function afterPlayer(my: number): void { draws = 0; render(); if (g.winner >= 0) return end(); void aiTurns(my); }
  board.addEventListener('click', (e) => {
    if (busy || over || g.turn !== 0 || pending) return;
    const el = e.target as HTMLElement, my = token;
    const cardEl = el.closest<HTMLElement>('[data-id]');
    if (cardEl) {
      const c = g.hands[0].find((x) => x.id === Number(cardEl.dataset.id)); if (!c || !crazyCanPlay(g, c)) { sfx('error'); return; }
      if (c.r === 8) { pending = c; sfx('select'); render(); return; }
      crazyPlay(g, 0, c, c.s); sfx('flip'); $('#ce-msg').textContent = ''; afterPlayer(my); return;
    }
    if (el.closest('[data-draw]')) {
      if (g.hands[0].some((c) => crazyCanPlay(g, c))) { sfx('error'); $('#ce-msg').textContent = A('mustPlay', 'Bạn đang có lá hợp lệ — hãy đánh bài.'); return; }
      crazyDraw(g, 0); sfx('deal'); draws++;
      if (draws >= 3 && !g.hands[0].some((c) => crazyCanPlay(g, c))) { g.turn = 1 % g.n; $('#ce-msg').textContent = A('youPass', 'Đã bốc 3 lá, bạn bỏ lượt.'); afterPlayer(my); return; }
      render();
    }
  });
  $('#ce-suits').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-s]'); if (!b || !pending) return;
    const c = pending; pending = null; crazyPlay(g, 0, c, Number(b.dataset.s)); sfx('combo'); afterPlayer(token);
  });
  function start(l: number): void { level = l; token++; g = crazyNew(l); draws = 0; busy = false; pending = null; over = false; $('#ce-msg').textContent = ''; clearBanner(banner); renderLevelBar(levelBar, id, level, start); render(); }
  $('#ce-new').addEventListener('click', () => start(level));
  void RANK; fullscreenButton(); start(level);
}
