/**
 * Chuyển đổi qua lại giữa dữ liệu dạng cây (JSON, XML) và dạng bảng (CSV, Excel).
 * Quy ước XML <-> JSON: thuộc tính thành khoá "@tên", chữ trong phần tử có thuộc tính thành "#text",
 * phần tử con trùng tên thành mảng.
 */
import { elements, escapeXml, type XmlElement } from './xml';

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
type JsonObject = { [k: string]: Json };

const isObject = (v: Json): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v);

/* ---------------- XML -> JSON ---------------- */

function elementToJson(el: XmlElement): Json {
  const kids = elements(el);
  const text = el.children.filter((c): c is string => typeof c === 'string').join('').trim();
  const attrs = Object.entries(el.attrs).filter(([k]) => !k.startsWith('xmlns'));
  if (!kids.length && !attrs.length) return text;
  const obj: JsonObject = {};
  for (const [k, v] of attrs) obj[`@${k}`] = v;
  for (const k of kids) {
    const v = elementToJson(k);
    if (k.name in obj) {
      const cur = obj[k.name];
      obj[k.name] = Array.isArray(cur) ? [...cur, v] : [cur, v];
    } else obj[k.name] = v;
  }
  if (text) obj['#text'] = text;
  return obj;
}

export const xmlToJson = (root: XmlElement): Json => ({ [root.name]: elementToJson(root) });

/* ---------------- JSON -> XML ---------------- */

/** Tên phần tử XML hợp lệ: thay ký tự lạ bằng "_", không bắt đầu bằng số */
export function xmlName(key: string): string {
  let s = key.normalize('NFC').replace(/[^\p{L}\p{N}_.-]/gu, '_');
  if (!s || /^[\p{N}.-]/u.test(s) || /^xml/i.test(s)) s = `_${s}`;
  return s;
}

function valueToXml(name: string, v: Json, indent: string, out: string[]): void {
  const tag = xmlName(name);
  if (Array.isArray(v)) {
    for (const item of v) valueToXml(name, item, indent, out);
    return;
  }
  if (!isObject(v)) {
    out.push(v === null ? `${indent}<${tag}/>` : `${indent}<${tag}>${escapeXml(String(v))}</${tag}>`);
    return;
  }
  const attrs = Object.entries(v)
    .filter(([k, x]) => k.startsWith('@') && !isObject(x) && !Array.isArray(x))
    .map(([k, x]) => ` ${xmlName(k.slice(1))}="${escapeXml(x === null ? '' : String(x))}"`)
    .join('');
  const text = v['#text'];
  const kids = Object.entries(v).filter(([k]) => !k.startsWith('@') && k !== '#text');
  if (!kids.length) {
    out.push(text === undefined || text === null ? `${indent}<${tag}${attrs}/>` : `${indent}<${tag}${attrs}>${escapeXml(String(text))}</${tag}>`);
    return;
  }
  out.push(`${indent}<${tag}${attrs}>`);
  if (text !== undefined && text !== null) out.push(`${indent}  ${escapeXml(String(text))}`);
  for (const [k, x] of kids) valueToXml(k, x, `${indent}  `, out);
  out.push(`${indent}</${tag}>`);
}

/** Đối tượng một khoá ({ catalog: {...} }) dùng khoá đó làm gốc; còn lại bọc trong <root> */
export function jsonToXml(v: Json, defaultRoot = 'root', itemName = 'item'): string {
  const out: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
  if (isObject(v) && Object.keys(v).length === 1 && !Object.keys(v)[0].startsWith('@') && !Array.isArray(Object.values(v)[0])) {
    const [k, x] = Object.entries(v)[0];
    valueToXml(k, x, '', out);
  } else if (Array.isArray(v)) {
    out.push(`<${defaultRoot}>`);
    for (const item of v) valueToXml(itemName, item, '  ', out);
    out.push(`</${defaultRoot}>`);
  } else {
    valueToXml(defaultRoot, v, '', out);
  }
  return out.join('\n');
}

/* ---------------- Cây -> bảng ---------------- */

/** Tìm danh sách bản ghi trong dữ liệu: mảng lớn nhất (ưu tiên mảng các đối tượng) */
function findRecords(v: Json): Json[] {
  if (Array.isArray(v)) return v;
  let best: Json[] | null = null;
  const visit = (x: Json, depth: number) => {
    if (depth > 6) return;
    if (Array.isArray(x)) {
      const score = (a: Json[]) => a.filter(isObject).length * 2 + a.length;
      if (!best || score(x) > score(best)) best = x;
      return;
    }
    if (isObject(x)) for (const c of Object.values(x)) visit(c, depth + 1);
  };
  visit(v, 0);
  if (best) return best;
  // Không có mảng: đối tượng một khoá bọc một đối tượng (XML) thì lấy đối tượng bên trong làm một dòng
  if (isObject(v) && Object.keys(v).length === 1 && isObject(Object.values(v)[0])) return [Object.values(v)[0]];
  return [v];
}

function flatten(v: Json, prefix: string, out: Record<string, string>): void {
  if (isObject(v)) {
    const entries = Object.entries(v);
    if (!entries.length && prefix) out[prefix] = '';
    for (const [k, x] of entries) flatten(x, prefix ? `${prefix}.${k}` : k, out);
  } else if (Array.isArray(v)) {
    // Mảng giá trị đơn: nối bằng "; ". Mảng đối tượng: giữ nguyên dạng JSON trong một ô
    out[prefix || 'value'] = v.every((x) => !isObject(x) && !Array.isArray(x)) ? v.map((x) => (x === null ? '' : String(x))).join('; ') : JSON.stringify(v);
  } else {
    out[prefix || 'value'] = v === null ? '' : String(v);
  }
}

export interface Table { header: string[]; rows: string[][] }

export function jsonToTable(v: Json): Table {
  const records = findRecords(v);
  const flat = records.map((r) => {
    const o: Record<string, string> = {};
    flatten(r, '', o);
    return o;
  });
  const header: string[] = [];
  const seen = new Set<string>();
  for (const o of flat) for (const k of Object.keys(o)) if (!seen.has(k)) { seen.add(k); header.push(k); }
  return { header, rows: flat.map((o) => header.map((h) => o[h] ?? '')) };
}

/* ---------------- Bảng -> cây ---------------- */

/** "123" -> 123, "true" -> true; giữ nguyên chuỗi số có số 0 đứng đầu (số điện thoại, mã) và số quá lớn */
export function inferValue(s: string): Json {
  const t = s.trim();
  if (t === '') return '';
  if (t === 'true' || t === 'false') return t === 'true';
  if (/^-?(0|[1-9]\d{0,14})(\.\d+)?$/.test(t)) return Number(t);
  return s;
}

export function tableToJson(t: Table, infer: boolean): JsonObject[] {
  return t.rows.map((r) => {
    const obj: JsonObject = {};
    t.header.forEach((h, i) => {
      const raw = r[i] ?? '';
      const val = infer ? inferValue(raw) : raw;
      // Cột "a.b" dựng lại thành đối tượng lồng nhau
      const parts = h.split('.').filter(Boolean);
      let cur = obj;
      parts.forEach((p, k) => {
        if (k === parts.length - 1) cur[p] = val;
        else {
          if (!isObject(cur[p] ?? null)) cur[p] = {};
          cur = cur[p] as JsonObject;
        }
      });
      if (!parts.length) obj[`column${i + 1}`] = val;
    });
    return obj;
  });
}

/** Mảng hai chiều (CSV, Excel) -> bảng; dòng đầu là tiêu đề, tên trống hoặc trùng được đặt lại */
export function rowsToTable(rows: string[][], hasHeader: boolean): Table {
  const width = Math.max(0, ...rows.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array(width - r.length).fill('')];
  const body = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!hasHeader) return { header: Array.from({ length: width }, (_, i) => `column${i + 1}`), rows: body.map(pad) };
  const [head = [], ...rest] = body;
  const used = new Map<string, number>();
  const header = pad(head).map((h, i) => {
    const base = h.trim() || `column${i + 1}`;
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return n ? `${base}_${n + 1}` : base;
  });
  return { header, rows: rest.map(pad) };
}
