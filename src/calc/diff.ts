/**
 * So sánh hai văn bản: thuật toán Myers O(ND) theo dòng, rồi so tiếp theo từ trong các dòng bị sửa.
 */

export type Op = 'equal' | 'insert' | 'delete';
export interface Edit<T> { op: Op; a?: T; b?: T }

/** Dãy thao tác biến a thành b (Myers, có lưu vết để dựng lại đường đi) */
export function myers<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean = (x, y) => x === y): Edit<T>[] {
  // Cắt phần đầu và cuối giống nhau để giảm khối lượng
  let start = 0;
  while (start < a.length && start < b.length && eq(a[start], b[start])) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && eq(a[endA - 1], b[endB - 1])) { endA--; endB--; }
  const A = a.slice(start, endA);
  const B = b.slice(start, endB);
  const head: Edit<T>[] = a.slice(0, start).map((x, i) => ({ op: 'equal', a: x, b: b[i] }));
  const tail: Edit<T>[] = a.slice(endA).map((x, i) => ({ op: 'equal', a: x, b: b[endB + i] }));

  const N = A.length;
  const M = B.length;
  const max = N + M;
  if (max === 0) return [...head, ...tail];
  const offset = max;
  let v: Int32Array = new Int32Array(2 * max + 2);
  const trace: Int32Array[] = [];
  let found = false;
  for (let d = 0; d <= max && !found; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? v[offset + k + 1] : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < N && y < M && eq(A[x], B[y])) { x++; y++; }
      v[offset + k] = x;
      if (x >= N && y >= M) { found = true; break; }
    }
    if (found) trace.push(v.slice());
  }

  // Lần ngược vết để dựng dãy thao tác
  const mid: Edit<T>[] = [];
  let x = N;
  let y = M;
  for (let d = trace.length - 2; d >= 0; d--) {
    v = trace[d];
    const k = x - y;
    const prevK = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? k + 1 : k - 1;
    const prevX = d === 0 ? 0 : v[offset + prevK];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) { mid.push({ op: 'equal', a: A[x - 1], b: B[y - 1] }); x--; y--; }
    if (d === 0) break;
    if (x === prevX) mid.push({ op: 'insert', b: B[y - 1] });
    else mid.push({ op: 'delete', a: A[x - 1] });
    x = prevX;
    y = prevY;
  }
  while (x > 0 && y > 0) { mid.push({ op: 'equal', a: A[x - 1], b: B[y - 1] }); x--; y--; }
  mid.reverse();
  return [...head, ...mid, ...tail];
}

export interface DiffOptions { ignoreCase: boolean; ignoreWhitespace: boolean; ignoreBlankLines: boolean }

export interface Segment { op: Op; text: string }
export interface Row {
  kind: 'equal' | 'change' | 'insert' | 'delete';
  leftNo?: number;
  rightNo?: number;
  left?: Segment[];
  right?: Segment[];
}
export interface DiffResult { rows: Row[]; added: number; removed: number; changed: number; same: number }

const normalize = (s: string, o: DiffOptions) => {
  let t = o.ignoreWhitespace ? s.replace(/\s+/g, ' ').trim() : s;
  if (o.ignoreCase) t = t.toLocaleLowerCase('vi');
  return t;
};

/** Tách thành từ và khoảng trắng để tô sáng đúng chỗ khác trong một dòng */
const tokens = (s: string) => s.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? [];

function wordDiff(a: string, b: string, o: DiffOptions): { left: Segment[]; right: Segment[] } {
  const ta = tokens(a);
  const tb = tokens(b);
  const edits = myers(ta, tb, (x, y) => normalize(x, o) === normalize(y, o));
  const left: Segment[] = [];
  const right: Segment[] = [];
  const push = (arr: Segment[], op: Op, text: string) => {
    const last = arr[arr.length - 1];
    if (last && last.op === op) last.text += text;
    else arr.push({ op, text });
  };
  for (const e of edits) {
    if (e.op === 'equal') { push(left, 'equal', e.a as string); push(right, 'equal', e.b as string); }
    else if (e.op === 'delete') push(left, 'delete', e.a as string);
    else push(right, 'insert', e.b as string);
  }
  return { left, right };
}

const MAX_LINES = 20000;

export function diffText(a: string, b: string, o: DiffOptions): DiffResult {
  const split = (s: string) => {
    const lines = s.replace(/\r\n?/g, '\n').split('\n').map((text, i) => ({ text, no: i + 1 }));
    return o.ignoreBlankLines ? lines.filter((l) => l.text.trim() !== '') : lines;
  };
  const la = split(a);
  const lb = split(b);
  if (la.length > MAX_LINES || lb.length > MAX_LINES) throw new Error(`Văn bản quá dài để so sánh (tối đa ${MAX_LINES.toLocaleString('vi-VN')} dòng mỗi bên).`);
  const edits = myers(la, lb, (x, y) => normalize(x.text, o) === normalize(y.text, o));

  const rows: Row[] = [];
  let added = 0, removed = 0, changed = 0, same = 0;
  for (let i = 0; i < edits.length; ) {
    if (edits[i].op === 'equal') {
      const e = edits[i++];
      rows.push({ kind: 'equal', leftNo: e.a!.no, rightNo: e.b!.no, left: [{ op: 'equal', text: e.a!.text }], right: [{ op: 'equal', text: e.b!.text }] });
      same++;
      continue;
    }
    // Gom một cụm xoá/thêm liền nhau, ghép từng cặp dòng thành "sửa" để so theo từ
    const dels: { text: string; no: number }[] = [];
    const ins: { text: string; no: number }[] = [];
    while (i < edits.length && edits[i].op !== 'equal') {
      if (edits[i].op === 'delete') dels.push(edits[i].a!);
      else ins.push(edits[i].b!);
      i++;
    }
    const pairs = Math.min(dels.length, ins.length);
    for (let k = 0; k < pairs; k++) {
      const wd = wordDiff(dels[k].text, ins[k].text, o);
      rows.push({ kind: 'change', leftNo: dels[k].no, rightNo: ins[k].no, ...wd });
      changed++;
    }
    for (let k = pairs; k < dels.length; k++) {
      rows.push({ kind: 'delete', leftNo: dels[k].no, left: [{ op: 'delete', text: dels[k].text }] });
      removed++;
    }
    for (let k = pairs; k < ins.length; k++) {
      rows.push({ kind: 'insert', rightNo: ins[k].no, right: [{ op: 'insert', text: ins[k].text }] });
      added++;
    }
  }
  return { rows, added, removed, changed, same };
}
