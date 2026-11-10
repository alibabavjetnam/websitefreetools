/** Lõi thuần Cribbage 2 người (chạy đua tới 61 điểm). Lá: r 1..13, s 0..3 */
export interface CCard { r: number; s: number }
export const cVal = (c: CCard): number => Math.min(c.r, 10);
export const cKey = (c: CCard): number => c.s * 13 + c.r;
export const CRIB_TARGET = 61;

export function cDeck(): CCard[] {
  const d: CCard[] = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ r, s });
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
export interface Part { kind: 'fifteen' | 'pair' | 'run' | 'flush' | 'nobs' | 'heels'; pts: number; cards: CCard[] }

/** Đếm điểm tay 4 lá + lá lật (isCrib: chuồn phải đủ 5 lá cùng chất) */
export function scoreHand(hand: CCard[], starter: CCard, isCrib = false): { pts: number; parts: Part[] } {
  const all = [...hand, starter], parts: Part[] = [];
  const n = all.length;
  for (let m = 1; m < 1 << n; m++) {
    const cs = all.filter((_, i) => m & (1 << i));
    if (cs.reduce((a, c) => a + cVal(c), 0) === 15) parts.push({ kind: 'fifteen', pts: 2, cards: cs });
  }
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (all[i].r === all[j].r) parts.push({ kind: 'pair', pts: 2, cards: [all[i], all[j]] });
  for (let len = 5; len >= 3; len--) {
    let found = 0;
    for (let m = 1; m < 1 << n; m++) {
      const cs = all.filter((_, i) => m & (1 << i));
      if (cs.length !== len) continue;
      const rs = cs.map((c) => c.r).sort((a, b) => a - b);
      if (rs.every((r, i) => i === 0 || r === rs[i - 1] + 1)) { parts.push({ kind: 'run', pts: len, cards: cs }); found++; }
    }
    if (found) break;
  }
  if (hand.every((c) => c.s === hand[0].s)) {
    if (starter.s === hand[0].s) parts.push({ kind: 'flush', pts: 5, cards: all });
    else if (!isCrib) parts.push({ kind: 'flush', pts: 4, cards: hand });
  }
  const nobs = hand.find((c) => c.r === 11 && c.s === starter.s);
  if (nobs) parts.push({ kind: 'nobs', pts: 1, cards: [nobs] });
  return { pts: parts.reduce((a, p) => a + p.pts, 0), parts };
}

/** Điểm khi vừa đánh lá cuối của dãy seq (các lá từ lần reset gần nhất), count là tổng sau lá đó */
export function pegPlayScore(seq: CCard[], count: number): { pts: number; why: string[] } {
  let pts = 0; const why: string[] = [];
  if (count === 15) { pts += 2; why.push('15'); }
  if (count === 31) { pts += 2; why.push('31'); }
  let k = 1;
  while (k < seq.length && seq[seq.length - 1 - k].r === seq[seq.length - 1].r) k++;
  if (k >= 2) { const p = k === 2 ? 2 : k === 3 ? 6 : 12; pts += p; why.push(k === 2 ? 'pair' : k === 3 ? 'pairRoyal' : 'doubleRoyal'); }
  for (let len = seq.length; len >= 3; len--) {
    const rs = seq.slice(-len).map((c) => c.r).sort((a, b) => a - b);
    if (rs.every((r, i) => i === 0 || r === rs[i - 1] + 1)) { pts += len; why.push('run'); break; }
  }
  return { pts, why };
}

/** Máy chọn 2 lá bỏ vào chuồn (chỉ số trong tay 6 lá) */
export function aiCribDiscard(hand: CCard[], aiIsDealer: boolean, level: number): [number, number] {
  const opts: [number, number][] = [];
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) opts.push([i, j]);
  if (level <= 2 && Math.random() < 0.7) return opts[Math.floor(Math.random() * opts.length)];
  const seen = new Set(hand.map(cKey));
  const rest = cDeck().filter((c) => !seen.has(cKey(c)));
  let best = opts[0], bv = -Infinity;
  for (const [i, j] of opts) {
    const keep = hand.filter((_, k) => k !== i && k !== j);
    const sample = level >= 6 ? rest : rest.filter((_, k) => k % 3 === 0);
    let tot = 0;
    for (const st of sample) tot += scoreHand(keep, st).pts;
    let v = tot / sample.length;
    const a = hand[i], b = hand[j];
    let cr = 0;
    if (a.r === b.r) cr += 2;
    if (cVal(a) + cVal(b) === 15) cr += 2;
    if (Math.abs(a.r - b.r) === 1) cr += 0.7;
    if (a.r === 5 || b.r === 5) cr += 0.8;
    v += (aiIsDealer ? 1 : -1) * cr * (level >= 4 ? 0.6 : 0.2);
    v += (Math.random() - 0.5) * Math.max(0, 8 - level) * 0.4;
    if (v > bv) { bv = v; best = [i, j]; }
  }
  return best;
}
/** Máy chọn lá đánh khi chồng (peg): trả chỉ số trong hand, hoặc -1 nếu phải "go" */
export function aiPegChoice(hand: CCard[], seq: CCard[], count: number, level: number): number {
  const legal = hand.map((c, i) => ({ c, i })).filter((x) => count + cVal(x.c) <= 31);
  if (!legal.length) return -1;
  if (level <= 2 && Math.random() < 0.6) return legal[Math.floor(Math.random() * legal.length)].i;
  let best = legal[0].i, bv = -Infinity;
  for (const { c, i } of legal) {
    const nc = count + cVal(c);
    let v = pegPlayScore([...seq, c], nc).pts * 3;
    if (level >= 4) {
      if (nc === 5 || nc === 21) v -= 1.5; // dễ cho đối thủ 15 / 31 bằng lá 10
      if (nc >= 11 && nc <= 14) v -= 0.6;
      if (cVal(c) === 5) v -= 0.4;
    }
    if (level >= 7 && hand.length > 1) v += cVal(c) <= 4 ? 0.2 : 0;
    v += Math.random() * (11 - level) * 0.15;
    if (v > bv) { bv = v; best = i; }
  }
  return best;
}
