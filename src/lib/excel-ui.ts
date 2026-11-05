/** Thành phần giao diện dùng chung cho nhóm công cụ Excel: ô chọn file, nút chọn nguồn, dòng trạng thái */
import { $, escapeHtml } from '../ui';
import { bindDropzone, fmtSize } from './files';
import { tf } from '../i18n';

export function pickerHtml(id: string, label: string, hint: string, accept: string, multiple: boolean, title: string): string {
  return `
    <div class="field">
      <span class="field-label">${label}</span>
      <label class="dropzone dropzone--sm" id="${id}-drop">
        <input type="file" id="${id}" accept="${accept}"${multiple ? ' multiple' : ''} />
        <b>${title}</b>
        <span>${hint}</span>
      </label>
      <p class="note" id="${id}-info"></p>
    </div>`;
}

/** Gắn ô chọn file; chọn lại sẽ thay danh sách cũ (không cộng dồn) */
export function bindPicker(id: string, multiple: boolean, onChange?: () => void): () => File[] {
  let files: File[] = [];
  const info = $(`#${id}-info`);
  const render = (): void => {
    info.innerHTML = files.map((f) => `${escapeHtml(f.name)} · ${fmtSize(f.size)}`).join('<br>');
    if (multiple && files.length > 1) info.innerHTML = `<b>${tf('lib.excel.nFiles', '{n} file đã chọn', { n: String(files.length) })}</b><br>${info.innerHTML}`;
    onChange?.();
  };
  bindDropzone($(`#${id}-drop`), $<HTMLInputElement>(`#${id}`), (picked) => {
    files = multiple ? picked : picked.slice(0, 1);
    render();
  });
  return () => files;
}

export function radioHtml(name: string, items: { value: string; label: string }[]): string {
  return `<div class="row">${items.map((it, i) => `<label class="check"><input type="radio" name="${name}" value="${it.value}"${i === 0 ? ' checked' : ''} /><span>${it.label}</span></label>`).join('')}</div>`;
}

export const radioValue = (name: string): string => (document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value ?? '');

export function setStatus(id: string, message: string, kind: 'ok' | 'warn' | 'error' | '', keepSpace = false): void {
  const el = $(`#${id}`);
  // keepSpace: dòng trạng thái luôn chiếm chỗ, để khi hiện chữ không đẩy nút bên dưới đang được bấm đi chỗ khác
  if (!keepSpace) el.hidden = !message;
  el.textContent = message;
  el.className = kind === 'error' ? 'error' : kind === 'warn' ? 'note warn' : kind === 'ok' ? 'note ok' : 'note';
}

/** Thay {tên} trong chuỗi giao diện của trang (chuỗi lấy bằng pageText) */
export const fmt = (s: string, vars: Record<string, string | number>): string => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
