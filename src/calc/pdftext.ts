/** Ghép các mẩu chữ pdf.js (có toạ độ) thành dòng và đoạn văn. Hàm thuần, kiểm thử riêng được. */

export interface TextPiece { str: string; x: number; y: number; w: number; size: number }
export interface Para { text: string; size: number; heading: boolean; align: 'left' | 'center' | 'right' }
export interface Line { text: string; y: number; x0: number; x1: number; size: number }

/** Độ rộng tương đối của ký tự (gần đúng kiểu chữ có chân/không chân thông dụng), dùng khi không đo được */
function defaultWidth(ch: string): number {
  if (/[\s.,:;'|!ilj]/.test(ch)) return 0.28;
  if (/[ftrI()[\]-]/.test(ch)) return 0.36;
  if (/[mwMW]/.test(ch)) return 0.86;
  if (/\p{Lu}/u.test(ch)) return 0.68;
  if (/\d/.test(ch)) return 0.5;
  return 0.5;
}

interface Ch { ch: string; x0: number; x1: number }

/**
 * Gom mẩu chữ thành dòng, giữ thứ tự gốc trong file.
 * Nhiều trình tạo PDF (LibreOffice, một số máy in ảo) vẽ chữ có dấu tiếng Việt ở lượt thứ hai, chồng lên
 * chỗ trống đã chừa sẵn trong chuỗi; các mẩu "vẽ lùi" như vậy được đặt lại đúng vị trí theo toạ độ x.
 */
export function toLines(pieces: TextPiece[], measure: (s: string) => number[] = (s) => [...s].map(defaultWidth)): Line[] {
  const groups: { items: TextPiece[]; y: number; size: number }[] = [];
  for (const raw of pieces) {
    const str = raw.str.replace(/[\u0000-\u0008\u000b-\u001f\u007f�]/g, '');
    if (!str) continue;
    const it = { ...raw, str };
    const g = groups.find((l) => Math.abs(l.y - it.y) < Math.max(2, Math.min(l.size, it.size) * 0.45));
    if (g) { g.items.push(it); g.size = Math.max(g.size, it.size); }
    else groups.push({ items: [it], y: it.y, size: it.size });
  }
  const lines: Line[] = [];
  for (const g of groups) {
    const chars: Ch[] = [];
    let maxEnd = -Infinity;
    const overlays: TextPiece[] = [];
    for (const it of g.items) {
      const blank = !it.str.trim();
      if (chars.length && it.x < maxEnd - it.size * 0.3) {
        if (!blank) overlays.push(it);
        continue; // mẩu khoảng trắng chèn lùi chỉ để căn vị trí: bỏ qua
      }
      // Khoảng cách với mẩu trước: thêm dấu cách (hoặc tab nếu xa)
      const gap = it.x - maxEnd;
      const last = chars[chars.length - 1];
      if (last && gap > it.size * 0.18 && last.ch !== ' ' && !/^\s/.test(it.str)) chars.push({ ch: gap > it.size * 2.5 ? '\t' : ' ', x0: maxEnd, x1: it.x });
      const ws = measure(it.str);
      const total = ws.reduce((a, b) => a + b, 0) || 1;
      let x = it.x;
      [...it.str].forEach((ch, i) => {
        const w = (ws[i] / total) * it.w;
        chars.push({ ch, x0: x, x1: x + w });
        x += w;
      });
      maxEnd = Math.max(maxEnd, it.x + it.w);
    }
    // Đặt các ký tự vẽ chồng vào ô trống gần nhất
    for (const o of overlays) {
      const ws = measure(o.str);
      const total = ws.reduce((a, b) => a + b, 0) || 1;
      let x = o.x;
      [...o.str].forEach((ch, i) => {
        const w = (ws[i] / total) * o.w;
        const cx = x + w / 2;
        x += w;
        if (!ch.trim()) return;
        let best = -1;
        let bestD = Infinity;
        chars.forEach((c, j) => {
          if (c.ch !== ' ' && c.ch !== ' ') return;
          const d = Math.abs((c.x0 + c.x1) / 2 - cx);
          if (d < bestD) { bestD = d; best = j; }
        });
        if (best >= 0 && bestD < o.size * 0.9) {
          const sp = chars[best];
          const glyph = { ch, x0: cx - w / 2, x1: cx + w / 2 };
          // Ô trống rộng hơn hẳn ký tự: phần dư là dấu cách thật giữa hai từ, giữ lại
          const restAfter = sp.x1 - glyph.x1;
          const restBefore = glyph.x0 - sp.x0;
          const extra: Ch[] = [];
          if (restBefore > o.size * 0.15) extra.push({ ch: ' ', x0: sp.x0, x1: glyph.x0 });
          extra.push(glyph);
          if (restAfter > o.size * 0.15) extra.push({ ch: ' ', x0: glyph.x1, x1: sp.x1 });
          chars.splice(best, 1, ...extra);
        }
        else {
          const at = chars.findIndex((c) => (c.x0 + c.x1) / 2 > cx);
          chars.splice(at < 0 ? chars.length : at, 0, { ch, x0: cx - w / 2, x1: cx + w / 2 });
        }
      });
    }
    const text = chars.map((c) => c.ch).join('').normalize('NFC').replace(/ {2,}/g, ' ').replace(/\s+$/, '');
    if (!text.trim()) continue;
    lines.push({ text, y: g.y, x0: chars[0].x0, x1: Math.max(maxEnd, ...chars.map((c) => c.x1)), size: g.size });
  }
  return lines.sort((a, b) => b.y - a.y);
}

/** Gom dòng thành đoạn: khoảng cách dọc lớn, đổi cỡ chữ hoặc dòng trước kết thúc ngắn → đoạn mới */
export function toParagraphs(lines: Line[], pageWidth: number, bodySize: number): Para[] {
  const out: Para[] = [];
  let cur: Line[] | null = null;
  const flush = () => {
    if (!cur) return;
    const ls = cur;
    let text = '';
    for (const l of ls) {
      if (!text) text = l.text;
      else if (/[-‐]$/.test(text) && /^\p{Ll}/u.test(l.text)) text = text.slice(0, -1) + l.text; // nối từ bị ngắt bằng gạch nối
      else text += ' ' + l.text;
    }
    const size = Math.max(...ls.map((l) => l.size));
    const mid = (ls[0].x0 + ls[0].x1) / 2;
    const centered = ls.length <= 3 && Math.abs(mid - pageWidth / 2) < pageWidth * 0.06 && ls[0].x0 > pageWidth * 0.15;
    const right = !centered && ls.length <= 2 && ls[0].x0 > pageWidth * 0.5;
    out.push({ text, size, heading: size >= bodySize * 1.25 && text.length < 160, align: centered ? 'center' : right ? 'right' : 'left' });
    cur = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const prev = lines[i - 1];
    if (!cur || !prev) { flush(); cur = [l]; continue; }
    const gap = prev.y - l.y;
    const lh = Math.max(prev.size, l.size) * 1.25;
    const sizeChange = Math.abs(prev.size - l.size) > Math.max(1, bodySize * 0.12);
    const shortPrev = prev.x1 < pageWidth * 0.62 && /[.!?:;。]$/.test(prev.text);
    const bullet = /^([•\-–*·●▪]|\d+[.)]|[a-z][.)])\s/.test(l.text);
    if (gap > lh * 1.45 || sizeChange || shortPrev || bullet || gap < 0) { flush(); cur = [l]; }
    else cur.push(l);
  }
  flush();
  return out;
}

/** Cỡ chữ thân bài = cỡ xuất hiện nhiều nhất (tính theo số ký tự) */
export function bodyFontSize(pieces: TextPiece[]): number {
  const count = new Map<number, number>();
  for (const p of pieces) { const k = Math.round(p.size * 2) / 2; count.set(k, (count.get(k) ?? 0) + p.str.length); }
  let best = 11, n = -1;
  for (const [k, v] of count) if (v > n) { best = k; n = v; }
  return best;
}
