import { mountLayout } from '../layout';
import { $ } from '../ui';
import { pageText } from '../i18n';
import { input, button, el, privacyNote, val, setVal, onChange } from '../lib/devkit';

mountLayout({ activeTool: 'contrast-check' });
const T = pageText();

$('#tool-root').innerHTML = `
  <div class="workspace" style="margin-top:24px">
    <div class="panel">
      <div class="field-row">${input('fg', T('fg', 'Màu chữ'), { type: 'color', value: '#16233a' })}${input('fgt', 'HEX', { mono: true, value: '#16233a' })}</div>
      <div class="field-row">${input('bg', T('bg', 'Màu nền'), { type: 'color', value: '#ffffff' })}${input('bgt', 'HEX', { mono: true, value: '#ffffff' })}</div>
      <div class="row">${button('swap', T('swap', 'Đổi chữ ↔ nền'))}${button('fix', T('fix', 'Gợi ý màu chữ đạt chuẩn AA'), true)}</div>
      <div class="stat stat--main"><span class="stat-label">${T('ratio', 'Tỉ lệ tương phản')}</span><span class="stat-value" id="ratio"></span></div>
      <table class="data-table dk-table"><thead><tr><th>${T('level', 'Mức')}</th><th>${T('normal', 'Chữ thường')}</th><th>${T('large', 'Chữ lớn (≥ 24px hoặc 18,5px đậm)')}</th></tr></thead><tbody id="res"></tbody></table>
    </div>
    <div class="panel">
      <div class="cc-demo" id="demo">
        <h3 style="margin:0 0 8px">${T('demoTitle', 'Tiêu đề mẫu')}</h3>
        <p style="margin:0 0 8px">${T('demoText', 'Đoạn văn mẫu để kiểm tra chữ có dễ đọc trên nền này không. Người lớn tuổi và người nhìn kém cần độ tương phản cao.')}</p>
        <small>${T('demoSmall', 'Chữ nhỏ 12px — chú thích, ghi chú')}</small>
        <p style="margin:12px 0 0"><span class="cc-btn" id="demoBtn">${T('demoBtn', 'Nút bấm')}</span></p>
      </div>
      <p class="note">${T('note', 'Theo chuẩn WCAG 2.1: mức AA cần tỉ lệ tối thiểu 4,5:1 cho chữ thường và 3:1 cho chữ lớn; mức AAA cần 7:1 và 4,5:1. Thành phần giao diện (viền ô nhập, biểu tượng) cần 3:1.')}</p>
    </div>
  </div>
  ${privacyNote()}
`;
const hex = (s: string): string | null => {
  let t = s.trim().replace(/^#?/, '#');
  if (/^#[0-9a-f]{3}$/i.test(t)) t = '#' + [...t.slice(1)].map((c) => c + c).join('');
  return /^#[0-9a-f]{6}$/i.test(t) ? t.toLowerCase() : null;
};
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (h: string) => { const [r, g, b] = rgb(h).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
function run(): void {
  const f = hex(val('fgt')) ?? val('fg'), b = hex(val('bgt')) ?? val('bg');
  setVal('fg', f); setVal('bg', b);
  const r = ratio(f, b);
  el('ratio').textContent = `${r.toFixed(2)} : 1`;
  const ok = (x: boolean) => (x ? `<b class="ok-text">✓ ${T('pass', 'Đạt')}</b>` : `<b class="error-text">✗ ${T('fail', 'Chưa đạt')}</b>`);
  el('res').innerHTML = `<tr><th>AA</th><td>${ok(r >= 4.5)}</td><td>${ok(r >= 3)}</td></tr><tr><th>AAA</th><td>${ok(r >= 7)}</td><td>${ok(r >= 4.5)}</td></tr><tr><th>${T('ui', 'Thành phần giao diện')}</th><td colspan="2">${ok(r >= 3)}</td></tr>`;
  const d = el('demo');
  d.style.color = f; d.style.background = b;
  el('demoBtn').style.background = f; el('demoBtn').style.color = b;
}
function suggest(): void {
  const b = val('bg');
  const [r0, g0, b0] = rgb(val('fg'));
  const dark = lum(b) > 0.18;
  for (let k = 0; k <= 100; k++) {
    const m = (v: number) => Math.round(dark ? v * (1 - k / 100) : v + (255 - v) * (k / 100));
    const c = '#' + [m(r0), m(g0), m(b0)].map((v) => v.toString(16).padStart(2, '0')).join('');
    if (ratio(c, b) >= 4.5) { setVal('fgt', c); run(); return; }
  }
}
el('fg').addEventListener('input', () => { setVal('fgt', val('fg')); run(); });
el('bg').addEventListener('input', () => { setVal('bgt', val('bg')); run(); });
onChange(['fgt', 'bgt'], run, 120);
el('swap').addEventListener('click', () => { const x = val('fgt'); setVal('fgt', val('bgt')); setVal('bgt', x); run(); });
el('fix').addEventListener('click', suggest);
run();
