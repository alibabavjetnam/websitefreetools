import { mountLayout } from '../layout';
import { $, downloadBlob, storage, toast } from '../ui';
import { CDN, global, loadScript } from '../lib/cdn';
import { pageText } from '../i18n';

mountLayout({ activeTool: 'countdown-video' });
const T = pageText();

interface Cfg { seconds: number; format: 'hms' | 'ms' | 's'; bg: string; color: string; font: string; label: string; size: string; fps: number }
const cfg = storage<Cfg>('countdown-video', { seconds: 60, format: 'ms', bg: '#0b1324', color: '#ffd43b', label: '', size: '720p', font: 'mono', fps: 30 });

const SIZES: Record<string, [number, number]> = { '720p': [1280, 720], '1080p': [1920, 1080], square: [1080, 1080], vertical: [720, 1280] };
const FONTS: Record<string, string> = { mono: 'ui-monospace, Consolas, monospace', sans: "'Be Vietnam Pro', system-ui, sans-serif", bold: "'Arial Black', sans-serif" };

const root = $('#tool-root');
root.innerHTML = `
  <div class="workspace">
    <form class="panel" id="form">
      <div class="field-row">
        <label class="field"><span class="field-label">${T('duration','Thời lượng (giây)')}</span><input type="number" id="seconds" min="1" max="3600" /></label>
        <label class="field"><span class="field-label">${T('display','Hiển thị')}</span><select id="format"><option value="hms">hh:mm:ss</option><option value="ms">mm:ss</option><option value="s">${T('fmt.s','Chỉ giây')}</option></select></label>
        <label class="field"><span class="field-label">${T('fps','Khung hình/giây')}</span><select id="fps"><option value="24">24</option><option value="30">30</option></select></label>
      </div>
      <label class="field"><span class="field-label">${T('labelText','Dòng chữ phía trên')}</span><input type="text" id="label" maxlength="40" /></label>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('bg','Màu nền')}</span><input type="color" id="bg" /></label>
        <label class="field"><span class="field-label">${T('color','Màu số')}</span><input type="color" id="color" /></label>
        <label class="field"><span class="field-label">${T('font','Phông')}</span><select id="font"><option value="mono">${T('font.mono','Đồng hồ số')}</option><option value="sans">${T('font.sans','Hiện đại')}</option><option value="bold">${T('font.bold','Đậm')}</option></select></label>
      </div>
      <label class="field"><span class="field-label">${T('size','Kích thước video')}</span><select id="size"><option value="720p">${T('size.720','Ngang 1280×720 (HD)')}</option><option value="1080p">${T('size.1080','Ngang 1920×1080 (Full HD)')}</option><option value="square">${T('size.square','Vuông 1080×1080')}</option><option value="vertical">${T('size.vertical','Dọc 720×1280')}</option></select></label>
      <div class="actions">
        <button type="button" class="btn" id="preview-btn">${T('preview','Xem thử')}</button>
        <button type="button" class="btn btn-primary" id="render">${T('render','Tạo & tải video')}</button>
      </div>
      <div class="progress-wrap" id="progress" hidden><div class="progress-bar" id="progress-bar"></div><span id="progress-text"></span></div>
      <p class="error" id="err" hidden></p>
    </form>
    <section class="preview">
      <canvas id="canvas" class="cd-canvas"></canvas>
    </section>
  </div>
  <p class="note" id="format-note"></p>
`;

const canvas = $('#canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

function read(): Cfg {
  return {
    seconds: Math.max(1, Math.min(3600, Number($<HTMLInputElement>('#seconds').value) || 60)),
    format: $<HTMLSelectElement>('#format').value as Cfg['format'],
    bg: $<HTMLInputElement>('#bg').value,
    color: $<HTMLInputElement>('#color').value,
    font: $<HTMLSelectElement>('#font').value,
    label: $<HTMLInputElement>('#label').value,
    size: $<HTMLSelectElement>('#size').value,
    fps: Number($<HTMLSelectElement>('#fps').value),
  };
}

function fmt(sec: number, format: Cfg['format']): string {
  const two = (n: number) => String(n).padStart(2, '0');
  if (format === 's') return String(sec);
  if (format === 'ms') return `${two(Math.floor(sec / 60))}:${two(sec % 60)}`;
  return `${two(Math.floor(sec / 3600))}:${two(Math.floor(sec / 60) % 60)}:${two(sec % 60)}`;
}

function drawFrame(c: Cfg, remainSec: number, w: number, h: number): void {
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (c.label) {
    ctx.fillStyle = c.color;
    ctx.globalAlpha = 0.85;
    ctx.font = `600 ${Math.round(h * 0.07)}px ${FONTS[c.font]}`;
    ctx.fillText(c.label, w / 2, h * 0.3);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = c.color;
  const text = fmt(Math.ceil(remainSec), c.format);
  const size = Math.round(h * (text.length > 5 ? 0.26 : 0.34));
  ctx.font = `700 ${size}px ${FONTS[c.font]}`;
  ctx.fillText(text, w / 2, h * 0.52);
}

function renderPreview(): void {
  const c = read();
  cfg.set(c);
  const [w, h] = SIZES[c.size];
  canvas.width = w;
  canvas.height = h;
  drawFrame(c, c.seconds, w, h);
  $('#format-note').textContent = `${T('note.len','Video dài')} ${c.seconds} ${T('note.sec','giây')}, ${c.fps} ${T('note.fps','khung/giây')}, ${w}×${h}. ${T('note.counts','Đồng hồ đếm từ')} ${fmt(c.seconds, c.format)} ${T('note.to00','về 00.')}`;
}

/* ---- WebCodecs + mp4-muxer (xuất MP4); không hỗ trợ thì dùng MediaRecorder (webm) ---- */
interface MuxerNS {
  Muxer: new (o: unknown) => { addVideoChunk(c: unknown, m: unknown): void; finalize(): void; target: { buffer: ArrayBuffer } };
  ArrayBufferTarget: new () => unknown;
}

const showErr = (m: string) => { $('#err').textContent = m; $('#err').hidden = !m; };
const setProgress = (p: number, text: string) => {
  $('#progress').hidden = false;
  $<HTMLElement>('#progress-bar').style.width = `${p}%`;
  $('#progress-text').textContent = text;
};

async function supportsAvc(w: number, h: number, fps: number): Promise<string | null> {
  if (typeof VideoEncoder === 'undefined') return null;
  for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42e01f', 'avc1.42001f']) {
    try {
      const res = await VideoEncoder.isConfigSupported({ codec, width: w, height: h, bitrate: 6_000_000, framerate: fps });
      if (res.supported) return codec;
    } catch { /* thử codec khác */ }
  }
  return null;
}

async function renderMp4(c: Cfg, w: number, h: number, codec: string): Promise<Blob> {
  await loadScript(CDN.mp4Muxer, 'Mp4Muxer');
  const M = global<MuxerNS>('Mp4Muxer');
  const muxer = new M.Muxer({ target: new M.ArrayBufferTarget(), video: { codec: 'avc', width: w, height: h }, fastStart: 'in-memory' });
  const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { throw e; } });
  encoder.configure({ codec, width: w, height: h, bitrate: 6_000_000, framerate: c.fps });
  const totalFrames = c.seconds * c.fps;
  for (let i = 0; i < totalFrames; i++) {
    const remain = c.seconds - i / c.fps;
    drawFrame(c, remain, w, h);
    const frame = new VideoFrame(canvas, { timestamp: (i * 1_000_000) / c.fps, duration: 1_000_000 / c.fps });
    encoder.encode(frame, { keyFrame: i % (c.fps * 2) === 0 });
    frame.close();
    if (i % 10 === 0) { setProgress((i / totalFrames) * 90, `${T('prog.build','Đang dựng khung hình')} ${i}/${totalFrames}…`); await new Promise((r) => setTimeout(r)); }
    if (encoder.encodeQueueSize > 30) await new Promise((r) => setTimeout(r, 10));
  }
  setProgress(92, T('prog.mux','Đang ghép video…'));
  await encoder.flush();
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: 'video/mp4' });
}

async function renderWebm(c: Cfg, w: number, h: number): Promise<Blob> {
  const stream = canvas.captureStream(c.fps);
  const type = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((res) => (rec.onstop = () => res()));
  rec.start();
  const totalFrames = c.seconds * c.fps;
  const frameMs = 1000 / c.fps;
  const t0 = performance.now();
  for (let i = 0; i < totalFrames; i++) {
    drawFrame(c, c.seconds - i / c.fps, w, h);
    if (i % 10 === 0) setProgress((i / totalFrames) * 95, `${T('prog.record','Đang quay')} ${i}/${totalFrames}…`);
    const target = t0 + i * frameMs;
    const wait = target - performance.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }
  rec.stop();
  await done;
  return new Blob(chunks, { type: 'video/webm' });
}

$('#render').addEventListener('click', async () => {
  showErr('');
  const c = read();
  cfg.set(c);
  const [w, h] = SIZES[c.size];
  canvas.width = w;
  canvas.height = h;
  const btn = $<HTMLButtonElement>('#render');
  btn.disabled = true;
  try {
    const codec = await supportsAvc(w, h, c.fps);
    let blob: Blob;
    let ext: string;
    if (codec) { blob = await renderMp4(c, w, h, codec); ext = 'mp4'; }
    else {
      setProgress(0, T('prog.webmFallback','Trình duyệt chưa hỗ trợ xuất MP4, đang quay dạng WebM…'));
      blob = await renderWebm(c, w, h);
      ext = 'webm';
    }
    setProgress(100, T('prog.done','Xong!'));
    downloadBlob(blob, `dem-nguoc-${c.seconds}s.${ext}`);
    toast(ext === 'mp4' ? T('toast.mp4','Đã tạo video MP4') : T('toast.webm','Đã tạo video WebM (trình duyệt này chưa xuất được MP4)'));
    setTimeout(() => ($('#progress').hidden = true), 1500);
    renderPreview();
  } catch (e) {
    showErr(`${T('err.render','Không tạo được video')}: ${(e as Error).message}. ${T('err.renderHint','Hãy thử trình duyệt Chrome/Edge bản mới, hoặc chọn kích thước nhỏ hơn.')}`);
    $('#progress').hidden = true;
  } finally {
    btn.disabled = false;
  }
});

$('#preview-btn').addEventListener('click', renderPreview);
$('#form').addEventListener('input', renderPreview);

// init
const c0 = cfg.get();
$<HTMLInputElement>('#seconds').value = String(c0.seconds);
$<HTMLSelectElement>('#format').value = c0.format;
$<HTMLSelectElement>('#fps').value = String(c0.fps);
$<HTMLInputElement>('#label').value = c0.label || T('label.default','Bắt đầu sau');
$<HTMLInputElement>('#bg').value = c0.bg;
$<HTMLInputElement>('#color').value = c0.color;
$<HTMLSelectElement>('#font').value = c0.font;
$<HTMLSelectElement>('#size').value = c0.size;
renderPreview();
