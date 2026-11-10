/** Tangram: 7 mảnh chuẩn (hình vuông cạnh 4), sinh hình bóng bằng cách ghép cạnh-với-cạnh nên chắc chắn xếp được. */
export type Pt = [number, number];
export interface Piece { id: number; kind: string; pts: Pt[]; }
export interface Placed { id: number; kind: string; base: Pt[]; rot: number; mirror: boolean; x: number; y: number; }

/** Bảy mảnh: tam giác lớn x2, tam giác vừa, tam giác nhỏ x2, hình vuông, hình bình hành */
export const BASE: { kind: string; pts: Pt[] }[] = [
  { kind: 'bigA', pts: [[0, 0], [4, 0], [2, 2]] },
  { kind: 'bigB', pts: [[0, 0], [2, 2], [0, 4]] },
  { kind: 'med', pts: [[4, 4], [4, 2], [2, 4]] },
  { kind: 'sm1', pts: [[3, 1], [4, 0], [4, 2]] },
  { kind: 'sq', pts: [[2, 2], [3, 1], [4, 2], [3, 3]] },
  { kind: 'par', pts: [[0, 4], [2, 4], [3, 3], [1, 3]] },
  { kind: 'sm2', pts: [[2, 2], [3, 3], [1, 3]] },
];
const E = 1e-6;

/** Diện tích có dấu */
const area = (p: Pt[]): number => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
const ccw = (p: Pt[]): Pt[] => (area(p) < 0 ? [...p].reverse() : p);

export function centroid(p: Pt[]): Pt { let x = 0, y = 0; for (const q of p) { x += q[0]; y += q[1]; } return [x / p.length, y / p.length]; }

/** Biến đổi đỉnh gốc: lật (qua trục x của hình), quay quanh tâm mảnh, rồi tịnh tiến */
export function worldPts(pc: Placed): Pt[] {
  const c = centroid(pc.base), r = (pc.rot * Math.PI) / 180, cs = Math.cos(r), sn = Math.sin(r);
  const out = pc.base.map(([px, py]): Pt => {
    let dx = px - c[0], dy = py - c[1];
    if (pc.mirror) dx = -dx;
    return [c[0] + dx * cs - dy * sn + pc.x, c[1] + dx * sn + dy * cs + pc.y];
  });
  return ccw(out);
}

/** Độ sâu của điểm trong đa giác lồi CCW (âm = ngoài) */
export function depth(p: Pt[], x: number, y: number): number {
  let m = Infinity;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    const ex = b[0] - a[0], ey = b[1] - a[1], len = Math.hypot(ex, ey);
    m = Math.min(m, (ex * (y - a[1]) - ey * (x - a[0])) / len);
  }
  return m;
}

function overlap(a: Pt[], b: Pt[]): boolean {
  const ba = bbox([a]), bb = bbox([b]);
  if (ba[2] < bb[0] || bb[2] < ba[0] || ba[3] < bb[1] || bb[3] < ba[1]) return false;
  for (let x = ba[0]; x <= ba[2]; x += 0.1) for (let y = ba[1]; y <= ba[3]; y += 0.1) if (depth(a, x, y) > 0.03 && depth(b, x, y) > 0.03) return true;
  return false;
}
export function bbox(polys: Pt[][]): [number, number, number, number] {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const p of polys) for (const [x, y] of p) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
  return [a, b, c, d];
}

/** Sinh hình bóng gồm n mảnh (4–7): trả về vị trí các mảnh trong lời giải */
export function genSolution(n: number, rnd: () => number): Placed[] {
  for (let tries = 0; tries < 400; tries++) {
    const sol: Placed[] = [{ id: 0, kind: BASE[0].kind, base: BASE[0].pts, rot: 0, mirror: false, x: 0, y: 0 }];
    let ok = true;
    for (let k = 1; k < n && ok; k++) {
      const B = BASE[k], placed = sol.map(worldPts);
      const cands: Placed[] = [];
      for (const mirror of [false, true]) {
        const probe = worldPts({ id: k, kind: B.kind, base: B.pts, rot: 0, mirror, x: 0, y: 0 });
        for (let i = 0; i < probe.length; i++) {
          const p0 = probe[i], p1 = probe[(i + 1) % probe.length], lp = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
          for (const poly of placed) for (let j = 0; j < poly.length; j++) {
            const q0 = poly[j], q1 = poly[(j + 1) % poly.length];
            if (Math.abs(Math.hypot(q1[0] - q0[0], q1[1] - q0[1]) - lp) > 1e-4) continue;
            // mảnh mới nằm phía ngoài: cạnh của nó chạy ngược chiều cạnh cũ
            let th = Math.atan2(q0[1] - q1[1], q0[0] - q1[0]) - Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
            th = Math.round(((th * 180) / Math.PI) / 45) * 45;
            const t: Placed = { id: k, kind: B.kind, base: B.pts, rot: ((th % 360) + 360) % 360, mirror, x: 0, y: 0 };
            const w = worldPts(t);
            // tìm đỉnh w khớp q1 sau khi quay (cạnh đã chọn bằng chỉ số i trên bản đã lật nhưng chưa quay)
            const c0 = centroid(B.pts); void c0;
            const rr = (t.rot * Math.PI) / 180, cs = Math.cos(rr), sn = Math.sin(rr), cc = centroid(B.pts);
            const m0 = probe[i], dx = m0[0] - cc[0], dy = m0[1] - cc[1];
            const wx = cc[0] + dx * cs - dy * sn, wy = cc[1] + dx * sn + dy * cs;
            t.x = q1[0] - wx; t.y = q1[1] - wy; void w;
            cands.push(t);
          }
        }
      }
      for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
      const good = cands.find((c) => { const w = worldPts(c); return placed.every((o) => !overlap(w, o)); });
      if (!good) ok = false; else sol.push(good);
    }
    if (ok) return sol;
  }
  throw new Error('tangram');
}

export const piecesFor = (level: number): number => Math.min(7, 3 + Math.ceil(level / 2));
export const hasOutline = (level: number): boolean => level <= 4;

/** Tỉ lệ sai lệch giữa hình bóng và các mảnh người chơi (0 = khớp hoàn toàn) */
export function mismatch(sol: Pt[][], mine: Pt[][]): number {
  const [x0, y0, x1, y1] = bbox([...sol, ...mine]);
  let tot = 0, bad = 0;
  for (let x = x0; x <= x1; x += 0.12) for (let y = y0; y <= y1; y += 0.12) {
    const a = sol.some((p) => depth(p, x, y) >= 0), b = mine.some((p) => depth(p, x, y) >= 0);
    if (a) tot++;
    if (a !== b) bad++;
  }
  return tot ? bad / tot : 1;
}
export const isSolved = (sol: Pt[][], mine: Pt[][]): boolean => mismatch(sol, mine) < 0.035;
void E;
