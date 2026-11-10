/** Vẽ và gắn 7 game arcade canvas đợt 4 (lõi ở calc/arcade4.ts, khung ở canvasgame.ts). */
import { Af } from './arcade-ui';
import { mountCanvasGame } from './canvasgame';
import {
  AST_H, AST_W, FLAP_GROUND, FLAP_H, FLAP_R, FLAP_W, FLAP_X, MAZE_N, PONG_H, PONG_TARGET, PONG_W, ROAD_COLS, ROAD_GOALS, ROAD_ROWS, RUN_DINO_W, RUN_GROUND, RUN_H, RUN_W, RUN_X, SHMUP_H, SHMUP_W,
  astNew, astStep, flapGap, flapNew, flapStep, mazeNew, mazePath, mazeStep, pongNew, pongStep, rockR, roadNew, roadStep, runNew, runSpeed, runStep, shmupNew, shmupStep,
} from '../calc/arcade4';

type Ctx = CanvasRenderingContext2D;
const bg = (c: Ctx, w: number, h: number, a: string, b: string): void => {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, a); g.addColorStop(1, b);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
};
const stars = (c: Ctx, w: number, h: number, time: number, n = 40): void => {
  c.fillStyle = 'rgba(255,255,255,.7)';
  for (let i = 0; i < n; i++) { const x = (i * 97) % w, y = ((i * 53 + time * (20 + (i % 5) * 12)) % h); c.fillRect(x, y, i % 3 ? 1.5 : 2.5, i % 3 ? 1.5 : 2.5); }
};
const ship = (c: Ctx, x: number, y: number, s: number, col: string, up = true): void => {
  c.save(); c.translate(x, y); if (!up) c.scale(1, -1);
  c.fillStyle = col; c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.8, s * 0.8); c.lineTo(0, s * 0.4); c.lineTo(-s * 0.8, s * 0.8); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(0, -s * 0.1, s * 0.22, 0, Math.PI * 2); c.fill();
  c.restore();
};

// ── Pong ──
export function mountPong(id: string): void {
  mountCanvasGame({
    id, W: PONG_W, H: PONG_H, pad: ['left', 'right'], noteKey: 'note.pong',
    noteFb: 'Di chuột, kéo ngón tay hoặc dùng phím ← → để điều khiển thanh dưới. Đánh bóng qua mặt máy; ai ghi 5 điểm trước thì thắng. Bóng càng lúc càng nhanh.',
    init: pongNew, step: pongStep,
    draw: (c, s) => {
      bg(c, PONG_W, PONG_H, '#10233f', '#0a1428');
      c.setLineDash([10, 12]); c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, PONG_H / 2); c.lineTo(PONG_W, PONG_H / 2); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#ffd43b'; c.beginPath(); c.roundRect(s.ax - 40, 40 - 12, 80, 12, 6); c.fill();
      c.fillStyle = '#4dabf7'; c.beginPath(); c.roundRect(s.px - s.pw / 2, PONG_H - 40, s.pw, 12, 6); c.fill();
      c.shadowColor = '#fff'; c.shadowBlur = 14; c.fillStyle = '#fff'; c.beginPath(); c.arc(s.bx, s.by, 8, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
      c.fillStyle = 'rgba(255,255,255,.35)'; c.font = '700 64px sans-serif'; c.textAlign = 'center';
      c.fillText(String(s.as), PONG_W / 2, PONG_H / 2 - 40); c.fillText(String(s.ps), PONG_W / 2, PONG_H / 2 + 90);
    },
    hud: (s) => [Af('pongScore', 'Bạn {a} – {b} Máy (tới {t})', { a: s.ps, b: s.as, t: PONG_TARGET }), ''],
    score: (s) => s.ps * 100 - s.as * 40,
  });
}

// ── Bắn phi thuyền ──
export function mountShmup(id: string): void {
  mountCanvasGame({
    id, W: SHMUP_W, H: SHMUP_H, pad: ['left', 'right'], noteKey: 'note.space-shooter',
    noteFb: 'Di chuột, kéo ngón tay hoặc dùng phím ← → để lái tàu; tàu tự bắn. Hạ đủ số tàu địch để qua cấp, tránh va chạm và đạn địch. Bạn có 3 mạng.',
    init: shmupNew, step: shmupStep,
    draw: (c, s, _l, tm) => {
      bg(c, SHMUP_W, SHMUP_H, '#070b1f', '#1b1140'); stars(c, SHMUP_W, SHMUP_H, tm);
      c.fillStyle = '#ffec99'; for (const b of s.bullets) c.fillRect(b.x - 2, b.y - 8, 4, 14);
      c.fillStyle = '#ff6b6b'; for (const b of s.ebullets) { c.beginPath(); c.arc(b.x, b.y, 5, 0, Math.PI * 2); c.fill(); }
      for (const e of s.enemies) ship(c, e.x, e.y, 16, e.kind ? '#e599f7' : '#ff8787', false);
      for (const p of s.sparks) { c.strokeStyle = `rgba(255,200,60,${p.t / 0.3})`; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y, 34 * (1 - p.t / 0.3) + 6, 0, Math.PI * 2); c.stroke(); }
      if (s.inv <= 0 || Math.floor(tm * 12) % 2) ship(c, s.x, SHMUP_H - 44, 18, '#69db7c');
    },
    hud: (s) => [Af('kills', 'Hạ: {n}/{t}', { n: s.kills, t: s.need }), '♥'.repeat(Math.max(0, s.lives))],
    score: (s) => s.kills * 10,
  });
}

// ── Tiểu hành tinh ──
export function mountAsteroids(id: string): void {
  mountCanvasGame({
    id, W: AST_W, H: AST_H, pad: ['left', 'right', 'up', 'fire'], noteKey: 'note.asteroids',
    noteFb: '← → để xoay tàu, ↑ để tăng tốc, phím cách để bắn. Phá hết đá vũ trụ để qua cấp; đá lớn vỡ thành đá nhỏ. Tàu bay vòng qua mép sân. Bạn có 3 mạng.',
    init: astNew, step: astStep,
    draw: (c, s, _l, tm) => {
      bg(c, AST_W, AST_H, '#050816', '#0d1233'); stars(c, AST_W, AST_H, tm * 0.2, 30);
      c.strokeStyle = '#ced4da'; c.lineWidth = 2;
      for (const r of s.rocks) {
        const R = rockR(r.size); c.beginPath();
        for (let i = 0; i < 9; i++) { const a = r.a + (i / 9) * Math.PI * 2, k = R * (0.78 + 0.22 * Math.sin(i * 2.3 + r.size)); c.lineTo(r.x + Math.cos(a) * k, r.y + Math.sin(a) * k); }
        c.closePath(); c.stroke();
      }
      c.fillStyle = '#ffe066'; for (const b of s.bullets) { c.beginPath(); c.arc(b.x, b.y, 2.5, 0, Math.PI * 2); c.fill(); }
      if (s.inv <= 0 || Math.floor(tm * 12) % 2) {
        c.save(); c.translate(s.x, s.y); c.rotate(s.a); c.strokeStyle = '#69db7c'; c.lineWidth = 2.2;
        c.beginPath(); c.moveTo(14, 0); c.lineTo(-10, 9); c.lineTo(-5, 0); c.lineTo(-10, -9); c.closePath(); c.stroke(); c.restore();
      }
    },
    hud: (s) => [Af('rocksLeft', 'Còn {n} đá', { n: s.rocks.length }), '♥'.repeat(Math.max(0, s.lives))],
    score: (s) => s.score,
  });
}

// ── Mê cung ──
export function mountMaze(id: string): void {
  const W = 480;
  mountCanvasGame({
    id, W, H: W, pad: ['up', 'left', 'down', 'right'], noteKey: 'note.maze',
    noteFb: 'Dùng phím mũi tên (hoặc vuốt, hoặc các nút) để đi từ ô xanh lá tới ô cờ đỏ trước khi hết giờ. Từ cấp 5 mê cung bị sương mù: chỉ thấy quanh mình, các ô đã đi qua được nhớ lại.',
    init: mazeNew, step: mazeStep,
    draw: (c, m) => {
      const n = m.n, cs = W / n;
      c.fillStyle = '#10151f'; c.fillRect(0, 0, W, W);
      const path = new Set(m.steps > 400 ? [] : []);
      void path;
      c.lineCap = 'round'; c.strokeStyle = '#a5d8ff'; c.lineWidth = Math.max(2, cs * 0.12);
      for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) {
        const i = r * n + q, vis = !m.fog || m.seen[i];
        if (!vis) continue;
        const near = !m.fog || (r - m.r) ** 2 + (q - m.c) ** 2 <= m.fog * m.fog;
        c.globalAlpha = near ? 1 : 0.4;
        const x = q * cs, y = r * cs, w = m.walls[i];
        c.beginPath();
        if (w & 1) { c.moveTo(x, y); c.lineTo(x + cs, y); }
        if (w & 2) { c.moveTo(x + cs, y); c.lineTo(x + cs, y + cs); }
        if (w & 4) { c.moveTo(x, y + cs); c.lineTo(x + cs, y + cs); }
        if (w & 8) { c.moveTo(x, y); c.lineTo(x, y + cs); }
        c.stroke();
      }
      c.globalAlpha = 1;
      c.fillStyle = '#fa5252'; c.font = `${cs * 0.7}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('⚑', W - cs / 2, W - cs / 2);
      c.fillStyle = '#69db7c'; c.beginPath(); c.arc(m.c * cs + cs / 2, m.r * cs + cs / 2, cs * 0.3, 0, Math.PI * 2); c.fill();
    },
    hud: (m) => [Af('timeLeft', 'Còn {n} giây', { n: Math.max(0, Math.ceil(m.time)) }), Af('stepsN', 'Bước: {n}', { n: m.steps })],
    score: (m) => (m.r === m.n - 1 && m.c === m.n - 1 ? Math.round(m.time * 10) : 0),
  });
  void MAZE_N; void mazePath;
}

// ── Qua đường ──
export function mountRoad(id: string): void {
  const CS = 44, W = ROAD_COLS * CS, H = ROAD_ROWS * CS;
  mountCanvasGame({
    id, W, H, pad: ['up', 'left', 'down', 'right'], noteKey: 'note.road-cross',
    noteFb: 'Dùng phím mũi tên, vuốt hoặc các nút để nhảy chú ếch từ dưới lên trên. Tránh xe cộ; từ cấp 5 phần trên là sông, phải nhảy lên các khúc gỗ trôi. Về đích 3 lần để qua cấp, bạn có 3 mạng.',
    init: roadNew, step: roadStep,
    draw: (c, s) => {
      for (const ln of s.lanes) {
        const y = ln.row * CS;
        c.fillStyle = ln.kind === 'river' ? '#1c4f8f' : ln.kind === 'road' ? '#343a40' : ln.row === 0 ? '#2b8a3e' : '#5c940d';
        c.fillRect(0, y, W, CS);
        if (ln.kind === 'road') { c.fillStyle = 'rgba(255,255,255,.18)'; for (let x = 0; x < W; x += 40) c.fillRect(x, y + CS - 2, 22, 2); }
        for (const it of ln.items) {
          const x = it.x * CS;
          if (ln.kind === 'river') { c.fillStyle = '#8d5524'; c.beginPath(); c.roundRect(x + 2, y + 6, it.len * CS - 4, CS - 12, 8); c.fill(); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x + 8, y + 12, it.len * CS - 16, 4); }
          else { c.fillStyle = it.len > 1 ? '#fcc419' : (Math.floor(it.x * 7 + ln.row) % 2 ? '#ff6b6b' : '#74c0fc'); c.beginPath(); c.roundRect(x + 3, y + 9, it.len * CS - 6, CS - 18, 7); c.fill(); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x + (ln.speed > 0 ? it.len * CS - 16 : 8), y + 12, 8, CS - 24); }
        }
      }
      c.font = `${CS * 0.8}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      for (let i = 0; i < ROAD_GOALS; i++) { if (i < s.goals) c.fillText('🐸', (2.5 + i * 3) * CS, CS / 2); }
      if (s.dead <= 0 || Math.floor(s.t * 14) % 2) c.fillText(s.dead > 0 ? '💥' : '🐸', (s.x + 0.5) * CS, (s.row + 0.5) * CS);
    },
    hud: (s) => [Af('crossed', 'Về đích: {n}/{t}', { n: s.goals, t: ROAD_GOALS }), '♥'.repeat(Math.max(0, s.lives))],
    score: (s) => s.goals * 100,
  });
}

// ── Chim bay ──
export function mountFlappy(id: string): void {
  mountCanvasGame({
    id, W: FLAP_W, H: FLAP_H, pad: ['jump'], tapIsAction: false, noteKey: 'note.flappy',
    noteFb: 'Chạm vào sân, bấm phím cách hoặc ↑ để vỗ cánh. Bay qua khe giữa các ống mà không chạm ống, mặt đất hay trần. Càng lên cấp khe càng hẹp và bay càng nhanh.',
    init: flapNew, step: flapStep,
    draw: (c, s, _l, tm) => {
      bg(c, FLAP_W, FLAP_H, '#4dc3ff', '#b8ecff');
      c.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 4; i++) { const x = ((i * 190 - tm * 18) % (FLAP_W + 120)) - 60; c.beginPath(); c.ellipse(x < -60 ? x + FLAP_W + 120 : x, 90 + i * 55, 46, 18, 0, 0, Math.PI * 2); c.fill(); }
      const g = flapGap(s.level);
      for (const p of s.pipes) {
        c.fillStyle = '#2f9e44';
        c.fillRect(p.x - 28, 0, 56, p.gapY - g / 2); c.fillRect(p.x - 28, p.gapY + g / 2, 56, FLAP_H);
        c.fillStyle = '#51cf66'; c.fillRect(p.x - 34, p.gapY - g / 2 - 22, 68, 22); c.fillRect(p.x - 34, p.gapY + g / 2, 68, 22);
      }
      c.fillStyle = '#e8c07a'; c.fillRect(0, FLAP_H - FLAP_GROUND, FLAP_W, FLAP_GROUND);
      c.fillStyle = '#74b816'; c.fillRect(0, FLAP_H - FLAP_GROUND, FLAP_W, 12);
      c.save(); c.translate(FLAP_X, s.y); c.rotate(Math.max(-0.5, Math.min(1.1, s.vy / 700)));
      c.fillStyle = '#ffd43b'; c.beginPath(); c.arc(0, 0, FLAP_R, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(6, -4, 5, 0, Math.PI * 2); c.fill(); c.fillStyle = '#000'; c.beginPath(); c.arc(8, -4, 2, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ff922b'; c.beginPath(); c.moveTo(11, 1); c.lineTo(22, 4); c.lineTo(11, 8); c.fill();
      c.fillStyle = '#f59f00'; c.beginPath(); c.ellipse(-4, 4 + Math.sin(tm * 25) * 3, 8, 5, 0, 0, Math.PI * 2); c.fill();
      c.restore();
    },
    hud: (s) => [Af('pipes', 'Ống đã qua: {n}/{t}', { n: s.passed, t: s.need }), ''],
    score: (s) => s.passed * 10,
  });
}

// ── Khủng long chạy ──
export function mountRunner(id: string): void {
  mountCanvasGame({
    id, W: RUN_W, H: RUN_H, pad: ['jump', 'down'], tapIsAction: false, noteKey: 'note.runner',
    noteFb: 'Chạm vào sân, bấm phím cách hoặc ↑ để nhảy qua xương rồng; giữ ↓ để cúi tránh chim bay thấp (hoặc nhảy qua chim bay thấp). Chạy đủ quãng đường để qua cấp. Tốc độ tăng dần.',
    init: runNew, step: runStep,
    draw: (c, s, _l, tm) => {
      bg(c, RUN_W, RUN_H, '#f1f3f5', '#dee2e6');
      c.fillStyle = '#868e96'; c.fillRect(0, RUN_GROUND, RUN_W, 2);
      c.fillStyle = '#adb5bd'; for (let i = 0; i < 14; i++) { const x = ((i * 53 - s.dist * 18) % RUN_W + RUN_W) % RUN_W; c.fillRect(x, RUN_GROUND + 10 + (i % 3) * 8, 10 + (i % 4) * 4, 2); }
      for (const o of s.obs) {
        c.fillStyle = o.kind === 'cactus' ? '#2b8a3e' : '#5f3dc4';
        const y = RUN_GROUND - o.y - o.h;
        if (o.kind === 'cactus') { for (let k = 0; k < o.w / 20; k++) { c.fillRect(o.x + k * 20 + 6, y, 8, o.h); c.fillRect(o.x + k * 20 + 1, y + 10, 18, 5); } }
        else { c.beginPath(); c.ellipse(o.x + o.w / 2, y + o.h / 2, o.w / 2, 8, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.moveTo(o.x + 10, y + o.h / 2); c.lineTo(o.x + 20, y + (Math.floor(tm * 10) % 2 ? -4 : o.h + 4)); c.lineTo(o.x + 30, y + o.h / 2); c.fill(); }
      }
      const dh = s.duck ? 26 : 46, y = RUN_GROUND - s.y - dh;
      c.fillStyle = '#343a40';
      c.fillRect(RUN_X, y + (s.duck ? 0 : 10), RUN_DINO_W, dh - (s.duck ? 0 : 10));
      if (!s.duck) { c.fillRect(RUN_X + 22, y, 22, 18); }
      c.fillStyle = '#fff'; c.fillRect(RUN_X + (s.duck ? 30 : 36), y + (s.duck ? 4 : 4), 4, 4);
      const leg = s.y > 0 ? 0 : Math.floor(tm * 14) % 2 ? 6 : 0;
      c.fillStyle = '#343a40'; c.fillRect(RUN_X + 6, y + dh - 2, 8, 4 + leg); c.fillRect(RUN_X + 24, y + dh - 2, 8, 10 - leg);
    },
    hud: (s) => [Af('distance', 'Quãng đường: {n}/{t} m', { n: Math.floor(s.dist), t: s.need }), Af('speedN', 'Tốc độ: {n}', { n: Math.round(runSpeed(s) / 10) })],
    score: (s) => Math.floor(s.dist),
  });
}
