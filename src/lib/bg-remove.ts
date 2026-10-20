/**
 * Xoá nền đơn giản bằng thuật toán (không cần AI): hợp ảnh sản phẩm trên nền trắng, nền một màu.
 * Loang từ mép ảnh vào trong, xoá các điểm có màu gần với màu nền; viền chuyển tiếp được làm mờ dần.
 */

export interface KeyOptions {
  /** Độ lệch màu cho phép, 0–100 */
  tolerance: number;
  /** true: chỉ xoá vùng nền nối liền với mép ảnh; false: xoá mọi điểm cùng màu nền */
  contiguous: boolean;
  /** Màu nền; không truyền thì tự đoán từ các điểm ở mép ảnh */
  bg?: [number, number, number];
}

/** Khoảng cách màu có trọng số theo cảm nhận mắt người, chuẩn hoá về 0–100 */
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const rm = (r1 + r2) / 2;
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  const d = Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
  return (d / 764.8) * 100; // 764.8 ≈ khoảng cách đen–trắng
}

/** Đoán màu nền: trung vị từng kênh màu của các điểm ở mép ảnh */
export function guessBackground(px: Uint8ClampedArray, w: number, h: number): [number, number, number] {
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  const take = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (px[i + 3] < 16) return; // bỏ qua điểm đã trong suốt
    rs.push(px[i]); gs.push(px[i + 1]); bs.push(px[i + 2]);
  };
  for (let x = 0; x < w; x++) { take(x, 0); take(x, h - 1); }
  for (let y = 0; y < h; y++) { take(0, y); take(w - 1, y); }
  const med = (a: number[]) => { if (!a.length) return 255; a.sort((m, n) => m - n); return a[Math.floor(a.length / 2)]; };
  return [med(rs), med(gs), med(bs)];
}

/** Trả về kênh alpha mới (0–255) cho từng điểm; không sửa mảng điểm ảnh gốc */
export function keyOutBackground(px: Uint8ClampedArray, w: number, h: number, o: KeyOptions): Uint8ClampedArray {
  const [br, bg, bb] = o.bg ?? guessBackground(px, w, h);
  const hard = Math.max(0.5, o.tolerance);
  const soft = hard * 1.6; // vùng chuyển tiếp: trong suốt một phần
  const n = w * h;
  const dist = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    dist[p] = colorDistance(px[i], px[i + 1], px[i + 2], br, bg, bb);
  }
  const alpha = new Uint8ClampedArray(n);
  for (let p = 0; p < n; p++) alpha[p] = px[p * 4 + 3];

  const fade = (p: number) => {
    const d = dist[p];
    if (d <= hard) alpha[p] = 0;
    else if (d < soft) alpha[p] = Math.min(alpha[p], Math.round(((d - hard) / (soft - hard)) * 255));
  };

  if (!o.contiguous) {
    for (let p = 0; p < n; p++) fade(p);
    return alpha;
  }

  // Loang từ mép ảnh: chỉ đi qua các điểm đủ gần màu nền (kể cả vùng chuyển tiếp để viền mềm)
  const seen = new Uint8Array(n);
  const stack: number[] = [];
  const push = (p: number) => { if (!seen[p] && dist[p] < soft) { seen[p] = 1; stack.push(p); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const p = stack.pop() as number;
    fade(p);
    if (dist[p] > hard) continue; // điểm ở viền: làm mờ nhưng không loang tiếp vào trong vật thể
    const x = p % w, y = (p / w) | 0;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (y > 0) push(p - w);
    if (y < h - 1) push(p + w);
  }
  return alpha;
}
