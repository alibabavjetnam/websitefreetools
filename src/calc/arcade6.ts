/**
 * Lõi thuần đợt 6 (canvas): đua xe né xe, nhảy lên cao (doodle), đào vàng, cắt trái cây,
 * ném bóng rổ, bắn bóng màu, ăn chấm. Dùng chung kiểu `Input`/`Result` với arcade4.
 */
import type { Input, Result } from './arcade4';

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
const ri = (a: number, b: number): number => Math.floor(rnd(a, b + 1));
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const lvl = (l: number): number => clamp(l, 1, 10);

/* ============================ Đua xe ============================ */
export const RACE_W = 400, RACE_H = 600;
export const raceLanes = (l: number): number => (l <= 3 ? 3 : l <= 7 ? 4 : 5);
export interface RaceCar { lane: number; y: number; kind: number }
export interface Race { lane: number; x: number; cars: RaceCar[]; dist: number; need: number; lives: number; inv: number; spawn: number; t: number; level: number; ev: string[] }
export const laneX = (lane: number, n: number): number => (RACE_W / n) * (lane + 0.5);
export function raceNew(level: number): Race {
  const l = lvl(level), n = raceLanes(l);
  return { lane: Math.floor(n / 2), x: laneX(Math.floor(n / 2), n), cars: [], dist: 0, need: 1200 + l * 450, lives: 3, inv: 0, spawn: 0.6, t: 0, level: l, ev: [] };
}
export const raceSpeed = (s: Race): number => 250 + s.level * 32 + Math.min(150, s.t * 3);
export function raceStep(s: Race, dt: number, inp: Input): Result {
  const n = raceLanes(s.level); s.t += dt;
  if (inp.pressed.has('left')) { s.lane = Math.max(0, s.lane - 1); s.ev.push('whoosh'); }
  if (inp.pressed.has('right')) { s.lane = Math.min(n - 1, s.lane + 1); s.ev.push('whoosh'); }
  if (inp.down && inp.x >= 0) { const ln = clamp(Math.floor((inp.x / RACE_W) * n), 0, n - 1); if (ln !== s.lane) { s.lane = ln; } }
  const tx = laneX(s.lane, n); s.x += clamp(tx - s.x, -700 * dt, 700 * dt);
  const sp = raceSpeed(s); s.dist += (sp * dt) / 6; s.inv = Math.max(0, s.inv - dt);
  for (const c of s.cars) c.y += sp * dt * (c.kind === 1 ? 0.55 : 0.75);
  s.cars = s.cars.filter((c) => c.y < RACE_H + 80);
  s.spawn -= dt;
  if (s.spawn <= 0) {
    s.spawn = Math.max(0.28, 1.0 - s.level * 0.06) * rnd(0.7, 1.2) * (420 / sp) * 1.1;
    const near = s.cars.filter((c) => c.y < 140).map((c) => c.lane);
    const free = Array.from({ length: n }, (_, i) => i).filter((i) => !near.includes(i));
    if (free.length > 1) s.cars.push({ lane: free[ri(0, free.length - 1)], y: -70, kind: ri(0, 2) });
  }
  if (s.inv <= 0) {
    const hit = s.cars.find((c) => c.lane === s.lane && Math.abs(c.y - (RACE_H - 110)) < 62 && Math.abs(s.x - laneX(c.lane, n)) < 28);
    if (hit) { s.lives--; s.inv = 1.4; hit.y = RACE_H + 200; s.ev.push('boom'); if (s.lives <= 0) return 'lose'; }
  }
  return s.dist >= s.need ? 'win' : null;
}

/* ============================ Nhảy lên cao (doodle) ============================ */
export const JUMP_W = 400, JUMP_H = 600;
export interface Plat { x: number; y: number; w: number; kind: 'n' | 'm' | 'b'; dx: number; gone: boolean }
export interface Jump { x: number; y: number; vy: number; plats: Plat[]; cam: number; top: number; need: number; level: number; next: number; ev: string[]; face: number }
export const JUMP_V = 700, JUMP_G = 1500;
export function jumpNew(level: number): Jump {
  const l = lvl(level), plats: Plat[] = [{ x: 150, y: 20, w: 100, kind: 'n', dx: 0, gone: false }];
  const s: Jump = { x: 200, y: 40, vy: JUMP_V, plats, cam: 0, top: 0, need: 1200 + l * 700, level: l, next: 20, ev: [], face: 1 };
  fillPlats(s, 700);
  return s;
}
function fillPlats(s: Jump, upTo: number): void {
  const l = s.level;
  while (s.next < upTo) {
    const gap = rnd(55, 70 + l * 5.2);
    s.next += Math.min(gap, 118);
    const w = Math.max(54, 92 - l * 3.5), x = rnd(0, JUMP_W - w);
    const r = Math.random();
    const kind: 'n' | 'm' | 'b' = l >= 3 && r < 0.12 + l * 0.02 ? 'm' : l >= 5 && r > 0.86 ? 'b' : 'n';
    s.plats.push({ x, y: s.next, w, kind, dx: kind === 'm' ? (Math.random() < 0.5 ? -1 : 1) * (50 + l * 6) : 0, gone: false });
    if (kind === 'b') s.plats.push({ x: clamp(x + rnd(-120, 120), 0, JUMP_W - w), y: s.next - rnd(4, 20), w, kind: 'n', dx: 0, gone: false }); // luôn có đường thoát
  }
}
export function jumpStep(s: Jump, dt: number, inp: Input): Result {
  const dir = (inp.keys.has('right') ? 1 : 0) - (inp.keys.has('left') ? 1 : 0);
  if (dir) { s.x += dir * 330 * dt; s.face = dir; }
  else if (inp.x >= 0 && inp.down) s.x += clamp(inp.x - s.x, -420 * dt, 420 * dt);
  if (s.x < -12) s.x = JUMP_W + 12; if (s.x > JUMP_W + 12) s.x = -12;
  const oy = s.y; s.vy -= JUMP_G * dt; s.y += s.vy * dt;
  for (const p of s.plats) if (p.kind === 'm') { p.x += p.dx * dt; if (p.x < 0 || p.x + p.w > JUMP_W) p.dx = -p.dx; }
  if (s.vy < 0) for (const p of s.plats) {
    if (p.gone) continue;
    if (oy >= p.y && s.y <= p.y && s.x > p.x - 10 && s.x < p.x + p.w + 10) {
      if (p.kind === 'b') { p.gone = true; s.ev.push('hit'); continue; }
      s.vy = JUMP_V; s.y = p.y; s.ev.push('jump'); break;
    }
  }
  s.top = Math.max(s.top, s.y);
  s.cam = Math.max(s.cam, s.y - JUMP_H * 0.45);
  fillPlats(s, s.cam + JUMP_H + 200);
  s.plats = s.plats.filter((p) => p.y > s.cam - 60 && !p.gone);
  if (s.y < s.cam - 40) { s.ev.push('lose'); return 'lose'; }
  return s.top >= s.need ? 'win' : null;
}

/* ============================ Đào vàng ============================ */
export const MINE_W = 480, MINE_H = 520, MINE_X = 240, MINE_Y = 54;
export interface MineItem { x: number; y: number; r: number; val: number; w: number; kind: 'gold' | 'rock' | 'gem'; got: boolean }
export interface Miner { items: MineItem[]; ang: number; phase: number; state: 'swing' | 'out' | 'back'; len: number; dirA: number; hold: MineItem | null; money: number; need: number; time: number; level: number; ev: string[] }
export const MINE_TARGET = [400, 650, 900, 1200, 1500, 1850, 2200, 2600, 3000, 3500];
export function minerNew(level: number): Miner {
  const l = lvl(level), items: MineItem[] = [];
  const count = 9 + Math.floor(l * 0.9);
  for (let k = 0, t = 0; k < count && t < 900; t++) {
    const kind = Math.random() < 0.28 + l * 0.015 ? 'rock' : Math.random() < 0.1 ? 'gem' : 'gold';
    const r = kind === 'gem' ? 9 : kind === 'rock' ? rnd(16, 26) : rnd(11, 30);
    const x = rnd(r + 10, MINE_W - r - 10), y = rnd(150, MINE_H - r - 10);
    if (items.some((i) => Math.hypot(i.x - x, i.y - y) < i.r + r + 8)) continue;
    items.push({ x, y, r, kind, got: false, val: kind === 'gem' ? 500 : kind === 'rock' ? Math.round(r * 2) : Math.round(r * r / 3.2 / 10) * 10 + 20, w: kind === 'gem' ? 0.15 : kind === 'rock' ? 0.8 + r / 60 : r / 30 });
    k++;
  }
  return { items, ang: 0, phase: 0, state: 'swing', len: 30, dirA: 0, hold: null, money: 0, need: MINE_TARGET[l - 1], time: 60, level: l, ev: [] };
}
export function minerStep(s: Miner, dt: number, inp: Input): Result {
  s.time -= dt;
  if (s.state === 'swing') {
    s.phase += dt * (1.6 + s.level * 0.08); s.ang = Math.sin(s.phase) * 1.15;
    if (inp.pressed.has('tap') || inp.pressed.has('space') || inp.pressed.has('down') || inp.pressed.has('fire')) { s.state = 'out'; s.dirA = s.ang; s.ev.push('shoot'); }
  } else if (s.state === 'out') {
    s.len += 430 * dt;
    const ex = MINE_X + Math.sin(s.dirA) * s.len, ey = MINE_Y + Math.cos(s.dirA) * s.len;
    const hit = s.items.find((i) => !i.got && Math.hypot(i.x - ex, i.y - ey) < i.r + 6);
    if (hit) { s.hold = hit; hit.got = true; s.state = 'back'; s.ev.push('select'); }
    else if (ex < 0 || ex > MINE_W || ey > MINE_H) { s.state = 'back'; s.ev.push('error'); }
  } else {
    const w = s.hold ? s.hold.w : 0.05;
    s.len -= (430 * (0.22 + 0.78 * (1 - clamp(w, 0, 1)))) * dt;
    if (s.hold) { s.hold.x = MINE_X + Math.sin(s.dirA) * (s.len + 4); s.hold.y = MINE_Y + Math.cos(s.dirA) * (s.len + 4); }
    if (s.len <= 30) {
      s.len = 30; s.state = 'swing';
      if (s.hold) { s.money += s.hold.val; s.ev.push(s.hold.kind === 'rock' ? 'tick' : 'coin'); s.items = s.items.filter((i) => i !== s.hold); s.hold = null; }
    }
  }
  if (s.money >= s.need && s.state === 'swing') return 'win';
  return s.time <= 0 ? 'lose' : null;
}

/* ============================ Cắt trái cây ============================ */
export const SLICE_W = 480, SLICE_H = 600;
export interface Fruit { x: number; y: number; vx: number; vy: number; r: number; bomb: boolean; hue: number; cut: boolean; half: number; missed?: boolean }
export interface Slicer { fruits: Fruit[]; sliced: number; need: number; lives: number; spawn: number; px: number; py: number; trail: { x: number; y: number; t: number }[]; level: number; ev: string[]; t: number }
export function slicerNew(level: number): Slicer {
  const l = lvl(level);
  return { fruits: [], sliced: 0, need: 14 + l * 5, lives: 3, spawn: 0.5, px: -1, py: -1, trail: [], level: l, ev: [], t: 0 };
}
export function slicerStep(s: Slicer, dt: number, inp: Input): Result {
  const l = s.level; s.t += dt;
  s.spawn -= dt;
  if (s.spawn <= 0) {
    s.spawn = Math.max(0.5, 1.4 - l * 0.08) * rnd(0.8, 1.3);
    const n = 1 + (Math.random() < 0.3 + l * 0.04 ? 1 : 0) + (l >= 6 && Math.random() < 0.3 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const bomb = l >= 2 && Math.random() < 0.08 + l * 0.015, x = rnd(80, SLICE_W - 80);
      s.fruits.push({ x, y: SLICE_H + 30, vx: (SLICE_W / 2 - x) * rnd(0.25, 0.6) + rnd(-40, 40), vy: -rnd(700, 860), r: bomb ? 22 : rnd(24, 32), bomb, hue: ri(0, 5) * 60, cut: false, half: 0 });
    }
    s.ev.push('whoosh');
  }
  for (const f of s.fruits) { f.vy += 760 * dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.cut) f.half += dt; }
  if (inp.down && inp.x >= 0) {
    if (s.px >= 0) {
      const dx = inp.x - s.px, dy = inp.y - s.py, len2 = dx * dx + dy * dy;
      if (len2 > 16) for (const f of s.fruits) {
        if (f.cut) continue;
        const t = clamp(((f.x - s.px) * dx + (f.y - s.py) * dy) / len2, 0, 1), cx = s.px + dx * t, cy = s.py + dy * t;
        if (Math.hypot(f.x - cx, f.y - cy) < f.r + 4) {
          f.cut = true;
          if (f.bomb) { s.lives--; s.ev.push('boom'); if (s.lives <= 0) return 'lose'; } else { s.sliced++; s.ev.push('hit'); }
        }
      }
    }
    s.trail.push({ x: inp.x, y: inp.y, t: 0.18 }); s.px = inp.x; s.py = inp.y;
  } else { s.px = -1; s.py = -1; }
  for (const p of s.trail) p.t -= dt;
  s.trail = s.trail.filter((p) => p.t > 0);
  for (const f of s.fruits) if (f.y > SLICE_H + 60 && f.vy > 0 && !f.cut && !f.bomb && !f.missed) { f.missed = true; s.lives--; s.ev.push('warn'); }
  s.fruits = s.fruits.filter((f) => f.y < SLICE_H + 80 || f.vy < 0).filter((f) => !(f.cut && f.half > 0.7));
  if (s.lives <= 0) return 'lose';
  return s.sliced >= s.need ? 'win' : null;
}

/* ============================ Ném bóng rổ ============================ */
export const HOOP_W = 480, HOOP_H = 600, HOOP_Y = 200, HOOP_HALF = 38, BALL_R = 14;
export interface Hoops { bx: number; by: number; vx: number; vy: number; flying: boolean; hx: number; hdir: number; shots: number; score: number; need: number; aim: { x: number; y: number } | null; wasAbove: boolean; settle: number; level: number; ev: string[]; swish: number; prevDown: boolean; lastX: number; lastY: number }
export function hoopsNew(level: number): Hoops {
  const l = lvl(level);
  return { bx: HOOP_W / 2, by: HOOP_H - 70, vx: 0, vy: 0, flying: false, hx: HOOP_W / 2, hdir: 1, shots: 11 - Math.floor(l / 3), score: 0, need: 4 + Math.ceil(l * 0.8), aim: null, wasAbove: false, settle: 0, level: l, ev: [], swish: 0, prevDown: false, lastX: 0, lastY: 0 };
}
export function hoopsStep(s: Hoops, dt: number, inp: Input): Result {
  const l = s.level;
  if (l >= 4) { s.hx += s.hdir * (30 + l * 9) * dt; if (s.hx > HOOP_W - 90) s.hdir = -1; if (s.hx < 90) s.hdir = 1; }
  s.swish = Math.max(0, s.swish - dt);
  if (!s.flying) {
    if (inp.down && inp.x >= 0) {
      if (!s.aim) s.aim = { x: inp.x, y: inp.y };
      s.lastX = inp.x; s.lastY = inp.y;
    }
    if (s.aim && !inp.down && s.prevDown) {
      const lx = s.lastX - s.aim.x, ly = s.lastY - s.aim.y; // kéo ngược hướng muốn ném (kiểu ná)
      const px = -lx * 4.2, py = -ly * 4.2, sp = Math.hypot(px, py);
      if (sp > 160 && py < -60) { const k = Math.min(1, 1250 / sp); s.vx = px * k; s.vy = py * k; s.flying = true; s.shots--; s.wasAbove = false; s.settle = 0; s.ev.push('shoot'); }
      s.aim = null;
    }
  }
  s.prevDown = inp.down;
  if (s.flying) {
    s.vy += 1100 * dt; s.bx += s.vx * dt; s.by += s.vy * dt;
    if (s.bx < BALL_R) { s.bx = BALL_R; s.vx = Math.abs(s.vx) * 0.7; s.ev.push('bounce'); }
    if (s.bx > HOOP_W - BALL_R) { s.bx = HOOP_W - BALL_R; s.vx = -Math.abs(s.vx) * 0.7; s.ev.push('bounce'); }
    for (const rx of [s.hx - HOOP_HALF, s.hx + HOOP_HALF]) {
      const dx = s.bx - rx, dy = s.by - HOOP_Y, d = Math.hypot(dx, dy);
      if (d < BALL_R + 4 && d > 0) { const nx = dx / d, ny = dy / d, dot = s.vx * nx + s.vy * ny; if (dot < 0) { s.vx = (s.vx - 1.7 * dot * nx) * 0.8; s.vy = (s.vy - 1.7 * dot * ny) * 0.8; s.ev.push('bounce'); } s.bx = rx + nx * (BALL_R + 4); s.by = HOOP_Y + ny * (BALL_R + 4); }
    }
    if (s.by < HOOP_Y - BALL_R) s.wasAbove = true;
    if (s.wasAbove && s.vy > 0 && s.by >= HOOP_Y && s.by < HOOP_Y + 24 && Math.abs(s.bx - s.hx) < HOOP_HALF - 4) { s.score++; s.wasAbove = false; s.swish = 0.6; s.ev.push('coin'); if (s.score >= s.need) return 'win'; }
    if (s.by > HOOP_H + 40) { s.flying = false; s.bx = HOOP_W / 2; s.by = HOOP_H - 70; s.vx = s.vy = 0; if (s.shots <= 0) return s.score >= s.need ? 'win' : 'lose'; }
  }
  return null;
}

/* ============================ Bắn bóng màu ============================ */
export const BUB_W = 400, BUB_H = 560, BUB_R = 20, BUB_COLS = 10, BUB_ROWS = 13;
export interface Bubbles { grid: number[][]; par: number; cur: number; next: number; bx: number; by: number; vx: number; vy: number; flying: boolean; shots: number; colors: number; every: number; aim: number; level: number; ev: string[]; popped: { x: number; y: number; c: number; t: number }[] }
export const bubXY = (r: number, c: number, par: number): [number, number] => [c * 40 + 20 + ((r + par) % 2) * 20 - (((r + par) % 2) ? 0 : 0), r * 35 + 20];
export function bubblesNew(level: number): Bubbles {
  const l = lvl(level), colors = Math.min(6, 3 + Math.floor((l - 1) / 3) + (l > 7 ? 0 : 0)), rows = 4 + Math.ceil(l / 2);
  const grid = Array.from({ length: BUB_ROWS + 2 }, (_, r) => Array.from({ length: BUB_COLS }, (_, c) => (r < rows ? (r % 2 && c === BUB_COLS - 1 ? -1 : ri(0, colors - 1)) : -1)));
  const s: Bubbles = { grid, par: 0, cur: ri(0, colors - 1), next: ri(0, colors - 1), bx: BUB_W / 2, by: BUB_H - 30, vx: 0, vy: 0, flying: false, shots: 0, colors, every: Math.max(3, 8 - Math.floor(l / 2)), aim: -Math.PI / 2, level: l, ev: [], popped: [] };
  return s;
}
const nb = (r: number, c: number, par: number): [number, number][] => {
  const odd = (r + par) % 2 === 1;
  const d = odd ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]] : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
  return d.map(([dr, dc]) => [r + dr, c + dc] as [number, number]).filter(([rr, cc]) => rr >= 0 && rr < BUB_ROWS + 2 && cc >= 0 && cc < BUB_COLS);
};
function bubPop(s: Bubbles, r: number, c: number): number {
  const col = s.grid[r][c], seen = new Set<number>([r * 100 + c]), q: [number, number][] = [[r, c]];
  for (let i = 0; i < q.length; i++) for (const [rr, cc] of nb(q[i][0], q[i][1], s.par)) if (s.grid[rr][cc] === col && !seen.has(rr * 100 + cc)) { seen.add(rr * 100 + cc); q.push([rr, cc]); }
  let n = 0;
  if (q.length >= 3) {
    for (const [rr, cc] of q) { const [x, y] = bubXY(rr, cc, s.par); s.popped.push({ x, y, c: s.grid[rr][cc], t: 0.3 }); s.grid[rr][cc] = -1; n++; }
    // bóng rơi: không nối được với hàng trên cùng
    const ok = new Set<number>(), st: [number, number][] = [];
    for (let cc = 0; cc < BUB_COLS; cc++) if (s.grid[0][cc] >= 0) { ok.add(cc); st.push([0, cc]); }
    for (let i = 0; i < st.length; i++) for (const [rr, cc] of nb(st[i][0], st[i][1], s.par)) if (s.grid[rr][cc] >= 0 && !ok.has(rr * 100 + cc)) { ok.add(rr * 100 + cc); st.push([rr, cc]); }
    for (let rr = 0; rr < s.grid.length; rr++) for (let cc = 0; cc < BUB_COLS; cc++) if (s.grid[rr][cc] >= 0 && !(rr === 0 ? ok.has(cc) : ok.has(rr * 100 + cc))) { const [x, y] = bubXY(rr, cc, s.par); s.popped.push({ x, y, c: s.grid[rr][cc], t: 0.5 }); s.grid[rr][cc] = -1; n++; }
  }
  return n;
}
export function bubblesStep(s: Bubbles, dt: number, inp: Input): Result {
  s.popped = s.popped.filter((p) => (p.t -= dt) > 0);
  if (!s.flying) {
    if (inp.x >= 0) s.aim = clamp(Math.atan2(inp.y - s.by, inp.x - s.bx), -Math.PI + 0.18, -0.18);
    if (inp.keys.has('left')) s.aim = clamp(s.aim - 1.8 * dt, -Math.PI + 0.18, -0.18);
    if (inp.keys.has('right')) s.aim = clamp(s.aim + 1.8 * dt, -Math.PI + 0.18, -0.18);
    if (inp.pressed.has('space') || inp.pressed.has('fire') || inp.pressed.has('tap')) { s.flying = true; s.vx = Math.cos(s.aim) * 760; s.vy = Math.sin(s.aim) * 760; s.bx = BUB_W / 2; s.by = BUB_H - 30; s.ev.push('shoot'); }
    return null;
  }
  const steps = 4;
  for (let k = 0; k < steps && s.flying; k++) {
    s.bx += (s.vx * dt) / steps; s.by += (s.vy * dt) / steps;
    if (s.bx < BUB_R) { s.bx = BUB_R; s.vx = Math.abs(s.vx); s.ev.push('tick'); }
    if (s.bx > BUB_W - BUB_R) { s.bx = BUB_W - BUB_R; s.vx = -Math.abs(s.vx); s.ev.push('tick'); }
    let hit = s.by <= BUB_R;
    if (!hit) outer: for (let r = 0; r < s.grid.length; r++) for (let c = 0; c < BUB_COLS; c++) if (s.grid[r][c] >= 0) { const [x, y] = bubXY(r, c, s.par); if (Math.hypot(x - s.bx, y - s.by) < BUB_R * 1.8) { hit = true; break outer; } }
    if (!hit) continue;
    // đặt vào ô trống gần nhất
    let best: [number, number] | null = null, bd = 1e9;
    for (let r = 0; r < s.grid.length; r++) for (let c = 0; c < BUB_COLS; c++) if (s.grid[r][c] < 0 && !((r + s.par) % 2 === 1 && c === BUB_COLS - 1)) {
      const [x, y] = bubXY(r, c, s.par), d = Math.hypot(x - s.bx, y - s.by);
      const supported = r === 0 || nb(r, c, s.par).some(([rr, cc]) => s.grid[rr][cc] >= 0);
      if (supported && d < bd) { bd = d; best = [r, c]; }
    }
    s.flying = false; s.bx = BUB_W / 2; s.by = BUB_H - 30;
    if (!best) return 'lose';
    s.grid[best[0]][best[1]] = s.cur; s.shots++;
    const n = bubPop(s, best[0], best[1]);
    s.ev.push(n >= 3 ? (n > 5 ? 'combo' : 'pop') : 'place');
    s.cur = s.next;
    const present = new Set<number>(); s.grid.forEach((row) => row.forEach((v) => v >= 0 && present.add(v)));
    s.next = present.size ? [...present][ri(0, present.size - 1)] : ri(0, s.colors - 1);
    if (!present.size) return 'win';
    if (!present.has(s.cur)) s.cur = [...present][ri(0, present.size - 1)];
    if (s.shots % s.every === 0) {
      s.grid.pop(); s.par ^= 1;
      s.grid.unshift(Array.from({ length: BUB_COLS }, (_, c) => ((0 + s.par) % 2 === 1 && c === BUB_COLS - 1 ? -1 : ri(0, s.colors - 1)))); s.ev.push('warn');
    }
    if (s.grid.some((row, r) => r >= BUB_ROWS - 1 && row.some((v) => v >= 0))) { s.ev.push('boom'); return 'lose'; }
  }
  return null;
}

/* ============================ Ăn chấm (đuổi bắt trong mê cung) ============================ */
export const CHASE_N = 9;
export interface Walker { r: number; c: number; tr: number; tc: number; p: number; dir: number }
export interface Chase { walls: Uint8Array; dots: Set<number>; me: Walker; want: number; ghosts: Walker[]; lives: number; inv: number; level: number; ev: string[]; total: number }
const DR4 = [-1, 0, 1, 0], DC4 = [0, 1, 0, -1];
export const chaseGhosts = (l: number): number => clamp(1 + Math.floor((l - 1) / 3), 1, 4);
export function chaseNew(level: number): Chase {
  const l = lvl(level), n = CHASE_N, walls = new Uint8Array(n * n).fill(15), vis = new Uint8Array(n * n), st = [0]; vis[0] = 1;
  while (st.length) {
    const cur = st[st.length - 1], r = Math.floor(cur / n), c = cur % n, o: number[] = [];
    for (let d = 0; d < 4; d++) { const rr = r + DR4[d], cc = c + DC4[d]; if (rr >= 0 && rr < n && cc >= 0 && cc < n && !vis[rr * n + cc]) o.push(d); }
    if (!o.length) { st.pop(); continue; }
    const d = o[ri(0, o.length - 1)], nx = (r + DR4[d]) * n + c + DC4[d];
    walls[cur] &= ~(1 << d); walls[nx] &= ~(1 << ((d + 2) % 4)); vis[nx] = 1; st.push(nx);
  }
  for (let k = 0; k < n * 4; k++) { const r = ri(0, n - 1), c = ri(0, n - 1), d = ri(0, 3), rr = r + DR4[d], cc = c + DC4[d]; if (rr >= 0 && rr < n && cc >= 0 && cc < n) { walls[r * n + c] &= ~(1 << d); walls[rr * n + cc] &= ~(1 << ((d + 2) % 4)); } }
  const mk = (r: number, c: number): Walker => ({ r, c, tr: r, tc: c, p: 1, dir: -1 });
  const ghosts = [mk(n - 1, n - 1), mk(0, n - 1), mk(n - 1, 0), mk(4, 4)].slice(0, chaseGhosts(l));
  const dots = new Set<number>(); for (let i = 0; i < n * n; i++) dots.add(i);
  const me = mk(0, 0); dots.delete(0);
  return { walls, dots, me, want: -1, ghosts, lives: 3, inv: 1.2, level: l, ev: [], total: dots.size };
}
const open = (s: Chase, r: number, c: number, d: number): boolean => !(s.walls[r * CHASE_N + c] & (1 << d)) && r + DR4[d] >= 0 && r + DR4[d] < CHASE_N && c + DC4[d] >= 0 && c + DC4[d] < CHASE_N;
function advance(w: Walker, speed: number, dt: number, pick: (w: Walker) => number): void {
  let left = speed * dt;
  while (left > 0) {
    if (w.p >= 1) {
      w.r = w.tr; w.c = w.tc; const d = pick(w);
      if (d < 0) { w.p = 1; return; }
      w.dir = d; w.tr = w.r + DR4[d]; w.tc = w.c + DC4[d]; w.p = 0;
    }
    const step = Math.min(left, 1 - w.p); w.p += step; left -= step;
  }
}
export const walkerPos = (w: Walker): [number, number] => [w.c + (w.tc - w.c) * w.p, w.r + (w.tr - w.r) * w.p];
export function chaseStep(s: Chase, dt: number, inp: Input): Result {
  for (const [k, d] of [['up', 0], ['right', 1], ['down', 2], ['left', 3]] as [string, number][]) if (inp.pressed.has(k) || inp.keys.has(k)) s.want = d;
  s.inv = Math.max(0, s.inv - dt);
  advance(s.me, 5.2, dt, (w) => {
    const here = w.r * CHASE_N + w.c; if (s.dots.delete(here)) s.ev.push('tick');
    if (s.want >= 0 && open(s, w.r, w.c, s.want)) return s.want;
    if (w.dir >= 0 && open(s, w.r, w.c, w.dir)) return w.dir;
    return -1;
  });
  if (s.me.p >= 1) { const here = s.me.tr * CHASE_N + s.me.tc; if (s.dots.delete(here)) s.ev.push('tick'); }
  const sp = 2.6 + s.level * 0.28, smart = 0.35 + s.level * 0.06;
  for (const g of s.ghosts) {
    advance(g, sp, dt, (w) => {
      const opts = [0, 1, 2, 3].filter((d) => open(s, w.r, w.c, d) && (w.dir < 0 || d !== (w.dir + 2) % 4));
      if (!opts.length) return w.dir >= 0 ? (w.dir + 2) % 4 : -1;
      if (Math.random() < smart) { const [mx, my] = walkerPos(s.me); let best = opts[0], bd = 1e9; for (const d of opts) { const dd = Math.hypot(w.c + DC4[d] - mx, w.r + DR4[d] - my); if (dd < bd) { bd = dd; best = d; } } return best; }
      return opts[ri(0, opts.length - 1)];
    });
  }
  if (s.inv <= 0) {
    const [mx, my] = walkerPos(s.me);
    if (s.ghosts.some((g) => { const [gx, gy] = walkerPos(g); return Math.hypot(gx - mx, gy - my) < 0.5; })) {
      s.lives--; s.ev.push('boom'); s.inv = 2;
      s.me = { r: 0, c: 0, tr: 0, tc: 0, p: 1, dir: -1 }; s.want = -1;
      s.ghosts.forEach((g, i) => { const home = [[CHASE_N - 1, CHASE_N - 1], [0, CHASE_N - 1], [CHASE_N - 1, 0], [4, 4]][i]; g.r = g.tr = home[0]; g.c = g.tc = home[1]; g.p = 1; g.dir = -1; });
      if (s.lives <= 0) return 'lose';
    }
  }
  return s.dots.size === 0 ? 'win' : null;
}
