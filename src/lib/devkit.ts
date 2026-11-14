/**
 * Khung giao diện dùng chung cho các công cụ nhỏ dạng "nhập → xử lý → kết quả" (đợt 50 công cụ 14/11/2026).
 * Chuỗi dùng chung nằm ở ui['lib.dk.*'], đọc lúc gọi hàm (không đọc ở top-level).
 */
import { t } from '../i18n';
import { $, copyText, downloadBlob, escapeHtml } from '../ui';

export const dk = {
  copy: () => t('lib.dk.copy', 'Sao chép'),
  download: () => t('lib.dk.download', 'Tải về'),
  clear: () => t('lib.dk.clear', 'Xoá'),
  sample: () => t('lib.dk.sample', 'Dữ liệu mẫu'),
  input: () => t('lib.dk.input', 'Dữ liệu nhập'),
  output: () => t('lib.dk.output', 'Kết quả'),
  swap: () => t('lib.dk.swap', 'Đổi chiều'),
  generate: () => t('lib.dk.generate', 'Tạo'),
  chooseFile: () => t('lib.dk.chooseFile', 'Chọn file'),
  privacy: () => t('lib.dk.privacy', 'Mọi xử lý diễn ra ngay trên máy bạn, dữ liệu không gửi đi đâu.'),
  empty: () => t('lib.dk.empty', 'Hãy nhập dữ liệu trước.'),
};

/** Ô nhập nhiều dòng */
export function area(id: string, label: string, o: { rows?: number; ro?: boolean; ph?: string; mono?: boolean; value?: string } = {}): string {
  return `<label class="field"><span class="field-label">${label}</span><textarea id="${id}" rows="${o.rows ?? 10}" spellcheck="false"${o.mono === false ? '' : ' class="mono"'}${o.ro ? ' readonly' : ''}${o.ph ? ` placeholder="${escapeHtml(o.ph)}"` : ''}>${o.value ? escapeHtml(o.value) : ''}</textarea></label>`;
}
/** Ô nhập một dòng */
export function input(id: string, label: string, o: { type?: string; value?: string; ph?: string; attrs?: string; mono?: boolean } = {}): string {
  return `<label class="field"><span class="field-label">${label}</span><input id="${id}" type="${o.type ?? 'text'}"${o.mono ? ' class="mono"' : ''} value="${escapeHtml(o.value ?? '')}"${o.ph ? ` placeholder="${escapeHtml(o.ph)}"` : ''} ${o.attrs ?? ''} autocomplete="off" /></label>`;
}
/** Hộp chọn */
export function select(id: string, label: string, options: [string, string][], value?: string): string {
  return `<label class="field"><span class="field-label">${label}</span><select id="${id}">${options.map(([v, l]) => `<option value="${escapeHtml(v)}"${v === value ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`;
}
export function check(id: string, label: string, on = false): string {
  return `<label class="check"><input type="checkbox" id="${id}"${on ? ' checked' : ''} /><span>${label}</span></label>`;
}
export function button(id: string, label: string, primary = false): string {
  return `<button type="button" class="btn${primary ? ' btn-primary' : ''}" id="${id}">${label}</button>`;
}
export const val = (id: string): string => $<HTMLInputElement>('#' + id).value;
export const setVal = (id: string, v: string): void => {
  $<HTMLInputElement>('#' + id).value = v;
};
export const checked = (id: string): boolean => $<HTMLInputElement>('#' + id).checked;
export const el = <T extends HTMLElement = HTMLElement>(id: string): T => $<T>('#' + id);

/** Gắn nút sao chép */
export function bindCopy(btnId: string, get: () => string): void {
  el(btnId).addEventListener('click', () => {
    const s = get();
    if (s) void copyText(s);
  });
}
/** Gắn nút tải file văn bản */
export function bindDownload(btnId: string, get: () => string, name: () => string, type = 'text/plain'): void {
  el(btnId).addEventListener('click', () => {
    const s = get();
    if (s) downloadBlob(new Blob([s], { type: `${type};charset=utf-8` }), name());
  });
}
/** Gọi fn khi các ô thay đổi (có giãn nhịp) */
export function onChange(ids: string[], fn: () => void, delay = 150): void {
  let timer = 0;
  const run = () => {
    clearTimeout(timer);
    timer = window.setTimeout(fn, delay);
  };
  for (const id of ids) {
    const e = el(id);
    e.addEventListener('input', run);
    e.addEventListener('change', run);
  }
}
/** Hiện / ẩn dòng báo lỗi (phần tử class="error") */
export function showError(id: string, msg: string): void {
  const e = el(id);
  e.textContent = msg;
  e.hidden = !msg;
}
export const errorBox = (id: string): string => `<p class="error" id="${id}" hidden></p>`;
export const privacyNote = (): string => `<p class="note" style="margin-top:16px">${dk.privacy()}</p>`;

export type Bytes = Uint8Array<ArrayBuffer>;
/** Chuỗi ↔ byte UTF-8 */
export const utf8 = (s: string): Bytes => new TextEncoder().encode(s) as Bytes;
export const fromUtf8 = (b: Uint8Array): string => new TextDecoder('utf-8', { fatal: true }).decode(b);
export function toHex(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += x.toString(16).padStart(2, '0');
  return s;
}
export function fromHex(h: string): Bytes {
  const c = h.replace(/[\s:]/g, '');
  if (c.length % 2 || /[^0-9a-f]/i.test(c)) throw new Error('hex');
  const out = new Uint8Array(c.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(c.slice(i * 2, i * 2 + 2), 16);
  return out;
}
export function toB64(b: Uint8Array, url = false): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  const r = btoa(s);
  return url ? r.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : r;
}
export function fromB64(s: string): Bytes {
  let c = s.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (/^data:[^,]*,/.test(c)) c = c.slice(c.indexOf(',') + 1);
  while (c.length % 4) c += '=';
  const bin = atob(c);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Đọc file người dùng chọn thành ArrayBuffer */
export const readFile = (f: File): Promise<ArrayBuffer> => f.arrayBuffer();
export const fmtBytes = (n: number): string => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`);
