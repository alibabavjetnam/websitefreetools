import { mountLayout } from '../layout';
import { $, copyText, downloadBlob, escapeHtml, storage, toast } from '../ui';
import { pageText, currentLang, localeTag } from '../i18n';
import { loadScript, global, openPdf } from '../lib/cdn';
import { renderPage } from '../lib/pdfrender';
import { bindDropzone, baseName } from '../lib/files';

mountLayout({ activeTool: 'image-ocr' });
const T = pageText();
const LOCALE = localeTag();

const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
/** Mã ngôn ngữ Tesseract ↔ mã BCP-47 để hiện tên theo ngôn ngữ giao diện */
const LANGS: [string, string][] = [
  ['vie', 'vi'], ['eng', 'en'], ['jpn', 'ja'], ['chi_sim', 'zh-Hans'], ['chi_tra', 'zh-Hant'], ['kor', 'ko'], ['spa', 'es'], ['fra', 'fr'], ['deu', 'de'],
  ['rus', 'ru'], ['por', 'pt'], ['ita', 'it'], ['tur', 'tr'], ['nld', 'nl'], ['pol', 'pl'], ['ukr', 'uk'], ['ara', 'ar'], ['hin', 'hi'], ['ben', 'bn'],
  ['ind', 'id'], ['msa', 'ms'], ['tha', 'th'], ['fil', 'fil'], ['swe', 'sv'], ['dan', 'da'], ['nor', 'nb'], ['fin', 'fi'], ['ces', 'cs'], ['slk', 'sk'],
  ['hun', 'hu'], ['ron', 'ro'], ['bul', 'bg'], ['ell', 'el'], ['hrv', 'hr'], ['srp', 'sr'], ['lit', 'lt'], ['lav', 'lv'], ['est', 'et'], ['slv', 'sl'],
  ['heb', 'he'], ['fas', 'fa'], ['urd', 'ur'], ['tam', 'ta'], ['tel', 'te'], ['mar', 'mr'], ['guj', 'gu'], ['kan', 'kn'], ['mal', 'ml'], ['pan', 'pa'], ['swa', 'sw'], ['cat', 'ca'],
];
const UI_TO_TESS: Record<string, string> = Object.fromEntries(LANGS.map(([t3, b]) => [b.split('-')[0], t3]));
const dn = (code: string) => { try { return new Intl.DisplayNames([LOCALE], { type: 'language' }).of(code) || code; } catch { return code; } };

const st = storage<{ langs: string[] }>('image-ocr', { langs: [] });
const s = st.get();
if (!s.langs.length) s.langs = [...new Set([UI_TO_TESS[currentLang()] ?? 'eng', 'eng'])];

$('#tool-root').innerHTML = `
  <div class="workspace">
    <div class="panel">
      <label class="dropzone" id="drop">
        <input type="file" id="files" accept="image/*,application/pdf,.pdf" multiple />
        <b>${T('dropTitle', 'Chọn ảnh hoặc PDF bản scan, hoặc kéo thả vào đây')}</b>
        <span>${T('dropHint', 'JPG, PNG, WebP, BMP, PDF. Có thể dán ảnh chụp màn hình bằng Ctrl+V.')}</span>
      </label>
      <fieldset class="field"><legend>${T('langs', 'Ngôn ngữ trong ảnh (chọn tối đa 3)')}</legend>
        <select id="lang-add"><option value="">${T('addLang', '+ Thêm ngôn ngữ…')}</option>${LANGS.map(([c, b]) => `<option value="${c}">${escapeHtml(dn(b))}</option>`).join('')}</select>
        <div class="row" id="lang-chips" style="margin-top:8px"></div>
      </fieldset>
      <label class="check"><input type="checkbox" id="enhance" checked /><span>${T('enhance', 'Tăng nét ảnh trước khi đọc (ảnh mờ, chữ nhỏ)')}</span></label>
      <div class="actions"><button type="button" class="btn btn-primary" id="run" disabled>${T('run', 'Lấy chữ')}</button><span class="note" id="count"></span></div>
      <div class="progress" id="prog" hidden><i></i></div>
      <p class="note" id="status"></p>
      <p class="error" id="err" hidden></p>
      <div class="thumbs" id="thumbs"></div>
    </div>
    <section class="panel">
      <label class="field"><span class="field-label">${T('result', 'Văn bản nhận dạng được (sửa được)')}</span><textarea id="out" rows="18" placeholder="${T('outPh', 'Chữ trong ảnh sẽ hiện ở đây.')}"></textarea></label>
      <div class="actions">
        <button type="button" class="btn" id="copy">${T('copy', 'Sao chép')}</button>
        <button type="button" class="btn" id="dl">${T('download', 'Tải file .txt')}</button>
        <span class="note" id="conf"></span>
      </div>
      <p class="note">${T('note', 'Nhận dạng chạy ngay trên trình duyệt; lần đầu cần tải bộ nhận dạng và dữ liệu ngôn ngữ (khoảng 5–20 MB mỗi ngôn ngữ), các lần sau nhanh hơn. Ảnh rõ nét, chữ in, nền sáng cho kết quả tốt nhất; chữ viết tay khó nhận dạng.')}</p>
    </section>
  </div>
`;

interface Src { name: string; file?: File; canvas?: HTMLCanvasElement }
let srcs: Src[] = [];
const showErr = (m: string) => { const e = $('#err'); e.textContent = m; e.hidden = !m; };

function renderChips(): void {
  $('#lang-chips').innerHTML = s.langs.map((c) => `<span class="btn btn-sm" style="cursor:default">${escapeHtml(dn(LANGS.find((l) => l[0] === c)?.[1] ?? c))} <button type="button" data-rm="${c}" aria-label="${T('remove', 'Bỏ')}" style="border:0;background:none;cursor:pointer;color:var(--danger)">×</button></span>`).join('');
  st.set(s);
}
$('#lang-add').addEventListener('change', (e) => {
  const v = (e.target as HTMLSelectElement).value;
  (e.target as HTMLSelectElement).value = '';
  if (!v || s.langs.includes(v)) return;
  if (s.langs.length >= 3) { toast(T('max3', 'Chọn tối đa 3 ngôn ngữ để nhận dạng nhanh và chính xác.')); return; }
  s.langs.push(v);
  renderChips();
});
$('#lang-chips').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-rm]');
  if (!b || s.langs.length <= 1) return;
  s.langs = s.langs.filter((x) => x !== b.dataset.rm);
  renderChips();
});

async function add(files: File[]): Promise<void> {
  showErr('');
  for (const f of files) {
    if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) {
      // PDF bản scan: vẽ từng trang thành ảnh 200 dpi
      try {
        $('#status').textContent = T('openPdf', 'Đang mở PDF…');
        const doc = await openPdf(new Uint8Array(await f.arrayBuffer()));
        const n = Math.min(doc.numPages, 50);
        for (let p = 1; p <= n; p++) srcs.push({ name: `${f.name} · ${T('page', 'trang')} ${p}`, canvas: await renderPage(doc, p, 200 / 72) });
        if (doc.numPages > 50) toast(T('pdfLimit', 'Chỉ lấy 50 trang đầu của PDF.'));
        $('#status').textContent = '';
      } catch (e) { showErr((e as Error).message); }
    } else if (f.type.startsWith('image/')) srcs.push({ name: f.name, file: f });
  }
  renderThumbs();
}
function renderThumbs(): void {
  $('#thumbs').innerHTML = '';
  srcs.forEach((sr, i) => {
    const d = document.createElement('div');
    d.className = 'thumb';
    const img = document.createElement('img');
    img.src = sr.file ? URL.createObjectURL(sr.file) : (sr.canvas as HTMLCanvasElement).toDataURL('image/jpeg', 0.6);
    d.append(img);
    d.insertAdjacentHTML('beforeend', `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(sr.name)}</span><button type="button" class="btn btn-sm" data-del="${i}">${T('remove', 'Bỏ')}</button>`);
    $('#thumbs').appendChild(d);
  });
  $('#count').textContent = srcs.length ? `${srcs.length} ${T('items', 'ảnh/trang')}` : '';
  $<HTMLButtonElement>('#run').disabled = !srcs.length;
}
$('#thumbs').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-del]');
  if (b) { srcs.splice(Number(b.dataset.del), 1); renderThumbs(); }
});

/** Chuẩn bị ảnh: phóng to ảnh nhỏ, chuyển xám, tăng tương phản nhẹ (giúp Tesseract đọc tốt hơn) */
async function prepare(sr: Src): Promise<HTMLCanvasElement> {
  let c: HTMLCanvasElement;
  if (sr.canvas) c = sr.canvas;
  else {
    const bmp = await createImageBitmap(sr.file as File, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    c = document.createElement('canvas');
    const k = bmp.width < 1200 ? Math.min(3, 1600 / bmp.width) : Math.min(1, 4000 / Math.max(bmp.width, bmp.height));
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
  }
  if (!$<HTMLInputElement>('#enhance').checked) return c;
  const o = document.createElement('canvas');
  o.width = c.width;
  o.height = c.height;
  const ctx = o.getContext('2d') as CanvasRenderingContext2D;
  ctx.filter = 'grayscale(1) contrast(1.35)';
  ctx.drawImage(c, 0, 0);
  return o;
}

interface TWorker { recognize(img: unknown): Promise<{ data: { text: string; confidence?: number } }>; terminate(): Promise<void> }
interface Tess { createWorker(langs: string, oem: number, opts: Record<string, unknown>): Promise<TWorker> }

$('#run').addEventListener('click', async () => {
  showErr('');
  const btn = $<HTMLButtonElement>('#run');
  btn.disabled = true;
  const prog = $('#prog');
  prog.hidden = false;
  const bar = prog.querySelector('i') as HTMLElement;
  let worker: TWorker | null = null;
  let idx = 0;
  try {
    $('#status').textContent = T('loading', 'Đang tải bộ nhận dạng…');
    await loadScript(TESSERACT, 'Tesseract');
    worker = await global<Tess>('Tesseract').createWorker(s.langs.join('+'), 1, {
      logger: (m: { status: string; progress: number }) => {
        if (/loading|initializ/.test(m.status)) { $('#status').textContent = `${T('loadingLang', 'Đang tải dữ liệu ngôn ngữ')} ${Math.round((m.progress || 0) * 100)}%`; }
        if (m.status === 'recognizing text') bar.style.width = `${((idx + (m.progress || 0)) / srcs.length) * 100}%`;
      },
    });
    const parts: string[] = [];
    const confs: number[] = [];
    for (idx = 0; idx < srcs.length; idx++) {
      $('#status').textContent = `${T('reading', 'Đang đọc')} ${idx + 1}/${srcs.length}…`;
      const img = await prepare(srcs[idx]);
      const { data } = await worker.recognize(img);
      parts.push(srcs.length > 1 ? `--- ${srcs[idx].name} ---\n${data.text.trim()}` : data.text.trim());
      if (typeof data.confidence === 'number') confs.push(data.confidence);
    }
    bar.style.width = '100%';
    const text = parts.join('\n\n');
    $<HTMLTextAreaElement>('#out').value = text;
    $('#status').textContent = text.trim() ? T('done', 'Xong!') : '';
    if (!text.trim()) showErr(T('noText', 'Không tìm thấy chữ. Hãy thử ảnh rõ hơn, chọn đúng ngôn ngữ hoặc bật tăng nét ảnh.'));
    $('#conf').textContent = confs.length ? `${T('conf', 'Độ tin cậy')}: ${Math.round(confs.reduce((a, b) => a + b, 0) / confs.length)}%` : '';
  } catch (e) {
    $('#status').textContent = '';
    showErr(/fetch|network|load/i.test(String((e as Error)?.message ?? e)) ? T('errNet', 'Không tải được bộ nhận dạng hoặc dữ liệu ngôn ngữ. Kiểm tra kết nối mạng rồi thử lại.') : `${T('err', 'Có lỗi khi nhận dạng')}: ${(e as Error)?.message ?? e}`);
  } finally {
    await worker?.terminate().catch(() => undefined);
    btn.disabled = false;
    setTimeout(() => (prog.hidden = true), 600);
  }
});
$('#copy').addEventListener('click', () => { const v = $<HTMLTextAreaElement>('#out').value; if (v) void copyText(v); });
$('#dl').addEventListener('click', () => {
  const v = $<HTMLTextAreaElement>('#out').value;
  if (v) downloadBlob(new Blob([v], { type: 'text/plain;charset=utf-8' }), `${srcs[0] ? baseName(srcs[0].name.split(' · ')[0]) : 'ocr'}.txt`);
});
bindDropzone($('#drop'), $<HTMLInputElement>('#files'), (f) => void add(f));
document.addEventListener('paste', (e) => {
  const imgs = [...(e.clipboardData?.files ?? [])].filter((x) => x.type.startsWith('image/'));
  if (imgs.length) void add(imgs);
});
renderChips();
