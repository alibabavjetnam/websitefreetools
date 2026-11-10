/** Lõi thuần Texas Hold'em 2 người (đấu với máy), chỉ dùng xu ảo. */
export interface HCard { r: number; s: number } // r 2..14 (14 = A), s 0..3
const SUITS = ['♠', '♥', '♦', '♣'], RK = ['', '', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const hLabel = (c: HCard): string => RK[c.r] + SUITS[c.s];
export const hRed = (c: HCard): boolean => c.s === 1 || c.s === 2;
export const HAND_NAMES = ['high', 'pair', 'twoPair', 'trips', 'straight', 'flush', 'full', 'quads', 'sflush'];

function newDeck(): HCard[] { const d: HCard[] = []; for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ r, s }); return d; }
function shuf<T>(a: T[]): T[] { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** điểm 5 lá: loại * 15^5 + các lá quyết định */
function eval5(c: HCard[]): number {
  const r = c.map((x) => x.r).sort((a, b) => b - a), flush = c.every((x) => x.s === c[0].s);
  const cnt: Record<number, number> = {}; r.forEach((x) => (cnt[x] = (cnt[x] || 0) + 1));
  const groups = Object.entries(cnt).map(([k, v]) => [Number(k), v] as [number, number]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  let straightHi = 0;
  if (groups.length === 5) { if (r[0] - r[4] === 4) straightHi = r[0]; else if (r[0] === 14 && r[1] === 5 && r[4] === 2) straightHi = 5; }
  let cat: number, key: number[];
  if (straightHi && flush) { cat = 8; key = [straightHi]; }
  else if (groups[0][1] === 4) { cat = 7; key = [groups[0][0], groups[1][0]]; }
  else if (groups[0][1] === 3 && groups[1][1] === 2) { cat = 6; key = [groups[0][0], groups[1][0]]; }
  else if (flush) { cat = 5; key = r; }
  else if (straightHi) { cat = 4; key = [straightHi]; }
  else if (groups[0][1] === 3) { cat = 3; key = groups.map((g) => g[0]); }
  else if (groups[0][1] === 2 && groups[1][1] === 2) { cat = 2; key = groups.map((g) => g[0]); }
  else if (groups[0][1] === 2) { cat = 1; key = groups.map((g) => g[0]); }
  else { cat = 0; key = r; }
  let v = cat; for (let i = 0; i < 5; i++) v = v * 15 + (key[i] || 0);
  return v;
}
export function eval7(cards: HCard[]): number {
  let best = 0; const n = cards.length;
  for (let a = 0; a < n - 4; a++) for (let b = a + 1; b < n - 3; b++) for (let c = b + 1; c < n - 2; c++) for (let d = c + 1; d < n - 1; d++) for (let e = d + 1; e < n; e++) { const v = eval5([cards[a], cards[b], cards[c], cards[d], cards[e]]); if (v > best) best = v; }
  return best;
}
export const handCat = (score: number): number => Math.floor(score / 15 ** 5);

/** xác suất thắng (hoà tính 1/2) so với tay ngẫu nhiên */
export function equity(hole: HCard[], board: HCard[], samples: number): number {
  const used = new Set([...hole, ...board].map((c) => c.r * 4 + c.s)), rest = newDeck().filter((c) => !used.has(c.r * 4 + c.s));
  let w = 0;
  for (let k = 0; k < samples; k++) {
    const d = shuf(rest.slice()), opp = [d[0], d[1]], extra = d.slice(2, 2 + 5 - board.length), bd = [...board, ...extra];
    const a = eval7([...hole, ...bd]), b = eval7([...opp, ...bd]);
    w += a > b ? 1 : a === b ? 0.5 : 0;
  }
  return w / samples;
}

export interface Holdem {
  level: number; stacks: number[]; bet: number[]; put: number[]; hole: HCard[][]; board: HCard[]; deck: HCard[];
  button: number; toAct: number; acted: boolean[]; lastRaise: number; street: number; bb: number; handNo: number; maxHands: number;
  status: 'play' | 'hand' | 'match'; winner: number; msg: string; matchWinner: number; showdown: boolean; ev: string[];
}
export const HOLD_START = 1000;
export function holdemNew(level: number): Holdem {
  const g: Holdem = { level, stacks: [HOLD_START, HOLD_START], bet: [0, 0], put: [0, 0], hole: [[], []], board: [], deck: [], button: Math.random() < 0.5 ? 0 : 1, toAct: 0, acted: [false, false], lastRaise: 20, street: 0, bb: 20, handNo: 0, maxHands: 12 + level, status: 'hand', winner: -1, msg: '', matchWinner: -1, showdown: false, ev: [] };
  return g;
}
export const potOf = (g: Holdem): number => g.put[0] + g.put[1];
function post(g: Holdem, w: number, amt: number): void { const a = Math.min(amt, g.stacks[w]); g.stacks[w] -= a; g.bet[w] += a; g.put[w] += a; }
export function holdemDeal(g: Holdem): void {
  g.handNo++; g.bb = 20 * 2 ** Math.floor((g.handNo - 1) / 4); g.deck = shuf(newDeck()); g.board = []; g.bet = [0, 0]; g.put = [0, 0]; g.street = 0; g.showdown = false; g.winner = -1; g.msg = '';
  g.button = 1 - g.button; const sb = g.button, bbp = 1 - sb;
  g.hole = [[g.deck.pop() as HCard, g.deck.pop() as HCard], [g.deck.pop() as HCard, g.deck.pop() as HCard]];
  post(g, sb, g.bb / 2); post(g, bbp, g.bb);
  g.lastRaise = g.bb; g.acted = [false, false]; g.toAct = sb; g.status = 'play'; g.ev.push('deal');
  if (g.stacks[0] === 0 || g.stacks[1] === 0) runOut(g);
}
export const toCall = (g: Holdem, w: number): number => Math.min(g.stacks[w], Math.max(0, g.bet[1 - w] - g.bet[w]));
export const minRaiseTo = (g: Holdem, w: number): number => Math.min(g.bet[w] + g.stacks[w], Math.max(g.bet[1 - w] + g.lastRaise, g.bb));
export const maxRaiseTo = (g: Holdem, w: number): number => g.bet[w] + g.stacks[w];

function award(g: Holdem, w: number, msg: string): void {
  const pot = potOf(g);
  if (w === 2) { g.stacks[0] += g.put[0]; g.stacks[1] += g.put[1]; } else g.stacks[w] += pot;
  g.winner = w; g.msg = msg; g.status = 'hand'; g.ev.push(w === 0 ? 'coin' : 'tick');
  if (g.stacks[0] <= 0 || g.stacks[1] <= 0 || g.handNo >= g.maxHands) {
    g.status = 'match'; g.matchWinner = g.stacks[0] > g.stacks[1] ? 0 : g.stacks[1] > g.stacks[0] ? 1 : 2;
  }
}
function showdown(g: Holdem): void {
  g.showdown = true;
  const a = eval7([...g.hole[0], ...g.board]), b = eval7([...g.hole[1], ...g.board]);
  award(g, a > b ? 0 : b > a ? 1 : 2, `${HAND_NAMES[handCat(a)]}|${HAND_NAMES[handCat(b)]}`);
}
function runOut(g: Holdem): void { while (g.board.length < 5) g.board.push(g.deck.pop() as HCard); g.bet = [0, 0]; showdown(g); }
function nextStreet(g: Holdem): void {
  // hoàn trả phần cược thừa nếu một bên hết tiền
  const hi = g.bet[0] > g.bet[1] ? 0 : 1, diff = Math.abs(g.bet[0] - g.bet[1]);
  if (diff > 0 && g.stacks[1 - hi] === 0) { g.stacks[hi] += diff; g.bet[hi] -= diff; g.put[hi] -= diff; }
  g.bet = [0, 0]; g.acted = [false, false]; g.lastRaise = g.bb;
  if (g.stacks[0] === 0 || g.stacks[1] === 0 || g.street === 3) { runOut(g); return; }
  g.street++; const n = g.street === 1 ? 3 : 1; for (let i = 0; i < n; i++) g.board.push(g.deck.pop() as HCard);
  g.toAct = 1 - g.button; g.ev.push('flip');
}
export type HAct = { t: 'fold' } | { t: 'call' } | { t: 'raise'; to: number };
export function holdemAct(g: Holdem, w: number, a: HAct): void {
  if (g.status !== 'play' || g.toAct !== w) return;
  const o = 1 - w;
  if (a.t === 'fold') { award(g, o, 'fold'); return; }
  if (a.t === 'call') { post(g, w, toCall(g, w)); g.acted[w] = true; g.ev.push('tick'); }
  else {
    const to = Math.max(minRaiseTo(g, w), Math.min(maxRaiseTo(g, w), a.to));
    const prev = g.bet[o]; post(g, w, to - g.bet[w]);
    if (g.bet[w] > prev) { g.lastRaise = Math.max(g.bb, g.bet[w] - prev); g.acted = [false, false]; }
    g.acted[w] = true; g.ev.push('coin');
  }
  const matched = g.bet[0] === g.bet[1], anyAllIn = g.stacks[0] === 0 || g.stacks[1] === 0;
  if ((g.acted[0] && g.acted[1] && matched) || (anyAllIn && (matched || g.bet[g.stacks[0] === 0 ? 1 : 0] >= g.bet[g.stacks[0] === 0 ? 0 : 1]))) { nextStreet(g); return; }
  g.toAct = o;
}
export function holdemAi(g: Holdem, w: number, level: number): HAct {
  const hole = g.hole[w], need = toCall(g, w), pot = potOf(g), eq = equity(hole, g.board, 60 + level * 45);
  const noise = (Math.random() - 0.5) * Math.max(0.04, 0.34 - level * 0.03), e = eq + noise;
  const potOdds = need / (pot + need || 1);
  const canRaise = maxRaiseTo(g, w) > minRaiseTo(g, w) - 1 && g.stacks[w] > need;
  const size = (f: number): HAct => ({ t: 'raise', to: Math.round(g.bet[1 - w] + Math.max(g.lastRaise, pot * f)) });
  if (need === 0) {
    if (canRaise && e > 0.66) return size(e > 0.82 ? 0.9 : 0.55);
    if (canRaise && level >= 5 && e < 0.35 && Math.random() < 0.12) return size(0.5); // thỉnh thoảng bluff
    return { t: 'call' };
  }
  if (level <= 2) return e > potOdds - 0.12 || Math.random() < 0.3 ? { t: 'call' } : { t: 'fold' };
  if (e > 0.78 && canRaise) return size(e > 0.9 ? 1.0 : 0.7);
  if (e > potOdds + 0.04) return { t: 'call' };
  return { t: 'fold' };
}
