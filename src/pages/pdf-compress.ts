import { mountLayout } from '../layout';
import { $, downloadBlob, storage } from '../ui';
import { pageText } from '../i18n';
import { bindDropzone, baseName, fmtSize } from '../lib/files';
import { pdfBlob } from '../lib/pdflib';
import { compressImages, rasterize } from '../lib/pdfcompress';

mountLayout({ activeTool: 'pdf-compress' });
const T = pageText();

type Level = 'light' | 'medium' | 'strong' | 'extreme';
const LEVELS: Record<Level, { side: number; q: number; dpi: number; raster: boolean }> = {
  light: { side: 2400, q: 0.82, dpi: 150, raster: false },
  medium: { side: 1600, q: 0.7, dpi: 120, raster: false },
  strong: { side: 1100, q: 0.55, dpi: 100, raster: false },
  extreme: { side: 0, q: 0.5, dpi: 85, raster: true },
};
const st = storage<{ level: Level }>('pdf-compress', { level: 'medium' });
const s = st.get();

$('#tool-root').innerHTML = `
  <div class="workspace">
    <div class="panel">
      <label class="dropzone" id="drop">
        <input type="file" id="file" accept="application/pdf,.pdf" />
        <b>${T('dropTitle', 'Chọn file PDF hoặc kéo thả vào đây')}</b>
        <span>${T('dropHint', 'Tối đa 200 MB. File không rời khỏi máy bạn.')}</span>
      </label>
      <fieldset class="field"><legend>${T('level', 'Mức nén')}</legend>
        <div class="fields">
          <label class="check"><input type="radio" name="level" value="light" /><span><b>${T('lLight', 'Nhẹ')}</b> — ${T('lLightD', 'giữ ảnh gần như nguyên bản, giảm ít')}</span></label>
          <label class="check"><input type="radio" name="level" value="medium" /><span><b>${T('lMedium', 'Khuyên dùng')}</b> — ${T('lMediumD', 'ảnh vẫn rõ, giảm nhiều; chữ giữ nguyên')}</span></label>
          <label class="check"><input type="radio" name="level" value="strong" /><span><b>${T('lStrong', 'Mạnh')}</b> — ${T('lStrongD', 'ảnh nhỏ và mờ hơn; chữ giữ nguyên')}</span></label>
          <label class="check"><input type="radio" name="level" value="extreme" /><span><b>${T('lExtreme', 'Tối đa')}</b> — ${T('lExtremeD', 'chuyển mỗi trang thành ảnh; nhỏ nhất nhưng không chọn/sao chép được chữ')}</span></label>
        </div>
      </fieldset>
      <div class="actions"><button type="button" class="btn btn-primary" id="run" disabled>${T('run', 'Nén PDF')}</button></div>
      <div class="progress" id="prog" hidden><i></i></div>
      <p class="note" id="status"></p>
      <p class="error" id="err" hidden></p>
    </div>
    <section class="preview">
      <div class="stat-grid" id="stats"></div>
      <div class="actions" id="dl-box" hidden><button type="button" class="btn btn-primary" id="dl">${T('download', 'Tải file đã nén')}</button></div>
      <p class="note">${T('note', 'PDF chủ yếu là chữ (văn bản Word xuất ra) thường đã nhỏ sẵn nên giảm ít; PDF có nhiều ảnh chụp, bản scan giảm nhiều nhất. Nếu kết quả không nhỏ hơn, hãy thử mức Mạnh hoặc Tối đa.')}</p>
    </section>
  </div>
`;

let file: File | null = null;
let result: Uint8Array | null = null;
const showErr = (m: string) => { const e = $('#err'); e.textContent = m; e.hidden = !m; };
document.querySelectorAll<HTMLInputElement>('input[name=level]').forEach((r) => {
  r.checked = r.value === s.level;
  r.addEventListener('change', () => { s.level = r.value as Level; st.set(s); });
});
const stat = (l: string, v: string, main = false) => `<div class="stat${main ? ' stat--main' : ''}"><span class="stat-label">${l}</span><span class="stat-value">${v}</span></div>`;

function pick(f: File): void {
  showErr('');
  if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { showErr(T('notPdf', 'Hãy chọn file PDF.')); return; }
  if (f.size > 200 * 1024 * 1024) { showErr(T('tooBig', 'File lớn hơn 200 MB.')); return; }
  file = f;
  result = null;
  $('#dl-box').hidden = true;
  $<HTMLButtonElement>('#run').disabled = false;
  $('#stats').innerHTML = stat(T('orig', 'Dung lượng gốc'), fmtSize(f.size));
  $('#status').textContent = f.name;
}

async function run(): Promise<void> {
  if (!file) return;
  showErr('');
  const L = LEVELS[s.level];
  const btn = $<HTMLButtonElement>('#run');
  btn.disabled = true;
  const prog = $('#prog');
  prog.hidden = false;
  const bar = prog.querySelector('i') as HTMLElement;
  const onP = (d: number, t: number) => { bar.style.width = `${t ? (d / t) * 100 : 0}%`; $('#status').textContent = `${L.raster ? T('pagesProg', 'Đang xử lý trang') : T('imgProg', 'Đang nén ảnh')} ${Math.min(d + 1, t)}/${t}…`; };
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let out: Uint8Array;
    let info = '';
    if (L.raster) out = await rasterize(bytes, L.dpi, L.q, onP);
    else {
      const r = await compressImages(bytes, L.side, L.q, onP);
      out = r.bytes;
      info = r.total ? `${T('imgsDone', 'Đã nén lại')} ${r.changed}/${r.total} ${T('imgs', 'ảnh')}` : T('noImgs', 'File không có ảnh JPEG để nén; đã tối ưu cấu trúc file.');
    }
    result = out;
    const saved = 1 - out.length / file.size;
    $('#stats').innerHTML = [
      stat(T('orig', 'Dung lượng gốc'), fmtSize(file.size)),
      stat(T('after', 'Sau khi nén'), fmtSize(out.length)),
      stat(T('saved', 'Giảm được'), saved > 0 ? `${Math.round(saved * 100)}%` : '0%', true),
    ].join('');
    $('#status').textContent = info;
    $('#dl-box').hidden = false;
    if (saved <= 0.01) showErr(T('notSmaller', 'File nén không nhỏ hơn bản gốc. Hãy chọn mức nén mạnh hơn, hoặc file này đã được tối ưu sẵn.'));
  } catch (e) {
    showErr((e as Error).message || T('err', 'Không nén được file này.'));
    $('#status').textContent = '';
  } finally {
    btn.disabled = false;
    setTimeout(() => (prog.hidden = true), 600);
  }
}

bindDropzone($('#drop'), $<HTMLInputElement>('#file'), (f) => pick(f[0]));
$('#run').addEventListener('click', () => void run());
$('#dl').addEventListener('click', () => { if (result && file) downloadBlob(pdfBlob(result), `${baseName(file.name)}-${T('suffix', 'da-nen')}.pdf`); });
