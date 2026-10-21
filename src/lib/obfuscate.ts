/**
 * Làm rối mã JavaScript dựa trên cây cú pháp (acorn) rồi sửa trực tiếp trên văn bản gốc
 * theo vị trí từng nút, nên phần không đụng tới được giữ nguyên.
 *
 * Các bước (bật/tắt được):
 *  - Gom chuỗi vào một mảng mã hoá base64, thay mỗi chuỗi bằng lời gọi hàm giải mã.
 *  - Đổi số sang dạng thập lục phân (hex).
 *  - Đổi tên biến, tham số cục bộ trong hàm thành tên khó đọc (_0x…). Biến toàn cục giữ nguyên.
 *  - Gói toàn bộ trong eval(atob(...)) để che mã (tuỳ chọn).
 */
import { loadAcorn, type AcornNode } from './codetools';

export interface ObfuscateOptions {
  strings: boolean;
  numbers: boolean;
  renameLocals: boolean;
  packer: boolean;
  module: boolean;
}

interface Edit { start: number; end: number; text: string }

type Node = AcornNode & { [k: string]: unknown };

/** Duyệt cây, gọi visit(node, parent, key) cho mọi nút con có .type */
function walk(node: Node, visit: (n: Node, parent: Node | null, key: string) => void, parent: Node | null = null, key = ''): void {
  visit(node, parent, key);
  for (const k in node) {
    if (k === 'type' || k === 'start' || k === 'end') continue;
    const v = (node as Record<string, unknown>)[k];
    if (Array.isArray(v)) {
      for (const c of v) if (c && typeof c === 'object' && typeof (c as Node).type === 'string') walk(c as Node, visit, node, k);
    } else if (v && typeof v === 'object' && typeof (v as Node).type === 'string') {
      walk(v as Node, visit, node, k);
    }
  }
}

/* ---------- Base64 an toàn Unicode ---------- */

function b64encode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/* ---------- Đổi tên biến cục bộ ---------- */

interface Binding { rename: string | null }
interface Scope { parent: Scope | null; isFn: boolean; vars: Map<string, Binding> }

const RESERVED = new Set(['arguments', 'this', 'super', 'undefined', 'NaN', 'Infinity']);

function collectRenames(ast: Node, counter: { n: number }): Map<Node, string> {
  const result = new Map<Node, string>(); // nút Identifier -> tên mới
  let bail = false;
  const newName = () => `_0x${(0xa000 + counter.n++).toString(16)}`;

  const makeScope = (parent: Scope | null, isFn: boolean): Scope => ({ parent, isFn, vars: new Map() });
  const resolve = (s: Scope, name: string): Binding | null => { for (let c: Scope | null = s; c; c = c.parent) { const b = c.vars.get(name); if (b) return b; } return null; };

  // Khai báo một tên vào scope; chỉ đổi tên biến nằm trong hàm (không đụng toàn cục)
  const declare = (scope: Scope, name: string, renamable: boolean): Binding => {
    let b = scope.vars.get(name);
    if (!b) {
      b = { rename: renamable && !RESERVED.has(name) ? newName() : null };
      scope.vars.set(name, b);
    }
    return b;
  };

  // Lấy các tên ràng buộc từ một mẫu (destructuring)
  const patternNames = (node: Node, out: { node: Node; name: string; rename: boolean }[], rename = true): void => {
    if (!node) return;
    if (node.type === 'Identifier') out.push({ node, name: node.name as string, rename });
    else if (node.type === 'ObjectPattern') for (const p of node.properties as Node[]) {
      if (p.type === 'RestElement') patternNames(p.argument as Node, out, rename);
      // {p} viết tắt: khoá và biến dùng chung một đoạn mã nguồn nên không đổi tên để khỏi hỏng
      else patternNames(p.value as Node, out, rename && !p.shorthand);
    }
    else if (node.type === 'ArrayPattern') for (const el of node.elements as (Node | null)[]) el && patternNames(el, out, rename);
    else if (node.type === 'RestElement') patternNames(node.argument as Node, out, rename);
    else if (node.type === 'AssignmentPattern') patternNames(node.left as Node, out, rename);
  };

  // Gom các khai báo `var` của một hàm (hoist), không xuống thân hàm con
  const hoistVars = (node: Node, fn: Scope): void => {
    const rec = (n: Node): void => {
      if (!n || typeof n.type !== 'string') return;
      if (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') {
        if (n !== node) return; // không vào thân hàm con
      }
      if (n.type === 'VariableDeclaration' && n.kind === 'var') {
        for (const d of n.declarations as Node[]) {
          const names: { node: Node; name: string; rename: boolean }[] = [];
          patternNames(d.id as Node, names);
          for (const x of names) declare(fn, x.name, x.rename);
        }
      }
      for (const k in n) {
        if (k === 'type' || k === 'start' || k === 'end') continue;
        const v = (n as Record<string, unknown>)[k];
        if (Array.isArray(v)) for (const c of v) { if (c && typeof (c as Node).type === 'string') rec(c as Node); }
        else if (v && typeof (v as Node).type === 'string') rec(v as Node);
      }
    };
    for (const k in node) {
      if (k === 'type' || k === 'start' || k === 'end') continue;
      const v = (node as Record<string, unknown>)[k];
      if (Array.isArray(v)) for (const c of v) { if (c && typeof (c as Node).type === 'string') rec(c as Node); }
      else if (v && typeof (v as Node).type === 'string') rec(v as Node);
    }
  };

  const declareBlockLexical = (stmts: Node[], scope: Scope): void => {
    for (const st of stmts) {
      if (st.type === 'VariableDeclaration' && (st.kind === 'let' || st.kind === 'const')) {
        for (const d of st.declarations as Node[]) {
          const names: { node: Node; name: string; rename: boolean }[] = [];
          patternNames(d.id as Node, names);
          for (const x of names) declare(scope, x.name, x.rename);
        }
      } else if (st.type === 'FunctionDeclaration' && st.id) {
        declare(scope, (st.id as Node).name as string, true);
      } else if (st.type === 'ClassDeclaration' && st.id) {
        declare(scope, (st.id as Node).name as string, true);
      }
    }
  };

  // Đệ quy chính: gán binding cho nút khai báo, ghi nhận tham chiếu Identifier
  const visitNode = (node: Node, scope: Scope): void => {
    if (bail) return;
    switch (node.type) {
      case 'WithStatement':
        bail = true;
        return;
      case 'Program': {
        // Toàn cục: KHÔNG đổi tên; chỉ khai báo để tham chiếu khớp (renamable=false)
        const top = scope;
        for (const st of node.body as Node[]) {
          if (st.type === 'VariableDeclaration') for (const d of st.declarations as Node[]) {
            const names: { node: Node; name: string; rename: boolean }[] = [];
            patternNames(d.id as Node, names);
            for (const x of names) declare(top, x.name, false);
          } else if ((st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration') && st.id) declare(top, (st.id as Node).name as string, false);
        }
        for (const st of node.body as Node[]) visitNode(st, top);
        return;
      }
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression': {
        // tên hàm biểu thức có thể tự tham chiếu trong thân -> khai báo ở scope hàm
        const fn = makeScope(scope, true);
        // Tên của hàm biểu thức chỉ nhìn thấy bên trong nó -> khai báo trong scope hàm.
        // Tên hàm khai báo (FunctionDeclaration) đã đăng ký ở scope bao ngoài, không lặp lại ở đây.
        if (node.type === 'FunctionExpression' && node.id) {
          const b = declare(fn, (node.id as Node).name as string, true);
          if (b.rename) result.set(node.id as Node, b.rename);
        }
        const params: { node: Node; name: string; rename: boolean }[] = [];
        for (const p of node.params as Node[]) patternNames(p, params);
        for (const p of params) { const b = declare(fn, p.name, p.rename); if (b.rename) result.set(p.node, b.rename); }
        // thân hàm
        const body = node.body as Node;
        if (body.type === 'BlockStatement') {
          hoistVars(body, fn);
          const block = makeScope(fn, false);
          declareBlockLexical(body.body as Node[], block);
          markDeclRenames(body.body as Node[], block);
          for (const st of body.body as Node[]) visitNode(st, block);
        } else {
          visitNode(body, fn); // arrow trả về biểu thức
        }
        // tham số có giá trị mặc định tham chiếu scope hàm
        for (const p of node.params as Node[]) visitDefaults(p, fn);
        return;
      }
      case 'BlockStatement': {
        const block = makeScope(scope, false);
        declareBlockLexical(node.body as Node[], block);
        markDeclRenames(node.body as Node[], block);
        for (const st of node.body as Node[]) visitNode(st, block);
        return;
      }
      case 'ForStatement':
      case 'ForInStatement':
      case 'ForOfStatement': {
        const block = makeScope(scope, false);
        // biến khai báo trong phần đầu for (let i...)
        const head = (node.init ?? node.left) as Node | undefined;
        if (head && head.type === 'VariableDeclaration' && head.kind !== 'var') {
          for (const d of head.declarations as Node[]) {
            const names: { node: Node; name: string; rename: boolean }[] = [];
            patternNames(d.id as Node, names);
            for (const x of names) { const b = declare(block, x.name, x.rename); if (b.rename) result.set(x.node, b.rename); }
          }
        }
        for (const k of ['init', 'left', 'test', 'update', 'right', 'body'] as const) {
          const child = node[k] as Node | undefined;
          if (child && !(k === 'body' && (child as Node).type === 'BlockStatement')) visitNode(child, block);
          else if (child) visitNode(child, block);
        }
        return;
      }
      case 'CatchClause': {
        const block = makeScope(scope, false);
        if (node.param) {
          const names: { node: Node; name: string; rename: boolean }[] = [];
          patternNames(node.param as Node, names);
          for (const x of names) { const b = declare(block, x.name, x.rename); if (b.rename) result.set(x.node, b.rename); }
        }
        visitNode(node.body as Node, block);
        return;
      }
      case 'VariableDeclaration': {
        for (const d of node.declarations as Node[]) {
          // gán rename cho các id khai báo (nếu scope đã đăng ký)
          markPattern(d.id as Node, scope);
          if (d.init) visitNode(d.init as Node, scope);
        }
        return;
      }
      case 'ClassDeclaration':
      case 'ClassExpression': {
        if (node.id) {
          const b = resolve(scope, (node.id as Node).name as string);
          if (b?.rename) result.set(node.id as Node, b.rename);
        }
        if (node.superClass) visitNode(node.superClass as Node, scope);
        visitNode(node.body as Node, scope);
        return;
      }
      case 'MemberExpression': {
        visitNode(node.object as Node, scope);
        if (node.computed) visitNode(node.property as Node, scope);
        return;
      }
      case 'Property': {
        if (node.computed) visitNode(node.key as Node, scope);
        // shorthand {a} -> key và value cùng là một Identifier tham chiếu
        visitNode(node.value as Node, scope);
        return;
      }
      case 'MethodDefinition':
      case 'PropertyDefinition': {
        if (node.computed) visitNode(node.key as Node, scope);
        if (node.value) visitNode(node.value as Node, scope);
        return;
      }
      case 'LabeledStatement': {
        visitNode(node.body as Node, scope); // bỏ qua node.label
        return;
      }
      case 'ImportDeclaration':
      case 'ExportNamedDeclaration':
      case 'ExportAllDeclaration':
      case 'ExportDefaultDeclaration': {
        // giữ nguyên tên import/export (liên quan tới module khác)
        if (node.type === 'ExportNamedDeclaration' && node.declaration) visitNode(node.declaration as Node, scope);
        if (node.type === 'ExportDefaultDeclaration') visitNode(node.declaration as Node, scope);
        return;
      }
      case 'Identifier': {
        const b = resolve(scope, node.name as string);
        if (b?.rename) result.set(node, b.rename);
        return;
      }
      default:
        for (const k in node) {
          if (k === 'type' || k === 'start' || k === 'end') continue;
          const v = (node as Record<string, unknown>)[k];
          if (Array.isArray(v)) for (const c of v) { if (c && typeof (c as Node).type === 'string') visitNode(c as Node, scope); }
          else if (v && typeof (v as Node).type === 'string') visitNode(v as Node, scope);
        }
    }
  };

  // Gán rename cho id trong khai báo đã được declareBlockLexical/hoist đăng ký trước
  const markDeclRenames = (stmts: Node[], scope: Scope): void => {
    for (const st of stmts) {
      if (st.type === 'VariableDeclaration' && (st.kind === 'let' || st.kind === 'const')) for (const d of st.declarations as Node[]) markPattern(d.id as Node, scope);
      else if ((st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration') && st.id) {
        const b = resolve(scope, (st.id as Node).name as string);
        if (b?.rename) result.set(st.id as Node, b.rename);
      }
    }
  };
  const markPattern = (node: Node, scope: Scope): void => {
    const names: { node: Node; name: string; rename: boolean }[] = [];
    patternNames(node, names);
    for (const x of names) { const b = resolve(scope, x.name); if (b?.rename) result.set(x.node, b.rename); }
  };
  const visitDefaults = (p: Node, scope: Scope): void => {
    if (p.type === 'AssignmentPattern' && p.right) visitNode(p.right as Node, scope);
  };

  const root = makeScope(null, false);
  // kiểm tra eval để bỏ đổi tên nếu có
  walk(ast, (n) => { if (n.type === 'Identifier' && n.name === 'eval') bail = true; });
  if (!bail) visitNode(ast, root);
  return bail ? new Map() : result;
}

/* ---------- Hàm chính ---------- */

export async function obfuscate(src: string, opts: ObfuscateOptions): Promise<string> {
  if (!src.trim()) return '';
  const acorn = await loadAcorn();
  let ast: Node;
  try {
    ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: opts.module ? 'module' : 'script', allowReturnOutsideFunction: !opts.module, allowAwaitOutsideFunction: true }) as Node;
  } catch (e) {
    throw new Error(`Mã JavaScript có lỗi cú pháp nên chưa làm rối được: ${(e as Error).message}`);
  }

  const edits: Edit[] = [];
  const strings: string[] = [];
  const stringIndex = new Map<string, number>();
  const counter = { n: 0 };
  const renames = opts.renameLocals ? collectRenames(ast, counter) : new Map<Node, string>();
  for (const [node, name] of renames) edits.push({ start: node.start, end: node.end, text: name });

  const SA = `_0x${(0x9000).toString(16)}`; // tên mảng chuỗi
  const DEC = `_0x${(0x9100).toString(16)}`; // tên hàm giải mã

  walk(ast, (node, parent, key) => {
    if (node.type !== 'Literal') return;
    const val = (node as { value?: unknown }).value;
    // chuỗi
    if (opts.strings && typeof val === 'string') {
      if (parent && (parent.type === 'Property' || parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && key === 'key' && !parent.computed) return;
      if (parent && (parent.type === 'ImportDeclaration' || parent.type === 'ExportNamedDeclaration' || parent.type === 'ExportAllDeclaration') && key === 'source') return;
      if (parent && parent.type === 'ImportAttribute') return;
      if (parent && parent.type === 'ExpressionStatement' && 'directive' in parent) return; // 'use strict'
      let idx = stringIndex.get(val);
      if (idx === undefined) { idx = strings.length; strings.push(val); stringIndex.set(val, idx); }
      edits.push({ start: node.start, end: node.end, text: `${DEC}(${idx})` });
      return;
    }
    // số
    if (opts.numbers && typeof val === 'number' && Number.isFinite(val)) {
      const raw = (node as { raw?: string }).raw ?? '';
      if (/^0[xXbBoO]/.test(raw) || raw.includes('n')) return; // đã là hex/bin/bigint
      if (parent && parent.type === 'Property' && key === 'key' && !parent.computed) return;
      if (!Number.isInteger(val)) return; // giữ số thập phân cho dễ đúng
      if (Math.abs(val) > Number.MAX_SAFE_INTEGER) return;
      const hex = (val < 0 ? '-0x' : '0x') + Math.abs(val).toString(16);
      edits.push({ start: node.start, end: node.end, text: hex });
    }
  });

  // Áp các sửa đổi theo vị trí (từ cuối về đầu để không lệch offset)
  edits.sort((a, b) => b.start - a.start);
  let out = src;
  let lastStart = Infinity;
  for (const e of edits) {
    if (e.end > lastStart) continue; // tránh chồng lấn (phòng hờ)
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
    lastStart = e.start;
  }

  // Chèn mảng chuỗi + hàm giải mã lên đầu
  if (opts.strings && strings.length) {
    const arr = strings.map((s) => JSON.stringify(b64encode(s))).join(',');
    const CACHE = `${SA}c`;
    const prelude =
      `var ${SA}=[${arr}],${CACHE}={};` +
      `function ${DEC}(i){if(i in ${CACHE})return ${CACHE}[i];` +
      `var b=atob(${SA}[i]),u=new Uint8Array(b.length);for(var j=0;j<b.length;j++)u[j]=b.charCodeAt(j);` +
      `var r=new TextDecoder().decode(u);${CACHE}[i]=r;return r;}`;
    out = prelude + '\n' + out;
  }

  // Gói trong eval(atob(...)) — không dùng được khi là module (có import/export)
  if (opts.packer && !opts.module) {
    out = `eval(function(c){var b=atob(c),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return new TextDecoder().decode(u);}(${JSON.stringify(b64encode(out))}));`;
  }

  // Tự kiểm: kết quả phải phân tích lại được, nếu không thì báo lỗi để người dùng biết
  try {
    acorn.parse(out, { ecmaVersion: 'latest', sourceType: opts.module ? 'module' : 'script', allowReturnOutsideFunction: !opts.module, allowAwaitOutsideFunction: true });
  } catch {
    throw new Error('Không tạo được mã đã làm rối hợp lệ cho đoạn mã này. Hãy thử tắt bớt tuỳ chọn (ví dụ "Đổi tên biến").');
  }
  return out;
}
