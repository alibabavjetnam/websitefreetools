/** Giao diện Cribbage 2 người đấu với máy: chạy đua tới 61 điểm, 10 cấp. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { CRIB_TARGET, aiCribDiscard, aiPegChoice, cDeck, cKey, cVal, pegPlayScore, scoreHand, type CCard, type Part } from '../calc/cribbage';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah } from './arcade-ui';
import { back, face } from './casino-ui';
import { sfx } from './sfx';
import type { Card } from '../calc/solitaire';

const toCard = (c: CCard): Card => ({ r: c.r, s: c.s, up: true, id: cKey(c) });
const KIND: Record<Part['kind'], [string, string]> = {
  fifteen: ['cbFifteen', 'Mười lăm'], pair: ['cbPair', 'Đôi'], run: ['cbRun', 'Dãy'], flush: ['cbFlush', 'Đồng chất'], nobs: ['cbNobs', 'J cùng chất lá lật'], heels: ['cbHeels', 'J lá lật'],
};

export function mountCribbage(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="cb-status"></b><span id="cb-score"></span></div>
        <div class="sol-board gboard cz-board cb-board" id="cb-board" style="--cw:50px"></div>
      </div>
      <div class="game-side">
        <div class="row">
          <button type="button" class="btn btn-primary" id="cb-ok"></button>
          <button type="button" class="btn" id="cb-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>
        </div>
        <p class="note" id="cb-msg" aria-live="polite"></p>
        <p class="note">${Ah('note.cribbage', 'Cribbage 2 người, chạy đua tới 61 điểm. Mỗi ván chia 6 lá; mỗi người bỏ 2 lá úp vào "chuồn" (của người chia). Lật một lá chung. Rồi lần lượt đánh bài ngửa, tổng không quá 31: đạt 15 hoặc 31 được 2 điểm, đánh trùng số được 2/6/12 điểm, tạo dãy 3 lá trở lên (thứ tự bất kỳ) được bằng số lá; hết lượt đánh ("Go") thì người đánh cuối được 1 điểm. Sau đó đếm bài 4 lá cùng lá chung: mỗi tổ hợp tổng 15 được 2, mỗi đôi 2, dãy 3 lá trở lên bằng số lá, 4 lá cùng chất 4 (5 nếu cả lá chung), J cùng chất lá chung 1. Người không chia đếm trước, rồi người chia đếm bài và chuồn.')}</p>
      </div>
    </div>`);
  const boardEl = $('#cb-board'), statusEl = $('#cb-status'), scoreEl = $('#cb-score'), msg = $('#cb-msg');
  const okBtn = $('#cb-ok') as HTMLButtonElement;
  let level = progressOf(id).unlocked;
  type Who = 'H' | 'A';
  let dealer: Who = 'A', score = { H: 0, A: 0 };
  let hand: CCard[] = [], foe: CCard[] = [], crib: CCard[] = [], starter: CCard | null = null;
  let keepH: CCard[] = [], keepA: CCard[] = [];
  let phase: 'discard' | 'peg' | 'count' | 'end' = 'discard';
  let sel = new Set<number>();
  let seq: CCard[] = [], count = 0, played: CCard[] = [], turn: Who = 'H', lastPlayed: Who | null = null;
  let countStep = 0, token = 0, over = false;
  const other = (w: Who): Who => (w === 'H' ? 'A' : 'H');
  const name = (w: Who): string => (w === 'H' ? A('cbYou', 'Bạn') : A('cbFoe', 'Máy'));

  function award(who: Who, pts: number, why: string): boolean {
    if (pts <= 0) return false;
    score[who] += pts; msg.textContent = `${name(who)} +${pts} (${why})`; sfx(who === 'H' ? 'coin' : 'tap');
    if (score[who] >= CRIB_TARGET) { finish(who); return true; }
    return false;
  }
  function finish(w: Who): void {
    over = true; phase = 'end'; token++; render();
    if (w === 'H') showBanner(banner, 'win', id, level, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), start, () => start(level));
    else showBanner(banner, 'lose', id, level, tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), start, () => start(level));
    renderLevelBar(levelBar, id, level, start);
  }
  function start(lv: number): void {
    level = lv; token++; over = false; score = { H: 0, A: 0 }; dealer = Math.random() < 0.5 ? 'H' : 'A';
    clearBanner(banner); renderLevelBar(levelBar, id, level, start); deal();
  }
  function deal(): void {
    const d = cDeck();
    const mine = d.splice(0, 6), theirs = d.splice(0, 6);
    hand = mine.sort((a, b) => a.r - b.r || a.s - b.s); foe = theirs; crib = []; starter = null; sel = new Set();
    seq = []; count = 0; played = []; lastPlayed = null; phase = 'discard'; countStep = 0; msg.textContent = '';
    stock = d; render();
  }
  let stock: CCard[] = [];
  function afterDiscard(): void {
    const mineIdx = [...sel];
    crib.push(...mineIdx.map((i) => hand[i]));
    keepH = hand.filter((_, i) => !sel.has(i));
    const [a, b] = aiCribDiscard(foe, dealer === 'A', level);
    crib.push(foe[a], foe[b]); keepA = foe.filter((_, i) => i !== a && i !== b);
    starter = stock.pop() as CCard;
    hand = keepH.slice(); foe = keepA.slice(); sel = new Set();
    if (starter.r === 11 && award(dealer, 2, A('cbHeels', 'J lá lật'))) return;
    phase = 'peg'; turn = other(dealer); render(); pegNext();
  }
  const legal = (who: Who): number[] => (who === 'H' ? hand : foe).map((_c, i) => i).filter((i) => count + cVal((who === 'H' ? hand : foe)[i]) <= 31);

  function playCard(who: Who, idx: number): void {
    const h = who === 'H' ? hand : foe;
    const c = h.splice(idx, 1)[0];
    seq.push(c); played.push(c); count += cVal(c); lastPlayed = who;
    const r = pegPlayScore(seq, count);
    if (award(who, r.pts, r.why.map((w) => (w === '15' || w === '31' ? w : w === 'run' ? A('cbRun', 'Dãy') : A('cbPair', 'Đôi'))).join(', '))) return;
    if (count === 31) { seq = []; count = 0; played = []; lastPlayed = null; }
    turn = other(who);
    render(); pegNext();
  }
  function pegNext(): void {
    if (over || phase !== 'peg') return;
    if (!hand.length && !foe.length) {
      if (lastPlayed && count !== 0 && count !== 31 && award(lastPlayed, 1, A('cbLast', 'Lá cuối'))) return;
      phase = 'count'; countStep = 0; seq = []; count = 0; played = []; render(); return;
    }
    if (!legal(turn).length) {
      if (legal(other(turn)).length) { msg.textContent = `${name(turn)}: Go`; turn = other(turn); render(); pegNext(); return; }
      // cả hai hết nước: người đánh cuối được 1 điểm, bắt đầu lại
      if (lastPlayed && award(lastPlayed, 1, 'Go')) return;
      const nxt = lastPlayed ? other(lastPlayed) : turn;
      seq = []; count = 0; played = []; lastPlayed = null; turn = nxt; render(); pegNext(); return;
    }
    if (turn === 'A') {
      const tk = token;
      window.setTimeout(() => {
        if (tk !== token || over) return;
        const i = aiPegChoice(foe, seq, count, level);
        if (i >= 0) playCard('A', i);
      }, 700);
    } else render();
  }
  function showCount(): { who: Who | 'C'; cards: CCard[]; r: ReturnType<typeof scoreHand> } {
    const nonDealer = other(dealer);
    const order: (Who | 'C')[] = [nonDealer, dealer, 'C'];
    const w = order[countStep];
    const cards = w === 'C' ? crib : w === 'H' ? keepH : keepA;
    return { who: w, cards, r: scoreHand(cards, starter as CCard, w === 'C') };
  }
  function render(): void {
    scoreEl.textContent = ` · ${A('cbYou', 'Bạn')} ${score.H} / ${CRIB_TARGET} · ${A('cbFoe', 'Máy')} ${score.A} / ${CRIB_TARGET}`;
    statusEl.textContent = phase === 'peg' ? Af('cbCount', 'Tổng: {n}', { n: count }) + ` · ${dealer === 'H' ? A('cbYouDeal', 'Bạn chia') : A('cbFoeDeal', 'Máy chia')}` : phase === 'discard' ? A('cbPick', 'Chọn 2 lá bỏ vào chuồn') : '';
    const row = (lbl: string, cards: string): string => `<div class="mb-row"><span class="cz-lbl">${lbl}</span><div class="cz-hand mb-hand">${cards}</div></div>`;
    let html = '';
    if (phase === 'count') {
      const s = showCount();
      const lbl = s.who === 'C' ? A('cbCrib', 'Chuồn') : s.who === 'H' ? A('cbYourHand', 'Bài của bạn') : A('cbFoeHand', 'Bài của máy');
      html += row(A('cbStarter', 'Lá chung'), face(toCard(starter as CCard)));
      html += row(lbl, s.cards.map((c) => face(toCard(c))).join(''));
      html += `<ul class="cb-parts">${s.r.parts.map((p) => `<li>${p.cards.map((c) => `${['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][c.r]}${['♠', '♥', '♦', '♣'][c.s]}`).join(' ')} — ${A(KIND[p.kind][0], KIND[p.kind][1])} <b>+${p.pts}</b></li>`).join('') || `<li>${A('cbZero', '0 điểm')}</li>`}</ul><p class="cz-result">${s.r.pts}</p>`;
    } else {
      html += row(`${A('cbFoeHand', 'Bài của máy')} (${foe.length})`, foe.map(() => back()).join('') || '<div class="cd slot rel"></div>');
      if (phase === 'peg' || starter) html += row(A('cbStarter', 'Lá chung'), starter ? face(toCard(starter)) : '');
      if (phase === 'peg') html += row(A('cbPlayed', 'Đã đánh'), played.map((c) => face(toCard(c))).join('') || '<div class="cd slot rel"></div>');
      const leg = phase === 'peg' && turn === 'H' ? new Set(legal('H')) : new Set<number>();
      html += row(A('cbYourHand', 'Bài của bạn'), hand.map((c, i) => face(toCard(c), `${sel.has(i) ? 'sel ' : ''}${phase === 'peg' && !leg.has(i) ? 'cb-dim' : ''}`, `data-i="${i}"`)).join(''));
    }
    boardEl.innerHTML = html;
    if (phase === 'discard') { okBtn.textContent = A('cbToCrib', 'Bỏ vào chuồn'); okBtn.disabled = sel.size !== 2; }
    else if (phase === 'count') { okBtn.textContent = A('cbNext', 'Tiếp tục'); okBtn.disabled = false; }
    else if (phase === 'peg') { okBtn.textContent = 'Go'; okBtn.disabled = !(turn === 'H' && !legal('H').length && (hand.length > 0)); }
    else { okBtn.textContent = '…'; okBtn.disabled = true; }
  }
  boardEl.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
    if (!el || over) return;
    const i = Number(el.dataset.i);
    if (phase === 'discard') { if (sel.has(i)) sel.delete(i); else if (sel.size < 2) sel.add(i); sfx('select'); render(); }
    else if (phase === 'peg' && turn === 'H' && legal('H').includes(i)) playCard('H', i);
  });
  okBtn.addEventListener('click', () => {
    if (over) return;
    if (phase === 'discard' && sel.size === 2) afterDiscard();
    else if (phase === 'peg' && turn === 'H' && !legal('H').length) { msg.textContent = 'Go'; pegNext(); }
    else if (phase === 'count') {
      const s = showCount();
      if (!(s as { shown?: boolean }).shown) { /* điểm tính lúc bấm Tiếp tục */ }
      if (award(s.who === 'C' ? dealer : (s.who as Who), s.r.pts, s.who === 'C' ? A('cbCrib', 'Chuồn') : A('cbHand', 'Bài'))) return;
      countStep++;
      if (countStep >= 3) { dealer = other(dealer); deal(); } else render();
    }
  });
  $('#cb-new').addEventListener('click', () => start(level));
  void cVal;
  fullscreenButton();
  start(level);
}
