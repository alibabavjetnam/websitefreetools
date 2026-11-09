/** Lõi Xì dách (Blackjack) và Video Poker (Jacks or Better). Thuần, không đụng DOM. Chỉ chơi bằng xu ảo. */
import { deck, shuffle, type Card } from './solitaire';

/* ============================== Blackjack ============================== */
export interface BjLevel { target: number; hands: number; minBet: number; payout: number; hitSoft17: boolean }
/** Vốn đầu 500 xu. Càng lên cấp: mục tiêu cao hơn, cược tối thiểu tăng, trả blackjack 6:5 và nhà cái rút ở 17 mềm. */
export const BJ_START = 500;
export const BJ_LEVELS: BjLevel[] = [
  { target: 650, hands: 40, minBet: 10, payout: 1.5, hitSoft17: false },
  { target: 700, hands: 40, minBet: 10, payout: 1.5, hitSoft17: false },
  { target: 800, hands: 40, minBet: 10, payout: 1.5, hitSoft17: false },
  { target: 900, hands: 40, minBet: 25, payout: 1.5, hitSoft17: false },
  { target: 1000, hands: 40, minBet: 25, payout: 1.5, hitSoft17: false },
  { target: 1100, hands: 40, minBet: 25, payout: 1.2, hitSoft17: true },
  { target: 1250, hands: 40, minBet: 50, payout: 1.2, hitSoft17: true },
  { target: 1400, hands: 40, minBet: 50, payout: 1.2, hitSoft17: true },
  { target: 1600, hands: 40, minBet: 50, payout: 1.2, hitSoft17: true },
  { target: 1800, hands: 40, minBet: 100, payout: 1.2, hitSoft17: true },
];

/** Giá trị tay bài: A = 1 hoặc 11; trả {total, soft} */
export function bjValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0, aces = 0;
  for (const c of cards) { total += c.r === 1 ? 1 : Math.min(10, c.r); if (c.r === 1) aces++; }
  let soft = false;
  if (aces && total + 10 <= 21) { total += 10; soft = true; }
  return { total, soft };
}
export const bjBust = (cards: Card[]): boolean => bjValue(cards).total > 21;
export const bjNatural = (cards: Card[]): boolean => cards.length === 2 && bjValue(cards).total === 21;

export function newShoe(decks = 6, rand?: () => number): Card[] {
  const d: Card[] = [];
  for (let k = 0; k < decks; k++) d.push(...deck().map((c) => ({ ...c, up: true })));
  return shuffle(d, rand).map((c, i) => ({ ...c, id: i }));
}

export interface BjHand { cards: Card[]; bet: number; done: boolean; doubled: boolean; fromSplit: boolean }
export interface Bj {
  shoe: Card[]; chips: number; hands: BjHand[]; active: number; dealer: Card[];
  phase: 'bet' | 'play' | 'dealer' | 'done'; played: number; lastDelta: number; results: ('win' | 'lose' | 'push' | 'blackjack')[];
}
export const bjNew = (rand?: () => number): Bj => ({ shoe: newShoe(6, rand), chips: BJ_START, hands: [], active: 0, dealer: [], phase: 'bet', played: 0, lastDelta: 0, results: [] });

const draw = (g: Bj): Card => {
  if (g.shoe.length < 20) g.shoe = newShoe(6);
  return g.shoe.pop() as Card;
};

/** Chia bài với tiền cược `bet` (đã kiểm tra đủ xu). Có blackjack thì kết thúc ngay. */
export function bjDeal(g: Bj, bet: number, lv: BjLevel): Bj {
  const n: Bj = JSON.parse(JSON.stringify(g));
  n.chips -= bet;
  n.hands = [{ cards: [draw(n), draw(n)], bet, done: false, doubled: false, fromSplit: false }];
  n.dealer = [draw(n), draw(n)];
  n.active = 0; n.phase = 'play'; n.results = []; n.lastDelta = 0;
  if (bjNatural(n.hands[0].cards) || bjNatural(n.dealer)) return bjSettle(n, lv);
  return n;
}
export const bjCanDouble = (g: Bj): boolean => { const h = g.hands[g.active]; return g.phase === 'play' && h.cards.length === 2 && !h.done && g.chips >= h.bet; };
export const bjCanSplit = (g: Bj): boolean => {
  const h = g.hands[g.active];
  return g.phase === 'play' && g.hands.length === 1 && h.cards.length === 2 && Math.min(10, h.cards[0].r) === Math.min(10, h.cards[1].r) && g.chips >= h.bet;
};

function advance(g: Bj, lv: BjLevel): Bj {
  while (g.active < g.hands.length && g.hands[g.active].done) g.active++;
  if (g.active >= g.hands.length) return bjSettle(g, lv);
  return g;
}
export function bjHit(g: Bj, lv: BjLevel): Bj {
  const n: Bj = JSON.parse(JSON.stringify(g));
  const h = n.hands[n.active];
  h.cards.push(draw(n));
  const v = bjValue(h.cards).total;
  if (v >= 21) h.done = true;
  return advance(n, lv);
}
export function bjStand(g: Bj, lv: BjLevel): Bj {
  const n: Bj = JSON.parse(JSON.stringify(g));
  n.hands[n.active].done = true;
  return advance(n, lv);
}
export function bjDouble(g: Bj, lv: BjLevel): Bj {
  const n: Bj = JSON.parse(JSON.stringify(g));
  const h = n.hands[n.active];
  n.chips -= h.bet; h.bet *= 2; h.doubled = true;
  h.cards.push(draw(n)); h.done = true;
  return advance(n, lv);
}
export function bjSplit(g: Bj, lv: BjLevel): Bj {
  const n: Bj = JSON.parse(JSON.stringify(g));
  const h = n.hands[0];
  n.chips -= h.bet;
  const second = h.cards.pop() as Card;
  h.cards.push(draw(n)); h.fromSplit = true;
  const h2: BjHand = { cards: [second, draw(n)], bet: h.bet, done: false, doubled: false, fromSplit: true };
  n.hands.push(h2);
  // Tách A chỉ được một lá mỗi tay
  if (second.r === 1) { h.done = true; h2.done = true; }
  return advance(n, lv);
}

/** Nhà cái rút bài rồi tính thắng thua */
export function bjSettle(g: Bj, lv: BjLevel): Bj {
  const n: Bj = g;
  n.phase = 'dealer';
  const alive = n.hands.some((h) => !bjBust(h.cards));
  const dealerNatural = bjNatural(n.dealer);
  const playerNatural = n.hands.length === 1 && bjNatural(n.hands[0].cards) && !n.hands[0].fromSplit;
  if (alive && !dealerNatural && !playerNatural) {
    for (;;) {
      const v = bjValue(n.dealer);
      if (v.total < 17 || (v.total === 17 && v.soft && lv.hitSoft17)) n.dealer.push(draw(n)); else break;
    }
  }
  const dv = bjValue(n.dealer).total;
  let delta = 0;
  n.results = n.hands.map((h) => {
    const pv = bjValue(h.cards).total;
    const nat = n.hands.length === 1 && bjNatural(h.cards) && !h.fromSplit;
    if (pv > 21) return 'lose';
    if (nat) {
      if (dealerNatural) { n.chips += h.bet; return 'push'; }
      n.chips += h.bet + Math.round(h.bet * lv.payout); delta += Math.round(h.bet * lv.payout); return 'blackjack';
    }
    if (dealerNatural) return 'lose';
    if (dv > 21 || pv > dv) { n.chips += h.bet * 2; return 'win'; }
    if (pv === dv) { n.chips += h.bet; return 'push'; }
    return 'lose';
  });
  for (let i = 0; i < n.hands.length; i++) {
    const r = n.results[i], b = n.hands[i].bet;
    if (r === 'win') delta += b; else if (r === 'lose') delta -= b;
  }
  n.lastDelta = delta; n.phase = 'done'; n.played++;
  return n;
}
/** Kết quả cấp: 'win' đạt mục tiêu, 'lose' hết xu hoặc hết số ván, null còn chơi */
export function bjOutcome(g: Bj, lv: BjLevel): 'win' | 'lose' | null {
  if (g.phase !== 'bet' && g.phase !== 'done') return null;
  if (g.chips >= lv.target) return 'win';
  if (g.chips < lv.minBet || g.played >= lv.hands) return 'lose';
  return null;
}

/* ============================== Video Poker ============================== */
export type PokerHand = 'royal' | 'sflush' | 'quads' | 'full' | 'flush' | 'straight' | 'trips' | 'twopair' | 'jacks' | 'none';
export const POKER_ORDER: PokerHand[] = ['royal', 'sflush', 'quads', 'full', 'flush', 'straight', 'trips', 'twopair', 'jacks'];
export interface VpLevel { target: number; hands: number; full: number; flush: number }
export const VP_START = 100;
/** Bảng trả 9/6 (dễ) → 8/5 → 7/5 (khó) theo Thùng phá sảnh và Đồng chất */
export const VP_LEVELS: VpLevel[] = [
  { target: 125, hands: 60, full: 9, flush: 6 },
  { target: 130, hands: 60, full: 9, flush: 6 },
  { target: 140, hands: 60, full: 9, flush: 6 },
  { target: 150, hands: 60, full: 8, flush: 5 },
  { target: 160, hands: 60, full: 8, flush: 5 },
  { target: 170, hands: 60, full: 8, flush: 5 },
  { target: 180, hands: 60, full: 8, flush: 5 },
  { target: 195, hands: 60, full: 7, flush: 5 },
  { target: 210, hands: 60, full: 7, flush: 5 },
  { target: 225, hands: 60, full: 7, flush: 5 },
];
export const vpPay = (h: PokerHand, lv: VpLevel, bet: number): number => {
  const base: Record<PokerHand, number> = { royal: bet === 5 ? 800 : 250, sflush: 50, quads: 25, full: lv.full, flush: lv.flush, straight: 4, trips: 3, twopair: 2, jacks: 1, none: 0 };
  return base[h] * bet;
};

export function pokerEval(cards: Card[]): PokerHand {
  const ranks = cards.map((c) => c.r).sort((a, b) => a - b);
  const flush = cards.every((c) => c.s === cards[0].s);
  const counts = new Map<number, number>();
  ranks.forEach((r) => counts.set(r, (counts.get(r) || 0) + 1));
  const groups = [...counts.values()].sort((a, b) => b - a);
  const uniq = [...counts.keys()].sort((a, b) => a - b);
  const wheel = uniq.length === 5 && uniq.join() === '1,10,11,12,13';
  const straight = uniq.length === 5 && (uniq[4] - uniq[0] === 4 || wheel);
  if (straight && flush) return wheel ? 'royal' : 'sflush';
  if (groups[0] === 4) return 'quads';
  if (groups[0] === 3 && groups[1] === 2) return 'full';
  if (flush) return 'flush';
  if (straight) return 'straight';
  if (groups[0] === 3) return 'trips';
  if (groups[0] === 2 && groups[1] === 2) return 'twopair';
  if (groups[0] === 2) { const pr = [...counts.entries()].find(([, n]) => n === 2)![0]; if (pr >= 11 || pr === 1) return 'jacks'; }
  return 'none';
}

/** Gợi ý giữ bài: thử mọi cách giữ (32 cách) và chọn cách có kỳ vọng cao nhất theo bảng trả 9/6 */
export function pokerBestHold(cards: Card[], rest: Card[]): boolean[] {
  const lv = VP_LEVELS[0];
  let best = -1, bestMask = 0;
  for (let mask = 0; mask < 32; mask++) {
    const keep = cards.filter((_, i) => mask & (1 << i));
    const need = 5 - keep.length;
    let sum = 0, cnt = 0;
    const pool = rest;
    const sample = need === 0 ? [[]] : need === 1 ? pool.map((c) => [c]) : [];
    if (need >= 2) {
      // Lấy mẫu để nhanh: 150 lần rút ngẫu nhiên cố định theo mặt nạ
      for (let k = 0; k < 150; k++) { const picks: Card[] = []; const used = new Set<number>(); while (picks.length < need) { const j = (k * 7919 + picks.length * 104729 + mask * 31) % pool.length; const jj = (j + used.size * 13) % pool.length; if (!used.has(jj)) { used.add(jj); picks.push(pool[jj]); } else used.add((jj + 1) % pool.length); } sample.push(picks); }
    }
    for (const s of sample) { sum += vpPay(pokerEval([...keep, ...s]), lv, 1); cnt++; }
    const ev = sum / Math.max(1, cnt);
    if (ev > best + 1e-9) { best = ev; bestMask = mask; }
  }
  return cards.map((_, i) => !!(bestMask & (1 << i)));
}
