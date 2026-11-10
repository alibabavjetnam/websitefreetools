/** Lõi thuần đợt 8: Domino (đánh với máy), Hearts (3 máy). */
import { SUIT, deck, shuffle, type Card } from './solitaire';

const ri = (a: number, b: number): number => a + Math.floor(Math.random() * (b - a + 1));

/* ============================ Domino (bộ đôi 6, kiểu "ghép đầu") ============================ */
export interface Tile { a: number; b: number }
export interface Domino { hands: Tile[][]; yard: Tile[]; chain: Tile[]; turn: number; passes: number; winner: number; blocked: boolean; level: number }
export interface DMove { i: number; side: 'l' | 'r'; flip: boolean }
export function dominoNew(level: number): Domino {
  const all: Tile[] = []; for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) all.push({ a, b });
  const d = shuffle(all);
  const g: Domino = { hands: [d.splice(0, 7), d.splice(0, 7)], yard: d, chain: [], turn: 0, passes: 0, winner: -1, blocked: false, level };
  // người cầm đôi lớn nhất đi trước (đánh ra luôn)
  const dbl = (h: Tile[]): number => h.reduce((m, t) => (t.a === t.b ? Math.max(m, t.a) : m), -1);
  const f = dbl(g.hands[0]) >= dbl(g.hands[1]) ? 0 : 1;
  const hi = Math.max(dbl(g.hands[0]), dbl(g.hands[1]));
  if (hi >= 0) { const i = g.hands[f].findIndex((t) => t.a === hi && t.b === hi); g.chain.push(g.hands[f].splice(i, 1)[0]); g.turn = 1 - f; }
  else { g.turn = 0; }
  return g;
}
export const dominoEnds = (g: Domino): [number, number] | null => (g.chain.length ? [g.chain[0].a, g.chain[g.chain.length - 1].b] : null);
export function dominoMoves(g: Domino, who: number): DMove[] {
  const e = dominoEnds(g), out: DMove[] = [];
  g.hands[who].forEach((t, i) => {
    if (!e) { out.push({ i, side: 'r', flip: false }); return; }
    if (t.a === e[1]) out.push({ i, side: 'r', flip: false });
    if (t.b === e[1] && t.a !== t.b) out.push({ i, side: 'r', flip: true });
    if (t.b === e[0]) out.push({ i, side: 'l', flip: false });
    if (t.a === e[0] && t.a !== t.b) out.push({ i, side: 'l', flip: true });
  });
  return out;
}
export const pips = (h: Tile[]): number => h.reduce((s, t) => s + t.a + t.b, 0);
export function dominoPlay(g: Domino, who: number, m: DMove): void {
  const t = g.hands[who].splice(m.i, 1)[0], x = m.flip ? { a: t.b, b: t.a } : t;
  if (m.side === 'r') g.chain.push(x); else g.chain.unshift(x);
  g.passes = 0;
  if (!g.hands[who].length) { g.winner = who; return; }
  g.turn = 1 - who;
}
export function dominoDraw(g: Domino, who: number): boolean { if (!g.yard.length) return false; g.hands[who].push(g.yard.pop() as Tile); return true; }
export function dominoPass(g: Domino, who: number): void {
  g.passes++; g.turn = 1 - who;
  if (g.passes >= 2) { g.blocked = true; const p0 = pips(g.hands[0]), p1 = pips(g.hands[1]); g.winner = p0 < p1 ? 0 : p1 < p0 ? 1 : 2; }
}
export function dominoAi(g: Domino, who: number, level: number): DMove | null {
  const mv = dominoMoves(g, who); if (!mv.length) return null;
  if (Math.random() < Math.max(0, 0.7 - level * 0.075)) return mv[ri(0, mv.length - 1)];
  const h = g.hands[who], e = dominoEnds(g);
  const score = (m: DMove): number => {
    const t = h[m.i], left = h.filter((_, i) => i !== m.i);
    let s = t.a + t.b + (t.a === t.b ? 3 : 0);
    if (level >= 6) {
      // giữ nhiều số đa dạng để còn nước đi; ưu tiên để lộ đầu mà mình có nhiều
      const open = m.side === 'r' ? (m.flip ? t.a : t.b) : (m.flip ? t.b : t.a), other = e ? (m.side === 'r' ? e[0] : e[1]) : t.a;
      s += left.filter((x) => x.a === open || x.b === open).length * 2.2 + left.filter((x) => x.a === other || x.b === other).length;
    }
    return s;
  };
  return mv.reduce((b, m) => (score(m) > score(b) ? m : b), mv[0]);
}

/* ============================ Hearts ============================ */
export interface Hearts {
  hands: Card[][]; trick: { who: number; card: Card }[]; lead: number; turn: number; broken: boolean; taken: Card[][]; // taken[who] = các lá ăn trong ván
  scores: number[]; handNo: number; hands_total: number; trickNo: number; level: number; over: boolean; handOver: boolean;
}
export const heartsHands = (level: number): number => (level <= 3 ? 1 : level <= 7 ? 2 : 3);
export const cardPts = (c: Card): number => (c.s === 1 ? 1 : c.s === 0 && c.r === 12 ? 13 : 0);
export function heartsDeal(g: Hearts): void {
  const d = shuffle(deck().map((c) => ({ ...c, up: true })));
  g.hands = [0, 1, 2, 3].map((i) => d.slice(i * 13, i * 13 + 13).sort((a, b) => a.s - b.s || a.r - b.r));
  g.taken = [[], [], [], []]; g.trick = []; g.broken = false; g.trickNo = 0; g.handOver = false;
  const two = g.hands.findIndex((h) => h.some((c) => c.s === 3 && c.r === 2));
  g.lead = g.turn = two;
}
export function heartsNew(level: number): Hearts {
  const g: Hearts = { hands: [], trick: [], lead: 0, turn: 0, broken: false, taken: [[], [], [], []], scores: [0, 0, 0, 0], handNo: 1, hands_total: heartsHands(level), trickNo: 0, level, over: false, handOver: false };
  heartsDeal(g); return g;
}
export function heartsLegal(g: Hearts, who: number): Card[] {
  const h = g.hands[who];
  if (!g.trick.length) {
    if (g.trickNo === 0) return h.filter((c) => c.s === 3 && c.r === 2);
    const nonH = h.filter((c) => c.s !== 1);
    return g.broken || !nonH.length ? h : nonH;
  }
  const s = g.trick[0].card.s, follow = h.filter((c) => c.s === s);
  if (follow.length) return follow;
  if (g.trickNo === 0) { const safe = h.filter((c) => cardPts(c) === 0); return safe.length ? safe : h; }
  return h;
}
/** ai thắng dãy hiện tại */
const rk = (c: Card): number => (c.r === 1 ? 14 : c.r);
export function trickWinner(trick: { who: number; card: Card }[]): number {
  const s = trick[0].card.s; let best = trick[0];
  for (const t of trick) if (t.card.s === s && rk(t.card) > rk(best.card)) best = t;
  return best.who;
}
/** đánh một lá; trả về 'trick' khi đủ 4 lá (chưa thu) */
export function heartsPlay(g: Hearts, who: number, c: Card): boolean {
  g.hands[who] = g.hands[who].filter((x) => x.id !== c.id);
  g.trick.push({ who, card: c }); if (c.s === 1) g.broken = true;
  if (g.trick.length === 4) return true;
  g.turn = (who + 1) % 4; return false;
}
export function heartsCollect(g: Hearts): number {
  const w = trickWinner(g.trick); g.taken[w].push(...g.trick.map((t) => t.card));
  g.trick = []; g.trickNo++; g.lead = g.turn = w;
  if (g.trickNo === 13) {
    const pts = g.taken.map((t) => t.reduce((s, c) => s + cardPts(c), 0));
    const moon = pts.findIndex((p) => p === 26);
    for (let i = 0; i < 4; i++) g.scores[i] += moon >= 0 ? (i === moon ? 0 : 26) : pts[i];
    g.handOver = true; if (g.handNo >= g.hands_total) g.over = true;
  }
  return w;
}
export function heartsNext(g: Hearts): void { g.handNo++; heartsDeal(g); }
export function heartsAi(g: Hearts, who: number, level: number): Card {
  const legal = heartsLegal(g, who); if (legal.length === 1) return legal[0];
  if (Math.random() < Math.max(0, 0.6 - level * 0.07)) return legal[ri(0, legal.length - 1)];
  const sorted = legal.slice().sort((a, b) => rk(a) - rk(b));
  if (!g.trick.length) {
    // dẫn: lá thấp, tránh cơ/Q bích; cấp cao dẫn bích thấp để dụ Q bích
    const safe = sorted.filter((c) => c.s !== 1 && !(c.s === 0 && c.r >= 12));
    return (safe.length ? safe : sorted)[0];
  }
  const s = g.trick[0].card.s, cur = g.trick.filter((t) => t.card.s === s).reduce((m, t) => Math.max(m, rk(t.card)), 0), pts = g.trick.reduce((p, t) => p + cardPts(t.card), 0);
  const follow = legal.filter((c) => c.s === s);
  if (follow.length) {
    const under = follow.filter((c) => rk(c) < cur);
    if (g.trick.length === 3 && pts === 0 && level >= 3) return follow.slice().sort((x, y) => rk(y) - rk(x)).find((c) => !(c.s === 0 && c.r === 12)) ?? sorted[0];
    if (under.length) return under.sort((a, b) => rk(b) - rk(a))[0];
    return sorted[0];
  }
  // hết chất: xả Q bích, rồi cơ lớn, rồi lá lớn
  const q = legal.find((c) => c.s === 0 && c.r === 12); if (q) return q;
  const hearts = legal.filter((c) => c.s === 1).sort((a, b) => rk(b) - rk(a)); if (hearts.length) return hearts[0];
  return sorted[sorted.length - 1];
}
void SUIT;
