/** Chuyển đổi cho lập trình viên — phần thuần, không DOM (đợt 50 công cụ 14/11/2026) */

/* ---------- JSON → kiểu dữ liệu ---------- */
export type TypeTarget = 'ts' | 'zod' | 'go' | 'python' | 'csharp' | 'jsonschema';
const pascal = (s: string): string => {
  const w = s.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  const r = w.map((x) => x[0].toUpperCase() + x.slice(1)).join('');
  return /^[0-9]/.test(r) ? 'T' + r : r || 'Item';
};
const singular = (s: string): string => (s.endsWith('ies') ? s.slice(0, -3) + 'y' : s.endsWith('s') && s.length > 3 ? s.slice(0, -1) : s + 'Item');
const validId = (k: string): boolean => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k);

interface Shape { kind: 'string' | 'number' | 'integer' | 'boolean' | 'null' | 'any' | 'array' | 'object'; item?: Shape; fields?: Map<string, { shape: Shape; optional: boolean }>; name?: string }
function shapeOf(v: unknown, name: string): Shape {
  if (v === null) return { kind: 'null' };
  if (Array.isArray(v)) {
    const items = v.map((x) => shapeOf(x, singular(name)));
    return { kind: 'array', item: items.length ? items.reduce(merge) : { kind: 'any' } };
  }
  if (typeof v === 'object') {
    const fields = new Map<string, { shape: Shape; optional: boolean }>();
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) fields.set(k, { shape: shapeOf(x, k), optional: false });
    return { kind: 'object', fields, name: pascal(name) };
  }
  if (typeof v === 'number') return { kind: Number.isInteger(v) ? 'integer' : 'number' };
  if (typeof v === 'boolean') return { kind: 'boolean' };
  return { kind: 'string' };
}
function merge(a: Shape, b: Shape): Shape {
  if (a.kind === b.kind && a.kind === 'object') {
    const f = new Map(a.fields);
    for (const [k, v] of f) if (!b.fields!.has(k)) f.set(k, { ...v, optional: true });
    for (const [k, v] of b.fields!) {
      const cur = f.get(k);
      f.set(k, cur ? { shape: merge(cur.shape, v.shape), optional: cur.optional || v.optional } : { ...v, optional: true });
    }
    return { kind: 'object', fields: f, name: a.name };
  }
  if (a.kind === b.kind && a.kind === 'array') return { kind: 'array', item: merge(a.item!, b.item!) };
  if (a.kind === b.kind) return a;
  if ((a.kind === 'integer' && b.kind === 'number') || (a.kind === 'number' && b.kind === 'integer')) return { kind: 'number' };
  if (a.kind === 'null') return { ...b, nullable: true } as Shape;
  if (b.kind === 'null') return { ...a, nullable: true } as Shape;
  return { kind: 'any' };
}
const nullable = (s: Shape): boolean => !!(s as { nullable?: boolean }).nullable;

export function jsonToTypes(json: string, root: string, target: TypeTarget): string {
  const data = JSON.parse(json) as unknown;
  const top = shapeOf(data, root);
  if (target === 'jsonschema') return JSON.stringify(toSchema(top), null, 2);
  const defs: string[] = [];
  const seen = new Set<string>();
  const name = (s: Shape): string => {
    let n = s.name || 'Item';
    let i = 2;
    while (seen.has(n) && !(s as { _named?: boolean })._named) n = (s.name || 'Item') + i++;
    return n;
  };
  const ref = (s: Shape): string => {
    const nl = nullable(s);
    let r: string;
    switch (s.kind) {
      case 'object': {
        if (!(s as { _ref?: string })._ref) {
          const n = name(s);
          seen.add(n);
          (s as { _ref?: string })._ref = n;
          defs.push(emit(s, n));
        }
        r = (s as { _ref?: string })._ref! + (target === 'zod' ? 'Schema' : '');
        break;
      }
      case 'array': r = arr(ref(s.item!)); break;
      default: r = prim(s.kind);
    }
    return nl ? opt(r) : r;
  };
  const prim = (k: Shape['kind']): string => ({
    ts: { string: 'string', number: 'number', integer: 'number', boolean: 'boolean', null: 'null', any: 'unknown' },
    zod: { string: 'z.string()', number: 'z.number()', integer: 'z.number().int()', boolean: 'z.boolean()', null: 'z.null()', any: 'z.unknown()' },
    go: { string: 'string', number: 'float64', integer: 'int64', boolean: 'bool', null: 'interface{}', any: 'interface{}' },
    python: { string: 'str', number: 'float', integer: 'int', boolean: 'bool', null: 'None', any: 'Any' },
    csharp: { string: 'string', number: 'double', integer: 'long', boolean: 'bool', null: 'object', any: 'object' },
  } as Record<string, Record<string, string>>)[target][k];
  const arr = (r: string): string => ({ ts: `${r}[]`, zod: `z.array(${r})`, go: `[]${r}`, python: `list[${r}]`, csharp: `List<${r}>` } as Record<string, string>)[target];
  const opt = (r: string): string => ({ ts: `${r} | null`, zod: `${r}.nullable()`, go: r.startsWith('*') || r.startsWith('[]') ? r : `*${r}`, python: `Optional[${r}]`, csharp: `${r}?` } as Record<string, string>)[target];
  function emit(s: Shape, n: string): string {
    const f = [...s.fields!.entries()];
    if (target === 'ts') return `export interface ${n} {\n${f.map(([k, v]) => `  ${validId(k) ? k : JSON.stringify(k)}${v.optional ? '?' : ''}: ${ref(v.shape)};`).join('\n')}\n}`;
    if (target === 'zod') return `export const ${n}Schema = z.object({\n${f.map(([k, v]) => `  ${validId(k) ? k : JSON.stringify(k)}: ${ref(v.shape)}${v.optional ? '.optional()' : ''},`).join('\n')}\n});\nexport type ${n} = z.infer<typeof ${n}Schema>;`;
    if (target === 'go') return `type ${n} struct {\n${f.map(([k, v]) => `\t${pascal(k)} ${ref(v.shape)} \`json:"${k}${v.optional ? ',omitempty' : ''}"\``).join('\n')}\n}`;
    if (target === 'python') return `@dataclass\nclass ${n}:\n${f.length ? f.map(([k, v]) => `    ${k.replace(/\W/g, '_')}: ${v.optional ? `Optional[${ref(v.shape)}] = None` : ref(v.shape)}`).join('\n') : '    pass'}`;
    return `public class ${n}\n{\n${f.map(([k, v]) => `    [JsonPropertyName("${k}")]\n    public ${ref(v.shape)}${v.optional && !ref(v.shape).endsWith('?') ? '?' : ''} ${pascal(k)} { get; set; }`).join('\n')}\n}`;
  }
  let rootRef = ref(top);
  if (top.kind !== 'object') {
    const alias = pascal(root);
    if (target === 'ts') defs.push(`export type ${alias} = ${rootRef};`);
    else if (target === 'zod') defs.push(`export const ${alias}Schema = ${rootRef};`);
    else if (target === 'go') defs.push(`type ${alias} ${rootRef}`);
    else if (target === 'python') defs.push(`${alias} = ${rootRef}`);
    rootRef = alias;
  }
  const head = ({ ts: '', zod: "import { z } from 'zod';\n\n", go: '', python: 'from dataclasses import dataclass\nfrom typing import Any, Optional\n\n', csharp: 'using System.Collections.Generic;\nusing System.Text.Json.Serialization;\n\n' } as Record<string, string>)[target];
  // Định nghĩa con được đẩy vào trước, đảo lại để kiểu gốc lên đầu (Python cần kiểu con khai báo trước nên giữ nguyên)
  const body = target === 'python' || target === 'zod' ? defs : [...defs].reverse();
  return head + body.join('\n\n') + '\n';
}
function toSchema(s: Shape): Record<string, unknown> {
  const n = nullable(s);
  let r: Record<string, unknown>;
  switch (s.kind) {
    case 'object': {
      const props: Record<string, unknown> = {};
      const req: string[] = [];
      for (const [k, v] of s.fields!) { props[k] = toSchema(v.shape); if (!v.optional) req.push(k); }
      r = { type: 'object', properties: props, ...(req.length ? { required: req } : {}) };
      break;
    }
    case 'array': r = { type: 'array', items: toSchema(s.item!) }; break;
    case 'any': r = {}; break;
    default: r = { type: s.kind };
  }
  if (n && r.type) r.type = [r.type, 'null'];
  return r;
}

/* ---------- So sánh JSON ---------- */
export interface JsonChange { path: string; kind: 'added' | 'removed' | 'changed' | 'type'; from?: unknown; to?: unknown }
export function jsonDiff(a: unknown, b: unknown, path = '$', out: JsonChange[] = [], ignoreOrder = false): JsonChange[] {
  const ta = Array.isArray(a) ? 'array' : a === null ? 'null' : typeof a;
  const tb = Array.isArray(b) ? 'array' : b === null ? 'null' : typeof b;
  if (ta !== tb) { out.push({ path, kind: 'type', from: a, to: b }); return out; }
  if (ta === 'object') {
    const ka = Object.keys(a as object), kb = Object.keys(b as object);
    for (const k of ka) {
      const p = validId(k) ? `${path}.${k}` : `${path}[${JSON.stringify(k)}]`;
      if (!(k in (b as object))) out.push({ path: p, kind: 'removed', from: (a as Record<string, unknown>)[k] });
      else jsonDiff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], p, out, ignoreOrder);
    }
    for (const k of kb) if (!(k in (a as object))) out.push({ path: validId(k) ? `${path}.${k}` : `${path}[${JSON.stringify(k)}]`, kind: 'added', to: (b as Record<string, unknown>)[k] });
  } else if (ta === 'array') {
    let x = a as unknown[], y = b as unknown[];
    if (ignoreOrder) {
      const key = (v: unknown) => JSON.stringify(sortKeys(v));
      x = [...x].sort((p, q) => key(p).localeCompare(key(q)));
      y = [...y].sort((p, q) => key(p).localeCompare(key(q)));
    }
    const n = Math.max(x.length, y.length);
    for (let i = 0; i < n; i++) {
      if (i >= y.length) out.push({ path: `${path}[${i}]`, kind: 'removed', from: x[i] });
      else if (i >= x.length) out.push({ path: `${path}[${i}]`, kind: 'added', to: y[i] });
      else jsonDiff(x[i], y[i], `${path}[${i}]`, out, ignoreOrder);
    }
  } else if (a !== b) out.push({ path, kind: 'changed', from: a, to: b });
  return out;
}
export function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]));
  return v;
}

/* ---------- JSONPath (tập con: $ . .. [n] [*] ['k'] [a:b] [?(@.k op v)]) ---------- */
export function jsonPath(data: unknown, expr: string): { path: string; value: unknown }[] {
  let e = expr.trim();
  if (!e.startsWith('$')) e = '$.' + e.replace(/^\./, '');
  const tokens: string[] = [];
  let i = 1;
  while (i < e.length) {
    if (e.startsWith('..', i)) { tokens.push('..'); i += 2; continue; }
    if (e[i] === '.') { i++; const m = /^[^.[]+/.exec(e.slice(i)); if (m) { tokens.push(m[0]); i += m[0].length; } continue; }
    if (e[i] === '[') {
      let depth = 0, j = i;
      for (; j < e.length; j++) { if (e[j] === '[') depth++; else if (e[j] === ']' && --depth === 0) break; }
      tokens.push(e.slice(i, j + 1)); i = j + 1; continue;
    }
    const m = /^[^.[]+/.exec(e.slice(i));
    if (m) { tokens.push(m[0]); i += m[0].length; } else i++;
  }
  let cur: { path: string; value: unknown }[] = [{ path: '$', value: data }];
  const kids = (n: { path: string; value: unknown }) => {
    const v = n.value;
    if (Array.isArray(v)) return v.map((x, k) => ({ path: `${n.path}[${k}]`, value: x }));
    if (v && typeof v === 'object') return Object.entries(v as object).map(([k, x]) => ({ path: `${n.path}.${k}`, value: x }));
    return [];
  };
  const desc = (n: { path: string; value: unknown }): { path: string; value: unknown }[] => [n, ...kids(n).flatMap(desc)];
  let deep = false;
  for (const tok of tokens) {
    if (tok === '..') { deep = true; continue; }
    const base = deep ? cur.flatMap(desc) : cur;
    deep = false;
    const next: { path: string; value: unknown }[] = [];
    for (const n of base) {
      if (tok === '*' || tok === '[*]') { next.push(...kids(n)); continue; }
      const br = /^\[(.*)\]$/.exec(tok);
      const inner = br ? br[1].trim() : tok;
      if (br && inner.startsWith('?')) {
        const m = /^\?\(@\.?([\w.]*)\s*(==|!=|>=|<=|>|<)?\s*(.*?)\)$/.exec(inner);
        if (!m) continue;
        const [, key, op, raw] = m;
        const rhs = raw === '' ? undefined : (() => { try { return JSON.parse(raw.replace(/^'(.*)'$/, '"$1"')); } catch { return raw; } })();
        for (const c of kids(n)) {
          let lv: unknown = c.value;
          for (const p of key.split('.').filter(Boolean)) lv = lv && typeof lv === 'object' ? (lv as Record<string, unknown>)[p] : undefined;
          const ok = !op ? lv !== undefined : op === '==' ? lv === rhs : op === '!=' ? lv !== rhs : op === '>' ? (lv as number) > (rhs as number) : op === '<' ? (lv as number) < (rhs as number) : op === '>=' ? (lv as number) >= (rhs as number) : (lv as number) <= (rhs as number);
          if (ok) next.push(c);
        }
        continue;
      }
      const sl = /^(-?\d*):(-?\d*)$/.exec(inner);
      if (br && sl && Array.isArray(n.value)) {
        const len = n.value.length;
        const norm = (x: string, d: number) => (x === '' ? d : Number(x) < 0 ? len + Number(x) : Number(x));
        for (let k = norm(sl[1], 0); k < Math.min(len, norm(sl[2], len)); k++) next.push({ path: `${n.path}[${k}]`, value: n.value[k] });
        continue;
      }
      for (const part of inner.split(',').map((x) => x.trim().replace(/^['"](.*)['"]$/, '$1'))) {
        if (Array.isArray(n.value) && /^-?\d+$/.test(part)) {
          const k = Number(part) < 0 ? n.value.length + Number(part) : Number(part);
          if (k >= 0 && k < n.value.length) next.push({ path: `${n.path}[${k}]`, value: n.value[k] });
        } else if (n.value && typeof n.value === 'object' && part in (n.value as object)) next.push({ path: `${n.path}.${part}`, value: (n.value as Record<string, unknown>)[part] });
      }
    }
    cur = next;
  }
  return cur;
}

/* ---------- Cron (5 trường, kiểu Unix) ---------- */
export interface CronField { values: number[]; any: boolean }
export interface Cron { minute: CronField; hour: CronField; dom: CronField; month: CronField; dow: CronField }
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MACROS: Record<string, string> = { '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *', '@weekly': '0 0 * * 0', '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *' };
function field(src: string, min: number, max: number, names?: string[]): CronField {
  const vals = new Set<number>();
  const any = src === '*' || src === '?';
  for (const part of src.split(',')) {
    const [rng, stepS] = part.split('/');
    const step = stepS === undefined ? 1 : Number(stepS);
    if (!Number.isInteger(step) || step < 1) throw new Error(part);
    const num = (s: string): number => {
      const u = s.toUpperCase();
      const idx = names ? names.indexOf(u) : -1;
      const n = idx >= 0 ? idx + (min === 1 ? 1 : 0) : Number(s);
      if (!Number.isInteger(n)) throw new Error(s);
      return n;
    };
    let lo: number, hi: number;
    if (rng === '*' || rng === '?') { lo = min; hi = max; }
    else if (rng.includes('-')) { const [a, b] = rng.split('-'); lo = num(a); hi = num(b); }
    else { lo = num(rng); hi = stepS === undefined ? lo : max; }
    if (names === DAYS && hi === 7) hi = 7;
    if (lo < min || hi > (names === DAYS ? 7 : max) || lo > hi) throw new Error(part);
    for (let v = lo; v <= hi; v += step) vals.add(names === DAYS && v === 7 ? 0 : v);
  }
  return { values: [...vals].sort((a, b) => a - b), any };
}
export function parseCron(expr: string): Cron {
  const e = MACROS[expr.trim().toLowerCase()] ?? expr.trim();
  const p = e.split(/\s+/);
  if (p.length !== 5) throw new Error('count');
  return { minute: field(p[0], 0, 59), hour: field(p[1], 0, 23), dom: field(p[2], 1, 31), month: field(p[3], 1, 12, MONTHS), dow: field(p[4], 0, 6, DAYS) };
}
export function cronNext(c: Cron, from: Date, count: number): Date[] {
  const out: Date[] = [];
  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  const has = (f: CronField, v: number) => f.values.includes(v);
  let guard = 0;
  while (out.length < count && guard++ < 600000) {
    if (!has(c.month, d.getMonth() + 1)) { d.setMonth(d.getMonth() + 1, 1); d.setHours(0, 0, 0, 0); continue; }
    // Quy tắc Unix: nếu cả ngày-trong-tháng và thứ đều bị giới hạn thì chỉ cần khớp một trong hai
    const domOk = has(c.dom, d.getDate()), dowOk = has(c.dow, d.getDay());
    const dayOk = c.dom.any && c.dow.any ? true : c.dom.any ? dowOk : c.dow.any ? domOk : domOk || dowOk;
    if (!dayOk) { d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); continue; }
    if (!has(c.hour, d.getHours())) { d.setHours(d.getHours() + 1, 0, 0, 0); continue; }
    if (!has(c.minute, d.getMinutes())) { d.setMinutes(d.getMinutes() + 1, 0, 0); continue; }
    out.push(new Date(d.getTime()));
    d.setMinutes(d.getMinutes() + 1);
  }
  return out;
}

/* ---------- Đổi cơ số (BigInt, có số âm) ---------- */
const DIG = '0123456789abcdefghijklmnopqrstuvwxyz';
export function parseBase(s: string, base: number): bigint {
  let t = s.trim().toLowerCase().replace(/[_\s]/g, '');
  let neg = false;
  if (t.startsWith('-')) { neg = true; t = t.slice(1); }
  if (base === 16) t = t.replace(/^0x/, '');
  if (base === 2) t = t.replace(/^0b/, '');
  if (base === 8) t = t.replace(/^0o/, '');
  if (!t) throw new Error('empty');
  let v = 0n;
  const B = BigInt(base);
  for (const ch of t) {
    const d = DIG.indexOf(ch);
    if (d < 0 || d >= base) throw new Error(ch);
    v = v * B + BigInt(d);
  }
  return neg ? -v : v;
}
export function toBase(v: bigint, base: number): string {
  if (v === 0n) return '0';
  const neg = v < 0n;
  let x = neg ? -v : v;
  const B = BigInt(base);
  let s = '';
  while (x > 0n) { s = DIG[Number(x % B)] + s; x /= B; }
  return (neg ? '-' : '') + s;
}
/** Bù hai với số bit cho trước */
export function twosComplement(v: bigint, bits: number): string {
  const m = 1n << BigInt(bits);
  return toBase(((v % m) + m) % m, 2).padStart(bits, '0');
}

/* ---------- cURL → mã ---------- */
export interface CurlReq { url: string; method: string; headers: [string, string][]; body: string | null; user: string | null; form: [string, string][] }
export function tokenizeShell(s: string): string[] {
  const out: string[] = [];
  let cur = '', q: string | null = null, has = false;
  const src = s.replace(/\\\r?\n/g, ' ');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === q) q = null;
      else if (c === '\\' && q === '"' && i + 1 < src.length) cur += src[++i];
      else cur += c;
    } else if (c === "'" || c === '"') { q = c; has = true; }
    else if (c === '$' && src[i + 1] === "'") { q = "'"; has = true; i++; }
    else if (c === '\\' && i + 1 < src.length) cur += src[++i];
    else if (/\s/.test(c)) { if (cur || has) out.push(cur); cur = ''; has = false; }
    else cur += c;
  }
  if (q) throw new Error('quote');
  if (cur || has) out.push(cur);
  return out;
}
export function parseCurl(cmd: string): CurlReq {
  const t = tokenizeShell(cmd.trim());
  if (t[0] !== 'curl') throw new Error('curl');
  const r: CurlReq = { url: '', method: '', headers: [], body: null, user: null, form: [] };
  for (let i = 1; i < t.length; i++) {
    const a = t[i];
    const next = () => t[++i] ?? '';
    if (a === '-X' || a === '--request') r.method = next().toUpperCase();
    else if (a === '-H' || a === '--header') { const h = next(); const k = h.indexOf(':'); if (k > 0) r.headers.push([h.slice(0, k).trim(), h.slice(k + 1).trim()]); }
    else if (['-d', '--data', '--data-raw', '--data-binary', '--data-ascii', '--json'].includes(a)) {
      const v = next();
      r.body = r.body == null ? v : `${r.body}&${v}`;
      if (a === '--json') { r.headers.push(['Content-Type', 'application/json']); r.headers.push(['Accept', 'application/json']); }
    } else if (a === '--data-urlencode') { const v = next(); const k = v.indexOf('='); const enc = k >= 0 ? `${v.slice(0, k)}=${encodeURIComponent(v.slice(k + 1))}` : encodeURIComponent(v); r.body = r.body == null ? enc : `${r.body}&${enc}`; }
    else if (a === '-F' || a === '--form') { const v = next(); const k = v.indexOf('='); r.form.push([v.slice(0, k), v.slice(k + 1)]); }
    else if (a === '-u' || a === '--user') r.user = next();
    else if (a === '-A' || a === '--user-agent') r.headers.push(['User-Agent', next()]);
    else if (a === '-e' || a === '--referer') r.headers.push(['Referer', next()]);
    else if (a === '-b' || a === '--cookie') r.headers.push(['Cookie', next()]);
    else if (a === '-I' || a === '--head') r.method = 'HEAD';
    else if (a === '--url') r.url = next();
    else if (/^-(o|-output|w|-write-out|m|-max-time|-connect-timeout|x|-proxy|T|-upload-file|c|-cookie-jar|r|-range|E|-cert|-retry)$/.test(a)) next();
    else if (!a.startsWith('-') && !r.url) r.url = a;
  }
  if (!r.url) throw new Error('url');
  if (!r.method) r.method = r.body != null || r.form.length ? 'POST' : 'GET';
  if (r.body != null && !r.headers.some(([k]) => k.toLowerCase() === 'content-type') && !r.form.length) r.headers.push(['Content-Type', 'application/x-www-form-urlencoded']);
  return r;
}
const q = (s: string) => JSON.stringify(s);
const pyq = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
export type CurlTarget = 'fetch' | 'axios' | 'python' | 'node' | 'php' | 'go';
export function curlTo(r: CurlReq, target: CurlTarget): string {
  const headers = [...r.headers];
  if (r.user) headers.push(['Authorization', `Basic ${btoa(r.user)}`]);
  const isJson = headers.some(([k, v]) => k.toLowerCase() === 'content-type' && v.includes('json'));
  let jsonBody: unknown = undefined;
  if (isJson && r.body) { try { jsonBody = JSON.parse(r.body); } catch { /* giữ chuỗi */ } }
  switch (target) {
    case 'fetch':
    case 'node': {
      const lines = [`const res = await fetch(${q(r.url)}, {`, `  method: ${q(r.method)},`];
      if (headers.length) lines.push(`  headers: {\n${headers.map(([k, v]) => `    ${q(k)}: ${q(v)},`).join('\n')}\n  },`);
      if (r.form.length) lines.splice(0, 0, 'const form = new FormData();', ...r.form.map(([k, v]) => `form.append(${q(k)}, ${q(v)});`)), lines.push('  body: form,');
      else if (r.body != null) lines.push(`  body: ${jsonBody !== undefined ? `JSON.stringify(${JSON.stringify(jsonBody, null, 2).replace(/\n/g, '\n  ')})` : q(r.body)},`);
      lines.push('});', isJson ? 'const data = await res.json();' : 'const data = await res.text();', 'console.log(data);');
      return lines.join('\n');
    }
    case 'axios': {
      const lines = ["import axios from 'axios';", '', 'const res = await axios({', `  method: ${q(r.method.toLowerCase())},`, `  url: ${q(r.url)},`];
      if (headers.length) lines.push(`  headers: {\n${headers.map(([k, v]) => `    ${q(k)}: ${q(v)},`).join('\n')}\n  },`);
      if (r.body != null) lines.push(`  data: ${jsonBody !== undefined ? JSON.stringify(jsonBody, null, 2).replace(/\n/g, '\n  ') : q(r.body)},`);
      lines.push('});', 'console.log(res.data);');
      return lines.join('\n');
    }
    case 'python': {
      const lines = ['import requests', ''];
      if (headers.length) lines.push(`headers = {\n${headers.map(([k, v]) => `    ${pyq(k)}: ${pyq(v)},`).join('\n')}\n}`, '');
      const args = [pyq(r.url)];
      if (headers.length) args.push('headers=headers');
      if (r.form.length) args.push(`files={${r.form.map(([k, v]) => `${pyq(k)}: ${v.startsWith('@') ? `open(${pyq(v.slice(1))}, 'rb')` : `(None, ${pyq(v)})`}`).join(', ')}}`);
      else if (jsonBody !== undefined) args.push(`json=${JSON.stringify(jsonBody).replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None')}`);
      else if (r.body != null) args.push(`data=${pyq(r.body)}`);
      lines.push(`response = requests.${['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(r.method) ? r.method.toLowerCase() : 'request'}(${r.method === 'OPTIONS' ? pyq(r.method) + ', ' : ''}${args.join(', ')})`, 'print(response.status_code)', 'print(response.text)');
      return lines.join('\n');
    }
    case 'php': {
      const lines = ['<?php', '$ch = curl_init();', `curl_setopt($ch, CURLOPT_URL, ${pyq(r.url)});`, 'curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);', `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ${pyq(r.method)});`];
      if (headers.length) lines.push(`curl_setopt($ch, CURLOPT_HTTPHEADER, [\n${headers.map(([k, v]) => `    ${pyq(`${k}: ${v}`)},`).join('\n')}\n]);`);
      if (r.body != null) lines.push(`curl_setopt($ch, CURLOPT_POSTFIELDS, ${pyq(r.body)});`);
      lines.push('$response = curl_exec($ch);', 'curl_close($ch);', 'echo $response;');
      return lines.join('\n');
    }
    case 'go': {
      const lines = ['package main', '', 'import (', '\t"fmt"', '\t"io"', '\t"net/http"', ...(r.body != null ? ['\t"strings"'] : []), ')', '', 'func main() {'];
      lines.push(`\treq, err := http.NewRequest(${q(r.method)}, ${q(r.url)}, ${r.body != null ? `strings.NewReader(${q(r.body)})` : 'nil'})`, '\tif err != nil {', '\t\tpanic(err)', '\t}');
      for (const [k, v] of headers) lines.push(`\treq.Header.Set(${q(k)}, ${q(v)})`);
      lines.push('\tres, err := http.DefaultClient.Do(req)', '\tif err != nil {', '\t\tpanic(err)', '\t}', '\tdefer res.Body.Close()', '\tbody, _ := io.ReadAll(res.Body)', '\tfmt.Println(string(body))', '}');
      return lines.join('\n');
    }
  }
}

/* ---------- Định dạng SQL đơn giản ---------- */
const CLAUSES = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'UNION ALL', 'UNION', 'RETURNING', 'WITH', 'CREATE TABLE', 'ALTER TABLE', 'ON CONFLICT'];
const JOINS = ['LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'CROSS JOIN', 'FULL JOIN', 'JOIN'];
const KEYWORDS = 'SELECT FROM WHERE AND OR NOT IN IS NULL AS ON GROUP BY ORDER HAVING LIMIT OFFSET INSERT INTO VALUES UPDATE SET DELETE JOIN LEFT RIGHT INNER OUTER FULL CROSS UNION ALL DISTINCT CASE WHEN THEN ELSE END LIKE ILIKE BETWEEN EXISTS ASC DESC CREATE TABLE ALTER DROP INDEX PRIMARY KEY FOREIGN REFERENCES DEFAULT WITH RETURNING COUNT SUM AVG MIN MAX COALESCE CAST OVER PARTITION CONFLICT DO NOTHING TRUE FALSE'.split(' ');
export function formatSql(sql: string, indent = '  ', upper = true): string {
  // Tách chuỗi, comment để không đụng vào nội dung bên trong
  const tokens: { t: string; raw: boolean }[] = [];
  const re = /('(?:[^']|'')*'|"(?:[^"]|"")*"|`[^`]*`|--[^\n]*|\/\*[\s\S]*?\*\/|\s+|[(),;]|[^\s(),;'"`]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) tokens.push({ t: m[0], raw: /^['"`]|^--|^\/\*/.test(m[0]) });
  const words = tokens.filter((x) => !/^\s+$/.test(x.t));
  let out = '';
  let depth = 0;
  const nl = () => '\n' + indent.repeat(depth);
  const parenStack: boolean[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w.raw) { out += (out && !out.endsWith('(') && !out.endsWith('\n') && !out.endsWith(' ') ? ' ' : '') + w.t; if (w.t.startsWith('--')) out += nl(); continue; }
    // Gom cụm từ khoá nhiều chữ
    let phrase = '';
    for (const len of [3, 2, 1]) {
      const cand = words.slice(i, i + len).map((x) => x.t.toUpperCase()).join(' ');
      if (CLAUSES.includes(cand) || JOINS.includes(cand)) { phrase = cand; i += len - 1; break; }
    }
    if (phrase) {
      const kw = upper ? phrase : phrase.toLowerCase();
      out = out.replace(/\s+$/, '');
      out += (out ? nl() : '') + kw + (JOINS.includes(phrase) ? ' ' : nl() + indent);
      continue;
    }
    const U = w.t.toUpperCase();
    if (w.t === '(') {
      const sub = words[i + 1] && /^(SELECT|WITH)$/i.test(words[i + 1].t);
      parenStack.push(sub);
      const prev = out.replace(/\s+$/, '').split(/[\s(]/).pop()!.toUpperCase();
      const spaced = /^(IN|EXISTS|VALUES|AS|ON|AND|OR|NOT|FROM|JOIN|WHERE|SELECT|USING|ALL|ANY)$/.test(prev) || /[=<>,]$/.test(prev);
      out = out.replace(/\s+$/, '') + (out && spaced ? ' ' : '') + '(';
      if (sub) { depth += 2; out += nl(); depth -= 1; }
      continue;
    }
    if (w.t === ')') {
      const sub = parenStack.pop();
      if (sub) { depth -= 1; out = out.replace(/\s+$/, '') + nl() + ')'; }
      else out = out.replace(/\s+$/, '') + ')';
      out += ' ';
      continue;
    }
    if (w.t === ',') { out = out.replace(/\s+$/, '') + ','; const inClause = parenStack.length === 0 || parenStack[parenStack.length - 1]; out += inClause ? nl() + indent : ' '; continue; }
    if (w.t === ';') { out = out.replace(/\s+$/, '') + ';\n\n'; depth = 0; continue; }
    if ((U === 'AND' || U === 'OR') && !(words[i - 2] && words[i - 2].t.toUpperCase() === 'BETWEEN')) { out = out.replace(/\s+$/, '') + nl() + indent + (upper ? U : U.toLowerCase()) + ' '; continue; }
    const t = KEYWORDS.includes(U) ? (upper ? U : U.toLowerCase()) : w.t;
    out += (out.endsWith('(') || out.endsWith('\n') || out.endsWith(' ') || !out ? '' : ' ') + t + ' ';
  }
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
export function minifySql(sql: string): string {
  return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/('(?:[^']|'')*')|\s+/g, (_m, s: string) => s ?? ' ').replace(/\s*([(),;=<>])\s*/g, '$1').trim();
}
