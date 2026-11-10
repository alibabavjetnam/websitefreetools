/** Giao diện đợt 10: Backgammon (cờ xúc xắc, đánh với máy) và Tiến lên. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import type { Card } from '../calc/solitaire';
import { OFF, bgAi, bgApply, bgMaxLen, bgClone, bgMoves, bgNew, bgPip, bgRoll, tlAi, tlBeats, tlClassify, tlNew, tlPass, tlPlay, type BG, type BMove, type Tl, type TCard } from '../calc/games10';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah } from './arcade-ui';
import { back, face } from './casino-ui';
import { sfx } from './sfx';

const WIN = (n: number): string => tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n });
const LOSE = (n: number): string => tf('lib.game.lose', 'Chưa vượt qua cấp {n}. Thử lại nhé.', { n });
const wait = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));
const newBtn = (id: string): string => `<button type="button" class="btn" id="${id}">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>`;

/* ================================ Backgammon ================================ */
const colX = (col: number): number => (col < 6 ? col * 48 : col * 48 + 48);
export function mountBackgammon(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main"><div class="game-board-col">
      <div class="game-status"><b id="bg-status"></b><span id="bg-info"></span></div>
      <svg class="bg-svg gboard" id="bg-svg" viewBox="0 0 624 420" role="group"></svg>
      <div class="bg-dice" id="bg-dice"></div>
    </div><div class="game-side">
      <div class="row"><button type="button" class="btn btn-primary" id="bg-roll">${Ah('bgRoll', 'Tung xúc xắc')}</button><button type="button" class="btn" id="bg-off" hidden>${Ah('bgOff', 'Đưa quân ra')}</button>${newBtn('bg-new')}</div>
      <p class="note" id="bg-msg" aria-live="polite"></p>
      <p class="note">${Ah('note.backgammon', 'Bạn cầm quân trắng, đi từ góc trên bên phải vòng xuống góc dưới bên phải (về nhà). Tung xúc xắc rồi bấm quân muốn đi và bấm ô đích sáng lên. Đáp xuống ô có đúng 1 quân đối phương thì bắt quân đó vào thanh giữa, đối phương phải đưa quân trở lại trước. Không đáp được vào ô có từ 2 quân đối phương. Khi cả 15 quân đã về nhà (6 ô cuối) thì được đưa quân ra khỏi bàn. Ai đưa hết 15 quân ra trước là thắng.')}</p>
    </div></div>`);
  let level = progressOf(id).unlocked, g: BG = bgNew(), sel = -2, busy = false, over = false, token = 0;
  const svg = $('#bg-svg');
  const allowed = (): BMove[] => { const mv = bgMoves(g, 0), need = bgMaxLen(g, 0); return mv.filter((m) => { const c = bgClone(g); bgApply(c, 0, m); return 1 + bgMaxLen(c, 0) >= need; }); };
  function render(): void {
    const moves = !busy && !over && g.turn === 0 && g.rolled ? allowed() : [], dest = new Set(sel === -2 ? [] : moves.filter((m) => m.from === sel).map((m) => m.to)), src = new Set(moves.map((m) => m.from));
    let h = '<rect width="624" height="420" fill="#8d5a2b"/><rect x="288" width="48" height="420" fill="#5c3a1a"/>';
    for (let p = 0; p < 24; p++) {
      const top = p >= 12, col = top ? p - 12 : 11 - p, x = colX(col), y0 = top ? 0 : 420, y1 = top ? 160 : 260, cls = (dest.has(p) ? ' dst' : '') + (sel === p ? ' sel' : '');
      h += `<g class="bg-pt${cls}" data-p="${p}"><polygon points="${x},${y0} ${x + 48},${y0} ${x + 24},${y1}" fill="${(col + (top ? 1 : 0)) % 2 ? '#e8d5a8' : '#b5482a'}"/><rect x="${x}" y="${top ? 0 : 260}" width="48" height="160" fill="transparent"/>`;
      const n = Math.abs(g.pts[p]), human = g.pts[p] > 0;
      for (let k = 0; k < Math.min(n, 5); k++) { const cy = top ? 22 + k * 40 : 398 - k * 40; h += `<circle cx="${x + 24}" cy="${cy}" r="19" fill="${human ? '#f8f9fa' : '#212529'}" stroke="${human ? '#343a40' : '#868e96'}" stroke-width="2"${src.has(p) && human && k === Math.min(n, 5) - 1 ? ' class="bg-can"' : ''}/>`; }
      if (n > 5) h += `<text x="${x + 24}" y="${top ? 22 + 4 * 40 + 6 : 398 - 4 * 40 + 6}" text-anchor="middle" font-size="16" font-weight="700" fill="${human ? '#212529' : '#fff'}">${n}</text>`;
      if (dest.has(p)) h += `<circle cx="${x + 24}" cy="${top ? 22 + Math.min(n, 5) * 40 : 398 - Math.min(n, 5) * 40}" r="10" fill="#ffd43b" opacity=".9"/>`;
      h += '</g>';
    }
    h += `<g class="bg-pt${src.has(-1) ? ' src' : ''}${sel === -1 ? ' sel' : ''}" data-p="-1"><rect x="288" y="0" width="48" height="420" fill="transparent"/>`;
    for (let k = 0; k < g.bar[0]; k++) h += `<circle cx="312" cy="${300 + k * 36}" r="17" fill="#f8f9fa" stroke="#343a40" stroke-width="2"/>`;
    for (let k = 0; k < g.bar[1]; k++) h += `<circle cx="312" cy="${120 - k * 36}" r="17" fill="#212529" stroke="#868e96" stroke-width="2"/>`;
    h += '</g>';
    svg.innerHTML = h;
    $('#bg-info').textContent = Af('bgInfo', 'Ra: bạn {a} · máy {b} · Pip: {c} / {d}', { a: g.off[0], b: g.off[1], c: bgPip(g, 0), d: bgPip(g, 1) });
    $('#bg-dice').innerHTML = g.dice.map((d) => `<span class="bg-die">${d}</span>`).join('') || '';
    ($('#bg-roll') as HTMLElement).hidden = !(g.turn === 0 && !g.rolled && !busy && !over);
    ($('#bg-off') as HTMLElement).hidden = !(sel !== -2 && dest.has(OFF));
    if (!over) $('#bg-status').textContent = g.turn === 0 ? (g.rolled ? t('lib.game.yourTurn', 'Đến lượt bạn') : A('bgRollFirst', 'Hãy tung xúc xắc')) : t('lib.game.thinking', 'Máy đang nghĩ…');
  }
  function end(): void { over = true; render(); $('#bg-status').textContent = ''; if (g.winner === 0) { showBanner(banner, 'win', id, level, WIN(level), start, () => start(level)); renderLevelBar(levelBar, id, level, start); } else showBanner(banner, 'lose', id, level, LOSE(level), start, () => start(level)); }
  async function aiTurn(my: number): Promise<void> {
    g.turn = 1; g.rolled = false; g.dice = []; busy = true; render(); await wait(700); if (my !== token) return;
    bgRoll(g); sfx('roll'); render(); await wait(700); if (my !== token) return;
    const seq = bgAi(g, 1, level);
    if (!seq.length) $('#bg-msg').textContent = A('aiNoMove', 'Máy không đi được.');
    for (const m of seq) { bgApply(g, 1, m); sfx(m.to === OFF ? 'coin' : 'place'); render(); await wait(650); if (my !== token) return; if (g.winner >= 0) { busy = false; return end(); } }
    g.dice = []; g.turn = 0; g.rolled = false; busy = false; sel = -2; $('#bg-msg').textContent = ''; render();
  }
  async function afterHuman(my: number): Promise<void> {
    sel = -2; render(); if (g.winner >= 0) return end();
    if (!g.dice.length || !bgMoves(g, 0).length) { if (g.dice.length) { $('#bg-msg').textContent = A('youNoMove', 'Bạn không còn nước đi hợp lệ.'); busy = true; render(); await wait(1000); if (my !== token) return; } busy = false; await aiTurn(my); }
  }
  svg.addEventListener('click', (e) => {
    if (busy || over || g.turn !== 0 || !g.rolled) return;
    const el = (e.target as Element).closest<SVGElement>('[data-p]'); if (!el) return;
    const p = Number(el.getAttribute('data-p')), mv = allowed(), my = token;
    if (sel !== -2) { const m = mv.find((x) => x.from === sel && x.to === p); if (m) { bgApply(g, 0, m); sfx(m.to === OFF ? 'coin' : 'place'); void afterHuman(my); return; } }
    if (mv.some((m) => m.from === p)) { sel = p; sfx('select'); render(); } else { sel = -2; render(); }
  });
  $('#bg-off').addEventListener('click', () => { if (sel === -2) return; const m = allowed().filter((x) => x.from === sel && x.to === OFF).sort((a, b) => a.die - b.die)[0]; if (m) { bgApply(g, 0, m); sfx('coin'); void afterHuman(token); } });
  $('#bg-roll').addEventListener('click', () => {
    if (g.turn !== 0 || g.rolled) return; bgRoll(g); sfx('roll'); $('#bg-msg').textContent = ''; render();
    if (!allowed().length) { void (async () => { const my = token; busy = true; $('#bg-msg').textContent = A('youNoMove', 'Bạn không còn nước đi hợp lệ.'); render(); await wait(1200); if (my !== token) return; busy = false; await aiTurn(my); })(); }
  });
  function start(l: number): void { level = l; token++; g = bgNew(); sel = -2; busy = false; over = false; $('#bg-msg').textContent = ''; clearBanner(banner); renderLevelBar(levelBar, id, level, start); render(); }
  $('#bg-new').addEventListener('click', () => start(level));
  fullscreenButton(); start(level);
}

/* ================================ Tiến lên ================================ */
const toCard = (c: TCard): Card => ({ r: c.r === 14 ? 1 : c.r === 15 ? 2 : c.r, s: c.s, up: true, id: c.id });
export function mountTienLen(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main"><div class="game-board-col">
      <div class="game-status"><b id="tl-status"></b><span id="tl-info"></span></div>
      <div class="sol-board gboard cz-board tl-board" id="tl-board" style="--cw:50px"></div>
    </div><div class="game-side">
      <div class="row"><button type="button" class="btn btn-primary" id="tl-play">${Ah('tlPlay', 'Đánh bài')}</button><button type="button" class="btn" id="tl-pass">${Ah('tlPass', 'Bỏ lượt')}</button><button type="button" class="btn btn-sm" id="tl-clear">${Ah('tlClear', 'Bỏ chọn')}</button>${newBtn('tl-new')}</div>
      <p class="note" id="tl-msg" aria-live="polite"></p>
      <p class="note">${Ah('note.tienlen', 'Bốn người, mỗi người 13 lá; thứ tự lá từ nhỏ đến lớn: 3, 4, … K, A, 2; chất từ nhỏ đến lớn: bích, chuồn, rô, cơ. Người có 3 bích đi trước. Đánh một lá, đôi, sám (3 lá), tứ quý hoặc dãy từ 3 lá liên tiếp (không có 2). Người sau phải đánh cùng loại và lớn hơn, hoặc bỏ lượt; tứ quý chặt được một lá 2 hoặc đôi 2. Khi mọi người bỏ lượt, người đánh cuối được đánh bất kỳ. Ai hết bài trước là thắng; chọn các lá rồi bấm Đánh bài.')}</p>
    </div></div>`);
  let level = progressOf(id).unlocked, g: Tl = tlNew(1), selIds = new Set<number>(), busy = false, token = 0, over = false;
  const board = $('#tl-board'), nm = (i: number): string => (i === 0 ? A('you', 'Bạn') : `${A('opponent', 'Đối thủ')} ${i}`);
  function render(): void {
    const my = g.turn === 0 && !busy && !over;
    const opp = [1, 2, 3].map((i) => `<div class="tl-opp${g.turn === i ? ' active' : ''}"><span class="cz-lbl">${escapeHtml(nm(i))} · ${g.hands[i].length}${g.passed[i] ? ' · ' + escapeHtml(A('tlPassed', 'bỏ lượt')) : ''}</span><div class="cz-hand">${g.hands[i].slice(0, 13).map(() => back()).join('')}</div></div>`).join('');
    board.innerHTML = `<div class="tl-opps">${opp}</div><div class="cz-row tl-table"><span class="cz-lbl">${g.table ? escapeHtml(nm(g.tableBy)) : escapeHtml(A('tlFree', 'Bàn trống — bạn dẫn bài tự do'))}</span><div class="cz-hand">${g.table ? g.table.cards.map((c) => face(toCard(c))).join('') : ''}</div></div>
      <div class="cz-row"><span class="cz-lbl">${Ah('you', 'Bạn')} · ${g.hands[0].length}</span><div class="cz-hand tl-hand">${g.hands[0].map((c) => face(toCard(c), (selIds.has(c.id) ? 'selected ' : '') + (my ? 'playable' : ''), `data-id="${c.id}"`)).join('')}</div></div>`;
    ($('#tl-play') as HTMLButtonElement).disabled = !my; ($('#tl-pass') as HTMLButtonElement).disabled = !my || !g.table;
    $('#tl-info').textContent = Af('tlLeft', 'Còn lại: {a} · {b} · {c}', { a: g.hands[1].length, b: g.hands[2].length, c: g.hands[3].length });
    if (!over) $('#tl-status').textContent = g.turn === 0 ? t('lib.game.yourTurn', 'Đến lượt bạn') : t('lib.game.thinking', 'Máy đang nghĩ…');
  }
  function end(): void { over = true; render(); $('#tl-status').textContent = ''; if (g.winner === 0) { showBanner(banner, 'win', id, level, WIN(level), start, () => start(level)); renderLevelBar(levelBar, id, level, start); } else showBanner(banner, 'lose', id, level, LOSE(level), start, () => start(level)); }
  async function run(my: number): Promise<void> {
    while (my === token && !over && g.turn !== 0 && g.winner < 0) {
      busy = true; render(); await wait(850); if (my !== token) return;
      const who = g.turn, c = tlAi(g, who, level);
      if (c) { tlPlay(g, who, c); sfx(c.kind === 'quad' ? 'boom' : 'flip'); $('#tl-msg').textContent = ''; }
      else if (g.table) { tlPass(g, who); $('#tl-msg').textContent = Af('tlAiPass', '{p} bỏ lượt.', { p: nm(who) }); }
      else tlPass(g, who);
      if (g.winner >= 0) { busy = false; return end(); }
    }
    busy = false; if (!over) render();
  }
  board.addEventListener('click', (e) => {
    if (busy || over || g.turn !== 0) return; const el = (e.target as HTMLElement).closest<HTMLElement>('[data-id]'); if (!el) return;
    const i = Number(el.dataset.id); if (selIds.has(i)) selIds.delete(i); else selIds.add(i); sfx('select'); render();
  });
  $('#tl-clear').addEventListener('click', () => { selIds.clear(); render(); });
  $('#tl-play').addEventListener('click', () => {
    if (busy || over || g.turn !== 0) return;
    const cards = g.hands[0].filter((c) => selIds.has(c.id)), cmb = tlClassify(cards);
    if (!cmb) { sfx('error'); $('#tl-msg').textContent = A('tlBad', 'Các lá chọn chưa tạo thành bộ hợp lệ.'); return; }
    if (!tlBeats(g.table, cmb)) { sfx('error'); $('#tl-msg').textContent = A('tlLow', 'Bộ này chưa đủ lớn để đánh trên bàn.'); return; }
    tlPlay(g, 0, cmb); selIds.clear(); sfx(cmb.kind === 'quad' ? 'boom' : 'flip'); $('#tl-msg').textContent = ''; render();
    if (g.winner >= 0) return end(); void run(token);
  });
  $('#tl-pass').addEventListener('click', () => { if (busy || over || g.turn !== 0 || !g.table) return; tlPass(g, 0); selIds.clear(); $('#tl-msg').textContent = ''; render(); void run(token); });
  function start(l: number): void { level = l; token++; g = tlNew(l); selIds = new Set(); busy = false; over = false; $('#tl-msg').textContent = ''; clearBanner(banner); renderLevelBar(levelBar, id, level, start); render(); void run(token); }
  $('#tl-new').addEventListener('click', () => start(level));
  fullscreenButton(); start(level);
}
