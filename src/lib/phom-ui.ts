/** Giao diện Phỏm (Tá lả) 2 người đấu với máy, 10 cấp. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { pAiDiscard, pAiEat, pBest, pCanEat, pDeck, pIsU, pKey, pSort, pVal, type PCard } from '../calc/phom';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah } from './arcade-ui';
import { back, face } from './casino-ui';
import { sfx } from './sfx';
import type { Card } from '../calc/solitaire';

const toCard = (c: PCard): Card => ({ r: c.r, s: c.s, up: true, id: pKey(c) });
const TURNS = 8;

export function mountPhom(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="pm-status"></b></div>
        <div class="sol-board gboard cz-board pm-board" id="pm-board" style="--cw:52px"></div>
      </div>
      <div class="game-side">
        <div class="row">
          <button type="button" class="btn btn-primary" id="pm-draw">${Ah('pmDraw', 'Bốc bài')}</button>
          <button type="button" class="btn" id="pm-eat">${Ah('pmEat', 'Ăn bài')}</button>
          <button type="button" class="btn btn-primary" id="pm-throw">${Ah('pmThrow', 'Đánh bài')}</button>
        </div>
        <div class="row"><button type="button" class="btn" id="pm-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button></div>
        <p class="note" id="pm-msg" aria-live="polite"></p>
        <p class="note">${Ah('note.phom', 'Hai người, mỗi người 9 lá (người đi trước 10 lá). Phỏm là 3 lá trở lên cùng số, hoặc 3 lá trở lên cùng chất liên tiếp (A chỉ là 1). Đến lượt: bốc một lá từ chồng, hoặc ăn lá đối thủ vừa đánh nếu nó ghép được phỏm với bài của bạn (lá ăn phải giữ lại), rồi đánh ra một lá. Mỗi người đánh 4 lá thì ván kết thúc: ai có tổng điểm lá rác (A=1 … K=13) ít hơn thì thắng. Nếu mọi lá đều đã vào phỏm sau khi đánh thì "ù" và thắng ngay. Các lá được tô viền xanh là đã nằm trong phỏm tốt nhất của bạn.')}</p>
      </div>
    </div>`);
  const boardEl = $('#pm-board'), statusEl = $('#pm-status'), msg = $('#pm-msg');
  const bDraw = $('#pm-draw') as HTMLButtonElement, bEat = $('#pm-eat') as HTMLButtonElement, bThrow = $('#pm-throw') as HTMLButtonElement;
  let level = progressOf(id).unlocked;
  let deck: PCard[] = [], hand: PCard[] = [], foe: PCard[] = [];
  let myDisc: PCard[] = [], foeDisc: PCard[] = [], myEaten: PCard[] = [], foeEaten: PCard[] = [];
  let top: PCard | null = null; // lá vừa bị đánh, có thể ăn
  let turn = 0, humanFirst = true, phase: 'draw' | 'discard' | 'foe' | 'end' = 'draw', sel = -1, token = 0;
  const humanTurn = (n: number): boolean => (n % 2 === 0) === humanFirst;
  const isEaten = (c: PCard): boolean => myEaten.some((e) => e.r === c.r && e.s === c.s);

  function start(lv: number): void {
    level = lv; token++; clearBanner(banner); renderLevelBar(levelBar, id, level, start);
    deck = pDeck(); humanFirst = Math.random() < 0.5; sel = -1; top = null; turn = 0;
    const first = deck.splice(0, 10), second = deck.splice(0, 9);
    hand = pSort(humanFirst ? first : second); foe = humanFirst ? second : first;
    myDisc = []; foeDisc = []; myEaten = []; foeEaten = []; msg.textContent = '';
    next();
  }
  /** Chuyển sang lượt turn */
  function next(): void {
    if (turn >= TURNS) { finish(); return; }
    if (humanTurn(turn)) {
      phase = turn === 0 ? 'discard' : 'draw'; sel = -1; render();
    } else { phase = 'foe'; render(); foeTurn(); }
  }
  function foeTurn(): void {
    const tk = token;
    window.setTimeout(() => {
      if (tk !== token) return;
      if (turn > 0) {
        if (top && pAiEat(foe, top, level)) { foe.push(top); foeEaten.push(top); myDisc.pop(); msg.textContent = A('pmFoeAte', 'Máy đã ăn lá của bạn.'); }
        else foe.push(deck.pop() as PCard);
      }
      top = null;
      const i = pAiDiscard(foe, level, myEaten, foeEaten);
      const c = foe.splice(i, 1)[0];
      foeDisc.push(c); top = c; sfx('move');
      if (pIsU(foe)) { end('lose', A('pmFoeU', 'Máy ù rồi!')); return; }
      turn++; next();
    }, 800);
  }
  function render(): void {
    const plan = pBest(hand);
    const inMeld = (c: PCard) => plan.melds.some((m) => { const i = hand.indexOf(c); return i >= 0 && (m & (1 << i)) !== 0; });
    statusEl.textContent = `${Af('pmTurn', 'Lượt {a}/{b}', { a: Math.min(turn + 1, TURNS), b: TURNS })} · ${Af('pmLeft', 'Bài rác: {n}', { n: plan.left })} · ${Af('pmDeck', 'Chồng: {n}', { n: deck.length })}`;
    const row = (lbl: string, cards: PCard[], extra = (_c: PCard) => ''): string => `<div class="mb-row"><span class="cz-lbl">${lbl}</span><div class="cz-hand mb-hand">${cards.length ? cards.map((c) => face(toCard(c), extra(c))).join('') : '<div class="cd slot rel"></div>'}</div></div>`;
    let html = `<div class="mb-row"><span class="cz-lbl">${Ah('pmFoeHand', 'Bài của máy')} (${foe.length})</span><div class="cz-hand mb-hand">${foe.map(() => back()).join('')}</div></div>`;
    html += row(A('pmFoeDisc', 'Máy đã đánh'), foeDisc, (c) => (top === c && phase === 'draw' ? 'hint' : ''));
    if (foeEaten.length) html += row(A('pmFoeEaten', 'Máy đã ăn'), foeEaten);
    html += row(A('pmMyDisc', 'Bạn đã đánh'), myDisc);
    const order = hand.map((c, i) => ({ c, i })).sort((a, b) => Number(inMeld(b.c)) - Number(inMeld(a.c)));
    html += `<div class="mb-row mb-pool"><span class="cz-lbl">${Ah('mbHand', 'Bài trên tay')}</span><div class="cz-hand mb-hand">${order.map(({ c, i }) => face(toCard(c), `${i === sel ? 'sel ' : ''}${inMeld(c) ? 'pm-in ' : ''}${isEaten(c) ? 'pm-eaten' : ''}`, `data-i="${i}"`)).join('')}</div></div>`;
    boardEl.innerHTML = html;
    bDraw.disabled = phase !== 'draw' || deck.length === 0;
    bEat.disabled = phase !== 'draw' || !top || !pCanEat(hand, top);
    bThrow.disabled = phase !== 'discard' || sel < 0;
  }
  boardEl.addEventListener('click', (e) => {
    if (phase !== 'discard') return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
    if (!el) return;
    const i = Number(el.dataset.i);
    sel = sel === i ? -1 : i; sfx('select'); render();
  });
  bDraw.addEventListener('click', () => {
    if (phase !== 'draw') return;
    hand = pSort([...hand, deck.pop() as PCard].filter(Boolean)); // giữ cờ ăn theo lá
    top = null; phase = 'discard'; sel = -1; msg.textContent = ''; sfx('tap'); render();
  });
  bEat.addEventListener('click', () => {
    if (phase !== 'draw' || !top || !pCanEat(hand, top)) return;
    const c = top; foeDisc.pop(); myEaten.push(c); hand = pSort([...hand, c]);
    top = null; phase = 'discard'; sel = -1; msg.textContent = A('pmAte', 'Bạn đã ăn lá này, hãy giữ nó trong phỏm.'); sfx('coin'); render();
  });
  bThrow.addEventListener('click', () => {
    if (phase !== 'discard' || sel < 0) return;
    const c = hand[sel];
    if (isEaten(c)) { msg.textContent = A('pmKeep', 'Lá đã ăn phải giữ lại, hãy đánh lá khác.'); return; }
    hand.splice(sel, 1); myDisc.push(c); top = c; sel = -1; msg.textContent = ''; sfx('move');
    if (pIsU(hand)) { end('win', A('pmU', 'Ù! Bạn thắng ngay.')); return; }
    turn++; next();
  });
  function finish(): void {
    const mine = pBest(hand).left, theirs = pBest(foe).left;
    phase = 'end';
    const txt = `${A('pmYou', 'Bạn')}: ${mine} · ${A('pmFoe', 'Máy')}: ${theirs}`;
    if (mine < theirs) end('win', `${tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level })} ${txt}`);
    else if (mine > theirs) end('lose', `${tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level })} ${txt}`);
    else end('draw', `${A('pmDraw2', 'Hoà điểm.')} ${txt}`);
  }
  function end(kind: 'win' | 'lose' | 'draw', text: string): void {
    phase = 'end'; token++;
    showBanner(banner, kind, id, level, text, start, () => start(level));
    renderLevelBar(levelBar, id, level, start);
    // lộ bài máy
    foeDisc.length; boardEl.querySelectorAll('.cd.down').forEach((n) => n.remove());
    const h = boardEl.firstElementChild?.querySelector('.cz-hand');
    if (h) h.innerHTML = foe.map((c) => face(toCard(c))).join('');
    bDraw.disabled = true; bEat.disabled = true; bThrow.disabled = true;
  }
  $('#pm-new').addEventListener('click', () => start(level));
  void pVal;
  fullscreenButton();
  start(level);
}
