/**
 * Giao diện ba trò xếp bài: Klondike, Spider, FreeCell.
 * Thao tác: bấm một lá (chọn cả chuỗi từ lá đó trở xuống) rồi bấm chồng đích; bấm lần nữa vào lá đang chọn để tự đưa đi chỗ hợp lệ.
 */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import {
  RANK, SUIT, autoFoundMove, dealYukon, yukonCanMove, yukonHint, dealFreeCell, dealKlondike, dealSpider, fcCanMove, fcMove, fcSafeAuto, fcWon, isRed, klondikeCanAuto,
  klondikeCanMove, klondikeDraw, klondikeHint, klondikeMove, klondikeWon, spiderCanDeal, spiderCanMove, spiderDeal, spiderHint, spiderMove,
  spiderWon, type Card, type FreeCell, type Klondike, type Move, type Pile, type Spider,
  freecellHint,
} from '../calc/solitaire';
import { clearBanner, fmtTime, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah, bestScore } from './arcade-ui';

type Variant = 'klondike' | 'spider' | 'freecell' | 'yukon';
const YK_EXTRA = [4, 3, 3, 2, 2, 1, 1, 0, 0, 0];
type State = Klondike | Spider | FreeCell;

const KL_DRAW = [1, 1, 1, 1, 1, 3, 3, 3, 3, 3];
const SP_SUITS: (1 | 2 | 4)[] = [1, 1, 1, 2, 2, 2, 2, 4, 4, 4];
const FC_CELLS = [4, 4, 4, 4, 4, 4, 3, 3, 2, 2];

function cardHtml(c: Card, attrs: string, top: number, sel: boolean): string {
  if (!c.up) return `<div class="cd down" ${attrs} style="top:${top}px"></div>`;
  const s = SUIT[c.s], r = RANK[c.r];
  return `<div class="cd up${isRed(c) ? ' red' : ''}${sel ? ' sel' : ''}" ${attrs} style="top:${top}px" role="img" aria-label="${r}${s}"><span class="ci">${r}<i>${s}</i></span><span class="cb">${s}</span></div>`;
}

export function mountSolitaire(id: string, variant: Variant): void {
  const noteKey = variant === 'yukon' ? 'note.yukon' : variant === 'klondike' ? 'note.klondike' : variant === 'spider' ? 'note.spider' : 'note.freecell';
  const noteVi = variant === 'yukon'
    ? 'Như Klondike nhưng không có chồng rút: mọi lá ngửa đều kéo được cùng các lá nằm dưới nó, kể cả khi chúng không thành dãy; chỉ cần lá đầu hợp với cột đích (giảm dần, xen đỏ đen; K vào cột trống). Đưa đủ 52 lá lên 4 ô đích từ A đến K. Cấp thấp có sẵn nhiều lá được lật ngửa.'
    : variant === 'klondike'
    ? 'Xếp hết 52 lá lên 4 ô đích theo từng chất, từ A đến K. Trên bàn, xếp giảm dần và xen kẽ đỏ đen; chỉ K mới đặt vào cột trống. Bấm chồng úp góc trái để rút bài. Bấm một lá rồi bấm chỗ muốn đặt, hoặc bấm lá đó lần nữa để tự đưa đến chỗ hợp lệ. Cấp 1–5 rút 1 lá, cấp 6–10 rút 3 lá.'
    : variant === 'spider'
      ? 'Xếp mỗi chất thành một dãy từ K xuống A trên bàn; dãy đủ 13 lá sẽ tự được gỡ đi. Lá nào cũng đặt được lên lá lớn hơn 1, nhưng chỉ dãy cùng chất mới kéo đi cùng nhau. Hết nước thì bấm Chia thêm bài (mọi cột phải có bài). Cấp 1–3 một chất, 4–7 hai chất, 8–10 bốn chất.'
      : 'Mọi lá đều ngửa. Đưa hết 52 lá lên 4 ô đích theo chất từ A đến K. Trên bàn xếp giảm dần, xen kẽ đỏ đen. Các ô trống ở góc trái giữ tạm mỗi ô một lá; số lá chuyển được một lần phụ thuộc số ô trống và cột trống. Cấp cao có ít ô trống hơn.';
  const { levelBar, banner } = gameShell(`
    <div class="game-main sol-main">
      <div class="game-board-col">
        <div class="game-status"><b id="so-status"></b><span id="so-time">0:00</span></div>
        <div class="sol-board gboard" id="so-board"></div>
      </div>
      <div class="game-side">
        <div class="row">
          <button type="button" class="btn" id="so-undo">${escapeHtml(t('lib.game.undo', 'Đi lại'))}</button>
          <button type="button" class="btn" id="so-hint">${escapeHtml(t('lib.game.hint', 'Gợi ý'))}</button>
          ${variant === 'spider' ? `<button type="button" class="btn" id="so-deal">${Ah('dealRow', 'Chia thêm bài')}</button>` : ''}
          ${variant === 'klondike' || variant === 'yukon' ? `<button type="button" class="btn" id="so-auto" hidden>${Ah('autoFinish', 'Tự đưa bài lên')}</button>` : ''}
          <button type="button" class="btn" id="so-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>
        </div>
        <p class="note" id="so-msg" aria-live="polite"></p>
        <p class="note">${Ah(noteKey, noteVi)}</p>
      </div>
    </div>`);
  const boardEl = $('#so-board');
  const msg = $('#so-msg');
  let level = progressOf(id).unlocked;
  let st: State;
  let hist: State[] = [];
  let sel: { pile: Pile; n: number } | null = null;
  let hintTo: Pile | null = null;
  let over = false, moves = 0;
  let t0 = 0, secs = 0, timer = 0;

  const deal = (): State => (variant === 'yukon' ? dealYukon(YK_EXTRA[level - 1]) : variant === 'klondike' ? dealKlondike(KL_DRAW[level - 1]) : variant === 'spider' ? dealSpider(SP_SUITS[level - 1]) : dealFreeCell(FC_CELLS[level - 1]));

  function start(lv: number): void {
    level = lv;
    st = deal(); hist = []; sel = null; over = false; moves = 0; secs = 0;
    window.clearInterval(timer); timer = 0;
    msg.textContent = '';
    clearBanner(banner);
    renderLevelBar(levelBar, id, level, start);
    render();
  }

  const tick = (): void => {
    if (timer || over) return;
    t0 = Date.now() - secs * 1000;
    timer = window.setInterval(() => { secs = Math.floor((Date.now() - t0) / 1000); $('#so-time').textContent = fmtTime(secs); }, 500);
  };

  function commit(next: State): void {
    hist.push(st); if (hist.length > 300) hist.shift();
    st = next; sel = null; moves++; msg.textContent = '';
    tick();
    if (variant === 'freecell') { let m: Move | null; while ((m = fcSafeAuto(st as FreeCell))) st = fcMove(st as FreeCell, m); }
    render();
    checkWin();
  }

  function checkWin(): void {
    const won = variant === 'klondike' || variant === 'yukon' ? klondikeWon(st as Klondike) : variant === 'spider' ? spiderWon(st as Spider) : fcWon(st as FreeCell);
    if (!won) return;
    over = true; window.clearInterval(timer); timer = 0;
    bestScore(id, level).put(100000 - secs);
    showBanner(banner, 'win', id, level, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), start, () => start(level));
    renderLevelBar(levelBar, id, level, start);
  }

  /* ----------------------------- vẽ bàn ----------------------------- */
  function render(): void {
    hintTo = null;
    const cols = variant === 'spider' ? 10 : variant === 'freecell' ? 8 : 7;
    const W = boardEl.clientWidth || 600;
    const gap = Math.max(4, Math.round(W * 0.012));
    const cw = Math.floor((W - gap * (cols - 1)) / cols);
    const ch = Math.round(cw * 1.4);
    boardEl.style.setProperty('--cw', `${cw}px`);
    boardEl.style.setProperty('--gap', `${gap}px`);
    const upOff = Math.round(ch * (variant === 'spider' ? 0.24 : 0.27)), downOff = Math.round(ch * 0.12);
    const isSel = (p: Pile, k: number, len: number): boolean => !!sel && sel.pile.kind === p.kind && sel.pile.i === p.i && k >= len - sel.n;
    const pileHtml = (p: Pile, cards: Card[], fan: boolean, extraCls = '', placeholder = ''): string => {
      let top = 0, h = ch;
      const inner = cards.map((c, k) => {
        const html = cardHtml(c, `data-p="${p.kind}:${p.i}" data-k="${k}"`, top, isSel(p, k, cards.length));
        if (fan) { h = top + ch; top += c.up ? upOff : downOff; }
        return html;
      }).join('');
      if (fan && cards.length) h = top - (cards[cards.length - 1].up ? upOff : downOff) + ch;
      return `<div class="pile ${extraCls}" data-p="${p.kind}:${p.i}" style="height:${fan ? Math.max(ch, h) : ch}px">${cards.length ? inner : placeholder}</div>`;
    };
    let top = '';
    const ph = (s: string) => `<span class="pile-ph">${s}</span>`;
    if (variant === 'yukon') {
      const g = st as Klondike;
      top = `<div></div><div></div><div></div>${g.found.map((f, i) => pileHtml({ kind: 'found', i }, f.slice(-1), false, 'found', ph(SUIT[i]))).join('')}`;
    } else if (variant === 'klondike') {
      const g = st as Klondike;
      const shown = g.waste.slice(-Math.min(g.waste.length, g.draw));
      const wasteHtml = `<div class="pile waste" data-p="waste:0" style="height:${ch}px">${shown.map((c, k) => cardHtml(c, k === shown.length - 1 ? 'data-p="waste:0" data-k="top"' : '', 0, k === shown.length - 1 && sel?.pile.kind === 'waste').replace('style="top:0px"', `style="top:0;left:${k * Math.round(cw * 0.22)}px"`)).join('')}</div>`;
      top = `<div class="pile stock" data-p="stock:0" style="height:${ch}px">${g.stock.length ? '<div class="cd down" data-p="stock:0" style="top:0"></div>' : ph('↻')}</div>${wasteHtml}<div></div>${g.found.map((f, i) => pileHtml({ kind: 'found', i }, f.slice(-1), false, 'found', ph(SUIT[i]))).join('')}`;
    } else if (variant === 'freecell') {
      const g = st as FreeCell;
      const cells = g.cells.map((c, i) => `<div class="pile cell" data-p="cell:${i}" style="height:${ch}px">${c ? cardHtml(c, `data-p="cell:${i}" data-k="0"`, 0, sel?.pile.kind === 'cell' && sel.pile.i === i) : ''}</div>`);
      while (cells.length < 4) cells.push('<div></div>');
      top = cells.join('') + g.found.map((f, i) => pileHtml({ kind: 'found', i }, f.slice(-1), false, 'found', ph(SUIT[i]))).join('');
    } else {
      const g = st as Spider;
      top = `<div class="pile stock" data-p="stock:0" style="height:${ch}px">${g.stock.length ? `<div class="cd down" data-p="stock:0" style="top:0"></div><b class="pile-n">${g.stock.length / 10}</b>` : ''}</div>`;
      for (let i = 1; i < 10; i++) top += i >= 2 && i - 2 < g.done ? `<div class="pile done"><div class="cd up" style="top:0"><span class="cb">${SUIT[0]}</span></div></div>` : '<div></div>';
    }
    const tab = (st as Klondike).tab.map((p, i) => pileHtml({ kind: 'tab', i }, p, true, 'tab', '')).join('');
    boardEl.innerHTML = `<div class="sol-row sol-top" style="grid-template-columns:repeat(${cols},${cw}px)">${top}</div><div class="sol-row" style="grid-template-columns:repeat(${cols},${cw}px)">${tab}</div>`;
    let status = '';
    if (variant === 'yukon') status = Af('yukonFree', 'Lá còn úp: {n}', { n: (st as Klondike).tab.reduce((a, p) => a + p.filter((c) => !c.up).length, 0) });
    else if (variant === 'klondike') status = Af('drawN', 'Rút {n} lá', { n: (st as Klondike).draw });
    else if (variant === 'spider') status = Af('suitsN', '{n} chất', { n: (st as Spider).suits });
    else status = Af('freeCells', 'Ô trống: {n}', { n: (st as FreeCell).cells.length });
    $('#so-status').textContent = `${status} · ${Af('moves', 'Nước đi: {n}', { n: moves })}`;
    $('#so-time').textContent = fmtTime(secs);
    const auto = document.getElementById('so-auto');
    if (auto) auto.hidden = !(klondikeCanAuto(st as Klondike) && !over);
    const dealBtn = document.getElementById('so-deal') as HTMLButtonElement | null;
    if (dealBtn) dealBtn.disabled = !spiderCanDeal(st as Spider);
  }

  /* ----------------------------- luật theo biến thể ----------------------------- */
  const parse = (s: string): Pile => { const [kind, i] = s.split(':'); return { kind: kind as Pile['kind'], i: Number(i) }; };
  function canMoveTo(from: Pile, n: number, to: Pile): boolean {
    if (variant === 'spider') return from.kind === 'tab' && to.kind === 'tab' && spiderCanMove(st as Spider, from.i, to.i, n);
    if (variant === 'yukon') return yukonCanMove(st as Klondike, { from, to, n });
    if (variant === 'klondike') return klondikeCanMove(st as Klondike, { from, to, n });
    return fcCanMove(st as FreeCell, { from, to, n });
  }
  function doMove(from: Pile, n: number, to: Pile): void {
    if (variant === 'spider') commit(spiderMove(st as Spider, from.i, to.i, n));
    else if (variant === 'klondike' || variant === 'yukon') commit(klondikeMove(st as Klondike, { from, to, n }));
    else commit(fcMove(st as FreeCell, { from, to, n }));
  }
  /** Tự tìm chỗ đặt: ưu tiên ô đích, rồi cột có bài, rồi ô trống/cột trống */
  function autoTarget(from: Pile, n: number): Pile | null {
    const g = st as Klondike & FreeCell;
    const cands: Pile[] = [];
    if (variant !== 'spider' && n === 1) for (let i = 0; i < 4; i++) cands.push({ kind: 'found', i });
    const tabs = g.tab.map((p, i) => ({ p, i })).filter((x) => !(from.kind === 'tab' && x.i === from.i));
    for (const x of tabs) if (x.p.length) cands.push({ kind: 'tab', i: x.i });
    for (const x of tabs) if (!x.p.length) cands.push({ kind: 'tab', i: x.i });
    if (variant === 'freecell' && n === 1 && from.kind !== 'cell') g.cells.forEach((c, i) => { if (!c) cands.push({ kind: 'cell', i }); });
    if (variant === 'spider') {
      const src = (st as Spider).tab[from.i];
      const moving = src[src.length - n];
      const same = cands.find((p) => { const top = (st as Spider).tab[p.i].slice(-1)[0]; return top && top.s === moving.s && spiderCanMove(st as Spider, from.i, p.i, n); });
      if (same) return same;
    }
    return cands.find((p) => canMoveTo(from, n, p)) ?? null;
  }

  boardEl.addEventListener('click', (e) => {
    if (over) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-p]');
    if (!el) { sel = null; render(); return; }
    const pile = parse(el.dataset.p as string);
    if (pile.kind === 'stock') {
      if (variant === 'klondike') commit(klondikeDraw(st as Klondike));
      else if (variant === 'spider' && spiderCanDeal(st as Spider)) commit(spiderDeal(st as Spider));
      return;
    }
    const k = el.dataset.k;
    // Có lá đang chọn và bấm vào chồng khác: thử chuyển
    if (sel && !(sel.pile.kind === pile.kind && sel.pile.i === pile.i)) {
      if (canMoveTo(sel.pile, sel.n, pile)) { doMove(sel.pile, sel.n, pile); return; }
      sel = null;
    } else if (sel && sel.pile.kind === pile.kind && sel.pile.i === pile.i) {
      // bấm lại cùng chồng: tự đưa đi
      const to = hintTo && canMoveTo(sel.pile, sel.n, hintTo) ? hintTo : autoTarget(sel.pile, sel.n);
      if (to) { doMove(sel.pile, sel.n, to); return; }
      sel = null; render(); return;
    }
    if (k === undefined || pile.kind === 'found' && variant === 'spider') { render(); return; }
    let n = 1;
    if (pile.kind === 'tab') {
      const cards = (st as Klondike).tab[pile.i];
      const idx = Number(k);
      if (!cards[idx]?.up) { render(); return; }
      n = cards.length - idx;
    }
    sel = { pile, n };
    render();
  });
  $('#so-undo').addEventListener('click', () => {
    if (!hist.length || over) return;
    st = hist.pop() as State; sel = null; moves = Math.max(0, moves - 1);
    render();
  });
  $('#so-hint').addEventListener('click', () => {
    if (over) return;
    let h: { from: Pile; n: number; to?: Pile } | null = null;
    if (variant === 'yukon') { const m = yukonHint(st as Klondike); if (m) h = { from: m.from, n: m.n, to: m.to }; }
    else if (variant === 'klondike') { const m = klondikeHint(st as Klondike); if (m) h = { from: m.from, n: m.n, to: m.to }; }
    else if (variant === 'spider') { const m = spiderHint(st as Spider); if (m) h = { from: { kind: 'tab', i: m.from }, n: m.n, to: { kind: 'tab', i: m.to } }; }
    else { const m = freecellHint(st as FreeCell); if (m) h = { from: m.from, n: m.n, to: m.to }; }
    if (h) { sel = { pile: h.from, n: h.n }; render(); hintTo = h.to ?? null; msg.textContent = ''; }
    else msg.textContent = variant === 'freecell' ? A('noHintFc', 'Không còn nước đi có ích. Thử đi lại vài nước hoặc chơi lại.') : A('noHint', 'Không còn nước đi có ích. Thử rút bài, chia thêm hoặc chơi lại.');
  });
  document.getElementById('so-deal')?.addEventListener('click', () => { if (!over && spiderCanDeal(st as Spider)) commit(spiderDeal(st as Spider)); });
  document.getElementById('so-auto')?.addEventListener('click', () => {
    let m: Move | null;
    let g = st as Klondike;
    hist.push(st);
    while ((m = autoFoundMove(g))) { g = klondikeMove(g, m); moves++; }
    st = g; render(); checkWin();
  });
  $('#so-new').addEventListener('click', () => start(level));
  let rw = 0;
  new ResizeObserver(() => { const w = boardEl.clientWidth; if (w && Math.abs(w - rw) > 2) { rw = w; render(); } }).observe(boardEl);
  fullscreenButton();
  start(level);
}
