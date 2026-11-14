/** Tối ưu SVG tự viết (dùng DOMParser của trình duyệt): bỏ phần thừa của trình vẽ, làm tròn số, rút gọn khoảng trắng */
export interface SvgOpts { precision: number; removeComments: boolean; removeMeta: boolean; removeEditor: boolean; collapseGroups: boolean; removeDims: boolean }
const EDITOR_NS = /^(inkscape|sodipodi|sketch|xmlns:(inkscape|sodipodi|sketch|dc|cc|rdf|serif|xlink-unused)|data-name|serif:|figma|i:|x:|graph)/;
export function roundNums(s: string, p: number): string {
  return s.replace(/-?\d*\.\d+(?:e-?\d+)?|-?\d+(?:e-?\d+)?/gi, (m) => {
    const n = Number(m);
    if (!Number.isFinite(n)) return m;
    let r = String(+n.toFixed(p));
    if (r.startsWith('0.')) r = r.slice(1);
    else if (r.startsWith('-0.')) r = '-' + r.slice(2);
    return r;
  });
}
function cleanPath(d: string, p: number): string {
  return roundNums(d, p).replace(/\s*([a-zA-Z])\s*/g, '$1').replace(/,/g, ' ').replace(/\s+/g, ' ').replace(/ -/g, '-').replace(/(\.\d+) (?=\.)/g, '$1').trim();
}
export function optimizeSvg(src: string, o: SvgOpts): string {
  const doc = new DOMParser().parseFromString(src, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.nodeName.toLowerCase() !== 'svg') throw new Error('parse');
  const root = doc.documentElement;
  const cleanAttrs = (e: Element) => {
    for (const a of [...e.attributes]) {
      if (o.removeEditor && (EDITOR_NS.test(a.name) || (a.prefix && !['xlink', 'xml', 'xmlns'].includes(a.prefix)))) { e.removeAttribute(a.name); continue; }
      if (a.name === 'd') e.setAttribute('d', cleanPath(a.value, o.precision));
      else if (['points', 'viewBox', 'transform'].includes(a.name) || /^(x|y|x1|x2|y1|y2|cx|cy|r|rx|ry|width|height|stroke-width|offset|font-size|opacity)$/.test(a.name)) e.setAttribute(a.name, roundNums(a.value, o.precision).replace(/\s+/g, ' ').trim());
      else if (a.name === 'style') {
        const st = a.value.split(';').map((x) => x.trim()).filter(Boolean).filter((x) => !/^-inkscape|^inkscape|^font-variation-settings:normal/i.test(x)).join(';');
        if (st) e.setAttribute('style', roundNums(st, o.precision)); else e.removeAttribute('style');
      }
    }
  };
  const walk = (n: Node) => {
    for (const c of [...n.childNodes]) {
      if (c.nodeType === 8 && o.removeComments) { c.remove(); continue; }
      if (c.nodeType === 3 && !c.textContent?.trim() && !['text', 'tspan', 'textPath'].includes((n as Element).localName)) { c.remove(); continue; }
      if (c.nodeType !== 1) continue;
      const e = c as Element;
      const ln = e.localName;
      if (o.removeMeta && ln === 'metadata') { e.remove(); continue; }
      if (o.removeEditor && (e.prefix || /^(sodipodi|inkscape)/.test(e.nodeName))) { e.remove(); continue; }
      cleanAttrs(e);
      if (ln === 'defs' && !e.children.length) { e.remove(); continue; }
      walk(e);
      if (o.collapseGroups && ln === 'g' && !e.attributes.length) { e.replaceWith(...e.childNodes); continue; }
      if (ln === 'g' && !e.childNodes.length) e.remove();
    }
  };
  cleanAttrs(root);
  walk(root);
  if (o.removeEditor) for (const a of [...root.attributes]) if (/^xmlns:(?!xlink)/.test(a.name)) root.removeAttribute(a.name);
  if (o.removeDims && root.hasAttribute('viewBox')) { root.removeAttribute('width'); root.removeAttribute('height'); }
  if (![...root.querySelectorAll('*')].some((e) => e.hasAttributeNS('http://www.w3.org/1999/xlink', 'href'))) root.removeAttribute('xmlns:xlink');
  root.removeAttribute('version');
  root.removeAttribute('xml:space');
  return new XMLSerializer().serializeToString(root).replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ');
}
