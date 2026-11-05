/**
 * Bộ tính công thức để trộn dữ liệu nhiều nguồn Excel (FIRST, SUM, IF, CONCAT, UNIQUE...).
 * Không dùng eval; hỗ trợ lồng hàm. Giá trị của 1 ô qua nhiều nguồn là vector, kèm src = chỉ số nguồn
 * của từng phần tử để khi kết hợp 2 ô khác nhau (CONCAT, IF theo ô khác) các giá trị khớp đúng cùng một nguồn.
 */

export interface Entry { label: string; value: unknown; src: number }
export type EntriesMap = Record<string, Entry[]>;
/** Chữ kết quả của nhóm hàm kiểm tra (đã dịch theo ngôn ngữ) */
export interface FormulaLabels { missing: string; duplicate: string; valid: string; invalid: string }

export const FORMULA_NAMES = [
  'FIRST', 'LAST', 'MIN', 'MAX', 'UNIQUE', 'SUM', 'COUNT', 'AVERAGE', 'MEDIAN', 'GROUP_BY',
  'IF', 'SUM_IF', 'COUNT_IF', 'AVERAGE_IF', 'ANY', 'ALL', 'CONCAT', 'JOIN_UNIQUE', 'TRIM', 'UPPER', 'REPLACE',
  'MIN_DATE', 'MAX_DATE', 'YEAR', 'MONTH', 'DATE_RANGE', 'MISSING', 'DUPLICATE', 'VALID', 'EXISTS',
] as const;

/** Tham số mẫu khi áp dụng 1 hàm cho tất cả ô */
export function formulaTemplate(name: string, cellRef: string): string {
  let params = '';
  if (name === 'IF') params = '>0, TRUE, FALSE, ';
  else if (name.endsWith('_IF') || name === 'ANY' || name === 'ALL') params = '>0, ';
  else if (name === 'CONCAT' || name === 'JOIN_UNIQUE') params = ' - , ';
  else if (name === 'REPLACE') params = 'old, new, ';
  return `${name}(${params}${cellRef})`;
}

const CELL_REF_RE = /^[A-Za-z]{1,3}\d+$/;
const FUNC_CALL_RE = /^[A-Za-z_]+\s*\([\s\S]*\)$/;

type Node = { vector: unknown[]; src?: number[] } | { scalar: unknown };
type VecNode = { vector: unknown[]; src?: number[] };

const isBlankV = (v: unknown): boolean => v === undefined || v === null || String(v).trim() === '';
const toText = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

/** Chỉ nhận chuỗi là số thật sự; hỗ trợ kiểu Việt Nam 1.234.567,5 và kiểu 1,234,567.5 */
export function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean' || v === undefined || v === null) return NaN;
  let s = String(v).trim().replace(/\s+/g, '');
  if (s === '') return NaN;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(s) ? parseFloat(s) : NaN;
}

function unquote(str: string): string | null {
  const m = /^(["'])([\s\S]*)\1$/.exec(str);
  return m ? m[2] : null;
}

/** Điều kiện dạng: >5, <=10, <>0, =Nam, ="Nam", Nam (bằng), ="" (rỗng) */
function makeCondition(argStr: string | undefined): (val: unknown) => boolean {
  if (argStr === undefined || argStr === null || String(argStr).trim() === '') return () => true;
  const m = String(argStr).trim().match(/^(==|!=|<>|>=|<=|=|>|<)?\s*([\s\S]*)$/) as RegExpMatchArray;
  const op = m[1] || '=';
  let target = m[2].trim();
  const quoted = unquote(target);
  if (quoted !== null) target = quoted;
  const targetNum = quoted === null ? toNumber(target) : NaN;
  const isNe = op === '!=' || op === '<>';
  return (val) => {
    const text = toText(val).trim();
    if (!Number.isNaN(targetNum)) {
      const n = toNumber(text);
      if (Number.isNaN(n)) return isNe;
      switch (op) {
        case '>': return n > targetNum;
        case '<': return n < targetNum;
        case '>=': return n >= targetNum;
        case '<=': return n <= targetNum;
        case '!=': case '<>': return n !== targetNum;
        default: return n === targetNum;
      }
    }
    if (isNe) return text !== target;
    if (op === '=' || op === '==') return text === target;
    return false; // so sánh lớn/nhỏ với chữ: không hợp lệ
  };
}

/** Đọc ngày: Date, số serial Excel, chuỗi dd/mm/yyyy hoặc yyyy-mm-dd */
function parseDateValue(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    if (v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86400000));
    return null;
  }
  const s = toText(v).trim();
  let d: number, mo: number, y: number;
  let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?!\d)/);
  if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else {
    m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})(?!\d)/);
    if (!m) return null;
    y = +m[1]; mo = +m[2]; d = +m[3];
  }
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
}

/** Dùng UTC để ngày không bị lệch theo múi giờ máy */
function formatDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

const V = (arr: unknown[], src?: number[]): VecNode => { const n: VecNode = { vector: arr }; if (src) n.src = src; return n; };
const S = (val: unknown): Node => ({ scalar: val });
const isVec = (n: Node): n is VecNode => Array.isArray((n as VecNode).vector);
const vecLen = (n: Node): number => (isVec(n) ? n.vector.length : 1);
const valAt = (n: Node, i: number): unknown => {
  if (isVec(n)) {
    if (n.vector[i] !== undefined) return n.vector[i];
    return n.vector.length ? n.vector[n.vector.length - 1] : '';
  }
  return n.scalar;
};
/** Lấy giá trị theo nguồn s; node không gắn nguồn thì lấy theo vị trí i */
const valAtSrc = (n: Node, s: number | undefined, i: number): unknown => {
  if (isVec(n) && n.src && s !== undefined) {
    const k = n.src.indexOf(s);
    return k >= 0 ? n.vector[k] : '';
  }
  return valAt(n, i);
};
const toFlat = (n: Node): unknown[] => (isVec(n) ? n.vector : [n.scalar]);
const mapNode = (n: Node, fn: (v: unknown) => unknown): Node => (isVec(n) ? V(n.vector.map(fn), n.src) : S(fn(n.scalar)));
function unionSources(nodes: Node[]): number[] {
  const set = new Set<number>();
  nodes.forEach((n) => { if (isVec(n) && n.src) n.src.forEach((s) => set.add(s)); });
  return [...set].sort((a, b) => a - b);
}
const isDataArg = (raw: unknown): boolean => { const s = toText(raw).trim(); return CELL_REF_RE.test(s) || FUNC_CALL_RE.test(s); };

/** 1 giá trị thì giữ nguyên kiểu (số vẫn là số); nhiều giá trị thì nối bằng ".\n" như cách gộp mặc định */
export function joinValues(values: unknown[]): unknown {
  const vals = values.filter((v) => !isBlankV(v));
  if (!vals.length) return '';
  if (vals.length === 1) return vals[0];
  return vals.map(toText).join('.\n');
}

function splitArguments(content: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  let paren = 0;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if ((ch === '"' || ch === "'") && (i === 0 || content[i - 1] !== '\\')) {
      if (!inQuotes) { inQuotes = true; quoteChar = ch; }
      else if (quoteChar === ch) inQuotes = false;
      current += ch;
    } else if (ch === '(' && !inQuotes) { paren++; current += ch; }
    else if (ch === ')' && !inQuotes) { paren--; current += ch; }
    else if (ch === ',' && !inQuotes && paren === 0) { args.push(current); current = ''; }
    else current += ch;
  }
  if (current.trim() !== '') args.push(current);
  return args;
}

export function createEvaluator(map: EntriesMap, L: FormulaLabels): (formula: string, baseCellRef: string) => unknown {
  const entriesOf = (ref: string): Entry[] => map[String(ref).toUpperCase()] || [];
  const refNode = (ref: string): VecNode => { const e = entriesOf(ref); return V(e.map((x) => x.value), e.map((x) => x.src)); };

  function resolveArg(argStr: string, base: string, depth: number): Node {
    argStr = argStr.trim();
    if (FUNC_CALL_RE.test(argStr)) return parseAndEval(argStr, depth + 1, base);
    if (CELL_REF_RE.test(argStr)) return refNode(argStr.toUpperCase());
    const q = unquote(argStr);
    if (q !== null) return S(q);
    if (argStr !== '' && !Number.isNaN(Number(argStr))) return S(parseFloat(argStr));
    return S(argStr);
  }

  function exec(fnNameRaw: string, argNodes: Node[], rawArgs: string[], rawUntrimmed: string[], base: string): Node {
    const fn = fnNameRaw.toUpperCase();
    const nArgs = argNodes.length;
    const baseNode = (): Node => (base ? refNode(base) : V([]));
    const argOrBase = (idx: number): Node => (argNodes[idx] !== undefined ? argNodes[idx] : baseNode());
    const literalArg = (idx: number): string | undefined => {
      const raw = rawArgs[idx];
      if (raw === undefined) return undefined;
      const q = unquote(raw);
      return q !== null ? q : raw;
    };
    // Ký tự phân cách: không nháy thì giữ nguyên khoảng trắng, VD: CONCAT( - , A1) → " - "
    const separatorArg = (idx: number, fallback: string): string => {
      const raw = rawArgs[idx];
      if (raw === undefined) return fallback;
      const q = unquote(raw);
      return q !== null ? q : rawUntrimmed[idx];
    };

    let dataNode: Node;
    let condStr = '';
    switch (fn) {
      case 'SUM_IF': case 'COUNT_IF': case 'AVERAGE_IF': case 'ANY': case 'ALL':
        if (nArgs >= 2) { condStr = rawArgs[0]; dataNode = argNodes[1]; }
        else if (nArgs === 1 && isDataArg(rawArgs[0])) dataNode = argNodes[0];
        else { condStr = rawArgs[0] || ''; dataNode = baseNode(); }
        break;
      case 'JOIN_UNIQUE': dataNode = nArgs >= 2 ? argNodes[1] : argOrBase(0); break;
      case 'REPLACE': dataNode = nArgs >= 3 ? argNodes[2] : baseNode(); break;
      case 'IF': dataNode = nArgs >= 4 ? argNodes[3] : baseNode(); break;
      default: dataNode = argOrBase(0);
    }

    const primary = toFlat(dataNode).filter((v) => !isBlankV(v));
    const numbers = primary.map(toNumber).filter((n) => !Number.isNaN(n));
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

    switch (fn) {
      case 'FIRST': return S(primary.length ? primary[0] : '');
      case 'LAST': return S(primary.length ? primary[primary.length - 1] : '');
      case 'MIN': return S(numbers.length ? Math.min(...numbers) : '');
      case 'MAX': return S(numbers.length ? Math.max(...numbers) : '');
      case 'UNIQUE': return S([...new Set(primary.map(toText))].join(', '));
      case 'SUM': return S(numbers.length ? sum(numbers) : '');
      case 'COUNT': return S(primary.length);
      case 'AVERAGE': return S(numbers.length ? sum(numbers) / numbers.length : '');
      case 'MEDIAN': {
        if (!numbers.length) return S('');
        const sorted = [...numbers].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return S(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
      }
      case 'GROUP_BY': {
        const counts: Record<string, number> = {};
        primary.forEach((v) => { const k = toText(v); counts[k] = (counts[k] || 0) + 1; });
        return S(Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(', '));
      }
      case 'IF': {
        const cond = rawArgs[0] || '';
        const trueNode = nArgs > 1 ? argNodes[1] : S('TRUE');
        const falseNode = nArgs > 2 ? argNodes[2] : S('FALSE');
        // Dạng IF(B1="Nam", đúng, sai): so sánh giá trị ô B1 của TỪNG nguồn
        const refMatch = cond.match(/^([A-Za-z]{1,3}\d+)\s*(==|!=|<>|>=|<=|=|>|<)\s*([\s\S]*)$/);
        if (refMatch) {
          const condNode = refNode(refMatch[1].toUpperCase());
          const test = makeCondition(refMatch[2] + refMatch[3]);
          const srcs = unionSources([condNode, dataNode, trueNode, falseNode]);
          if (!srcs.length) return S(test('') ? valAt(trueNode, 0) : valAt(falseNode, 0));
          return V(srcs.map((s, i) => (test(valAtSrc(condNode, s, i)) ? valAtSrc(trueNode, s, i) : valAtSrc(falseNode, s, i))), srcs);
        }
        // Dạng IF(>0, đúng, sai, A1): kiểm tra từng giá trị của ô dữ liệu
        const test = makeCondition(cond);
        if (!isVec(dataNode)) return S(test(dataNode.scalar) ? valAt(trueNode, 0) : valAt(falseNode, 0));
        if (!dataNode.vector.length) return S('');
        const dn = dataNode;
        return V(dn.vector.map((v, i) => {
          const s = dn.src ? dn.src[i] : undefined;
          return test(v) ? valAtSrc(trueNode, s, i) : valAtSrc(falseNode, s, i);
        }), dn.src);
      }
      case 'SUM_IF': { const t = makeCondition(condStr); return S(sum(numbers.filter((n) => t(n)))); }
      case 'COUNT_IF': { const t = makeCondition(condStr); return S(primary.filter((v) => t(v)).length); }
      case 'AVERAGE_IF': {
        const t = makeCondition(condStr);
        const f = numbers.filter((n) => t(n));
        return S(f.length ? sum(f) / f.length : '');
      }
      case 'ANY': { const t = makeCondition(condStr); return S(primary.some((v) => t(v)) ? 'TRUE' : 'FALSE'); }
      case 'ALL': {
        if (!primary.length) return S('FALSE');
        const t = makeCondition(condStr);
        return S(primary.every((v) => t(v)) ? 'TRUE' : 'FALSE');
      }
      case 'CONCAT': {
        // CONCAT(phân cách, A1): nối các giá trị của A1 bằng ký tự phân cách
        if (nArgs === 2 && !isDataArg(rawArgs[0]) && isDataArg(rawArgs[1])) {
          return S(toFlat(argNodes[1]).filter((v) => !isBlankV(v)).map(toText).join(separatorArg(0, ' ')));
        }
        if (nArgs <= 1) return S(primary.map(toText).join(' '));
        // CONCAT(A1, IF(...), ". "): nối các tham số với nhau theo từng nguồn
        const srcs = unionSources(argNodes);
        let keys: { s: number | undefined; i: number }[];
        if (srcs.length) keys = srcs.map((s, i) => ({ s, i }));
        else {
          const maxLen = Math.max(...argNodes.map(vecLen));
          keys = Array.from({ length: maxLen }, (_, i) => ({ s: undefined, i }));
        }
        return S(keys.map(({ s, i }) => argNodes.map((n) => toText(valAtSrc(n, s, i))).join('')).join(''));
      }
      case 'JOIN_UNIQUE': {
        const sep = nArgs >= 2 ? separatorArg(0, ', ') : ', ';
        return S([...new Set(primary.map(toText))].join(sep));
      }
      case 'TRIM': return mapNode(dataNode, (v) => toText(v).trim());
      case 'UPPER': return mapNode(dataNode, (v) => toText(v).toUpperCase());
      case 'REPLACE': {
        const oldText = nArgs >= 2 ? literalArg(0) : '';
        const newText = nArgs >= 2 ? (literalArg(1) || '') : '';
        return mapNode(dataNode, (v) => (oldText ? toText(v).split(oldText).join(newText) : toText(v)));
      }
      case 'MIN_DATE': case 'MAX_DATE': case 'YEAR': case 'MONTH': case 'DATE_RANGE': {
        const dates = primary.map(parseDateValue).filter((d): d is Date => !!d);
        if (!dates.length) return S('');
        const times = dates.map((d) => d.getTime());
        const minD = new Date(Math.min(...times));
        const maxD = new Date(Math.max(...times));
        if (fn === 'MIN_DATE') return S(formatDate(minD));
        if (fn === 'MAX_DATE') return S(formatDate(maxD));
        if (fn === 'YEAR') return S(dates[0].getUTCFullYear());
        if (fn === 'MONTH') return S(dates[0].getUTCMonth() + 1);
        return S(`${formatDate(minD)} - ${formatDate(maxD)}`);
      }
      case 'MISSING': return S(primary.length === 0 ? L.missing : '');
      case 'DUPLICATE': {
        const seen = new Set<string>();
        let dup = false;
        primary.forEach((v) => { const k = toText(v); if (seen.has(k)) dup = true; seen.add(k); });
        return S(dup ? L.duplicate : '');
      }
      case 'VALID': return S(primary.length > 0 ? L.valid : L.invalid);
      case 'EXISTS': return S(primary.length > 0 ? 'TRUE' : 'FALSE');
      default:
        // Hàm không hỗ trợ: giữ cách gộp mặc định để không mất dữ liệu
        return S(joinValues(primary));
    }
  }

  function parseAndEval(str: string, depth: number, base: string): Node {
    if (depth > 5) return S(str);
    str = str.trim();
    const m = str.match(/^([A-Za-z_]+)\s*\(([\s\S]*)\)$/);
    if (!m) return resolveArg(str, base, depth);
    const rawUntrimmed = splitArguments(m[2]);
    const rawArgs = rawUntrimmed.map((a) => a.trim());
    const argNodes = rawArgs.map((a) => resolveArg(a, base, depth));
    return exec(m[1], argNodes, rawArgs, rawUntrimmed, base);
  }

  const toOutput = (n: Node): unknown => (isVec(n) ? joinValues(n.vector) : (n.scalar === undefined || n.scalar === null ? '' : n.scalar));

  return (formulaStr: string, baseCellRef: string): unknown => {
    const values = (ref: string) => entriesOf(ref).map((e) => e.value);
    if (!formulaStr) return joinValues(values(baseCellRef));
    formulaStr = formulaStr.trim();
    if (!formulaStr.includes('(')) {
      if (CELL_REF_RE.test(formulaStr)) return joinValues(values(formulaStr));
      const q = unquote(formulaStr);
      return q !== null ? q : formulaStr;
    }
    try {
      return toOutput(parseAndEval(formulaStr, 0, baseCellRef));
    } catch {
      return joinValues(values(baseCellRef));
    }
  };
}
