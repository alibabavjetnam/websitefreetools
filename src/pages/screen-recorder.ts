import { mountLayout } from '../layout';
import { $, downloadBlob, storage } from '../ui';
import { pageText } from '../i18n';
import { fmtSize } from '../lib/files';

mountLayout({ activeTool: 'screen-recorder' });
const T = pageText();

const st = storage<{ mic: boolean; sysAudio: boolean; quality: string; countdown: boolean }>('screen-recorder', { mic: true, sysAudio: true, quality: 'high', countdown: true });
const s = st.get();

$('#tool-root').innerHTML = `
  <div class="workspace">
    <section class="panel">
      <div class="media-box">
        <video id="preview" playsinline muted></video>
        <p class="placeholder" id="ph">${T('ph', 'Chưa quay. Bấm Bắt đầu quay và chọn màn hình, cửa sổ hoặc tab.')}</p>
      </div>
      <div class="actions">
        <button type="button" class="btn btn-primary" id="start">${T('start', 'Bắt đầu quay')}</button>
        <button type="button" class="btn" id="pause" disabled>${T('pause', 'Tạm dừng')}</button>
        <button type="button" class="btn" id="stop" disabled>${T('stop', 'Dừng và lưu')}</button>
        <span class="note" id="status" aria-live="polite"></span>
      </div>
      <p class="error" id="err" hidden></p>
    </section>
    <section class="panel">
      <label class="check"><input type="checkbox" id="sys" /><span>${T('sysAudio', 'Ghi âm thanh của máy / tab (chọn "Chia sẻ âm thanh" khi trình duyệt hỏi)')}</span></label>
      <label class="check"><input type="checkbox" id="mic" /><span>${T('mic', 'Ghi giọng nói qua micro')}</span></label>
      <label class="check"><input type="checkbox" id="cd" /><span>${T('countdown', 'Đếm ngược 3 giây trước khi quay')}</span></label>
      <label class="field"><span class="field-label">${T('quality', 'Chất lượng')}</span>
        <select id="quality">
          <option value="high">${T('qHigh', 'Cao (8 Mbps, file lớn)')}</option>
          <option value="medium">${T('qMed', 'Vừa (4 Mbps)')}</option>
          <option value="low">${T('qLow', 'Nhẹ (1,5 Mbps, gửi qua chat)')}</option>
        </select>
      </label>
      <div id="results" class="fields"></div>
      <p class="note">${T('note', 'Quay màn hình chạy được trên Chrome, Edge, Firefox và Safari trên máy tính; điện thoại chưa hỗ trợ. Video lưu thẳng trên máy bạn, không tải lên đâu. Định dạng MP4 nếu trình duyệt hỗ trợ, nếu không sẽ là WebM (mở được bằng Chrome, VLC); cần MP4 có thể đổi bằng công cụ Nén video.')}</p>
    </section>
  </div>
`;

const preview = $<HTMLVideoElement>('#preview');
const $c = (id: string) => $<HTMLInputElement>('#' + id);
$c('sys').checked = s.sysAudio;
$c('mic').checked = s.mic;
$c('cd').checked = s.countdown;
$<HTMLSelectElement>('#quality').value = s.quality;
const save = () => st.set({ sysAudio: $c('sys').checked, mic: $c('mic').checked, countdown: $c('cd').checked, quality: $<HTMLSelectElement>('#quality').value });
document.querySelectorAll('#sys,#mic,#cd,#quality').forEach((el) => el.addEventListener('change', save));
const showErr = (m: string) => { const e = $('#err'); e.textContent = m; e.hidden = !m; };

let rec: MediaRecorder | null = null;
let streams: MediaStream[] = [];
let chunks: Blob[] = [];
let t0 = 0;
let pausedAt = 0;
let pausedTotal = 0;
let tick = 0;
let audioCtx: AudioContext | null = null;

/** Chọn định dạng tốt nhất trình duyệt ghi được: ưu tiên MP4 (H.264) cho dễ mở */
function pickMime(): string {
  const list = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return list.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) || '';
}
const fmtTime = (ms: number) => {
  const sec = Math.floor(ms / 1000);
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
};

async function start(): Promise<void> {
  showErr('');
  if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === 'undefined') {
    showErr(T('noSupport', 'Trình duyệt này không hỗ trợ quay màn hình. Hãy dùng Chrome, Edge, Firefox hoặc Safari trên máy tính.'));
    return;
  }
  let display: MediaStream;
  try {
    display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: $c('sys').checked });
  } catch (e) {
    if ((e as DOMException).name !== 'NotAllowedError' && (e as DOMException).name !== 'AbortError') showErr(T('errStart', 'Không bắt đầu quay được. Hãy thử lại.'));
    return;
  }
  streams = [display];
  const tracks: MediaStreamTrack[] = [...display.getVideoTracks()];
  const audioTracks: MediaStreamTrack[] = [...display.getAudioTracks()];
  if ($c('mic').checked) {
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streams.push(mic);
      audioTracks.push(...mic.getAudioTracks());
    } catch {
      showErr(T('errMic', 'Không dùng được micro (bị chặn hoặc không có). Vẫn tiếp tục quay không có giọng nói.'));
    }
  }
  // Trộn âm thanh máy + micro thành một rãnh
  if (audioTracks.length > 1) {
    audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();
    for (const t of audioTracks) audioCtx.createMediaStreamSource(new MediaStream([t])).connect(dest);
    tracks.push(...dest.stream.getAudioTracks());
  } else tracks.push(...audioTracks);

  const out = new MediaStream(tracks);
  preview.srcObject = display;
  void preview.play().catch(() => undefined);
  $('#ph').hidden = true;

  if ($c('cd').checked) {
    for (let i = 3; i > 0; i--) { $('#status').textContent = `${T('startsIn', 'Bắt đầu sau')} ${i}…`; await new Promise((r) => setTimeout(r, 1000)); }
  }
  const mime = pickMime();
  const bits = { high: 8_000_000, medium: 4_000_000, low: 1_500_000 }[$<HTMLSelectElement>('#quality').value] ?? 4_000_000;
  chunks = [];
  try {
    rec = new MediaRecorder(out, { mimeType: mime || undefined, videoBitsPerSecond: bits, audioBitsPerSecond: 128000 });
  } catch {
    rec = new MediaRecorder(out);
  }
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = finish;
  rec.start(1000);
  t0 = Date.now();
  pausedTotal = 0;
  setRunning(true);
  // Người dùng bấm "Dừng chia sẻ" của trình duyệt
  display.getVideoTracks()[0].addEventListener('ended', () => { if (rec && rec.state !== 'inactive') rec.stop(); });
  tick = window.setInterval(() => {
    if (!rec) return;
    const el = (rec.state === 'paused' ? pausedAt : Date.now()) - t0 - pausedTotal;
    const size = chunks.reduce((a, b) => a + b.size, 0);
    $('#status').innerHTML = `${rec.state === 'paused' ? '⏸' : '<span class="rec-dot" aria-hidden="true"></span>'}${fmtTime(el)} · ${fmtSize(size)}`;
  }, 500);
}

function setRunning(on: boolean): void {
  $<HTMLButtonElement>('#start').disabled = on;
  $<HTMLButtonElement>('#pause').disabled = !on;
  $<HTMLButtonElement>('#stop').disabled = !on;
  document.querySelectorAll<HTMLInputElement>('#sys,#mic,#cd,#quality').forEach((el) => (el.disabled = on));
  if (!on) $('#pause').textContent = T('pause', 'Tạm dừng');
}

function finish(): void {
  clearInterval(tick);
  streams.forEach((st) => st.getTracks().forEach((t) => t.stop()));
  void audioCtx?.close();
  audioCtx = null;
  preview.srcObject = null;
  setRunning(false);
  const type = rec?.mimeType || 'video/webm';
  const ext = type.includes('mp4') ? 'mp4' : 'webm';
  const blob = new Blob(chunks, { type: type.split(';')[0] });
  const dur = Date.now() - t0 - pausedTotal;
  rec = null;
  $('#status').textContent = '';
  if (!blob.size) { showErr(T('errEmpty', 'Không ghi được dữ liệu nào. Hãy thử lại.')); $('#ph').hidden = false; return; }
  const url = URL.createObjectURL(blob);
  const name = `${T('fileName', 'quay-man-hinh')}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`;
  const card = document.createElement('div');
  card.className = 'panel';
  card.style.padding = '12px';
  card.innerHTML = `<video src="${url}" controls playsinline style="width:100%;border-radius:6px;background:#000"></video>
    <div class="row" style="justify-content:space-between"><span class="note">${fmtTime(dur)} · ${fmtSize(blob.size)} · ${ext.toUpperCase()}</span>
    <button type="button" class="btn btn-primary btn-sm">${T('download', 'Tải video')}</button></div>`;
  card.querySelector('button')!.addEventListener('click', () => downloadBlob(blob, name));
  $('#results').prepend(card);
  $('#ph').hidden = false;
}

$('#start').addEventListener('click', () => void start());
$('#stop').addEventListener('click', () => { if (rec && rec.state !== 'inactive') rec.stop(); });
$('#pause').addEventListener('click', () => {
  if (!rec) return;
  if (rec.state === 'recording') { rec.pause(); pausedAt = Date.now(); $('#pause').textContent = T('resume', 'Quay tiếp'); }
  else if (rec.state === 'paused') { rec.resume(); pausedTotal += Date.now() - pausedAt; $('#pause').textContent = T('pause', 'Tạm dừng'); }
});
window.addEventListener('beforeunload', (e) => { if (rec) e.preventDefault(); });
