import { mountLayout } from '../layout';
import { $, copyText, downloadBlob, toast } from '../ui';
import { obfuscate, type ObfuscateOptions } from '../lib/obfuscate';

mountLayout({ activeTool: 'js-obfuscate' });

const SAMPLE = `// Ví dụ: đếm số lần nhấn nút
function taoBoDem(batDau) {
  let soLan = batDau;
  return function tang() {
    soLan = soLan + 1;
    console.log("Đã nhấn " + soLan + " lần");
    return soLan;
  };
}

const dem = taoBoDem(0);
dem();
dem();`;

const root = $('#tool-root');
root.innerHTML = `
  <div class="panel code-toolbar code-toolbar--wrap">
    <fieldset class="field">
      <legend>Cách làm rối</legend>
      <div class="row">
        <label class="check"><input type="checkbox" id="o-strings" checked /><span>Mã hoá chuỗi (base64)</span></label>
        <label class="check"><input type="checkbox" id="o-numbers" checked /><span>Đổi số sang hex</span></label>
        <label class="check"><input type="checkbox" id="o-rename" checked /><span>Đổi tên biến cục bộ</span></label>
        <label class="check"><input type="checkbox" id="o-packer" /><span>Gói trong eval (khó đọc hơn)</span></label>
        <label class="check"><input type="checkbox" id="o-module" /><span>Mã dạng module (có import/export)</span></label>
      </div>
    </fieldset>
    <div class="actions">
      <button type="button" class="btn btn-primary" id="run">Làm rối mã</button>
      <button type="button" class="btn" id="copy">Sao chép</button>
      <button type="button" class="btn" id="dl">Tải file</button>
    </div>
  </div>
  <div class="workspace code-workspace">
    <label class="field"><span class="field-label">Mã JavaScript gốc</span><textarea id="in" class="mono code-area" rows="20" spellcheck="false">${SAMPLE.replace(/</g, '&lt;')}</textarea></label>
    <label class="field"><span class="field-label">Mã đã làm rối</span><textarea id="out" class="mono code-area" rows="20" spellcheck="false" readonly></textarea></label>
  </div>
  <div class="stat-grid" id="summary"></div>
  <p class="error" id="err" hidden></p>
  <p class="note">Công cụ chỉ làm mã <b>khó đọc, khó sao chép lại</b> chứ không mã hoá tuyệt đối — người có kỹ thuật vẫn có thể khôi phục. Mã vẫn chạy đúng như bản gốc. Biến toàn cục và tên thuộc tính được giữ nguyên để không làm hỏng liên kết với mã khác. Nếu mã có <code>eval</code> hoặc <code>with</code>, phần đổi tên biến sẽ tự tắt cho an toàn.</p>
`;

const showErr = (msg: string) => {
  $('#err').textContent = msg;
  $('#err').hidden = !msg;
};

async function run(): Promise<void> {
  showErr('');
  const src = $<HTMLTextAreaElement>('#in').value;
  const opts: ObfuscateOptions = {
    strings: $<HTMLInputElement>('#o-strings').checked,
    numbers: $<HTMLInputElement>('#o-numbers').checked,
    renameLocals: $<HTMLInputElement>('#o-rename').checked,
    packer: $<HTMLInputElement>('#o-packer').checked,
    module: $<HTMLInputElement>('#o-module').checked,
  };
  const btn = $<HTMLButtonElement>('#run');
  btn.disabled = true;
  try {
    const out = await obfuscate(src, opts);
    $<HTMLTextAreaElement>('#out').value = out;
    const inKb = new Blob([src]).size;
    const outKb = new Blob([out]).size;
    $('#summary').innerHTML = out
      ? `<div class="stat"><span class="stat-label">Mã gốc</span><span class="stat-value">${(inKb / 1024).toFixed(1).replace('.', ',')} KB</span></div>
         <div class="stat stat--main"><span class="stat-label">Sau khi làm rối</span><span class="stat-value">${(outKb / 1024).toFixed(1).replace('.', ',')} KB</span></div>`
      : '';
  } catch (e) {
    $<HTMLTextAreaElement>('#out').value = '';
    $('#summary').innerHTML = '';
    showErr((e as Error).message);
  } finally {
    btn.disabled = false;
  }
}

$('#run').addEventListener('click', () => void run());
root.querySelectorAll('.code-toolbar input').forEach((el) => el.addEventListener('change', () => void run()));
$('#copy').addEventListener('click', () => {
  const v = $<HTMLTextAreaElement>('#out').value;
  if (v) void copyText(v);
});
$('#dl').addEventListener('click', () => {
  const v = $<HTMLTextAreaElement>('#out').value;
  if (!v) return;
  downloadBlob(new Blob([v], { type: 'text/javascript;charset=utf-8' }), 'obfuscated.js');
  toast('Đã tải file');
});
void run();
