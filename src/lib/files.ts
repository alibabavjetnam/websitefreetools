/** Tiện ích chung cho các công cụ xử lý file */
import { CDN, global, loadScript } from './cdn';
import { localeTag } from '../i18n';

/** Gắn ô chọn file + kéo thả. Gọi onFiles với danh sách file người dùng chọn. */
export function bindDropzone(drop: HTMLElement, input: HTMLInputElement, onFiles: (files: File[]) => void): void {
  input.addEventListener('change', () => {
    if (input.files?.length) onFiles([...input.files]);
    input.value = '';
  });
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('is-over')));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer?.files.length) onFiles([...e.dataTransfer.files]);
  });
}

export const extOf = (name: string): string => (name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '');
export const baseName = (name: string): string => (name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name) || 'file';

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString(localeTag(), { maximumFractionDigits: 1, minimumFractionDigits: 1 })} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString(localeTag(), { maximumFractionDigits: 1, minimumFractionDigits: 1 })} MB`;
}

interface ZipWriter { file(name: string, data: Blob | Uint8Array | string): void; generateAsync(o: { type: 'blob' }): Promise<Blob> }

/** Đóng gói nhiều file thành một file .zip */
export async function makeZip(entries: { name: string; data: Blob | Uint8Array | string }[]): Promise<Blob> {
  await loadScript(CDN.jszip, 'JSZip');
  const zip = new (global<new () => ZipWriter>('JSZip'))();
  const used = new Set<string>();
  for (const e of entries) {
    let name = e.name;
    for (let i = 2; used.has(name); i++) name = `${baseName(e.name)} (${i}).${extOf(e.name)}`;
    used.add(name);
    zip.file(name, e.data);
  }
  return zip.generateAsync({ type: 'blob' });
}

/** Bỏ ký tự không hợp lệ trong tên file */
export const safeFileName = (s: string): string => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim().slice(0, 120) || 'file';
