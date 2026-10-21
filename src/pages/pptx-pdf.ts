import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml, setupTabs, toast } from '../ui';
import { bindDropzone, baseName, extOf, fmtSize, safeFileName } from '../lib/files';
import { loadZip, type Zip } from '../lib/extract';
import { readPresentation, type Presentation } from '../lib/pptx';
import { renderSlide } from '../lib/pptx-render';
import { newPdf, pdfBlob } from '../lib/pdflib';
import { CDN, global, loadScript, openPdf, type PdfJsTextItem } from '../lib/cdn';

mountLayout({ activeTool: 'pptx-pdf' });

const MAX_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 300;
const QUALITY = [
  { id: 'normal', label: 'Thường', hint: 'File nhẹ, đủ xem trên máy tính, điện thoại.', px: 1280 },
  { id: 'high', label: 'Cao', hint: 'Nét khi trình chiếu toàn màn hình, in A4.', px: 1920 },
  { id: 'max', label: 'Rất cao', hint: 'In khổ lớn. File nặng hơn đáng kể.', px: 2880 },
];

const qualityField = (name: string) => `
  <fieldset class="field">
    <legend>Chất lượng</legend>
    <div class="format-list">
      ${QUALITY.map((q, i) => `<label class="format-option"><input type="radio" name="${name}" value="${q.id}"${i === 1 ? ' checked' : ''} /><span class="format-name">${q.label}</span></label>`).join('')}
    </div>
    <span class="field-hint" data-hint="${name}"></span>
  </fieldset>`;

const root = $('#tool-root');
root.innerHTML = `
  <div class="tabs" role="tablist" aria-label="Chọn chiều chuyển đổi">
    <button type="button" role="tab" data-tab="to-pdf">PowerPoint sang PDF</button>
    <button type="button" role="tab" data-tab="to-pptx">PDF sang PowerPoint</button>
  </div>

  <section class="tool-body" data-panel="to-pdf">
    <div class="panel">
      <label class="dropzone" id="a-drop">
        <input type="file" id="a-file" accept=".pptx,.ppsx,application/vnd.openxmlformats-officedocument.presentationml.presentation" />
        <b>Chọn file PowerPoint (.pptx) hoặc kéo thả vào đây</b>
        <span>File dưới 100 MB, tối đa ${MAX_PAGES} trang chiếu.</span>
      </label>
      ${qualityField('a-q')}
      <div class="actions">
        <button type="button" class="btn btn-primary" id="a-run" disabled>Chuyển sang PDF</button>
      </div>
      <p class="error" id="a-err" hidden></p>
      <p class="note">Mỗi trang chiếu được vẽ lại thành một trang PDF dạng ảnh nên không bôi đen chọn chữ được. Biểu đồ, SmartArt, hiệu ứng động chưa được hiển thị; phông chữ máy bạn không có sẽ được thay bằng phông gần giống. Cần bản PDF giống tuyệt đối thì dùng PowerPoint: <b>Tệp → Lưu thành → PDF</b>.</p>
      <div id="a-out"></div>
    </div>
  </section>

  <section class="tool-body" data-panel="to-pptx">
    <div class="panel">
      <label class="dropzone" id="b-drop">
        <input type="file" id="b-file" accept="application/pdf,.pdf" />
        <b>Chọn file PDF hoặc kéo thả vào đây</b>
        <span>File dưới 100 MB, tối đa ${MAX_PAGES} trang.</span>
      </label>
      ${qualityField('b-q')}
      <label class="check"><input type="checkbox" id="b-notes" checked /><span>Chép chữ của mỗi trang vào phần ghi chú (notes) của trang chiếu</span></label>
      <div class="actions">
        <button type="button" class="btn btn-primary" id="b-run" disabled>Chuyển sang PowerPoint</button>
      </div>
      <p class="error" id="b-err" hidden></p>
      <p class="note">Mỗi trang PDF trở thành một trang chiếu chứa ảnh của trang đó, giữ đúng bố cục, phông chữ, hình vẽ. Chữ trên trang chiếu không sửa trực tiếp được; nếu bật ghi chú, bạn có thể chép chữ từ phần ghi chú.</p>
      <div id="b-out"></div>
    </div>
  </section>
`;
setupTabs(root);

const showErr = (id: string, msg: string) => {
  const el = $(id);
  el.textContent = msg;
  el.hidden = !msg;
};
const quality = (name: string) => QUALITY.find((q) => q.id === root.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value) ?? QUALITY[1];
for (const name of ['a-q', 'b-q']) {
  const sync = () => ($(`[data-hint="${name}"]`).textContent = quality(name).hint);
  root.querySelectorAll(`input[name="${name}"]`).forEach((r) => r.addEventListener('change', sync));
  sync();
}

const canvasToBytes = (c: HTMLCanvasElement, q = 0.9): Promise<Uint8Array> =>
  new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? b.arrayBuffer().then((x) => resolve(new Uint8Array(x)), reject) : reject(new Error('Máy không đủ bộ nhớ để vẽ trang này. Hãy chọn chất lượng thấp hơn.'))), 'image/jpeg', q));

function previewGrid(canvases: HTMLCanvasElement[]): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'slide-grid';
  canvases.slice(0, 60).forEach((c, i) => {
    const fig = document.createElement('figure');
    const img = document.createElement('img');
    img.src = c.toDataURL('image/jpeg', 0.7);
    img.alt = `Trang ${i + 1}`;
    img.loading = 'lazy';
    const cap = document.createElement('figcaption');
    cap.textContent = String(i + 1);
    fig.append(img, cap);
    grid.append(fig);
  });
  return grid;
}

/** Thu nhỏ canvas để làm ảnh xem trước (giải phóng bộ nhớ ảnh lớn) */
function thumb(c: HTMLCanvasElement, w = 360): HTMLCanvasElement {
  const t = document.createElement('canvas');
  t.width = w;
  t.height = Math.round((c.height / c.width) * w);
  t.getContext('2d')?.drawImage(c, 0, 0, t.width, t.height);
  return t;
}

/* ---------------- PowerPoint → PDF ---------------- */

let pptxFile: File | null = null;

function pickPptx(files: File[]): void {
  const f = files[0];
  showErr('#a-err', '');
  $('#a-out').innerHTML = '';
  if (!f) return;
  const ext = extOf(f.name);
  if (ext === 'ppt' || ext === 'pps') return showErr('#a-err', 'File PowerPoint đời cũ (.ppt) chưa được hỗ trợ. Hãy mở bằng PowerPoint và lưu lại thành .pptx.');
  if (ext !== 'pptx' && ext !== 'ppsx') return showErr('#a-err', `${f.name}: không phải file PowerPoint (.pptx).`);
  if (f.size > MAX_BYTES) return showErr('#a-err', `${f.name}: lớn hơn 100 MB.`);
  pptxFile = f;
  $<HTMLButtonElement>('#a-run').disabled = false;
  $('#a-out').innerHTML = `<p class="split-info"><b>${escapeHtml(f.name)}</b> · ${fmtSize(f.size)}</p>`;
}

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml' };

function imageLoader(zip: Zip, missing: Set<string>) {
  const cache = new Map<string, Promise<HTMLImageElement | null>>();
  return (path: string): Promise<HTMLImageElement | null> => {
    let p = cache.get(path);
    if (!p) {
      p = (async () => {
        const entry = zip.file(path);
        const mime = MIME[extOf(path)];
        if (!entry || !mime) { missing.add(extOf(path).toUpperCase() || 'ảnh'); return null; }
        const blob = new Blob([await entry.async('blob')], { type: mime });
        const url = URL.createObjectURL(blob);
        try {
          const img = new Image();
          img.src = url;
          await img.decode();
          return img;
        } catch {
          missing.add(extOf(path).toUpperCase());
          return null;
        } finally {
          // Ảnh đã giải mã xong, giữ URL đến khi vẽ xong cả file thì không cần thiết
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        }
      })();
      cache.set(path, p);
    }
    return p;
  };
}

$('#a-run').addEventListener('click', async () => {
  if (!pptxFile) return;
  const btn = $<HTMLButtonElement>('#a-run');
  const file = pptxFile;
  showErr('#a-err', '');
  btn.disabled = true;
  btn.textContent = 'Đang đọc file…';
  try {
    const zip = await loadZip(await file.arrayBuffer());
    let pres: Presentation;
    try {
      pres = await readPresentation({ text: async (p) => (await zip.file(p)?.async('string')) ?? null });
    } catch (e) {
      throw new Error(`Không đọc được bài trình chiếu: ${(e as Error).message}`);
    }
    if (!pres.slides.length) throw new Error('File không có trang chiếu nào.');
    if (pres.slides.length > MAX_PAGES) throw new Error(`File có ${pres.slides.length} trang chiếu, vượt quá giới hạn ${MAX_PAGES}.`);
    // Chờ phông tiếng Việt dự phòng sẵn sàng để chữ không bị vẽ bằng phông mặc định
    await Promise.all(['400', '700'].map((w) => document.fonts.load(`${w} 16px "Be Vietnam Pro"`).catch(() => null)));
    const missing = new Set<string>();
    const load = imageLoader(zip, missing);
    const q = quality('a-q');
    const pdf = await newPdf();
    const thumbs: HTMLCanvasElement[] = [];
    for (const slide of pres.slides) {
      btn.textContent = `Đang vẽ trang ${slide.index}/${pres.slides.length}…`;
      const canvas = await renderSlide(pres, slide, q.px, load);
      const img = await pdf.embedJpg(await canvasToBytes(canvas));
      pdf.addPage([pres.width, pres.height]).drawImage(img, { x: 0, y: 0, width: pres.width, height: pres.height });
      thumbs.push(thumb(canvas));
      canvas.width = canvas.height = 0; // trả bộ nhớ ngay
    }
    btn.textContent = 'Đang tạo PDF…';
    const name = safeFileName(baseName(file.name));
    pdf.setTitle(name);
    const blob = pdfBlob(await pdf.save());
    const out = $('#a-out');
    out.innerHTML = `
      <div class="stat-grid">
        <div class="stat"><span class="stat-label">Số trang</span><span class="stat-value">${pres.slides.length}</span></div>
        <div class="stat stat--main"><span class="stat-label">File PDF</span><span class="stat-value">${fmtSize(blob.size)}</span></div>
      </div>
      ${missing.size ? `<p class="note">Có ảnh định dạng ${[...missing].map(escapeHtml).join(', ')} trình duyệt không vẽ được nên đã bỏ qua.</p>` : ''}
      <div class="actions"><button type="button" class="btn btn-primary" id="a-dl">Tải file PDF</button></div>`;
    out.append(previewGrid(thumbs));
    $('#a-dl').addEventListener('click', () => downloadBlob(blob, `${name}.pdf`));
    downloadBlob(blob, `${name}.pdf`);
    toast(`Đã chuyển ${pres.slides.length} trang sang PDF`);
  } catch (e) {
    showErr('#a-err', (e as Error).message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Chuyển sang PDF';
  }
});
bindDropzone($('#a-drop'), $<HTMLInputElement>('#a-file'), pickPptx);

/* ---------------- PDF → PowerPoint ---------------- */

interface PptxSlide { addImage(o: { data: string; x: number; y: number; w: number; h: number }): void; addNotes(t: string): void }
interface PptxDoc {
  defineLayout(o: { name: string; width: number; height: number }): void;
  layout: string;
  title: string;
  company: string;
  addSlide(): PptxSlide;
  write(o: { outputType: 'blob' }): Promise<Blob>;
}

let pdfFile: File | null = null;

function pickPdf(files: File[]): void {
  const f = files[0];
  showErr('#b-err', '');
  $('#b-out').innerHTML = '';
  if (!f) return;
  if (extOf(f.name) !== 'pdf' && f.type !== 'application/pdf') return showErr('#b-err', `${f.name}: không phải file PDF.`);
  if (f.size > MAX_BYTES) return showErr('#b-err', `${f.name}: lớn hơn 100 MB.`);
  pdfFile = f;
  $<HTMLButtonElement>('#b-run').disabled = false;
  $('#b-out').innerHTML = `<p class="split-info"><b>${escapeHtml(f.name)}</b> · ${fmtSize(f.size)}</p>`;
}

/** Ghép chữ trong trang PDF thành các dòng */
function pageText(items: (PdfJsTextItem | { type: string })[]): string {
  let s = '';
  for (const it of items) {
    if (!('str' in it)) continue;
    s += it.str + (it.hasEOL ? '\n' : '');
  }
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

$('#b-run').addEventListener('click', async () => {
  if (!pdfFile) return;
  const btn = $<HTMLButtonElement>('#b-run');
  const file = pdfFile;
  showErr('#b-err', '');
  btn.disabled = true;
  btn.textContent = 'Đang đọc file…';
  const doc = await openPdf(new Uint8Array(await file.arrayBuffer())).catch((e: Error) => {
    showErr('#b-err', e.message);
    return null;
  });
  if (!doc) {
    btn.disabled = false;
    btn.textContent = 'Chuyển sang PowerPoint';
    return;
  }
  try {
    if (doc.numPages > MAX_PAGES) throw new Error(`File có ${doc.numPages} trang, vượt quá giới hạn ${MAX_PAGES}.`);
    await loadScript(CDN.pptxgen, 'PptxGenJS');
    const pptx = new (global<new () => PptxDoc>('PptxGenJS'))();
    // Khổ trang chiếu theo trang đầu (đơn vị inch, PowerPoint cho phép 1–56 inch)
    const first = (await doc.getPage(1)).getViewport({ scale: 1 });
    let W = first.width / 72;
    let H = first.height / 72;
    const k = Math.min(1, 56 / Math.max(W, H));
    W = Math.max(1, W * k);
    H = Math.max(1, H * k);
    pptx.defineLayout({ name: 'PDF', width: W, height: H });
    pptx.layout = 'PDF';
    pptx.title = baseName(file.name);
    pptx.company = 'WFTools';
    const q = quality('b-q');
    const withNotes = $<HTMLInputElement>('#b-notes').checked;
    const thumbs: HTMLCanvasElement[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      btn.textContent = `Đang chuyển trang ${n}/${doc.numPages}…`;
      const page = await doc.getPage(n);
      const vp1 = page.getViewport({ scale: 1 });
      // Cạnh dài của ảnh trang bằng số điểm ảnh theo mức chất lượng
      const vp = page.getViewport({ scale: q.px / Math.max(vp1.width, vp1.height) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      // Trang khác khổ trang đầu: thu vừa khung, căn giữa
      const s = Math.min(W / (vp1.width / 72), H / (vp1.height / 72));
      const w = (vp1.width / 72) * s;
      const h = (vp1.height / 72) * s;
      const slide = pptx.addSlide();
      slide.addImage({ data: canvas.toDataURL('image/jpeg', 0.88).replace(/^data:/, ''), x: (W - w) / 2, y: (H - h) / 2, w, h });
      if (withNotes) {
        const text = pageText((await page.getTextContent()).items);
        if (text) slide.addNotes(text);
      }
      page.cleanup();
      thumbs.push(thumb(canvas));
      canvas.width = canvas.height = 0;
    }
    btn.textContent = 'Đang tạo file PowerPoint…';
    const blob = await pptx.write({ outputType: 'blob' });
    const name = safeFileName(baseName(file.name));
    const out = $('#b-out');
    out.innerHTML = `
      <div class="stat-grid">
        <div class="stat"><span class="stat-label">Số trang chiếu</span><span class="stat-value">${doc.numPages}</span></div>
        <div class="stat stat--main"><span class="stat-label">File PowerPoint</span><span class="stat-value">${fmtSize(blob.size)}</span></div>
      </div>
      <div class="actions"><button type="button" class="btn btn-primary" id="b-dl">Tải file .pptx</button></div>`;
    out.append(previewGrid(thumbs));
    $('#b-dl').addEventListener('click', () => downloadBlob(blob, `${name}.pptx`));
    downloadBlob(blob, `${name}.pptx`);
    toast(`Đã chuyển ${doc.numPages} trang sang PowerPoint`);
  } catch (e) {
    showErr('#b-err', (e as Error).message);
  } finally {
    await doc.destroy();
    btn.disabled = false;
    btn.textContent = 'Chuyển sang PowerPoint';
  }
});
bindDropzone($('#b-drop'), $<HTMLInputElement>('#b-file'), pickPdf);
