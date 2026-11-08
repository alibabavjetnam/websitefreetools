/** Giao diện Sudoku (9x9 hoặc 16x16) với 10 cấp. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { digitLabel, generatePuzzle, isComplete, type Puzzle } from '../calc/sudoku';
import { clearBanner, fmtTime, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';

export function mountSudoku(n: 9 | 16, id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><span>${escapeHtml(t('lib.game.time', 'Thời gian'))}: <b id="sd-time">0:00</b></span><span id="sd-left"></span></div>
        <div class="sudoku" id="sd-grid" style="--n:${n}" role="grid"></div>
      </div>
      <div class="game-side">
        <div class="sd-pad" id="sd-pad" style="--n:${n}"></div>
        <div class="row">
          <button type="button" class="btn btn-sm" id="sd-notes" aria-pressed="false">${escapeHtml(t('lib.game.notes', 'Ghi chú'))}</button>
          <button type="button" class="btn btn-sm" id="sd-erase">${escapeHtml(t('lib.game.erase', 'Xoá ô'))}</button>
          <button type="button" class="btn btn-sm" id="sd-hint">${escapeHtml(t('lib.game.hint', 'Gợi ý'))}</button>
          <button type="button" class="btn btn-sm" id="sd-check">${escapeHtml(t('lib.game.check', 'Kiểm tra'))}</button>
          <button type="button" class="btn btn-sm" id="sd-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>
        </div>
        <p class="note" id="sd-msg" aria-live="polite"></p>
        <p class="note">${escapeHtml(t('lib.game.sudokuKeys', 'Mũi tên để di chuyển, phím số để điền (16x16: A-G cho 10-16), Backspace để xoá, N để bật/tắt ghi chú.'))}</p>
      </div>
    </div>`);

  let level = progressOf(id).unlocked;
  let pz: Puzzle;
  let grid: number[] = [];
  let notes: number[] = [];
  let given: boolean[] = [];
  let hinted = new Set<number>();
  let wrong = new Set<number>();
  let sel = -1;
  let noteMode = false;
  let seconds = 0;
  let timer = 0;
  let over = false;

  const gridEl = $('#sd-grid');
  const msg = $('#sd-msg');
  const b = Math.round(Math.sqrt(n));

  $('#sd-pad').innerHTML = Array.from({ length: n }, (_, i) => `<button type="button" class="btn" data-v="${i + 1}">${digitLabel(i + 1)}</button>`).join('');

  function start(lv: number): void {
    level = lv;
    clearBanner(banner);
    renderLevelBar(levelBar, id, level, start);
    clearInterval(timer);
    over = false; sel = -1; wrong = new Set(); hinted = new Set();
    msg.textContent = t('lib.game.generating', 'Đang tạo đề…');
    gridEl.classList.add('busy');
    setTimeout(() => {
      pz = generatePuzzle(n, level);
      grid = pz.puzzle.slice();
      notes = new Array(n * n).fill(0);
      given = pz.puzzle.map((v) => v > 0);
      seconds = 0;
      msg.textContent = '';
      gridEl.classList.remove('busy');
      timer = window.setInterval(() => { seconds++; $('#sd-time').textContent = fmtTime(seconds); }, 1000);
      $('#sd-time').textContent = '0:00';
      render();
    }, 30);
  }

  function render(): void {
    const sr = sel >= 0 ? Math.floor(sel / n) : -1, sc = sel >= 0 ? sel % n : -1;
    const sv = sel >= 0 ? grid[sel] : 0;
    let html = '';
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n), c = i % n;
      const cls = ['sd-cell'];
      if (given[i]) cls.push('given');
      else if (hinted.has(i)) cls.push('hint');
      if (c % b === 0 && c > 0) cls.push('bl');
      if (r % b === 0 && r > 0) cls.push('bt');
      if (i === sel) cls.push('sel');
      else if (sel >= 0 && (r === sr || c === sc || (Math.floor(r / b) === Math.floor(sr / b) && Math.floor(c / b) === Math.floor(sc / b)))) cls.push('peer');
      if (sv && grid[i] === sv && i !== sel) cls.push('same');
      if (wrong.has(i)) cls.push('wrong');
      let inner = '';
      if (grid[i]) inner = digitLabel(grid[i]);
      else if (notes[i]) {
        inner = `<span class="sd-notes" style="--b:${b}">${Array.from({ length: n }, (_, k) => `<i>${notes[i] & (1 << k) ? digitLabel(k + 1) : ''}</i>`).join('')}</span>`;
      }
      html += `<button type="button" class="${cls.join(' ')}" data-i="${i}" role="gridcell" tabindex="${i === sel || (sel < 0 && i === 0) ? 0 : -1}">${inner}</button>`;
    }
    gridEl.innerHTML = html;
    const empty = grid.filter((v) => !v).length;
    $('#sd-left').textContent = tf('lib.game.sudokuLeft', 'Còn {n} ô trống', { n: empty });
    const counts = new Array(n + 1).fill(0);
    grid.forEach((v) => { counts[v]++; });
    document.querySelectorAll<HTMLButtonElement>('#sd-pad button').forEach((bt) => { bt.classList.toggle('full', counts[Number(bt.dataset.v)] >= n); });
  }

  function setValue(v: number): void {
    if (over || sel < 0 || given[sel] || hinted.has(sel)) return;
    wrong = new Set();
    if (noteMode && v > 0) {
      if (grid[sel]) return;
      notes[sel] ^= 1 << (v - 1);
    } else {
      grid[sel] = grid[sel] === v ? 0 : v;
      notes[sel] = 0;
      if (v > 0 && grid[sel]) {
        // xoá ghi chú trùng số ở hàng/cột/khối
        const r = Math.floor(sel / n), c = sel % n;
        for (let i = 0; i < n * n; i++) {
          const rr = Math.floor(i / n), cc = i % n;
          if (rr === r || cc === c || (Math.floor(rr / b) === Math.floor(r / b) && Math.floor(cc / b) === Math.floor(c / b))) notes[i] &= ~(1 << (v - 1));
        }
      }
    }
    render();
    if (grid.every((x) => x > 0)) finish();
  }

  function finish(): void {
    if (!isComplete(grid, n)) { msg.textContent = t('lib.game.sudokuConflict', 'Đã điền hết nhưng còn ô trùng số. Hãy kiểm tra lại.'); return; }
    over = true;
    clearInterval(timer);
    showBanner(banner, 'win', id, level, `${tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level })} ${fmtTime(seconds)}`, start, () => start(level));
    renderLevelBar(levelBar, id, level, start);
  }

  gridEl.addEventListener('click', (e) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('.sd-cell');
    if (!cell) return;
    sel = Number(cell.dataset.i);
    render();
  });
  $('#sd-pad').addEventListener('click', (e) => {
    const bt = (e.target as HTMLElement).closest<HTMLElement>('button[data-v]');
    if (bt) setValue(Number(bt.dataset.v));
  });
  $('#sd-erase').addEventListener('click', () => {
    if (over || sel < 0 || given[sel] || hinted.has(sel)) return;
    grid[sel] = 0; notes[sel] = 0; wrong = new Set(); render();
  });
  $('#sd-notes').addEventListener('click', () => {
    noteMode = !noteMode;
    $('#sd-notes').setAttribute('aria-pressed', String(noteMode));
    $('#sd-notes').classList.toggle('btn-primary', noteMode);
  });
  $('#sd-hint').addEventListener('click', () => {
    if (over) return;
    let target = sel;
    if (target < 0 || given[target] || grid[target] === pz.solution[target]) {
      const bad = grid.map((v, i) => (!given[i] && v !== pz.solution[i] ? i : -1)).filter((i) => i >= 0);
      if (!bad.length) return;
      target = bad[Math.floor(Math.random() * bad.length)];
    }
    sel = target;
    grid[target] = pz.solution[target]; notes[target] = 0; hinted.add(target); wrong = new Set();
    render();
    if (grid.every((x) => x > 0)) finish();
  });
  $('#sd-check').addEventListener('click', () => {
    if (over) return;
    wrong = new Set(grid.map((v, i) => (v && !given[i] && v !== pz.solution[i] ? i : -1)).filter((i) => i >= 0));
    msg.textContent = wrong.size ? tf('lib.game.sudokuWrong', 'Có {n} ô sai (đang tô đỏ).', { n: wrong.size }) : t('lib.game.sudokuAllRight', 'Chưa thấy ô nào sai.');
    render();
  });
  $('#sd-new').addEventListener('click', () => start(level));

  document.addEventListener('keydown', (e) => {
    if (over || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const k = e.key;
    const move = (dr: number, dc: number) => {
      const cur = sel < 0 ? 0 : sel;
      const r = Math.min(n - 1, Math.max(0, Math.floor(cur / n) + dr)), c = Math.min(n - 1, Math.max(0, (cur % n) + dc));
      sel = r * n + c; render(); e.preventDefault();
      gridEl.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.focus();
    };
    if (k === 'ArrowUp') move(-1, 0);
    else if (k === 'ArrowDown') move(1, 0);
    else if (k === 'ArrowLeft') move(0, -1);
    else if (k === 'ArrowRight') move(0, 1);
    else if (k === 'Backspace' || k === 'Delete' || k === '0') $('#sd-erase').click();
    else if (k === 'n' || k === 'N') $('#sd-notes').click();
    else if (/^[1-9]$/.test(k)) { setValue(Number(k)); e.preventDefault(); }
    else if (n === 16 && /^[a-gA-G]$/.test(k)) { setValue(k.toUpperCase().charCodeAt(0) - 55); e.preventDefault(); }
  });

  start(level);
}
