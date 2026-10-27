import { mountLayout } from '../layout';
import { $, copyText, escapeHtml, storage } from '../ui';
import { pageText, localeTag } from '../i18n';
import { evaluate, autoClose, ExprError, type AngleMode } from '../calc/expr';

mountLayout({ activeTool: 'scientific-calc' });
const T = pageText();
const LOCALE = localeTag();

const st = storage<{ mode: AngleMode; mem: number; ans: number; hist: { e: string; r: number }[] }>('sci-calc', { mode: 'deg', mem: 0, ans: 0, hist: [] });
let { mode, mem, ans, hist } = st.get();
const save = () => st.set({ mode, mem, ans, hist: hist.slice(0, 50) });

/** Nút bấm: [nhãn hiển thị, chuỗi chèn vào, lớp CSS] */
const KEYS: [string, string, string][] = [
  ['sin', 'sin(', 'k-fn'], ['cos', 'cos(', 'k-fn'], ['tan', 'tan(', 'k-fn'], ['(', '(', 'k-fn'], [')', ')', 'k-fn'], ['⌫', 'BS', 'k-fn k-del'],
  ['sin⁻¹', 'asin(', 'k-fn'], ['cos⁻¹', 'acos(', 'k-fn'], ['tan⁻¹', 'atan(', 'k-fn'], ['x²', '^2', 'k-fn'], ['xʸ', '^', 'k-fn'], ['AC', 'AC', 'k-fn k-del'],
  ['ln', 'ln(', 'k-fn'], ['log', 'log(', 'k-fn'], ['eˣ', 'e^', 'k-fn'], ['√', '√(', 'k-fn'], ['∛', '∛(', 'k-fn'], ['÷', '÷', 'k-op'],
  ['π', 'π', 'k-fn'], ['7', '7', ''], ['8', '8', ''], ['9', '9', ''], ['n!', '!', 'k-fn'], ['×', '×', 'k-op'],
  ['e', 'e', 'k-fn'], ['4', '4', ''], ['5', '5', ''], ['6', '6', ''], ['%', '%', 'k-fn'], ['−', '-', 'k-op'],
  ['Ans', 'Ans', 'k-fn'], ['1', '1', ''], ['2', '2', ''], ['3', '3', ''], ['1/x', '^(-1)', 'k-fn'], ['+', '+', 'k-op'],
  ['EXP', 'e', 'k-fn'], ['0', '0', ''], ['.', '.', ''], ['±', 'NEG', 'k-fn'], ['|x|', 'abs(', 'k-fn'], ['=', '=', 'k-eq'],
];
// "EXP" nhập số mũ cơ số 10, ví dụ 3×10^5 → chèn "×10^"
KEYS[KEYS.findIndex((k) => k[0] === 'EXP')][1] = '×10^';

$('#tool-root').innerHTML = `
  <div class="workspace">
    <section class="panel calc">
      <div class="row" style="justify-content:space-between">
        <div class="segmented" role="radiogroup" aria-label="${T('angle', 'Đơn vị góc')}">
          <label><input type="radio" name="mode" value="deg" /><span>${T('deg', 'Độ (DEG)')}</span></label>
          <label><input type="radio" name="mode" value="rad" /><span>${T('rad', 'Radian (RAD)')}</span></label>
        </div>
        <div class="row">
          <button type="button" class="btn btn-sm" data-mem="mc" title="${T('mcT', 'Xoá bộ nhớ')}">MC</button>
          <button type="button" class="btn btn-sm" data-mem="mr" title="${T('mrT', 'Lấy số trong bộ nhớ')}">MR</button>
          <button type="button" class="btn btn-sm" data-mem="m+" title="${T('mpT', 'Cộng kết quả vào bộ nhớ')}">M+</button>
          <button type="button" class="btn btn-sm" data-mem="m-" title="${T('mmT', 'Trừ kết quả khỏi bộ nhớ')}">M−</button>
        </div>
      </div>
      <div class="calc-screen">
        <input class="calc-expr" id="expr" inputmode="none" autocomplete="off" spellcheck="false" aria-label="${T('exprLabel', 'Biểu thức')}" />
        <div class="calc-result" id="res" aria-live="polite">0</div>
        <small id="memv" style="color:#9fb0c8"></small>
      </div>
      <div class="calc-keys" id="keys">
        ${KEYS.map(([l, v, c]) => `<button type="button" class="${c}" data-v="${escapeHtml(v)}">${l}</button>`).join('')}
      </div>
      <p class="note">${T('kbd', 'Gõ được bằng bàn phím: số, + - * / ^ ( ) ! %, Enter để tính, Esc để xoá. Viết tắt được: sin30, 2π, 3(4+5), √2.')}</p>
    </section>
    <section class="panel">
      <div class="row" style="justify-content:space-between">
        <div class="panel-title" style="margin:0">${T('history', 'Lịch sử phép tính')}</div>
        <button type="button" class="btn btn-sm" id="clear-hist">${T('clearHist', 'Xoá lịch sử')}</button>
      </div>
      <ul class="history" id="hist"></ul>
      <p class="note">${T('histTip', 'Bấm vào một dòng để dùng lại phép tính. Lịch sử chỉ lưu trên máy bạn.')}</p>
    </section>
  </div>
`;

const exprEl = $<HTMLInputElement>('#expr');
const resEl = $('#res');
const fmt = (n: number) => {
  if (Math.abs(n) >= 1e15 || (Math.abs(n) < 1e-6 && n !== 0)) return n.toExponential(10).replace(/\.?0+e/, 'e');
  return n.toLocaleString(LOCALE, { maximumFractionDigits: 12 });
};
const ERR: Record<ExprError['code'], string> = {
  syntax: T('eSyntax', 'Lỗi cú pháp'),
  paren: T('eParen', 'Thiếu ngoặc'),
  domain: T('eDomain', 'Ngoài miền xác định'),
  divzero: T('eDiv', 'Không chia được cho 0'),
  empty: '0',
  overflow: T('eOver', 'Số quá lớn'),
};

let justEvaluated = false;
function preview(): void {
  const s = exprEl.value;
  if (!s.trim()) { resEl.textContent = '0'; resEl.style.opacity = '1'; return; }
  try {
    const v = evaluate(autoClose(s), mode, ans);
    resEl.textContent = (justEvaluated ? '' : '= ') + fmt(v);
    resEl.style.opacity = justEvaluated ? '1' : '.7';
  } catch {
    resEl.textContent = justEvaluated ? resEl.textContent : '…';
    resEl.style.opacity = '.5';
  }
}

function compute(): void {
  const s = autoClose(exprEl.value);
  if (!s.trim()) return;
  try {
    const v = evaluate(s, mode, ans);
    ans = v;
    hist.unshift({ e: s, r: v });
    hist = hist.slice(0, 50);
    save();
    renderHist();
    resEl.textContent = fmt(v);
    resEl.style.opacity = '1';
    exprEl.value = s;
    justEvaluated = true;
  } catch (e) {
    resEl.textContent = e instanceof ExprError ? ERR[e.code] : ERR.syntax;
    resEl.style.opacity = '1';
  }
}

function insert(v: string): void {
  if (v === 'AC') { exprEl.value = ''; justEvaluated = false; preview(); return; }
  if (v === 'BS') {
    const p = exprEl.selectionStart ?? exprEl.value.length;
    const q = exprEl.selectionEnd ?? p;
    if (p !== q) exprEl.value = exprEl.value.slice(0, p) + exprEl.value.slice(q);
    else if (p > 0) {
      // Xoá nguyên tên hàm nếu con trỏ đứng sau "sin(" ...
      const before = exprEl.value.slice(0, p);
      const m = /(asinh|acosh|atanh|asin|acos|atan|sinh|cosh|tanh|sin|cos|tan|log2|log|ln|sqrt|cbrt|abs|exp|Ans)\($|Ans$/.exec(before);
      const cut = m ? m[0].length : 1;
      exprEl.value = before.slice(0, -cut) + exprEl.value.slice(p);
      exprEl.setSelectionRange(p - cut, p - cut);
    }
    justEvaluated = false;
    preview();
    return;
  }
  if (v === '=') { compute(); return; }
  if (v === 'NEG') { exprEl.value = exprEl.value ? `-(${exprEl.value})` : '-'; justEvaluated = false; preview(); return; }
  // Sau khi bấm "=", gõ toán tử thì nối tiếp kết quả (Ans), gõ số thì bắt đầu phép mới
  if (justEvaluated) exprEl.value = /^[+\-×÷*/^!%]/.test(v) ? 'Ans' : '';
  justEvaluated = false;
  const p = exprEl.selectionStart ?? exprEl.value.length;
  const q = exprEl.selectionEnd ?? p;
  exprEl.value = exprEl.value.slice(0, p) + v + exprEl.value.slice(q);
  exprEl.setSelectionRange(p + v.length, p + v.length);
  preview();
}

function renderHist(): void {
  $('#hist').innerHTML = hist.length
    ? hist.map((h, i) => `<li data-i="${i}"><span>${escapeHtml(h.e)}</span>= ${escapeHtml(fmt(h.r))}</li>`).join('')
    : `<li style="cursor:default;text-align:left;color:var(--muted)">${T('noHist', 'Chưa có phép tính nào.')}</li>`;
}
function renderMem(): void {
  $('#memv').textContent = mem ? `M = ${fmt(mem)}` : '';
}

$('#keys').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-v]');
  if (!b) return;
  insert(b.dataset.v as string);
  if (!matchMedia('(pointer: coarse)').matches) exprEl.focus();
});
exprEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); compute(); }
  else if (e.key === 'Escape') { e.preventDefault(); insert('AC'); }
  else if (justEvaluated && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    insert(e.key === '*' ? '×' : e.key === '/' ? '÷' : e.key);
  }
});
exprEl.addEventListener('input', () => { justEvaluated = false; preview(); });
document.querySelectorAll<HTMLInputElement>('input[name=mode]').forEach((r) => {
  r.checked = r.value === mode;
  r.addEventListener('change', () => { mode = r.value as AngleMode; save(); preview(); });
});
document.querySelectorAll<HTMLButtonElement>('[data-mem]').forEach((b) => b.addEventListener('click', () => {
  let cur = ans;
  try { if (exprEl.value.trim()) cur = evaluate(autoClose(exprEl.value), mode, ans); } catch { /* giữ Ans */ }
  switch (b.dataset.mem) {
    case 'mc': mem = 0; break;
    case 'mr': insert(String(mem)); break;
    case 'm+': mem += cur; break;
    case 'm-': mem -= cur; break;
  }
  save();
  renderMem();
}));
$('#hist').addEventListener('click', (e) => {
  const li = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
  if (!li) return;
  const h = hist[Number(li.dataset.i)];
  exprEl.value = h.e;
  justEvaluated = false;
  preview();
  exprEl.focus();
});
$('#hist').addEventListener('contextmenu', (e) => {
  const li = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
  if (!li) return;
  e.preventDefault();
  void copyText(String(hist[Number(li.dataset.i)].r));
});
$('#clear-hist').addEventListener('click', () => { hist = []; save(); renderHist(); });
renderHist();
renderMem();
preview();
if (!matchMedia('(pointer: coarse)').matches) exprEl.focus();
