/** Bảng vẽ nét mượt bằng chuột / bút / ngón tay (dùng cho chữ ký). Lưu nét dạng điểm để vẽ lại, xuất SVG. */

export interface Stroke { color: string; width: number; pts: [number, number, number][] }

export class SketchPad {
  strokes: Stroke[] = [];
  color = '#0b2a6b';
  width = 3;
  private cur: Stroke | null = null;
  private ctx: CanvasRenderingContext2D;
  onChange?: () => void;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => canvas.addEventListener(ev, () => this.up()));
  }

  /** Canvas theo kích thước hiển thị × devicePixelRatio cho nét sắc */
  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (!r.width) return;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.redraw();
  }
  /** Toạ độ lưu theo tỉ lệ 0..1000 chiều ngang để vẽ lại đúng khi đổi cỡ */
  private pt(e: PointerEvent): [number, number, number] {
    const r = this.canvas.getBoundingClientRect();
    const k = 1000 / r.width;
    const p = e.pressure && e.pointerType === 'pen' ? e.pressure : 0.5;
    return [(e.clientX - r.left) * k, (e.clientY - r.top) * k, p];
  }
  private down(e: PointerEvent): void {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.cur = { color: this.color, width: this.width, pts: [this.pt(e)] };
    this.strokes.push(this.cur);
    this.redraw();
  }
  private move(e: PointerEvent): void {
    if (!this.cur) return;
    const evs = (e.getCoalescedEvents?.() ?? [e]) as PointerEvent[];
    for (const ce of evs) this.cur.pts.push(this.pt(ce));
    this.redraw();
  }
  private up(): void {
    if (!this.cur) return;
    this.cur = null;
    this.onChange?.();
  }
  undo(): void { this.strokes.pop(); this.redraw(); this.onChange?.(); }
  clear(): void { this.strokes = []; this.redraw(); this.onChange?.(); }
  get empty(): boolean { return !this.strokes.length; }

  redraw(): void {
    const { ctx, canvas } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const k = canvas.width / 1000;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    for (const s of this.strokes) drawStroke(ctx, s);
  }

  /** Khung bao các nét (đơn vị 0..1000) */
  bounds(): { x: number; y: number; w: number; h: number } | null {
    if (this.empty) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of this.strokes) for (const [x, y] of s.pts) { x0 = Math.min(x0, x - s.width); y0 = Math.min(y0, y - s.width); x1 = Math.max(x1, x + s.width); y1 = Math.max(y1, y + s.width); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /** Xuất PNG đã cắt sát nét, nền trong suốt (hoặc màu nền) */
  toCanvas(scale = 3, pad = 12, bg?: string): HTMLCanvasElement | null {
    const b = this.bounds();
    if (!b) return null;
    const c = document.createElement('canvas');
    c.width = Math.ceil((b.w + pad * 2) * scale);
    c.height = Math.ceil((b.h + pad * 2) * scale);
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.setTransform(scale, 0, 0, scale, (pad - b.x) * scale, (pad - b.y) * scale);
    for (const s of this.strokes) drawStroke(ctx, s);
    return c;
  }

  toSvg(pad = 12): string {
    const b = this.bounds();
    if (!b) return '';
    const paths = this.strokes.map((s) => {
      const p = s.pts;
      if (p.length === 1) return `<circle cx="${p[0][0].toFixed(1)}" cy="${p[0][1].toFixed(1)}" r="${(s.width / 2).toFixed(1)}" fill="${s.color}"/>`;
      let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
      for (let i = 1; i < p.length - 1; i++) {
        const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
        d += ` Q${p[i][0].toFixed(1)} ${p[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
      }
      const l = p[p.length - 1];
      d += ` L${l[0].toFixed(1)} ${l[1].toFixed(1)}`;
      return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round"/>`;
    });
    const vb = `${(b.x - pad).toFixed(1)} ${(b.y - pad).toFixed(1)} ${(b.w + pad * 2).toFixed(1)} ${(b.h + pad * 2).toFixed(1)}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${Math.round(b.w + pad * 2)}" height="${Math.round(b.h + pad * 2)}">${paths.join('')}</svg>`;
  }
}

/** Vẽ một nét: đường cong bậc hai qua trung điểm, độ dày đổi nhẹ theo tốc độ cho giống nét bút */
function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke): void {
  const p = s.pts;
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (p.length === 1) {
    ctx.beginPath();
    ctx.arc(p[0][0], p[0][1], s.width / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i];
    const speed = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const w = s.width * Math.max(0.55, Math.min(1.25, 1.25 - speed / 40)) * (0.6 + b[2] * 0.8);
    ctx.lineWidth = w;
    ctx.beginPath();
    const pm = i > 1 ? [(p[i - 2][0] + a[0]) / 2, (p[i - 2][1] + a[1]) / 2] : a;
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    ctx.moveTo(pm[0], pm[1]);
    ctx.quadraticCurveTo(a[0], a[1], m[0], m[1]);
    ctx.stroke();
  }
  const l = p[p.length - 1], pl = p[p.length - 2];
  ctx.beginPath();
  ctx.moveTo((pl[0] + l[0]) / 2, (pl[1] + l[1]) / 2);
  ctx.lineTo(l[0], l[1]);
  ctx.stroke();
}

/** Nạp phông chữ Google Fonts khi cần (chữ ký kiểu viết tay, logo) */
export function loadGoogleFonts(families: string[]): Promise<void> {
  const id = 'gf-' + families.join('|').replace(/[^a-z0-9]/gi, '');
  if (!document.getElementById(id)) {
    const l = document.createElement('link');
    l.id = id;
    l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?${families.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}`).join('&')}&display=swap`;
    document.head.appendChild(l);
  }
  return Promise.all(families.map((f) => document.fonts.load(`40px "${f.split(':')[0]}"`).catch(() => []))).then(() => undefined);
}
