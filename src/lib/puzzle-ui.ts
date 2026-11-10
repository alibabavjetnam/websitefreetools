/** Giao diện các game giải đố đợt 3: Lights Out, 15-puzzle, Flood-it, Mastermind, Tháp Hà Nội, Nối ống. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import {
  MM_CFG, floodDone, floodFill, floodNew, floodRegion, hanoiCanMove, hanoiMin, hanoiNew, fifteenNew, fifteenSlide, fifteenWon, lightsNew, lightsPress,
  lightsSolve, mmNew, mmScore, pipeRot, pipesNew, pipesOpen, pipesWon,
} from '../calc/puzzles3';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah } from './arcade-ui';

type Kind = 'lights-out' | 'fifteen' | 'flood-it' | 'mastermind' | 'hanoi' | 'pipes';
const NOTE: Record<Kind, string> = {
  'lights-out': 'Bấm một ô sẽ đổi trạng thái (sáng/tắt) của ô đó và 4 ô liền kề. Hãy tắt hết mọi đèn. Có Gợi ý chỉ ra ô nên bấm.',
  fifteen: 'Trượt các ô số vào chỗ trống để xếp theo thứ tự 1, 2, 3… với ô trống ở góc dưới phải. Bấm một ô cùng hàng hoặc cột với ô trống để trượt cả dãy; dùng được phím mũi tên.',
  'flood-it': 'Chọn một màu để tô cả vùng đang chiếm ở góc trên trái; vùng sẽ nuốt các ô liền kề cùng màu. Hãy làm cả bàn cùng một màu trong số nước cho phép.',
  mastermind: 'Máy giấu một dãy màu. Chọn màu cho từng vị trí rồi bấm Đoán. Chấm đen = đúng màu đúng vị trí, chấm trắng = đúng màu nhưng sai vị trí. Đoán ra dãy trước khi hết lượt.',
  hanoi: 'Chuyển toàn bộ đĩa sang cọc cuối cùng. Mỗi lần chỉ chuyển một đĩa trên cùng, và không đặt đĩa to lên đĩa nhỏ. Bấm cọc nguồn rồi cọc đích.',
  pipes: 'Bấm một ô để xoay ống 90°. Nối mọi ống thành một mạng liền, không còn đầu ống hở (đầu hở được tô đỏ).',
};
const COLORS = ['#e03131', '#1971c2', '#2f9e44', '#f08c00', '#9c36b5', '#0c8599', '#e64980', '#5c940d'];
const SYMS = ['●', '■', '▲', '◆', '★', '✚', '⬟', '♥'];

export function mountPuzzle(id: string, kind: Kind): void {
  const side = kind === 'mastermind'
    ? `<div class="mm-palette" id="pz-palette"></div><div class="row"><button type="button" class="btn btn-primary" id="pz-guess">${Ah('guess', 'Đoán')}</button><button type="button" class="btn" id="pz-clear">${Ah('clearRow', 'Xoá hàng')}</button><button type="button" class="btn" id="pz-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button></div>`
    : `<div class="row">${kind === 'lights-out' ? `<button type="button" class="btn" id="pz-hint">${escapeHtml(t('lib.game.hint', 'Gợi ý'))}</button>` : ''}<button type="button" class="btn" id="pz-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button></div>${kind === 'flood-it' ? '<div class="fl-palette" id="pz-palette"></div>' : ''}`;
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><span id="pz-info"></span></div>
        <div class="pz-board gboard" id="pz-board" role="grid"></div>
      </div>
      <div class="game-side">${side}<p class="note" id="pz-msg" aria-live="polite"></p><p class="note">${Ah('note.' + kind, NOTE[kind])}</p></div>
    </div>`);
  const board = $('#pz-board'), info = $('#pz-info'), msg = $('#pz-msg');
  let level = progressOf(id).unlocked;
  let over = false, moves = 0;

  const win = (): void => { over = true; showBanner(banner, 'win', id, level, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), start, () => start(level)); renderLevelBar(levelBar, id, level, start); };
  const lose = (): void => { over = true; showBanner(banner, 'lose', id, level, tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), start, () => start(level)); };
  const movesInfo = (): void => { info.textContent = Af('moves', 'Nước đi: {n}', { n: moves }); };

  /* ----- Lights Out ----- */
  let lo = { n: 3, b: [] as boolean[] };
  const lightsRender = (hint = -1): void => {
    board.style.setProperty('--n', String(lo.n));
    board.className = 'pz-board gboard pz-grid';
    board.innerHTML = lo.b.map((on, i) => `<button type="button" class="pz-cell lo ${on ? 'on' : ''}${i === hint ? ' hint' : ''}" data-i="${i}" aria-pressed="${on}"></button>`).join('');
    movesInfo();
  };
  /* ----- 15-puzzle ----- */
  let fp = { n: 4, t: [] as number[] };
  const fifteenRender = (): void => {
    board.style.setProperty('--n', String(fp.n));
    board.className = 'pz-board gboard pz-grid';
    board.innerHTML = fp.t.map((v, i) => `<button type="button" class="pz-cell fp${v ? '' : ' empty'}" data-i="${i}" ${v ? '' : 'tabindex="-1"'}>${v || ''}</button>`).join('');
    movesInfo();
  };
  /* ----- Flood-it ----- */
  let fl = { n: 8, colors: 4, g: [] as number[], limit: 10 };
  const floodRender = (): void => {
    board.style.setProperty('--n', String(fl.n));
    board.className = 'pz-board gboard pz-grid fl';
    board.innerHTML = fl.g.map((c) => `<i class="fl-c" style="background:${COLORS[c]}">${c < SYMS.length ? '' : ''}</i>`).join('');
    $('#pz-palette').innerHTML = Array.from({ length: fl.colors }, (_, c) => `<button type="button" class="fl-btn" data-c="${c}" style="background:${COLORS[c]}" aria-label="${SYMS[c]} ${c + 1}"><span>${SYMS[c]}</span></button>`).join('');
    info.textContent = `${Af('movesLeft', 'Còn {n} lượt', { n: fl.limit - moves })} · ${Af('area', 'Vùng: {n}/{t}', { n: floodRegion(fl.g, fl.n), t: fl.n * fl.n })}`;
  };
  /* ----- Mastermind ----- */
  let mm = { code: [] as number[], rows: [] as { g: number[]; b: number; w: number }[], cur: [] as number[], cfg: MM_CFG[0] };
  const mmRender = (): void => {
    board.className = 'pz-board gboard mm-board';
    const cfg = mm.cfg;
    let html = '';
    for (let r = 0; r < cfg.tries; r++) {
      const row = mm.rows[r];
      const isCur = r === mm.rows.length && !over;
      const slots = Array.from({ length: cfg.len }, (_, k) => {
        const v = row ? row.g[k] : isCur ? mm.cur[k] : undefined;
        return v === undefined ? `<span class="mm-slot${isCur ? ' cur' : ''}" data-k="${k}"></span>` : `<span class="mm-slot filled${isCur ? ' cur' : ''}" data-k="${k}" style="background:${COLORS[v]}">${SYMS[v]}</span>`;
      }).join('');
      const peg = row ? `<span class="mm-fb">${'<i class="b"></i>'.repeat(row.b)}${'<i class="w"></i>'.repeat(row.w)}</span>` : '<span class="mm-fb"></span>';
      html += `<div class="mm-row${isCur ? ' cur' : ''}"><b>${r + 1}</b><span class="mm-slots">${slots}</span>${peg}</div>`;
    }
    if (over) html += `<div class="mm-row mm-code"><b>?</b><span class="mm-slots">${mm.code.map((v) => `<span class="mm-slot filled" style="background:${COLORS[v]}">${SYMS[v]}</span>`).join('')}</span></div>`;
    board.innerHTML = html;
    $('#pz-palette').innerHTML = Array.from({ length: cfg.colors }, (_, c) => `<button type="button" class="fl-btn" data-c="${c}" style="background:${COLORS[c]}" aria-label="${SYMS[c]}"><span>${SYMS[c]}</span></button>`).join('');
    info.textContent = Af('triesLeft', 'Còn {n} lượt đoán', { n: cfg.tries - mm.rows.length });
  };
  /* ----- Tháp Hà Nội ----- */
  let hn = { pegs: [] as number[][], discs: 3 };
  let hnSel = -1;
  const hanoiRender = (): void => {
    board.className = 'pz-board gboard hn-board';
    board.innerHTML = hn.pegs.map((p, i) => `<button type="button" class="hn-peg${i === hnSel ? ' sel' : ''}" data-p="${i}"><span class="hn-rod"></span><span class="hn-stack">${p.map((d) => `<i style="width:${20 + (d / hn.discs) * 72}%;background:${COLORS[(d - 1) % COLORS.length]}"></i>`).join('')}</span></button>`).join('');
    info.textContent = `${Af('moves', 'Nước đi: {n}', { n: moves })} · ${Af('minMoves', 'Tối thiểu: {n}', { n: hanoiMin(hn.pegs.length, hn.discs) })}`;
  };
  /* ----- Nối ống ----- */
  let pp = { n: 3, t: [] as number[] };
  const pipesRender = (): void => {
    board.style.setProperty('--n', String(pp.n));
    board.className = 'pz-board gboard pz-grid pp';
    const open = pipesOpen(pp.t, pp.n);
    board.innerHTML = pp.t.map((m, i) => {
      const seg = [[1, 'M50 50V0'], [2, 'M50 50H100'], [4, 'M50 50V100'], [8, 'M50 50H0']] as [number, string][];
      const d = seg.filter(([bit]) => m & bit).map(([, p]) => p).join('');
      return `<button type="button" class="pz-cell pp-c${open[i] ? ' open' : ''}" data-i="${i}"><svg viewBox="0 0 100 100"><path d="${d}" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/><circle cx="50" cy="50" r="12" fill="currentColor"/></svg></button>`;
    }).join('');
    movesInfo();
  };

  function start(lv: number): void {
    level = lv; over = false; moves = 0; msg.textContent = '';
    clearBanner(banner); renderLevelBar(levelBar, id, level, start);
    if (kind === 'lights-out') { lo = lightsNew(level); lightsRender(); }
    else if (kind === 'fifteen') { fp = fifteenNew(level); fifteenRender(); }
    else if (kind === 'flood-it') { fl = floodNew(level); floodRender(); }
    else if (kind === 'mastermind') { mm = { code: mmNew(level), rows: [], cur: [], cfg: MM_CFG[level - 1] }; mmRender(); }
    else if (kind === 'hanoi') { hn = hanoiNew(level); hnSel = -1; hanoiRender(); }
    else { pp = pipesNew(level); pipesRender(); }
  }

  board.addEventListener('click', (e) => {
    if (over) return;
    const el = e.target as HTMLElement;
    if (kind === 'lights-out') {
      const c = el.closest<HTMLElement>('.pz-cell'); if (!c) return;
      lightsPress(lo.b, lo.n, Number(c.dataset.i)); moves++; lightsRender(); msg.textContent = '';
      if (!lo.b.some((x) => x)) win();
    } else if (kind === 'fifteen') {
      const c = el.closest<HTMLElement>('.pz-cell'); if (!c) return;
      if (fifteenSlide(fp.t, fp.n, Number(c.dataset.i))) { moves++; fifteenRender(); if (fifteenWon(fp.t, fp.n)) win(); }
    } else if (kind === 'hanoi') {
      const p = el.closest<HTMLElement>('.hn-peg'); if (!p) return;
      const i = Number(p.dataset.p);
      if (hnSel < 0) { if (hn.pegs[i].length) hnSel = i; }
      else if (hnSel === i) hnSel = -1;
      else if (hanoiCanMove(hn.pegs, hnSel, i)) { hn.pegs[i].push(hn.pegs[hnSel].pop() as number); hnSel = -1; moves++; if (hn.pegs[hn.pegs.length - 1].length === hn.discs) { hanoiRender(); win(); return; } }
      else { msg.textContent = A('hnBad', 'Không đặt đĩa to lên đĩa nhỏ.'); hnSel = -1; }
      hanoiRender();
    } else if (kind === 'pipes') {
      const c = el.closest<HTMLElement>('.pz-cell'); if (!c) return;
      const i = Number(c.dataset.i); pp.t[i] = pipeRot(pp.t[i]); moves++; pipesRender();
      if (pipesWon(pp.t, pp.n)) win();
    } else if (kind === 'mastermind') {
      const s = el.closest<HTMLElement>('.mm-slot.cur'); if (!s) return;
      mm.cur[Number(s.dataset.k)] = undefined as unknown as number; mm.cur = mm.cur.map((v) => v); mmRender();
    }
  });
  $('#pz-new').addEventListener('click', () => start(level));
  if (kind === 'lights-out') {
    $('#pz-hint').addEventListener('click', () => {
      if (over) return;
      const s = lightsSolve(lo.b, lo.n);
      if (s && s.length) lightsRender(s[Math.floor(Math.random() * s.length)]);
    });
  }
  if (kind === 'flood-it') {
    $('#pz-palette').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-c]');
      if (!b || over) return;
      const c = Number(b.dataset.c);
      if (c === fl.g[0]) return;
      floodFill(fl.g, fl.n, c); moves++; floodRender();
      if (floodDone(fl.g)) win(); else if (moves >= fl.limit) { msg.textContent = A('outOfMoves', 'Hết lượt!'); lose(); }
    });
  }
  if (kind === 'mastermind') {
    $('#pz-palette').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-c]');
      if (!b || over) return;
      let k = 0; while (k < mm.cfg.len && mm.cur[k] !== undefined) k++;
      if (k < mm.cfg.len) { mm.cur[k] = Number(b.dataset.c); mmRender(); }
    });
    $('#pz-clear').addEventListener('click', () => { mm.cur = []; mmRender(); });
    $('#pz-guess').addEventListener('click', () => {
      if (over) return;
      const g = Array.from({ length: mm.cfg.len }, (_, k) => mm.cur[k]);
      if (g.some((v) => v === undefined)) { msg.textContent = A('fillAll', 'Hãy chọn đủ màu cho mọi vị trí.'); return; }
      msg.textContent = '';
      const sc = mmScore(mm.code, g);
      mm.rows.push({ g, b: sc.black, w: sc.white }); mm.cur = [];
      if (sc.black === mm.cfg.len) { over = true; mmRender(); win(); }
      else if (mm.rows.length >= mm.cfg.tries) { over = true; mmRender(); lose(); }
      else mmRender();
    });
  }
  if (kind === 'fifteen') {
    document.addEventListener('keydown', (e) => {
      if (over || e.ctrlKey || e.metaKey || e.altKey) return;
      const d: Record<string, number> = { ArrowUp: 1, ArrowDown: -1, ArrowLeft: 0, ArrowRight: 0 };
      if (!(e.key in d)) return;
      const b = fp.t.indexOf(0), n = fp.n, r = Math.floor(b / n), c = b % n;
      // phím mũi tên: ô ở phía đó trượt vào chỗ trống
      const to = e.key === 'ArrowUp' ? (r < n - 1 ? b + n : -1) : e.key === 'ArrowDown' ? (r > 0 ? b - n : -1) : e.key === 'ArrowLeft' ? (c < n - 1 ? b + 1 : -1) : (c > 0 ? b - 1 : -1);
      if (to < 0) return;
      e.preventDefault();
      if (fifteenSlide(fp.t, fp.n, to)) { moves++; fifteenRender(); if (fifteenWon(fp.t, fp.n)) win(); }
    });
  }
  fullscreenButton();
  start(level);
}
