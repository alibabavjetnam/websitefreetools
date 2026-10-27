import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml } from '../ui';
import { pageText } from '../i18n';

mountLayout({ activeTool: 'webcam-test' });
const T = pageText();

$('#tool-root').innerHTML = `
  <div class="workspace">
    <section class="panel">
      <div class="media-box" id="box">
        <video id="video" playsinline muted autoplay></video>
        <p class="placeholder" id="ph">${T('ph', 'Camera đang tắt')}</p>
      </div>
      <div class="actions">
        <button type="button" class="btn btn-primary" id="toggle">${T('start', 'Bật camera')}</button>
        <button type="button" class="btn" id="snap" disabled>${T('snap', 'Chụp ảnh')}</button>
        <button type="button" class="btn" id="mirror" disabled>${T('mirror', 'Lật gương')}</button>
        <button type="button" class="btn" id="fs" disabled>${T('fullscreen', 'Toàn màn hình')}</button>
      </div>
      <p class="error" id="err" hidden></p>
    </section>
    <section class="panel">
      <label class="field"><span class="field-label">${T('camera', 'Chọn camera')}</span><select id="cam"><option value="">${T('default', 'Mặc định')}</option></select></label>
      <label class="field"><span class="field-label">${T('res', 'Độ phân giải muốn thử')}</span>
        <select id="res">
          <option value="">${T('auto', 'Tự động')}</option>
          <option value="640x480">640 × 480 (VGA)</option>
          <option value="1280x720">1280 × 720 (HD)</option>
          <option value="1920x1080">1920 × 1080 (Full HD)</option>
          <option value="3840x2160">3840 × 2160 (4K)</option>
        </select>
      </label>
      <div class="table-wrap"><table class="data-table" id="info"></table></div>
      <div class="panel-title" style="margin:0">${T('mic', 'Micro (kèm theo camera)')}</div>
      <div class="meter" aria-hidden="true"><i id="level"></i></div>
      <div class="thumbs" id="shots"></div>
      <p class="note">${T('privacy', 'Hình ảnh chỉ hiển thị trên máy bạn, không ghi lại và không gửi đi đâu. Ảnh chụp thử chỉ lưu tạm trên trang này cho tới khi bạn tải về.')}</p>
    </section>
  </div>
`;

const video = $<HTMLVideoElement>('#video');
const camSel = $<HTMLSelectElement>('#cam');
const resSel = $<HTMLSelectElement>('#res');
let stream: MediaStream | null = null;
let mirrored = true;
let fpsTimer = 0;
let audioCtx: AudioContext | null = null;
let levelRaf = 0;
const showErr = (m: string) => { const e = $('#err'); e.textContent = m; e.hidden = !m; };

function stop(): void {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  video.srcObject = null;
  clearInterval(fpsTimer);
  cancelAnimationFrame(levelRaf);
  void audioCtx?.close();
  audioCtx = null;
  $('#ph').hidden = false;
  $('#toggle').textContent = T('start', 'Bật camera');
  ['snap', 'mirror', 'fs'].forEach((id) => ($<HTMLButtonElement>('#' + id).disabled = true));
  $('#info').innerHTML = '';
  $<HTMLElement>('#level').style.width = '0';
}

async function start(): Promise<void> {
  showErr('');
  if (!navigator.mediaDevices?.getUserMedia) { showErr(T('noApi', 'Trình duyệt không hỗ trợ camera, hoặc trang không chạy qua https. Hãy dùng Chrome, Edge, Firefox, Safari bản mới.')); return; }
  stop();
  const [w, h] = resSel.value ? resSel.value.split('x').map(Number) : [0, 0];
  const vc: MediaTrackConstraints = { ...(camSel.value ? { deviceId: { exact: camSel.value } } : {}), ...(w ? { width: { ideal: w }, height: { ideal: h } } : {}) };
  try {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: vc, audio: true });
    } catch (e) {
      // Không có micro hoặc micro bị chặn: thử lại chỉ với camera
      if ((e as DOMException).name === 'NotAllowedError') throw e;
      stream = await navigator.mediaDevices.getUserMedia({ video: vc });
    }
  } catch (e) {
    const n = (e as DOMException).name;
    showErr(n === 'NotAllowedError' ? T('errDenied', 'Bạn đã chặn quyền dùng camera. Bấm biểu tượng ổ khoá cạnh địa chỉ trang, cho phép Camera rồi bấm Bật camera lại.')
      : n === 'NotFoundError' || n === 'OverconstrainedError' ? T('errNotFound', 'Không tìm thấy camera phù hợp. Kiểm tra camera đã cắm, chưa bị tắt bằng phím tắt, hoặc chọn độ phân giải Tự động.')
      : n === 'NotReadableError' ? T('errBusy', 'Camera đang được ứng dụng khác dùng (Zoom, Teams, Zalo…). Hãy đóng ứng dụng đó rồi thử lại.')
      : T('errOther', 'Không bật được camera. Hãy thử lại hoặc khởi động lại trình duyệt.'));
    return;
  }
  video.srcObject = stream;
  video.style.transform = mirrored ? 'scaleX(-1)' : '';
  await video.play().catch(() => undefined);
  $('#ph').hidden = true;
  $('#toggle').textContent = T('stop', 'Tắt camera');
  ['snap', 'mirror', 'fs'].forEach((id) => ($<HTMLButtonElement>('#' + id).disabled = false));
  await listCams();
  showInfo();
  measureFps();
  meter();
}

async function listCams(): Promise<void> {
  const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
  const cur = stream?.getVideoTracks()[0]?.getSettings().deviceId;
  camSel.innerHTML = devs.map((d, i) => `<option value="${escapeHtml(d.deviceId)}">${escapeHtml(d.label || `${T('camN', 'Camera')} ${i + 1}`)}</option>`).join('') || `<option value="">${T('default', 'Mặc định')}</option>`;
  if (cur) camSel.value = cur;
}

let fps = 0;
let gen = 0;
function showInfo(): void {
  const track = stream?.getVideoTracks()[0];
  if (!track) return;
  const set = track.getSettings();
  const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities;
  const row = (k: string, v: string) => `<tr><td>${k}</td><td>${escapeHtml(v)}</td></tr>`;
  const aTrack = stream?.getAudioTracks()[0];
  $('#info').innerHTML = `<tbody>
    ${row(T('status', 'Trạng thái'), T('working', '✅ Camera hoạt động'))}
    ${row(T('name', 'Tên camera'), track.label || '—')}
    ${row(T('resolution', 'Độ phân giải'), `${video.videoWidth || set.width} × ${video.videoHeight || set.height}`)}
    ${row(T('fps', 'Khung hình/giây (đo thực)'), fps ? `${fps.toFixed(0)} fps` : '…')}
    ${row(T('fpsSet', 'Khung hình/giây (khai báo)'), set.frameRate ? `${Math.round(set.frameRate)} fps` : '—')}
    ${row(T('maxRes', 'Độ phân giải tối đa hỗ trợ'), caps.width?.max ? `${caps.width.max} × ${caps.height?.max}` : '—')}
    ${row(T('aspect', 'Tỉ lệ khung'), set.aspectRatio ? set.aspectRatio.toFixed(2) : '—')}
    ${row(T('facing', 'Hướng camera'), set.facingMode || '—')}
    ${row(T('micName', 'Micro'), aTrack?.label || T('noMic', 'Không dùng'))}
  </tbody>`;
}

function measureFps(): void {
  const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
  const hasRvfc = typeof (video as { requestVideoFrameCallback?: unknown }).requestVideoFrameCallback === 'function';
  let frames = 0;
  let last = performance.now();
  const g = ++gen;
  if (hasRvfc) {
    const cb = () => { frames++; if (stream && g === gen) v.requestVideoFrameCallback!(cb); };
    v.requestVideoFrameCallback(cb);
  }
  fpsTimer = window.setInterval(() => {
    const now = performance.now();
    if (hasRvfc) fps = (frames * 1000) / (now - last);
    else fps = stream?.getVideoTracks()[0]?.getSettings().frameRate ?? 0;
    frames = 0;
    last = now;
    showInfo();
  }, 1000);
}

function meter(): void {
  const a = stream?.getAudioTracks()[0];
  if (!a || !stream) return;
  try {
    audioCtx = new AudioContext();
    const src = audioCtx.createMediaStreamSource(new MediaStream([a]));
    const an = audioCtx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    const tick = () => {
      an.getByteTimeDomainData(buf);
      let peak = 0;
      for (const x of buf) peak = Math.max(peak, Math.abs(x - 128));
      $<HTMLElement>('#level').style.width = `${Math.min(100, (peak / 128) * 160)}%`;
      levelRaf = requestAnimationFrame(tick);
    };
    tick();
  } catch { /* bỏ qua */ }
}

$('#toggle').addEventListener('click', () => (stream ? stop() : void start()));
camSel.addEventListener('change', () => { if (stream) void start(); });
resSel.addEventListener('change', () => { if (stream) void start(); });
$('#mirror').addEventListener('click', () => { mirrored = !mirrored; video.style.transform = mirrored ? 'scaleX(-1)' : ''; });
$('#fs').addEventListener('click', () => { void $('#box').requestFullscreen?.().catch(() => undefined); });
$('#snap').addEventListener('click', () => {
  const c = document.createElement('canvas');
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  if (mirrored) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, 0, 0);
  c.toBlob((b) => {
    if (!b) return;
    const url = URL.createObjectURL(b);
    const fig = document.createElement('div');
    fig.className = 'thumb';
    fig.innerHTML = `<img src="${url}" alt="" /><button type="button" class="btn btn-sm">${T('download', 'Tải ảnh')}</button>`;
    fig.querySelector('button')!.addEventListener('click', () => downloadBlob(b, `webcam-${Date.now()}.jpg`));
    $('#shots').prepend(fig);
  }, 'image/jpeg', 0.92);
});
window.addEventListener('beforeunload', stop);
