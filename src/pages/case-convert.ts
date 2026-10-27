import { mountLayout } from '../layout';
import { $, copyText, downloadBlob, fmtInt, storage } from '../ui';
import { pageText, localeTag } from '../i18n';
import { convertCase, type CaseKind } from '../calc/textcase';

mountLayout({ activeTool: 'case-convert' });
const T = pageText();
const LOCALE = localeTag();

const KINDS: { id: CaseKind; label: string }[] = [
  { id: 'upper', label: T('k.upper', 'CHỮ HOA') },
  { id: 'lower', label: T('k.lower', 'chữ thường') },
  { id: 'title', label: T('k.title', 'Viết Hoa Đầu Từ') },
  { id: 'sentence', label: T('k.sentence', 'Viết hoa đầu câu') },
  { id: 'headline', label: T('k.headline', 'Tiêu đề kiểu Anh') },
  { id: 'toggle', label: T('k.toggle', 'đẢO cHỮ hOA tHƯỜNG') },
  { id: 'alternating', label: T('k.alternating', 'xEn Kẽ HoA tHưỜnG') },
  { id: 'noAccent', label: T('k.noAccent', 'Bỏ dấu tiếng Việt') },
  { id: 'camel', label: 'camelCase' },
  { id: 'pascal', label: 'PascalCase' },
  { id: 'snake', label: 'snake_case' },
  { id: 'constant', label: 'CONSTANT_CASE' },
  { id: 'kebab', label: 'kebab-case' },
  { id: 'dot', label: 'dot.case' },
];

const saved = storage<{ text: string; kind: CaseKind }>('case-convert', { text: '', kind: 'title' });

$('#tool-root').innerHTML = `
  <div class="workspace">
    <section class="panel">
      <label class="field"><span class="field-label">${T('input', 'Văn bản gốc')}</span>
        <textarea id="src" rows="10" placeholder="${T('placeholder', 'Dán hoặc gõ văn bản vào đây…')}"></textarea>
      </label>
      <div class="row">
        <button type="button" class="btn btn-sm" id="sample">${T('sampleBtn', 'Dùng văn bản mẫu')}</button>
        <button type="button" class="btn btn-sm" id="clear">${T('clear', 'Xoá')}</button>
        <span class="note" id="stats"></span>
      </div>
      <fieldset class="field">
        <legend>${T('chooseKind', 'Chọn kiểu chữ')}</legend>
        <div class="case-grid" id="kinds">
          ${KINDS.map((k) => `<button type="button" class="btn btn-sm" data-kind="${k.id}">${k.label}</button>`).join('')}
        </div>
      </fieldset>
    </section>
    <section class="panel">
      <label class="field"><span class="field-label">${T('output', 'Kết quả')}</span>
        <textarea id="out" rows="10" readonly></textarea>
      </label>
      <div class="actions">
        <button type="button" class="btn btn-primary" id="copy">${T('copy', 'Sao chép kết quả')}</button>
        <button type="button" class="btn" id="use">${T('useAsInput', 'Dùng làm văn bản gốc')}</button>
        <button type="button" class="btn" id="dl">${T('download', 'Tải file .txt')}</button>
      </div>
    </section>
  </div>
`;

const src = $<HTMLTextAreaElement>('#src');
const out = $<HTMLTextAreaElement>('#out');
let kind: CaseKind = saved.get().kind;
src.value = saved.get().text;

function render(): void {
  out.value = convertCase(src.value, kind, LOCALE);
  document.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach((b) => {
    const on = b.dataset.kind === kind;
    b.classList.toggle('btn-primary', on);
    b.setAttribute('aria-pressed', String(on));
  });
  const words = src.value.trim() ? src.value.trim().split(/\s+/).length : 0;
  $('#stats').textContent = `${fmtInt([...src.value].length)} ${T('chars', 'ký tự')} · ${fmtInt(words)} ${T('words', 'từ')}`;
  saved.set({ text: src.value.slice(0, 50000), kind });
}

$('#kinds').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-kind]');
  if (!b) return;
  kind = b.dataset.kind as CaseKind;
  render();
});
src.addEventListener('input', render);
$('#sample').addEventListener('click', () => {
  src.value = T('sample', 'hôm nay trời đẹp. chúng ta cùng đi dạo công viên nhé!\ntên biến: số lượng sản phẩm trong giỏ hàng');
  render();
});
$('#clear').addEventListener('click', () => { src.value = ''; render(); src.focus(); });
$('#copy').addEventListener('click', () => { if (out.value) void copyText(out.value); });
$('#use').addEventListener('click', () => { src.value = out.value; render(); });
$('#dl').addEventListener('click', () => {
  if (out.value) downloadBlob(new Blob([out.value], { type: 'text/plain;charset=utf-8' }), `${T('fileName', 'van-ban')}.txt`);
});
render();
