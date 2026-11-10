/** Lõi thuần Pinball (canvas): bóng, cần gạt, bumper; sự kiện âm thanh ghi vào s.ev. */
import type { Input, Result } from './arcade4';

export const PB_W = 400, PB_H = 640;
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const R = 9; // bán kính bóng
export interface Flipper { px: number; py: number; len: number; side: 1 | -1; a: number; up: boolean }
export interface Bumper { x: number; y: number; r: number; pulse: number }
export interface Pinball {
  x: number; y: number; vx: number; vy: number; ready: boolean; balls: number; score: number; target: number;
  fl: Flipper[]; bumpers: Bumper[]; level: number; ev: string[]; t: number; still: number;
}
const REST = 0.52, UP = -0.42, OMEGA = 16;
const flipPos = (f: Flipper, a: number, k: number): [number, number] => [f.px + f.side * Math.cos(a) * f.len * k, f.py + Math.sin(a) * f.len * k];

export function pinballNew(level: number): Pinball {
  const l = clamp(level, 1, 10);
  const len = 52 - l * 0.8;
  const all: Bumper[] = [
    { x: 200, y: 190, r: 24, pulse: 0 }, { x: 125, y: 270, r: 22, pulse: 0 }, { x: 275, y: 270, r: 22, pulse: 0 },
    { x: 200, y: 340, r: 20, pulse: 0 }, { x: 90, y: 150, r: 18, pulse: 0 }, { x: 310, y: 150, r: 18, pulse: 0 },
  ];
  const nb = l <= 3 ? 6 : l <= 6 ? 5 : l <= 8 ? 4 : 3;
  return {
    x: 360, y: 90, vx: 0, vy: 0, ready: true, balls: 3, score: 0, target: 1000 + l * 600,
    fl: [{ px: 138, py: 560, len, side: 1, a: REST, up: false }, { px: 262, py: 560, len, side: -1, a: REST, up: false }],
    bumpers: all.slice(0, nb), level: l, ev: [], t: 0, still: 0,
  };
}
/** Các đoạn tường tĩnh: [x1,y1,x2,y2] */
export const PB_WALLS: number[][] = [
  [20, 60, 20, 470], [380, 60, 380, 470], [20, 60, 80, 20], [380, 60, 320, 20], [80, 20, 320, 20],
  [20, 470, 138, 560], [380, 470, 262, 560],
];

function collideSeg(s: Pinball, x1: number, y1: number, x2: number, y2: number, e: number, vx = 0, vy = 0, pvx = 0, pvy = 0): boolean {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
  const t = clamp(((s.x - x1) * dx + (s.y - y1) * dy) / l2, 0, 1);
  const cx = x1 + dx * t, cy = y1 + dy * t;
  let nx = s.x - cx, ny = s.y - cy;
  const d = Math.hypot(nx, ny);
  const rad = R + 4;
  if (d >= rad || d === 0) return false;
  nx /= d; ny /= d;
  s.x = cx + nx * rad; s.y = cy + ny * rad;
  void pvx; void pvy;
  const rvx = s.vx - vx, rvy = s.vy - vy, vn = rvx * nx + rvy * ny;
  if (vn < 0) { s.vx -= (1 + e) * vn * nx; s.vy -= (1 + e) * vn * ny; }
  return true;
}

export function pinballStep(s: Pinball, dt: number, inp: Input): Result {
  s.t += dt;
  const left = inp.keys.has('left') || (inp.down && inp.x >= 0 && inp.x < PB_W / 2);
  const right = inp.keys.has('right') || (inp.down && inp.x >= PB_W / 2);
  s.fl[0].up = left; s.fl[1].up = right;
  if (s.ready) {
    if (inp.pressed.has('space') || inp.pressed.has('fire') || inp.pressed.has('up') || inp.pressed.has('tap') || inp.pressed.has('down')) {
      s.ready = false; s.vx = -120 - Math.random() * 120; s.vy = 40; s.ev.push('whoosh');
    }
    for (const b of s.bumpers) b.pulse = Math.max(0, b.pulse - dt * 4);
    return null;
  }
  const grav = 520 + s.level * 22;
  const sub = 5, h = dt / sub;
  for (let k = 0; k < sub; k++) {
    // cần gạt
    const prev: [number, number][] = [];
    for (const f of s.fl) {
      const target = f.up ? UP : REST, old = f.a;
      f.a += clamp(target - f.a, -OMEGA * h, OMEGA * h);
      prev.push([old, f.a]);
    }
    s.vy += grav * h; s.x += s.vx * h; s.y += s.vy * h;
    const sp = Math.hypot(s.vx, s.vy);
    if (sp > 1100) { s.vx *= 1100 / sp; s.vy *= 1100 / sp; }
    for (const w of PB_WALLS) collideSeg(s, w[0], w[1], w[2], w[3], 0.5);
    s.fl.forEach((f, i) => {
      const [a0, a1] = prev[i];
      const [tx, ty] = flipPos(f, a1, 1);
      // thông số t trên cần gạt gần bóng nhất để tính vận tốc điểm đó
      const dx = tx - f.px, dy = ty - f.py;
      const t = clamp(((s.x - f.px) * dx + (s.y - f.py) * dy) / (dx * dx + dy * dy), 0, 1);
      const [ox, oy] = flipPos(f, a0, t), [nx2, ny2] = flipPos(f, a1, t);
      const vx = (nx2 - ox) / h, vy = (ny2 - oy) / h;
      if (collideSeg(s, f.px, f.py, tx, ty, 0.35, vx, vy)) { if (Math.abs(vx) + Math.abs(vy) > 150) s.ev.push('tap'); }
    });
    for (const b of s.bumpers) {
      let nx = s.x - b.x, ny = s.y - b.y;
      const d = Math.hypot(nx, ny);
      if (d < b.r + R && d > 0) {
        nx /= d; ny /= d;
        s.x = b.x + nx * (b.r + R); s.y = b.y + ny * (b.r + R);
        const vn = s.vx * nx + s.vy * ny;
        s.vx += (-vn + 380) * nx; s.vy += (-vn + 380) * ny;
        b.pulse = 1; s.score += 100; s.ev.push('coin');
      }
    }
    if (s.y > PB_H + 20) {
      s.balls--; s.ev.push('lose');
      if (s.balls <= 0) return s.score >= s.target ? 'win' : 'lose';
      s.ready = true; s.x = 360; s.y = 90; s.vx = s.vy = 0;
      return null;
    }
  }
  // bóng nằm yên quá lâu (kẹt trên cần gạt): hất nhẹ lên
  s.still = Math.hypot(s.vx, s.vy) < 25 ? s.still + dt : 0;
  if (s.still > 1.2) { s.vy -= 260; s.vx += (Math.random() - 0.5) * 160; s.still = 0; s.ev.push('whoosh'); }
  for (const b of s.bumpers) b.pulse = Math.max(0, b.pulse - dt * 4);
  if (s.score >= s.target) return 'win';
  return null;
}
