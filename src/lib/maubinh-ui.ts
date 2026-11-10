/** Giao diện Mậu binh: xếp 13 lá thành 3 chi (5-5-3) đấu với máy, 5 ván mỗi cấp. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { compare, mbAi, mbBest, mbDeal, scoreArr, type Arr } from '../calc/maubinh';
import { handCat, type HCard } from '../calc/holdem';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah } from './arcade-ui';
import { face } from './casino-ui';
import { sfx } from './sfx';
import type { Card } from '../calc/solitaire';

const ROUNDS = 5;
const toCard = (c: HCard, i: number): Card => ({ r: c.r === 14 ? 1 : c.r, s: c.s, up: true, id: i });
const NAMES = ['mbHigh', 'mbPair', 'mbTwoPair', 'mbTrips', 'mbStraight', 'mbFlush', 'mbFull', 'mbQuads', 'mbSflush'];
const NAMES_VI = ['Mậu thầu', 'Đôi', 'Thú (hai đôi)', 'Sám cô', 'Sảnh', 'Thùng', 'Cù lũ', 'Tứ quý', 'Thùng phá sảnh'];
const hname = (cat: number): string => A(NAMES[cat], NAMES_VI[cat]);
const cname = (cat: number, three: boolean): string => (three ? (cat === 3 ? hname(3) : cat === 1 ? hname(1) : hname(0)) : hname(cat));

export function mountMauBinh(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="mb-status"></b><span id="mb-score"></span></div>
        <div class="sol-board gboard cz-board mb-board" id="mb-board" style="--cw:54px"></div>
      </div>
      <div class="game-side">
        <div class="row">
          <button type="button" class="btn btn-primary" id="mb-ok" disabled>${Ah('mbConfirm', 'So bài')}</button>
          <button type="button" class="btn" id="mb-auto">${escapeHtml(t('lib.game.hint', 'Gợi ý'))}</button>
          <button type="button" class="btn" id="mb-reset">${Ah('mbReset', 'Xếp lại')}</button>
        </div>
        <div class="row"><button type="button" class="btn" id="mb-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button></div>
        <p class="note" id="mb-msg" aria-live="polite"></p>
        <p class="note">${Ah('note.maubinh', 'Bạn và máy mỗi bên nhận 13 lá, xếp thành 3 chi: chi cuối 5 lá, chi giữa 5 lá, chi đầu 3 lá. Chi cuối phải mạnh hơn hoặc bằng chi giữa, chi giữa mạnh hơn hoặc bằng chi đầu, nếu không là "binh lủng" và thua cả ván. Bấm một lá rồi bấm hàng muốn đặt (bấm lá đã đặt để lấy lại). Mỗi chi thắng được 1 điểm, thắng cả 3 chi được 6 điểm. Chơi 5 ván, tổng điểm dương là qua cấp. Chi đầu chỉ có mậu thầu, đôi hoặc sám cô.')}</p>
      </div>
    </div>`);
  const boardEl = $('#mb-board'), statusEl = $('#mb-status'), scoreEl = $('#mb-score'), msg = $('#mb-msg');
  const okBtn = $('#mb-ok') as HTMLButtonElement;
  let level = progressOf(id).unlocked;
  let hand: HCard[] = [], foe: HCard[] = [];
  // rows[0]=chi cuối, [1]=chi giữa, [2]=chi đầu: chỉ số lá trong hand
  let rows: number[][] = [[], [], []];
  let sel = -1, round = 0, total = 0, shown: { mine: Arr; foe: Arr; pts: number; chi: number[]; foulA: boolean; foulB: boolean } | null = null, over = false;
  const CAP = [5, 5, 3];

  function start(lv: number): void {
    level = lv; round = 0; total = 0; over = false; clearBanner(banner); renderLevelBar(levelBar, id, level, start); deal();
  }
  function deal(): void {
    [hand, foe] = mbDeal(); rows = [[], [], []]; sel = -1; shown = null; msg.textContent = ''; render();
  }
  const arrOf = (): Arr => ({ back: rows[0].map((i) => hand[i]), mid: rows[1].map((i) => hand[i]), front: rows[2].map((i) => hand[i]) });
  const pool = (): number[] => hand.map((_, i) => i).filter((i) => !rows.some((r) => r.includes(i)));
  const rowName = ['mbBack', 'mbMid', 'mbFront'], rowVi = ['Chi cuối', 'Chi giữa', 'Chi đầu'];

  function rowHtml(name: string, cards: Card[], extra: string, attrs: string): string {
    return `<div class="mb-row" ${attrs}><span class="cz-lbl">${name}${extra}</span><div class="cz-hand mb-hand">${cards.length ? cards.map((c) => c).map((c, k) => face(c, '', `data-ci="${k}"`)).join('') : '<div class="cd slot rel"></div>'}</div></div>`;
  }
  function render(): void {
    statusEl.textContent = Af('mbRound', 'Ván {a}/{b}', { a: Math.min(round + 1, ROUNDS), b: ROUNDS });
    scoreEl.textContent = ` · ${Af('mbTotal', 'Tổng điểm: {n}', { n: total })}`;
    let html = '';
    if (shown) {
      const lbl = [0, 1, 2];
      const sm = scoreArr(shown.mine), sf = scoreArr(shown.foe);
      const mk = (arr: Arr, s: typeof sm, who: string): string => `<div class="mb-side"><b class="cz-lbl">${who}</b>${lbl.map((k) => {
        const cs = k === 0 ? arr.back : k === 1 ? arr.mid : arr.front;
        const cat = handCat(k === 0 ? s.back : k === 1 ? s.mid : s.front);
        return `<div class="mb-row"><span class="cz-lbl">${A(rowName[k], rowVi[k])} · ${cname(cat, k === 2)}</span><div class="cz-hand">${cs.map((c, i) => face(toCard(c, i))).join('')}</div></div>`;
      }).join('')}</div>`;
      html += mk(shown.foe, sf, A('mbFoe', 'Máy')) + mk(shown.mine, sm, A('mbYou', 'Bạn'));
      html += `<p class="cz-result ${shown.pts > 0 ? 'win' : ''}">${shown.pts > 0 ? '+' : ''}${shown.pts}${shown.foulA ? ' · ' + A('mbFoul', 'Binh lủng!') : ''}${shown.foulB ? ' · ' + A('mbFoeFoul', 'Máy binh lủng!') : ''}</p>`;
    } else {
      const arr = arrOf();
      for (let k = 0; k < 3; k++) {
        const cs = rows[k].map((i) => ({ c: hand[i], i }));
        const complete = cs.length === CAP[k];
        const s = complete ? (k === 2 ? cname(handCat(scoreArr(arr).front), true) : cname(handCat(k === 0 ? scoreArr(arr).back : scoreArr(arr).mid), false)) : '';
        html += `<div class="mb-row mb-slot" data-row="${k}"><span class="cz-lbl">${A(rowName[k], rowVi[k])} (${cs.length}/${CAP[k]})${s ? ' · ' + s : ''}</span><div class="cz-hand mb-hand">${cs.length ? cs.map((x) => face(toCard(x.c, x.i), '', `data-placed="${x.i}"`)).join('') : '<div class="cd slot rel"></div>'}</div></div>`;
      }
      html += `<div class="mb-row mb-pool"><span class="cz-lbl">${Ah('mbHand', 'Bài trên tay')}</span><div class="cz-hand mb-hand">${pool().map((i) => face(toCard(hand[i], i), i === sel ? 'sel' : '', `data-pool="${i}"`)).join('')}</div></div>`;
    }
    boardEl.innerHTML = html;
    okBtn.disabled = over || (!shown && pool().length > 0);
    okBtn.textContent = shown ? (round >= ROUNDS ? A('mbFinish', 'Xong') : A('mbNext', 'Ván tiếp')) : A('mbConfirm', 'So bài');
  }
  boardEl.addEventListener('click', (e) => {
    if (over || shown) return;
    const el = e.target as HTMLElement;
    const p = el.closest<HTMLElement>('[data-pool]');
    if (p) { sel = sel === Number(p.dataset.pool) ? -1 : Number(p.dataset.pool); sfx('select'); render(); return; }
    const pl = el.closest<HTMLElement>('[data-placed]');
    if (pl) { const i = Number(pl.dataset.placed); rows = rows.map((r) => r.filter((x) => x !== i)); sel = -1; sfx('tap'); render(); return; }
    const row = el.closest<HTMLElement>('[data-row]');
    if (row && sel >= 0) {
      const k = Number(row.dataset.row);
      if (rows[k].length < CAP[k]) { rows[k].push(sel); sel = -1; sfx('move'); render(); }
    }
  });
  okBtn.addEventListener('click', () => {
    if (over) return;
    if (shown) {
      if (round >= ROUNDS) { finish(); return; }
      deal(); return;
    }
    const mine = arrOf(), f = mbAi(foe, level);
    const r = compare(mine, f);
    shown = { mine, foe: f, pts: r.pts, chi: r.chi, foulA: r.foulA, foulB: r.foulB };
    total += r.pts; round++; sfx(r.pts > 0 ? 'coin' : 'tap');
    render();
  });
  function finish(): void {
    over = true;
    if (total > 0) showBanner(banner, 'win', id, level, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), start, () => start(level));
    else if (total < 0) showBanner(banner, 'lose', id, level, tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), start, () => start(level));
    else showBanner(banner, 'draw', id, level, A('mbDraw', 'Hoà điểm — chơi lại nhé.'), start, () => start(level));
    renderLevelBar(levelBar, id, level, start);
    render();
  }
  $('#mb-auto').addEventListener('click', () => {
    if (over || shown) return;
    const b = mbBest(hand);
    const idx = (c: HCard) => hand.findIndex((h) => h.r === c.r && h.s === c.s);
    rows = [b.back.map(idx), b.mid.map(idx), b.front.map(idx)]; sel = -1;
    msg.textContent = A('mbAutoMsg', 'Đây là cách xếp gợi ý. Bạn có thể đổi lại trước khi so bài.');
    render();
  });
  $('#mb-reset').addEventListener('click', () => { if (over || shown) return; rows = [[], [], []]; sel = -1; msg.textContent = ''; render(); });
  $('#mb-new').addEventListener('click', () => start(level));
  void rowHtml;
  fullscreenButton();
  start(level);
}
