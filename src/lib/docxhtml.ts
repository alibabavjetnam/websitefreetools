/**
 * Đọc file Word (.docx) thành HTML để xem trước / in / xuất PDF.
 * Hỗ trợ: đoạn văn, tiêu đề, đậm/nghiêng/gạch chân/gạch ngang, cỡ chữ, màu chữ, tô nền, căn lề, thụt lề,
 * danh sách (gạch đầu dòng, đánh số), bảng (gộp cột), ảnh nhúng, ngắt trang, liên kết, khổ giấy và lề.
 * Không hỗ trợ: đầu trang/chân trang, hộp văn bản, biểu đồ, SmartArt, phương trình.
 */
import { CDN, global, loadScript } from './cdn';
import { t } from '../i18n';

interface ZipFile { async(type: 'string'): Promise<string>; async(type: 'uint8array'): Promise<Uint8Array> }
interface Zip { file(path: string): ZipFile | null }
interface JSZipStatic { loadAsync(data: ArrayBuffer | Uint8Array): Promise<Zip> }

export interface DocxResult { html: string; pageWpt: number; pageHpt: number; margins: { top: number; right: number; bottom: number; left: number }; warnings: string[] }

const kids = (el: Element | null | undefined, name?: string): Element[] => (el ? [...el.children].filter((c) => !name || c.localName === name) : []);
const kid = (el: Element | null | undefined, name: string): Element | undefined => kids(el, name)[0];
const val = (el: Element | undefined, a = 'val'): string | null => el?.getAttribute(`w:${a}`) ?? el?.getAttribute(a) ?? null;
const on = (el: Element | undefined) => !!el && !['0', 'false', 'off', 'none'].includes((val(el) ?? 'true').toLowerCase());
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const TWIP_PT = 1 / 20;

interface RunProps { b?: boolean; i?: boolean; u?: boolean; s?: boolean; sz?: number; color?: string; hl?: string; font?: string; vert?: string; caps?: boolean }
interface ParaProps { jc?: string; ind?: number; first?: number; before?: number; after?: number; line?: number }
interface Style { name: string; basedOn?: string; r: RunProps; p: ParaProps; heading?: number; num?: { id: string; lvl: number } }

function readRun(rPr?: Element): RunProps {
  if (!rPr) return {};
  const r: RunProps = {};
  if (kid(rPr, 'b')) r.b = on(kid(rPr, 'b'));
  if (kid(rPr, 'i')) r.i = on(kid(rPr, 'i'));
  const u = kid(rPr, 'u');
  if (u) r.u = val(u) !== 'none';
  if (kid(rPr, 'strike') || kid(rPr, 'dstrike')) r.s = on(kid(rPr, 'strike') ?? kid(rPr, 'dstrike'));
  const sz = val(kid(rPr, 'sz'));
  if (sz) r.sz = Number(sz) / 2;
  const color = val(kid(rPr, 'color'));
  if (color && color !== 'auto') r.color = `#${color}`;
  const hl = val(kid(rPr, 'highlight'));
  if (hl && hl !== 'none') r.hl = hl;
  const shd = kid(rPr, 'shd')?.getAttribute('w:fill');
  if (!r.hl && shd && shd !== 'auto' && /^[0-9a-f]{6}$/i.test(shd)) r.hl = `#${shd}`;
  const f = kid(rPr, 'rFonts');
  const font = f?.getAttribute('w:ascii') || f?.getAttribute('w:hAnsi');
  if (font) r.font = font;
  const va = val(kid(rPr, 'vertAlign'));
  if (va) r.vert = va;
  if (kid(rPr, 'caps')) r.caps = on(kid(rPr, 'caps'));
  return r;
}
function readPara(pPr?: Element): ParaProps {
  if (!pPr) return {};
  const p: ParaProps = {};
  const jc = val(kid(pPr, 'jc'));
  if (jc) p.jc = jc;
  const ind = kid(pPr, 'ind');
  if (ind) {
    const left = ind.getAttribute('w:left') ?? ind.getAttribute('w:start');
    if (left) p.ind = Number(left) * TWIP_PT;
    const fl = ind.getAttribute('w:firstLine');
    const hg = ind.getAttribute('w:hanging');
    if (fl) p.first = Number(fl) * TWIP_PT;
    if (hg) p.first = -Number(hg) * TWIP_PT;
  }
  const sp = kid(pPr, 'spacing');
  if (sp) {
    const b = sp.getAttribute('w:before'), a = sp.getAttribute('w:after'), l = sp.getAttribute('w:line'), rule = sp.getAttribute('w:lineRule');
    if (b) p.before = Number(b) * TWIP_PT;
    if (a) p.after = Number(a) * TWIP_PT;
    if (l && (!rule || rule === 'auto')) p.line = Number(l) / 240;
  }
  return p;
}

const HL: Record<string, string> = { yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff', blue: '#0000ff', red: '#ff0000', darkBlue: '#00008b', darkCyan: '#008b8b', darkGreen: '#006400', darkMagenta: '#8b008b', darkRed: '#8b0000', darkYellow: '#808000', darkGray: '#a9a9a9', lightGray: '#d3d3d3', black: '#000000', white: '#ffffff' };

export async function docxToHtml(data: ArrayBuffer): Promise<DocxResult> {
  await loadScript(CDN.jszip, 'JSZip');
  let zip: Zip;
  try {
    zip = await global<JSZipStatic>('JSZip').loadAsync(data);
  } catch {
    throw new Error(t('lib.docx.notZip', 'Không đọc được file. Hãy chọn file Word dạng .docx (file .doc cũ cần lưu lại thành .docx trước).'));
  }
  const read = async (p: string) => (await zip.file(p)?.async('string')) ?? '';
  const docXml = await read('word/document.xml');
  if (!docXml) throw new Error(t('lib.docx.noDoc', 'File này không phải tài liệu Word (.docx) hợp lệ.'));
  const parse = (s: string) => new DOMParser().parseFromString(s, 'application/xml');
  const doc = parse(docXml);
  const warnings: string[] = [];

  // ---- Kiểu (styles)
  const styles = new Map<string, Style>();
  let defaults: RunProps = { sz: 11 };
  let defaultPara: ParaProps = {};
  const stylesXml = await read('word/styles.xml');
  if (stylesXml) {
    const sd = parse(stylesXml).documentElement;
    const dd = kid(sd, 'docDefaults');
    defaults = { sz: 10, ...readRun(kid(kid(dd, 'rPrDefault'), 'rPr')) };
    defaultPara = readPara(kid(kid(dd, 'pPrDefault'), 'pPr'));
    for (const s of kids(sd, 'style')) {
      const id = s.getAttribute('w:styleId') ?? '';
      const name = val(kid(s, 'name')) ?? id;
      const hm = /^(?:heading|überschrift|titre|título|заголовок)\s*(\d)$/i.exec(name) ?? /^Heading(\d)$/.exec(id);
      styles.set(id, {
        name,
        basedOn: val(kid(s, 'basedOn')) ?? undefined,
        r: readRun(kid(s, 'rPr')),
        p: readPara(kid(s, 'pPr')),
        heading: hm ? Number(hm[1]) : /^title$/i.test(name) ? 0 : undefined,
        num: (() => { const np = kid(kid(s, 'pPr'), 'numPr'); const id = val(kid(np, 'numId')); return id ? { id, lvl: Number(val(kid(np, 'ilvl')) ?? 0) } : undefined; })(),
      });
    }
  }
  const resolve = (id?: string | null, depth = 0): { r: RunProps; p: ParaProps; heading?: number; num?: { id: string; lvl: number } } => {
    const s = id ? styles.get(id) : undefined;
    if (!s || depth > 8) return { r: {}, p: {} };
    const base = resolve(s.basedOn, depth + 1);
    return { r: { ...base.r, ...s.r }, p: { ...base.p, ...s.p }, heading: s.heading ?? base.heading, num: s.num ?? base.num };
  };
  const normal = resolve([...styles.entries()].find(([, s]) => /^normal$/i.test(s.name))?.[0]);

  // ---- Danh sách (numbering)
  const numFmt = new Map<string, { fmt: string; text: string; start: number }>(); // khoá numId:lvl
  const numXml = await read('word/numbering.xml');
  if (numXml) {
    const nd = parse(numXml).documentElement;
    const abs = new Map<string, Element>();
    for (const a of kids(nd, 'abstractNum')) abs.set(a.getAttribute('w:abstractNumId') ?? '', a);
    for (const n of kids(nd, 'num')) {
      const id = n.getAttribute('w:numId') ?? '';
      const a = abs.get(val(kid(n, 'abstractNumId')) ?? '');
      for (const l of kids(a, 'lvl')) {
        numFmt.set(`${id}:${l.getAttribute('w:ilvl')}`, { fmt: val(kid(l, 'numFmt')) ?? 'bullet', text: val(kid(l, 'lvlText')) ?? '•', start: Number(val(kid(l, 'start')) ?? 1) });
      }
    }
  }
  const counters = new Map<string, number[]>();
  const roman = (n: number) => { const m: [number, string][] = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]; let s = ''; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; };
  const fmtNum = (n: number, f: string) => f === 'lowerLetter' ? String.fromCharCode(96 + (((n - 1) % 26) + 1)) : f === 'upperLetter' ? String.fromCharCode(64 + (((n - 1) % 26) + 1)) : f === 'lowerRoman' ? roman(n) : f === 'upperRoman' ? roman(n).toUpperCase() : String(n);
  function listLabel(numId: string, ilvl: number): string {
    const def = numFmt.get(`${numId}:${ilvl}`);
    if (!def || numId === '0') return '';
    if (def.fmt === 'bullet') return /[-]/.test(def.text) || !def.text.trim() ? ['•', '◦', '▪'][ilvl % 3] : def.text;
    const c = counters.get(numId) ?? [];
    c[ilvl] = (c[ilvl] ?? (numFmt.get(`${numId}:${ilvl}`)?.start ?? 1) - 1) + 1;
    c.length = ilvl + 1; // bậc con đặt lại khi bậc cha tăng
    counters.set(numId, c);
    return def.text.replace(/%(\d)/g, (_, d: string) => { const lv = Number(d) - 1; const f = numFmt.get(`${numId}:${lv}`); return fmtNum(c[lv] ?? f?.start ?? 1, f?.fmt ?? 'decimal'); });
  }

  // ---- Quan hệ (ảnh, liên kết)
  const rels = new Map<string, string>();
  const relXml = await read('word/_rels/document.xml.rels');
  if (relXml) for (const r of [...parse(relXml).documentElement.children]) rels.set(r.getAttribute('Id') ?? '', r.getAttribute('Target') ?? '');
  const imgCache = new Map<string, string>();
  async function imageUrl(rid: string): Promise<string> {
    const target = rels.get(rid);
    if (!target) return '';
    if (imgCache.has(target)) return imgCache.get(target) as string;
    const path = target.startsWith('/') ? target.slice(1) : `word/${target.replace(/^\.\//, '')}`;
    const bytes = await zip.file(path)?.async('uint8array');
    if (!bytes) return '';
    const ext = path.split('.').pop()?.toLowerCase() ?? 'png';
    if (['emf', 'wmf'].includes(ext)) { warnings.push(t('lib.docx.emf', 'Có ảnh định dạng EMF/WMF trình duyệt không hiển thị được; ảnh đó bị bỏ qua.')); return ''; }
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : ext === 'svg' ? 'image/svg+xml' : ext === 'bmp' ? 'image/bmp' : ext === 'webp' ? 'image/webp' : 'image/png';
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
    imgCache.set(target, url);
    return url;
  }

  // ---- Chuyển nội dung
  const runCss = (r: RunProps) => {
    const st: string[] = [];
    if (r.b) st.push('font-weight:700');
    if (r.i) st.push('font-style:italic');
    const deco = [r.u ? 'underline' : '', r.s ? 'line-through' : ''].filter(Boolean).join(' ');
    if (deco) st.push(`text-decoration:${deco}`);
    if (r.sz) st.push(`font-size:${r.sz}pt`);
    if (r.color) st.push(`color:${r.color}`);
    if (r.hl) st.push(`background:${HL[r.hl] ?? r.hl}`);
    if (r.font) st.push(`font-family:'${r.font.replace(/'/g, '')}',serif`);
    if (r.caps) st.push('text-transform:uppercase');
    if (r.vert === 'superscript') st.push('vertical-align:super;font-size:smaller');
    if (r.vert === 'subscript') st.push('vertical-align:sub;font-size:smaller');
    return st.join(';');
  };

  async function runsHtml(parent: Element, base: RunProps): Promise<string> {
    let out = '';
    for (const node of kids(parent)) {
      if (node.localName === 'r') {
        const rStyle = resolve(val(kid(kid(node, 'rPr'), 'rStyle'))).r;
        const r = { ...base, ...rStyle, ...readRun(kid(node, 'rPr')) };
        let inner = '';
        for (const c of kids(node)) {
          if (c.localName === 't') inner += esc(c.textContent ?? '');
          else if (c.localName === 'tab') inner += '<span class="dx-tab">\t</span>';
          else if (c.localName === 'br') inner += c.getAttribute('w:type') === 'page' ? '<!--PAGEBREAK-->' : '<br>';
          else if (c.localName === 'noBreakHyphen') inner += '‑';
          else if (c.localName === 'sym') inner += String.fromCharCode(parseInt(c.getAttribute('w:char') ?? '20', 16) & 0xff || 32);
          else if (c.localName === 'drawing' || c.localName === 'pict') {
            const blip = c.getElementsByTagName('a:blip')[0] ?? c.getElementsByTagName('v:imagedata')[0];
            const rid = blip?.getAttribute('r:embed') ?? blip?.getAttribute('r:id');
            const ext = c.getElementsByTagName('wp:extent')[0];
            const w = ext ? Number(ext.getAttribute('cx')) / 12700 : 0; // EMU → pt
            const h = ext ? Number(ext.getAttribute('cy')) / 12700 : 0;
            const url = rid ? await imageUrl(rid) : '';
            if (url) inner += `<img src="${url}" alt="" style="${w ? `width:${w}pt;` : ''}${h ? `height:${h}pt;` : ''}max-width:100%;object-fit:contain" />`;
          }
        }
        if (!inner) continue;
        const css = runCss(r);
        out += css ? `<span style="${css}">${inner}</span>` : inner;
      } else if (node.localName === 'hyperlink') {
        const href = rels.get(node.getAttribute('r:id') ?? '') ?? '';
        const inner = await runsHtml(node, base);
        out += /^https?:|^mailto:/i.test(href) ? `<a href="${esc(href)}">${inner}</a>` : inner;
      } else if (['ins', 'smartTag', 'sdt', 'sdtContent', 'customXml', 'fldSimple'].includes(node.localName)) {
        out += await runsHtml(node.localName === 'sdt' ? (kid(node, 'sdtContent') as Element) : node, base);
      }
    }
    return out;
  }

  async function paraHtml(p: Element): Promise<string> {
    const pPr = kid(p, 'pPr');
    const st = resolve(val(kid(pPr, 'pStyle')) ?? undefined);
    const pp = { ...defaultPara, ...normal.p, ...st.p, ...readPara(pPr) };
    // Dấu đoạn có định dạng riêng không áp dụng cho chữ; chỉ lấy kiểu của đoạn
    const runBase = { ...defaults, ...normal.r, ...st.r };
    let label = '';
    // Danh sách khai báo ở đoạn văn, hoặc kế thừa từ kiểu đoạn (vd. "List Bullet")
    const numPr = kid(pPr, 'numPr');
    const own = numPr ? { id: val(kid(numPr, 'numId')) ?? st.num?.id ?? '0', lvl: Number(val(kid(numPr, 'ilvl')) ?? st.num?.lvl ?? 0) } : st.num;
    if (own) {
      const numId = own.id;
      const ilvl = own.lvl;
      label = listLabel(numId, ilvl);
      if (pp.ind === undefined) pp.ind = 36 * (ilvl + 1);
      if (pp.first === undefined) pp.first = -18;
    }
    const body = await runsHtml(p, runBase);
    const css: string[] = [];
    if (pp.jc) css.push(`text-align:${pp.jc === 'both' || pp.jc === 'distribute' ? 'justify' : pp.jc === 'center' ? 'center' : pp.jc === 'right' || pp.jc === 'end' ? 'right' : 'left'}`);
    if (pp.ind) css.push(`margin-left:${pp.ind}pt`);
    if (pp.first) css.push(`text-indent:${pp.first}pt`);
    css.push(`margin-top:${pp.before ?? 0}pt`, `margin-bottom:${pp.after ?? 8}pt`);
    if (pp.line) css.push(`line-height:${Math.max(0.9, pp.line * 1.15).toFixed(2)}`);
    const tag = st.heading !== undefined ? `h${Math.min(6, Math.max(1, st.heading || 1))}` : 'p';
    const rcss = runCss(runBase);
    const content = (label ? `<span class="dx-label">${esc(label)}</span>` : '') + (body || '&nbsp;');
    const html = `<${tag} style="${css.join(';')};${rcss}">${content}</${tag}>`;
    // Tách ngắt trang thành khối riêng để phân trang
    return html.includes('<!--PAGEBREAK-->') ? html.split('<!--PAGEBREAK-->').join(`</${tag}><div class="dx-break"></div><${tag} style="${css.join(';')};${rcss}">`) : html;
  }

  async function tableHtml(tbl: Element): Promise<string> {
    const rows: string[] = [];
    const grid = kids(kid(tbl, 'tblGrid'), 'gridCol').map((g) => Number(g.getAttribute('w:w') ?? 0) * TWIP_PT);
    const borders = kid(kid(tbl, 'tblPr'), 'tblBorders');
    const styleId = val(kid(kid(tbl, 'tblPr'), 'tblStyle'));
    // Có khung khi bảng khai báo đường viền (khác none) hoặc dùng kiểu bảng có lưới; bảng "Normal Table" mặc định không có khung
    const borderVals = kids(borders).map((b) => val(b) ?? 'none');
    const hasBorder = borders ? borderVals.some((v) => v !== 'none' && v !== 'nil') : !!styleId && !/^(TableNormal|NormalTable)$/i.test(styleId);
    for (const tr of kids(tbl, 'tr')) {
      const cells: string[] = [];
      for (const tc of kids(tr, 'tc')) {
        const tcPr = kid(tc, 'tcPr');
        const span = Number(val(kid(tcPr, 'gridSpan')) ?? 1);
        const vm = kid(tcPr, 'vMerge');
        const cont = vm && (val(vm) ?? 'continue') === 'continue';
        const fill = kid(tcPr, 'shd')?.getAttribute('w:fill');
        let inner = '';
        for (const c of kids(tc)) {
          if (c.localName === 'p') inner += await paraHtml(c);
          else if (c.localName === 'tbl') inner += await tableHtml(c);
        }
        const css = [fill && /^[0-9a-f]{6}$/i.test(fill) ? `background:#${fill}` : '', cont ? 'border-top-color:transparent' : ''].filter(Boolean).join(';');
        cells.push(`<td${span > 1 ? ` colspan="${span}"` : ''}${css ? ` style="${css}"` : ''}>${cont ? '' : inner}</td>`);
      }
      rows.push(`<tr>${cells.join('')}</tr>`);
    }
    const sum = grid.reduce((a, b) => a + b, 0);
    const cols = sum ? `<colgroup>${grid.map((w) => `<col style="width:${((w / sum) * 100).toFixed(2)}%">`).join('')}</colgroup>` : '';
    return `<table class="dx-table${hasBorder ? '' : ' dx-noborder'}">${cols}<tbody>${rows.join('')}</tbody></table>`;
  }

  const body = kid(doc.documentElement, 'body');
  const parts: string[] = [];
  for (const el of kids(body)) {
    if (el.localName === 'p') parts.push(await paraHtml(el));
    else if (el.localName === 'tbl') parts.push(await tableHtml(el));
    else if (el.localName === 'sdt') for (const c of kids(kid(el, 'sdtContent'))) parts.push(c.localName === 'tbl' ? await tableHtml(c) : await paraHtml(c));
  }

  // ---- Khổ giấy (sectPr cuối)
  const sect = kid(body, 'sectPr');
  const pg = kid(sect, 'pgSz');
  const mar = kid(sect, 'pgMar');
  const num = (el: Element | undefined, a: string, d: number) => { const v = el?.getAttribute(`w:${a}`); return v ? Number(v) * TWIP_PT : d; };
  if (doc.getElementsByTagName('w:txbxContent').length) warnings.push(t('lib.docx.textbox', 'Hộp văn bản (text box) chưa được hỗ trợ đầy đủ, nội dung trong đó có thể bị thiếu.'));
  return {
    html: parts.join('\n'),
    pageWpt: num(pg, 'w', 595.3),
    pageHpt: num(pg, 'h', 841.9),
    margins: { top: num(mar, 'top', 72), right: num(mar, 'right', 72), bottom: num(mar, 'bottom', 72), left: num(mar, 'left', 72) },
    warnings: [...new Set(warnings)],
  };
}
