/**
 * Khung soạn trên trang PDF dùng chung cho "Ký tên lên PDF" và "Thêm chữ & điền form PDF".
 * Hiển thị trang bằng pdf.js, đặt các đối tượng (ảnh, chữ, ô màu) lên trang, kéo thả / đổi cỡ,
 * rồi ghi vào file bằng pdf-lib. Chữ được vẽ thành ảnh độ phân giải cao nên hiển thị đúng mọi ngôn ngữ
 * (tiếng Việt, Nhật, Ả Rập…) mà không cần nhúng phông.
 */
import { openPdf, type PdfJsDoc } from './cdn';
import { pdfLib } from './pdflib';
import { renderPage } from './pdfrender';
import { t } from '../i18n';

export type ObjKind = 'image' | 'text' | 'rect';
export interface PdfObj {
  id: number;
  page: number; // bắt đầu từ 1
  kind: ObjKind;
  /** Toạ độ theo điểm PDF, gốc ở góc trên trái trang */
  x: number; y: number; w: number; h: number;
  src?: string; // ảnh (data URL)
  text?: string; size?: number; color?: string; bold?: boolean; font?: string;
  fill?: string; // màu ô (rect)
}

export class PdfEditor {
  doc: PdfJsDoc | null = null;
  bytes: Uint8Array | null = null;
  objs: PdfObj[] = [];
  /** Đối tượng tạm chỉ dùng khi xuất (ví dụ chữ có dấu điền vào ô biểu mẫu) */
  extra: PdfObj[] = [];
  sizes: { w: number; h: number }[] = [];
  active: number | null = null;
  /** Hàm tạo đối tượng khi bấm lên trang (null: chỉ chọn) */
  placer: ((page: number, x: number, y: number) => Omit<PdfObj, 'id'> | null) | null = null;
  onChange?: () => void;
  private seq = 0;
  private scale = 1;

  constructor(private host: HTMLElement) {
    host.addEventListener('pointerdown', (e) => this.onDown(e));
    document.addEventListener('keydown', (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.active != null && !(e.target as HTMLElement).isContentEditable && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault();
        this.remove(this.active);
      }
    });
  }

  async load(bytes: Uint8Array): Promise<void> {
    this.bytes = bytes;
    this.objs = [];
    this.active = null;
    await this.doc?.destroy?.();
    this.doc = await openPdf(bytes);
    this.sizes = [];
    this.host.innerHTML = '';
    const avail = Math.max(320, this.host.clientWidth - 32);
    for (let p = 1; p <= this.doc.numPages; p++) {
      const page = await this.doc.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      page.cleanup();
      this.sizes.push({ w: vp.width, h: vp.height });
      if (p === 1) this.scale = Math.min(1.6, avail / vp.width);
      const wrap = document.createElement('div');
      wrap.className = 'pdf-page';
      wrap.dataset.page = String(p);
      wrap.style.width = `${vp.width * this.scale}px`;
      wrap.style.height = `${vp.height * this.scale}px`;
      wrap.innerHTML = `<span class="pdf-page-label">${p}/${this.doc.numPages}</span>`;
      this.host.appendChild(wrap);
    }
    // Vẽ dần từng trang (độ nét theo màn hình) để mở nhanh
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    for (let p = 1; p <= this.doc.numPages; p++) {
      const c = await renderPage(this.doc, p, this.scale * dpr);
      c.style.width = '100%';
      this.pageEl(p)?.prepend(c);
    }
  }

  pageEl(p: number): HTMLElement | null {
    return this.host.querySelector<HTMLElement>(`.pdf-page[data-page="${p}"]`);
  }

  add(o: Omit<PdfObj, 'id'>): PdfObj {
    const obj = { ...o, id: ++this.seq };
    this.objs.push(obj);
    this.draw(obj);
    this.select(obj.id);
    this.onChange?.();
    return obj;
  }
  remove(id: number): void {
    this.objs = this.objs.filter((o) => o.id !== id);
    this.host.querySelector(`[data-obj="${id}"]`)?.remove();
    if (this.active === id) this.active = null;
    this.onChange?.();
  }
  get(id: number | null): PdfObj | undefined {
    return this.objs.find((o) => o.id === id);
  }
  select(id: number | null): void {
    this.active = id;
    this.host.querySelectorAll('.pdf-obj').forEach((el) => el.classList.toggle('is-active', (el as HTMLElement).dataset.obj === String(id)));
    this.onChange?.();
  }
  /** Cập nhật thuộc tính rồi vẽ lại đối tượng */
  update(id: number, patch: Partial<PdfObj>): void {
    const o = this.get(id);
    if (!o) return;
    Object.assign(o, patch);
    if (o.kind === 'text') this.fitText(o);
    this.draw(o);
  }

  /** Ô chữ tự giãn theo nội dung */
  private fitText(o: PdfObj): void {
    const c = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    c.font = `${o.bold ? 700 : 400} ${o.size}px ${o.font ?? 'Arial, sans-serif'}`;
    const lines = (o.text ?? '').split('\n');
    o.w = Math.max(10, ...lines.map((l) => c.measureText(l || ' ').width)) + 4;
    o.h = lines.length * (o.size ?? 12) * 1.2 + 2;
  }

  draw(o: PdfObj): void {
    const pg = this.pageEl(o.page);
    if (!pg) return;
    let el = this.host.querySelector<HTMLElement>(`[data-obj="${o.id}"]`);
    if (!el) {
      el = document.createElement('div');
      el.className = 'pdf-obj';
      el.dataset.obj = String(o.id);
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'obj-del';
      del.textContent = '×';
      del.setAttribute('aria-label', t('lib.pdfedit.delete', 'Xoá'));
      del.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.remove(o.id); });
      const rs = document.createElement('span');
      rs.className = 'obj-resize';
      rs.dataset.resize = '1';
      if (o.kind === 'image') { const img = document.createElement('img'); img.alt = ''; el.appendChild(img); }
      if (o.kind === 'text') {
        const tx = document.createElement('div');
        tx.className = 'pdf-text';
        tx.contentEditable = 'plaintext-only';
        tx.spellcheck = false;
        tx.addEventListener('input', () => { o.text = tx.innerText.replace(/\n$/, ''); this.fitText(o); this.place(el as HTMLElement, o); this.onChange?.(); });
        tx.addEventListener('focus', () => this.select(o.id));
        el.appendChild(tx);
      }
      el.append(del, rs);
      pg.appendChild(el);
    }
    el.classList.toggle('is-box', o.kind === 'rect' && o.fill !== '#ffffff');
    el.classList.toggle('is-white', o.kind === 'rect' && o.fill === '#ffffff');
    if (o.kind === 'rect') el.style.background = o.fill ?? '#000';
    if (o.kind === 'image') (el.querySelector('img') as HTMLImageElement).src = o.src ?? '';
    if (o.kind === 'text') {
      const tx = el.querySelector<HTMLElement>('.pdf-text') as HTMLElement;
      if (document.activeElement !== tx) tx.innerText = o.text ?? '';
      Object.assign(tx.style, { fontSize: `${(o.size ?? 12) * this.scale}px`, color: o.color ?? '#000', fontWeight: o.bold ? '700' : '400', fontFamily: o.font ?? 'Arial, sans-serif' });
    }
    this.place(el, o);
  }
  private place(el: HTMLElement, o: PdfObj): void {
    const k = this.scale;
    Object.assign(el.style, { left: `${o.x * k}px`, top: `${o.y * k}px`, width: `${o.w * k}px`, height: `${o.h * k}px` });
  }

  private onDown(e: PointerEvent): void {
    const target = e.target as HTMLElement;
    const objEl = target.closest<HTMLElement>('.pdf-obj');
    const pageEl = target.closest<HTMLElement>('.pdf-page');
    if (!pageEl) return;
    const page = Number(pageEl.dataset.page);
    const rect = pageEl.getBoundingClientRect();
    const k = rect.width / this.sizes[page - 1].w;
    if (objEl) {
      const o = this.get(Number(objEl.dataset.obj));
      if (!o) return;
      this.select(o.id);
      // Đang gõ trong ô chữ: không kéo
      if (target.isContentEditable && !target.dataset.resize) return;
      e.preventDefault();
      const resizing = !!target.dataset.resize;
      const sx = e.clientX, sy = e.clientY;
      const o0 = { ...o };
      const ratio = o.w / o.h;
      const move = (ev: PointerEvent) => {
        const dx = (ev.clientX - sx) / k, dy = (ev.clientY - sy) / k;
        const pw = this.sizes[o.page - 1].w, ph = this.sizes[o.page - 1].h;
        if (resizing) {
          if (o.kind === 'text') {
            // Kéo góc ô chữ: đổi cỡ chữ theo chiều cao
            const nh = Math.max(6, o0.h + dy);
            o.size = Math.max(4, Math.round(((o0.size ?? 12) * nh) / o0.h));
            this.fitText(o);
          } else {
            o.w = Math.max(8, Math.min(pw - o.x, o0.w + dx));
            o.h = o.kind === 'image' && !ev.shiftKey ? o.w / ratio : Math.max(4, Math.min(ph - o.y, o0.h + dy));
          }
        } else {
          o.x = Math.max(0, Math.min(pw - o.w, o0.x + dx));
          o.y = Math.max(0, Math.min(ph - o.h, o0.y + dy));
        }
        this.draw(o);
      };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); this.onChange?.(); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      return;
    }
    // Bấm vào chỗ trống trên trang: đặt đối tượng mới (nếu đang chọn công cụ)
    this.select(null);
    if (!this.placer) return;
    const x = (e.clientX - rect.left) / k;
    const y = (e.clientY - rect.top) / k;
    const o = this.placer(page, x, y);
    if (!o) return;
    // Căn giữa vào điểm bấm, giữ trong trang
    const s = this.sizes[page - 1];
    o.x = Math.max(0, Math.min(s.w - o.w, o.x - o.w / 2));
    o.y = Math.max(0, Math.min(s.h - o.h, o.y - o.h / 2));
    const added = this.add(o);
    if (added.kind === 'text') {
      if (added.text === '') this.fitText(added);
      this.draw(added);
      // Đưa con trỏ vào ô chữ ngay để những phím gõ đầu tiên không bị mất
      const tx = this.host.querySelector<HTMLElement>(`[data-obj="${added.id}"] .pdf-text`);
      tx?.focus();
      setTimeout(() => { if (tx && document.activeElement !== tx) tx.focus(); }, 0);
    }
    e.preventDefault();
  }

  /** Vẽ ô chữ thành ảnh PNG nền trong suốt, độ phân giải cao */
  private async textPng(o: PdfObj): Promise<Uint8Array> {
    const k = 4;
    const c = document.createElement('canvas');
    c.width = Math.ceil(o.w * k);
    c.height = Math.ceil(o.h * k);
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    ctx.scale(k, k);
    ctx.fillStyle = o.color ?? '#000';
    ctx.textBaseline = 'top';
    ctx.font = `${o.bold ? 700 : 400} ${o.size}px ${o.font ?? 'Arial, sans-serif'}`;
    (o.text ?? '').split('\n').forEach((line, i) => ctx.fillText(line, 2, 1 + i * (o.size ?? 12) * 1.2 + (o.size ?? 12) * 0.08));
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
    return new Uint8Array(await (blob as Blob).arrayBuffer());
  }

  /**
   * Ghi các đối tượng vào PDF. prepare(doc) cho phép trang gọi xử lý thêm (điền form) trước khi lưu.
   */
  async export(prepare?: (doc: unknown, lib: unknown) => Promise<Record<string, unknown> | void> | Record<string, unknown> | void): Promise<Uint8Array> {
    if (!this.bytes) throw new Error('no file');
    const lib = await pdfLib() as unknown as {
      PDFDocument: { load(b: Uint8Array, o?: Record<string, unknown>): Promise<ExportDoc> };
      rgb(r: number, g: number, b: number): unknown;
      degrees(n: number): unknown;
    };
    let doc: ExportDoc;
    try {
      doc = await lib.PDFDocument.load(this.bytes, { ignoreEncryption: false });
    } catch (e) {
      if (/encrypt/i.test(String((e as Error).message))) throw new Error(t('lib.pdfedit.locked', 'File PDF bị khoá bằng mật khẩu hoặc hạn chế chỉnh sửa. Hãy mở khoá file trước.'));
      throw new Error(t('lib.pdfedit.unreadable', 'Không đọc được file PDF, file có thể bị hỏng.'));
    }
    const saveOpts = (await prepare?.(doc, lib)) || {};
    const pages = doc.getPages();
    const hex = (h: string) => { const n = parseInt(h.replace('#', ''), 16); return lib.rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };
    for (const o of [...this.objs, ...this.extra]) {
      const pg = pages[o.page - 1];
      if (!pg) continue;
      const { width: W, height: H } = pg.getSize();
      const rot = ((pg.getRotation().angle % 360) + 360) % 360;
      // Đổi toạ độ màn hình (gốc trên trái, đã xoay theo trang) sang toạ độ PDF gốc (dưới trái, chưa xoay)
      const box = toPdfBox(o, W, H, rot);
      if (o.kind === 'rect') {
        pg.drawRectangle({ x: box.x, y: box.y, width: box.w, height: box.h, color: hex(o.fill ?? '#000000'), borderWidth: 0 });
        continue;
      }
      const png = o.kind === 'text' ? await this.textPng(o) : dataUrlBytes(o.src ?? '');
      const img = o.kind === 'image' && /^data:image\/jpe?g/.test(o.src ?? '') ? await doc.embedJpg(png) : await doc.embedPng(png);
      pg.drawImage(img, { x: box.ax, y: box.ay, width: box.dw, height: box.dh, rotate: lib.degrees(rot) });
    }
    return doc.save({ useObjectStreams: true, ...saveOpts });
  }
}

interface ExportPage {
  getSize(): { width: number; height: number };
  getRotation(): { angle: number };
  drawImage(img: unknown, o: Record<string, unknown>): void;
  drawRectangle(o: Record<string, unknown>): void;
}
interface ExportDoc {
  getPages(): ExportPage[];
  embedPng(b: Uint8Array): Promise<unknown>;
  embedJpg(b: Uint8Array): Promise<unknown>;
  save(o?: Record<string, unknown>): Promise<Uint8Array>;
}

function dataUrlBytes(url: string): Uint8Array {
  const b64 = url.split(',')[1] ?? '';
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/**
 * Trang có thuộc tính /Rotate: pdf.js hiển thị đã xoay theo chiều kim đồng hồ.
 * Theo phép biến đổi của pdf.js (tỉ lệ 1): xoay 0: (dx, dy) = (x, H − y); 90: (y, x); 180: (W − x, y); 270: (H − y, W − x).
 * Trả về khung chữ nhật trong hệ toạ độ PDF gốc (cho ô màu) và điểm neo + kích thước cho ảnh vẽ xoay
 * (pdf-lib xoay ảnh ngược chiều kim đồng hồ quanh góc dưới trái của ảnh).
 */
function toPdfBox(o: PdfObj, W: number, H: number, rot: number): { x: number; y: number; w: number; h: number; ax: number; ay: number; dw: number; dh: number } {
  const base = { dw: o.w, dh: o.h };
  switch (rot) {
    case 90: return { ...base, x: o.y, y: o.x, w: o.h, h: o.w, ax: o.y + o.h, ay: o.x };
    case 180: return { ...base, x: W - o.x - o.w, y: o.y, w: o.w, h: o.h, ax: W - o.x, ay: o.y + o.h };
    case 270: return { ...base, x: W - o.y - o.h, y: H - o.x - o.w, w: o.h, h: o.w, ax: W - o.y - o.h, ay: H - o.x };
    default: return { ...base, x: o.x, y: H - o.y - o.h, w: o.w, h: o.h, ax: o.x, ay: H - o.y - o.h };
  }
}
