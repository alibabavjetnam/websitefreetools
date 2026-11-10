/** Giao diện đợt 9: N-back, Tiệm bánh, Nối cặp, Ghép hình, Golf mini. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { CK_ITEMS, CK_TIME, GOLF_BR, GOLF_H, GOLF_HR, GOLF_W, ckBuy, ckClick, ckCost, ckCps, ckTick, clickerNew, golfNew, golfStep, jigDone, jigN, jigShuffle, nbackCfg, nbackSeq, nbackTarget, onetCfg, onetHint, onetNew, onetPath, onetRemove, onetShuffle, type Clicker, type Onet } from '../calc/arcade9';
import { clearBanner, fmtTime, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah, bestScore } from './arcade-ui';
import { mountCanvasGame } from './canvasgame';
import { sfx, type Sfx } from './sfx';

const WIN = (n: number): string => tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n });
const LOSE = (n: number): string => tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n });
const newBtn = (id: string): string => `<button type="button" class="btn" id="${id}">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>`;

/* ================================ N-back ================================ */
export function mountNBack(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main"><div class="game-board-col">
      <div class="game-status"><b id="nb-info"></b><span id="nb-score"></span></div>
      <div class="nb-grid gboard" id="nb-grid">${Array.from({ length: 9 }, (_, i) => `<div class="nb-c" data-i="${i}"></div>`).join('')}</div>
      <div class="row nb-row"><button type="button" class="btn btn-primary nb-btn" id="nb-match">${Ah('nbMatch', 'Giống!')}</button></div>
    </div><div class="game-side">
      <div class="row"><button type="button" class="btn btn-primary" id="nb-start">${escapeHtml(t('lib.game.start', 'Bắt đầu'))}</button>${newBtn('nb-new')}</div>
      <p class="note" id="nb-msg" aria-live="polite"></p>
      <p class="note">${Ah('note.nback', 'Một ô sáng lên lần lượt trên lưới 3x3. Bấm "Giống!" (hoặc phím cách) khi vị trí ô sáng giống với vị trí cách đây N lượt (N hiện ở trên). Bạn cần trả lời đúng ít nhất 80% các lượt để qua cấp. Cấp cao có N lớn hơn.')}</p>
    </div></div>`);
  let level = progressOf(id).unlocked, seq: number[] = [], i = -1, n = 1, ok = 0, total = 0, responded = false, timer = 0, running = false, hits = 0, falses = 0;
  const cells = (): NodeListOf<HTMLElement> => document.querySelectorAll<HTMLElement>('.nb-c');
  function header(): void { $('#nb-info').textContent = tf('lib.arcade.nbN', 'N = {n}', { n }) + ` · ${Math.max(0, i + 1)}/${seq.length}`; $('#nb-score').textContent = Af('nbHits', 'Đúng: {a} · Nhầm: {b}', { a: hits, b: falses }); }
  function reset(lv: number): void {
    level = lv; clearInterval(timer); running = false; n = nbackCfg(lv).n; seq = []; i = -1; ok = 0; total = 0; hits = 0; falses = 0; clearBanner(banner); renderLevelBar(levelBar, id, level, reset);
    cells().forEach((c) => c.classList.remove('on')); $('#nb-msg').textContent = ''; header();
  }
  function judge(): void { // chấm lượt i
    if (i < 0 || i < n) return; total++;
    const tg = nbackTarget(seq, i, n);
    if (tg && responded) { ok++; hits++; } else if (!tg && !responded) ok++; else if (!tg && responded) falses++;
  }
  function step(): void {
    judge();
    i++;
    if (i >= seq.length) { finish(); return; }
    responded = false; cells().forEach((c, k) => c.classList.toggle('on', k === seq[i]));
    window.setTimeout(() => cells().forEach((c) => c.classList.remove('on')), 800); sfx('tap'); header();
  }
  function finish(): void {
    clearInterval(timer); running = false; const acc = total ? ok / total : 0;
    $('#nb-msg').textContent = Af('nbAcc', 'Độ chính xác: {n}%', { n: Math.round(acc * 100) });
    if (acc >= 0.8) { showBanner(banner, 'win', id, level, WIN(level), reset, () => reset(level)); renderLevelBar(levelBar, id, level, reset); } else showBanner(banner, 'lose', id, level, LOSE(level), reset, () => reset(level));
  }
  function begin(): void { if (running) return; reset(level); const c = nbackCfg(level); seq = nbackSeq(c.n, c.trials); running = true; step(); timer = window.setInterval(step, c.ms); }
  function respond(): void { if (!running || responded || i < 0) return; responded = true; sfx('select'); }
  $('#nb-start').addEventListener('click', begin); $('#nb-match').addEventListener('click', respond); $('#nb-new').addEventListener('click', () => reset(level));
  document.addEventListener('keydown', (e) => { if (e.key === ' ' && running) { e.preventDefault(); respond(); } });
  fullscreenButton(); reset(level);
}

/* ================================ Tiệm bánh ================================ */
export function mountClicker(id: string): void {
  const names: Record<string, [string, string]> = { cursor: ['ckCursor', 'Con trỏ'], grandma: ['ckGrandma', 'Bà nướng bánh'], farm: ['ckFarm', 'Trang trại'], mine: ['ckMine', 'Mỏ đường'], factory: ['ckFactory', 'Nhà máy'] };
  const { levelBar, banner } = gameShell(`
    <div class="game-main"><div class="game-board-col">
      <div class="game-status"><b id="ck-status"></b><span id="ck-time"></span></div>
      <div class="ck-wrap gboard"><button type="button" class="ck-cookie" id="ck-cookie" aria-label="${escapeHtml(A('ckCookie', 'Bánh quy'))}">🍪</button><div class="ck-bar"><i id="ck-prog"></i></div><div class="ck-cps" id="ck-cps"></div></div>
    </div><div class="game-side">
      <div class="ck-shop" id="ck-shop"></div>
      <div class="row"><button type="button" class="btn btn-primary" id="ck-start">${escapeHtml(t('lib.game.start', 'Bắt đầu'))}</button>${newBtn('ck-new')}</div>
      <p class="note">${Ah('note.clicker', 'Bấm vào chiếc bánh để làm bánh, rồi dùng bánh mua các nhà sản xuất tự động làm bánh giúp bạn (giá tăng dần theo số lượng). Làm đủ số bánh mục tiêu trước khi hết 2 phút để qua cấp.')}</p>
    </div></div>`);
  let level = progressOf(id).unlocked, s: Clicker = clickerNew(1), timer = 0, running = false, last = 0;
  const drain = (): void => { for (const e of s.ev) sfx(e as Sfx); s.ev.length = 0; };
  function draw(): void {
    $('#ck-status').textContent = Af('ckEarned', 'Đã làm: {n}/{t}', { n: Math.floor(s.earned), t: s.target });
    $('#ck-time').textContent = `${fmtTime(Math.max(0, Math.ceil(s.time)))} · ${Af('chips2', 'Bánh: {n}', { n: Math.floor(s.cookies) })}`;
    ($('#ck-prog') as HTMLElement).style.width = `${Math.min(100, (s.earned / s.target) * 100)}%`;
    $('#ck-cps').textContent = Af('ckCps', '{n} bánh/giây', { n: Math.round(ckCps(s) * 10) / 10 });
    $('#ck-shop').innerHTML = CK_ITEMS.map((it, k) => `<button type="button" class="btn ck-item" data-k="${k}" ${running && s.cookies >= ckCost(s, k) ? '' : 'disabled'}><b>${escapeHtml(A(names[it.key][0], names[it.key][1]))}</b> ×${s.own[k]}<small>${ckCost(s, k)} 🍪 · +${it.cps}/s</small></button>`).join('');
  }
  function reset(l: number): void { level = l; clearInterval(timer); running = false; s = clickerNew(l); clearBanner(banner); renderLevelBar(levelBar, id, level, reset); draw(); }
  function begin(): void {
    if (running) return; reset(level); running = true; last = performance.now();
    timer = window.setInterval(() => {
      const now = performance.now(), r = ckTick(s, (now - last) / 1000); last = now; drain(); draw();
      if (r) { clearInterval(timer); running = false; draw(); if (r === 'win') { showBanner(banner, 'win', id, level, WIN(level), reset, () => reset(level)); renderLevelBar(levelBar, id, level, reset); } else showBanner(banner, 'lose', id, level, LOSE(level), reset, () => reset(level)); }
    }, 100);
  }
  $('#ck-cookie').addEventListener('click', () => { if (!running) begin(); ckClick(s); drain(); draw(); });
  $('#ck-shop').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-k]'); if (b && running) { ckBuy(s, Number(b.dataset.k)); drain(); draw(); } });
  $('#ck-start').addEventListener('click', begin); $('#ck-new').addEventListener('click', () => reset(level));
  void CK_TIME; fullscreenButton(); reset(level);
}

/* ================================ Nối cặp (Onet) ================================ */
const EMO = ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🥝', '🍍', '🥥', '🥕', '🌽', '🍄', '🍔', '🍕', '🍩', '🍪', '🎂', '⚽', '🏀', '🎾', '🎲', '🎯', '🎸', '🚗', '✈️', '⭐', '🌸'];
export function mountOnet(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main"><div class="game-board-col">
      <div class="game-status"><b id="on-info"></b><span id="on-time"></span></div>
      <div class="on-wrap gboard" id="on-wrap"><div class="on-grid" id="on-grid"></div><svg class="on-line" id="on-line" preserveAspectRatio="none"></svg></div>
    </div><div class="game-side">
      <div class="row"><button type="button" class="btn" id="on-hint">${escapeHtml(t('lib.game.hint', 'Gợi ý'))}</button><button type="button" class="btn" id="on-shuf">${Ah('shuffle', 'Xáo trộn')} (<span id="on-sn">0</span>)</button>${newBtn('on-new')}</div>
      <p class="note" id="on-msg" aria-live="polite"></p>
      <p class="note">${Ah('note.onet', 'Chọn hai ô giống nhau có thể nối với nhau bằng đường đi không quá 2 góc rẽ và không đi qua ô khác để xoá chúng. Xoá hết các ô trước khi hết giờ để qua cấp. Khi hết nước đi, bạn có thể xáo trộn (số lần giới hạn).')}</p>
    </div></div>`);
  let level = progressOf(id).unlocked, o: Onet = onetNew(1), sel = -1, left = 0, timer = 0, over = false, shuf = 0, busy = false;
  const grid = $('#on-grid'), line = $('#on-line');
  function draw(): void {
    const W = o.c + 2; (grid as HTMLElement).style.setProperty('--c', String(W)); (grid as HTMLElement).style.setProperty('--r', String(o.r + 2));
    let h = ''; for (let i = 0; i < o.g.length; i++) { const v = o.g[i]; h += v ? `<button type="button" class="on-t${i === sel ? ' sel' : ''}" data-i="${i}">${EMO[v - 1]}</button>` : '<span class="on-e"></span>'; }
    grid.innerHTML = h; $('#on-sn').textContent = String(shuf); $('#on-info').textContent = Af('tilesLeft', 'Còn {n} ô', { n: o.left }); $('#on-time').textContent = fmtTime(Math.max(0, left));
  }
  function end(w: boolean): void { over = true; clearInterval(timer); if (w) { showBanner(banner, 'win', id, level, WIN(level), start, () => start(level)); renderLevelBar(levelBar, id, level, start); } else showBanner(banner, 'lose', id, level, LOSE(level), start, () => start(level)); }
  function start(l: number): void {
    level = l; o = onetNew(l); sel = -1; over = false; busy = false; shuf = o.shuffles; left = onetCfg(l).time; clearInterval(timer); line.innerHTML = ''; $('#on-msg').textContent = '';
    clearBanner(banner); renderLevelBar(levelBar, id, level, start); draw();
    timer = window.setInterval(() => { left--; $('#on-time').textContent = fmtTime(Math.max(0, left)); if (left <= 0) end(false); }, 1000);
  }
  function after(): void {
    if (o.left === 0) { draw(); return end(true); }
    if (!onetHint(o)) { if (shuf > 0) { shuf--; onetShuffle(o); $('#on-msg').textContent = A('autoShuffle', 'Hết nước đi — đã tự xáo trộn.'); sfx('whoosh'); } else { end(false); return; } }
    draw();
  }
  grid.addEventListener('click', (e) => {
    if (over || busy) return; const b = (e.target as HTMLElement).closest<HTMLElement>('[data-i]'); if (!b) return;
    const i = Number(b.dataset.i);
    if (sel < 0) { sel = i; sfx('select'); draw(); return; }
    if (sel === i) { sel = -1; draw(); return; }
    const p = onetPath(o, sel, i);
    if (!p) { sel = i; sfx('error'); draw(); return; }
    const W = o.c + 2, H = o.r + 2; busy = true;
    line.setAttribute('viewBox', `0 0 ${W * 100} ${H * 100}`);
    line.innerHTML = `<polyline points="${p.map(([r, c]) => `${c * 100 + 50},${r * 100 + 50}`).join(' ')}" fill="none" stroke="#e8590c" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>`;
    const a = sel; sel = -1; sfx('pop'); draw();
    window.setTimeout(() => { onetRemove(o, a, i); line.innerHTML = ''; busy = false; sfx('line'); after(); }, 260);
  });
  $('#on-hint').addEventListener('click', () => { if (over || busy) return; const h = onetHint(o); if (h) { sel = h[0]; draw(); grid.querySelector<HTMLElement>(`[data-i="${h[1]}"]`)?.classList.add('hint'); sfx('select'); } });
  $('#on-shuf').addEventListener('click', () => { if (over || busy || shuf <= 0) return; shuf--; onetShuffle(o); sel = -1; sfx('whoosh'); draw(); });
  $('#on-new').addEventListener('click', () => start(level));
  fullscreenButton(); start(level);
}

/* ================================ Ghép hình ================================ */
function artUrl(): string {
  const c = document.createElement('canvas'); c.width = c.height = 480; const x = c.getContext('2d') as CanvasRenderingContext2D, h0 = Math.random() * 360;
  const g = x.createLinearGradient(0, 0, 480, 480); g.addColorStop(0, `hsl(${h0},70%,75%)`); g.addColorStop(1, `hsl(${(h0 + 70) % 360},70%,55%)`); x.fillStyle = g; x.fillRect(0, 0, 480, 480);
  for (let i = 0; i < 46; i++) {
    x.fillStyle = `hsla(${(h0 + Math.random() * 300) % 360},75%,${35 + Math.random() * 40}%,.85)`; const px = Math.random() * 480, py = Math.random() * 480, r = 14 + Math.random() * 60;
    x.beginPath(); if (i % 3 === 0) x.arc(px, py, r, 0, Math.PI * 2); else if (i % 3 === 1) x.rect(px - r / 2, py - r / 2, r, r * (0.5 + Math.random())); else { x.moveTo(px, py - r); x.lineTo(px + r, py + r); x.lineTo(px - r, py + r); x.closePath(); }
    x.fill();
  }
  x.fillStyle = '#fff'; x.beginPath(); x.arc(240, 240, 36, 0, Math.PI * 2); x.fill(); x.fillStyle = '#e03131'; x.beginPath(); x.arc(240, 240, 20, 0, Math.PI * 2); x.fill();
  return c.toDataURL('image/png');
}
export function mountJigsaw(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main"><div class="game-board-col">
      <div class="game-status"><b id="jg-info"></b><span id="jg-time"></span></div>
      <div class="jg-grid gboard" id="jg-grid"></div>
    </div><div class="game-side">
      <img class="jg-ref" id="jg-ref" alt="${escapeHtml(A('jgRef', 'Hình mẫu'))}" />
      <div class="row">${newBtn('jg-new')}</div>
      <p class="note">${Ah('note.jigsaw', 'Hình bị cắt thành nhiều mảnh và xáo trộn. Bấm vào một mảnh rồi bấm vào mảnh khác để đổi chỗ hai mảnh, sắp lại cho giống hình mẫu. Mảnh nằm đúng chỗ có viền xanh. Cấp cao có nhiều mảnh hơn.')}</p>
    </div></div>`);
  let level = progressOf(id).unlocked, n = 3, order: number[] = [], url = '', sel = -1, sec = 0, timer = 0, over = false;
  const grid = $('#jg-grid');
  function draw(): void {
    (grid as HTMLElement).style.setProperty('--n', String(n));
    grid.innerHTML = order.map((p, i) => { const r = Math.floor(p / n), c = p % n; return `<button type="button" class="jg-p${i === sel ? ' sel' : ''}${p === i ? ' ok' : ''}" data-i="${i}" style="background-image:url(${url});background-size:${n * 100}% ${n * 100}%;background-position:${(c / (n - 1)) * 100}% ${(r / (n - 1)) * 100}%"></button>`; }).join('');
    $('#jg-info').textContent = Af('jgPlaced', 'Đúng chỗ: {a}/{b}', { a: order.filter((p, i) => p === i).length, b: n * n }); $('#jg-time').textContent = fmtTime(sec);
  }
  function start(l: number): void {
    level = l; n = jigN(l); order = jigShuffle(n); url = artUrl(); (document.getElementById('jg-ref') as HTMLImageElement).src = url; sel = -1; sec = 0; over = false; clearInterval(timer);
    clearBanner(banner); renderLevelBar(levelBar, id, level, start); timer = window.setInterval(() => { sec++; $('#jg-time').textContent = fmtTime(sec); }, 1000); draw();
  }
  grid.addEventListener('click', (e) => {
    if (over) return; const b = (e.target as HTMLElement).closest<HTMLElement>('[data-i]'); if (!b) return; const i = Number(b.dataset.i);
    if (sel < 0) { sel = i; sfx('select'); draw(); return; }
    if (sel !== i) { [order[sel], order[i]] = [order[i], order[sel]]; sfx('place'); }
    sel = -1; draw();
    if (jigDone(order)) { over = true; clearInterval(timer); showBanner(banner, 'win', id, level, WIN(level), start, () => start(level)); renderLevelBar(levelBar, id, level, start); }
  });
  $('#jg-new').addEventListener('click', () => start(level));
  fullscreenButton(); start(level);
}

/* ================================ Golf mini ================================ */
export function mountGolf(id: string): void {
  mountCanvasGame({
    id, W: GOLF_W, H: GOLF_H, pad: [], noteKey: 'note.golf',
    noteFb: 'Bấm vào sân, kéo ngược hướng muốn đánh (như kéo ná) rồi thả để đánh bóng; kéo càng xa, bóng đi càng mạnh. Đưa bóng vào lỗ khi đủ chậm; cát làm bóng chậm lại. Mỗi cấp là một sân, có số gậy giới hạn.',
    init: golfNew, step: golfStep,
    draw: (c, s) => {
      c.fillStyle = '#51a843'; c.fillRect(0, 0, GOLF_W, GOLF_H);
      c.fillStyle = '#e8d28a'; for (const [x, y, w, h] of s.c.sand) { c.beginPath(); c.roundRect(x, y, w, h, 14); c.fill(); }
      c.fillStyle = '#6b4a2b'; for (const [x, y, w, h] of s.c.walls) c.fillRect(x, y, w, h);
      c.fillStyle = '#212529'; c.beginPath(); c.arc(s.c.hole[0], s.c.hole[1], GOLF_HR, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(s.c.hole[0], s.c.hole[1]); c.lineTo(s.c.hole[0], s.c.hole[1] - 40); c.stroke(); c.fillStyle = '#e03131'; c.beginPath(); c.moveTo(s.c.hole[0], s.c.hole[1] - 40); c.lineTo(s.c.hole[0] + 20, s.c.hole[1] - 33); c.lineTo(s.c.hole[0], s.c.hole[1] - 26); c.fill();
      if (s.aim && !s.moving) { c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 3; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(s.bx, s.by); c.lineTo(s.bx + (s.aim.x - s.lastX) * 0.9, s.by + (s.aim.y - s.lastY) * 0.9); c.stroke(); c.setLineDash([]); }
      c.fillStyle = '#fff'; c.beginPath(); c.arc(s.bx, s.by, GOLF_BR, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#adb5bd'; c.lineWidth = 1.5; c.stroke();
    },
    hud: (s) => [Af('golfStrokes', 'Gậy: {n}/{t} (par {p})', { n: s.strokes, t: s.limit, p: s.c.par }), ''],
    score: (s) => (s.sunk ? Math.max(1, 20 - s.strokes) : 0),
  });
  void bestScore;
}
