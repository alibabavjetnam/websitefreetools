/** Giao diện 5 game kỹ năng đợt 4 (DOM): đập chuột, Simon, tập ngắm, toán nhanh, phản xạ. Mỗi game 10 cấp. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah, bestScore } from './arcade-ui';
import { noteSfx, sfx } from './sfx';
import { SIMON_FREQ, aimCfg, mathCfg, mathQuestion, reactCfg, simonCfg, whackCfg } from '../calc/skill4';

const WIN = (n: number): string => tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n });
const LOSE = (n: number): string => tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n });
const wait = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

interface Frame { levelBar: HTMLElement; banner: HTMLElement; setStatus: (l: string, r?: string) => void; level: number }
function frame(id: string, inner: string, note: string, extra = ''): Frame {
  const { levelBar, banner } = gameShell(`
    <div class="game-main">
      <div class="game-board-col">
        <div class="game-status"><b id="sk-status"></b><span id="sk-score"></span></div>
        ${inner}
      </div>
      <div class="game-side">${extra}<p class="note">${escapeHtml(note)}</p></div>
    </div>`);
  document.querySelector<HTMLElement>('.game-wrap')?.setAttribute('data-sfx', 'own');
  return { levelBar, banner, level: progressOf(id).unlocked, setStatus: (l, r = '') => { $('#sk-status').textContent = l; $('#sk-score').textContent = r; } };
}

// ───────────── Đập chuột ─────────────
export function mountWhack(id: string): void {
  const f = frame(id, `<div class="wk-board gboard" id="wk-board"></div>`,
    A('note.whack-a-mole', 'Chuột nhô lên từ các hang — bấm vào chuột để đập. Đập đủ số chuột trước khi hết giờ. Từ cấp 4 có quả bom: bấm trúng bom bị trừ điểm.'),
    `<div class="row"><button type="button" class="btn btn-primary" id="wk-start">${escapeHtml(t('lib.game.start', 'Bắt đầu'))}</button></div>`);
  const board = $('#wk-board');
  let level = f.level, token = 0, hits = 0, left = 0, holes: HTMLButtonElement[] = [], kinds: ('' | 'm' | 'b')[] = [];
  function build(): void {
    const c = whackCfg(level);
    board.style.setProperty('--cols', String(c.cols));
    holes = []; kinds = [];
    board.innerHTML = '';
    for (let i = 0; i < c.cols * c.rows; i++) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'wk-hole'; b.setAttribute('aria-label', A('hole', 'Hang'));
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); whack(i); });
      board.appendChild(b); holes.push(b); kinds.push('');
    }
  }
  function status(): void { const c = whackCfg(level); f.setStatus(Af('hitsN', 'Đã đập: {n}/{t}', { n: hits, t: c.need }), `${Math.max(0, Math.ceil(left))}s`); }
  function whack(i: number): void {
    if (!token || !kinds[i]) return;
    if (kinds[i] === 'm') { hits++; sfx('hit'); holes[i].className = 'wk-hole smash'; }
    else { hits = Math.max(0, hits - 2); sfx('boom'); holes[i].className = 'wk-hole blast'; }
    kinds[i] = ''; status();
    window.setTimeout(() => { if (!kinds[i]) holes[i].className = 'wk-hole'; }, 220);
  }
  async function start(lv: number): Promise<void> {
    level = lv; const my = ++token; hits = 0;
    clearBanner(f.banner); renderLevelBar(f.levelBar, id, level, (l) => void start(l));
    const c = whackCfg(level); build(); left = c.secs; status(); sfx('select');
    const t0 = performance.now();
    while (my === token) {
      left = c.secs - (performance.now() - t0) / 1000; status();
      if (hits >= c.need) { token = 0; bestScore(id, level).put(Math.round(left * 10)); showBanner(f.banner, 'win', id, level, WIN(level), (l) => void start(l), () => void start(level)); renderLevelBar(f.levelBar, id, level, (l) => void start(l)); return; }
      if (left <= 0) { token = 0; showBanner(f.banner, 'lose', id, level, LOSE(level), (l) => void start(l), () => void start(level)); return; }
      const free = kinds.map((k, i) => (k ? -1 : i)).filter((i) => i >= 0);
      if (free.length) {
        const i = free[Math.floor(Math.random() * free.length)], bomb = Math.random() < c.bomb;
        kinds[i] = bomb ? 'b' : 'm'; holes[i].className = `wk-hole up ${bomb ? 'bomb' : 'mole'}`; sfx('pop');
        window.setTimeout(() => { if (my === token && kinds[i]) { kinds[i] = ''; holes[i].className = 'wk-hole'; } }, c.up);
      }
      await wait(c.every * (0.7 + Math.random() * 0.6));
    }
  }
  $('#wk-start').addEventListener('click', () => void start(level));
  fullscreenButton();
  void start(level);
}

// ───────────── Simon ─────────────
export function mountSimon(id: string): void {
  const COLORS = ['#e03131', '#2f9e44', '#f08c00', '#1971c2', '#9c36b5', '#0c8599'];
  const f = frame(id, `<div class="sm-board gboard" id="sm-board"></div>`,
    A('note.simon', 'Máy phát một dãy màu và âm thanh — bạn nhớ rồi bấm lại đúng thứ tự. Mỗi lượt dãy dài thêm một nút. Nhớ đủ độ dài yêu cầu là qua cấp. Từ cấp 7 có 6 nút.'),
    `<div class="row"><button type="button" class="btn btn-primary" id="sm-start">${escapeHtml(t('lib.game.start', 'Bắt đầu'))}</button></div>`);
  const board = $('#sm-board');
  let level = f.level, token = 0, seq: number[] = [], input = 0, accept = false, pads: HTMLButtonElement[] = [];
  function build(n: number): void {
    board.innerHTML = ''; pads = [];
    board.style.setProperty('--cols', n === 4 ? '2' : '3');
    for (let i = 0; i < n; i++) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sm-pad'; b.style.setProperty('--c', COLORS[i]); b.setAttribute('aria-label', String(i + 1));
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); void press(i); });
      board.appendChild(b); pads.push(b);
    }
  }
  async function flash(i: number, ms: number): Promise<void> {
    pads[i].classList.add('lit'); noteSfx(SIMON_FREQ[i], ms / 1000 + 0.1);
    await wait(ms * 0.7); pads[i].classList.remove('lit'); await wait(ms * 0.3);
  }
  async function press(i: number): Promise<void> {
    if (!accept) return;
    const my = token, c = simonCfg(level);
    if (seq[input] !== i) {
      accept = false; sfx('error'); pads[i].classList.add('bad'); await wait(500); pads[i].classList.remove('bad');
      if (my !== token) return; token = 0;
      showBanner(f.banner, 'lose', id, level, LOSE(level), (l) => void start(l), () => void start(level)); return;
    }
    pads[i].classList.add('lit'); noteSfx(SIMON_FREQ[i], 0.25); window.setTimeout(() => pads[i].classList.remove('lit'), 180);
    input++;
    if (input === seq.length) {
      accept = false; bestScore(id, level).put(seq.length);
      if (seq.length >= c.need) { token = 0; showBanner(f.banner, 'win', id, level, WIN(level), (l) => void start(l), () => void start(level)); renderLevelBar(f.levelBar, id, level, (l) => void start(l)); return; }
      sfx('coin'); await wait(650); if (my === token) void round();
    }
  }
  async function round(): Promise<void> {
    const my = token, c = simonCfg(level);
    accept = false; input = 0; seq.push(Math.floor(Math.random() * c.pads));
    f.setStatus(Af('seqN', 'Dãy: {n}/{t}', { n: seq.length, t: c.need }), A('watch', 'Hãy xem…'));
    await wait(500);
    for (const i of seq) { if (my !== token) return; await flash(i, c.step); }
    if (my !== token) return;
    accept = true; f.setStatus(Af('seqN', 'Dãy: {n}/{t}', { n: seq.length, t: c.need }), A('yourTurnShort', 'Đến lượt bạn'));
  }
  function start(lv: number): void {
    level = lv; token++; seq = []; accept = false;
    clearBanner(f.banner); renderLevelBar(f.levelBar, id, level, start);
    build(simonCfg(level).pads); sfx('select'); void round();
  }
  $('#sm-start').addEventListener('click', () => start(level));
  fullscreenButton();
  start(level);
}

// ───────────── Tập ngắm ─────────────
export function mountAim(id: string): void {
  const f = frame(id, `<div class="aim-box gboard" id="aim-box"></div>`,
    A('note.aim-trainer', 'Bia hiện ngẫu nhiên và biến mất nhanh — bấm trúng càng nhiều càng tốt. Bia ngày càng nhỏ và nhanh. Trúng đủ số bia trước khi trượt quá 5 lần là qua cấp.'),
    `<div class="row"><button type="button" class="btn btn-primary" id="aim-start">${escapeHtml(t('lib.game.start', 'Bắt đầu'))}</button></div>`);
  const box = $('#aim-box');
  let level = f.level, token = 0, hits = 0, miss = 0, times: number[] = [];
  function status(): void {
    const c = aimCfg(level), avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
    f.setStatus(Af('hitsN', 'Đã đập: {n}/{t}', { n: hits, t: c.need }), `${Af('missN', 'Trượt: {n}/{t}', { n: miss, t: c.misses })}${avg ? ` · ${avg} ms` : ''}`);
  }
  function end(win: boolean): void {
    token = 0; box.innerHTML = '';
    if (win) { bestScore(id, level).put(Math.max(1, 2000 - Math.round(times.reduce((a, b) => a + b, 0) / Math.max(1, times.length)))); showBanner(f.banner, 'win', id, level, WIN(level), (l) => void start(l), () => void start(level)); renderLevelBar(f.levelBar, id, level, (l) => void start(l)); }
    else showBanner(f.banner, 'lose', id, level, LOSE(level), (l) => void start(l), () => void start(level));
  }
  async function start(lv: number): Promise<void> {
    level = lv; const my = ++token; hits = 0; miss = 0; times = [];
    clearBanner(f.banner); renderLevelBar(f.levelBar, id, level, (l) => void start(l));
    const c = aimCfg(level); box.innerHTML = ''; status(); sfx('select');
    box.onpointerdown = (e) => {
      if (my !== token || (e.target as HTMLElement).classList.contains('aim-t')) return;
      miss++; sfx('error'); status(); if (miss > c.misses) end(false);
    };
    await wait(700);
    while (my === token) {
      const tg = document.createElement('button');
      tg.type = 'button'; tg.className = 'aim-t'; tg.setAttribute('aria-label', A('aimTarget', 'Bia'));
      tg.style.width = tg.style.height = '0';
      const sz = c.size, x = 4 + Math.random() * (92 - sz), y = 4 + Math.random() * (92 - sz * 0.75);
      tg.style.left = `${x}%`; tg.style.top = `${y}%`; tg.style.setProperty('--sz', `${sz}%`);
      box.appendChild(tg); const born = performance.now(); sfx('tick');
      let done = false;
      const ok = await new Promise<boolean>((res) => {
        tg.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); done = true; res(true); });
        window.setTimeout(() => res(false), c.life);
      });
      if (my !== token) return;
      tg.remove();
      if (ok && done) { hits++; times.push(performance.now() - born); sfx('hit'); } else { miss++; sfx('warn'); }
      status();
      if (hits >= c.need) return end(true);
      if (miss > c.misses) return end(false);
      await wait(120 + Math.random() * 380);
    }
  }
  $('#aim-start').addEventListener('click', () => void start(level));
  fullscreenButton();
  void start(level);
}

// ───────────── Toán nhanh ─────────────
export function mountQuickMath(id: string): void {
  const f = frame(id, `<div class="qm-box gboard" id="qm-box">
      <div class="qm-bar"><i id="qm-fill"></i></div>
      <div class="qm-q" id="qm-q">&nbsp;</div>
      <form class="qm-form" id="qm-form"><input id="qm-in" type="text" inputmode="numeric" autocomplete="off" aria-label="${escapeHtml(A('answer', 'Đáp án'))}"><button type="submit" class="btn btn-primary">OK</button></form>
    </div>`,
    A('note.quick-math', 'Tính nhẩm càng nhanh càng tốt: gõ đáp án rồi bấm Enter. Mỗi câu có giới hạn thời gian; sai hoặc hết giờ mất một mạng (3 mạng). Trả lời đủ số câu đúng là qua cấp.'),
    `<div class="row"><button type="button" class="btn btn-primary" id="qm-start">${escapeHtml(t('lib.game.start', 'Bắt đầu'))}</button></div>`);
  const input = $('#qm-in') as HTMLInputElement;
  let level = f.level, token = 0, ok = 0, lives = 3, q = mathQuestion(1), deadline = 0, raf = 0, answered = false;
  function status(): void { f.setStatus(Af('correctN', 'Đúng: {n}/{t}', { n: ok, t: mathCfg(level).need }), '♥'.repeat(Math.max(0, lives))); }
  function next(): void {
    q = mathQuestion(level); $('#qm-q').textContent = `${q.text} = ?`;
    input.value = ''; input.focus(); answered = false;
    deadline = performance.now() + mathCfg(level).secs * 1000;
  }
  function judge(good: boolean): void {
    if (answered || !token) return; answered = true;
    if (good) { ok++; sfx('coin'); } else { lives--; sfx('error'); $('#qm-q').textContent = `${q.text} = ${q.answer}`; }
    status();
    const c = mathCfg(level), my = token;
    if (ok >= c.need) { token = 0; cancelAnimationFrame(raf); bestScore(id, level).put(ok * 10 + lives); showBanner(f.banner, 'win', id, level, WIN(level), start, () => start(level)); renderLevelBar(f.levelBar, id, level, start); return; }
    if (lives <= 0) { token = 0; cancelAnimationFrame(raf); showBanner(f.banner, 'lose', id, level, LOSE(level), start, () => start(level)); return; }
    window.setTimeout(() => { if (my === token) next(); }, good ? 150 : 900);
  }
  function tick(): void {
    if (!token) return;
    const c = mathCfg(level), frac = Math.max(0, (deadline - performance.now()) / (c.secs * 1000));
    ($('#qm-fill') as HTMLElement).style.transform = `scaleX(${answered ? 0 : frac})`;
    if (!answered && frac <= 0) judge(false);
    raf = requestAnimationFrame(tick);
  }
  function start(lv: number): void {
    level = lv; token++; ok = 0; lives = 3; cancelAnimationFrame(raf);
    clearBanner(f.banner); renderLevelBar(f.levelBar, id, level, start);
    status(); sfx('select'); next(); raf = requestAnimationFrame(tick);
  }
  $('#qm-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value.trim().replace(/[^\d-]/g, '');
    if (v === '' || answered) return;
    judge(Number(v) === q.answer);
  });
  $('#qm-start').addEventListener('click', () => start(level));
  fullscreenButton();
  start(level);
}

// ───────────── Phản xạ ─────────────
export function mountReaction(id: string): void {
  const f = frame(id, `<button type="button" class="rx-box gboard" id="rx-box" data-s="idle"></button>`,
    A('note.reaction', 'Chờ màn hình chuyển sang xanh lá rồi bấm thật nhanh. Bấm sớm bị tính là phạm lỗi (tối đa 3 lỗi). Thời gian trung bình 5 lượt phải đạt ngưỡng của cấp.'),
    `<div class="row"><button type="button" class="btn btn-primary" id="rx-start">${escapeHtml(t('lib.game.start', 'Bắt đầu'))}</button></div>`);
  const box = $('#rx-box') as HTMLButtonElement;
  let level = f.level, token = 0, times: number[] = [], fouls = 0, state: 'idle' | 'wait' | 'go' | 'between' = 'idle', goAt = 0, timer = 0;
  const set = (s: typeof state, cls: string, msg: string): void => { state = s; box.dataset.s = cls; box.textContent = msg; };
  function status(): void { const c = reactCfg(level); f.setStatus(Af('roundN', 'Lượt {n}/{t}', { n: Math.min(c.rounds, times.length + 1), t: c.rounds }), Af('limitMs', 'Ngưỡng: {n} ms', { n: c.limit })); }
  function arm(): void {
    const my = token; set('wait', 'wait', A('rxWait', 'Chờ màu xanh…'));
    timer = window.setTimeout(() => { if (my !== token) return; goAt = performance.now(); set('go', 'go', A('rxGo', 'BẤM!')); sfx('shoot'); }, 1200 + Math.random() * 2800);
  }
  function finish(): void {
    const c = reactCfg(level), avg = times.reduce((a, b) => a + b, 0) / times.length;
    token = 0; set('idle', 'idle', `${Math.round(avg)} ms`);
    if (avg <= c.limit) { bestScore(id, level).put(Math.max(1, 1000 - Math.round(avg))); showBanner(f.banner, 'win', id, level, WIN(level), start, () => start(level)); renderLevelBar(f.levelBar, id, level, start); }
    else showBanner(f.banner, 'lose', id, level, LOSE(level), start, () => start(level));
  }
  box.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const c = reactCfg(level);
    if (state === 'wait') {
      window.clearTimeout(timer); fouls++; sfx('error');
      if (fouls >= c.fouls) { token = 0; set('idle', 'early', A('rxEarly', 'Bấm sớm quá!')); showBanner(f.banner, 'lose', id, level, LOSE(level), start, () => start(level)); return; }
      set('between', 'early', A('rxEarly', 'Bấm sớm quá!')); const my = token; window.setTimeout(() => { if (my === token) arm(); }, 1000);
    } else if (state === 'go') {
      const ms = Math.round(performance.now() - goAt); times.push(ms); sfx('coin');
      set('between', 'idle', `${ms} ms`);
      if (times.length >= c.rounds) { window.setTimeout(finish, 700); state = 'between'; return; }
      status(); const my = token; window.setTimeout(() => { if (my === token) arm(); }, 1000);
    }
  });
  function start(lv: number): void {
    level = lv; token++; times = []; fouls = 0; window.clearTimeout(timer);
    clearBanner(f.banner); renderLevelBar(f.levelBar, id, level, start); status(); sfx('select'); arm();
  }
  $('#rx-start').addEventListener('click', () => start(level));
  fullscreenButton();
  void Ah; void escapeHtml;
  start(level);
}
