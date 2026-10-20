import { mountLayout } from '../layout';
import { encodeQr, qrToSvg, type Ecc, type QrCode } from '../lib/qr';
import { downloadPng, downloadSvg, safeFilename } from '../lib/download';
import { pulseScan } from './shared';

mountLayout({ activeTool: 'qr-code' });

const form = document.getElementById('qr-form') as HTMLFormElement;
const output = document.getElementById('qr-output') as HTMLElement;
const meta = document.getElementById('qr-meta') as HTMLElement;
const errorBox = document.getElementById('qr-error') as HTMLElement;
const btnPng = document.getElementById('dl-png') as HTMLButtonElement;
const btnSvg = document.getElementById('dl-svg') as HTMLButtonElement;

const val = (name: string): string => {
  const el = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  return el ? el.value : '';
};
const checked = (name: string): boolean => (form.elements.namedItem(name) as HTMLInputElement).checked;

/** Ký tự đặc biệt trong chuỗi Wi‑Fi cần thoát bằng dấu \ */
const wifiEscape = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');
const phone = (s: string) => s.replace(/[^\d+]/g, '');

function payload(): { text: string; empty: string | null } {
  const type = val('type');
  switch (type) {
    case 'wifi': {
      const ssid = val('ssid');
      if (!ssid) return { text: '', empty: 'Nhập tên mạng Wi‑Fi để tạo mã.' };
      const sec = val('wifiSec');
      const pass = sec === 'nopass' ? '' : `P:${wifiEscape(val('wifiPass'))};`;
      return { text: `WIFI:T:${sec};S:${wifiEscape(ssid)};${pass}${checked('wifiHidden') ? 'H:true;' : ''};`, empty: null };
    }
    case 'email': {
      const to = val('emailTo').trim();
      if (!to) return { text: '', empty: 'Nhập địa chỉ email người nhận để tạo mã.' };
      const params = new URLSearchParams();
      if (val('emailSubject')) params.set('subject', val('emailSubject'));
      if (val('emailBody')) params.set('body', val('emailBody'));
      const q = params.toString().replace(/\+/g, '%20');
      return { text: `mailto:${to}${q ? '?' + q : ''}`, empty: null };
    }
    case 'tel': {
      const t = phone(val('tel'));
      return t ? { text: `tel:${t}`, empty: null } : { text: '', empty: 'Nhập số điện thoại để tạo mã.' };
    }
    case 'sms': {
      const t = phone(val('smsTo'));
      if (!t) return { text: '', empty: 'Nhập số điện thoại nhận tin để tạo mã.' };
      return { text: `SMSTO:${t}:${val('smsBody')}`, empty: null };
    }
    default: {
      const t = val('text');
      return t ? { text: t, empty: null } : { text: '', empty: 'Nhập liên kết hoặc văn bản để tạo mã.' };
    }
  }
}

let current: { qr: QrCode; text: string } | null = null;

function currentSvg(px: number): string {
  if (!current) return '';
  return qrToSvg(current.qr, { margin: Number(val('margin')), fg: val('fg'), bg: val('bg'), px });
}

function render(): void {
  // Hiện đúng nhóm ô nhập theo loại nội dung
  const type = val('type');
  form.querySelectorAll<HTMLElement>('.fields').forEach((f) => (f.hidden = f.dataset.type !== type));
  (form.elements.namedItem('sizeOut') as HTMLOutputElement).value = val('size');
  (form.elements.namedItem('marginOut') as HTMLOutputElement).value = val('margin');
  (form.elements.namedItem('wifiPass') as HTMLInputElement).disabled = val('wifiSec') === 'nopass';

  const { text, empty } = payload();
  const setDisabled = (d: boolean) => [btnPng, btnSvg].forEach((b) => (b.disabled = d));

  if (empty) {
    current = null;
    output.innerHTML = '';
    output.classList.add('is-empty');
    meta.textContent = empty;
    errorBox.hidden = true;
    setDisabled(true);
    return;
  }

  try {
    const qr = encodeQr(text, val('ecc') as Ecc);
    const changed = !current || current.text !== text;
    current = { qr, text };
    output.classList.remove('is-empty');
    output.innerHTML = currentSvg(qr.size + Number(val('margin')) * 2);
    const bytes = new TextEncoder().encode(text).length;
    meta.textContent = `Phiên bản ${qr.version}, ${qr.size}×${qr.size} ô, ${bytes} byte dữ liệu`;
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

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', (e) => e.preventDefault());

btnSvg.addEventListener('click', () => {
  if (!current) return;
  downloadSvg(currentSvg(Number(val('size'))), `qr-${safeFilename(current.text, 'code')}.svg`);
});
btnPng.addEventListener('click', async () => {
  if (!current) return;
  const size = Number(val('size'));
  btnPng.disabled = true;
  try {
    await downloadPng(currentSvg(size), `qr-${safeFilename(current.text, 'code')}.png`, size, size);
  } catch (err) {
    errorBox.textContent = (err as Error).message;
    errorBox.hidden = false;
  } finally {
    btnPng.disabled = false;
  }
});

render();
