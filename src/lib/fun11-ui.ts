/** Giao diện đợt 11: Thủ thành, Tô màu theo số. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { PICS, TD_C, TD_H, TD_W, picCells, picColors, picDone, picGoal, tdNew, tdPos, tdStep, towerCost, towerDmg, towerRange, upgradeCost } from '../calc/arcade11';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah } from './arcade-ui';
import { mountCanvasGame } from './canvasgame';
import { sfx } from './sfx';

export function mountTowerDefense(id: string): void {
  mountCanvasGame({
    id, W: TD_W, H: TD_H, pad: [], tapIsAction: false, noteKey: 'note.td',
    noteFb: 'Chạm vào ô trống (không phải đường đi) để đặt tháp bắn, tốn vàng; chạm lại vào tháp để nâng cấp (tối đa cấp 5). Tháp tự bắn kẻ địch đi xa nhất trong tầm. Tiêu diệt kẻ địch để nhận thêm vàng; để lọt 15 kẻ địch về đích là thua. Sống sót qua mọi đợt để qua cấp.',
    init: tdNew, step: tdStep,
    draw: (c, s) => {
      c.fillStyle = '#5eb04e'; c.fillRect(0, 0, TD_W, TD_H);
      c.fillStyle = '#d9b27c'; s.pathCells.forEach((k) => c.fillRect((k % 12) * TD_C, Math.floor(k / 12) * TD_C, TD_C, TD_C));
      c.strokeStyle = 'rgba(0,0,0,.06)'; c.lineWidth = 1; for (let i = 1; i < 12; i++) { c.beginPath(); c.moveTo(i * TD_C, 0); c.lineTo(i * TD_C, TD_H); c.stroke(); } for (let j = 1; j < 15; j++) { c.beginPath(); c.moveTo(0, j * TD_C); c.lineTo(TD_W, j * TD_C); c.stroke(); }
      for (const t2 of s.towers) {
        const x = t2.cx * TD_C + TD_C / 2, y = t2.cy * TD_C + TD_C / 2;
        c.fillStyle = '#495057'; c.beginPath(); c.arc(x, y, 15, 0, Math.PI * 2); c.fill(); c.fillStyle = ['#fab005', '#fd7e14', '#e03131', '#7048e8', '#212529'][t2.lvl - 1]; c.beginPath(); c.arc(x, y, 10, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#fff'; c.font = '700 11px sans-serif'; c.textAlign = 'center'; c.fillText(String(t2.lvl), x, y + 4);
      }
      for (const f of s.foes) { const [x, y] = tdPos(s, f.d); c.fillStyle = f.fast ? '#1c7ed6' : '#c92a2a'; c.beginPath(); c.arc(x, y, f.fast ? 9 : 12, 0, Math.PI * 2); c.fill(); c.fillStyle = '#212529'; c.fillRect(x - 12, y - 19, 24, 4); c.fillStyle = '#51cf66'; c.fillRect(x - 12, y - 19, 24 * Math.max(0, f.hp / f.max), 4); }
      c.lineWidth = 3; for (const sh of s.shots) { c.strokeStyle = `rgba(255,236,153,${Math.min(1, sh.t / 0.12)})`; c.beginPath(); c.moveTo(sh.x1, sh.y1); c.lineTo(sh.x2, sh.y2); c.stroke(); }
      void towerRange; void towerDmg;
    },
    hud: (s) => [Af('tdInfo', 'Vàng: {g} · Đợt {w}/{t}', { g: s.gold, w: s.wave, t: s.waves }), `♥ ${s.lives} · ${Af('tdCost', 'Tháp: {n}', { n: towerCost(s) })}`],
    score: (s) => s.wave * 10 + s.lives,
  });
  void upgradeCost;
}

export function mountColorNum(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main"><div class="game-board-col">
      <div class="game-status"><b id="cn-info"></b><span id="cn-left"></span></div>
      <div class="cn-grid gboard" id="cn-grid"></div>
    </div><div class="game-side">
      <div class="cn-pal" id="cn-pal"></div>
      <div class="row"><button type="button" class="btn btn-sm" id="cn-hint">${escapeHtml(t('lib.game.hint', 'Gợi ý'))}</button>${`<button type="button" class="btn" id="cn-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>`}</div>
      <p class="note" id="cn-msg" aria-live="polite"></p>
      <p class="note">${Ah('note.colorNum', 'Mỗi ô có một con số ứng với một màu trong bảng màu. Chọn màu rồi bấm vào các ô mang số đó để tô; bấm sai màu thì ô sẽ không được tô. Tô đúng hết các ô để hoàn thành bức tranh. Cấp càng cao càng nhiều màu và nhiều ô.')}</p>
    </div></div>`);
  let level = progressOf(id).unlocked, g: string[] = [], pick = '1', over = false;
  const grid = $('#cn-grid'), pal = $('#cn-pal'), pic = (): (typeof PICS)[number] => PICS[level - 1];
  function draw(): void {
    const p = pic(), n = p.rows.length;
    (grid as HTMLElement).style.setProperty('--n', String(n));
    grid.innerHTML = p.rows.join('').split('').map((goal, i) => goal === '.' ? '<span class="cn-e"></span>' : `<button type="button" class="cn-c${g[i] ? ' done' : ''}${goal === pick && !g[i] ? ' hl' : ''}" data-i="${i}" style="${g[i] ? `background:${p.pal[g[i]]}` : ''}">${g[i] ? '' : goal}</button>`).join('');
    pal.innerHTML = picColors(p).map((k) => `<button type="button" class="cn-sw${k === pick ? ' sel' : ''}" data-k="${k}" style="background:${p.pal[k]}"><b>${k}</b></button>`).join('');
    $('#cn-info').textContent = tf('lib.game.level', 'Cấp {n}', { n: level });
    $('#cn-left').textContent = tf('lib.arcade.cellsLeft', 'Còn {n} ô trống', { n: picCells(p) - g.filter(Boolean).length });
  }
  function start(l: number): void { level = l; g = new Array(pic().rows.length ** 2).fill(''); pick = picColors(pic())[0]; over = false; $('#cn-msg').textContent = ''; clearBanner(banner); renderLevelBar(levelBar, id, level, start); draw(); }
  function paint(i: number, k: string): void {
    if (over || g[i]) return;
    if (picGoal(pic(), i) !== k) { sfx('error'); $('#cn-msg').textContent = A('cnWrong', 'Sai màu rồi — kiểm tra lại con số trên ô.'); return; }
    g[i] = k; sfx('place'); $('#cn-msg').textContent = ''; draw();
    if (picDone(pic(), g)) { over = true; showBanner(banner, 'win', id, level, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), start, () => start(level)); renderLevelBar(levelBar, id, level, start); }
  }
  grid.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-i]'); if (b) paint(Number(b.dataset.i), pick); });
  pal.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-k]'); if (b) { pick = b.dataset.k as string; sfx('select'); draw(); } });
  $('#cn-hint').addEventListener('click', () => { const i = g.findIndex((v, j) => !v && picGoal(pic(), j) !== '.'); if (i >= 0) { pick = picGoal(pic(), i); paint(i, pick); } });
  $('#cn-new').addEventListener('click', () => start(level));
  fullscreenButton(); start(level);
}
