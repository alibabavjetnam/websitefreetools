/** Lõi thuần đợt 10: Cờ tỉ phú xúc xắc kiểu Backgammon (đánh với máy) và Tiến lên (4 người). */
import { shuffle, deck, type Card } from './solitaire';
const ri = (a: number, b: number): number => a + Math.floor(Math.random() * (b - a + 1));

/* ============================ Backgammon ============================ */
export const OFF = 99;
export interface BG { pts: number[]; bar: number[]; off: number[]; dice: number[]; turn: number; winner: number; rolled: boolean }
export interface BMove { from: number; to: number; die: number } // from -1 = bar
export function bgNew(): BG {
  const pts = new Array(24).fill(0);
  // người (dương) đi từ chỉ số cao xuống thấp; máy (âm) đi từ thấp lên cao
  pts[23] = 2; pts[12] = 5; pts[7] = 3; pts[5] = 5;
  pts[0] = -2; pts[11] = -5; pts[16] = -3; pts[18] = -5;
  return { pts, bar: [0, 0], off: [0, 0], dice: [], turn: 0, winner: -1, rolled: false };
}
export const bgClone = (g: BG): BG => ({ pts: g.pts.slice(), bar: g.bar.slice(), off: g.off.slice(), dice: g.dice.slice(), turn: g.turn, winner: g.winner, rolled: g.rolled });
export function bgRoll(g: BG): void { const a = ri(1, 6), b = ri(1, 6); g.dice = a === b ? [a, a, a, a] : [a, b]; g.rolled = true; }
const sgn = (w: number): number => (w === 0 ? 1 : -1);
const own = (g: BG, w: number, p: number): number => g.pts[p] * sgn(w);
function allHome(g: BG, w: number): boolean {
  if (g.bar[w]) return false;
  for (let p = 0; p < 24; p++) if (own(g, w, p) > 0 && (w === 0 ? p > 5 : p < 18)) return false;
  return true;
}
export function bgMoves(g: BG, w: number, dice: number[] = g.dice): BMove[] {
  const out: BMove[] = [], seen = new Set<string>();
  for (const d of new Set(dice)) {
    const add = (from: number, to: number): void => { const k = `${from}-${to}-${d}`; if (!seen.has(k)) { seen.add(k); out.push({ from, to, die: d }); } };
    if (g.bar[w]) { const to = w === 0 ? 24 - d : d - 1; if (own(g, w, to) >= -1) add(-1, to); continue; }
    const home = allHome(g, w);
    for (let p = 0; p < 24; p++) {
      if (own(g, w, p) <= 0) continue;
      const to = w === 0 ? p - d : p + d;
      if (to >= 0 && to <= 23) { if (own(g, w, to) >= -1) add(p, to); }
      else if (home) {
        const dist = w === 0 ? p + 1 : 24 - p;
        if (d === dist) add(p, OFF);
        else if (d > dist) { let far = false; for (let q = 0; q < 24; q++) if (own(g, w, q) > 0 && (w === 0 ? q > p : q < p)) far = true; if (!far) add(p, OFF); }
      }
    }
  }
  return out;
}
export function bgApply(g: BG, w: number, m: BMove): void {
  if (m.from < 0) g.bar[w]--; else g.pts[m.from] -= sgn(w);
  if (m.to === OFF) g.off[w]++;
  else { if (own(g, 1 - w, m.to) === 1) { g.pts[m.to] = 0; g.bar[1 - w]++; } g.pts[m.to] += sgn(w); }
  const i = g.dice.indexOf(m.die); if (i >= 0) g.dice.splice(i, 1);
  if (g.off[w] === 15) g.winner = w;
}
export const bgPip = (g: BG, w: number): number => { let s = g.bar[w] * 25; for (let p = 0; p < 24; p++) { const n = own(g, w, p); if (n > 0) s += n * (w === 0 ? p + 1 : 24 - p); } return s; };
function evalBg(g: BG, w: number): number {
  const o = 1 - w; let s = (bgPip(g, o) - bgPip(g, w)) + (g.off[w] - g.off[o]) * 8 + (g.bar[o] - g.bar[w]) * 14;
  for (let p = 0; p < 24; p++) {
    const n = own(g, w, p);
    if (n === 1) { // blot: nguy hiểm nếu đối thủ có quân phía sau
      let risk = 0; for (let q = 0; q < 24; q++) if (own(g, o, q) > 0) { const dist = o === 0 ? q - p : p - q; if (dist > 0 && dist <= 6) risk += own(g, o, q); } if (g.bar[o]) risk += 2;
      s -= 4 + risk * 2.5;
    } else if (n >= 2) s += 2.5;
  }
  return s;
}
export function bgAi(g0: BG, w: number, level: number): BMove[] {
  const best: { seq: BMove[]; sc: number }[] = [], seen = new Set<string>();
  function rec(g: BG, seq: BMove[]): void {
    const mv = bgMoves(g, w);
    if (!mv.length || g.winner >= 0) { const key = g.pts.join() + g.bar + g.off; if (!seen.has(key)) { seen.add(key); best.push({ seq, sc: evalBg(g, w) }); } return; }
    for (const m of mv) { const c = bgClone(g); bgApply(c, w, m); rec(c, [...seq, m]); }
  }
  rec(bgClone(g0), []);
  if (!best.length) return [];
  // luật dùng đủ xúc xắc: ưu tiên chuỗi dài nhất
  const maxLen = Math.max(...best.map((b) => b.seq.length)), pool = best.filter((b) => b.seq.length === maxLen).sort((a, b) => b.sc - a.sc);
  if (Math.random() < Math.max(0, 0.5 - level * 0.055)) return pool[ri(0, pool.length - 1)].seq;
  return pool[Math.min(pool.length - 1, level >= 8 ? 0 : ri(0, Math.min(2, pool.length - 1)))].seq;
}
/** số quân tối đa mà người chơi bắt buộc đi (để chặn đi thiếu xúc xắc) */
export function bgMaxLen(g: BG, w: number): number {
  let best = 0; const seen = new Set<string>();
  function rec(c: BG, n: number): void { const key = c.pts.join() + c.bar + c.off + c.dice; if (seen.has(key)) return; seen.add(key); best = Math.max(best, n); if (best >= g.dice.length) return; for (const m of bgMoves(c, w)) { const d = bgClone(c); bgApply(d, w, m); rec(d, n + 1); } }
  rec(bgClone(g), 0); return best;
}

/* ============================ Tiến lên ============================ */
export interface TCard { id: number; v: number; r: number; s: number } // v: giá trị so sánh, r: hạng 3..15 (2=15), s: chất 0..3
const SUIT_ORD = [0, 3, 1, 2]; // ♠(0) < ♣(3) < ♦(2) < ♥(1): thứ tự thấp→cao trong luật tiến lên → map chỉ số chất của solitaire.ts
export const tlSuitOrder = (s: number): number => [0, 3, 2, 1][s]; // ♠0 ♥1 ♦2 ♣3 → bích<chuồn<rô<cơ
export function tlDeal(): TCard[][] {
  const d = shuffle(deck().map((c) => ({ ...c, up: true })));
  const toT = (c: Card): TCard => { const r = c.r === 1 ? 14 : c.r === 2 ? 15 : c.r; return { id: c.id, r, s: c.s, v: (r - 3) * 4 + tlSuitOrder(c.s) }; };
  void SUIT_ORD;
  return [0, 1, 2, 3].map((i) => d.slice(i * 13, i * 13 + 13).map(toT).sort((a, b) => a.v - b.v));
}
export type TKind = 'single' | 'pair' | 'triple' | 'quad' | 'run';
export interface Combo { kind: TKind; cards: TCard[]; top: number; len: number }
export function tlClassify(cards: TCard[]): Combo | null {
  const c = cards.slice().sort((a, b) => a.v - b.v), n = c.length; if (!n) return null;
  const top = c[n - 1].v;
  if (n === 1) return { kind: 'single', cards: c, top, len: 1 };
  if (c.every((x) => x.r === c[0].r)) { if (n === 2) return { kind: 'pair', cards: c, top, len: 2 }; if (n === 3) return { kind: 'triple', cards: c, top, len: 3 }; if (n === 4) return { kind: 'quad', cards: c, top, len: 4 }; return null; }
  if (n >= 3 && c.every((x) => x.r < 15) && c.every((x, i) => i === 0 || x.r === c[i - 1].r + 1)) return { kind: 'run', cards: c, top, len: n };
  return null;
}
export function tlBeats(cur: Combo | null, nw: Combo): boolean {
  if (!cur) return true;
  if (cur.kind === nw.kind && cur.len === nw.len) return nw.top > cur.top;
  if (nw.kind === 'quad' && ((cur.kind === 'single' && cur.cards[0].r === 15) || (cur.kind === 'pair' && cur.cards[0].r === 15))) return true; // tứ quý chặt 2
  return false;
}
/** mọi tổ hợp hợp lệ từ bài; lấy lá thấp nhất mỗi hạng khi tạo dãy (đủ cho máy) */
export function tlCombos(hand: TCard[]): Combo[] {
  const out: Combo[] = [], by: Record<number, TCard[]> = {};
  hand.forEach((c) => (by[c.r] ||= []).push(c));
  for (const k of Object.keys(by)) {
    const g = by[Number(k)].sort((a, b) => a.v - b.v);
    for (let size = 1; size <= g.length; size++) { const kinds: TKind[] = ['single', 'pair', 'triple', 'quad']; const cs = g.slice(0, size); const cmb = tlClassify(cs); if (cmb) out.push(cmb); void kinds; }
    // các lá cao hơn cho đơn/đôi (để đánh đúng cao hơn bàn)
    for (const c of g) { const s = tlClassify([c]); if (s && !out.some((o) => o.kind === 'single' && o.cards[0].id === c.id)) out.push(s); }
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) { const p = tlClassify([g[i], g[j]]); if (p && !out.some((o) => o.kind === 'pair' && o.cards[0].id === g[i].id && o.cards[1].id === g[j].id)) out.push(p); }
  }
  const ranks = Object.keys(by).map(Number).filter((r) => r < 15).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) for (let j = i + 2; j < ranks.length; j++) {
    if (ranks[j] - ranks[i] !== j - i) break;
    const cs = ranks.slice(i, j + 1).map((r) => by[r][0]), cmb = tlClassify(cs); if (cmb) out.push(cmb);
  }
  return out;
}
export interface Tl { hands: TCard[][]; table: Combo | null; tableBy: number; turn: number; passed: boolean[]; winner: number; order: number[]; level: number }
export function tlNew(level: number): Tl {
  const hands = tlDeal(), first = hands.findIndex((h) => h.some((c) => c.v === 0));
  return { hands, table: null, tableBy: -1, turn: first >= 0 ? first : 0, passed: [false, false, false, false], winner: -1, order: [], level };
}
export function tlPlay(g: Tl, who: number, cmb: Combo): void {
  const ids = new Set(cmb.cards.map((c) => c.id)); g.hands[who] = g.hands[who].filter((c) => !ids.has(c.id));
  g.table = cmb; g.tableBy = who; g.passed = [false, false, false, false];
  if (!g.hands[who].length) { g.order.push(who); if (g.winner < 0) g.winner = who; }
  g.turn = tlNext(g, who);
}
export function tlNext(g: Tl, from: number): number { let n = (from + 1) % 4; for (let k = 0; k < 4; k++) { if (g.hands[n].length) return n; n = (n + 1) % 4; } return from; }
export function tlPass(g: Tl, who: number): void {
  g.passed[who] = true;
  const active = [0, 1, 2, 3].filter((i) => g.hands[i].length);
  const rest = active.filter((i) => i !== g.tableBy);
  if (rest.every((i) => g.passed[i]) || !g.hands[g.tableBy].length && rest.every((i) => g.passed[i])) { // vòng mới: người đánh cuối dẫn (nếu đã hết bài thì người kế)
    g.table = null; g.passed = [false, false, false, false]; g.turn = g.hands[g.tableBy].length ? g.tableBy : tlNext(g, g.tableBy);
  } else { let n = tlNext(g, who); while (g.passed[n] && n !== g.tableBy) n = tlNext(g, n); g.turn = n; }
}
export function tlAi(g: Tl, who: number, level: number): Combo | null {
  const hand = g.hands[who], all = tlCombos(hand);
  let opts = all.filter((c) => tlBeats(g.table, c));
  if (!opts.length) return null;
  if (g.table) {
    // không phá bộ khi đánh theo: ưu tiên cùng loại
    const same = opts.filter((c) => c.kind === g.table!.kind && c.len === g.table!.len);
    if (same.length) opts = same;
    else if (level < 4 && Math.random() < 0.4) return null;
    if (level >= 3 && opts[0].kind === 'quad' && g.hands.some((h, i) => i !== who && h.length > 4)) return null;
    opts.sort((a, b) => a.top - b.top);
    const o = opts[0];
    // đánh 2 sớm là lãng phí (cấp cao)
    if (level >= 5 && o.cards.some((c) => c.r === 15) && hand.length > 4 && g.hands.every((h, i) => i === who || h.length > 3)) return null;
    return Math.random() < Math.max(0, 0.45 - level * 0.05) ? opts[ri(0, opts.length - 1)] : o;
  }
  // dẫn: ưu tiên bộ dài (dãy/ đôi) chứa lá thấp nhất
  const low = Math.min(...hand.map((c) => c.v)), lead = all.filter((c) => c.cards.some((x) => x.v === low) && c.kind !== 'quad');
  const pool = (lead.length ? lead : all).sort((a, b) => b.len - a.len || a.top - b.top);
  if (g.hands.some((h, i) => i !== who && h.length === 1)) { const nonSingle = pool.filter((c) => c.kind !== 'single'); if (nonSingle.length) return nonSingle[0]; }
  if (level <= 2 && Math.random() < 0.5) return pool[ri(0, pool.length - 1)];
  return pool[0];
}
