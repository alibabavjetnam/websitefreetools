import { mountLayout } from '../layout';
import { BARCODE_FORMATS, barcodeToSvg, encodeBarcode, type BarcodeFormat, type BarcodeResult } from '../lib/barcode';
import { downloadPng, downloadSvg, safeFilename } from '../lib/download';
import { pulseScan } from './shared';
import { pageText } from '../i18n';

mountLayout({ activeTool: 'barcode' });
const T = pageText();

const form = document.getElementById('bc-form') as HTMLFormElement;
const formats = document.getElementById('bc-formats') as HTMLFieldSetElement;
const output = document.getElementById('bc-output') as HTMLElement;
const meta = document.getElementById('bc-meta') as HTMLElement;
const hint = document.getElementById('bc-hint') as HTMLElement;
const errorBox = document.getElementById('bc-error') as HTMLElement;
const btnPng = document.getElementById('dl-png') as HTMLButtonElement;
const btnSvg = document.getElementById('dl-svg') as HTMLButtonElement;
const input = form.elements.namedItem('value') as HTMLInputElement;

formats.insertAdjacentHTML(
  'beforeend',
  BARCODE_FORMATS.map(
    (f, i) => `
    <label class="format-option">
      <input type="radio" name="format" value="${f.id}"${i === 0 ? ' checked' : ''} />
      <span class="format-name">${f.label}</span>
    </label>`,
  ).join(''),
);

const val = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value;
const format = () => val('format') as BarcodeFormat;
const formatInfo = () => BARCODE_FORMATS.find((f) => f.id === format())!;

let current: { result: BarcodeResult; key: string } | null = null;

function svgFor(result: BarcodeResult, scale = 1): string {
  return barcodeToSvg(result, {
    moduleWidth: Number(val('moduleWidth')) * scale,
    height: Number(val('height')) * scale,
    fontSize: 16 * scale,
    showText: (form.elements.namedItem('showText') as HTMLInputElement).checked,
    fg: val('fg'),
    bg: val('bg'),
  });
}

function svgSize(svg: string): [number, number] {
  const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  return m ? [Number(m[1]), Number(m[2])] : [300, 150];
}

function render(): void {
  const info = formatInfo();
  hint.textContent = T('hint.' + format(), info.hint);
  input.placeholder = info.sample;
  (form.elements.namedItem('mwOut') as HTMLOutputElement).value = val('moduleWidth');
  (form.elements.namedItem('hOut') as HTMLOutputElement).value = val('height');

  const setDisabled = (d: boolean) => [btnPng, btnSvg].forEach((b) => (b.disabled = d));
  const raw = input.value;

  if (!raw.trim()) {
    current = null;
    output.innerHTML = '';
    output.classList.add('is-empty');
    meta.textContent = `${T('meta.enter', 'Nhập mã để tạo, ví dụ')} ${info.sample}.`;
    errorBox.hidden = true;
    setDisabled(true);
    return;
  }

  try {
    const result = encodeBarcode(format(), raw);
    const key = `${format()}|${result.text}`;
    const changed = !current || current.key !== key;
    current = { result, key };
    output.classList.remove('is-empty');
    output.innerHTML = svgFor(result);
    const autoCheck = result.text.length > raw.replace(/\s+/g, '').length && format() !== 'CODE39';
    meta.textContent = autoCheck
      ? `${info.label}: ${result.text} (${T('meta.autoCheck', 'đã tự thêm chữ số cuối')} ${result.text.slice(-1)})`
      : `${info.label}: ${result.text}`;
    errorBox.hidden = true;
    setDisabled(false);
    if (changed) pulseScan(output);
  } catch (err) {
    current = null;
    output.innerHTML = '';
    output.classList.add('is-empty');
    meta.textContent = '';
    errorBox.textContent = (err as Error).message;
    errorBox.hidden = false;
    setDisabled(true);
  }
}

// Đổi chuẩn mã thì điền sẵn mã mẫu nếu ô đang trống hoặc đang chứa mã mẫu cũ
let lastSample = formatInfo().sample;
formats.addEventListener('change', () => {
  if (!input.value || input.value === lastSample) input.value = formatInfo().sample;
  lastSample = formatInfo().sample;
});

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', (e) => e.preventDefault());

btnSvg.addEventListener('click', () => {
  if (!current) return;
  downloadSvg(svgFor(current.result), `barcode-${safeFilename(current.result.text, 'code')}.svg`);
});
btnPng.addEventListener('click', async () => {
  if (!current) return;
  // Xuất PNG gấp 3 lần để in sắc nét
  const svg = svgFor(current.result, 3);
  const [w, h] = svgSize(svg);
  btnPng.disabled = true;
  try {
    await downloadPng(svg, `barcode-${safeFilename(current.result.text, 'code')}.png`, w, h);
  } catch (err) {
    errorBox.textContent = (err as Error).message;
    errorBox.hidden = false;
  } finally {
    btnPng.disabled = false;
  }
});

input.value = formatInfo().sample;
render();
