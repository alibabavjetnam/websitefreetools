/** Lõi thuần đợt 9: N-back, Tiệm bánh (clicker), Nối cặp (Onet), Ghép hình, Golf mini. */
import type { Input, Result } from './arcade4';
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
const ri = (a: number, b: number): number => Math.floor(rnd(a, b + 1));
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const lv = (l: number): number => clamp(l, 1, 10);
function shuffle<T>(a: T[]): T[] { for (let i = a.length - 1; i > 0; i--) { const j = ri(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ============================ N-back ============================ */
export const nbackCfg = (l: number): { n: number; trials: number; ms: number } => ({ n: [1, 1, 2, 2, 2, 3, 3, 3, 4, 4][lv(l) - 1], trials: 22 + (lv(l) > 5 ? 4 : 0), ms: [2600, 2400, 2600, 2400, 2200, 2600, 2400, 2200, 2600, 2400][lv(l) - 1] });
export function nbackSeq(n: number, trials: number): number[] {
  const s: number[] = [];
  for (let i = 0; i < trials; i++) {
    if (i >= n && Math.random() < 0.3) s.push(s[i - n]);
    else { let v = ri(0, 8); if (i >= n && v === s[i - n]) v = (v + 1 + ri(0, 7)) % 9; s.push(v); }
  }
  return s;
}
export const nbackTarget = (s: number[], i: number, n: number): boolean => i >= n && s[i] === s[i - n];

/* ============================ Tiệm bánh (clicker) ============================ */
export const CK_ITEMS = [{ key: 'cursor', cost: 15, cps: 0.5 }, { key: 'grandma', cost: 100, cps: 3 }, { key: 'farm', cost: 600, cps: 15 }, { key: 'mine', cost: 3500, cps: 80 }, { key: 'factory', cost: 20000, cps: 400 }];
export const CK_TARGET = [400, 550, 700, 900, 1100, 1350, 1600, 1850, 2100, 2400];
export const CK_TIME = 120;
export interface Clicker { cookies: number; earned: number; own: number[]; time: number; target: number; level: number; ev: string[] }
export const clickerNew = (level: number): Clicker => ({ cookies: 0, earned: 0, own: CK_ITEMS.map(() => 0), time: CK_TIME, target: CK_TARGET[lv(level) - 1], level: lv(level), ev: [] });
export const ckCost = (s: Clicker, i: number): number => Math.ceil(CK_ITEMS[i].cost * 1.15 ** s.own[i]);
export const ckCps = (s: Clicker): number => s.own.reduce((a, n, i) => a + n * CK_ITEMS[i].cps, 0);
export function ckClick(s: Clicker): void { s.cookies++; s.earned++; s.ev.push('tick'); }
export function ckBuy(s: Clicker, i: number): boolean { const c = ckCost(s, i); if (s.cookies < c) return false; s.cookies -= c; s.own[i]++; s.ev.push('coin'); return true; }
export function ckTick(s: Clicker, dt: number): Result {
  const g = ckCps(s) * dt; s.cookies += g; s.earned += g; s.time -= dt;
  if (s.earned >= s.target) return 'win';
  return s.time <= 0 ? 'lose' : null;
}

/* ============================ Nối cặp (Onet) ============================ */
export const onetCfg = (l: number): { r: number; c: number; types: number; time: number; shuffles: number } => {
  const k = lv(l); return { r: k <= 2 ? 6 : 8, c: k <= 2 ? 8 : k <= 5 ? 10 : 12, types: Math.min(30, 8 + k * 2), time: 240 + k * 12, shuffles: k <= 3 ? 3 : k <= 7 ? 2 : 1 };
};
export interface Onet { r: number; c: number; g: number[]; left: number; level: number; shuffles: number }
export const onetIdx = (o: Onet, r: number, c: number): number => (r + 1) * (o.c + 2) + (c + 1);
export function onetPath(o: Onet, a: number, b: number): [number, number][] | null {
  if (a === b || !o.g[a] || o.g[a] !== o.g[b]) return null;
  const W = o.c + 2, H = o.r + 2, ar = Math.floor(a / W), ac = a % W, br = Math.floor(b / W), bc = b % W;
  const DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1];
  const best = new Map<number, number>(), prev = new Map<string, string>();
  type St = [number, number, number, number]; // r,c,dir,turns
  const q: St[] = [];
  for (let d = 0; d < 4; d++) { q.push([ar, ac, d, 0]); best.set((ar * W + ac) * 4 + d, 0); prev.set(`${ar},${ac},${d},0`, ''); }
  for (let h = 0; h < q.length; h++) {
    const [r, c, d, t] = q[h];
    for (let nd = 0; nd < 4; nd++) {
      if (nd === (d + 2) % 4) continue;
      const nt = t + (nd === d ? 0 : 1); if (nt > 2) continue;
      const nr = r + DR[nd], nc = c + DC[nd]; if (nr < 0 || nr >= H || nc < 0 || nc >= W) continue;
      const key = (nr * W + nc) * 4 + nd;
      if (nr === br && nc === bc) {
        const path: [number, number][] = [[br, bc], [r, c]]; let cur = `${r},${c},${d},${t}`;
        for (;;) { const p = prev.get(cur); if (!p) break; const [pr, pc] = p.split(',').map(Number); path.push([pr, pc]); cur = p; }
        return path.reverse();
      }
      if (o.g[nr * W + nc]) continue;
      if (best.has(key) && (best.get(key) as number) <= nt) continue;
      best.set(key, nt); prev.set(`${nr},${nc},${nd},${nt}`, `${r},${c},${d},${t}`); q.push([nr, nc, nd, nt]);
    }
  }
  return null;
}
export function onetHint(o: Onet): [number, number] | null {
  const W = o.c + 2, cells: number[] = []; for (let i = 0; i < o.g.length; i++) if (o.g[i]) cells.push(i);
  for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) if (o.g[cells[i]] === o.g[cells[j]] && onetPath(o, cells[i], cells[j])) return [cells[i], cells[j]];
  void W; return null;
}
export function onetFill(o: Onet, kinds: number[]): void {
  for (let t = 0; t < 200; t++) {
    const k = shuffle(kinds.slice()); let p = 0;
    for (let r = 1; r <= o.r; r++) for (let c = 1; c <= o.c; c++) o.g[r * (o.c + 2) + c] = k[p++];
    if (onetHint(o)) return;
  }
}
export function onetNew(level: number): Onet {
  const cfg = onetCfg(level), o: Onet = { r: cfg.r, c: cfg.c, g: new Array((cfg.r + 2) * (cfg.c + 2)).fill(0), left: cfg.r * cfg.c, level: lv(level), shuffles: cfg.shuffles };
  const kinds: number[] = []; for (let i = 0; i < (cfg.r * cfg.c) / 2; i++) { const t = (i % cfg.types) + 1; kinds.push(t, t); }
  onetFill(o, kinds); return o;
}
export function onetRemove(o: Onet, a: number, b: number): boolean { if (!onetPath(o, a, b)) return false; o.g[a] = 0; o.g[b] = 0; o.left -= 2; return true; }
export function onetShuffle(o: Onet): void {
  const kinds = o.g.filter(Boolean); const idx: number[] = []; o.g.forEach((v, i) => v && idx.push(i));
  for (let t = 0; t < 200; t++) { const k = shuffle(kinds.slice()); idx.forEach((i, n) => (o.g[i] = k[n])); if (onetHint(o)) return; }
}

/* ============================ Ghép hình ============================ */
export const jigN = (l: number): number => [3, 3, 3, 4, 4, 4, 5, 5, 6, 6][lv(l) - 1];
export function jigShuffle(n: number): number[] {
  const a = Array.from({ length: n * n }, (_, i) => i);
  for (let t = 0; t < 50; t++) { shuffle(a); if (a.some((v, i) => v !== i)) break; }
  return a;
}
export const jigDone = (a: number[]): boolean => a.every((v, i) => v === i);

/* ============================ Golf mini ============================ */
export const GOLF_W = 480, GOLF_H = 600, GOLF_BR = 8, GOLF_HR = 13;
export interface GolfCourse { tee: [number, number]; hole: [number, number]; walls: [number, number, number, number][]; sand: [number, number, number, number][]; par: number }
export const GOLF: GolfCourse[] = [
  { tee: [240, 520], hole: [240, 90], walls: [], sand: [], par: 2 },
  { tee: [100, 520], hole: [380, 90], walls: [[180, 290, 120, 20]], sand: [], par: 2 },
  { tee: [100, 530], hole: [100, 80], walls: [[0, 300, 340, 20]], sand: [], par: 3 },
  { tee: [240, 540], hole: [240, 80], walls: [[0, 400, 330, 18], [150, 240, 330, 18]], sand: [], par: 4 },
  { tee: [240, 540], hole: [240, 80], walls: [[0, 220, 170, 18]], sand: [[120, 300, 240, 120]], par: 3 },
  { tee: [240, 540], hole: [240, 120], walls: [[150, 50, 16, 140], [314, 50, 16, 140], [150, 50, 180, 16]], sand: [], par: 3 },
  { tee: [80, 540], hole: [400, 70], walls: [[0, 440, 360, 18], [120, 300, 360, 18], [0, 160, 360, 18]], sand: [], par: 5 },
  { tee: [240, 550], hole: [240, 70], walls: [[100, 150, 30, 30], [350, 150, 30, 30], [225, 250, 30, 30], [100, 350, 30, 30], [350, 350, 30, 30], [225, 450, 30, 30]], sand: [], par: 3 },
  { tee: [60, 540], hole: [420, 80], walls: [[0, 400, 300, 18], [180, 200, 300, 18]], sand: [[320, 280, 160, 110], [0, 90, 150, 100]], par: 4 },
  { tee: [60, 550], hole: [420, 60], walls: [[120, 120, 18, 480], [240, 0, 18, 480], [360, 120, 18, 480]], sand: [], par: 6 },
];
export interface Golf { c: GolfCourse; bx: number; by: number; vx: number; vy: number; moving: boolean; strokes: number; limit: number; aim: { x: number; y: number } | null; lastX: number; lastY: number; prevDown: boolean; sunk: number; level: number; ev: string[] }
export function golfNew(level: number): Golf {
  const c = GOLF[lv(level) - 1];
  return { c, bx: c.tee[0], by: c.tee[1], vx: 0, vy: 0, moving: false, strokes: 0, limit: c.par + 3, aim: null, lastX: 0, lastY: 0, prevDown: false, sunk: 0, level: lv(level), ev: [] };
}
const inRect = (x: number, y: number, r: [number, number, number, number]): boolean => x > r[0] && x < r[0] + r[2] && y > r[1] && y < r[1] + r[3];
export function golfStep(s: Golf, dt: number, inp: Input): Result {
  if (!s.moving) {
    if (inp.down && inp.x >= 0) { if (!s.aim) s.aim = { x: inp.x, y: inp.y }; s.lastX = inp.x; s.lastY = inp.y; }
    if (s.aim && !inp.down && s.prevDown) {
      const px = (s.aim.x - s.lastX) * 4.5, py = (s.aim.y - s.lastY) * 4.5, sp = Math.hypot(px, py);
      if (sp > 40) { const k = Math.min(1, 820 / sp); s.vx = px * k; s.vy = py * k; s.moving = true; s.strokes++; s.ev.push('hit'); }
      s.aim = null;
    }
    s.prevDown = inp.down; return null;
  }
  s.prevDown = inp.down;
  const steps = 4;
  for (let k = 0; k < steps; k++) {
    const h = dt / steps, sand = s.c.sand.some((r) => inRect(s.bx, s.by, r));
    const damp = Math.exp(-(sand ? 4.2 : 0.75) * h); s.vx *= damp; s.vy *= damp;
    s.bx += s.vx * h; s.by += s.vy * h;
    if (s.bx < GOLF_BR) { s.bx = GOLF_BR; s.vx = Math.abs(s.vx) * 0.8; s.ev.push('bounce'); }
    if (s.bx > GOLF_W - GOLF_BR) { s.bx = GOLF_W - GOLF_BR; s.vx = -Math.abs(s.vx) * 0.8; s.ev.push('bounce'); }
    if (s.by < GOLF_BR) { s.by = GOLF_BR; s.vy = Math.abs(s.vy) * 0.8; s.ev.push('bounce'); }
    if (s.by > GOLF_H - GOLF_BR) { s.by = GOLF_H - GOLF_BR; s.vy = -Math.abs(s.vy) * 0.8; s.ev.push('bounce'); }
    for (const [x, y, w, hh] of s.c.walls) {
      const cx = clamp(s.bx, x, x + w), cy = clamp(s.by, y, y + hh), dx = s.bx - cx, dy = s.by - cy, d = Math.hypot(dx, dy);
      if (d < GOLF_BR) {
        let nx: number, ny: number;
        if (d > 0.0001) { nx = dx / d; ny = dy / d; s.bx = cx + nx * GOLF_BR; s.by = cy + ny * GOLF_BR; }
        else { const l = s.bx - x, r = x + w - s.bx, t = s.by - y, b = y + hh - s.by, m = Math.min(l, r, t, b); nx = m === l ? -1 : m === r ? 1 : 0; ny = m === t ? -1 : m === b ? 1 : 0; s.bx += nx * GOLF_BR; s.by += ny * GOLF_BR; }
        const dot = s.vx * nx + s.vy * ny; if (dot < 0) { s.vx -= 1.8 * dot * nx; s.vy -= 1.8 * dot * ny; s.ev.push('bounce'); }
      }
    }
    const sp = Math.hypot(s.vx, s.vy);
    if (Math.hypot(s.bx - s.c.hole[0], s.by - s.c.hole[1]) < GOLF_HR && sp < 430) { s.sunk = 1; s.ev.push('coin'); return 'win'; }
    if (sp < 9) { s.vx = s.vy = 0; s.moving = false; break; }
  }
  if (!s.moving && s.strokes >= s.limit) return 'lose';
  return null;
}
