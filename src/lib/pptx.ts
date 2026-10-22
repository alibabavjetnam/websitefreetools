/**
 * Đọc file PowerPoint (.pptx) thành mô hình slide đơn giản để vẽ lại: khung chữ, hình khối, ảnh, bảng, nền.
 * Kế thừa vị trí và kiểu chữ từ layout/master, màu theo theme. Biểu đồ, SmartArt, hiệu ứng chưa được hỗ trợ.
 */
import { attr, child, childrenNamed, elements, localName, parseXml, type XmlElement } from './xml';
import { t } from '../i18n';

export const EMU_PER_PT = 12700;

export interface Run { text: string; size: number; bold: boolean; italic: boolean; underline: boolean; color: string; font: string }
export interface Para { runs: Run[]; align: 'l' | 'ctr' | 'r' | 'just'; level: number; bullet: string | null; spaceBefore: number; lineSpacing: number }
export interface Box { x: number; y: number; w: number; h: number; rot: number; flipH: boolean; flipV: boolean }
export interface TextBody { paras: Para[]; anchor: 't' | 'ctr' | 'b'; inset: [number, number, number, number]; autofitScale: number; vertical: boolean }

export type SlideItem =
  | { kind: 'shape'; box: Box; geom: string; fill: string | null; line: { color: string; width: number } | null; text: TextBody | null }
  | { kind: 'image'; box: Box; path: string }
  | { kind: 'table'; box: Box; cols: number[]; rows: { h: number; cells: { text: TextBody; fill: string | null; span: number }[] }[]; border: string }
  | { kind: 'unsupported'; box: Box; label: string };

export interface Slide { index: number; background: { color: string | null; image: string | null }; items: SlideItem[] }
export interface Presentation { width: number; height: number; slides: Slide[] }

/** Nguồn đọc file trong gói .pptx (đọc chuỗi XML theo đường dẫn) */
export interface PackageReader { text(path: string): Promise<string | null> }

/* ---------- Đường dẫn và quan hệ ---------- */

function resolvePath(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/').slice(0, -1);
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

async function relsOf(pkg: PackageReader, path: string): Promise<Map<string, { target: string; type: string }>> {
  const relsPath = path.replace(/([^/]+)$/, '_rels/$1.rels');
  const xml = await pkg.text(relsPath);
  const map = new Map<string, { target: string; type: string }>();
  if (!xml) return map;
  for (const r of elements(parseXml(xml))) {
    if (r.attrs.TargetMode === 'External') continue;
    map.set(r.attrs.Id, { target: resolvePath(path, r.attrs.Target), type: r.attrs.Type ?? '' });
  }
  return map;
}

/* ---------- Màu ---------- */

interface Theme { colors: Record<string, string>; majorFont: string; minorFont: string }

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(0, 2), 16) / 255, g = parseInt(hex.slice(2, 4), 16) / 255, b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255).toString(16).padStart(2, '0');
  };
  return f(0) + f(8) + f(4);
}

/** Đọc màu từ phần tử chứa (solidFill, fillRef…), áp lumMod/lumOff/tint/shade; trả về "#rrggbb" */
function readColor(holder: XmlElement | undefined, theme: Theme, clrMap: Record<string, string>): string | null {
  if (!holder) return null;
  const c = elements(holder).find((e) => /Clr$/.test(localName(e.name)));
  if (!c) return null;
  const kind = localName(c.name);
  let hex: string | null = null;
  const val = c.attrs.val;
  if (kind === 'srgbClr') hex = val;
  else if (kind === 'schemeClr') hex = theme.colors[clrMap[val] ?? val] ?? null;
  else if (kind === 'sysClr') hex = c.attrs.lastClr ?? (val === 'window' ? 'FFFFFF' : '000000');
  else if (kind === 'prstClr') hex = ({ black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF', yellow: 'FFFF00', gray: '808080' } as Record<string, string>)[val] ?? null;
  if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return null;
  for (const m of elements(c)) hex = applyMod(hex, localName(m.name), Number(m.attrs.val) / 100000);
  return `#${hex}`;
}

/* Office tính tint/shade trên RGB tuyến tính (không phải HSL) nên phải đổi qua lại sRGB */
const toLin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toSrgb = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function applyMod(hex: string, mod: string, v: number): string {
  if (mod === 'tint' || mod === 'shade') {
    return [0, 2, 4]
      .map((i) => {
        const lin = toLin(parseInt(hex.slice(i, i + 2), 16) / 255);
        const out = mod === 'tint' ? lin * v + (1 - v) : lin * v;
        return Math.round(clamp01(toSrgb(clamp01(out))) * 255).toString(16).padStart(2, '0');
      })
      .join('');
  }
  if (mod !== 'lumMod' && mod !== 'lumOff') return hex;
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, clamp01(mod === 'lumMod' ? l * v : l + v));
}

/** Mã các kiểu bảng "Medium Style 2" dựng sẵn của Office và màu accent của chúng */
const TABLE_STYLE_ACCENT: Record<string, string> = {
  '{073A0DAA-6AF3-43AB-8588-CEC1D06C72B9}': 'dk1',
  '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}': 'accent1',
  '{21E4AEA4-8DFA-4A89-87EB-49C32662AFE8}': 'accent2',
  '{F5AB1C69-6EDB-4FF4-983F-18BD219EF322}': 'accent3',
  '{00A15C55-8517-42AA-B614-E9B94910E393}': 'accent4',
  '{7DF18680-E054-41AD-8BC1-D1AEF772440D}': 'accent5',
  '{93296810-A885-4BE3-A3E7-6D5BEEA58F35}': 'accent6',
};

/* ---------- Kế thừa từ layout / master ---------- */

interface PhInfo { type: string; idx: string }

const phOf = (sp: XmlElement): PhInfo | null => {
  const nv = elements(sp).find((e) => /^nv/.test(localName(e.name)));
  const ph = child(child(nv, 'nvPr'), 'ph');
  return ph ? { type: ph.attrs.type ?? 'body', idx: ph.attrs.idx ?? '' } : null;
};

function findPlaceholder(tree: XmlElement | undefined, ph: PhInfo): XmlElement | undefined {
  if (!tree) return undefined;
  const shapes = childrenNamed(tree, 'sp');
  const norm = (t: string) => (t === 'ctrTitle' ? 'title' : t === 'subTitle' || t === 'obj' ? 'body' : t);
  return (
    (ph.idx && shapes.find((s) => phOf(s)?.idx === ph.idx)) ||
    shapes.find((s) => phOf(s)?.type === ph.type) ||
    shapes.find((s) => norm(phOf(s)?.type ?? '') === norm(ph.type))
  ) || undefined;
}

interface Context {
  theme: Theme;
  clrMap: Record<string, string>;
  layoutTree?: XmlElement;
  masterTree?: XmlElement;
  masterTxStyles?: XmlElement;
  rels: Map<string, { target: string; type: string }>;
}

/* ---------- Văn bản ---------- */

interface LevelStyle { size?: number; bold?: boolean; italic?: boolean; color?: string; font?: string; align?: Para['align']; bullet?: string | null }

function levelStyle(lstStyle: XmlElement | undefined, level: number, ctx: Context): LevelStyle {
  const pPr = child(lstStyle, `lvl${level + 1}pPr`);
  if (!pPr) return {};
  const def = child(pPr, 'defRPr');
  const out: LevelStyle = {};
  if (def?.attrs.sz) out.size = Number(def.attrs.sz) / 100;
  if (def?.attrs.b) out.bold = def.attrs.b === '1';
  if (def?.attrs.i) out.italic = def.attrs.i === '1';
  const col = readColor(child(def, 'solidFill'), ctx.theme, ctx.clrMap);
  if (col) out.color = col;
  const latin = child(def, 'latin')?.attrs.typeface;
  if (latin) out.font = latin;
  if (pPr.attrs.algn) out.align = pPr.attrs.algn as Para['align'];
  if (child(pPr, 'buNone')) out.bullet = null;
  else if (child(pPr, 'buChar')) out.bullet = child(pPr, 'buChar')!.attrs.char ?? '•';
  else if (child(pPr, 'buAutoNum')) out.bullet = '•';
  return out;
}

function fontName(face: string | undefined, theme: Theme): string {
  if (!face) return theme.minorFont;
  if (face.startsWith('+mj')) return theme.majorFont;
  if (face.startsWith('+mn')) return theme.minorFont;
  return face;
}

/** Ghép kiểu theo thứ tự ưu tiên: mặc định master -> master placeholder -> layout placeholder -> chính shape */
function readTextBody(txBody: XmlElement, chain: (XmlElement | undefined)[], phType: string | null, ctx: Context, baseColor: string | null = null): TextBody {
  const bodyPrs = [child(txBody, 'bodyPr'), ...chain.map((c) => child(child(c, 'txBody'), 'bodyPr'))];
  const pick = (k: string) => bodyPrs.find((b) => b?.attrs[k] !== undefined)?.attrs[k];
  const anchor = (pick('anchor') ?? (phType === 'title' || phType === 'ctrTitle' ? 'ctr' : 't')) as TextBody['anchor'];
  const ins = (k: string, d: number) => Number(pick(k) ?? d) / EMU_PER_PT;
  const fit = child(child(txBody, 'bodyPr'), 'normAutofit');
  const autofitScale = fit?.attrs.fontScale ? Number(fit.attrs.fontScale) / 100000 : 1;
  const vertical = /vert/.test(pick('vert') ?? 'horz') && pick('vert') !== 'horz';

  const masterStyle = phType === 'title' || phType === 'ctrTitle' ? 'titleStyle' : phType && phType !== 'sldNum' && phType !== 'dt' && phType !== 'ftr' ? 'bodyStyle' : 'otherStyle';
  const styleSources = [
    child(ctx.masterTxStyles, masterStyle),
    ...chain.slice().reverse().map((c) => child(child(c, 'txBody'), 'lstStyle')),
    child(txBody, 'lstStyle'),
  ];

  const paras: Para[] = childrenNamed(txBody, 'p').map((p) => {
    const pPr = child(p, 'pPr');
    const level = Number(pPr?.attrs.lvl ?? 0);
    const tx1 = ctx.theme.colors[ctx.clrMap.tx1 ?? 'dk1'];
    const st: LevelStyle = { size: 18, bold: false, italic: false, color: baseColor ?? (tx1 ? `#${tx1}` : '#000000'), bullet: null, align: 'l' };
    for (const [k, src] of styleSources.entries()) {
      const ls = levelStyle(src, level, ctx);
      // Màu mặc định của master không đè lên màu fontRef của hình vẽ thường
      if (k === 0 && baseColor) delete ls.color;
      Object.assign(st, Object.fromEntries(Object.entries(ls).filter(([, v]) => v !== undefined)));
    }
    // Kiểu riêng của đoạn
    const own = levelStyle(pPr ? ({ name: 'x', attrs: {}, children: [{ ...pPr, name: 'a:lvl1pPr' }] } as XmlElement) : undefined, 0, ctx);
    const align = (pPr?.attrs.algn as Para['align']) ?? st.align ?? 'l';
    let bullet = st.bullet ?? null;
    if (own.bullet !== undefined) bullet = own.bullet;
    const endSize = child(p, 'endParaRPr')?.attrs.sz;
    const runs: Run[] = [];
    for (const r of elements(p)) {
      const n = localName(r.name);
      if (n !== 'r' && n !== 'fld' && n !== 'br') continue;
      const rPr = child(r, 'rPr');
      const text = n === 'br' ? '\n' : (child(r, 't')?.children.filter((x): x is string => typeof x === 'string').join('') ?? '');
      runs.push({
        text,
        size: (rPr?.attrs.sz ? Number(rPr.attrs.sz) / 100 : st.size ?? 18) * autofitScale,
        bold: rPr?.attrs.b ? rPr.attrs.b === '1' : !!st.bold,
        italic: rPr?.attrs.i ? rPr.attrs.i === '1' : !!st.italic,
        underline: !!rPr?.attrs.u && rPr.attrs.u !== 'none',
        color: readColor(child(rPr, 'solidFill'), ctx.theme, ctx.clrMap) ?? st.color ?? '#000000',
        font: fontName(child(rPr, 'latin')?.attrs.typeface ?? st.font, ctx.theme),
      });
    }
    if (!runs.length) runs.push({ text: '', size: (endSize ? Number(endSize) / 100 : st.size ?? 18) * autofitScale, bold: false, italic: false, underline: false, color: st.color ?? '#000000', font: fontName(st.font, ctx.theme) });
    const lnSpc = Number(child(child(pPr, 'lnSpc'), 'spcPct')?.attrs.val ?? 100000) / 100000;
    const spcBef = Number(child(child(pPr, 'spcBef'), 'spcPts')?.attrs.val ?? 0) / 100;
    const hasText = runs.some((r) => r.text.trim());
    return { runs, align, level, bullet: hasText ? bullet : null, spaceBefore: spcBef, lineSpacing: lnSpc };
  });

  return { paras, anchor: anchor === 'ctr' || anchor === 'b' ? anchor : 't', inset: [ins('tIns', 45720), ins('rIns', 91440), ins('bIns', 45720), ins('lIns', 91440)], autofitScale, vertical };
}

/* ---------- Hình ---------- */

function readXfrm(xfrm: XmlElement | undefined): Box | null {
  const off = child(xfrm, 'off');
  const ext = child(xfrm, 'ext');
  if (!off || !ext) return null;
  return {
    x: Number(off.attrs.x) / EMU_PER_PT, y: Number(off.attrs.y) / EMU_PER_PT,
    w: Number(ext.attrs.cx) / EMU_PER_PT, h: Number(ext.attrs.cy) / EMU_PER_PT,
    rot: Number(xfrm!.attrs.rot ?? 0) / 60000, flipH: xfrm!.attrs.flipH === '1', flipV: xfrm!.attrs.flipV === '1',
  };
}

/** Biến đổi toạ độ con của nhóm hình sang toạ độ slide */
interface GroupMap { ox: number; oy: number; sx: number; sy: number; cx: number; cy: number }
const applyGroup = (b: Box, g: GroupMap | null): Box =>
  g ? { ...b, x: g.ox + (b.x - g.cx) * g.sx, y: g.oy + (b.y - g.cy) * g.sy, w: b.w * g.sx, h: b.h * g.sy } : b;

function readShape(sp: XmlElement, ctx: Context, group: GroupMap | null): SlideItem | null {
  const ph = phOf(sp);
  const layoutPh = ph ? findPlaceholder(child(ctx.layoutTree, 'spTree') ?? ctx.layoutTree, ph) : undefined;
  const masterPh = ph ? findPlaceholder(child(ctx.masterTree, 'spTree') ?? ctx.masterTree, ph) : undefined;
  // Placeholder ngày, chân trang, số trang chỉ hiện khi slide có khung riêng
  const spPr = child(sp, 'spPr');
  const box =
    readXfrm(child(spPr, 'xfrm')) ??
    readXfrm(child(child(layoutPh, 'spPr'), 'xfrm')) ??
    readXfrm(child(child(masterPh, 'spPr'), 'xfrm'));
  if (!box) return null;

  const style = child(sp, 'style');
  let fill: string | null = null;
  if (child(spPr, 'noFill')) fill = null;
  else if (child(spPr, 'solidFill')) fill = readColor(child(spPr, 'solidFill'), ctx.theme, ctx.clrMap);
  else if (child(spPr, 'gradFill')) {
    const stop = child(child(child(spPr, 'gradFill'), 'gsLst'), 'gs');
    fill = readColor(stop, ctx.theme, ctx.clrMap); // gradient: lấy màu điểm đầu
  } else if (style && Number(child(style, 'fillRef')?.attrs.idx ?? 0) > 0) fill = readColor(child(style, 'fillRef'), ctx.theme, ctx.clrMap);

  const ln = child(spPr, 'ln');
  let line: { color: string; width: number } | null = null;
  if (ln && !child(ln, 'noFill')) {
    const color = readColor(child(ln, 'solidFill'), ctx.theme, ctx.clrMap) ?? (style ? readColor(child(style, 'lnRef'), ctx.theme, ctx.clrMap) : null);
    if (color) line = { color, width: Number(ln.attrs.w ?? 12700) / EMU_PER_PT };
  } else if (!ln && style && Number(child(style, 'lnRef')?.attrs.idx ?? 0) > 0) {
    const color = readColor(child(style, 'lnRef'), ctx.theme, ctx.clrMap);
    if (color) line = { color, width: 1 };
  }

  const txBody = child(sp, 'txBody');
  // Hình vẽ thường (không phải placeholder) lấy màu chữ mặc định từ style của hình (fontRef)
  const fontRefColor = style ? readColor(child(style, 'fontRef'), ctx.theme, ctx.clrMap) : null;
  const text = txBody ? readTextBody(txBody, [layoutPh, masterPh], ph?.type ?? null, ctx, fontRefColor) : null;
  const geom = child(spPr, 'prstGeom')?.attrs.prst ?? (child(spPr, 'custGeom') ? 'rect' : 'rect');
  // Khung placeholder trống (chưa nhập chữ) không hiện khi trình chiếu
  if (ph && !fill && !line && (!text || !text.paras.some((p) => p.runs.some((r) => r.text.trim())))) return null;
  return { kind: 'shape', box: applyGroup(box, group), geom, fill, line, text };
}

function readPicture(pic: XmlElement, ctx: Context, group: GroupMap | null): SlideItem | null {
  const box = readXfrm(child(child(pic, 'spPr'), 'xfrm'));
  const embed = attr(child(child(pic, 'blipFill'), 'blip'), 'embed');
  if (!box || !embed) return null;
  const rel = ctx.rels.get(embed);
  if (!rel) return null;
  if (/\.(emf|wmf|tiff?)$/i.test(rel.target)) return { kind: 'unsupported', box: applyGroup(box, group), label: t('lib.pptx.emf', 'Ảnh định dạng EMF/WMF') };
  return { kind: 'image', box: applyGroup(box, group), path: rel.target };
}

function readGraphicFrame(gf: XmlElement, ctx: Context, group: GroupMap | null): SlideItem | null {
  const box = readXfrm(child(gf, 'xfrm'));
  if (!box) return null;
  const data = child(child(gf, 'graphic'), 'graphicData');
  const tbl = child(data, 'tbl');
  if (tbl) {
    const cols = childrenNamed(child(tbl, 'tblGrid'), 'gridCol').map((c) => Number(c.attrs.w) / EMU_PER_PT);
    // Kiểu bảng có sẵn: dựng gần đúng kiểu mặc định "Medium Style 2" theo màu accent tương ứng
    const tblPr = child(tbl, 'tblPr');
    const styleId = child(tblPr, 'tableStyleId')?.children.find((x): x is string => typeof x === 'string')?.trim() ?? '';
    const accent = styleId ? ctx.theme.colors[TABLE_STYLE_ACCENT[styleId.toUpperCase()] ?? 'accent1'] : undefined;
    const firstRow = tblPr?.attrs.firstRow === '1';
    const banded = tblPr?.attrs.bandRow === '1';
    let body = 0;
    const rows = childrenNamed(tbl, 'tr').map((tr, ri) => {
      const header = !!accent && firstRow && ri === 0;
      const band = header ? 0 : body++;
      const styleFill = !accent ? null : header ? `#${accent}` : `#${applyMod(accent, 'tint', banded && band % 2 === 0 ? 0.4 : 0.2)}`;
      return {
        h: Number(tr.attrs.h) / EMU_PER_PT,
        cells: childrenNamed(tr, 'tc').filter((tc) => tc.attrs.hMerge !== '1' && tc.attrs.vMerge !== '1').map((tc) => {
          const tcPr = child(tc, 'tcPr');
          const lt1 = ctx.theme.colors[ctx.clrMap.bg1 ?? 'lt1'];
          const text = readTextBody(child(tc, 'txBody') ?? { name: 'a:txBody', attrs: {}, children: [] }, [], null, ctx, header && lt1 ? `#${lt1}` : null);
          if (header) text.paras.forEach((p) => p.runs.forEach((r) => (r.bold = true)));
          return {
            text,
            fill: child(tcPr, 'noFill') ? null : (readColor(child(tcPr, 'solidFill'), ctx.theme, ctx.clrMap) ?? styleFill),
            span: Number(tc.attrs.gridSpan ?? 1),
          };
        }),
      };
    });
    const lt1 = ctx.theme.colors[ctx.clrMap.bg1 ?? 'lt1'];
    return { kind: 'table', box: applyGroup(box, group), cols, rows, border: accent ? `#${lt1 ?? 'ffffff'}` : '#9aa4b2' };
  }
  const uri = data?.attrs.uri ?? '';
  const label = /chart/.test(uri) ? t('lib.pptx.chart', 'Biểu đồ') : /diagram/.test(uri) ? 'SmartArt' : t('lib.pptx.embedded', 'Đối tượng nhúng');
  return { kind: 'unsupported', box: applyGroup(box, group), label };
}

function readTree(tree: XmlElement, ctx: Context, group: GroupMap | null, out: SlideItem[]): void {
  for (const el of elements(tree)) {
    const n = localName(el.name);
    let item: SlideItem | null = null;
    if (n === 'sp' || n === 'cxnSp') item = readShape(el, ctx, group);
    else if (n === 'pic') item = readPicture(el, ctx, group);
    else if (n === 'graphicFrame') item = readGraphicFrame(el, ctx, group);
    else if (n === 'grpSp') {
      const xfrm = child(child(el, 'grpSpPr'), 'xfrm');
      const b = readXfrm(xfrm);
      const chOff = child(xfrm, 'chOff');
      const chExt = child(xfrm, 'chExt');
      if (b && chOff && chExt) {
        const outer = applyGroup(b, group);
        const cw = Number(chExt.attrs.cx) / EMU_PER_PT || 1;
        const ch = Number(chExt.attrs.cy) / EMU_PER_PT || 1;
        readTree(el, ctx, { ox: outer.x, oy: outer.y, sx: outer.w / cw, sy: outer.h / ch, cx: Number(chOff.attrs.x) / EMU_PER_PT, cy: Number(chOff.attrs.y) / EMU_PER_PT }, out);
      } else readTree(el, ctx, group, out);
    } else if (n === 'AlternateContent') {
      const fallback = child(el, 'Fallback') ?? child(el, 'Choice');
      if (fallback) readTree(fallback, ctx, group, out);
    }
    if (item) out.push(item);
  }
}

/* ---------- Nền ---------- */

function readBackground(cSld: XmlElement | undefined, ctx: Context): { color: string | null; image: string | null } | null {
  const bg = child(cSld, 'bg');
  if (!bg) return null;
  const bgPr = child(bg, 'bgPr');
  if (bgPr) {
    if (child(bgPr, 'solidFill')) return { color: readColor(child(bgPr, 'solidFill'), ctx.theme, ctx.clrMap), image: null };
    const blip = attr(child(child(bgPr, 'blipFill'), 'blip'), 'embed');
    if (blip && ctx.rels.get(blip)) return { color: null, image: ctx.rels.get(blip)!.target };
    const gs = child(child(child(bgPr, 'gradFill'), 'gsLst'), 'gs');
    if (gs) return { color: readColor(gs, ctx.theme, ctx.clrMap), image: null };
  }
  const ref = child(bg, 'bgRef');
  if (ref) return { color: readColor(ref, ctx.theme, ctx.clrMap), image: null };
  return null;
}

/* ---------- Toàn bộ bài trình chiếu ---------- */

async function readTheme(pkg: PackageReader, path: string | undefined): Promise<Theme> {
  const theme: Theme = { colors: { dk1: '000000', lt1: 'FFFFFF', dk2: '44546A', lt2: 'E7E6E6', accent1: '4472C4', accent2: 'ED7D31', accent3: 'A5A5A5', accent4: 'FFC000', accent5: '5B9BD5', accent6: '70AD47', hlink: '0563C1', folHlink: '954F72' }, majorFont: 'Arial', minorFont: 'Arial' };
  const xml = path ? await pkg.text(path) : null;
  if (!xml) return theme;
  const root = parseXml(xml);
  const scheme = child(child(root, 'themeElements'), 'clrScheme');
  for (const c of elements(scheme ?? root)) {
    if (!scheme) break;
    const col = elements(c)[0];
    if (!col) continue;
    const v = localName(col.name) === 'srgbClr' ? col.attrs.val : col.attrs.lastClr;
    if (v) theme.colors[localName(c.name)] = v;
  }
  const fonts = child(child(root, 'themeElements'), 'fontScheme');
  theme.majorFont = child(child(fonts, 'majorFont'), 'latin')?.attrs.typeface || theme.majorFont;
  theme.minorFont = child(child(fonts, 'minorFont'), 'latin')?.attrs.typeface || theme.minorFont;
  return theme;
}

export async function readPresentation(pkg: PackageReader): Promise<Presentation> {
  const presPath = 'ppt/presentation.xml';
  const presXml = await pkg.text(presPath);
  if (!presXml) throw new Error(t('lib.pptx.notPptx', 'Không phải file PowerPoint (.pptx) hợp lệ.'));
  const pres = parseXml(presXml);
  const size = child(pres, 'sldSz');
  const width = Number(size?.attrs.cx ?? 12192000) / EMU_PER_PT;
  const height = Number(size?.attrs.cy ?? 6858000) / EMU_PER_PT;
  const presRels = await relsOf(pkg, presPath);
  const slidePaths = childrenNamed(child(pres, 'sldIdLst'), 'sldId')
    // r:id (mã quan hệ), không phải id số của slide
    .map((s) => presRels.get(Object.entries(s.attrs).find(([k]) => k.endsWith(':id'))?.[1] ?? '')?.target)
    .filter((p): p is string => !!p);

  const cache = new Map<string, Promise<XmlElement | null>>();
  const load = (p: string | undefined) => {
    if (!p) return Promise.resolve(null);
    if (!cache.has(p)) cache.set(p, pkg.text(p).then((x) => (x ? parseXml(x) : null)));
    return cache.get(p) as Promise<XmlElement | null>;
  };

  const slides: Slide[] = [];
  for (const [i, path] of slidePaths.entries()) {
    const slide = await load(path);
    if (!slide) continue;
    const rels = await relsOf(pkg, path);
    const layoutPath = [...rels.values()].find((r) => /slideLayout$/.test(r.type))?.target;
    const layout = await load(layoutPath);
    const layoutRels = layoutPath ? await relsOf(pkg, layoutPath) : new Map();
    const masterPath = [...layoutRels.values()].find((r) => /slideMaster$/.test(r.type))?.target;
    const master = await load(masterPath);
    const masterRels = masterPath ? await relsOf(pkg, masterPath) : new Map();
    const theme = await readTheme(pkg, [...masterRels.values()].find((r) => /theme$/.test(r.type))?.target);
    const clrMapEl = child(master ?? undefined, 'clrMap');
    const clrMap: Record<string, string> = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2', ...(clrMapEl?.attrs ?? {}) };
    const override = child(child(slide, 'clrMapOvr'), 'overrideClrMapping');
    if (override) Object.assign(clrMap, override.attrs);

    const ctx: Context = { theme, clrMap, layoutTree: child(child(layout ?? undefined, 'cSld'), 'spTree'), masterTree: child(child(master ?? undefined, 'cSld'), 'spTree'), masterTxStyles: child(master ?? undefined, 'txStyles'), rels };
    const background =
      readBackground(child(slide, 'cSld'), ctx) ??
      readBackground(child(layout ?? undefined, 'cSld'), { ...ctx, rels: layoutRels }) ??
      readBackground(child(master ?? undefined, 'cSld'), { ...ctx, rels: masterRels }) ?? { color: `#${theme.colors[clrMap.bg1] ?? 'FFFFFF'}`, image: null };

    const items: SlideItem[] = [];
    // Hình trang trí trên master/layout (không phải placeholder) hiện dưới nội dung slide, trừ khi slide tắt
    if (slide.attrs.showMasterSp !== '0') {
      const deco = (tree: XmlElement | undefined, r: Map<string, { target: string; type: string }>) => {
        if (!tree) return;
        const only = { ...tree, children: elements(tree).filter((e) => !phOf(e)) };
        readTree(only, { ...ctx, rels: r }, null, items);
      };
      if (layout?.attrs.showMasterSp !== '0') deco(ctx.masterTree, masterRels);
      deco(ctx.layoutTree, layoutRels);
    }
    const tree = child(child(slide, 'cSld'), 'spTree');
    if (tree) readTree(tree, ctx, null, items);
    slides.push({ index: i + 1, background, items });
  }
  if (!slides.length) throw new Error(t('lib.pptx.noSlides', 'File PowerPoint không có slide nào.'));
  return { width, height, slides };
}
