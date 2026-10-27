import { mountLayout } from '../layout';
import { $, downloadBlob, fmtInt, storage } from '../ui';
import { pageText } from '../i18n';
import { loadTransformers, withDevice, progressAdapter, canvasToRaw, rawToImageData, type TransformersT, type RawImageT } from '../lib/ai';
import { canvasToBlob, MAX_IMAGE_BYTES } from '../lib/image';
import { bindDropzone, baseName, fmtSize } from '../lib/files';

mountLayout({ activeTool: 'image-upscale' });
const T = pageText();

type Mode = 'x2' | 'x4photo' | 'x4clean';
const MODELS: Record<Mode, { id: string; scale: number; maxSide: number }> = {
  x2: { id: 'Xenova/swin2SR-classical-sr-x2-64', scale: 2, maxSide: 1600 },
  x4photo: { id: 'Xenova/swin2SR-realworld-sr-x4-64-bsrgan-psnr', scale: 4, maxSide: 900 },
  x4clean: { id: 'Xenova/swin2SR-compressed-sr-x4-48', scale: 4, maxSide: 900 },
};
const st = storage<{ mode: Mode; fmt: string }>('image-upscale', { mode: 'x2', fmt: 'image/png' });
const s = st.get();

$('#tool-root').innerHTML = `
  <div class="workspace">
    <div class="panel">
      <label class="dropzone" id="drop">
        <input type="file" id="file" accept="image/*" />
        <b>${T('dropTitle', 'Chọn ảnh hoặc kéo thả vào đây')}</b>
        <span>${T('dropHint', 'JPG, PNG, WebP. Ảnh nhỏ, ảnh mờ, ảnh cũ cho hiệu quả rõ nhất.')}</span>
      </label>
      <fieldset class="field"><legend>${T('mode', 'Mức phóng to')}</legend>
        <div class="fields">
          <label class="check"><input type="radio" name="mode" value="x2" /><span><b>×2</b> — ${T('mX2', 'nét và giữ chi tiết, nhanh nhất')}</span></label>
          <label class="check"><input type="radio" name="mode" value="x4photo" /><span><b>×4 ${T('photo', 'ảnh chụp')}</b> — ${T('mX4p', 'giảm nhiễu, hợp ảnh chụp điện thoại, ảnh cũ')}</span></label>
          <label class="check"><input type="radio" name="mode" value="x4clean" /><span><b>×4 ${T('jpeg', 'ảnh nén')}</b> — ${T('mX4c', 'xoá vết nén JPEG, hợp ảnh tải từ mạng')}</span></label>
        </div>
      </fieldset>
      <label class="field"><span class="field-label">${T('format', 'Định dạng lưu')}</span><select id="fmt"><option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option></select></label>
      <div class="actions"><button type="button" class="btn btn-primary" id="run" disabled>${T('run', 'Làm nét & phóng to')}</button><button type="button" class="btn" id="dl" disabled>${T('download', 'Tải ảnh')}</button></div>
      <div class="progress" id="prog" hidden><i></i></div>
      <p class="note" id="status"></p>
      <p class="error" id="err" hidden></p>
      <p class="note">${T('note', 'AI chạy ngay trên máy bạn, ảnh không gửi đi đâu. Lần đầu tải mô hình khoảng 5–20 MB. Ảnh được xử lý theo từng ô nhỏ nên ảnh lớn có thể mất vài phút; nên dùng Chrome hoặc Edge bản mới (hỗ trợ WebGPU sẽ nhanh hơn nhiều).')}</p>
    </div>
    <section class="panel">
      <div class="compare">
        <figure><img id="before" alt="" /><figcaption id="cap-before"></figcaption></figure>
        <figure><canvas id="after"></canvas><figcaption id="cap-after"></figcaption></figure>
      </div>
    </section>
  </div>
`;

let file: File | null = null;
let result: Blob | null = null;
const showErr = (m: string) => { const e = $('#err'); e.textContent = m; e.hidden = !m; };
document.querySelectorAll<HTMLInputElement>('input[name=mode]').forEach((r) => { r.checked = r.value === s.mode; r.addEventListener('change', () => { s.mode = r.value as Mode; st.set(s); }); });
$<HTMLSelectElement>('#fmt').value = s.fmt;
$('#fmt').addEventListener('change', () => { s.fmt = $<HTMLSelectElement>('#fmt').value; st.set(s); });

function pick(f: File): void {
  showErr('');
  if (!f.type.startsWith('image/')) { showErr(T('notImage', 'Hãy chọn file ảnh.')); return; }
  if (f.size > MAX_IMAGE_BYTES) { showErr(T('tooBig', 'Ảnh lớn hơn 40 MB.')); return; }
  file = f;
  result = null;
  const img = $<HTMLImageElement>('#before');
  img.src = URL.createObjectURL(f);
  img.onload = () => { $('#cap-before').textContent = `${T('orig', 'Gốc')}: ${fmtInt(img.naturalWidth)}×${fmtInt(img.naturalHeight)} · ${fmtSize(f.size)}`; };
  $<HTMLButtonElement>('#run').disabled = false;
  $<HTMLButtonElement>('#dl').disabled = true;
  $('#cap-after').textContent = '';
}

type Upscaler = (img: RawImageT) => Promise<RawImageT>;
const cache = new Map<Mode, Upscaler>();

async function getUpscaler(tf: TransformersT, mode: Mode, onP: (l: number, t: number) => void): Promise<Upscaler> {
  const hit = cache.get(mode);
  if (hit) return hit;
  const up = await withDevice((device) => tf.pipeline('image-to-image', MODELS[mode].id, { dtype: 'fp32', device, progress_callback: progressAdapter(onP) }));
  cache.set(mode, up);
  return up;
}

$('#run').addEventListener('click', async () => {
  if (!file) return;
  showErr('');
  const btn = $<HTMLButtonElement>('#run');
  btn.disabled = true;
  const prog = $('#prog');
  prog.hidden = false;
  const bar = prog.querySelector('i') as HTMLElement;
  const mode = s.mode;
  const M = MODELS[mode];
  try {
    $('#status').textContent = T('loadingLib', 'Đang tải bộ chạy AI…');
    const tf = await loadTransformers();
    const up = await getUpscaler(tf, mode, (l, t) => {
      bar.style.width = `${t ? (l / t) * 100 : 0}%`;
      $('#status').textContent = `${T('loadingModel', 'Đang tải mô hình AI (chỉ lần đầu)…')} ${fmtSize(l)}`;
    });
    // Ảnh nguồn: giới hạn cạnh dài để kết quả không quá lớn so với bộ nhớ
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const k = Math.min(1, M.maxSide / Math.max(bmp.width, bmp.height));
    const W = Math.round(bmp.width * k), H = Math.round(bmp.height * k);
    if (k < 1) showErr(`${T('shrunk', 'Ảnh lớn nên được thu về')} ${W}×${H} ${T('shrunk2', 'trước khi phóng to.')}`);
    const src = document.createElement('canvas');
    src.width = W;
    src.height = H;
    const sctx = src.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    sctx.fillStyle = '#fff';
    sctx.fillRect(0, 0, W, H);
    sctx.drawImage(bmp, 0, 0, W, H);
    bmp.close();
    const S = M.scale;
    const out = $<HTMLCanvasElement>('#after');
    out.width = W * S;
    out.height = H * S;
    const octx = out.getContext('2d') as CanvasRenderingContext2D;
    // Chia ảnh thành ô 128px, chồng mép 12px để không lộ đường nối
    const TILE = 128, PAD = 12;
    const tiles: [number, number][] = [];
    for (let y = 0; y < H; y += TILE) for (let x = 0; x < W; x += TILE) tiles.push([x, y]);
    const t0 = performance.now();
    for (let i = 0; i < tiles.length; i++) {
      const [x, y] = tiles[i];
      const x0 = Math.max(0, x - PAD), y0 = Math.max(0, y - PAD);
      const x1 = Math.min(W, x + TILE + PAD), y1 = Math.min(H, y + TILE + PAD);
      const tc = document.createElement('canvas');
      tc.width = x1 - x0;
      tc.height = y1 - y0;
      (tc.getContext('2d') as CanvasRenderingContext2D).drawImage(src, x0, y0, tc.width, tc.height, 0, 0, tc.width, tc.height);
      const res = await up(canvasToRaw(tf, tc));
      const rc = document.createElement('canvas');
      rc.width = res.width;
      rc.height = res.height;
      (rc.getContext('2d') as CanvasRenderingContext2D).putImageData(rawToImageData(res), 0, 0);
      // Mô hình có thể đệm ảnh lên bội số kích thước cửa sổ: chỉ lấy đúng phần tương ứng
      const cw = Math.min(TILE, W - x), ch = Math.min(TILE, H - y);
      octx.drawImage(rc, (x - x0) * S, (y - y0) * S, cw * S, ch * S, x * S, y * S, cw * S, ch * S);
      bar.style.width = `${((i + 1) / tiles.length) * 100}%`;
      const el = (performance.now() - t0) / 1000;
      const left = (el / (i + 1)) * (tiles.length - i - 1);
      $('#status').textContent = `${T('working', 'Đang xử lý')} ${i + 1}/${tiles.length} · ${T('left', 'còn khoảng')} ${Math.ceil(left)}s`;
      await new Promise((r) => setTimeout(r, 0));
    }
    result = await canvasToBlob(out, s.fmt, 0.95);
    $('#cap-after').textContent = `${T('result', 'Kết quả')}: ${fmtInt(out.width)}×${fmtInt(out.height)} · ${fmtSize(result.size)}`;
    $('#status').textContent = T('done', 'Xong!');
    $<HTMLButtonElement>('#dl').disabled = false;
  } catch (e) {
    $('#status').textContent = '';
    showErr((e as Error)?.message || T('err', 'Không chạy được AI trên trình duyệt này. Hãy thử Chrome hoặc Edge bản mới.'));
  } finally {
    btn.disabled = false;
    setTimeout(() => (prog.hidden = true), 600);
  }
});
$('#dl').addEventListener('click', () => {
  if (!result || !file) return;
  const ext = s.fmt === 'image/jpeg' ? 'jpg' : s.fmt === 'image/webp' ? 'webp' : 'png';
  downloadBlob(result, `${baseName(file.name)}-${MODELS[s.mode].scale}x.${ext}`);
});
bindDropzone($('#drop'), $<HTMLInputElement>('#file'), (f) => pick(f[0]));
document.addEventListener('paste', (e) => {
  const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'));
  if (f) pick(f);
});
