import { mountLayout } from '../layout';
import { $, downloadBlob, toast } from '../ui';
import { MAX_IMAGE_BYTES, canvasToBlob, drawToCanvas, loadImage, renameFile } from '../lib/image';
import { keyOutBackground } from '../lib/bg-remove';

mountLayout({ activeTool: 'bg-remove' });

/* Mô hình AI: Transformers.js (Apache-2.0) chạy BiRefNet lite (MIT), tải từ CDN khi người dùng chọn chế độ AI */
const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
const MODEL_ID = 'onnx-community/BiRefNet_lite-ONNX';
const MAX_SIDE = 2400; // ảnh lớn hơn được thu nhỏ để xử lý nhanh và không hết bộ nhớ

$('#tool-root').innerHTML = `
  <div class="workspace tool-body">
    <div class="panel">
      <label class="dropzone" id="drop">
        <input type="file" id="file" accept="image/png,image/jpeg,image/webp,image/avif,image/bmp" />
        <b>Chọn một ảnh hoặc kéo thả vào đây</b>
        <span>JPG, PNG, WebP. Ảnh được xử lý ngay trên máy của bạn, không tải lên đâu cả.</span>
      </label>
      <fieldset class="field">
        <legend>Cách xoá nền</legend>
        <label class="check"><input type="radio" name="mode" value="simple" checked /><span><b>Nền đơn giản</b>: nhanh, hợp ảnh sản phẩm chụp trên nền trắng hoặc một màu</span></label>
        <label class="check"><input type="radio" name="mode" value="ai" /><span><b>Dùng AI</b>: hợp ảnh chân dung, nền nhiều chi tiết. Lần đầu tải mô hình khoảng 115–225 MB</span></label>
      </fieldset>
      <div id="simple-opts" class="form-grid">
        <label class="field span-all"><span class="field-label">Độ nhạy: <output id="tol-out">12</output></span><input type="range" id="tol" min="1" max="60" value="12" /></label>
        <label class="check span-all"><input type="checkbox" id="contiguous" checked /><span>Chỉ xoá vùng nền nối với mép ảnh (giữ lại chi tiết cùng màu bên trong vật thể)</span></label>
        <p class="note span-all">Màu nền được tự nhận từ mép ảnh. Nếu nhận sai, bấm vào vùng nền trên ảnh gốc để chọn lại.</p>
      </div>
      <div id="ai-opts" hidden>
        <p class="note" id="ai-status">Mô hình AI chưa được tải. Bấm "Xoá nền" để tải và chạy.</p>
        <progress id="ai-progress" max="100" value="0" hidden></progress>
      </div>
      <label class="field"><span class="field-label">Làm mềm viền: <output id="feather-out">1</output> px</span><input type="range" id="feather" min="0" max="6" value="1" /></label>
      <div class="actions">
        <button type="button" class="btn btn-primary" id="run" disabled>Xoá nền</button>
      </div>
      <p class="error" id="err" hidden></p>
    </div>
    <section class="preview">
      <div class="bg-compare">
        <figure><figcaption>Ảnh gốc</figcaption><div class="bg-stage" id="src-stage"><p class="note">Chưa chọn ảnh.</p></div></figure>
        <figure><figcaption>Kết quả</figcaption><div class="bg-stage checker" id="out-stage"><p class="note">Kết quả sẽ hiện ở đây.</p></div></figure>
      </div>
      <fieldset class="field">
        <legend>Nền khi tải về</legend>
        <div class="row">
          <label class="check"><input type="radio" name="bgout" value="none" checked /><span>Trong suốt (PNG)</span></label>
          <label class="check"><input type="radio" name="bgout" value="color" /><span>Màu</span></label>
          <input type="color" id="bgcolor" value="#ffffff" aria-label="Màu nền mới" />
        </div>
      </fieldset>
      <div class="actions"><button type="button" class="btn btn-primary" id="dl" disabled>Tải ảnh về</button></div>
    </section>
  </div>
`;

let file: File | null = null;
let srcCanvas: HTMLCanvasElement | null = null;
let alpha: Uint8ClampedArray | null = null; // kênh trong suốt sau khi xoá nền (chưa làm mềm)
let pickedBg: [number, number, number] | undefined;

const mode = () => (document.querySelector<HTMLInputElement>('input[name="mode"]:checked')?.value ?? 'simple') as 'simple' | 'ai';
const err = (msg: string) => { $('#err').textContent = msg; $('#err').hidden = !msg; };

async function setFile(f: File): Promise<void> {
  err('');
  if (!f.type.startsWith('image/')) return err('File này không phải ảnh.');
  if (f.size > MAX_IMAGE_BYTES) return err('Ảnh lớn hơn 40 MB.');
  try {
    const img = await loadImage(f);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    srcCanvas = drawToCanvas(img, img.width * scale, img.height * scale);
    img.close();
  } catch (e) {
    return err((e as Error).message);
  }
  file = f;
  alpha = null;
  pickedBg = undefined;
  const stage = $('#src-stage');
  stage.innerHTML = '';
  srcCanvas.className = 'bg-canvas';
  srcCanvas.title = 'Bấm vào vùng nền để chọn màu nền';
  stage.appendChild(srcCanvas);
  $('#out-stage').innerHTML = '<p class="note">Bấm "Xoá nền" để xử lý.</p>';
  $<HTMLButtonElement>('#run').disabled = false;
  $<HTMLButtonElement>('#dl').disabled = true;
  if (mode() === 'simple') runSimple();
}

/* ---------- Chế độ thuật toán ---------- */
function runSimple(): void {
  if (!srcCanvas) return;
  const ctx = srcCanvas.getContext('2d') as CanvasRenderingContext2D;
  const data = ctx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
  alpha = keyOutBackground(data.data, data.width, data.height, {
    tolerance: Number($<HTMLInputElement>('#tol').value),
    contiguous: $<HTMLInputElement>('#contiguous').checked,
    bg: pickedBg,
  });
  renderResult();
}

/* ---------- Chế độ AI ---------- */
interface TfModule {
  env: { allowLocalModels: boolean };
  AutoModel: { from_pretrained(id: string, o: object): Promise<(inp: object) => Promise<{ output_image: { [i: number]: TfTensor } }>> };
  AutoProcessor: { from_pretrained(id: string): Promise<(img: unknown) => Promise<{ pixel_values: unknown }>> };
  RawImage: { fromURL(u: string): Promise<unknown>; fromTensor(t: TfTensor): { resize(w: number, h: number): Promise<{ data: Uint8Array }> } };
}
interface TfTensor { sigmoid(): TfTensor; mul(n: number): TfTensor; to(t: string): TfTensor }

let aiPromise: Promise<{ model: Awaited<ReturnType<TfModule['AutoModel']['from_pretrained']>>; processor: Awaited<ReturnType<TfModule['AutoProcessor']['from_pretrained']>>; tf: TfModule }> | null = null;

function loadAi() {
  aiPromise ??= (async () => {
    const status = $('#ai-status');
    const bar = $<HTMLProgressElement>('#ai-progress');
    status.textContent = 'Đang tải thư viện AI…';
    const tf = (await import(/* @vite-ignore */ TRANSFORMERS_URL)) as TfModule;
    tf.env.allowLocalModels = false;
    const webgpu = 'gpu' in navigator;
    const files = new Map<string, { loaded: number; total: number }>();
    bar.hidden = false;
    const model = await tf.AutoModel.from_pretrained(MODEL_ID, {
      // WebGPU chạy nhanh với bản fp16 (~115 MB); máy không có WebGPU dùng bản fp32 (~225 MB) trên CPU
      device: webgpu ? 'webgpu' : 'wasm',
      dtype: webgpu ? 'fp16' : 'fp32',
      progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status === 'progress' && p.file && p.total) {
          files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
          const all = [...files.values()];
          const pct = (all.reduce((s, x) => s + x.loaded, 0) / all.reduce((s, x) => s + x.total, 0)) * 100;
          bar.value = pct;
          status.textContent = `Đang tải mô hình AI (chỉ lần đầu): ${Math.round(pct)}%`;
        }
      },
    });
    const processor = await tf.AutoProcessor.from_pretrained(MODEL_ID);
    bar.hidden = true;
    status.textContent = `Mô hình AI đã sẵn sàng (${webgpu ? 'chạy bằng card đồ hoạ' : 'chạy bằng CPU, sẽ chậm hơn'}).`;
    return { model, processor, tf };
  })().catch((e) => {
    aiPromise = null;
    $<HTMLProgressElement>('#ai-progress').hidden = true;
    $('#ai-status').textContent = 'Chưa tải được mô hình AI.';
    throw new Error(`Không tải được mô hình AI (${(e as Error).message}). Kiểm tra kết nối mạng, hoặc dùng chế độ "Nền đơn giản".`);
  });
  return aiPromise;
}

async function runAi(): Promise<void> {
  if (!srcCanvas) return;
  const { model, processor, tf } = await loadAi();
  $('#ai-status').textContent = 'Đang tách nền…';
  const blob = await canvasToBlob(srcCanvas, 'image/png');
  const url = URL.createObjectURL(blob);
  try {
    const image = await tf.RawImage.fromURL(url);
    const { pixel_values } = await processor(image);
    const { output_image } = await model({ input_image: pixel_values });
    const mask = await tf.RawImage.fromTensor(output_image[0].sigmoid().mul(255).to('uint8')).resize(srcCanvas.width, srcCanvas.height);
    alpha = new Uint8ClampedArray(mask.data);
    $('#ai-status').textContent = 'Đã tách nền xong.';
    renderResult();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ---------- Ghép kết quả ---------- */
function resultCanvas(withBg: boolean): HTMLCanvasElement | null {
  if (!srcCanvas || !alpha) return null;
  const { width: w, height: h } = srcCanvas;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d') as CanvasRenderingContext2D;
  const data = (srcCanvas.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, w, h);
  // Làm mềm viền: làm mờ kênh trong suốt bằng bộ lọc blur của canvas
  const feather = Number($<HTMLInputElement>('#feather').value);
  let a = alpha;
  if (feather > 0) {
    const m = document.createElement('canvas');
    m.width = w;
    m.height = h;
    const mctx = m.getContext('2d') as CanvasRenderingContext2D;
    const mdata = mctx.createImageData(w, h);
    for (let p = 0; p < w * h; p++) { mdata.data[p * 4 + 3] = a[p]; }
    mctx.putImageData(mdata, 0, 0);
    const b = document.createElement('canvas');
    b.width = w;
    b.height = h;
    const bctx = b.getContext('2d') as CanvasRenderingContext2D;
    bctx.filter = `blur(${feather * 0.6}px)`;
    bctx.drawImage(m, 0, 0);
    const bd = bctx.getImageData(0, 0, w, h).data;
    a = new Uint8ClampedArray(w * h);
    for (let p = 0; p < w * h; p++) a[p] = Math.min(alpha[p], bd[p * 4 + 3] * 1.15);
  }
  for (let p = 0; p < w * h; p++) data.data[p * 4 + 3] = Math.min(data.data[p * 4 + 3], a[p]);
  if (withBg) {
    ctx.fillStyle = $<HTMLInputElement>('#bgcolor').value;
    ctx.fillRect(0, 0, w, h);
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    (tmp.getContext('2d') as CanvasRenderingContext2D).putImageData(data, 0, 0);
    ctx.drawImage(tmp, 0, 0);
  } else {
    ctx.putImageData(data, 0, 0);
  }
  return out;
}

const withBg = () => document.querySelector<HTMLInputElement>('input[name="bgout"]:checked')?.value === 'color';

function renderResult(): void {
  const out = resultCanvas(withBg());
  if (!out) return;
  out.className = 'bg-canvas';
  const stage = $('#out-stage');
  stage.innerHTML = '';
  stage.appendChild(out);
  $<HTMLButtonElement>('#dl').disabled = false;
}

/* ---------- Sự kiện ---------- */
const fileInput = $<HTMLInputElement>('#file');
fileInput.addEventListener('change', () => { const f = fileInput.files?.[0]; if (f) void setFile(f); fileInput.value = ''; });
const drop = $('#drop');
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('is-over')));
drop.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer?.files[0]; if (f) void setFile(f); });

document.querySelectorAll<HTMLInputElement>('input[name="mode"]').forEach((r) =>
  r.addEventListener('change', () => {
    const m = mode();
    $('#simple-opts').hidden = m !== 'simple';
    $('#ai-opts').hidden = m !== 'ai';
    if (m === 'simple' && srcCanvas) runSimple();
  }),
);
$('#tol').addEventListener('input', () => { $('#tol-out').textContent = $<HTMLInputElement>('#tol').value; if (mode() === 'simple') runSimple(); });
$('#contiguous').addEventListener('change', () => mode() === 'simple' && runSimple());
$('#feather').addEventListener('input', () => { $('#feather-out').textContent = $<HTMLInputElement>('#feather').value; renderResult(); });
document.querySelectorAll('input[name="bgout"], #bgcolor').forEach((el) => el.addEventListener('input', renderResult));

// Bấm vào ảnh gốc để chọn màu nền thủ công
$('#src-stage').addEventListener('click', (e) => {
  if (!srcCanvas || mode() !== 'simple' || e.target !== srcCanvas) return;
  const rect = srcCanvas.getBoundingClientRect();
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * srcCanvas.width);
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * srcCanvas.height);
  const d = (srcCanvas.getContext('2d') as CanvasRenderingContext2D).getImageData(x, y, 1, 1).data;
  pickedBg = [d[0], d[1], d[2]];
  toast(`Đã chọn màu nền rgb(${d[0]}, ${d[1]}, ${d[2]})`);
  runSimple();
});

$('#run').addEventListener('click', async () => {
  const btn = $<HTMLButtonElement>('#run');
  btn.disabled = true;
  err('');
  try {
    if (mode() === 'ai') await runAi();
    else runSimple();
  } catch (e) {
    err((e as Error).message);
  } finally {
    btn.disabled = false;
  }
});

$('#dl').addEventListener('click', async () => {
  const bg = withBg();
  const out = resultCanvas(bg);
  if (!out || !file) return;
  const blob = await canvasToBlob(out, bg ? 'image/jpeg' : 'image/png', 0.92);
  downloadBlob(blob, renameFile(file.name, bg ? 'jpg' : 'png', '-xoa-nen'));
});
