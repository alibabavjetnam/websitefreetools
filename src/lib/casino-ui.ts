/** Giao diện Xì dách (Blackjack) và Video Poker. Chỉ chơi bằng xu ảo, không có tiền thật. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { RANK, SUIT, deck, isRed, shuffle, type Card } from '../calc/solitaire';
import {
  BJ_LEVELS, POKER_ORDER, VP_LEVELS, VP_START, bjCanDouble, bjCanSplit, bjDeal, bjDouble, bjHit, bjNatural, bjNew, bjOutcome, bjSplit, bjStand, bjValue,
  pokerBestHold, pokerEval, vpPay, type Bj, type PokerHand,
} from '../calc/casino';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah } from './arcade-ui';

const face = (c: Card, cls = '', attrs = ''): string => {
  const s = SUIT[c.s], r = RANK[c.r];
  return `<div class="cd up rel${isRed(c) ? ' red' : ''}${cls ? ' ' + cls : ''}" ${attrs} role="img" aria-label="${r}${s}"><span class="ci">${r}<i>${s}</i></span><span class="cb">${s}</span></div>`;
};
const back = (): string => '<div class="cd down rel"></div>';

const POKER_NAME: Record<PokerHand, [string, string]> = {
  royal: ['ph.royal', 'Thùng phá sảnh lớn'], sflush: ['ph.sflush', 'Thùng phá sảnh'], quads: ['ph.quads', 'Tứ quý'], full: ['ph.full', 'Cù lũ'],
  flush: ['ph.flush', 'Thùng'], straight: ['ph.straight', 'Sảnh'], trips: ['ph.trips', 'Sám cô'], twopair: ['ph.twopair', 'Hai đôi'], jacks: ['ph.jacks', 'Đôi J trở lên'], none: ['ph.none', 'Không có gì'],
};
const pokerName = (h: PokerHand): string => A(POKER_NAME[h][0], POKER_NAME[h][1]);

/* ================================ Blackjack ================================ */
export function mountBlackjack(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><span id="bj-info"></span></div>
        <div class="sol-board gboard cz-board" id="bj-board" style="--cw:64px"></div>
      </div>
      <div class="game-side">
        <div class="cz-bet" id="bj-betbox">
          <div class="row"><button type="button" class="btn" id="bj-minus" aria-label="-">−</button><b id="bj-bet" class="cz-amt"></b><button type="button" class="btn" id="bj-plus" aria-label="+">+</button><button type="button" class="btn btn-sm" id="bj-max">${Ah('betMax', 'Tối đa')}</button></div>
          <button type="button" class="btn btn-primary" id="bj-deal">${Ah('deal', 'Chia bài')}</button>
        </div>
        <div class="row" id="bj-actions">
          <button type="button" class="btn btn-primary" id="bj-hit">${Ah('hit', 'Rút thêm')}</button>
          <button type="button" class="btn" id="bj-stand">${Ah('stand', 'Dừng')}</button>
          <button type="button" class="btn" id="bj-double">${Ah('double', 'Gấp đôi')}</button>
          <button type="button" class="btn" id="bj-split">${Ah('split', 'Tách đôi')}</button>
        </div>
        <button type="button" class="btn" id="bj-next">${Ah('nextHand', 'Ván tiếp')}</button>
        <p class="note" id="bj-msg" aria-live="polite"></p>
        <p class="note">${Ah('note.blackjack', 'Chơi bằng xu ảo, không có tiền thật. Bạn có 500 xu; đạt số xu mục tiêu trong số ván cho phép để qua cấp. Gần 21 hơn nhà cái mà không quá 21 là thắng. Nhà cái rút đến khi được 17. Blackjack (A + lá 10 điểm) được trả thêm. Gấp đôi: cược gấp đôi và chỉ rút thêm một lá. Tách đôi: khi hai lá đầu cùng giá trị.')}</p>
      </div>
    </div>`);
  const board = $('#bj-board');
  let level = progressOf(id).unlocked;
  let g: Bj = bjNew();
  let bet = 10;
  let over = false;
  const lv = () => BJ_LEVELS[level - 1];

  function start(l: number): void {
    level = l; g = bjNew(); bet = lv().minBet; over = false; $('#bj-msg').textContent = '';
    clearBanner(banner); renderLevelBar(levelBar, id, level, start); render();
  }
  function render(): void {
    const L = lv();
    const hole = g.phase === 'play';
    const dv = g.dealer.length ? (hole ? bjValue([g.dealer[0]]).total : bjValue(g.dealer).total) : 0;
    let html = `<div class="cz-row"><span class="cz-lbl">${Ah('dealer', 'Nhà cái')}${g.dealer.length ? ` · ${dv}` : ''}</span><div class="cz-hand">${g.dealer.map((c, i) => (hole && i === 1 ? back() : face(c))).join('') || '<div class="cd slot rel"></div>'}</div></div>`;
    html += '<div class="cz-row"><span class="cz-lbl">' + Ah('you', 'Bạn') + '</span><div class="cz-hands">';
    if (!g.hands.length) html += '<div class="cz-hand"><div class="cd slot rel"></div></div>';
    g.hands.forEach((h, i) => {
      const v = bjValue(h.cards);
      const res = g.phase === 'done' ? g.results[i] : '';
      const tag = res ? ` · ${A('res.' + res, { win: 'Thắng', lose: 'Thua', push: 'Hoà', blackjack: 'Blackjack!' }[res] as string)}` : '';
      html += `<div class="cz-hwrap${g.phase === 'play' && i === g.active && g.hands.length > 1 ? ' active' : ''}"><span class="cz-lbl">${v.total}${v.soft && v.total < 21 ? '/' + (v.total - 10) : ''} · ${A('bet', 'Cược')} ${h.bet}${tag}</span><div class="cz-hand">${h.cards.map((c) => face(c)).join('')}</div></div>`;
    });
    html += '</div></div>';
    board.innerHTML = html;
    $('#bj-info').textContent = `${Af('chips', 'Xu: {n}', { n: g.chips })} · ${Af('target', 'Mục tiêu: {n}', { n: L.target })} · ${Af('handsLeft', 'Còn {n} ván', { n: L.hands - g.played })}`;
    const betting = g.phase === 'bet' || g.phase === 'done';
    bet = Math.max(L.minBet, Math.min(bet, Math.max(L.minBet, g.chips)));
    $('#bj-bet').textContent = String(bet);
    $('#bj-betbox').hidden = g.phase !== 'bet' || over;
    $('#bj-actions').hidden = g.phase !== 'play';
    $('#bj-next').hidden = g.phase !== 'done' || over;
    ($('#bj-double') as HTMLButtonElement).disabled = g.phase !== 'play' || !bjCanDouble(g);
    ($('#bj-split') as HTMLButtonElement).disabled = g.phase !== 'play' || !bjCanSplit(g);
    ($('#bj-deal') as HTMLButtonElement).disabled = !betting || bet > g.chips;
    if (g.phase === 'done') $('#bj-msg').textContent = g.lastDelta > 0 ? Af('won', 'Bạn được {n} xu.', { n: g.lastDelta }) : g.lastDelta < 0 ? Af('lost', 'Bạn mất {n} xu.', { n: -g.lastDelta }) : A('even', 'Hoà vốn.');
    if (betting) {
      const o = bjOutcome(g, L);
      if (o && !over) {
        over = true; $('#bj-betbox').hidden = true; $('#bj-next').hidden = true;
        showBanner(banner, o, id, level, o === 'win' ? tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }) : tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), start, () => start(level));
        renderLevelBar(levelBar, id, level, start);
      }
    }
  }
  $('#bj-minus').addEventListener('click', () => { bet = Math.max(lv().minBet, bet - lv().minBet); render(); });
  $('#bj-plus').addEventListener('click', () => { bet = Math.min(g.chips, bet + lv().minBet); render(); });
  $('#bj-max').addEventListener('click', () => { bet = g.chips; render(); });
  $('#bj-deal').addEventListener('click', () => { if (bet > g.chips || bet < lv().minBet) return; $('#bj-msg').textContent = ''; g = bjDeal(g, bet, lv()); render(); });
  $('#bj-hit').addEventListener('click', () => { if (g.phase === 'play') { g = bjHit(g, lv()); render(); } });
  $('#bj-stand').addEventListener('click', () => { if (g.phase === 'play') { g = bjStand(g, lv()); render(); } });
  $('#bj-double').addEventListener('click', () => { if (bjCanDouble(g)) { g = bjDouble(g, lv()); render(); } });
  $('#bj-split').addEventListener('click', () => { if (bjCanSplit(g)) { g = bjSplit(g, lv()); render(); } });
  $('#bj-next').addEventListener('click', () => { g.phase = 'bet'; g.hands = []; g.dealer = []; $('#bj-msg').textContent = ''; render(); });
  void bjNatural;
  fullscreenButton();
  start(level);
}

/* ================================ Video Poker ================================ */
export function mountVideoPoker(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><span id="vp-info"></span></div>
        <div class="sol-board gboard cz-board" id="vp-board" style="--cw:64px"></div>
      </div>
      <div class="game-side">
        <div class="row" id="vp-betrow"></div>
        <div class="row">
          <button type="button" class="btn btn-primary" id="vp-go"></button>
          <button type="button" class="btn" id="vp-hint">${escapeHtml(t('lib.game.hint', 'Gợi ý'))}</button>
        </div>
        <table class="cz-pay" id="vp-pay"></table>
        <p class="note" id="vp-msg" aria-live="polite"></p>
        <p class="note">${Ah('note.videopoker', 'Chơi bằng xu ảo, không có tiền thật. Chọn mức cược 1–5 xu, bấm Chia bài để nhận 5 lá, bấm các lá muốn giữ rồi bấm Đổi bài để thay các lá còn lại. Bài từ đôi J trở lên là có thưởng. Bạn có 100 xu; đạt số xu mục tiêu trong số ván cho phép để qua cấp.')}</p>
      </div>
    </div>`);
  const board = $('#vp-board');
  let level = progressOf(id).unlocked;
  let chips = VP_START, played = 0, betN = 5;
  let phase: 'bet' | 'hold' | 'done' = 'bet';
  let cards: Card[] = [], held: boolean[] = [], pile: Card[] = [], result: PokerHand = 'none', won = 0;
  let over = false;
  const lv = () => VP_LEVELS[level - 1];

  function start(l: number): void {
    level = l; chips = VP_START; played = 0; phase = 'bet'; cards = []; held = []; over = false; betN = Math.min(betN, 5);
    $('#vp-msg').textContent = ''; clearBanner(banner); renderLevelBar(levelBar, id, level, start); render();
  }
  function render(): void {
    const L = lv();
    let html = '<div class="cz-hand cz-poker">';
    for (let i = 0; i < 5; i++) {
      const c = cards[i];
      html += c ? `<button type="button" class="cz-pc" data-i="${i}" ${phase === 'hold' ? '' : 'disabled'}>${face(c, held[i] ? 'sel' : '')}${held[i] ? `<b class="cz-hold">${Ah('hold', 'GIỮ')}</b>` : ''}</button>` : '<div class="cd slot rel"></div>';
    }
    html += '</div>';
    if (phase === 'done') html += `<p class="cz-result ${won > 0 ? 'win' : ''}">${escapeHtml(pokerName(result))}${won > 0 ? ` +${won}` : ''}</p>`;
    board.innerHTML = html;
    $('#vp-info').textContent = `${Af('chips', 'Xu: {n}', { n: chips })} · ${Af('target', 'Mục tiêu: {n}', { n: L.target })} · ${Af('handsLeft', 'Còn {n} ván', { n: L.hands - played })}`;
    $('#vp-betrow').innerHTML = [1, 2, 3, 4, 5].map((n) => `<button type="button" class="btn btn-sm${n === betN ? ' btn-primary' : ''}" data-bet="${n}" ${phase === 'hold' || over || n > chips ? 'disabled' : ''}>${A('bet', 'Cược')} ${n}</button>`).join('');
    const go = $('#vp-go') as HTMLButtonElement;
    go.textContent = phase === 'hold' ? A('draw', 'Đổi bài') : A('deal', 'Chia bài');
    go.disabled = over || (phase !== 'hold' && chips < 1);
    ($('#vp-hint') as HTMLButtonElement).disabled = phase !== 'hold';
    const rows = POKER_ORDER.map((h) => `<tr class="${phase === 'done' && result === h ? 'on' : ''}"><td>${escapeHtml(pokerName(h))}</td><td>${vpPay(h, L, betN)}</td></tr>`);
    $('#vp-pay').innerHTML = rows.join('');
  }
  function finishCheck(): void {
    const L = lv();
    const o = chips >= L.target ? 'win' : chips < 1 || played >= L.hands ? 'lose' : null;
    if (!o) return;
    over = true; render();
    showBanner(banner, o, id, level, o === 'win' ? tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }) : tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), start, () => start(level));
    renderLevelBar(levelBar, id, level, start);
  }
  $('#vp-betrow').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-bet]');
    if (b && phase !== 'hold') { betN = Number(b.dataset.bet); render(); }
  });
  board.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
    if (b && phase === 'hold') { const i = Number(b.dataset.i); held[i] = !held[i]; render(); }
  });
  $('#vp-go').addEventListener('click', () => {
    if (over) return;
    if (phase !== 'hold') {
      if (chips < 1) return;
      betN = Math.min(betN, chips);
      chips -= betN;
      const d = shuffle(deck()).map((c) => ({ ...c, up: true }));
      cards = d.splice(0, 5); pile = d; held = [false, false, false, false, false]; phase = 'hold'; $('#vp-msg').textContent = '';
      render();
    } else {
      cards = cards.map((c, i) => (held[i] ? c : (pile.pop() as Card)));
      result = pokerEval(cards); won = vpPay(result, lv(), betN); chips += won; played++; phase = 'done'; held = [];
      render(); finishCheck();
    }
  });
  $('#vp-hint').addEventListener('click', () => {
    if (phase !== 'hold') return;
    held = pokerBestHold(cards, pile); render();
  });
  fullscreenButton();
  start(level);
}
