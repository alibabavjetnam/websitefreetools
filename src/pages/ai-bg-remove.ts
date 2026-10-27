import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml, storage } from '../ui';
import { pageText } from '../i18n';
import { loadTransformers, withDevice, progressAdapter, canvasToRaw, type TransformersT, type TensorT } from '../lib/ai';
import { canvasToBlob, MAX_IMAGE_BYTES } from '../lib/image';
import { bindDropzone, baseName, fmtSize, makeZip } from '../lib/files';

mountLayout({ activeTool: 'ai-bg-remove' });
const T = pageText();

type ModelKind = 'general' | 'portrait';
const MODELS: Record<ModelKind, { id: string; input: string; output: string; sigmoid: boolean }> = {
  general: { id: 'onnx-community/BiRefNet_lite-ONNX', input: 'input_image', output: 'output_image', sigmoid: true },
  portrait: { id: 'Xenova/modnet', input: 'input', output: 'output', sigmoid: false },
};
const st = storage<{ model: ModelKind; bg: string; color: string }>('ai-bg-remove', { model: 'general', bg: 'none', color: '#ffffff' });
const s = st.get();

$('#tool-root').innerHTML = `
  <div class="workspace">
    <div class="panel">
      <label class="dropzone" id="drop">
        <input type="file" id="files" accept="image/*" multiple />
        <b>${T('dropTitle', 'Chọn ảnh hoặc kéo thả vào đây')}</b>
        <span>${T('dropHint', 'JPG, PNG, WebP. Nhiều ảnh cùng lúc, mỗi ảnh dưới 40 MB. Có thể dán ảnh bằng Ctrl+V.')}</span>
      </label>
      <fieldset class="field"><legend>${T('model', 'Loại ảnh')}</legend>
        <div class="fields">
          <label class="check"><input type="radio" name="model" value="general" /><span><b>${T('mGeneral', 'Mọi loại (sản phẩm, con vật, đồ vật, người)')}</b> — ${T('mGeneralD', 'chính xác nhất, tải mô hình khoảng 200 MB lần đầu')}</span></label>
          <label class="check"><input type="radio" name="model" value="portrait" /><span><b>${T('mPortrait', 'Chân dung người')}</b> — ${T('mPortraitD', 'nhanh, mô hình nhẹ khoảng 25 MB, hợp ảnh thẻ, ảnh đại diện')}</span></label>
        </div>
      </fieldset>
      <fieldset class="field"><legend>${T('bg', 'Nền mới')}</legend>
        <div class="row">
          <label class="check"><input type="radio" name="bg" value="none" /><span>${T('bgNone', 'Trong suốt (PNG)')}</span></label>
          <label class="check"><input type="radio" name="bg" value="white" /><span>${T('bgWhite', 'Trắng')}</span></label>
          <label class="check"><input type="radio" name="bg" value="color" /><span>${T('bgColor', 'Màu khác')}</span></label>
          <input type="color" id="color" aria-label="${T('bgColor', 'Màu khác')}" />
        </div>
      </fieldset>
      <div class="actions">
        <button type="button" class="btn btn-primary" id="run" disabled>${T('run', 'Xoá nền')}</button>
        <button type="button" class="btn" id="zip" disabled>${T('zip', 'Tải tất cả (.zip)')}</button>
      </div>
      <div class="progress" id="prog" hidden><i></i></div>
      <p class="note" id="status"></p>
      <p class="error" id="err" hidden></p>
      <p class="note">${T('note', 'AI chạy ngay trên máy bạn (dùng card đồ hoạ nếu trình duyệt hỗ trợ WebGPU), ảnh không gửi đi đâu. Mô hình chỉ tải lần đầu rồi được trình duyệt lưu lại. Máy yếu hoặc điện thoại có thể mất 10–60 giây mỗi ảnh. Ảnh nền trắng đơn giản có thể dùng công cụ Xoá nền ảnh (nhanh hơn).')}</p>
    </div>
    <section class="panel"><div class="fields" id="list"></div></section>
  </div>
`;

interface Item { file: File; url: string; out?: { blob: Blob; url: string; name: string }; error?: string }
let items: Item[] = [];
const showErr = (m: string) => { const e = $('#err'); e.textContent = m; e.hidden = !m; };
document.querySelectorAll<HTMLInputElement>('input[name=model]').forEach((r) => { r.checked = r.value === s.model; r.addEventListener('change', () => { s.model = r.value as ModelKind; st.set(s); }); });
document.querySelectorAll<HTMLInputElement>('input[name=bg]').forEach((r) => { r.checked = r.value === s.bg; r.addEventListener('change', () => { s.bg = r.value; st.set(s); }); });
$<HTMLInputElement>('#color').value = s.color;
$('#color').addEventListener('input', () => { s.color = $<HTMLInputElement>('#color').value; s.bg = 'color'; (document.querySelector('input[name=bg][value=color]') as HTMLInputElement).checked = true; st.set(s); });

function render(): void {
  $<HTMLButtonElement>('#run').disabled = !items.length;
  $<HTMLButtonElement>('#zip').disabled = !items.some((i) => i.out);
  $('#list').innerHTML = items.map((it, i) => `
    <div class="compare">
      <figure><img src="${it.url}" alt="" /><figcaption>${escapeHtml(it.file.name)} · ${fmtSize(it.file.size)}</figcaption></figure>
      <figure>${it.out ? `<img src="${it.out.url}" alt="" class="checker" /><figcaption><button type="button" class="btn btn-sm btn-primary" data-dl="${i}">${T('download', 'Tải ảnh')}</button> ${fmtSize(it.out.blob.size)}</figcaption>` : it.error ? `<p class="error">${escapeHtml(it.error)}</p>` : `<div class="checker" style="aspect-ratio:1;border-radius:6px"></div>`}</figure>
    </div>`).join('');
}
function add(files: File[]): void {
  showErr('');
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    if (f.size > MAX_IMAGE_BYTES) { showErr(`${f.name}: ${T('tooBig', 'lớn hơn 40 MB')}`); continue; }
    items.push({ file: f, url: URL.createObjectURL(f) });
  }
  render();
}

type Model = (inputs: Record<string, unknown>) => Promise<Record<string, TensorT>>;
type Processor = (img: ReturnType<typeof canvasToRaw>) => Promise<{ pixel_values: unknown }>;
const cache = new Map<ModelKind, { model: Model; processor: Processor }>();

async function getModel(tf: TransformersT, kind: ModelKind, onP: (l: number, t: number) => void): Promise<{ model: Model; processor: Processor }> {
  const hit = cache.get(kind);
  if (hit) return hit;
  const m = MODELS[kind];
  const progress_callback = progressAdapter((l, t) => onP(l, t));
  const loaded = await withDevice(async (device) => {
    const model = await tf.AutoModel.from_pretrained(m.id, { dtype: 'fp32', device, progress_callback });
    const processor = await tf.AutoProcessor.from_pretrained(m.id, {});
    return { model, processor };
  });
  cache.set(kind, loaded);
  return loaded;
}

async function process(tf: TransformersT, kind: ModelKind, it: Item): Promise<void> {
  const bmp = await createImageBitmap(it.file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  // Ảnh quá lớn: thu về tối đa 4096px cạnh dài cho đỡ tốn bộ nhớ
  const k = Math.min(1, 4096 / Math.max(bmp.width, bmp.height));
  const W = Math.round(bmp.width * k), H = Math.round(bmp.height * k);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  ctx.drawImage(bmp, 0, 0, W, H);
  bmp.close();
  const { model, processor } = await getModel(tf, kind, () => undefined);
  const m = MODELS[kind];
  const { pixel_values } = await processor(canvasToRaw(tf, c));
  const out = await model({ [m.input]: pixel_values });
  let tensor = out[m.output][0];
  if (m.sigmoid) tensor = tensor.sigmoid();
  const mask = await tf.RawImage.fromTensor(tensor.mul(255).to('uint8')).resize(W, H);
  const img = ctx.getImageData(0, 0, W, H);
  for (let i = 0, n = W * H; i < n; i++) img.data[i * 4 + 3] = mask.data[i * mask.channels];
  ctx.putImageData(img, 0, 0);
  let final = c;
  if (s.bg !== 'none') {
    final = document.createElement('canvas');
    final.width = W;
    final.height = H;
    const f = final.getContext('2d') as CanvasRenderingContext2D;
    f.fillStyle = s.bg === 'white' ? '#ffffff' : s.color;
    f.fillRect(0, 0, W, H);
    f.drawImage(c, 0, 0);
  }
  const mime = s.bg === 'none' ? 'image/png' : 'image/jpeg';
  const blob = await canvasToBlob(final, mime, 0.92);
  it.out = { blob, url: URL.createObjectURL(blob), name: `${baseName(it.file.name)}-${T('suffix', 'xoa-nen')}.${mime === 'image/png' ? 'png' : 'jpg'}` };
}

$('#run').addEventListener('click', async () => {
  showErr('');
  const btn = $<HTMLButtonElement>('#run');
  btn.disabled = true;
  const prog = $('#prog');
  prog.hidden = false;
  const bar = prog.querySelector('i') as HTMLElement;
  const kind = s.model;
  try {
    $('#status').textContent = T('loadingLib', 'Đang tải bộ chạy AI…');
    const tf = await loadTransformers();
    if (!cache.has(kind)) {
      $('#status').textContent = T('loadingModel', 'Đang tải mô hình AI (chỉ lần đầu)…');
      await getModel(tf, kind, (l, t) => {
        bar.style.width = `${t ? (l / t) * 100 : 0}%`;
        $('#status').textContent = `${T('loadingModel', 'Đang tải mô hình AI (chỉ lần đầu)…')} ${fmtSize(l)}${t ? ` / ${fmtSize(t)}` : ''}`;
      });
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.out) continue;
      bar.style.width = `${(i / items.length) * 100}%`;
      $('#status').textContent = `${T('working', 'Đang xử lý ảnh')} ${i + 1}/${items.length}…`;
      try { await process(tf, kind, it); it.error = undefined; }
      catch (e) { it.error = `${T('errImg', 'Không xử lý được ảnh này')}: ${(e as Error)?.message ?? e}`; }
      render();
    }
    bar.style.width = '100%';
    $('#status').textContent = T('done', 'Xong!');
    const done = items.filter((i) => i.out);
    if (done.length === 1 && items.length === 1) downloadBlob(done[0].out!.blob, done[0].out!.name);
  } catch (e) {
    $('#status').textContent = '';
    showErr((e as Error)?.message || T('err', 'Không chạy được AI trên trình duyệt này. Hãy thử Chrome hoặc Edge bản mới.'));
  } finally {
    btn.disabled = false;
    render();
    setTimeout(() => (prog.hidden = true), 600);
  }
});
$('#list').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-dl]');
  if (b) { const o = items[Number(b.dataset.dl)].out!; downloadBlob(o.blob, o.name); }
});
$('#zip').addEventListener('click', async () => {
  const outs = items.filter((i) => i.out).map((i) => ({ name: i.out!.name, data: i.out!.blob }));
  if (outs.length) downloadBlob(await makeZip(outs), `${T('zipName', 'anh-xoa-nen')}.zip`);
});
document.querySelectorAll('input[name=bg],#color').forEach((el) => el.addEventListener('change', () => { items.forEach((i) => (i.out = undefined)); render(); }));
bindDropzone($('#drop'), $<HTMLInputElement>('#files'), add);
document.addEventListener('paste', (e) => {
  const imgs = [...(e.clipboardData?.files ?? [])].filter((x) => x.type.startsWith('image/'));
  if (imgs.length) add(imgs);
});
