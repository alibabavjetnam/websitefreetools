/** Vẽ một slide (mô hình từ pptx.ts) lên canvas. Đơn vị trong mô hình là point (1/72 inch). */
import type { Box, Para, Presentation, Run, Slide, SlideItem, TextBody } from './pptx';

export type ImageLoader = (path: string) => Promise<CanvasImageSource | null>;

/** Phông dự phòng có đủ dấu tiếng Việt khi máy không có phông gốc của file */
const FALLBACK = "'Be Vietnam Pro', 'Segoe UI', Arial, sans-serif";
const fontCss = (r: Run, scale: number) =>
  `${r.italic ? 'italic ' : ''}${r.bold ? '700 ' : '400 '}${Math.max(1, r.size * scale)}px ${JSON.stringify(r.font)}, ${FALLBACK}`;

interface Piece { text: string; run: Run; width: number }

/** Lề trái của chữ theo cấp; có dấu đầu dòng thì chừa chỗ treo cho dấu (gần với mặc định PowerPoint) */
const textIndent = (p: Para) => p.level * 36 + (p.bullet ? Math.max(18, (p.runs[0]?.size ?? 18) * 0.85) : 0);
interface Line { pieces: Piece[]; width: number; height: number; ascent: number; para: Para; first: boolean }

/** Xếp chữ thành các dòng vừa chiều rộng khung (ngắt theo từ, từ quá dài thì ngắt theo ký tự) */
function layoutText(ctx: CanvasRenderingContext2D, body: TextBody, maxW: number, scale: number): Line[] {
  const lines: Line[] = [];
  for (const para of body.paras) {
    const indent = textIndent(para) * scale;
    const width = Math.max(10, maxW - indent);
    let cur: Piece[] = [];
    let curW = 0;
    let first = true;
    const maxSize = (ps: Piece[]) => Math.max(...ps.map((p) => p.run.size), para.runs[0]?.size ?? 18) * scale;
    const push = () => {
      const size = maxSize(cur.length ? cur : [{ text: '', run: para.runs[0], width: 0 }]);
      lines.push({ pieces: cur, width: curW, height: size * 1.2 * para.lineSpacing, ascent: size * 0.9, para, first });
      cur = [];
      curW = 0;
      first = false;
    };
    for (const run of para.runs) {
      ctx.font = fontCss(run, scale);
      for (const chunk of run.text.split(/(\n)/)) {
        if (chunk === '\n') { push(); continue; }
        for (const word of chunk.split(/(\s+)/).filter((w) => w !== '')) {
          let w = ctx.measureText(word).width;
          if (curW + w > width && cur.length && !/^\s+$/.test(word)) push();
          if (/^\s+$/.test(word) && !cur.length) continue; // khoảng trắng đầu dòng
          if (w > width) {
            // Từ dài hơn cả dòng: ngắt theo ký tự
            let part = '';
            for (const ch of word) {
              const pw = ctx.measureText(part + ch).width;
              if (curW + pw > width && (part || cur.length)) {
                if (part) cur.push({ text: part, run, width: ctx.measureText(part).width });
                curW += part ? ctx.measureText(part).width : 0;
                push();
                part = ch;
              } else part += ch;
            }
            w = ctx.measureText(part).width;
            if (part) { cur.push({ text: part, run, width: w }); curW += w; }
            continue;
          }
          cur.push({ text: word, run, width: w });
          curW += w;
        }
      }
    }
    push();
  }
  return lines;
}

function drawText(ctx: CanvasRenderingContext2D, body: TextBody, b: { x: number; y: number; w: number; h: number }, scale: number): void {
  const [t, r, bt, l] = body.inset.map((v) => v * scale);
  const innerW = b.w - l - r;
  const innerH = b.h - t - bt;
  if (innerW <= 2) return;
  // Chữ tràn khung: tự thu nhỏ (giống "Shrink text on overflow") tối đa 50%
  let s = scale;
  let lines = layoutText(ctx, body, innerW, s);
  const total = (ls: Line[]) => ls.reduce((a, x) => a + x.height + (x.first ? x.para.spaceBefore * s : 0), 0);
  for (let k = 0; k < 10 && total(lines) > innerH * 1.02 && s > scale * 0.5; k++) {
    s *= 0.92;
    lines = layoutText(ctx, body, innerW, s);
  }
  const h = total(lines);
  let y = b.y + t + (body.anchor === 'ctr' ? (innerH - h) / 2 : body.anchor === 'b' ? innerH - h : 0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(b.x, b.y - 2, b.w, b.h + 4); // cắt chữ tràn quá xa khung
  ctx.clip();
  for (const line of lines) {
    if (line.first) y += line.para.spaceBefore * s;
    const indent = textIndent(line.para) * s;
    const avail = innerW - indent;
    let x = b.x + l + indent;
    if (line.para.align === 'ctr') x += (avail - line.width) / 2;
    else if (line.para.align === 'r') x += avail - line.width;
    const baseline = y + line.ascent;
    if (line.first && line.para.bullet && line.pieces.length) {
      const r0 = line.pieces[0].run;
      ctx.font = fontCss(r0, s);
      ctx.fillStyle = r0.color;
      ctx.fillText(line.para.bullet, b.x + l + line.para.level * 36 * s, baseline);
    }
    for (const p of line.pieces) {
      ctx.font = fontCss(p.run, s);
      ctx.fillStyle = p.run.color;
      ctx.fillText(p.text, x, baseline);
      if (p.run.underline) ctx.fillRect(x, baseline + p.run.size * s * 0.1, p.width, Math.max(1, p.run.size * s * 0.05));
      x += p.width;
    }
    y += line.height;
  }
  ctx.restore();
}

function pathFor(ctx: CanvasRenderingContext2D, geom: string, w: number, h: number): void {
  ctx.beginPath();
  if (geom === 'ellipse') ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (geom === 'roundRect') {
    const r = Math.min(w, h) * 0.1667;
    ctx.roundRect(0, 0, w, h, r);
  } else if (geom === 'triangle') { ctx.moveTo(w / 2, 0); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); }
  else if (geom === 'line' || geom === 'straightConnector1') { ctx.moveTo(0, 0); ctx.lineTo(w, h); }
  else if (geom === 'diamond') { ctx.moveTo(w / 2, 0); ctx.lineTo(w, h / 2); ctx.lineTo(w / 2, h); ctx.lineTo(0, h / 2); ctx.closePath(); }
  else if (geom === 'rightArrow') {
    ctx.moveTo(0, h * 0.25); ctx.lineTo(w * 0.7, h * 0.25); ctx.lineTo(w * 0.7, 0); ctx.lineTo(w, h / 2);
    ctx.lineTo(w * 0.7, h); ctx.lineTo(w * 0.7, h * 0.75); ctx.lineTo(0, h * 0.75); ctx.closePath();
  } else ctx.rect(0, 0, w, h);
}

/** Đặt hệ toạ độ theo khung (xoay, lật quanh tâm) rồi gọi hàm vẽ với gốc ở góc trên trái khung */
function withBox(ctx: CanvasRenderingContext2D, box: Box, scale: number, fn: (w: number, h: number) => void): void {
  const x = box.x * scale, y = box.y * scale, w = box.w * scale, h = box.h * scale;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  if (box.rot) ctx.rotate((box.rot * Math.PI) / 180);
  ctx.scale(box.flipH ? -1 : 1, box.flipV ? -1 : 1);
  ctx.translate(-w / 2, -h / 2);
  fn(w, h);
  ctx.restore();
}

async function drawItem(ctx: CanvasRenderingContext2D, it: SlideItem, scale: number, loadImage: ImageLoader): Promise<void> {
  if (it.kind === 'shape') {
    withBox(ctx, it.box, scale, (w, h) => {
      if (it.fill || it.line) {
        pathFor(ctx, it.geom, w, h);
        if (it.fill && it.geom !== 'line' && it.geom !== 'straightConnector1') { ctx.fillStyle = it.fill; ctx.fill(); }
        if (it.line) { ctx.strokeStyle = it.line.color; ctx.lineWidth = Math.max(0.5, it.line.width * scale); ctx.stroke(); }
      }
    });
    // Chữ không lật theo hình để không bị ngược
    if (it.text) withBox(ctx, { ...it.box, flipH: false, flipV: false }, scale, (w, h) => drawText(ctx, it.text!, { x: 0, y: 0, w, h }, scale));
  } else if (it.kind === 'image') {
    const img = await loadImage(it.path);
    if (img) withBox(ctx, it.box, scale, (w, h) => ctx.drawImage(img, 0, 0, w, h));
  } else if (it.kind === 'table') {
    let y = it.box.y;
    for (const row of it.rows) {
      let x = it.box.x;
      let col = 0;
      for (const cell of row.cells) {
        const w = it.cols.slice(col, col + cell.span).reduce((a, b) => a + b, 0);
        const box: Box = { x, y, w, h: row.h, rot: 0, flipH: false, flipV: false };
        withBox(ctx, box, scale, (cw, ch) => {
          if (cell.fill) { ctx.fillStyle = cell.fill; ctx.fillRect(0, 0, cw, ch); }
          ctx.strokeStyle = it.border;
          ctx.lineWidth = Math.max(0.5, scale * 0.75);
          ctx.strokeRect(0, 0, cw, ch);
          drawText(ctx, cell.text, { x: 0, y: 0, w: cw, h: ch }, scale);
        });
        x += w;
        col += cell.span;
      }
      y += row.h;
    }
  } else {
    withBox(ctx, it.box, scale, (w, h) => {
      ctx.fillStyle = '#f1f3f6';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#b9c2ce';
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(0, 0, w, h);
      ctx.setLineDash([]);
      ctx.fillStyle = '#5b6779';
      ctx.font = `${Math.max(10, 14 * scale)}px ${FALLBACK}`;
      ctx.textAlign = 'center';
      ctx.fillText(`${it.label} (chưa hỗ trợ)`, w / 2, h / 2);
      ctx.textAlign = 'left';
    });
  }
}

/** Vẽ slide ra canvas mới có chiều rộng pxWidth */
export async function renderSlide(pres: Presentation, slide: Slide, pxWidth: number, loadImage: ImageLoader): Promise<HTMLCanvasElement> {
  const scale = pxWidth / pres.width;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(pres.width * scale);
  canvas.height = Math.round(pres.height * scale);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = slide.background.color ?? '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (slide.background.image) {
    const img = await loadImage(slide.background.image);
    if (img) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
  ctx.textBaseline = 'alphabetic';
  for (const it of slide.items) await drawItem(ctx, it, scale, loadImage);
  return canvas;
}
