/** Giao diện trò ghi nhớ: các ô lộ 5 giây rồi úp, người chơi chọn đúng ô theo hình mẫu. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { MEMORY_LEVELS, COLORS, makeBoard, shapeSvg, type Tile } from '../calc/memory';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';

const SHOW_SECONDS = 5;
const LIVES = 3;

export function mountMemory(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="mm-status"></b><span id="mm-lives"></span></div>
        <div class="mm-timer" id="mm-timer" hidden><i id="mm-bar"></i></div>
        <div class="mm-grid" id="mm-grid"></div>
      </div>
      <div class="game-side">
        <div class="mm-ask" id="mm-ask" hidden>
          <div class="mm-ask-label">${escapeHtml(t('lib.game.mmAsk', 'Ô nào có hình này?'))}</div>
          <div class="mm-ask-shape" id="mm-shape"></div>
        </div>
        <div class="row">
          <button type="button" class="btn btn-primary" id="mm-start">${escapeHtml(t('lib.game.start', 'Bắt đầu'))}</button>
          <button type="button" class="btn" id="mm-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>
        </div>
        <p class="note">${escapeHtml(tf('lib.game.mmNote', 'Bấm Bắt đầu: các ô lộ ra trong {s} giây rồi úp lại. Hãy nhớ hình và màu của từng ô. Sau đó chọn đúng ô theo hình mẫu hiện ra. Sai quá {l} lần là thua cấp.', { s: SHOW_SECONDS, l: LIVES - 1 }))}</p>
      </div>
    </div>`);
  const grid = $('#mm-grid');
  const statusEl = $('#mm-status');

  let level = progressOf(id).unlocked;
  let tiles: Tile[] = [];
  let order: number[] = [];
  let qi = 0, lives = LIVES;
  let phase: 'ready' | 'show' | 'ask' | 'over' = 'ready';
  let solved = new Set<number>();
  let flash: { i: number; ok: boolean } | null = null;
  let timers: number[] = [];

  const clearTimers = () => { timers.forEach((x) => { clearTimeout(x); clearInterval(x); }); timers = []; };

  function start(lv: number): void {
    clearTimers();
    level = lv;
    const L = MEMORY_LEVELS[level - 1];
    ({ tiles, order } = makeBoard(level));
    qi = 0; lives = LIVES; phase = 'ready'; solved = new Set(); flash = null;
    grid.style.setProperty('--cols', String(L.cols));
    clearBanner(banner);
    $('#mm-ask').hidden = true; $('#mm-timer').hidden = true;
    ($('#mm-start') as HTMLButtonElement).disabled = false;
    renderLevelBar(levelBar, id, level, start);
    render();
  }

  function render(): void {
    const reveal = phase === 'show' || phase === 'over';
    grid.innerHTML = tiles.map((tl, i) => {
      const open = reveal || solved.has(i) || (flash?.i === i && flash.ok);
      const cls = ['mm-tile', open ? 'open' : '', solved.has(i) ? 'ok' : '', flash?.i === i ? (flash.ok ? 'ok' : 'bad') : ''].filter(Boolean).join(' ');
      return `<button type="button" class="${cls}" data-i="${i}" ${phase !== 'ask' || solved.has(i) ? 'disabled' : ''} aria-label="${i + 1}">${open ? shapeSvg(tl.shape, COLORS[tl.color]) : '<span class="q">?</span>'}</button>`;
    }).join('');
    $('#mm-lives').textContent = `${t('lib.game.lives', 'Mạng')}: ${'♥'.repeat(lives)}${'♡'.repeat(LIVES - lives)}`;
    if (phase === 'ready') statusEl.textContent = t('lib.game.mmReady', 'Sẵn sàng?');
    else if (phase === 'ask') statusEl.textContent = tf('lib.game.mmQuestion', 'Câu {i}/{n}', { i: qi + 1, n: order.length });
  }

  function ask(): void {
    phase = 'ask';
    $('#mm-timer').hidden = true;
    const tl = tiles[order[qi]];
    $('#mm-shape').innerHTML = shapeSvg(tl.shape, COLORS[tl.color], 96);
    $('#mm-ask').hidden = false;
    render();
  }

  function begin(): void {
    clearTimers();
    ({ tiles, order } = makeBoard(level));
    qi = 0; lives = LIVES; solved = new Set(); flash = null;
    clearBanner(banner);
    phase = 'show';
    ($('#mm-start') as HTMLButtonElement).disabled = true;
    $('#mm-ask').hidden = true;
    const bar = $('#mm-bar');
    $('#mm-timer').hidden = false;
    const t0 = Date.now();
    render();
    const tick = window.setInterval(() => {
      const left = Math.max(0, SHOW_SECONDS - (Date.now() - t0) / 1000);
      bar.style.width = `${(left / SHOW_SECONDS) * 100}%`;
      statusEl.textContent = tf('lib.game.mmMemorize', 'Ghi nhớ — còn {s} giây', { s: Math.ceil(left) });
      if (left <= 0) { clearInterval(tick); ($('#mm-start') as HTMLButtonElement).disabled = false; ask(); }
    }, 100);
    timers.push(tick);
  }

  function finish(win: boolean): void {
    phase = 'over';
    $('#mm-ask').hidden = true;
    render();
    statusEl.textContent = win ? t('lib.game.mmDone', 'Hoàn thành!') : t('lib.game.mmLost', 'Hết mạng — các ô đã mở ra để bạn xem.');
    showBanner(banner, win ? 'win' : 'lose', id, level,
      win ? tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }) : tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: level }), start, () => start(level));
    renderLevelBar(levelBar, id, level, start);
  }

  grid.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.mm-tile');
    if (!el || phase !== 'ask') return;
    const i = Number(el.dataset.i);
    if (solved.has(i)) return;
    const target = order[qi];
    if (i === target) {
      solved.add(i); flash = { i, ok: true }; qi++;
      if (qi >= order.length) { finish(true); return; }
      ask();
    } else {
      lives--;
      flash = { i, ok: false };
      if (lives <= 0) { finish(false); return; }
      render();
      timers.push(window.setTimeout(() => { flash = null; if (phase === 'ask') render(); }, 600));
    }
  });
  $('#mm-start').addEventListener('click', begin);
  $('#mm-new').addEventListener('click', () => start(level));

  fullscreenButton();
  start(level);
}
