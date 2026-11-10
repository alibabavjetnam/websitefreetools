/** Giao diện game chữ: đoán từ, Hangman, xếp chữ (10 cấp). Lõi ở calc/words.ts (từ tiếng Anh). */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Ah } from './arcade-ui';
import { sfx } from './sfx';
import { guessCfg, guessWord, hangCfg, hangWord, scoreGuess, scramble, scrambleCfg, wordsOfLen, pick } from '../calc/words';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const win = (banner: HTMLElement, id: string, lv: number, next: (l: number) => void, retry: () => void): void => showBanner(banner, 'win', id, lv, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: lv }), next, retry);
const lose = (banner: HTMLElement, id: string, lv: number, next: (l: number) => void, retry: () => void, extra = ''): void => showBanner(banner, 'lose', id, lv, tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n: lv }) + extra, next, retry);
const kbd = (): string => `<div class="wg-kbd" id="wg-kbd">${ROWS.map((r, i) => `<div class="wg-krow">${i === 2 ? '<button type="button" class="wg-key wide" data-k="Enter">↵</button>' : ''}${r.split('').map((ch) => `<button type="button" class="wg-key" data-k="${ch}">${ch}</button>`).join('')}${i === 2 ? '<button type="button" class="wg-key wide" data-k="Backspace">⌫</button>' : ''}</div>`).join('')}</div>`;

/* ============================ Đoán từ ============================ */
export function mountWordGuess(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main"><div class="game-board-col">
      <div class="game-status"><b id="wg-info"></b><span id="wg-msg" aria-live="polite"></span></div>
      <div class="wg-board" id="wg-board"></div>${kbd()}
    </div><div class="game-side">
      <div class="row"><button type="button" class="btn btn-sm" id="wg-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button></div>
      <p class="note">${Ah('note.wordGuess', 'Đoán từ tiếng Anh bí mật. Sau mỗi lượt, ô xanh là đúng chữ đúng chỗ, ô vàng là có chữ nhưng sai chỗ, ô xám là không có chữ đó. Gõ bằng bàn phím hoặc bấm bàn phím trên màn hình, Enter để gửi. Cấp cao có từ dài hơn và ít lượt hơn.')}</p>
    </div></div>`);
  let level = progressOf(id).unlocked, word = '', rows: string[] = [], cur = '', over = false, cfg = guessCfg(1);
  const keyState: Record<string, number> = {};
  function draw(): void {
    let h = '';
    for (let r = 0; r < cfg.tries; r++) {
      const text = r < rows.length ? rows[r] : r === rows.length ? cur : '', sc = r < rows.length ? scoreGuess(rows[r], word) : [];
      h += `<div class="wg-row">${Array.from({ length: cfg.len }, (_, i) => `<span class="wg-cell${sc[i] === 2 ? ' g' : sc[i] === 1 ? ' y' : r < rows.length ? ' n' : ''}${text[i] ? ' f' : ''}">${(text[i] || '').toUpperCase()}</span>`).join('')}</div>`;
    }
    $('#wg-board').innerHTML = h;
    document.querySelectorAll<HTMLElement>('#wg-kbd .wg-key').forEach((b) => { const s = keyState[b.dataset.k as string]; b.classList.remove('g', 'y', 'n'); if (s !== undefined) b.classList.add(s === 2 ? 'g' : s === 1 ? 'y' : 'n'); });
    $('#wg-info').textContent = tf('lib.game.level', 'Cấp {n}', { n: level }) + ` · ${rows.length}/${cfg.tries}`;
  }
  function start(lv: number): void {
    level = lv; cfg = guessCfg(lv); word = guessWord(lv); rows = []; cur = ''; over = false;
    for (const k of Object.keys(keyState)) delete keyState[k];
    clearBanner(banner); renderLevelBar(levelBar, id, level, start); $('#wg-msg').textContent = ''; draw();
  }
  function key(k: string): void {
    if (over) return;
    if (k === 'Enter') {
      if (cur.length < cfg.len) { $('#wg-msg').textContent = A('tooShort', 'Chưa đủ chữ'); sfx('error'); return; }
      const sc = scoreGuess(cur, word);
      sc.forEach((s, i) => { keyState[cur[i]] = Math.max(keyState[cur[i]] ?? -1, s); });
      rows.push(cur); cur = ''; $('#wg-msg').textContent = ''; sfx(sc.every((s) => s === 2) ? 'combo' : 'flip');
      draw();
      if (sc.every((s) => s === 2)) { over = true; win(banner, id, level, start, () => start(level)); renderLevelBar(levelBar, id, level, start); }
      else if (rows.length >= cfg.tries) { over = true; lose(banner, id, level, start, () => start(level), ' ' + tf('lib.arcade.answerIs', 'Đáp án: {w}', { w: word.toUpperCase() })); }
    } else if (k === 'Backspace') { cur = cur.slice(0, -1); draw(); }
    else if (/^[a-z]$/.test(k) && cur.length < cfg.len) { cur += k; sfx('tap'); draw(); }
  }
  document.addEventListener('keydown', (e) => { const tg = e.target as HTMLElement; if (/INPUT|TEXTAREA/.test(tg.tagName) || e.ctrlKey || e.metaKey) return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (k === 'Enter' || k === 'Backspace' || /^[a-z]$/.test(k)) { if (k === 'Backspace') e.preventDefault(); key(k); } });
  $('#wg-kbd').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-k]'); if (b) key(b.dataset.k as string); });
  $('#wg-new').addEventListener('click', () => start(level));
  fullscreenButton(); start(level);
}

/* ============================ Hangman ============================ */
const GALLOWS = [
  '<line x1="10" y1="190" x2="110" y2="190"/>', '<line x1="30" y1="190" x2="30" y2="20"/>', '<line x1="30" y1="20" x2="120" y2="20"/>', '<line x1="120" y1="20" x2="120" y2="45"/>',
  '<circle cx="120" cy="58" r="13"/>', '<line x1="120" y1="71" x2="120" y2="125"/>', '<line x1="120" y1="85" x2="98" y2="108"/>', '<line x1="120" y1="85" x2="142" y2="108"/>', '<line x1="120" y1="125" x2="102" y2="160"/>', '<line x1="120" y1="125" x2="138" y2="160"/>',
];
export function mountHangman(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main"><div class="game-board-col">
      <div class="game-status"><b id="hg-info"></b><span id="hg-lives"></span></div>
      <svg class="hg-svg" id="hg-svg" viewBox="0 0 180 200" fill="none" stroke="#343a40" stroke-width="5" stroke-linecap="round"></svg>
      <div class="hg-word" id="hg-word"></div>${kbd().replace(/<button[^>]*data-k="(Enter|Backspace)"[^>]*>[^<]*<\/button>/g, '')}
    </div><div class="game-side">
      <div class="row"><button type="button" class="btn btn-sm" id="hg-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button></div>
      <p class="note">${Ah('note.hangman', 'Đoán từ tiếng Anh bí mật bằng cách chọn từng chữ cái. Mỗi chữ sai là thêm một nét vẽ người treo cổ; hết lượt sai là thua. Cấp cao có từ dài hơn và ít lượt sai hơn.')}</p>
    </div></div>`);
  let level = progressOf(id).unlocked, word = '', used = new Set<string>(), wrong = 0, lives = 9, over = false;
  function draw(): void {
    const stage = Math.round((wrong / lives) * (GALLOWS.length - 0)); 
    $('#hg-svg').innerHTML = GALLOWS.slice(0, stage).join('');
    $('#hg-word').innerHTML = word.split('').map((c) => `<span>${used.has(c) || over ? c.toUpperCase() : ''}</span>`).join('');
    $('#hg-lives').textContent = tf('lib.arcade.livesLeft', 'Còn {n} lượt sai', { n: lives - wrong });
    $('#hg-info').textContent = tf('lib.game.level', 'Cấp {n}', { n: level });
    document.querySelectorAll<HTMLButtonElement>('#wg-kbd .wg-key').forEach((b) => { const k = b.dataset.k as string; b.disabled = used.has(k) || over; b.classList.remove('g', 'n'); if (used.has(k)) b.classList.add(word.includes(k) ? 'g' : 'n'); });
  }
  function start(lv: number): void { level = lv; const c = hangCfg(lv); lives = c.lives; word = hangWord(lv); used = new Set(); wrong = 0; over = false; clearBanner(banner); renderLevelBar(levelBar, id, level, start); draw(); }
  function guess(k: string): void {
    if (over || used.has(k) || !/^[a-z]$/.test(k)) return;
    used.add(k);
    if (word.includes(k)) sfx('place'); else { wrong++; sfx('error'); }
    if (word.split('').every((c) => used.has(c))) { over = true; draw(); win(banner, id, level, start, () => start(level)); renderLevelBar(levelBar, id, level, start); return; }
    if (wrong >= lives) { over = true; draw(); lose(banner, id, level, start, () => start(level), ' ' + tf('lib.arcade.answerIs', 'Đáp án: {w}', { w: word.toUpperCase() })); return; }
    draw();
  }
  document.addEventListener('keydown', (e) => { const tg = e.target as HTMLElement; if (/INPUT|TEXTAREA/.test(tg.tagName) || e.ctrlKey || e.metaKey) return; guess(e.key.toLowerCase()); });
  $('#wg-kbd').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-k]'); if (b) guess(b.dataset.k as string); });
  $('#hg-new').addEventListener('click', () => start(level));
  fullscreenButton(); start(level);
}

/* ============================ Xếp chữ ============================ */
export function mountScramble(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main"><div class="game-board-col">
      <div class="game-status"><b id="sc-info"></b><span id="sc-time"></span></div>
      <div class="sc-tiles" id="sc-tiles"></div>
      <form class="sc-form" id="sc-form" autocomplete="off"><input id="sc-in" type="text" maxlength="12" autocapitalize="off" spellcheck="false" aria-label="${escapeHtml(A('yourAnswer', 'Câu trả lời của bạn'))}" /><button type="submit" class="btn btn-primary">OK</button></form>
      <p class="note" id="sc-msg" aria-live="polite"></p>
    </div><div class="game-side">
      <div class="row"><button type="button" class="btn btn-sm" id="sc-hint">${escapeHtml(t('lib.game.hint', 'Gợi ý'))}</button><button type="button" class="btn btn-sm" id="sc-skip">${Ah('skip', 'Bỏ qua')}</button><button type="button" class="btn btn-sm" id="sc-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button></div>
      <p class="note">${Ah('note.scramble', 'Sắp xếp các chữ cái bị xáo trộn thành một từ tiếng Anh có nghĩa và gõ vào ô trả lời. Mỗi cấp có 5 từ, giải đúng ít nhất 4 từ trước khi hết giờ mỗi từ để qua cấp. Gợi ý sẽ cho biết chữ cái đầu.')}</p>
    </div></div>`);
  let level = progressOf(id).unlocked, round = 0, solved = 0, word = '', left = 0, timer = 0, over = false, hinted = false;
  const cfg = (): { rounds: number; len: number; time: number } => scrambleCfg(level);
  function next(): void {
    clearInterval(timer);
    if (round >= cfg().rounds) {
      over = true; const ok = solved >= 4;
      if (ok) { win(banner, id, level, start, () => start(level)); renderLevelBar(levelBar, id, level, start); } else lose(banner, id, level, start, () => start(level));
      return;
    }
    round++; word = pick(wordsOfLen(cfg().len)); hinted = false; left = cfg().time;
    $('#sc-tiles').innerHTML = scramble(word).split('').map((c) => `<span>${c.toUpperCase()}</span>`).join('');
    ($('#sc-in') as HTMLInputElement).value = ''; $('#sc-msg').textContent = '';
    show(); timer = window.setInterval(() => { left--; show(); if (left <= 0) { sfx('lose'); $('#sc-msg').textContent = tf('lib.arcade.answerIs', 'Đáp án: {w}', { w: word.toUpperCase() }); clearInterval(timer); setTimeout(next, 900); } }, 1000);
  }
  function show(): void { $('#sc-info').textContent = tf('lib.arcade.roundN', 'Từ {n}/{t}', { n: round, t: cfg().rounds }) + ` · ✓ ${solved}`; $('#sc-time').textContent = `${Math.max(0, left)}s`; }
  function start(lv: number): void { level = lv; round = 0; solved = 0; over = false; clearBanner(banner); renderLevelBar(levelBar, id, level, start); next(); }
  $('#sc-form').addEventListener('submit', (e) => {
    e.preventDefault(); if (over) return;
    const v = ($('#sc-in') as HTMLInputElement).value.trim().toLowerCase();
    const sort = (s: string): string => s.split('').sort().join('');
    if (v === word || (v.length === word.length && sort(v) === sort(word) && wordsOfLen(word.length).includes(v))) { solved++; sfx('coin'); clearInterval(timer); $('#sc-msg').textContent = '✓'; show(); setTimeout(next, 500); }
    else { sfx('error'); $('#sc-msg').textContent = A('notThis', 'Chưa đúng, thử lại nhé.'); }
  });
  $('#sc-hint').addEventListener('click', () => { if (!over && !hinted) { hinted = true; left = Math.max(1, left - 5); $('#sc-msg').textContent = tf('lib.arcade.startsWith', 'Chữ đầu tiên: {c}', { c: word[0].toUpperCase() }); show(); } });
  $('#sc-skip').addEventListener('click', () => { if (!over) { clearInterval(timer); $('#sc-msg').textContent = tf('lib.arcade.answerIs', 'Đáp án: {w}', { w: word.toUpperCase() }); setTimeout(next, 900); } });
  $('#sc-new').addEventListener('click', () => start(level));
  fullscreenButton(); start(level);
}
