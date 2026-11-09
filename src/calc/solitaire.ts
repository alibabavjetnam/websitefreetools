/**
 * Lõi ba trò xếp bài một người (thuần): Klondike, Spider, FreeCell.
 * Lá bài: { r: 1..13, s: 0..3 (♠ ♥ ♦ ♣), up }. Đỏ = ♥ ♦.
 */
export interface Card { r: number; s: number; up: boolean; id: number }
export const isRed = (c: Card): boolean => c.s === 1 || c.s === 2;
export const SUIT = ['♠', '♥', '♦', '♣'];
export const RANK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function shuffle<T>(a: T[], rand: () => number = Math.random): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function deck(suits: number[] = [0, 1, 2, 3], copies = 1): Card[] {
  const out: Card[] = [];
  let id = 0;
  for (let k = 0; k < copies; k++) for (const s of suits) for (let r = 1; r <= 13; r++) out.push({ r, s, up: false, id: id++ });
  return out;
}

/** Vị trí một chồng bài */
export type Pile = { kind: 'tab' | 'found' | 'cell' | 'stock' | 'waste'; i: number };
export interface Move { from: Pile; to: Pile; n: number }

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/* ============================== Klondike ============================== */
export interface Klondike { tab: Card[][]; found: Card[][]; stock: Card[]; waste: Card[]; draw: number; passes: number }

export function dealKlondike(draw: number, rand?: () => number): Klondike {
  const d = shuffle(deck(), rand);
  const tab: Card[][] = [];
  for (let i = 0; i < 7; i++) {
    tab.push(d.splice(0, i + 1));
    tab[i][i].up = true;
  }
  return { tab, found: [[], [], [], []], stock: d, waste: [], draw, passes: 0 };
}

const kTop = (p: Card[]): Card | undefined => p[p.length - 1];

/** Kiểm tra đặt chuỗi (lá đầu = c) lên chồng đích của Klondike/FreeCell (xen màu, giảm dần) */
export const canStackAlt = (onto: Card | undefined, c: Card): boolean => (onto ? onto.up && isRed(onto) !== isRed(c) && onto.r === c.r + 1 : c.r === 13);
export const canFound = (pile: Card[], c: Card): boolean => {
  const top = kTop(pile);
  return top ? top.s === c.s && top.r + 1 === c.r : c.r === 1;
};

export function klondikeGet(g: Klondike, p: Pile): Card[] {
  return p.kind === 'tab' ? g.tab[p.i] : p.kind === 'found' ? g.found[p.i] : p.kind === 'waste' ? g.waste : g.stock;
}

export function klondikeCanMove(g: Klondike, m: Move): boolean {
  const src = klondikeGet(g, m.from);
  if (m.n < 1 || m.n > src.length) return false;
  const seq = src.slice(src.length - m.n);
  if (!seq[0].up) return false;
  if (m.from.kind === 'waste' || m.from.kind === 'found') { if (m.n !== 1) return false; }
  for (let k = 1; k < seq.length; k++) if (!canStackAlt(seq[k - 1], seq[k])) return false;
  if (m.to.kind === 'found') return m.n === 1 && m.to.i === seq[0].s && canFound(g.found[m.to.i], seq[0]);
  if (m.to.kind === 'tab') return canStackAlt(kTop(g.tab[m.to.i]), seq[0]);
  return false;
}

export function klondikeMove(g: Klondike, m: Move): Klondike {
  const n = clone(g);
  const src = klondikeGet(n, m.from);
  const seq = src.splice(src.length - m.n, m.n);
  klondikeGet(n, m.to).push(...seq);
  if (m.from.kind === 'tab') { const t = kTop(src); if (t) t.up = true; }
  return n;
}

/** Bấm chồng rút: lật draw lá sang chồng bỏ; hết thì úp lại */
export function klondikeDraw(g: Klondike): Klondike {
  const n = clone(g);
  if (!n.stock.length) {
    n.stock = n.waste.reverse().map((c) => ({ ...c, up: false }));
    n.waste = []; n.passes++;
    return n;
  }
  for (let k = 0; k < n.draw && n.stock.length; k++) { const c = n.stock.pop() as Card; c.up = true; n.waste.push(c); }
  return n;
}

export const klondikeWon = (g: Klondike): boolean => g.found.every((f) => f.length === 13);

/** Tất cả bài đã ngửa và chồng rút trống: có thể tự đưa hết lên */
export const klondikeCanAuto = (g: Klondike): boolean => !g.stock.length && !g.waste.length && g.tab.every((t) => t.every((c) => c.up));

/** Một nước đưa lên ô đích nếu có (dùng cho tự xếp và bấm đúp) */
export function autoFoundMove(g: Klondike): Move | null {
  const srcs: Pile[] = [{ kind: 'waste', i: 0 }, ...g.tab.map((_, i) => ({ kind: 'tab' as const, i }))];
  for (const from of srcs) {
    const p = klondikeGet(g, from);
    const c = kTop(p);
    if (!c || !c.up) continue;
    if (canFound(g.found[c.s], c)) return { from, to: { kind: 'found', i: c.s }, n: 1 };
  }
  return null;
}

/** Gợi ý một nước có ích (không phải lật qua lại vô nghĩa) */
export function klondikeHint(g: Klondike): Move | null {
  const f = autoFoundMove(g);
  if (f) return f;
  for (let i = 0; i < 7; i++) {
    const src = g.tab[i];
    const first = src.findIndex((c) => c.up);
    if (first < 0) continue;
    for (let j = 0; j < 7; j++) {
      if (i === j) continue;
      const m: Move = { from: { kind: 'tab', i }, to: { kind: 'tab', i: j }, n: src.length - first };
      // chuyển K từ cột trống sang cột trống là vô ích
      if (first === 0 && !g.tab[j].length) continue;
      if (klondikeCanMove(g, m)) return m;
    }
  }
  if (g.waste.length) for (let j = 0; j < 7; j++) {
    const m: Move = { from: { kind: 'waste', i: 0 }, to: { kind: 'tab', i: j }, n: 1 };
    if (klondikeCanMove(g, m)) return m;
  }
  return null;
}

/* ============================== Spider ============================== */
export interface Spider { tab: Card[][]; stock: Card[]; done: number; suits: number }

export function dealSpider(suits: 1 | 2 | 4, rand?: () => number): Spider {
  const suitList = suits === 1 ? [0] : suits === 2 ? [0, 1] : [0, 1, 2, 3];
  const d = shuffle(deck(suitList, 8 / suitList.length), rand);
  const tab: Card[][] = [];
  for (let i = 0; i < 10; i++) {
    const n = i < 4 ? 6 : 5;
    tab.push(d.splice(0, n));
    tab[i][n - 1].up = true;
  }
  return { tab, stock: d, done: 0, suits };
}

/** Chuỗi kéo được trong Spider: cùng chất, giảm dần liên tiếp */
function spiderRun(p: Card[], n: number): boolean {
  const seq = p.slice(p.length - n);
  if (!seq.length || !seq[0].up) return false;
  for (let k = 1; k < seq.length; k++) if (seq[k].s !== seq[k - 1].s || seq[k].r !== seq[k - 1].r - 1) return false;
  return true;
}
export function spiderMaxRun(p: Card[]): number {
  let n = 0;
  while (n < p.length && spiderRun(p, n + 1)) n++;
  return n;
}
export function spiderCanMove(g: Spider, from: number, to: number, n: number): boolean {
  if (from === to) return false;
  const src = g.tab[from];
  if (n < 1 || n > src.length || !spiderRun(src, n)) return false;
  const top = kTop(g.tab[to]);
  return !top || top.r === src[src.length - n].r + 1;
}
/** Sau khi di chuyển: lật lá, gỡ bộ K→A đủ chất */
function spiderTidy(g: Spider, i: number): void {
  const p = g.tab[i];
  if (p.length >= 13 && spiderRun(p, 13) && p[p.length - 13].r === 13) { p.splice(p.length - 13, 13); g.done++; }
  const t = kTop(p); if (t) t.up = true;
}
export function spiderMove(g: Spider, from: number, to: number, n: number): Spider {
  const x = clone(g);
  const seq = x.tab[from].splice(x.tab[from].length - n, n);
  x.tab[to].push(...seq);
  spiderTidy(x, from); spiderTidy(x, to);
  return x;
}
/** Chia thêm 1 lá cho mỗi cột (không được khi còn cột trống) */
export const spiderCanDeal = (g: Spider): boolean => g.stock.length >= 10 && g.tab.every((t) => t.length > 0);
export function spiderDeal(g: Spider): Spider {
  const x = clone(g);
  for (let i = 0; i < 10; i++) { const c = x.stock.pop() as Card; c.up = true; x.tab[i].push(c); }
  for (let i = 0; i < 10; i++) spiderTidy(x, i);
  return x;
}
export const spiderWon = (g: Spider): boolean => g.done === 8;
export function spiderHint(g: Spider): { from: number; to: number; n: number } | null {
  let best: { from: number; to: number; n: number; sc: number } | null = null;
  for (let i = 0; i < 10; i++) {
    const n = spiderMaxRun(g.tab[i]);
    for (let k = n; k >= 1; k--) for (let j = 0; j < 10; j++) {
      if (!spiderCanMove(g, i, j, k)) continue;
      const top = kTop(g.tab[j]);
      const below = g.tab[i][g.tab[i].length - k - 1];
      let sc = 0;
      if (top && top.s === g.tab[i][g.tab[i].length - k].s) sc += 3;
      if (below && !below.up) sc += 2;
      if (!top) sc -= 2;
      if (k === g.tab[i].length && !top) continue;
      if (!best || sc > best.sc) best = { from: i, to: j, n: k, sc };
    }
  }
  return best && best.sc >= 0 ? { from: best.from, to: best.to, n: best.n } : null;
}

/* ============================== FreeCell ============================== */
export interface FreeCell { tab: Card[][]; cells: (Card | null)[]; found: Card[][] }

export function dealFreeCell(cells: number, rand?: () => number): FreeCell {
  const d = shuffle(deck(), rand);
  const tab: Card[][] = [[], [], [], [], [], [], [], []];
  d.forEach((c, i) => { c.up = true; tab[i % 8].push(c); });
  return { tab, cells: new Array(cells).fill(null), found: [[], [], [], []] };
}

/** Số lá tối đa chuyển một lần: (ô trống + 1) × 2^(cột trống) */
export function fcMaxMove(g: FreeCell, toEmpty: boolean): number {
  const freeCells = g.cells.filter((c) => !c).length;
  const emptyCols = g.tab.filter((t) => !t.length).length - (toEmpty ? 1 : 0);
  return (freeCells + 1) * Math.pow(2, Math.max(0, emptyCols));
}

export function fcCanMove(g: FreeCell, m: Move): boolean {
  if (m.from.kind === 'cell') {
    const c = g.cells[m.from.i];
    if (!c || m.n !== 1) return false;
    if (m.to.kind === 'found') return m.to.i === c.s && canFound(g.found[m.to.i], c);
    if (m.to.kind === 'tab') return !g.tab[m.to.i].length || canStackAlt(kTop(g.tab[m.to.i]), c);
    if (m.to.kind === 'cell') return !g.cells[m.to.i];
    return false;
  }
  if (m.from.kind !== 'tab') return false;
  const src = g.tab[m.from.i];
  if (m.n < 1 || m.n > src.length) return false;
  const seq = src.slice(src.length - m.n);
  for (let k = 1; k < seq.length; k++) if (!canStackAlt(seq[k - 1], seq[k])) return false;
  if (m.to.kind === 'found') return m.n === 1 && m.to.i === seq[0].s && canFound(g.found[m.to.i], seq[0]);
  if (m.to.kind === 'cell') return m.n === 1 && !g.cells[m.to.i];
  if (m.to.kind === 'tab') {
    if (m.to.i === m.from.i) return false;
    const dst = g.tab[m.to.i];
    if (m.n > fcMaxMove(g, !dst.length)) return false;
    return !dst.length || canStackAlt(kTop(dst), seq[0]);
  }
  return false;
}

export function fcMove(g: FreeCell, m: Move): FreeCell {
  const x = clone(g);
  let seq: Card[];
  if (m.from.kind === 'cell') { seq = [x.cells[m.from.i] as Card]; x.cells[m.from.i] = null; }
  else seq = x.tab[m.from.i].splice(x.tab[m.from.i].length - m.n, m.n);
  if (m.to.kind === 'cell') x.cells[m.to.i] = seq[0];
  else if (m.to.kind === 'found') x.found[m.to.i].push(seq[0]);
  else x.tab[m.to.i].push(...seq);
  return x;
}
export const fcWon = (g: FreeCell): boolean => g.found.every((f) => f.length === 13);

/** Lá an toàn đưa lên ô đích (không còn lá nhỏ hơn màu kia cần nó) */
export function fcSafeAuto(g: FreeCell): Move | null {
  const minOther = (red: boolean) => Math.min(...g.found.map((f, i) => ({ f, red: i === 1 || i === 2 })).filter((x) => x.red !== red).map((x) => x.f.length));
  const tryCard = (c: Card | null | undefined, from: Pile): Move | null => {
    if (!c) return null;
    if (canFound(g.found[c.s], c) && (c.r <= 2 || c.r <= minOther(isRed(c)) + 1)) return { from, to: { kind: 'found', i: c.s }, n: 1 };
    return null;
  };
  for (let i = 0; i < g.cells.length; i++) { const m = tryCard(g.cells[i], { kind: 'cell', i }); if (m) return m; }
  for (let i = 0; i < 8; i++) { const m = tryCard(kTop(g.tab[i]), { kind: 'tab', i }); if (m) return m; }
  return null;
}

/**
 * Gợi ý FreeCell có ích: lên ô đích → chồng dãy sang cột khác (không chuyển dãy đang nằm đúng chỗ)
 * → lá ở ô trống xuống bàn → dãy sang cột trống → đưa lá chắn đường vào ô trống (ưu tiên cột có lá cần lên ô đích sớm nhất).
 */
export function freecellHint(g: FreeCell): Move | null {
  // 1. Lên ô đích
  for (let i = 0; i < g.cells.length; i++) { const c = g.cells[i]; if (c && canFound(g.found[c.s], c)) return { from: { kind: 'cell', i }, to: { kind: 'found', i: c.s }, n: 1 }; }
  for (let i = 0; i < 8; i++) { const c = kTop(g.tab[i]); if (c && canFound(g.found[c.s], c)) return { from: { kind: 'tab', i }, to: { kind: 'found', i: c.s }, n: 1 }; }
  const runLen = (t: Card[]): number => { let n = t.length ? 1 : 0; while (n < t.length && canStackAlt(t[t.length - n - 1], t[t.length - n])) n++; return n; };
  // 2. Dãy (hoặc một phần dãy) sang cột có lá — chỉ khi phần dưới không phải "cha" hợp lệ (tránh qua lại vô ích)
  let toEmpty: Move | null = null;
  for (let i = 0; i < 8; i++) {
    const src = g.tab[i];
    const r = runLen(src);
    for (let n = r; n >= 1; n--) {
      const below = src[src.length - n - 1];
      if (below && canStackAlt(below, src[src.length - n])) continue; // đang nằm đúng chỗ
      for (let j = 0; j < 8; j++) {
        if (j === i) continue;
        const m: Move = { from: { kind: 'tab', i }, to: { kind: 'tab', i: j }, n };
        if (!fcCanMove(g, m)) continue;
        if (g.tab[j].length) return m;
        if (!toEmpty && below) toEmpty = m; // chuyển cả cột sang cột trống là vô ích
      }
    }
  }
  // 3. Lá ở ô trống xuống cột có lá
  for (let i = 0; i < g.cells.length; i++) {
    if (!g.cells[i]) continue;
    for (let j = 0; j < 8; j++) { const m: Move = { from: { kind: 'cell', i }, to: { kind: 'tab', i: j }, n: 1 }; if (g.tab[j].length && fcCanMove(g, m)) return m; }
  }
  if (toEmpty) return toEmpty;
  // 4. Đưa lá trên cùng vào ô trống: chọn cột mà lá cần lên ô đích tiếp theo nằm nông nhất
  const free = g.cells.findIndex((c) => !c);
  if (free < 0) return null;
  let best = -1, bestDepth = Infinity;
  for (let i = 0; i < 8; i++) {
    const t = g.tab[i];
    if (!t.length) continue;
    if (t.length > 1 && canStackAlt(t[t.length - 2], t[t.length - 1])) continue; // lá trên cùng đang nằm đúng dãy
    for (let d = 0; d < t.length; d++) {
      const c = t[t.length - 1 - d];
      if (c.r === g.found[c.s].length + 1) { if (d > 0 && d < bestDepth) { bestDepth = d; best = i; } break; }
    }
  }
  return best >= 0 ? { from: { kind: 'tab', i: best }, to: { kind: 'cell', i: free }, n: 1 } : null;
}
