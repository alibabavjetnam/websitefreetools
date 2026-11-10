/** Giao diện Tangram: kéo 7 mảnh ghép vào hình bóng. */
import { $, escapeHtml } from '../ui';
import { t, tf } from '../i18n';
import { BASE, bbox, centroid, genSolution, hasOutline, isSolved, piecesFor, worldPts, type Placed, type Pt } from '../calc/tangram';
import { clearBanner, fullscreenButton, gameShell, progressOf, renderLevelBar, showBanner } from './game-ui';
import { A, Af, Ah } from './arcade-ui';
import { sfx } from './sfx';

const COLORS: Record<string, string> = { bigA: '#e03131', bigB: '#1c7ed6', med: '#2f9e44', sm1: '#f59f00', sq: '#7048e8', par: '#d6336c', sm2: '#0ca678' };
const VW = 26, VH = 16;

export function mountTangram(id: string): void {
  const { levelBar, banner } = gameShell(`
    <div class="game-main"><div class="game-board-col">
      <div class="game-status"><b id="tg-info"></b><span id="tg-cnt"></span></div>
      <svg class="tg-svg gboard" id="tg-svg" viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg"></svg>
    </div><div class="game-side">
      <div class="row">
        <button type="button" class="btn btn-sm" id="tg-l">${escapeHtml(A('tgRotL', 'Xoay trái'))}</button>
        <button type="button" class="btn btn-sm" id="tg-r">${escapeHtml(A('tgRotR', 'Xoay phải'))}</button>
        <button type="button" class="btn btn-sm" id="tg-f">${escapeHtml(A('tgFlip', 'Lật'))}</button>
      </div>
      <div class="row">
        <button type="button" class="btn btn-sm" id="tg-hint">${escapeHtml(t('lib.game.hint', 'Gợi ý'))}</button>
        <button type="button" class="btn" id="tg-new">${escapeHtml(t('lib.game.newGame', 'Ván mới'))}</button>
      </div>
      <p class="note">${Ah('note.tangram', 'Ghép đủ 7 mảnh (ở cấp thấp chỉ vài mảnh) vừa khít vào hình bóng màu xám, không chồng lên nhau. Kéo một mảnh để di chuyển; bấm nhẹ vào mảnh để xoay 45°, hoặc dùng nút Xoay và Lật (hình bình hành cần lật đúng chiều). Thả mảnh gần góc nào thì nó tự hít vào góc đó. Cấp 1–4 có đường viền gợi ý sẵn; nút Gợi ý bật/tắt đường viền.')}</p>
    </div></div>`);
  fullscreenButton();
  document.querySelector('.game-main')?.classList.add('tg-main');
  const svg = document.getElementById('tg-svg') as unknown as SVGSVGElement;
  let level = progressOf(id).unlocked, sol: Placed[] = [], solP: Pt[][] = [], mine: Placed[] = [], sel = -1, over = false, outline = true;
  const rnd = Math.random;

  function start(l: number): void {
    level = l; over = false; sel = -1; outline = hasOutline(level); clearBanner(banner); renderLevelBar(levelBar, id, level, start);
    const raw = genSolution(piecesFor(level), rnd);
    const bb = bbox(raw.map(worldPts)), w = bb[2] - bb[0], h = bb[3] - bb[1];
    const k = Math.min(1, 11.5 / w, 14 / h), cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
    const scaled = (p: Placed): Placed => ({ ...p, base: p.base.map(([x, y]): Pt => [x * k, y * k]), x: (p.x - cx) * k + 6.5, y: (p.y - cy) * k + 8 });
    sol = raw.map(scaled); solP = sol.map(worldPts);
    const slots = sol.map((_, i) => [16.2 + 5 * (i % 2), 2.8 + 4.1 * Math.floor(i / 2)]);
    for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
    mine = sol.map((p, i) => {
      const c = centroid(p.base);
      return { id: p.id, kind: p.kind, base: p.base, rot: Math.floor(rnd() * 8) * 45, mirror: p.kind === 'par' && rnd() < 0.5, x: slots[i][0] - c[0], y: slots[i][1] - c[1] };
    });
    draw();
  }
  const pts = (p: Pt[]): string => p.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(' ');
  function draw(): void {
    let h = `<rect x="0" y="0" width="${VW}" height="${VH}" rx="0.4" class="tg-bg"/><line x1="13.2" y1="0.4" x2="13.2" y2="${VH - 0.4}" class="tg-div"/>`;
    h += solP.map((p) => `<polygon points="${pts(p)}" class="tg-sil"/>`).join('');
    if (outline) h += solP.map((p) => `<polygon points="${pts(p)}" class="tg-out"/>`).join('');
    h += mine.map((m, i) => `<polygon data-i="${i}" points="${pts(worldPts(m))}" class="tg-pc${i === sel ? ' sel' : ''}" fill="${COLORS[m.kind]}"/>`).join('');
    svg.innerHTML = h;
    $('#tg-info').textContent = tf('lib.game.level', 'Cấp {n}', { n: level });
    $('#tg-cnt').textContent = Af('tgPieces', 'Số mảnh: {n}', { n: mine.length });
  }
  const toSvg = (e: PointerEvent): Pt => { const r = svg.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * VW, ((e.clientY - r.top) / r.height) * VH]; };

  let drag: { i: number; ox: number; oy: number; sx: number; sy: number; moved: boolean } | null = null;
  svg.addEventListener('pointerdown', (e) => {
    if (over) return;
    const el = (e.target as Element).closest('polygon.tg-pc') as SVGElement | null; if (!el) { sel = -1; draw(); return; }
    e.preventDefault();
    const i = Number(el.dataset.i), m = mine[i], [px, py] = toSvg(e);
    // đưa mảnh lên trên cùng
    mine.splice(i, 1); mine.push(m); sel = mine.length - 1;
    drag = { i: sel, ox: m.x - px, oy: m.y - py, sx: px, sy: py, moved: false };
    svg.setPointerCapture(e.pointerId); draw();
  });
  svg.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const [px, py] = toSvg(e), m = mine[drag.i];
    if (Math.hypot(px - drag.sx, py - drag.sy) > 0.25) drag.moved = true;
    if (!drag.moved) return;
    m.x = drag.ox + px; m.y = drag.oy + py;
    const el = svg.querySelector(`polygon[data-i="${drag.i}"]`); if (el) el.setAttribute('points', pts(worldPts(m)));
  });
  const end = (): void => {
    if (!drag) return;
    const m = mine[drag.i], moved = drag.moved; drag = null;
    if (!moved) rotate(45); else { snap(m); sfx('place'); draw(); check(); }
  };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);

  function snap(m: Placed): void {
    const mine0 = worldPts(m), targets: Pt[] = [...solP.flat(), ...mine.filter((o) => o !== m).flatMap(worldPts)];
    let best = 0.45, dx = 0, dy = 0, hit = false;
    for (const a of mine0) for (const b of targets) { const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (d < best) { best = d; dx = b[0] - a[0]; dy = b[1] - a[1]; hit = true; } }
    if (hit) { m.x += dx; m.y += dy; }
  }
  function rotate(deg: number): void {
    if (over || sel < 0) return;
    mine[sel].rot = (mine[sel].rot + deg + 360) % 360; sfx('tap'); snap(mine[sel]); draw(); check();
  }
  function check(): void {
    if (over || !isSolved(solP, mine.map(worldPts))) return;
    over = true; sel = -1; draw();
    showBanner(banner, 'win', id, level, tf('lib.game.win', 'Bạn đã vượt qua cấp {n}!', { n: level }), start, () => start(level));
    renderLevelBar(levelBar, id, level, start);
  }
  $('#tg-l').addEventListener('click', () => rotate(-45));
  $('#tg-r').addEventListener('click', () => rotate(45));
  $('#tg-f').addEventListener('click', () => { if (over || sel < 0) return; mine[sel].mirror = !mine[sel].mirror; sfx('tap'); snap(mine[sel]); draw(); check(); });
  $('#tg-hint').addEventListener('click', () => { outline = !outline; draw(); });
  $('#tg-new').addEventListener('click', () => start(level));
  void BASE;
  start(level);
}
