/** Giao diện Block 10x10: đặt mảnh vào lưới, xoá hàng/cột đầy để đạt điểm mục tiêu. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { BLOCK_N, BLOCK_TARGET, blockCanPlace, blockFits, blockPieces, blockPlace, type Shape } from '../calc/puzzles3';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { Af, Ah, bestScore } from './arcade-ui';

export function mountBlock10(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><span id="b1-info"></span></div>
        <div class="b1-board gboard" id="b1-board"></div>
        <div class="b1-tray" id="b1-tray"></div>
      </div>
      <div class="game-side">
        <div class="row"><button type="button" class="btn" id="b1-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button></div>
        <p class="note">${Ah('note.block10', 'Chọn một mảnh ở dưới rồi bấm vào lưới để đặt (mảnh không xoay được). Lấp đầy cả hàng hoặc cả cột để xoá chúng và ghi thêm điểm; xoá nhiều đường cùng lúc được thưởng lớn. Đạt điểm mục tiêu để qua cấp; hết chỗ đặt mọi mảnh còn lại là thua.')}</p>
      </div>
    </div>`);
  const boardEl = $('#b1-board'), tray = $('#b1-tray'), info = $('#b1-info');
  let level = progressOf(id).unlocked;
  let b: boolean[] = [], pieces: (Shape | null)[] = [], sel = -1, score = 0, over = false;

  function start(lv: number): void {
    level = lv; b = new Array(BLOCK_N * BLOCK_N).fill(false); score = 0; over = false; sel = -1;
    pieces = blockPieces(level); clearBanner(banner); renderLevelBar(levelBar, id, level, start); render();
  }
  function render(ghost: { r: number; c: number } | null = null): void {
    const gh = new Set<number>();
    let ok = false;
    if (ghost && sel >= 0 && pieces[sel]) {
      const s = pieces[sel] as Shape;
      ok = blockCanPlace(b, s, ghost.r, ghost.c);
      s.forEach(([dr, dc]) => { gh.add((ghost.r + dr) * BLOCK_N + ghost.c + dc); });
    }
    if (ghost && boardEl.childElementCount === b.length) {
      // Chỉ đổi lớp của ô, không dựng lại (dựng lại giữa lúc rê chuột làm mất cú bấm)
      boardEl.querySelectorAll<HTMLElement>('.b1-c').forEach((el, i) => { el.classList.remove('ghost', 'bad'); if (gh.has(i)) el.classList.add(ok ? 'ghost' : 'bad'); });
      return;
    }
    boardEl.innerHTML = b.map((v, i) => `<button type="button" class="b1-c${v ? ' on' : ''}${gh.has(i) ? (ok ? ' ghost' : ' bad') : ''}" data-i="${i}"></button>`).join('');
    tray.innerHTML = pieces.map((s, k) => {
      if (!s) return '<div class="b1-slot"></div>';
      const h = Math.max(...s.map((p) => p[0])) + 1, w = Math.max(...s.map((p) => p[1])) + 1;
      const set = new Set(s.map((p) => p[0] * w + p[1]));
      return `<button type="button" class="b1-slot${k === sel ? ' sel' : ''}${blockFits(b, s) ? '' : ' dead'}" data-k="${k}"><span class="b1-piece" style="--pw:${w};--ph:${h}">${Array.from({ length: w * h }, (_, i) => `<i class="${set.has(i) ? 'on' : ''}"></i>`).join('')}</span></button>`;
    }).join('');
    const best = bestScore(id, level).get();
    info.textContent = `${Af('score', 'Điểm: {n}', { n: score })} · ${Af('target', 'Mục tiêu: {n}', { n: BLOCK_TARGET[level - 1] })} · ${Af('best', 'Kỷ lục: {n}', { n: best })}`;
  }
  const anchor = (i: number): { r: number; c: number } | null => {
    if (sel < 0 || !pieces[sel]) return null;
    const s = pieces[sel] as Shape;
    const h = Math.max(...s.map((p) => p[0])) + 1, w = Math.max(...s.map((p) => p[1])) + 1;
    return { r: Math.floor(i / BLOCK_N) - Math.floor(h / 2), c: (i % BLOCK_N) - Math.floor(w / 2) };
  };
  tray.addEventListener('click', (e) => {
    const s = (e.target as HTMLElement).closest<HTMLElement>('[data-k]'); if (!s || over) return;
    sel = sel === Number(s.dataset.k) ? -1 : Number(s.dataset.k); render();
  });
  boardEl.addEventListener('pointermove', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('.b1-c'); if (!c || over || sel < 0) return;
    render(anchor(Number(c.dataset.i)));
  });
  boardEl.addEventListener('pointerleave', () => { if (sel >= 0) render(); });
  boardEl.addEventListener('click', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('.b1-c'); if (!c || over || sel < 0) return;
    const a = anchor(Number(c.dataset.i)); const s = pieces[sel];
    if (!a || !s || !blockCanPlace(b, s, a.r, a.c)) return;
    score += blockPlace(b, s, a.r, a.c).score; pieces[sel] = null; sel = -1;
    if (pieces.every((p) => !p)) pieces = blockPieces(level);
    bestScore(id, level).put(score); render();
    const target = BLOCK_TARGET[level - 1];
    if (score >= target) { over = true; showBanner(banner, 'win', id, level, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), start, () => start(level)); renderLevelBar(levelBar, id, level, start); }
    else if (!pieces.some((p) => p && blockFits(b, p))) { over = true; showBanner(banner, 'lose', id, level, tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), start, () => start(level)); }
  });
  $('#b1-new').addEventListener('click', () => start(level));
  fullscreenButton();
  start(level);
}
