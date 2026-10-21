import { mountLayout } from '../layout';
import { $, copyText, escapeHtml } from '../ui';
import {
  HARMONY_LABELS, contrastRatio, harmony, hslText, parseHex, readableOn, rgbText, rgbToHsl, shadeScale, toHex,
  type Harmony, type RGB,
} from '../calc/color';
import { pageText } from '../i18n';

mountLayout({ activeTool: 'colors' });
const T = pageText();

$('#tool-root').innerHTML = `
  <div class="workspace tool-body">
    <form class="panel" id="color-form" novalidate>
      <div class="row">
        <input type="color" id="picker" value="#0d6efd" aria-label="${T('aria.pick','Chọn màu gốc')}" class="big-picker" />
        <label class="field" style="flex:1">
          <span class="field-label">${T('baseHex','Mã màu gốc (HEX)')}</span>
          <input id="hex" class="mono" type="text" value="#0d6efd" spellcheck="false" autocomplete="off" />
        </label>
      </div>
      <p class="error" id="color-error" hidden></p>
      <div class="table-wrap"><table class="data-table" id="codes"></table></div>
      <label class="field">
        <span class="field-label">${T('harmonyLabel','Kiểu phối màu')}</span>
        <select id="harmony">${(Object.keys(HARMONY_LABELS) as Harmony[]).map((k) => `<option value="${k}"${k === 'analogous' ? ' selected' : ''}>${T('harmony.' + k, HARMONY_LABELS[k])}</option>`).join('')}</select>
      </label>
      <button type="button" class="btn" id="random">${T('random','Màu ngẫu nhiên')}</button>
    </form>

    <section class="preview">
      <span class="field-label">${T('harmonyOut','Màu phối hợp (bấm để sao chép mã)')}</span>
      <div class="swatches" id="harmony-out"></div>
      <span class="field-label">${T('scaleOut','Thang sắc độ')}</span>
      <div class="swatches swatches--scale" id="scale-out"></div>
    </section>
  </div>

  <div class="workspace" style="margin-top:24px">
    <div class="panel">
      <h2 class="panel-title">${T('contrast.title','Kiểm tra độ tương phản chữ')}</h2>
      <div class="form-grid">
        <label class="field"><span class="field-label">${T('fg','Màu chữ')}</span><input id="fg" class="mono" type="text" value="#ffffff" /></label>
        <label class="field"><span class="field-label">${T('bg','Màu nền')}</span><input id="bg" class="mono" type="text" value="#0d6efd" /></label>
      </div>
      <div class="contrast-sample" id="contrast-sample">${T('sample','Chữ mẫu đọc có rõ không?')}</div>
      <p id="contrast-result" aria-live="polite"></p>
    </div>
    <div class="panel">
      <h2 class="panel-title">${T('css.title','Biến CSS')}</h2>
      <pre class="output" id="css-out"></pre>
      <div class="row"><button type="button" class="btn" id="css-copy">${T('css.copy','Sao chép CSS')}</button></div>
    </div>
  </div>
`;

const hexInput = $<HTMLInputElement>('#hex');
const picker = $<HTMLInputElement>('#picker');
let base: RGB = parseHex('#0d6efd') as RGB;

function swatch(c: RGB, label?: string): string {
  const hex = toHex(c);
  return `<button type="button" class="swatch" style="background:${hex};color:${readableOn(c)}" data-copy="${hex}" title="${T('copy','Sao chép')} ${hex}">
    ${label ? `<span>${escapeHtml(label)}</span>` : ''}<b>${hex}</b></button>`;
}

function render(): void {
  const hsl = rgbToHsl(base);
  $('#codes').innerHTML = `<tbody>
    ${[['HEX', toHex(base)], ['RGB', rgbText(base)], ['HSL', hslText(hsl)]]
      .map(([k, v]) => `<tr><td>${k}</td><td class="mono">${v} <button type="button" class="btn btn-sm" data-copy="${v}">${T('copy','Sao chép')}</button></td></tr>`)
      .join('')}
  </tbody>`;
  const kind = $<HTMLSelectElement>('#harmony').value as Harmony;
  const colors = harmony(base, kind);
  $('#harmony-out').innerHTML = colors.map((c) => swatch(c)).join('');
  const scale = shadeScale(base);
  $('#scale-out').innerHTML = scale.map((s) => swatch(s.color, String(s.step))).join('');
  $('#css-out').textContent = `:root {\n${scale.map((s) => `  --mau-${s.step}: ${toHex(s.color)};`).join('\n')}\n${colors
    .map((c, i) => `  --phoi-${i + 1}: ${toHex(c)};`)
    .join('\n')}\n}`;
}

function setBase(hex: string, from: 'text' | 'picker' | 'other'): void {
  const rgb = parseHex(hex);
  const errorBox = $('#color-error');
  if (!rgb) {
    errorBox.textContent = T('err.hex','Mã màu HEX gồm 3 hoặc 6 ký tự 0–9, a–f, ví dụ #0d6efd.');
    errorBox.hidden = false;
    return;
  }
  errorBox.hidden = true;
  base = rgb;
  const h = toHex(rgb);
  if (from !== 'text') hexInput.value = h;
  if (from !== 'picker') picker.value = h;
  $<HTMLInputElement>('#bg').value = h;
  $<HTMLInputElement>('#fg').value = readableOn(rgb);
  render();
  renderContrast();
}

function renderContrast(): void {
  const fg = parseHex($<HTMLInputElement>('#fg').value);
  const bg = parseHex($<HTMLInputElement>('#bg').value);
  const out = $('#contrast-result');
  const sample = $('#contrast-sample');
  if (!fg || !bg) {
    out.innerHTML = `<span class="error-text">${T('err.twoHex','Hãy nhập hai mã màu HEX hợp lệ.')}</span>`;
    return;
  }
  sample.style.color = toHex(fg);
  sample.style.background = toHex(bg);
  const r = contrastRatio(fg, bg);
  const verdict = r >= 7 ? T('v.aaa','Rất tốt, đạt AAA') : r >= 4.5 ? T('v.aa','Tốt, đạt AA cho chữ thường') : r >= 3 ? T('v.large','Chỉ đạt cho chữ to, đậm (từ 18px)') : T('v.fail','Khó đọc, nên đổi màu');
  out.innerHTML = `${T('ratio','Tỷ lệ tương phản')} <b>${r.toFixed(2)} : 1</b>. ${verdict}.`;
}

hexInput.addEventListener('input', () => setBase(hexInput.value, 'text'));
picker.addEventListener('input', () => setBase(picker.value, 'picker'));
$('#harmony').addEventListener('change', render);
$('#random').addEventListener('click', () => {
  const rnd = () => Math.floor(Math.random() * 256);
  setBase(toHex({ r: rnd(), g: rnd(), b: rnd() }), 'other');
});
['#fg', '#bg'].forEach((s) => $(s).addEventListener('input', renderContrast));
$('#css-copy').addEventListener('click', () => copyText($('#css-out').textContent ?? ''));
document.addEventListener('click', (e) => {
  const v = (e.target as HTMLElement).closest<HTMLElement>('[data-copy]')?.dataset.copy;
  if (v) copyText(v, `${T('copied','Đã sao chép')} ${v}`);
});
$<HTMLFormElement>('#color-form').addEventListener('submit', (e) => e.preventDefault());
setBase('#0d6efd', 'other');
