/** Vẽ và gắn 7 game arcade canvas đợt 6 (lõi ở calc/arcade6.ts, khung ở canvasgame.ts). */
import { Af } from './arcade-ui';
import { mountCanvasGame } from './canvasgame';
import {
  BALL_R, BUB_H, BUB_R, BUB_W, CHASE_N, HOOP_H, HOOP_HALF, HOOP_W, HOOP_Y, JUMP_H, JUMP_W, MINE_H, MINE_W, MINE_X, MINE_Y, RACE_H, RACE_W, SLICE_H, SLICE_W,
  bubXY, bubblesNew, bubblesStep, chaseNew, chaseStep, hoopsNew, hoopsStep, jumpNew, jumpStep, laneX, minerNew, minerStep, raceLanes, raceNew, raceStep, slicerNew, slicerStep, walkerPos,
} from '../calc/arcade6';

type Ctx = CanvasRenderingContext2D;
const grad = (c: Ctx, w: number, h: number, a: string, b: string): void => {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, a); g.addColorStop(1, b);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
};
const circle = (c: Ctx, x: number, y: number, r: number, col: string): void => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
const BUB_COLORS = ['#fa5252', '#4dabf7', '#51cf66', '#fcc419', '#cc5de8', '#ff922b'];
const CAR_COLORS = ['#e8590c', '#7048e8', '#0ca678'];

// ── Đua xe ──
export function mountRace(id: string): void {
  mountCanvasGame({
    id, W: RACE_W, H: RACE_H, pad: ['left', 'right'], noteKey: 'note.race',
    noteFb: 'Bấm ← → (hoặc chạm vào làn muốn đi) để đổi làn, né các xe phía trước. Có 3 mạng; chạy đủ quãng đường để qua cấp. Cấp cao có thêm làn và xe chạy nhanh hơn.',
    init: raceNew, step: raceStep,
    draw: (c, s, _l, tm) => {
      const n = raceLanes(s.level);
      c.fillStyle = '#37b24d'; c.fillRect(0, 0, RACE_W, RACE_H);
      c.fillStyle = '#495057'; c.fillRect(20, 0, RACE_W - 40, RACE_H);
      c.strokeStyle = '#f1f3f5'; c.lineWidth = 3; c.setLineDash([26, 22]); c.lineDashOffset = -(tm * 300) % 48;
      for (let i = 1; i < n; i++) { const x = 20 + ((RACE_W - 40) / n) * i; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, RACE_H); c.stroke(); }
      c.setLineDash([]);
      const car = (x: number, y: number, col: string): void => {
        c.fillStyle = col; c.beginPath(); c.roundRect(x - 20, y - 36, 40, 72, 9); c.fill();
        c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(x - 14, y - 20, 28, 14); c.fillRect(x - 14, y + 8, 28, 10);
      };
      for (const k of s.cars) car(laneX(k.lane, n) * 1 + 0, k.y, CAR_COLORS[k.kind]);
      if (!(s.inv > 0 && Math.floor(tm * 12) % 2)) car(s.x, RACE_H - 110, '#fa5252');
      c.fillStyle = 'rgba(255,255,255,.9)'; c.font = '700 22px sans-serif'; c.textAlign = 'left';
      c.fillText('♥'.repeat(Math.max(0, s.lives)), 28, 34);
    },
    hud: (s) => [Af('distance', 'Quãng đường: {n}/{t} m', { n: Math.floor(s.dist), t: s.need }), '♥ ' + s.lives],
    score: (s) => Math.floor(s.dist),
  });
}

// ── Nhảy lên cao ──
export function mountJump(id: string): void {
  mountCanvasGame({
    id, W: JUMP_W, H: JUMP_H, pad: ['left', 'right'], noteKey: 'note.jump',
    noteFb: 'Nhân vật tự nảy lên. Bấm ← → hoặc kéo ngón tay để chuyển sang bệ kế tiếp. Bệ xanh dương di chuyển, bệ nâu vỡ khi chạm. Rơi khỏi màn hình là thua; leo đủ độ cao để qua cấp.',
    init: jumpNew, step: jumpStep,
    draw: (c, s) => {
      grad(c, JUMP_W, JUMP_H, '#a5d8ff', '#e7f5ff');
      const sy = (y: number): number => JUMP_H - (y - s.cam);
      for (const p of s.plats) {
        c.fillStyle = p.kind === 'm' ? '#4dabf7' : p.kind === 'b' ? '#a9703f' : '#51cf66';
        c.beginPath(); c.roundRect(p.x, sy(p.y), p.w, 12, 6); c.fill();
      }
      const px = s.x, py = sy(s.y);
      c.fillStyle = '#ffd43b'; c.beginPath(); c.roundRect(px - 16, py - 38, 32, 38, 10); c.fill();
      circle(c, px - 5 * s.face, py - 26, 4, '#212529'); circle(c, px + 7 * s.face, py - 26, 4, '#212529');
      c.fillStyle = '#212529'; c.fillRect(px - 6, py - 16, 12, 3);
      c.fillStyle = 'rgba(0,0,0,.5)'; c.font = '700 16px sans-serif'; c.textAlign = 'right'; c.fillText(Math.floor(s.top / 10) + ' m', JUMP_W - 10, 24);
    },
    hud: (s) => [Af('height', 'Độ cao: {n}/{t} m', { n: Math.floor(s.top / 10), t: Math.floor(s.need / 10) }), ''],
    score: (s) => Math.floor(s.top / 10),
  });
}

// ── Đào vàng ──
export function mountMiner(id: string): void {
  mountCanvasGame({
    id, W: MINE_W, H: MINE_H, pad: ['drop'], tapIsAction: false, noteKey: 'note.miner',
    noteFb: 'Móc câu đung đưa; bấm phím cách, ↓ hoặc chạm vào sân để thả móc. Vàng to và đá nặng thì kéo chậm; kim cương rất giá trị. Đạt đủ tiền mục tiêu trước khi hết 60 giây.',
    init: minerNew, step: minerStep,
    draw: (c, s) => {
      c.fillStyle = '#a5d8ff'; c.fillRect(0, 0, MINE_W, MINE_Y);
      c.fillStyle = '#8d5524'; c.fillRect(0, MINE_Y, MINE_W, MINE_H - MINE_Y);
      c.fillStyle = '#74421d'; for (let i = 0; i < 30; i++) c.fillRect((i * 83) % MINE_W, MINE_Y + 20 + ((i * 47) % (MINE_H - MINE_Y - 20)), 14, 5);
      for (const i of s.items) {
        if (i.kind === 'rock') { circle(c, i.x, i.y, i.r, '#868e96'); circle(c, i.x - i.r / 3, i.y - i.r / 3, i.r / 3, '#adb5bd'); }
        else if (i.kind === 'gem') { c.fillStyle = '#22b8cf'; c.beginPath(); c.moveTo(i.x, i.y - 12); c.lineTo(i.x + 11, i.y); c.lineTo(i.x, i.y + 12); c.lineTo(i.x - 11, i.y); c.closePath(); c.fill(); }
        else { circle(c, i.x, i.y, i.r, '#fcc419'); circle(c, i.x - i.r / 3, i.y - i.r / 3, i.r / 3.2, '#ffe066'); }
      }
      const ex = MINE_X + Math.sin(s.state === 'swing' ? s.ang : s.dirA) * s.len, ey = MINE_Y + Math.cos(s.state === 'swing' ? s.ang : s.dirA) * s.len;
      c.strokeStyle = '#212529'; c.lineWidth = 3; c.beginPath(); c.moveTo(MINE_X, MINE_Y); c.lineTo(ex, ey); c.stroke();
      circle(c, ex, ey, 6, '#343a40');
      c.fillStyle = '#e03131'; c.fillRect(MINE_X - 16, MINE_Y - 22, 32, 22);
    },
    hud: (s) => [Af('money', 'Tiền: {n}/{t}', { n: s.money, t: s.need }), Af('timeLeft', 'Còn {n} giây', { n: Math.max(0, Math.ceil(s.time)) })],
    score: (s) => s.money,
  });
}

// ── Cắt trái cây ──
export function mountSlicer(id: string): void {
  mountCanvasGame({
    id, W: SLICE_W, H: SLICE_H, pad: [], noteKey: 'note.slicer',
    noteFb: 'Kéo ngón tay hoặc chuột ngang qua trái cây để cắt. Tránh quả bom đen. Để rơi mất trái cây hoặc cắt trúng bom sẽ mất 1 mạng (3 mạng). Cắt đủ số quả để qua cấp.',
    init: slicerNew, step: slicerStep,
    draw: (c, s) => {
      grad(c, SLICE_W, SLICE_H, '#364fc7', '#1b2a6b');
      for (const f of s.fruits) {
        if (f.bomb) { circle(c, f.x, f.y, f.r, '#212529'); c.fillStyle = '#f03e3e'; c.fillRect(f.x - 2, f.y - f.r - 8, 4, 8); continue; }
        const col = `hsl(${f.hue},75%,55%)`;
        if (f.cut) { const d = f.half * 90; c.fillStyle = col; c.beginPath(); c.arc(f.x - d, f.y + d * 2, f.r, Math.PI / 2, Math.PI * 1.5); c.fill(); c.beginPath(); c.arc(f.x + d, f.y + d * 2, f.r, -Math.PI / 2, Math.PI / 2); c.fill(); }
        else { circle(c, f.x, f.y, f.r, col); circle(c, f.x - f.r / 3, f.y - f.r / 3, f.r / 4, 'rgba(255,255,255,.4)'); }
      }
      c.lineCap = 'round';
      for (let i = 1; i < s.trail.length; i++) { const a = s.trail[i - 1], b = s.trail[i]; c.strokeStyle = `rgba(255,255,255,${Math.max(0, b.t / 0.18)})`; c.lineWidth = 6 * (b.t / 0.18) + 1; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
      c.fillStyle = '#fff'; c.font = '700 22px sans-serif'; c.textAlign = 'left'; c.fillText('♥'.repeat(Math.max(0, s.lives)), 12, 30);
    },
    hud: (s) => [Af('sliced', 'Đã cắt: {n}/{t}', { n: s.sliced, t: s.need }), '♥ ' + s.lives],
    score: (s) => s.sliced,
  });
}

// ── Ném bóng rổ ──
export function mountHoops(id: string): void {
  mountCanvasGame({
    id, W: HOOP_W, H: HOOP_H, pad: [], noteKey: 'note.hoops',
    noteFb: 'Bấm vào sân rồi kéo ngón tay/chuột xuống dưới (kiểu ná cao su) và thả ra để ném bóng lên rổ. Kéo càng xa, bóng bay càng mạnh. Ghi đủ số bóng với số lần ném giới hạn; từ cấp 4 rổ di chuyển.',
    init: hoopsNew, step: hoopsStep,
    draw: (c, s) => {
      grad(c, HOOP_W, HOOP_H, '#ffe8cc', '#ffd8a8');
      c.fillStyle = '#868e96'; c.fillRect(s.hx - 6, HOOP_Y - 80, 12, 4);
      c.fillStyle = '#f8f9fa'; c.fillRect(s.hx - HOOP_HALF, HOOP_Y - 90, HOOP_HALF * 2, 60); c.strokeStyle = '#e03131'; c.lineWidth = 3; c.strokeRect(s.hx - 16, HOOP_Y - 50, 32, 20);
      c.strokeStyle = s.swish > 0 ? '#51cf66' : '#e8590c'; c.lineWidth = 5; c.beginPath(); c.moveTo(s.hx - HOOP_HALF, HOOP_Y); c.lineTo(s.hx + HOOP_HALF, HOOP_Y); c.stroke();
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1.5; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(s.hx + k * 14, HOOP_Y); c.lineTo(s.hx + k * 8, HOOP_Y + 36); c.stroke(); }
      if (s.aim && !s.flying) {
        c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 3; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(s.bx, s.by);
        const px = s.bx - (s.lastX - s.aim.x) * 4.2 * 0.18, py = s.by - (s.lastY - s.aim.y) * 4.2 * 0.18; c.lineTo(px, py); c.stroke(); c.setLineDash([]);
      }
      circle(c, s.bx, s.by, BALL_R, '#f76707'); c.strokeStyle = '#7c2d12'; c.lineWidth = 2; c.beginPath(); c.arc(s.bx, s.by, BALL_R, 0, Math.PI * 2); c.moveTo(s.bx - BALL_R, s.by); c.lineTo(s.bx + BALL_R, s.by); c.stroke();
    },
    hud: (s) => [Af('hoopScore', 'Ghi: {n}/{t}', { n: s.score, t: s.need }), Af('shotsLeft', 'Còn {n} lần ném', { n: s.shots })],
    score: (s) => s.score,
  });
}

// ── Bắn bóng màu ──
export function mountBubbles(id: string): void {
  mountCanvasGame({
    id, W: BUB_W, H: BUB_H, pad: ['left', 'right', 'fire'], tapIsAction: true, noteKey: 'note.bubbles',
    noteFb: 'Di chuột/ngón tay để ngắm, bấm hoặc nhấn cách/Bắn để bắn. Nối từ 3 bóng cùng màu trở lên để làm nổ; bóng mất chỗ bám sẽ rơi. Hàng bóng tụt dần xuống, đừng để chạm vạch đáy. Xoá hết bóng để qua cấp.',
    init: bubblesNew, step: bubblesStep,
    draw: (c, s) => {
      grad(c, BUB_W, BUB_H, '#1b1f3b', '#0b0d1f');
      for (let r = 0; r < s.grid.length; r++) for (let q = 0; q < s.grid[r].length; q++) { const v = s.grid[r][q]; if (v >= 0) { const [x, y] = bubXY(r, q, s.par); circle(c, x, y, BUB_R - 1, BUB_COLORS[v]); circle(c, x - 6, y - 6, 5, 'rgba(255,255,255,.4)'); } }
      for (const p of s.popped) { c.globalAlpha = Math.max(0, p.t * 2); circle(c, p.x, p.y, BUB_R * (1.5 - p.t), BUB_COLORS[p.c]); c.globalAlpha = 1; }
      c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 2; c.setLineDash([6, 8]); c.beginPath(); c.moveTo(0, 13 * 35 + 6); c.lineTo(BUB_W, 13 * 35 + 6); c.stroke(); c.setLineDash([]);
      if (!s.flying) { c.strokeStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.moveTo(BUB_W / 2, BUB_H - 30); c.lineTo(BUB_W / 2 + Math.cos(s.aim) * 90, BUB_H - 30 + Math.sin(s.aim) * 90); c.stroke(); }
      circle(c, s.flying ? s.bx : BUB_W / 2, s.flying ? s.by : BUB_H - 30, BUB_R - 1, BUB_COLORS[s.cur]);
      circle(c, 40, BUB_H - 24, 12, BUB_COLORS[s.next]);
    },
    hud: (s) => [Af('bubbleLeft', 'Còn {n} bóng', { n: s.grid.reduce((a, r) => a + r.filter((v) => v >= 0).length, 0) }), Af('shotsN', 'Lượt bắn: {n}', { n: s.shots })],
    score: (s) => s.shots,
  });
}

// ── Ăn chấm ──
export function mountChase(id: string): void {
  const U = 44, W = CHASE_N * U;
  mountCanvasGame({
    id, W, H: W, pad: ['up', 'left', 'down', 'right'], noteKey: 'note.chase',
    noteFb: 'Dùng phím mũi tên (hoặc vuốt/nút) để đổi hướng và ăn hết chấm trong mê cung, tránh các con ma đang đuổi. Có 3 mạng; càng lên cấp có thêm ma, ma chạy nhanh và đuổi thông minh hơn.',
    init: chaseNew, step: chaseStep,
    draw: (c, s, _l, tm) => {
      c.fillStyle = '#0b1026'; c.fillRect(0, 0, W, W);
      c.strokeStyle = '#4263eb'; c.lineWidth = 3; c.lineCap = 'round';
      for (let r = 0; r < CHASE_N; r++) for (let q = 0; q < CHASE_N; q++) {
        const w = s.walls[r * CHASE_N + q], x = q * U, y = r * U;
        c.beginPath();
        if (w & 1) { c.moveTo(x, y); c.lineTo(x + U, y); }
        if (w & 2) { c.moveTo(x + U, y); c.lineTo(x + U, y + U); }
        if (w & 4) { c.moveTo(x, y + U); c.lineTo(x + U, y + U); }
        if (w & 8) { c.moveTo(x, y); c.lineTo(x, y + U); }
        c.stroke();
      }
      c.fillStyle = '#ffe066';
      s.dots.forEach((d) => { c.beginPath(); c.arc((d % CHASE_N) * U + U / 2, Math.floor(d / CHASE_N) * U + U / 2, 4, 0, Math.PI * 2); c.fill(); });
      const [mx, my] = walkerPos(s.me);
      if (!(s.inv > 0 && Math.floor(tm * 12) % 2)) {
        const x = mx * U + U / 2, y = my * U + U / 2;
        circle(c, x, y, U * 0.34, '#20c997'); circle(c, x - 7, y - 5, 5, '#fff'); circle(c, x + 7, y - 5, 5, '#fff'); circle(c, x - 7, y - 5, 2.4, '#212529'); circle(c, x + 7, y - 5, 2.4, '#212529');
        c.strokeStyle = '#087f5b'; c.lineWidth = 2; c.beginPath(); c.arc(x, y + 3, 7, 0.2, Math.PI - 0.2); c.stroke();
      }
      const gc = ['#fa5252', '#ff8787', '#74c0fc', '#69db7c'];
      s.ghosts.forEach((g, i) => {
        const [gx, gy] = walkerPos(g), x = gx * U + U / 2, y = gy * U + U / 2;
        c.fillStyle = gc[i]; c.beginPath(); c.moveTo(x, y - U * 0.38);
        for (let k = 0; k < 8; k++) { const an = (k / 8) * Math.PI * 2 - Math.PI / 2, r1 = k % 2 ? U * 0.3 : U * 0.4; c.lineTo(x + Math.cos(an) * r1, y + Math.sin(an) * r1); }
        c.closePath(); c.fill();
        circle(c, x - 6, y - 3, 4, '#fff'); circle(c, x + 6, y - 3, 4, '#fff'); circle(c, x - 6, y - 3, 2, '#212529'); circle(c, x + 6, y - 3, 2, '#212529');
      });
    },
    hud: (s) => [Af('dotsLeft', 'Còn {n} chấm', { n: s.dots.size }), '♥ ' + s.lives],
    score: (s) => s.total - s.dots.size,
  });
}
