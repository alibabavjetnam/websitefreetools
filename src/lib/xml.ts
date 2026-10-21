/**
 * Bộ đọc XML gọn nhẹ, không phụ thuộc DOM (chạy được cả trong trình duyệt lẫn khi kiểm thử).
 * Hỗ trợ phần tử, thuộc tính, văn bản, CDATA, chú thích, khai báo <?xml?>. Không hỗ trợ DTD có thực thể riêng.
 */

export interface XmlElement {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}
export type XmlNode = XmlElement | string;

export class XmlError extends Error {}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

export const escapeXml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string);

/** Phân tích chuỗi XML, trả về phần tử gốc */
export function parseXml(src: string): XmlElement {
  let i = 0;
  const n = src.length;
  const root: XmlElement = { name: '#document', attrs: {}, children: [] };
  const stack: XmlElement[] = [root];
  const lineOf = (pos: number) => src.slice(0, pos).split('\n').length;
  const fail = (msg: string): never => {
    throw new XmlError(`${msg} (dòng ${lineOf(i)})`);
  };

  if (src.charCodeAt(0) === 0xfeff) i = 1; // bỏ BOM
  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt === -1) {
      const text = src.slice(i);
      if (text.trim()) stack[stack.length - 1].children.push(decodeEntities(text));
      break;
    }
    if (lt > i) {
      const text = src.slice(i, lt);
      if (stack.length > 1) stack[stack.length - 1].children.push(decodeEntities(text));
      else if (text.trim()) fail('Có văn bản nằm ngoài phần tử gốc');
    }
    i = lt;
    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      if (end === -1) fail('Chú thích chưa đóng');
      i = end + 3;
    } else if (src.startsWith('<![CDATA[', i)) {
      const end = src.indexOf(']]>', i + 9);
      if (end === -1) fail('Khối CDATA chưa đóng');
      stack[stack.length - 1].children.push(src.slice(i + 9, end));
      i = end + 3;
    } else if (src.startsWith('<?', i)) {
      const end = src.indexOf('?>', i + 2);
      if (end === -1) fail('Khai báo <? chưa đóng');
      i = end + 2;
    } else if (src.startsWith('<!', i)) {
      // DOCTYPE: bỏ qua, kể cả phần [ ... ] bên trong
      let depth = 0;
      let j = i + 2;
      for (; j < n; j++) {
        if (src[j] === '[') depth++;
        else if (src[j] === ']') depth--;
        else if (src[j] === '>' && depth <= 0) break;
      }
      i = j + 1;
    } else if (src[i + 1] === '/') {
      const end = src.indexOf('>', i);
      if (end === -1) fail('Thẻ đóng chưa hoàn chỉnh');
      const name = src.slice(i + 2, end).trim();
      const open = stack.pop();
      if (!open || open === root) fail(`Thẻ đóng </${name}> không có thẻ mở`);
      if ((open as XmlElement).name !== name) fail(`Thẻ <${(open as XmlElement).name}> được đóng bằng </${name}>`);
      i = end + 1;
    } else {
      // Thẻ mở: tên, thuộc tính, có thể tự đóng
      const m = /^<([^\s/>]+)/.exec(src.slice(i, i + 256));
      if (!m) fail('Thẻ không hợp lệ');
      const name = (m as RegExpExecArray)[1];
      let j = i + 1 + name.length;
      const attrs: Record<string, string> = {};
      for (;;) {
        while (j < n && /\s/.test(src[j])) j++;
        if (j >= n) fail(`Thẻ <${name}> chưa đóng`);
        if (src[j] === '>' || (src[j] === '/' && src[j + 1] === '>')) break;
        const am = /^([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/.exec(src.slice(j, j + 65536));
        if (!am) fail(`Thuộc tính không hợp lệ trong thẻ <${name}>`);
        const a = am as RegExpExecArray;
        attrs[a[1]] = decodeEntities(a[3] ?? a[4] ?? '');
        j += a[0].length;
      }
      const el: XmlElement = { name, attrs, children: [] };
      stack[stack.length - 1].children.push(el);
      if (src[j] === '/') {
        i = j + 2;
      } else {
        stack.push(el);
        i = j + 1;
      }
      if (stack.length > 2000) fail('XML lồng nhau quá sâu');
    }
  }
  if (stack.length > 1) fail(`Thẻ <${stack[stack.length - 1].name}> chưa được đóng`);
  const top = root.children.filter((c): c is XmlElement => typeof c !== 'string');
  if (top.length !== 1) throw new XmlError(top.length ? 'XML phải có đúng một phần tử gốc' : 'Không tìm thấy phần tử XML nào');
  return top[0];
}

/* ---------- Tiện ích duyệt cây (dùng cho Word, PowerPoint) ---------- */

/** Tên bỏ tiền tố namespace: "a:t" -> "t" */
export const localName = (name: string): string => name.slice(name.indexOf(':') + 1);

export const elements = (el: XmlElement): XmlElement[] => el.children.filter((c): c is XmlElement => typeof c !== 'string');

/** Con trực tiếp có tên cục bộ cho trước */
export const child = (el: XmlElement | undefined, local: string): XmlElement | undefined =>
  el ? elements(el).find((c) => localName(c.name) === local) : undefined;

export const childrenNamed = (el: XmlElement | undefined, local: string): XmlElement[] =>
  el ? elements(el).filter((c) => localName(c.name) === local) : [];

/** Mọi phần tử con cháu có tên cục bộ cho trước (duyệt theo thứ tự tài liệu) */
export function descendants(el: XmlElement, local: string, out: XmlElement[] = []): XmlElement[] {
  for (const c of elements(el)) {
    if (localName(c.name) === local) out.push(c);
    descendants(c, local, out);
  }
  return out;
}

export const textOf = (el: XmlElement): string => el.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');

/** Thuộc tính bỏ qua tiền tố namespace */
export function attr(el: XmlElement | undefined, local: string): string | undefined {
  if (!el) return undefined;
  if (local in el.attrs) return el.attrs[local];
  const key = Object.keys(el.attrs).find((k) => localName(k) === local);
  return key ? el.attrs[key] : undefined;
}
