/**
 * Cờ cá ngựa (Ludo): 4 màu, mỗi màu 4 quân. Tung xúc xắc, ra quân bằng 6, đi vòng 52 ô rồi vào đường về nhà 6 ô, cần số chính xác để vào đích.
 * Người chơi cầm Đỏ (màu 0); các màu còn lại do máy điều khiển. Ai đưa đủ 4 quân về đích trước thắng.
 */
export const COLORS = ['red', 'green', 'yellow', 'blue'] as const;

/** 52 ô vòng ngoài trên lưới 15×15, bắt đầu từ ô xuất phát của Đỏ, đi theo chiều kim đồng hồ */
export const RING: [number, number][] = [];
const seg = (pts: [number, number][]) => RING.push(...pts);
seg([[1, 6], [2, 6], [3, 6], [4, 6], [5, 6]]);
seg([[6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0]]);
seg([[7, 0], [8, 0]]);
seg([[8, 1], [8, 2], [8, 3], [8, 4], [8, 5]]);
seg([[9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6]]);
seg([[14, 7], [14, 8]]);
seg([[13, 8], [12, 8], [11, 8], [10, 8], [9, 8]]);
seg([[8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14]]);
seg([[7, 14], [6, 14]]);
seg([[6, 13], [6, 12], [6, 11], [6, 10], [6, 9]]);
seg([[5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]]);
seg([[0, 7], [0, 6]]);

const rot = ([x, y]: [number, number], k: number): [number, number] => { let p: [number, number] = [x, y]; for (let i = 0; i < k; i++) p = [14 - p[1], p[0]]; return p; };
/** Đường về nhà của màu k (6 ô, ô cuối là đích) */
export const HOME: [number, number][][] = [0, 1, 2, 3].map((k) => ([[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]] as [number, number][]).map((p) => rot(p, k)));
/** Chuồng: 4 chỗ cho mỗi màu */
export const BASE: [number, number][][] = [0, 1, 2, 3].map((k) => ([[2, 2], [4, 2], [2, 4], [4, 4]] as [number, number][]).map((p) => rot(p, k)));
export const START_IDX = [0, 13, 26, 39];
/** Ô an toàn (xuất phát và ô ngôi sao): quân đứng đó không bị đá */
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

/** Quân: -1 trong chuồng; 0..50 trên vòng (tính từ ô xuất phát của màu mình); 51..56 đường về nhà (56 = đích) */
export const FINISH = 56;
export interface LudoState { tokens: number[][]; players: number[]; turn: number; die: number; rolled: boolean; sixes: number; winner: number }

export function ludoNew(opponents: number): LudoState {
  const players = opponents === 1 ? [0, 2] : opponents === 2 ? [0, 1, 3] : [0, 1, 2, 3];
  return { tokens: [0, 1, 2, 3].map(() => [-1, -1, -1, -1]), players, turn: 0, die: 0, rolled: false, sixes: 0, winner: -1 };
}
export const ringIndex = (color: number, rel: number): number => (START_IDX[color] + rel) % 52;

/** Toạ độ ô lưới của một quân */
export function tokenCell(color: number, k: number, rel: number): [number, number] {
  if (rel < 0) return BASE[color][k];
  if (rel <= 50) return RING[ringIndex(color, rel)];
  return HOME[color][rel - 51];
}

/** Các quân của màu `color` có thể đi với xúc xắc `die` */
export function ludoMovable(s: LudoState, color: number, die: number): number[] {
  const out: number[] = [];
  s.tokens[color].forEach((rel, k) => {
    if (rel === FINISH) return;
    if (rel < 0) { if (die === 6) out.push(k); return; }
    if (rel + die <= FINISH) out.push(k);
  });
  return out;
}

/** Đi quân k với xúc xắc die; trả trạng thái mới (đã xử lý đá quân, lượt tiếp theo, người thắng) */
export function ludoMove(s: LudoState, color: number, k: number, die: number): { s: LudoState; captured: number } {
  const n: LudoState = JSON.parse(JSON.stringify(s));
  const t = n.tokens[color];
  const from = t[k];
  t[k] = from < 0 ? 0 : from + die;
  let captured = 0;
  if (t[k] <= 50) {
    const idx = ringIndex(color, t[k]);
    if (!SAFE.has(idx)) {
      for (const c of n.players) {
        if (c === color) continue;
        n.tokens[c].forEach((rel, j) => { if (rel >= 0 && rel <= 50 && ringIndex(c, rel) === idx) { n.tokens[c][j] = -1; captured++; } });
      }
    }
  }
  if (t.every((x) => x === FINISH)) n.winner = color;
  n.rolled = false; n.die = 0;
  if (n.winner < 0 && !(die === 6)) { n.sixes = 0; n.turn = (n.turn + 1) % n.players.length; }
  else if (n.winner < 0) n.sixes++; // 6: được đi tiếp
  return { s: n, captured };
}
export function ludoPass(s: LudoState): LudoState {
  const n: LudoState = JSON.parse(JSON.stringify(s));
  n.rolled = false; n.die = 0; n.sixes = 0; n.turn = (n.turn + 1) % n.players.length;
  return n;
}

/** Máy chọn quân: level 1 ngẫu nhiên; cao hơn ưu tiên đá quân, ra quân, vào đích, tránh nguy hiểm */
export function ludoAiPick(s: LudoState, color: number, die: number, level: number, rand: () => number = Math.random): number {
  const opts = ludoMovable(s, color, die);
  if (opts.length === 1) return opts[0];
  const skill = Math.min(1, Math.max(0, (level - 1) / 9));
  if (rand() > 0.25 + 0.75 * skill) return opts[Math.floor(rand() * opts.length)];
  let best = opts[0], bestV = -1e9;
  for (const k of opts) {
    const rel = s.tokens[color][k];
    const { s: ns, captured } = ludoMove(s, color, k, die);
    const to = ns.tokens[color][k];
    let v = captured * 100;
    if (rel < 0) v += 60;
    if (to === FINISH) v += 80;
    if (to > 50) v += 25;
    v += to * 0.5;
    if (to >= 0 && to <= 50) {
      const idx = ringIndex(color, to);
      if (SAFE.has(idx)) v += 15;
      // nguy hiểm: quân địch cách phía sau 1..6 ô
      for (const c of s.players) if (c !== color) ns.tokens[c].forEach((r2) => {
        if (r2 < 0 || r2 > 50) return;
        const d = (idx - ringIndex(c, r2) + 52) % 52;
        if (d >= 1 && d <= 6 && !SAFE.has(idx)) v -= 20 * skill;
      });
    }
    if (rel >= 0 && rel <= 50) { // đang bị đe doạ ở ô cũ mà thoát được
      const oi = ringIndex(color, rel);
      for (const c of s.players) if (c !== color) s.tokens[c].forEach((r2) => {
        if (r2 < 0 || r2 > 50) return;
        const d = (oi - ringIndex(c, r2) + 52) % 52;
        if (d >= 1 && d <= 6 && !SAFE.has(oi)) v += 12 * skill;
      });
    }
    if (v > bestV) { bestV = v; best = k; }
  }
  return best;
}

/** Số đối thủ theo cấp */
export const LUDO_OPPONENTS = [1, 1, 1, 2, 2, 2, 2, 3, 3, 3];
