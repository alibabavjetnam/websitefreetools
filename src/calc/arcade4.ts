/**
 * Lõi thuần (không DOM) cho các game arcade canvas đợt 4: Pong, bắn phi thuyền, tiểu hành tinh,
 * mê cung, qua đường, chim bay, khủng long chạy. Mỗi game: `xxxNew(level)` + `xxxStep(s, dt, inp)`.
 * Sự kiện âm thanh được ghi vào `s.ev` (giao diện đọc rồi xoá).
 */
export interface Input {
  x: number; y: number;          // vị trí con trỏ trong toạ độ sân (âm = chưa có)
  down: boolean;                 // đang bấm/chạm
  keys: Set<string>;             // phím đang giữ: left right up down space fire
  pressed: Set<string>;          // phím/chạm vừa bấm trong khung này (kể cả 'tap')
}
export type Result = 'win' | 'lose' | null;
export const LV = 10;
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const lvl = (l: number): number => clamp(l, 1, LV);

// ───────────────────────── Pong ─────────────────────────
export const PONG_W = 480, PONG_H = 600, PONG_TARGET = 5;
export interface Pong {
  px: number; ax: number; bx: number; by: number; vx: number; vy: number; ps: number; as: number;
  serve: number; err: number; pw: number; level: number; ev: string[];
}
export function pongNew(level: number): Pong {
  const l = lvl(level);
  const s: Pong = { px: PONG_W / 2, ax: PONG_W / 2, bx: PONG_W / 2, by: PONG_H / 2, vx: 0, vy: 0, ps: 0, as: 0, serve: 0.9, err: 0, pw: 96 - l * 2, level: l, ev: [] };
  return s;
}
const pongSpeed = (l: number): number => 300 + l * 18;
export function pongStep(s: Pong, dt: number, inp: Input): Result {
  const l = s.level, BR = 8, py = PONG_H - 40, ay = 40, aw = 80 + 0;
  // người chơi
  if (inp.keys.has('left') || inp.keys.has('right')) s.px += ((inp.keys.has('right') ? 1 : 0) - (inp.keys.has('left') ? 1 : 0)) * 560 * dt;
  else if (inp.x >= 0) s.px += clamp(inp.x - s.px, -900 * dt, 900 * dt);
  s.px = clamp(s.px, s.pw / 2, PONG_W - s.pw / 2);
  // máy
  const target = s.vy < 0 ? s.bx + s.err : PONG_W / 2;
  s.ax += clamp(target - s.ax, -(150 + l * 36) * dt, (150 + l * 36) * dt);
  s.ax = clamp(s.ax, aw / 2, PONG_W - aw / 2);
  if (s.serve > 0) {
    s.serve -= dt;
    s.bx = PONG_W / 2; s.by = PONG_H / 2;
    if (s.serve <= 0) {
      const a = (Math.random() - 0.5) * 0.9, sp = pongSpeed(l), dir = Math.random() < 0.5 ? 1 : -1;
      s.vx = Math.sin(a) * sp; s.vy = Math.cos(a) * sp * dir;
    }
    return null;
  }
  s.bx += s.vx * dt; s.by += s.vy * dt;
  if (s.bx < BR) { s.bx = BR; s.vx = Math.abs(s.vx); s.ev.push('tick'); }
  if (s.bx > PONG_W - BR) { s.bx = PONG_W - BR; s.vx = -Math.abs(s.vx); s.ev.push('tick'); }
  const paddle = (cx: number, w: number, dir: number): void => {
    const rel = clamp((s.bx - cx) / (w / 2), -1, 1);
    const sp = Math.min(900, Math.hypot(s.vx, s.vy) * 1.045);
    const a = rel * 1.0;
    s.vx = Math.sin(a) * sp; s.vy = Math.cos(a) * sp * dir;
    s.ev.push('bounce');
  };
  if (s.vy > 0 && s.by + BR >= py && s.by + BR <= py + 16 && Math.abs(s.bx - s.px) <= s.pw / 2 + BR) { s.by = py - BR; paddle(s.px, s.pw, -1); s.err = rnd(-1, 1) * (74 - l * 6); }
  if (s.vy < 0 && s.by - BR <= ay + 12 && s.by - BR >= ay - 4 && Math.abs(s.bx - s.ax) <= aw / 2 + BR) { s.by = ay + 12 + BR; paddle(s.ax, aw, 1); }
  if (s.by > PONG_H + 20) { s.as++; s.serve = 0.9; s.ev.push(s.as >= PONG_TARGET ? 'boom' : 'warn'); }
  else if (s.by < -20) { s.ps++; s.serve = 0.9; s.ev.push('coin'); }
  if (s.ps >= PONG_TARGET) return 'win';
  if (s.as >= PONG_TARGET) return 'lose';
  return null;
}

// ───────────────────────── Bắn phi thuyền ─────────────────────────
export const SHMUP_W = 480, SHMUP_H = 600;
export interface Enemy { x: number; y: number; vx: number; vy: number; hp: number; t: number; kind: number }
export interface Bullet { x: number; y: number; vx: number; vy: number }
export interface Shmup {
  x: number; bullets: Bullet[]; ebullets: Bullet[]; enemies: Enemy[]; kills: number; need: number; lives: number;
  inv: number; spawn: number; fire: number; level: number; t: number; ev: string[]; sparks: { x: number; y: number; t: number }[];
}
export function shmupNew(level: number): Shmup {
  const l = lvl(level);
  return { x: SHMUP_W / 2, bullets: [], ebullets: [], enemies: [], kills: 0, need: 12 + l * 5, lives: 3, inv: 0, spawn: 0.6, fire: 0, level: l, t: 0, ev: [], sparks: [] };
}
export function shmupStep(s: Shmup, dt: number, inp: Input): Result {
  const l = s.level; s.t += dt;
  if (inp.keys.has('left') || inp.keys.has('right')) s.x += ((inp.keys.has('right') ? 1 : 0) - (inp.keys.has('left') ? 1 : 0)) * 420 * dt;
  else if (inp.x >= 0) s.x += clamp(inp.x - s.x, -700 * dt, 700 * dt);
  s.x = clamp(s.x, 20, SHMUP_W - 20);
  s.inv = Math.max(0, s.inv - dt);
  s.fire -= dt;
  if (s.fire <= 0) {
    s.fire = 0.26 - l * 0.008;
    s.bullets.push({ x: s.x, y: SHMUP_H - 56, vx: 0, vy: -640 });
    if (l >= 6) { s.bullets.push({ x: s.x - 10, y: SHMUP_H - 52, vx: -60, vy: -620 }); s.bullets.push({ x: s.x + 10, y: SHMUP_H - 52, vx: 60, vy: -620 }); }
    s.ev.push('shoot');
  }
  s.spawn -= dt;
  if (s.spawn <= 0 && s.kills + s.enemies.length < s.need + 4) {
    s.spawn = Math.max(0.26, 1.1 - l * 0.085) * rnd(0.7, 1.3);
    const kind = l >= 4 && Math.random() < 0.15 + l * 0.03 ? 1 : 0;
    s.enemies.push({ x: rnd(30, SHMUP_W - 30), y: -20, vx: l >= 3 ? rnd(-60, 60) : 0, vy: 70 + l * 11 + rnd(0, 25), hp: kind ? (l >= 8 ? 3 : 2) : 1, t: rnd(0.8, 2.4), kind });
  }
  for (const b of s.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
  for (const b of s.ebullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
  s.bullets = s.bullets.filter((b) => b.y > -20 && b.x > -20 && b.x < SHMUP_W + 20);
  s.ebullets = s.ebullets.filter((b) => b.y < SHMUP_H + 20 && b.x > -20 && b.x < SHMUP_W + 20);
  for (const e of s.enemies) {
    e.x += e.vx * dt; e.y += e.vy * dt;
    if (e.x < 20 || e.x > SHMUP_W - 20) e.vx = -e.vx;
    e.t -= dt;
    if (e.t <= 0 && l >= 3 && e.y > 0 && e.y < SHMUP_H - 200) {
      e.t = Math.max(1.0, 3.4 - l * 0.22) * rnd(0.8, 1.3);
      const dx = s.x - e.x, dy = SHMUP_H - 56 - e.y, d = Math.hypot(dx, dy) || 1, sp = 190 + l * 12;
      s.ebullets.push({ x: e.x, y: e.y + 14, vx: (dx / d) * sp * (l >= 7 ? 1 : 0.2), vy: (dy / d) * sp + (l >= 7 ? 0 : 60) });
      s.ev.push('warn');
    }
  }
  // đạn trúng địch
  for (const b of s.bullets) {
    for (const e of s.enemies) {
      if (e.hp > 0 && Math.abs(b.x - e.x) < 18 && Math.abs(b.y - e.y) < 18) {
        e.hp--; b.y = -100;
        if (e.hp <= 0) { s.kills++; s.sparks.push({ x: e.x, y: e.y, t: 0.3 }); s.ev.push('hit'); } else s.ev.push('bounce');
        break;
      }
    }
  }
  s.enemies = s.enemies.filter((e) => e.hp > 0 && e.y < SHMUP_H + 30);
  s.sparks = s.sparks.filter((p) => (p.t -= dt) > 0);
  // trúng tàu mình
  if (s.inv <= 0) {
    const sy = SHMUP_H - 44;
    const hitE = s.enemies.find((e) => Math.abs(e.x - s.x) < 24 && Math.abs(e.y - sy) < 24);
    const hitB = s.ebullets.findIndex((b) => Math.abs(b.x - s.x) < 14 && Math.abs(b.y - sy) < 18);
    if (hitE || hitB >= 0) {
      if (hitE) { hitE.hp = 0; s.kills++; }
      if (hitB >= 0) s.ebullets.splice(hitB, 1);
      s.lives--; s.inv = 1.6; s.ev.push('boom');
      if (s.lives <= 0) return 'lose';
    }
  }
  return s.kills >= s.need ? 'win' : null;
}

// ───────────────────────── Tiểu hành tinh ─────────────────────────
export const AST_W = 480, AST_H = 480;
export interface Rock { x: number; y: number; vx: number; vy: number; size: number; a: number; va: number }
export interface Asteroids {
  x: number; y: number; a: number; vx: number; vy: number; bullets: (Bullet & { life: number })[]; rocks: Rock[];
  lives: number; inv: number; cd: number; level: number; score: number; ev: string[];
}
export const rockR = (size: number): number => [0, 12, 22, 36][size];
export function astNew(level: number): Asteroids {
  const l = lvl(level), rocks: Rock[] = [];
  const n = 2 + Math.ceil(l / 2);
  for (let i = 0; i < n; i++) {
    const edge = Math.random() < 0.5;
    const a = rnd(0, Math.PI * 2), sp = 26 + l * 6;
    rocks.push({ x: edge ? rnd(0, AST_W) : (Math.random() < 0.5 ? 20 : AST_W - 20), y: edge ? (Math.random() < 0.5 ? 20 : AST_H - 20) : rnd(0, AST_H), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: 3, a: 0, va: rnd(-1, 1) });
  }
  return { x: AST_W / 2, y: AST_H / 2, a: -Math.PI / 2, vx: 0, vy: 0, bullets: [], rocks, lives: 3, inv: 2, cd: 0, level: l, score: 0, ev: [] };
}
const wrap = (v: number, m: number): number => (v < 0 ? v + m : v >= m ? v - m : v);
export function astStep(s: Asteroids, dt: number, inp: Input): Result {
  if (inp.keys.has('left')) s.a -= 3.7 * dt;
  if (inp.keys.has('right')) s.a += 3.7 * dt;
  if (inp.keys.has('up')) { s.vx += Math.cos(s.a) * 270 * dt; s.vy += Math.sin(s.a) * 270 * dt; if (Math.random() < 0.3) s.ev.push('tick'); }
  const drag = Math.exp(-0.55 * dt); s.vx *= drag; s.vy *= drag;
  const sp = Math.hypot(s.vx, s.vy); if (sp > 320) { s.vx *= 320 / sp; s.vy *= 320 / sp; }
  s.x = wrap(s.x + s.vx * dt, AST_W); s.y = wrap(s.y + s.vy * dt, AST_H);
  s.inv = Math.max(0, s.inv - dt); s.cd -= dt;
  if ((inp.keys.has('space') || inp.keys.has('fire')) && s.cd <= 0 && s.bullets.length < 5) {
    s.cd = 0.22;
    s.bullets.push({ x: s.x + Math.cos(s.a) * 14, y: s.y + Math.sin(s.a) * 14, vx: Math.cos(s.a) * 520 + s.vx, vy: Math.sin(s.a) * 520 + s.vy, life: 1.05 });
    s.ev.push('shoot');
  }
  for (const b of s.bullets) { b.x = wrap(b.x + b.vx * dt, AST_W); b.y = wrap(b.y + b.vy * dt, AST_H); b.life -= dt; }
  s.bullets = s.bullets.filter((b) => b.life > 0);
  for (const r of s.rocks) { r.x = wrap(r.x + r.vx * dt, AST_W); r.y = wrap(r.y + r.vy * dt, AST_H); r.a += r.va * dt; }
  const add: Rock[] = [];
  for (const b of s.bullets) {
    for (const r of s.rocks) {
      if (r.size > 0 && Math.hypot(b.x - r.x, b.y - r.y) < rockR(r.size) + 3) {
        b.life = 0; s.score += [0, 100, 50, 20][r.size];
        if (r.size > 1) for (let i = 0; i < 2; i++) { const a = rnd(0, Math.PI * 2), sp = Math.hypot(r.vx, r.vy) * 1.25 + 14; add.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: r.size - 1, a: 0, va: rnd(-2, 2) }); }
        r.size = 0; s.ev.push(add.length ? 'hit' : 'pop');
        break;
      }
    }
  }
  s.rocks = s.rocks.filter((r) => r.size > 0).concat(add);
  if (s.inv <= 0) {
    for (const r of s.rocks) {
      if (Math.hypot(s.x - r.x, s.y - r.y) < rockR(r.size) + 8) {
        s.lives--; s.ev.push('boom'); s.inv = 2.2; s.x = AST_W / 2; s.y = AST_H / 2; s.vx = 0; s.vy = 0;
        if (s.lives <= 0) return 'lose';
        break;
      }
    }
  }
  return s.rocks.length ? null : 'win';
}

// ───────────────────────── Mê cung ─────────────────────────
export const MAZE_N = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25];
export interface Maze {
  n: number; walls: Uint8Array; r: number; c: number; time: number; total: number; seen: Uint8Array; fog: number; cd: number; steps: number; level: number; ev: string[];
}
const DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1]; // 0=lên 1=phải 2=xuống 3=trái; bit tường = 1<<d
export function mazeNew(level: number): Maze {
  const l = lvl(level), n = MAZE_N[l - 1];
  const walls = new Uint8Array(n * n).fill(15);
  const vis = new Uint8Array(n * n), stack = [0]; vis[0] = 1;
  while (stack.length) {
    const cur = stack[stack.length - 1], r = Math.floor(cur / n), c = cur % n;
    const opts: number[] = [];
    for (let d = 0; d < 4; d++) { const rr = r + DR[d], cc = c + DC[d]; if (rr >= 0 && rr < n && cc >= 0 && cc < n && !vis[rr * n + cc]) opts.push(d); }
    if (!opts.length) { stack.pop(); continue; }
    const d = opts[Math.floor(Math.random() * opts.length)], nx = (r + DR[d]) * n + c + DC[d];
    walls[cur] &= ~(1 << d); walls[nx] &= ~(1 << ((d + 2) % 4)); vis[nx] = 1; stack.push(nx);
  }
  const m: Maze = { n, walls, r: 0, c: 0, time: 0, total: 0, seen: new Uint8Array(n * n), fog: l >= 5 ? [0, 0, 0, 0, 7, 6, 5, 4, 3, 3][l - 1] : 0, cd: 0, steps: 0, level: l, ev: [] };
  const len = mazePath(m).length;
  m.total = m.time = Math.round(len * (1.7 - l * 0.1) + 14);
  m.seen[0] = 1;
  return m;
}
/** Đường ngắn nhất từ ô hiện tại tới đích (danh sách ô, gồm cả ô hiện tại) */
export function mazePath(m: Maze): number[] {
  const n = m.n, goal = n * n - 1, from = new Int32Array(n * n).fill(-2), q = [m.r * n + m.c];
  from[q[0]] = -1;
  for (let i = 0; i < q.length; i++) {
    const cur = q[i]; if (cur === goal) break;
    const r = Math.floor(cur / n), c = cur % n;
    for (let d = 0; d < 4; d++) if (!(m.walls[cur] & (1 << d))) { const nx = (r + DR[d]) * n + c + DC[d]; if (from[nx] === -2) { from[nx] = cur; q.push(nx); } }
  }
  const path: number[] = [];
  for (let p = goal; p !== -1 && from[p] !== -2; p = from[p]) path.push(p);
  return path.reverse();
}
export function mazeStep(m: Maze, dt: number, inp: Input): Result {
  m.time -= dt; m.cd -= dt;
  let d = -1;
  for (const [k, v] of [['up', 0], ['right', 1], ['down', 2], ['left', 3]] as [string, number][]) if (inp.pressed.has(k) || (m.cd <= 0 && inp.keys.has(k))) d = v;
  if (d >= 0 && (m.cd <= 0 || inp.pressed.has(['up', 'right', 'down', 'left'][d]))) {
    const cur = m.r * m.n + m.c;
    if (m.walls[cur] & (1 << d)) { m.ev.push('tick'); m.cd = 0.08; }
    else { m.r += DR[d]; m.c += DC[d]; m.cd = 0.085; m.steps++; m.ev.push('tick'); }
    const here = m.r * m.n + m.c;
    if (m.fog) for (let dr = -m.fog; dr <= m.fog; dr++) for (let dc = -m.fog; dc <= m.fog; dc++) {
      const rr = m.r + dr, cc = m.c + dc;
      if (rr >= 0 && rr < m.n && cc >= 0 && cc < m.n && dr * dr + dc * dc <= m.fog * m.fog) m.seen[rr * m.n + cc] = 1;
    }
    if (here === m.n * m.n - 1) return 'win';
  }
  return m.time <= 0 ? 'lose' : null;
}

// ───────────────────────── Qua đường ─────────────────────────
export const ROAD_COLS = 11, ROAD_ROWS = 11, ROAD_GOALS = 3;
export interface Lane { row: number; kind: 'road' | 'river' | 'safe'; speed: number; items: { x: number; len: number }[] }
export interface Road { lanes: Lane[]; x: number; row: number; lives: number; goals: number; level: number; dead: number; ev: string[]; t: number }
export function roadNew(level: number): Road {
  const l = lvl(level), lanes: Lane[] = [];
  for (let row = 0; row < ROAD_ROWS; row++) {
    if (row === 0 || row === 5 || row === 10) { lanes.push({ row, kind: 'safe', speed: 0, items: [] }); continue; }
    const river = l >= 5 && row >= 1 && row <= 4;
    const dir = row % 2 ? 1 : -1;
    const base = river ? 0.9 + l * 0.12 : 1.1 + l * 0.32;
    const speed = dir * base * rnd(0.75, 1.3);
    const items: { x: number; len: number }[] = [];
    let x = rnd(0, 3);
    const gap = river ? rnd(2.2, 3.2) : Math.max(2.6, 6.4 - l * 0.4) * rnd(0.9, 1.5);
    while (x < ROAD_COLS + 6) { const len = river ? (Math.random() < 0.5 ? 3 : 2) : (Math.random() < 0.3 ? 2 : 1); items.push({ x, len }); x += len + (river ? rnd(1.6, 2.6) : gap); }
    lanes.push({ row, kind: river ? 'river' : 'road', speed, items });
  }
  return { lanes, x: 5, row: 10, lives: 3, goals: 0, level: l, dead: 0, ev: [], t: 0 };
}
const ROAD_SPAN = ROAD_COLS + 6;
export function roadStep(s: Road, dt: number, inp: Input): Result {
  s.t += dt;
  for (const ln of s.lanes) for (const it of ln.items) {
    it.x += ln.speed * dt;
    if (ln.speed > 0 && it.x > ROAD_COLS + 3) it.x -= ROAD_SPAN + it.len;
    if (ln.speed < 0 && it.x < -3 - it.len) it.x += ROAD_SPAN + it.len;
  }
  if (s.dead > 0) { s.dead -= dt; if (s.dead <= 0) { s.x = 5; s.row = 10; } return null; }
  const ln = s.lanes[s.row];
  if (ln.kind === 'river') s.x += ln.speed * dt;
  const hop = (dr: number, dc: number): void => {
    s.row = clamp(s.row + dr, 0, ROAD_ROWS - 1);
    s.x = dc ? clamp(Math.round(s.x) + dc, 0, ROAD_COLS - 1) : s.x;
    s.ev.push('jump');
  };
  if (inp.pressed.has('up')) hop(-1, 0);
  else if (inp.pressed.has('down')) hop(1, 0);
  else if (inp.pressed.has('left')) hop(0, -1);
  else if (inp.pressed.has('right')) hop(0, 1);
  const cur = s.lanes[s.row], px0 = s.x + 0.18, px1 = s.x + 0.82;
  const die = (why: string): Result => { s.lives--; s.dead = 0.7; s.ev.push(why); return s.lives <= 0 ? 'lose' : null; };
  if (cur.kind === 'road') {
    if (cur.items.some((it) => px1 > it.x + 0.08 && px0 < it.x + it.len - 0.08)) return die('hit');
  } else if (cur.kind === 'river') {
    if (s.x < -0.4 || s.x > ROAD_COLS - 0.6) return die('boom');
    if (!cur.items.some((it) => px1 > it.x + 0.15 && px0 < it.x + it.len - 0.15)) return die('whoosh');
  }
  if (s.row === 0) {
    s.goals++; s.ev.push('coin');
    if (s.goals >= ROAD_GOALS) return 'win';
    s.row = 10; s.x = 5;
  }
  return null;
}

// ───────────────────────── Chim bay ─────────────────────────
export const FLAP_W = 480, FLAP_H = 600, FLAP_GROUND = 70;
export interface Pipe { x: number; gapY: number; passed: boolean }
export interface Flappy { y: number; vy: number; pipes: Pipe[]; passed: number; need: number; next: number; t: number; level: number; ev: string[] }
export const FLAP_X = 120, FLAP_R = 14;
export const flapGap = (l: number): number => Math.max(118, 200 - l * 8);
export function flapNew(level: number): Flappy {
  const l = lvl(level);
  return { y: FLAP_H / 2 - 40, vy: 0, pipes: [], passed: 0, need: 8 + l * 2, next: 300, t: 0, level: l, ev: [] };
}
export function flapStep(s: Flappy, dt: number, inp: Input): Result {
  const l = s.level; s.t += dt;
  if (inp.pressed.has('tap') || inp.pressed.has('space') || inp.pressed.has('up') || inp.pressed.has('fire')) { s.vy = -430; s.ev.push('jump'); }
  if (s.t > 0.45 || s.vy < 0) { s.vy += 1450 * dt; s.y += s.vy * dt; } else s.y += Math.sin(s.t * 12) * 20 * dt;
  const sp = 150 + l * 10;
  for (const p of s.pipes) p.x -= sp * dt;
  s.next -= sp * dt;
  if (s.next <= 0) {
    const g = flapGap(l);
    const lo = 40 + g / 2, hi = FLAP_H - FLAP_GROUND - 40 - g / 2, prev = s.pipes.length ? s.pipes[s.pipes.length - 1].gapY : (lo + hi) / 2;
    // khe kế tiếp không lệch quá xa khe trước để luôn bay lên kịp
    s.pipes.push({ x: FLAP_W + 40, gapY: rnd(Math.max(lo, prev - 150), Math.min(hi, prev + 170)), passed: false });
    s.next = 250 - l * 4;
  }
  s.pipes = s.pipes.filter((p) => p.x > -80);
  const g = flapGap(l);
  for (const p of s.pipes) {
    if (!p.passed && p.x + 30 < FLAP_X - FLAP_R) { p.passed = true; s.passed++; s.ev.push('coin'); }
    if (FLAP_X + FLAP_R > p.x - 30 && FLAP_X - FLAP_R < p.x + 30 && (s.y - FLAP_R < p.gapY - g / 2 || s.y + FLAP_R > p.gapY + g / 2)) { s.ev.push('hit'); return 'lose'; }
  }
  if (s.y + FLAP_R > FLAP_H - FLAP_GROUND || s.y - FLAP_R < -40) { s.ev.push('hit'); return 'lose'; }
  return s.passed >= s.need ? 'win' : null;
}

// ───────────────────────── Khủng long chạy ─────────────────────────
export const RUN_W = 640, RUN_H = 260, RUN_GROUND = 200;
export interface Obstacle { x: number; w: number; h: number; y: number; kind: 'cactus' | 'bird' }
export interface Runner { y: number; vy: number; duck: boolean; obs: Obstacle[]; dist: number; need: number; next: number; level: number; t: number; ev: string[] }
export const RUN_X = 70, RUN_DINO_W = 40;
export function runNew(level: number): Runner {
  const l = lvl(level);
  return { y: 0, vy: 0, duck: false, obs: [], dist: 0, need: 90 + l * 45, next: 500, level: l, t: 0, ev: [] };
}
export const runSpeed = (s: Runner): number => 300 + s.level * 26 + Math.min(120, s.t * 4);
export function runStep(s: Runner, dt: number, inp: Input): Result {
  s.t += dt;
  const sp = runSpeed(s);
  s.dist += sp * dt / 18;
  s.duck = inp.keys.has('down') && s.y <= 0;
  if ((inp.pressed.has('tap') || inp.pressed.has('space') || inp.pressed.has('up')) && s.y <= 0) { s.vy = 760; s.ev.push('jump'); }
  if (s.y > 0 || s.vy > 0) { s.vy -= (s.duck ? 3600 : 2300) * dt; s.y = Math.max(0, s.y + s.vy * dt); if (s.y === 0) s.vy = 0; }
  if (inp.keys.has('down') && s.y > 0) s.vy -= 2600 * dt; // nhấn xuống khi đang bay: rơi nhanh
  for (const o of s.obs) o.x -= sp * dt;
  s.obs = s.obs.filter((o) => o.x + o.w > -20);
  s.next -= sp * dt;
  if (s.next <= 0) {
    const bird = s.level >= 3 && Math.random() < 0.28 + s.level * 0.01;
    if (bird) s.obs.push({ x: RUN_W + 20, w: 38, h: 26, y: Math.random() < 0.5 ? 0 : 38 + 0, kind: 'bird' });
    else { const n = 1 + (s.level >= 4 && Math.random() < 0.4 ? 1 : 0) + (s.level >= 8 && Math.random() < 0.3 ? 1 : 0); s.obs.push({ x: RUN_W + 20, w: 20 * n, h: rnd(36, 56), y: 0, kind: 'cactus' }); }
    s.next = sp * 0.72 + rnd(140, 340) - s.level * 6;
  }
  const dh = s.duck ? 26 : 46, dx0 = RUN_X + 6, dx1 = RUN_X + RUN_DINO_W - 6;
  for (const o of s.obs) {
    if (dx1 > o.x + 3 && dx0 < o.x + o.w - 3 && s.y < o.y + o.h - 4 && s.y + dh > o.y + 4) { s.ev.push('hit'); return 'lose'; }
  }
  return s.dist >= s.need ? 'win' : null;
}
