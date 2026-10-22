/** Nền tảng cho nhóm Công cụ tin học: nạp thư viện, kiểm lỗi, làm rối mã JavaScript */
import { CDN, global, loadScript } from './cdn';
import { t, tf } from '../i18n';

/* ---------------- Nạp thư viện ---------------- */

type BeautifyFn = (src: string, opts: Record<string, unknown>) => string;
interface Beautify { js: BeautifyFn; css: BeautifyFn; html: BeautifyFn }

export async function loadBeautify(): Promise<Beautify> {
  // Nạp tuần tự: beautify-html cần js_beautify và css_beautify có sẵn trước
  await loadScript(CDN.beautifyJs, 'js_beautify');
  await loadScript(CDN.beautifyCss, 'css_beautify');
  await loadScript(CDN.beautifyHtml, 'html_beautify');
  return { js: global<BeautifyFn>('js_beautify'), css: global<BeautifyFn>('css_beautify'), html: global<BeautifyFn>('html_beautify') };
}

export interface AcornPos { line: number; column: number }
export interface AcornNode { type: string; start: number; end: number; [k: string]: unknown }
export interface Acorn {
  parse(src: string, opts: Record<string, unknown>): AcornNode;
}
export async function loadAcorn(): Promise<Acorn> {
  await loadScript(CDN.acorn, 'acorn');
  return global<Acorn>('acorn');
}

/* ---------------- Vị trí dòng/cột ---------------- */

export interface CodeIssue { line: number; column: number; message: string; severity: 'error' | 'warning' }

const lineCol = (src: string, offset: number): AcornPos => {
  let line = 1;
  let last = -1;
  for (let i = 0; i < offset && i < src.length; i++) if (src[i] === '\n') { line++; last = i; }
  return { line, column: offset - last };
};

/* ---------------- Kiểm tra JSON ---------------- */

export function checkJson(src: string): CodeIssue[] {
  if (!src.trim()) return [];
  try {
    JSON.parse(src);
    return [];
  } catch (e) {
    const msg = (e as Error).message;
    const m = /position (\d+)/.exec(msg);
    let pos: AcornPos;
    const lm = /line (\d+) column (\d+)/.exec(msg);
    if (lm) pos = { line: Number(lm[1]), column: Number(lm[2]) };
    else pos = m ? lineCol(src, Number(m[1])) : { line: 1, column: 1 };
    return [{ ...pos, severity: 'error', message: translateJsonError(msg) }];
  }
}

function translateJsonError(msg: string): string {
  if (/Unexpected end of (JSON|input)/i.test(msg)) return t('lib.codetools.json.end', 'Thiếu phần kết thúc: còn ngoặc, ngoặc kép hoặc dấu chưa đóng.');
  if (/Unexpected token/i.test(msg)) {
    const tok = /Unexpected token (\S)/.exec(msg)?.[1];
    if (tok === ',') return t('lib.codetools.json.comma', 'Thừa dấu phẩy, hoặc thiếu giá trị trước dấu phẩy.');
    if (tok === '}' || tok === ']') return t('lib.codetools.json.closer', 'Thừa dấu phẩy trước dấu đóng, hoặc thiếu giá trị.');
    return tf('lib.codetools.json.badChar', 'Ký tự không hợp lệ{tok}. JSON cần ngoặc kép cho chuỗi và tên khoá.', { tok: tok ? ` "${tok}"` : '' });
  }
  if (/double-quoted property name/i.test(msg)) return t('lib.codetools.json.key', 'Tên khoá phải đặt trong ngoặc kép, ví dụ "ten".');
  if (/Bad control character|Bad escaped/i.test(msg)) return t('lib.codetools.json.control', 'Chuỗi chứa ký tự điều khiển hoặc dấu thoát không hợp lệ.');
  return t('lib.codetools.json.invalid', 'JSON không hợp lệ.');
}

/* ---------------- Kiểm tra JavaScript (acorn) ---------------- */

export async function checkJs(src: string, module: boolean): Promise<CodeIssue[]> {
  if (!src.trim()) return [];
  const acorn = await loadAcorn();
  try {
    acorn.parse(src, { ecmaVersion: 'latest', sourceType: module ? 'module' : 'script', allowReturnOutsideFunction: !module, allowAwaitOutsideFunction: true, allowHashBang: true });
    return [];
  } catch (e) {
    const err = e as { message: string; loc?: AcornPos; pos?: number };
    const pos = err.loc ?? (err.pos !== undefined ? lineCol(src, err.pos) : { line: 1, column: 1 });
    // Bỏ phần "(line:col)" cuối thông báo gốc để hiển thị gọn
    return [{ line: pos.line, column: (pos.column ?? 0) + 1, severity: 'error', message: translateJsError(err.message.replace(/\s*\(\d+:\d+\)\s*$/, '')) }];
  }
}

function translateJsError(msg: string): string {
  if (/Unexpected end of input/i.test(msg)) return t('lib.codetools.js.end', 'Thiếu phần kết thúc: còn ngoặc { ( [ hoặc chuỗi chưa đóng.');
  if (/Unexpected token/i.test(msg)) return t('lib.codetools.js.token', 'Gặp ký tự không mong đợi: kiểm tra dấu ngoặc, dấu phẩy, dấu chấm phẩy.');
  if (/Unterminated string/i.test(msg)) return t('lib.codetools.string', 'Chuỗi chưa được đóng (thiếu dấu nháy).');
  if (/Unterminated comment/i.test(msg)) return t('lib.codetools.comment', 'Ghi chú /* */ chưa được đóng.');
  if (/already been declared/i.test(msg)) return tf('lib.codetools.js.declared', '{msg} — biến này được khai báo trùng.', { msg });
  if (/is reserved/i.test(msg)) return t('lib.codetools.js.reserved', 'Dùng từ khoá dành riêng của JavaScript làm tên biến.');
  if (/Assigning to rvalue/i.test(msg)) return t('lib.codetools.js.rvalue', 'Gán sai: vế trái dấu = phải là biến.');
  return msg;
}

/* ---------------- Kiểm tra CSS ---------------- */

const CSS_AT_NO_BLOCK = /^@(import|charset|namespace)\b/i;

export function checkCss(src: string): CodeIssue[] {
  const issues: CodeIssue[] = [];
  const stack: number[] = []; // offset của mỗi "{" đang mở
  let i = 0;
  const n = src.length;
  let segStart = 0; // đầu đoạn hiện tại (sau { } hoặc ;)
  let sawColon = false;
  let sawContent = false;
  const add = (offset: number, message: string, severity: CodeIssue['severity'] = 'error') => {
    const p = lineCol(src, offset);
    issues.push({ line: p.line, column: p.column, message, severity });
  };
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end === -1) { add(i, t('lib.codetools.comment', 'Ghi chú /* */ chưa được đóng.')); break; }
      i = end + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const end = findStringEnd(src, i);
      if (end === -1) { add(i, t('lib.codetools.string', 'Chuỗi chưa được đóng (thiếu dấu nháy).')); break; }
      sawContent = true;
      i = end + 1;
      continue;
    }
    if (c === '{') {
      stack.push(i);
      segStart = i + 1;
      sawColon = false;
      sawContent = false;
    } else if (c === '}') {
      if (!stack.length) { add(i, t('lib.codetools.css.extraBrace', 'Dấu } thừa, không có { tương ứng.')); }
      else {
        const seg = src.slice(segStart, i);
        if (seg.trim() && !sawColon && stack.length && !/^@/.test(seg.trim())) add(segStart, t('lib.codetools.css.noColon', 'Khai báo thiếu dấu hai chấm ":" giữa thuộc tính và giá trị.'), 'warning');
        stack.pop();
      }
      segStart = i + 1;
      sawColon = false;
      sawContent = false;
    } else if (c === ':' && stack.length) {
      sawColon = true;
    } else if (c === ';') {
      segStart = i + 1;
      sawColon = false;
      sawContent = false;
    } else if (c === '@' && !stack.length) {
      // at-rule không có block (@import, @charset) cần dấu ;
      const semi = src.indexOf(';', i);
      const brace = src.indexOf('{', i);
      const rule = src.slice(i, (semi === -1 ? n : semi));
      if (CSS_AT_NO_BLOCK.test(rule.trim()) && (semi === -1 || (brace !== -1 && brace < semi))) add(i, t('lib.codetools.css.atSemi', 'Câu lệnh @import/@charset cần kết thúc bằng dấu ";".'));
      if (!/\s/.test(c)) sawContent = true;
    } else if (!/\s/.test(c)) {
      sawContent = true;
    }
    i++;
  }
  for (const open of stack) add(open, t('lib.codetools.css.openBrace', 'Dấu { chưa được đóng bằng }.'));
  if (!issues.length && !src.trim()) return [];
  if (!issues.length && sawContent && !stack.length) {
    // selector không có block ở cuối file
    const tail = src.slice(segStart).trim();
    if (tail && !tail.startsWith('@') && !tail.startsWith('/*')) add(segStart, t('lib.codetools.css.outside', 'Có nội dung ngoài khối {} — thiếu dấu { } bao quanh.'), 'warning');
  }
  return issues;
}

function findStringEnd(src: string, start: number): number {
  const q = src[start];
  for (let i = start + 1; i < src.length; i++) {
    if (src[i] === '\\') { i++; continue; }
    if (src[i] === q) return i;
    if (src[i] === '\n') return -1;
  }
  return -1;
}

/* ---------------- Kiểm tra HTML ---------------- */

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW_TAGS = new Set(['script', 'style', 'textarea', 'title', 'pre']);
// Thẻ có thể bỏ thẻ đóng theo HTML5, không cảnh báo khi chưa đóng
const OPTIONAL_CLOSE = new Set(['li', 'dt', 'dd', 'p', 'option', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'colgroup', 'caption', 'optgroup']);

export function checkHtml(src: string): CodeIssue[] {
  const issues: CodeIssue[] = [];
  const stack: { tag: string; offset: number }[] = [];
  const add = (offset: number, message: string, severity: CodeIssue['severity'] = 'warning') => {
    const p = lineCol(src, offset);
    issues.push({ line: p.line, column: p.column, message, severity });
  };
  let i = 0;
  const n = src.length;
  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt === -1) break;
    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt + 4);
      if (end === -1) { add(lt, t('lib.codetools.html.comment', 'Ghi chú <!-- --> chưa được đóng.'), 'error'); break; }
      i = end + 3;
      continue;
    }
    if (src[lt + 1] === '!' || src[lt + 1] === '?') { // doctype, xml decl
      const end = src.indexOf('>', lt);
      if (end === -1) { add(lt, t('lib.codetools.html.tagGt', 'Thẻ chưa được đóng bằng ">".'), 'error'); break; }
      i = end + 1;
      continue;
    }
    const close = src[lt + 1] === '/';
    const m = /^<\/?\s*([a-zA-Z][a-zA-Z0-9:-]*)/.exec(src.slice(lt));
    if (!m) { i = lt + 1; continue; }
    const gt = findTagEnd(src, lt);
    if (gt === -1) { add(lt, t('lib.codetools.html.tagGtQuote', 'Thẻ chưa được đóng bằng ">" (có thể do dấu nháy thuộc tính chưa đóng).'), 'error'); break; }
    const tag = m[1].toLowerCase();
    const selfClose = src[gt - 1] === '/';
    if (close) {
      // tìm thẻ mở gần nhất khớp
      let k = stack.length - 1;
      while (k >= 0 && stack[k].tag !== tag) k--;
      if (k < 0) add(lt, tf('lib.codetools.html.closeNoOpen', 'Thẻ đóng </{tag}> không có thẻ mở tương ứng.', { tag }));
      else {
        for (let j = stack.length - 1; j > k; j--) {
          if (!OPTIONAL_CLOSE.has(stack[j].tag)) add(stack[j].offset, tf('lib.codetools.html.notClosedBefore', 'Thẻ <{tag}> chưa được đóng trước </{close}>.', { tag: stack[j].tag, close: tag }));
        }
        stack.length = k;
      }
    } else {
      if (RAW_TAGS.has(tag) && !selfClose) {
        // bỏ qua nội dung thô tới thẻ đóng tương ứng
        const re = new RegExp(`</\\s*${tag}\\b`, 'i');
        const rest = src.slice(gt + 1);
        const ci = rest.search(re);
        if (ci === -1) { if (!VOID_TAGS.has(tag)) add(lt, tf('lib.codetools.html.notClosed', 'Thẻ <{tag}> chưa được đóng.', { tag })); i = n; continue; }
        i = gt + 1 + ci;
        continue;
      }
      if (!selfClose && !VOID_TAGS.has(tag)) stack.push({ tag, offset: lt });
    }
    i = gt + 1;
  }
  for (const s of stack) if (!OPTIONAL_CLOSE.has(s.tag)) add(s.offset, tf('lib.codetools.html.notClosed', 'Thẻ <{tag}> chưa được đóng.', { tag: s.tag }));
  return issues;
}

function findTagEnd(src: string, start: number): number {
  for (let i = start + 1; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'") {
      const end = src.indexOf(c, i + 1);
      if (end === -1) return -1;
      i = end;
    } else if (c === '>') return i;
  }
  return -1;
}
