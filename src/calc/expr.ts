/**
 * Bộ tính biểu thức cho máy tính khoa học (không dùng eval).
 * Hỗ trợ: + − × ÷ * / ^ %, giai thừa !, ngoặc, nhân ngầm (2π, 3(4), 2sin30),
 * hàm sin cos tan asin acos atan sinh cosh tanh ln log log2 sqrt √ cbrt abs exp round floor ceil,
 * hằng số π e, biến Ans. Góc theo độ hoặc radian.
 */

export type AngleMode = 'deg' | 'rad';

export class ExprError extends Error {
  constructor(public code: 'syntax' | 'paren' | 'domain' | 'divzero' | 'empty' | 'overflow') {
    super(code);
  }
}

type Tok = { t: 'num'; v: number } | { t: 'op'; v: string } | { t: 'fn'; v: string } | { t: 'lp' } | { t: 'rp' } | { t: 'id'; v: string };

const FUNCS = ['asinh', 'acosh', 'atanh', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'sin', 'cos', 'tan', 'log2', 'log', 'ln', 'sqrt', 'cbrt', 'abs', 'exp', 'round', 'floor', 'ceil'];

/** Chuẩn hoá ký hiệu người dùng hay gõ / dán */
export function normalize(s: string): string {
  return s
    .replace(/[×xX](?![a-z])/g, '*')
    .replace(/[÷:]/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/\*\*/g, '^')
    .replace(/,/g, '.')
    .replace(/pi/gi, 'π')
    .replace(/√/g, 'sqrt')
    .replace(/∛/g, 'cbrt');
}

function tokenize(src: string): Tok[] {
  const s = normalize(src);
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d*\.?\d+|\d+\.?)(e[+-]?\d+)?/i.exec(s.slice(i));
      if (!m) throw new ExprError('syntax');
      out.push({ t: 'num', v: parseFloat(m[0]) });
      i += m[0].length;
      continue;
    }
    if ('+-*/^%!'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    if (c === '(') { out.push({ t: 'lp' }); i++; continue; }
    if (c === ')') { out.push({ t: 'rp' }); i++; continue; }
    if (c === 'π') { out.push({ t: 'id', v: 'pi' }); i++; continue; }
    const rest = s.slice(i).toLowerCase();
    const fn = FUNCS.find((f) => rest.startsWith(f));
    if (fn) { out.push({ t: 'fn', v: fn }); i += fn.length; continue; }
    if (rest.startsWith('ans')) { out.push({ t: 'id', v: 'ans' }); i += 3; continue; }
    if (rest[0] === 'e') { out.push({ t: 'id', v: 'e' }); i++; continue; }
    throw new ExprError('syntax');
  }
  return out;
}

const isOperand = (t?: Tok) => !!t && (t.t === 'num' || t.t === 'id' || t.t === 'rp' || (t.t === 'op' && (t.v === '!' || t.v === '%')));
const startsOperand = (t?: Tok) => !!t && (t.t === 'num' || t.t === 'id' || t.t === 'lp' || t.t === 'fn');

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) {
    // Giai thừa số không nguyên: dùng hàm Gamma (xấp xỉ Lanczos)
    if (n < 0 && Number.isInteger(n)) throw new ExprError('domain');
    return gamma(n + 1);
  }
  if (n > 170) throw new ExprError('overflow');
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}
function gamma(z: number): number {
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  const g = 7;
  const p = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61503916999185, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  z -= 1;
  let x = p[0];
  for (let i = 1; i < g + 2; i++) x += p[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

/** Làm tròn sai số dấu phẩy động (0.1+0.2 → 0.3, sin(180°) → 0) */
export function clean(n: number): number {
  if (!Number.isFinite(n)) return n;
  if (Math.abs(n) < 1e-13) return 0;
  return parseFloat(n.toPrecision(14));
}

export function evaluate(src: string, mode: AngleMode = 'deg', ans = 0): number {
  const toks = tokenize(src);
  if (!toks.length) throw new ExprError('empty');
  // Chèn phép nhân ngầm: 2π, 2(3), (1)(2), 3sin30, π r
  const tk: Tok[] = [];
  for (const t of toks) {
    if (isOperand(tk[tk.length - 1]) && startsOperand(t)) tk.push({ t: 'op', v: '*' });
    tk.push(t);
  }
  let pos = 0;
  const peek = () => tk[pos];
  const toRad = (x: number) => (mode === 'deg' ? (x * Math.PI) / 180 : x);
  const fromRad = (x: number) => (mode === 'deg' ? (x * 180) / Math.PI : x);

  // Ngữ pháp: expr = term (('+'|'-') term)* ; term = unary (('*'|'/') unary)* ;
  // unary = ('-'|'+') unary | power ; power = postfix ('^' unary)? ; postfix = primary ('!'|'%')*
  function expr(): number {
    let v = term();
    for (;;) {
      const t = peek();
      if (t?.t === 'op' && (t.v === '+' || t.v === '-')) {
        pos++;
        const r = term();
        // a + b% = a + a·b/100 (cách tính phần trăm quen thuộc trên máy tính cầm tay)
        const prev = tk[pos - 1];
        const pct = prev?.t === 'op' && prev.v === '%' && lastPct !== null;
        const rr = pct ? (v * (lastPct as number)) / 100 : r;
        v = t.v === '+' ? v + rr : v - rr;
        lastPct = null;
      } else return v;
    }
  }
  let lastPct: number | null = null;
  function term(): number {
    let v = unary();
    for (;;) {
      const t = peek();
      if (t?.t === 'op' && (t.v === '*' || t.v === '/')) {
        pos++;
        const r = unary();
        if (t.v === '/' && r === 0) throw new ExprError('divzero');
        v = t.v === '*' ? v * r : v / r;
        lastPct = null;
      } else return v;
    }
  }
  function unary(): number {
    const t = peek();
    if (t?.t === 'op' && (t.v === '-' || t.v === '+')) { pos++; const v = unary(); return t.v === '-' ? -v : v; }
    return power();
  }
  function power(): number {
    const base = postfix();
    const t = peek();
    if (t?.t === 'op' && t.v === '^') {
      pos++;
      const ex = unary(); // luỹ thừa kết hợp phải: 2^3^2 = 2^9
      const r = Math.pow(base, ex);
      if (Number.isNaN(r)) throw new ExprError('domain');
      return r;
    }
    return base;
  }
  function postfix(): number {
    let v = primary();
    for (;;) {
      const t = peek();
      if (t?.t === 'op' && t.v === '!') { pos++; v = factorial(v); }
      else if (t?.t === 'op' && t.v === '%') { pos++; lastPct = v; v = v / 100; }
      else return v;
    }
  }
  function primary(): number {
    const t = tk[pos++];
    if (!t) throw new ExprError('syntax');
    if (t.t === 'num') return t.v;
    if (t.t === 'id') return t.v === 'pi' ? Math.PI : t.v === 'e' ? Math.E : ans;
    if (t.t === 'lp') {
      const v = expr();
      if (peek()?.t !== 'rp') throw new ExprError('paren');
      pos++;
      return v;
    }
    if (t.t === 'fn') {
      // Hàm có thể viết có ngoặc sin(30) hoặc không ngoặc sin30 (lấy một toán hạng có luỹ thừa)
      let x: number;
      if (peek()?.t === 'lp') { pos++; x = expr(); if (peek()?.t !== 'rp') throw new ExprError('paren'); pos++; }
      else x = power();
      return applyFn(t.v, x);
    }
    throw new ExprError('syntax');
  }
  function applyFn(f: string, x: number): number {
    const dom = (ok: boolean, v: number) => { if (!ok) throw new ExprError('domain'); return v; };
    switch (f) {
      case 'sin': return Math.sin(toRad(x));
      case 'cos': return Math.cos(toRad(x));
      case 'tan': {
        if (mode === 'deg' && Math.abs(((x % 180) + 180) % 180 - 90) < 1e-12) throw new ExprError('domain');
        return Math.tan(toRad(x));
      }
      case 'asin': return dom(x >= -1 && x <= 1, fromRad(Math.asin(x)));
      case 'acos': return dom(x >= -1 && x <= 1, fromRad(Math.acos(x)));
      case 'atan': return fromRad(Math.atan(x));
      case 'sinh': return Math.sinh(x);
      case 'cosh': return Math.cosh(x);
      case 'tanh': return Math.tanh(x);
      case 'asinh': return Math.asinh(x);
      case 'acosh': return dom(x >= 1, Math.acosh(x));
      case 'atanh': return dom(x > -1 && x < 1, Math.atanh(x));
      case 'ln': return dom(x > 0, Math.log(x));
      case 'log': return dom(x > 0, Math.log10(x));
      case 'log2': return dom(x > 0, Math.log2(x));
      case 'sqrt': return dom(x >= 0, Math.sqrt(x));
      case 'cbrt': return Math.cbrt(x);
      case 'abs': return Math.abs(x);
      case 'exp': return Math.exp(x);
      case 'round': return Math.round(x);
      case 'floor': return Math.floor(x);
      case 'ceil': return Math.ceil(x);
    }
    throw new ExprError('syntax');
  }

  const v = expr();
  if (pos < tk.length) throw new ExprError(tk[pos].t === 'rp' ? 'paren' : 'syntax');
  if (!Number.isFinite(v)) throw new ExprError(Number.isNaN(v) ? 'domain' : 'overflow');
  return clean(v);
}

/** Tự đóng các ngoặc còn mở (người dùng hay quên) */
export function autoClose(s: string): string {
  let depth = 0;
  for (const c of s) { if (c === '(') depth++; else if (c === ')') depth--; }
  return depth > 0 ? s + ')'.repeat(depth) : s;
}
