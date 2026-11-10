/** Giao diện Kakuro và KenKen (10 cấp). Lõi ở calc/numpuz.ts. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Ah } from './arcade-ui';
import { sfx } from './sfx';
import { cageOk, dupCells, kakuroBad, kakuroNew, kakuroSolved, kenkenNew, kenkenSolved, type Kakuro, type KenKen } from '../calc/numpuz';

type Kind = 'kakuro' | 'kenken';
const OP: Record<string, string> = { '=': '', '+': '+', '-': '−', x: '×', '/': '÷' };

function mount(kind: Kind, id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="np-info"></b><span id="np-left"></span></div>
        <div class="np-grid gboard" id="np-grid" role="grid"></div>
      </div>
      <div class="game-side">
        <div class="sd-pad" id="np-pad"></div>
        <div class="row">
          <button type="button" class="btn btn-sm" id="np-erase">${escapeHtml(t('lib.game.erase', 'Xoá ô'))}</button>
          <button type="button" class="btn btn-sm" id="np-hint">${escapeHtml(t('lib.game.hint', 'Gợi ý'))}</button>
          <button type="button" class="btn btn-sm" id="np-check">${escapeHtml(t('lib.game.check', 'Kiểm tra'))}</button>
          <button type="button" class="btn btn-sm" id="np-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>
        </div>
        <p class="note" id="np-msg" aria-live="polite"></p>
        <p class="note">${kind === 'kakuro'
    ? Ah('note.kakuro', 'Điền số 1–9 vào các ô trắng sao cho tổng mỗi dãy bằng số gợi ý ở ô đen (số trên góc phải là dãy ngang, số góc trái dưới là dãy dọc) và không số nào lặp lại trong cùng một dãy. Dùng phím mũi tên để di chuyển.')
    : Ah('note.kenken', 'Điền số 1 đến N vào lưới sao cho mỗi hàng và mỗi cột không lặp số. Mỗi khung viền đậm có một số mục tiêu và phép tính (+, −, ×, ÷): các số trong khung phải cho ra kết quả đó. Dùng phím mũi tên để di chuyển.')}</p>
      </div>
    </div>`);
  const gridEl = $('#np-grid'), msg = $('#np-msg'), pad = $('#np-pad');
  let level = progressOf(id).unlocked, g: number[] = [], sel = -1, over = false, show = false;
  let K: Kakuro | null = null, Q: KenKen | null = null, hinted = new Set<number>();
  const N = (): number => (K ? K.n : Q!.n);
  const maxDigit = (): number => (kind === 'kakuro' ? 9 : Q ? Q.n : 9);

  function buildPad(): void { pad.innerHTML = Array.from({ length: maxDigit() }, (_, i) => `<button type="button" class="btn" data-v="${i + 1}">${i + 1}</button>`).join(''); (pad as HTMLElement).style.setProperty('--n', String(Math.min(9, maxDigit()))); }
  function start(lv: number): void {
    level = lv; clearBanner(banner); renderLevelBar(levelBar, id, level, start);
    over = false; sel = -1; show = false; hinted = new Set(); msg.textContent = '';
    if (kind === 'kakuro') { K = kakuroNew(level); Q = null; g = new Array(K.n * K.n).fill(0); }
    else { Q = kenkenNew(level); K = null; g = new Array(Q.n * Q.n).fill(0); }
    buildPad(); render();
  }
  function bad(): Set<number> {
    if (K) return kakuroBad(K, g);
    const b = dupCells(g, Q!.n);
    for (const cg of Q!.cages) if (cg.cells.every((c) => g[c]) && !cageOk(g, cg)) cg.cells.forEach((c) => b.add(c));
    return b;
  }
  function render(): void {
    const n = N(), wrong = show ? bad() : new Set<number>();
    gridEl.style.setProperty('--n', String(n));
    let h = '';
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n), c = i % n;
      if (K && !K.white[i]) {
        const rs = K.right[i], ds = K.down[i];
        h += `<div class="np-cell np-clue">${rs || ds ? `<i class="np-r">${rs || ''}</i><i class="np-d">${ds || ''}</i>` : ''}</div>`;
        continue;
      }
      const cls = ['np-cell']; if (i === sel) cls.push('sel'); if (wrong.has(i)) cls.push('bad'); if (hinted.has(i)) cls.push('hint');
      let tag = '';
      if (Q) {
        const cg = Q.cageOf[i], cages = Q.cages[cg];
        if (c === 0 || Q.cageOf[i - 1] !== cg) cls.push('cl');
        if (c === n - 1 || Q.cageOf[i + 1] !== cg) cls.push('cr');
        if (r === 0 || Q.cageOf[i - n] !== cg) cls.push('ct');
        if (r === n - 1 || Q.cageOf[i + n] !== cg) cls.push('cb');
        if (Math.min(...cages.cells) === i) tag = `<i class="np-tag">${cages.target}${OP[cages.op]}</i>`;
      }
      h += `<button type="button" class="${cls.join(' ')}" data-i="${i}" role="gridcell">${tag}<b>${g[i] || ''}</b></button>`;
    }
    gridEl.innerHTML = h;
    $('#np-info').textContent = tf('lib.game.level', 'Cấp {n}', { n: level });
    $('#np-left').textContent = tf('lib.arcade.cellsLeft', 'Còn {n} ô trống', { n: g.filter((v, i) => !v && (!K || K.white[i])).length });
  }
  function put(v: number): void {
    if (over || sel < 0) return;
    if (v > maxDigit()) return;
    g[sel] = v; hinted.delete(sel); sfx(v ? 'place' : 'tap'); show = false; msg.textContent = '';
    const done = K ? kakuroSolved(K, g) : kenkenSolved(Q!, g);
    render();
    if (done) { over = true; showBanner(banner, 'win', id, level, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), start, () => start(level)); renderLevelBar(levelBar, id, level, start); }
  }
  gridEl.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-i]'); if (b) { sel = Number(b.dataset.i); render(); } });
  pad.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-v]'); if (b) put(Number(b.dataset.v)); });
  $('#np-erase').addEventListener('click', () => put(0));
  $('#np-new').addEventListener('click', () => start(level));
  $('#np-check').addEventListener('click', () => { show = true; const b = bad(); render(); msg.textContent = b.size ? tf('lib.arcade.wrongN', '{n} ô chưa đúng.', { n: b.size }) : t('lib.arcade.noError', 'Chưa phát hiện lỗi.'); if (b.size) sfx('error'); });
  $('#np-hint').addEventListener('click', () => {
    if (over) return;
    const sol = K ? K.sol : Q!.sol;
    let i = sel >= 0 && g[sel] !== sol[sel] && (!K || K.white[sel]) ? sel : -1;
    if (i < 0) i = g.findIndex((v, j) => (!K || K.white[j]) && v !== sol[j]);
    if (i < 0) return;
    sel = i; hinted.add(i); g[i] = sol[i]; sfx('coin'); show = false; render();
    const done = K ? kakuroSolved(K, g) : kenkenSolved(Q!, g);
    if (done) { over = true; showBanner(banner, 'win', id, level, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), start, () => start(level)); renderLevelBar(levelBar, id, level, start); }
  });
  document.addEventListener('keydown', (e) => {
    const tg = e.target as HTMLElement; if (tg && /INPUT|TEXTAREA|SELECT/.test(tg.tagName)) return;
    if (/^[1-9]$/.test(e.key)) { put(Number(e.key)); return; }
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { put(0); return; }
    const d: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }, m = d[e.key];
    if (!m) return;
    e.preventDefault(); const n = N();
    let r = sel < 0 ? 0 : Math.floor(sel / n), c = sel < 0 ? 0 : sel % n;
    for (let k = 0; k < n * n; k++) { r = (r + m[0] + n) % n; c = (c + m[1] + n) % n; if (!K || K.white[r * n + c]) break; }
    sel = r * n + c; render();
  });
  void A; fullscreenButton(); start(level);
}
export const mountKakuro = (id: string): void => mount('kakuro', id);
export const mountKenKen = (id: string): void => mount('kenken', id);
