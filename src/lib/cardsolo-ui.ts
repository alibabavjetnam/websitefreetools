/** Giao diện ba trò bài một người: Kim tự tháp (Pyramid), Ba đỉnh (TriPeaks), Golf. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { RANK, SUIT, isRed, type Card } from '../calc/solitaire';
import {
  GOLF_COLS, chainCanPlay, chainDraw, chainHint, chainPlay, chainStuck, chainWon, dealChain, dealPyramid, pyrCanDraw, pyrCanRemove,
  pyrDraw, pyrHint, pyrOpen, pyrRemove, pyrStuck, pyrWon, type Chain, type ChainKind, type PyrRef, type Pyramid,
} from '../calc/cardsolo';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah } from './arcade-ui';

type Kind = 'pyramid' | ChainKind;
const NOTE: Record<Kind, string> = {
  pyramid: 'Gỡ hết 28 lá của kim tự tháp. Bấm hai lá tự do (không bị lá nào che) có tổng bằng 13 (A=1, J=11, Q=12) để gỡ cả hai; lá K gỡ riêng bằng một lần bấm. Lá trên cùng chồng bỏ cũng dùng được. Bấm chồng bài để rút; số lần lật lại chồng bỏ có hạn.',
  tripeaks: 'Gỡ hết 28 lá của ba đỉnh. Bấm lá tự do hơn hoặc kém lá đang lộ ở chồng bỏ đúng 1 bậc (không phân biệt chất) để chuyển nó xuống. Hết nước thì bấm chồng bài để rút. Ở các cấp dễ, K nối được với A.',
  golf: 'Gỡ hết các cột bài. Chỉ lá dưới cùng mỗi cột được bấm: nó phải hơn hoặc kém lá đang lộ đúng 1 bậc. Hết nước thì bấm chồng bài để rút. Ở các cấp dễ, K nối được với A.',
};

const cardEl = (c: Card, attrs: string, x: number, y: number, cls = ''): string => {
  const s = SUIT[c.s], r = RANK[c.r];
  return `<div class="cd up${isRed(c) ? ' red' : ''}${cls ? ' ' + cls : ''}" ${attrs} style="left:${Math.round(x)}px;top:${Math.round(y)}px" role="img" aria-label="${r}${s}"><span class="ci">${r}<i>${s}</i></span><span class="cb">${s}</span></div>`;
};
const slot = (x: number, y: number, attrs = '', label = ''): string => `<div class="cd slot" ${attrs} style="left:${Math.round(x)}px;top:${Math.round(y)}px">${label}</div>`;

export function mountCardSolo(id: string, kind: Kind): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><span id="cs-info"></span></div>
        <div class="sol-board gboard cs-board" id="cs-board"><div class="cs-field" id="cs-field"></div></div>
      </div>
      <div class="game-side">
        <div class="row">
          <button type="button" class="btn" id="cs-undo">${escapeHtml(t('lib.game.undo', 'Đi lại'))}</button>
          <button type="button" class="btn" id="cs-hint">${escapeHtml(t('lib.game.hint', 'Gợi ý'))}</button>
          <button type="button" class="btn" id="cs-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>
        </div>
        <p class="note" id="cs-msg" aria-live="polite"></p>
        <p class="note">${Ah('note.' + kind, NOTE[kind])}</p>
      </div>
    </div>`);
  const boardEl = $('#cs-board'), field = $('#cs-field'), info = $('#cs-info'), msg = $('#cs-msg');
  let level = progressOf(id).unlocked;
  let pyr: Pyramid | null = null;
  let chain: Chain | null = null;
  let hist: string[] = [];
  let sel: PyrRef | null = null;
  let hintIds: Set<string> = new Set();
  let over = false;

  function start(lv: number): void {
    level = lv; over = false; sel = null; hist = []; hintIds = new Set(); msg.textContent = '';
    if (kind === 'pyramid') pyr = dealPyramid(level); else chain = dealChain(kind, level);
    clearBanner(banner);
    renderLevelBar(levelBar, id, level, start);
    render();
  }
  const push = (): void => { hist.push(JSON.stringify(kind === 'pyramid' ? pyr : chain)); if (hist.length > 200) hist.shift(); };

  function render(): void {
    const W = Math.max(280, boardEl.clientWidth - 20);
    const cols = kind === 'pyramid' ? 7 * 1.12 : kind === 'tripeaks' ? 10.3 : Math.max(5, GOLF_COLS[level - 1]) * 1.15 + 0.2;
    const cw = Math.max(34, Math.min(86, Math.floor(W / cols)));
    boardEl.style.setProperty('--cw', `${cw}px`);
    const ch = cw * 1.4;
    let html = '', h = 0, w = Math.round(cols * cw);
    const key = (r: number, c: number): string => `${r},${c}`;
    if (kind === 'pyramid' && pyr) {
      const gap = cw * 1.12, dy = ch * 0.5;
      const total = 7 * gap;
      pyr.rows.forEach((row, r) => row.forEach((c, k) => {
        if (!c) return;
        const x = (total - (r + 1) * gap) / 2 + k * gap, y = r * dy;
        const open = pyrOpen(pyr as Pyramid).some((p) => p.kind === 'pyr' && p.r === r && p.c === k);
        const isSel = sel?.kind === 'pyr' && sel.r === r && sel.c === k;
        html += cardEl(c, `data-r="${r}" data-c="${k}"`, x, y, `${open ? 'free' : 'blocked'}${isSel ? ' sel' : ''}${hintIds.has(key(r, k)) ? ' hint' : ''}`);
      }));
      const by = 6 * dy + ch + cw * 0.35;
      html += pyr.stock.length ? `<div class="cd down" data-act="draw" style="left:0;top:${Math.round(by)}px"></div>` : slot(0, by, 'data-act="draw"', pyr.recycles > 0 && pyr.waste.length ? '↻' : '');
      const top = pyr.waste[pyr.waste.length - 1];
      html += top ? cardEl(top, 'data-waste="1"', cw * 1.2, by, `${sel?.kind === 'waste' ? 'sel' : ''}${hintIds.has('w') ? ' hint' : ''}`) : slot(cw * 1.2, by);
      h = by + ch;
      info.textContent = Af('recycles', 'Lật lại: {n}', { n: pyr.recycles }) + ' · ' + Af('stockLeft', 'Chồng bài: {n}', { n: pyr.stock.length });
    } else if (chain) {
      const g = chain;
      if (kind === 'tripeaks') {
        const sx = cw / 2, dy = ch * 0.5;
        g.cards.forEach((c, i) => {
          if (c.gone) return;
          const free = !c.cover.some((j) => !g.cards[j].gone);
          html += cardEl(c.card, `data-i="${i}"`, c.x * sx, c.y * dy, `${free ? 'free' : 'blocked'}${hintIds.has(String(i)) ? ' hint' : ''}`);
        });
        h = 3 * dy + ch;
      } else {
        const gap = cw * 1.15, dy = ch * 0.3, colsN = GOLF_COLS[level - 1];
        g.cards.forEach((c, i) => {
          if (c.gone) return;
          const free = !c.cover.some((j) => !g.cards[j].gone);
          html += cardEl(c.card, `data-i="${i}"`, c.x * gap + (w - colsN * gap) / 2, c.y * dy, `${free ? 'free' : 'blocked'}${hintIds.has(String(i)) ? ' hint' : ''}`);
        });
        h = 4 * dy + ch;
      }
      const by = h + cw * 0.35;
      const sx0 = Math.max(0, (w - cw * 2.4) / 2);
      html += g.stock.length ? `<div class="cd down" data-act="draw" style="left:${Math.round(sx0)}px;top:${Math.round(by)}px"></div>` : slot(sx0, by);
      const top = g.waste[g.waste.length - 1];
      html += top ? cardEl(top, '', sx0 + cw * 1.4, by) : '';
      h = by + ch;
      info.textContent = Af('stockLeft', 'Chồng bài: {n}', { n: g.stock.length }) + ' · ' + (g.wrap ? A('wrapOn', 'K nối A') : A('wrapOff', 'K không nối A'));
    }
    field.style.width = `${w}px`; field.style.height = `${Math.round(h)}px`;
    field.innerHTML = html;
  }

  function check(): void {
    const won = kind === 'pyramid' ? !!pyr && pyrWon(pyr) : !!chain && chainWon(chain);
    const stuck = kind === 'pyramid' ? !!pyr && pyrStuck(pyr) : !!chain && chainStuck(chain);
    if (won) { over = true; showBanner(banner, 'win', id, level, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), start, () => start(level)); renderLevelBar(levelBar, id, level, start); }
    else if (stuck) { over = true; showBanner(banner, 'lose', id, level, tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), start, () => start(level)); }
  }

  function clickPyr(p: PyrRef): void {
    if (!pyr) return;
    hintIds = new Set(); msg.textContent = '';
    if (!sel) {
      if (pyrCanRemove(pyr, [p])) { push(); pyr = pyrRemove(pyr, [p]); }
      else sel = p;
    } else {
      const same = sel.kind === p.kind && (p.kind === 'waste' || (sel.kind === 'pyr' && sel.r === p.r && sel.c === p.c));
      if (same) sel = null;
      else if (pyrCanRemove(pyr, [sel, p])) { push(); pyr = pyrRemove(pyr, [sel, p]); sel = null; }
      else if (pyrCanRemove(pyr, [p])) { push(); pyr = pyrRemove(pyr, [p]); sel = null; }
      else sel = p;
    }
    render(); check();
  }

  field.addEventListener('click', (e) => {
    if (over) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('.cd');
    if (!el) return;
    if (el.dataset.act === 'draw') {
      hintIds = new Set(); sel = null; msg.textContent = '';
      if (pyr) { if (!pyrCanDraw(pyr)) return; push(); pyr = pyrDraw(pyr); }
      else if (chain && chain.stock.length) { push(); chain = chainDraw(chain); }
      render(); check(); return;
    }
    if (kind === 'pyramid') {
      if (el.dataset.waste) { clickPyr({ kind: 'waste' }); return; }
      if (el.dataset.r !== undefined && pyr) {
        const r = Number(el.dataset.r), c = Number(el.dataset.c);
        if (pyrOpen(pyr).some((p) => p.kind === 'pyr' && p.r === r && p.c === c)) clickPyr({ kind: 'pyr', r, c });
      }
    } else if (chain && el.dataset.i !== undefined) {
      const i = Number(el.dataset.i);
      if (chainCanPlay(chain, i)) { push(); hintIds = new Set(); chain = chainPlay(chain, i); render(); check(); }
    }
  });
  $('#cs-undo').addEventListener('click', () => {
    const s = hist.pop(); if (!s) return;
    over = false; sel = null; hintIds = new Set(); clearBanner(banner);
    if (kind === 'pyramid') pyr = JSON.parse(s); else chain = JSON.parse(s);
    render();
  });
  $('#cs-hint').addEventListener('click', () => {
    if (over) return;
    hintIds = new Set(); msg.textContent = '';
    if (kind === 'pyramid' && pyr) {
      const hnt = pyrHint(pyr);
      if (hnt) hnt.forEach((p) => hintIds.add(p.kind === 'waste' ? 'w' : `${p.r},${p.c}`));
      else msg.textContent = pyrCanDraw(pyr) ? A('hintDraw', 'Không còn cặp nào. Hãy bấm chồng bài để rút.') : A('noHint', 'Không còn nước đi có ích. Thử rút bài, chia thêm hoặc chơi lại.');
    } else if (chain) {
      const i = chainHint(chain);
      if (i >= 0) hintIds.add(String(i)); else msg.textContent = chain.stock.length ? A('hintDraw', 'Không còn cặp nào. Hãy bấm chồng bài để rút.') : A('noHint', 'Không còn nước đi có ích. Thử rút bài, chia thêm hoặc chơi lại.');
    }
    render();
  });
  $('#cs-new').addEventListener('click', () => start(level));
  new ResizeObserver(() => render()).observe(boardEl);
  fullscreenButton();
  start(level);
}
