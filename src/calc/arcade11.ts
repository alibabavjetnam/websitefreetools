/** Lõi thuần đợt 11: Thủ thành (tower defense) và Tô màu theo số. */
import type { Input, Result } from './arcade4';
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const lv = (l: number): number => clamp(l, 1, 10);

/* ============================ Thủ thành ============================ */
export const TD_W = 480, TD_H = 600, TD_C = 40;
const PATHS: [number, number][][] = [
  [[0, 2], [10, 2], [10, 6], [1, 6], [1, 10], [10, 10], [10, 14]],
  [[0, 1], [5, 1], [5, 12], [8, 12], [8, 4], [11, 4], [11, 14]],
  [[0, 13], [0, 1], [10, 1], [10, 12], [3, 12], [3, 5], [7, 5], [7, 8]],
];
export interface Foe { d: number; hp: number; max: number; sp: number; fast: boolean }
export interface Tower { cx: number; cy: number; lvl: number; cd: number }
export interface Shot { x1: number; y1: number; x2: number; y2: number; t: number }
export interface TD { path: [number, number][]; len: number; foes: Foe[]; towers: Tower[]; shots: Shot[]; gold: number; lives: number; wave: number; waves: number; toSpawn: number; spawnT: number; breakT: number; level: number; ev: string[]; pathCells: Set<number>; hpMul: number }
const segLen = (a: [number, number], b: [number, number]): number => (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])) * TD_C;
export function tdNew(level: number): TD {
  const l = lv(level), path = PATHS[l <= 3 ? 0 : l <= 7 ? 1 : 2], cells = new Set<number>();
  for (let i = 0; i + 1 < path.length; i++) { const [a, b] = [path[i], path[i + 1]]; const dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]); let x = a[0], y = a[1]; for (;;) { cells.add(y * 12 + x); if (x === b[0] && y === b[1]) break; x += dx; y += dy; } }
  let len = 0; for (let i = 0; i + 1 < path.length; i++) len += segLen(path[i], path[i + 1]);
  return { path, len, foes: [], towers: [], shots: [], gold: 140, lives: 15, wave: 0, waves: 5 + Math.ceil(l / 2), toSpawn: 0, spawnT: 0, breakT: 4, level: l, ev: [], pathCells: cells, hpMul: 1 + l * 0.17 };
}
export function tdPos(s: TD, d: number): [number, number] {
  let r = d;
  for (let i = 0; i + 1 < s.path.length; i++) {
    const a = s.path[i], b = s.path[i + 1], L = segLen(a, b);
    if (r <= L || i + 2 === s.path.length) { const k = clamp(r / L, 0, 1); return [(a[0] + (b[0] - a[0]) * k) * TD_C + TD_C / 2, (a[1] + (b[1] - a[1]) * k) * TD_C + TD_C / 2]; }
    r -= L;
  }
  return [0, 0];
}
export const towerCost = (s: TD): number => 50 + Math.max(0, s.towers.length - 4) * 5;
export const upgradeCost = (t: Tower): number => 40 * t.lvl;
export const towerRange = (t: Tower): number => 105 + t.lvl * 12;
export const towerDmg = (t: Tower): number => 7 + t.lvl * 6;
export function tdStep(s: TD, dt: number, inp: Input): Result {
  if (inp.pressed.has('tap') && inp.x >= 0) {
    const cx = Math.floor(inp.x / TD_C), cy = Math.floor(inp.y / TD_C), tw = s.towers.find((t) => t.cx === cx && t.cy === cy);
    if (tw) { const c = upgradeCost(tw); if (tw.lvl < 5 && s.gold >= c) { s.gold -= c; tw.lvl++; s.ev.push('levelup'); } else s.ev.push('error'); }
    else if (!s.pathCells.has(cy * 12 + cx) && cx >= 0 && cx < 12 && cy >= 0 && cy < 15) { const c = towerCost(s); if (s.gold >= c) { s.gold -= c; s.towers.push({ cx, cy, lvl: 1, cd: 0 }); s.ev.push('place'); } else s.ev.push('error'); }
  }
  // sóng
  if (s.toSpawn === 0 && !s.foes.length && s.wave < s.waves) { s.breakT -= dt; if (s.breakT <= 0) { s.wave++; s.toSpawn = 6 + s.wave * 2 + Math.floor(s.level / 2); s.spawnT = 0; s.breakT = 4; s.ev.push('warn'); } }
  if (s.toSpawn > 0) { s.spawnT -= dt; if (s.spawnT <= 0) { const fast = s.wave % 3 === 0 && s.toSpawn % 3 === 0, hp = (22 + s.wave * 13) * s.hpMul * (fast ? 0.55 : 1); s.foes.push({ d: 0, hp, max: hp, sp: (fast ? 78 : 46) + s.level * 2, fast }); s.toSpawn--; s.spawnT = Math.max(0.45, 1.0 - s.level * 0.04); } }
  for (const f of s.foes) f.d += f.sp * dt;
  for (const f of s.foes) if (f.d >= s.len) { f.hp = 0; s.lives--; s.ev.push('boom'); }
  s.foes = s.foes.filter((f) => f.hp > 0 || f.d >= s.len ? f.d < s.len && f.hp > 0 : false);
  for (const t of s.towers) {
    t.cd -= dt; if (t.cd > 0) continue;
    const tx = t.cx * TD_C + TD_C / 2, ty = t.cy * TD_C + TD_C / 2; let best: Foe | null = null;
    for (const f of s.foes) { const [fx, fy] = tdPos(s, f.d); if (Math.hypot(fx - tx, fy - ty) <= towerRange(t) && (!best || f.d > best.d)) best = f; }
    if (best) { const [fx, fy] = tdPos(s, best.d); best.hp -= towerDmg(t); t.cd = 0.55; s.shots.push({ x1: tx, y1: ty, x2: fx, y2: fy, t: 0.12 }); s.ev.push('shoot'); if (best.hp <= 0) { s.gold += 7 + Math.floor(s.wave / 2); s.ev.push('pop'); } }
  }
  s.foes = s.foes.filter((f) => f.hp > 0);
  for (const sh of s.shots) sh.t -= dt; s.shots = s.shots.filter((x) => x.t > 0);
  if (s.lives <= 0) return 'lose';
  return s.wave >= s.waves && !s.toSpawn && !s.foes.length ? 'win' : null;
}

/* ============================ Tô màu theo số ============================ */
export interface Pic { rows: string[]; pal: Record<string, string> }
const P = (rows: string[], pal: Record<string, string>): Pic => ({ rows, pal });
export const PICS: Pic[] = [
  P(['..11..11..', '.1221221..'.replace('..', '.'), '1222222221', '1222222221', '1222222221', '.12222221.', '..122221..', '...1221...', '....11....', '..........'].map((r) => r.slice(0, 10).padEnd(10, '.')), { 1: '#c92a2a', 2: '#ff6b6b' }),
  P(['....11....', '....11....', '...1221...', '..122221..', '1122222211', '.12222221.', '..122221..', '..122221..', '.1221.1221', '.11....11.'], { 1: '#e67700', 2: '#ffd43b' }),
  P(['....11....', '...1221...', '..122221..', '.11111111.', '.13333331.', '.13344331.', '.13344331.', '.13333331.', '.13355331.', '.11111111.'], { 1: '#5c3a1a', 2: '#c92a2a', 3: '#f1d7a0', 4: '#74c0fc', 5: '#8d5a2b' }),
  P(['....22....', '...2222...', '..222222..', '.22222222.', '..222222..', '...2222...', '....33....', '....33....', '....33....', '..444444..'], { 2: '#2f9e44', 3: '#7b4a1e', 4: '#8ce99a' }),
  P(['..........', '..111.....', '.12221..11', '1222221.11', '12322221.1', '1222222211', '1222222211', '.12222221.', '..11111...', '..........'], { 1: '#1971c2', 2: '#74c0fc', 3: '#fff' }),
  P(['..33..33..', '.3223223..'.replace('..', '.'), '.32222223.', '.32422423.', '.32222223.', '..325523..', '...3223...', '....33....', '..........', '..........'].map((r) => r.slice(0, 10).padEnd(10, '.')), { 2: '#ffa94d', 3: '#e8590c', 4: '#212529', 5: '#f783ac' }),
  P(['...2222...', '..222222..', '.22211222.', '.22111122.', '.22211222.', '..222222..', '...3333...', '....33....', '..444444..', '..........'], { 1: '#e03131', 2: '#fcc2d7', 3: '#2f9e44', 4: '#8ce99a' }),
  P(['.....1....', '.....11...', '.....111..', '.....1111.', '.222222222', '.233333332', '..2222222.', '...22222..', '..........', '..........'], { 1: '#f8f9fa', 2: '#364fc7', 3: '#4c6ef5' }),
  P(['...2222...', '..232232..', '.22222222.', '.22222222.', '..222222..', '...2222...', '...1111...', '...1111...', '..111111..', '..........'], { 1: '#c2255c', 2: '#ffe066', 3: '#f783ac' }),
  P(['....33....', '...3443...', '...3443...', '..334433..', '..334433..', '.33444433.', '.35555553.', '3355555533', '3.33..33.3', '..66..66..'], { 3: '#868e96', 4: '#74c0fc', 5: '#e03131', 6: '#ff922b' }),
];
export const picColors = (p: Pic): string[] => Object.keys(p.pal).sort();
export const picSize = (p: Pic): number => p.rows.length;
export const picCells = (p: Pic): number => p.rows.join('').split('').filter((c) => c !== '.').length;
export function picDone(p: Pic, g: string[]): boolean { return p.rows.every((r, y) => r.split('').every((c, x) => c === '.' || g[y * r.length + x] === c)); }
export const picGoal = (p: Pic, i: number): string => p.rows[Math.floor(i / p.rows[0].length)][i % p.rows[0].length];
