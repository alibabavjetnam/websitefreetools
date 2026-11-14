import { mountLayout } from '../layout';
import { $ } from '../ui';
import { pageText } from '../i18n';
import { area, button, check, bindCopy, bindDownload, dk, el, privacyNote, setVal, val, checked, input } from '../lib/devkit';
import { GITIGNORE } from '../data/gitignore';

mountLayout({ activeTool: 'gitignore-gen' });
const T = pageText();
const GROUPS: [string, string][] = [['lang', T('g.lang', 'Ngôn ngữ')], ['fw', T('g.fw', 'Framework / nền tảng')], ['os', T('g.os', 'Hệ điều hành')], ['ide', T('g.ide', 'Trình soạn thảo')]];
const DEF = ['node', 'macos', 'windows', 'vscode'];

$('#tool-root').innerHTML = `
  <div class="workspace" style="margin-top:24px">
    <div class="panel">
      ${input('filter', T('filter', 'Tìm nhanh'), { ph: 'python, react…' })}
      ${GROUPS.map(([g, l]) => `<div class="field"><span class="field-label">${l}</span><div class="row">${Object.entries(GITIGNORE).filter(([, v]) => v.group === g).map(([k, v]) => `<span data-item="${k}">${check('t-' + k, v.label, DEF.includes(k))}</span>`).join('')}</div></div>`).join('')}
      ${area('extra', T('extra', 'Thêm dòng riêng (không bắt buộc)'), { rows: 3, ph: 'secrets/\n*.pem' })}
    </div>
    <div class="panel">
      ${area('out', '.gitignore', { rows: 26, ro: true })}
      <div class="row">${button('copy', dk.copy(), true)}${button('dl', T('dl', 'Tải file .gitignore'))}</div>
    </div>
  </div>
  <p class="note" style="margin-top:12px">${T('note', 'Đặt file .gitignore ở thư mục gốc của dự án. File đã được Git theo dõi từ trước sẽ không tự bị bỏ qua: chạy git rm --cached tên-file để gỡ ra.')}</p>
  ${privacyNote()}
`;
function build(): void {
  const parts = Object.entries(GITIGNORE).filter(([k]) => checked('t-' + k)).map(([, v]) => `# ===== ${v.label} =====\n${v.body}`);
  if (val('extra').trim()) parts.push(`# ===== ${T('custom', 'Tuỳ chỉnh')} =====\n${val('extra').trim()}`);
  setVal('out', parts.join('\n\n') + (parts.length ? '\n' : ''));
}
el('tool-root').addEventListener('change', build);
el('extra').addEventListener('input', build);
el('filter').addEventListener('input', () => {
  const q = val('filter').toLowerCase().trim();
  document.querySelectorAll<HTMLElement>('[data-item]').forEach((s) => (s.hidden = !!q && !GITIGNORE[s.dataset.item as string].label.toLowerCase().includes(q)));
});
bindCopy('copy', () => val('out'));
bindDownload('dl', () => val('out'), () => '.gitignore');
build();
