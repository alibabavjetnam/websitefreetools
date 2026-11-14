import { mountLayout } from '../layout';
import { $, downloadBlob, setupTabs, storage } from '../ui';
import { pageText } from '../i18n';
import { FFmpeg, probeVideo, fmtTime, parseTime } from '../lib/ffmpeg';
import { bindDropzone, baseName, fmtSize } from '../lib/files';
import { AUDIO_FORMATS, VIDEO_FORMATS, buildJob, needsVideo, safeExt, type MediaOp, type Quality, type TargetFormat } from '../calc/mediacmd';

mountLayout({ activeTool: 'media-trim-convert' });
const T = pageText();
const root = $('#tool-root');
const MAX_BYTES = 1024 * 1024 * 1024;
const AUDIO_EXT = ['mp3', 'm4a', 'wav', 'ogg', 'aac', 'flac', 'opus', 'wma', 'amr'];

const st = storage<{ format: TargetFormat; quality: Quality; fast: boolean; fps: number; width: number }>('media-trim-convert', { format: 'mp4', quality: 'medium', fast: true, fps: 10, width: 480 });
const s = st.get();

const fmtOpts = (list: readonly string[]) => list.map((f) => `<option value="${f}">${f.toUpperCase()}</option>`).join('');
root.innerHTML = `
  <div class="workspace">
    <div class="panel">
      <label class="dropzone" id="drop">
        <input type="file" id="file" accept="video/*,audio/*,.mkv,.mov,.avi,.webm,.m4v,.3gp,.flv,.flac,.opus,.aac,.wma" />
        <b>${T('dropTitle', 'Chọn file âm thanh hoặc video, hoặc kéo thả vào đây')}</b>
        <span>${T('dropHint', 'MP4, MOV, WebM, MKV, MP3, WAV, M4A, OGG… Tối đa 1 GB.')}</span>
      </label>
      <p class="note" id="info"></p>
      <div class="tabs" role="tablist" aria-label="${T('aria.tabs', 'Chọn công cụ')}">
        <button type="button" role="tab" data-tab="cut">${T('tab.cut', 'Cắt đoạn')}</button>
        <button type="button" role="tab" data-tab="convert">${T('tab.convert', 'Đổi định dạng')}</button>
        <button type="button" role="tab" data-tab="gif">${T('tab.gif', 'Video sang GIF')}</button>
      </div>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('start', 'Bắt đầu')}</span><input type="text" id="start" class="input-inline" placeholder="0:00" /></label>
        <button type="button" class="btn btn-sm" id="set-start" style="align-self:flex-end">${T('fromPlayer', 'Lấy từ trình phát')}</button>
        <label class="field"><span class="field-label">${T('end', 'Kết thúc')}</span><input type="text" id="end" class="input-inline" placeholder="${T('toEnd', 'hết file')}" /></label>
        <button type="button" class="btn btn-sm" id="set-end" style="align-self:flex-end">${T('fromPlayer', 'Lấy từ trình phát')}</button>
      </div>
      <div data-panel="cut">
        <label class="check"><input type="checkbox" id="fast" /><span>${T('fast', 'Cắt nhanh, giữ nguyên chất lượng (điểm cắt có thể lệch vài giây)')}</span></label>
      </div>
      <div data-panel="convert">
        <label class="field"><span class="field-label">${T('format', 'Định dạng đích')}</span>
          <select id="format"><optgroup label="${T('videoGroup', 'Video')}">${fmtOpts(VIDEO_FORMATS)}</optgroup><optgroup label="${T('audioGroup', 'Âm thanh')}">${fmtOpts(AUDIO_FORMATS)}</optgroup></select></label>
      </div>
      <div data-panel="gif">
        <div class="form-grid">
          <label class="field"><span class="field-label">${T('fps', 'Khung hình mỗi giây')}</span><select id="fps">${[5, 8, 10, 12, 15, 20].map((n) => `<option value="${n}">${n}</option>`).join('')}</select></label>
          <label class="field"><span class="field-label">${T('width', 'Chiều rộng (px)')}</span><select id="width">${[240, 320, 480, 640, 800].map((n) => `<option value="${n}">${n}</option>`).join('')}</select></label>
        </div>
      </div>
      <label class="field" id="q-row"><span class="field-label">${T('quality', 'Chất lượng')}</span>
        <select id="quality"><option value="high">${T('qHigh', 'Cao (file lớn)')}</option><option value="medium">${T('qMed', 'Vừa (khuyên dùng)')}</option><option value="low">${T('qLow', 'Thấp (file nhỏ)')}</option></select></label>
      <div class="actions"><button type="button" class="btn btn-primary" id="run" disabled>${T('run', 'Bắt đầu xử lý')}</button></div>
      <div class="progress" id="prog" hidden><i></i></div>
      <p class="note" id="status"></p>
      <p class="error" id="err" hidden></p>
      <p class="note">${T('note', 'Xử lý ngay trên trình duyệt bằng ffmpeg, file không tải lên máy chủ. Lần đầu cần tải bộ xử lý khoảng 31 MB. Chỉ xử lý file bạn có quyền sử dụng.')}</p>
    </div>
    <section class="panel">
      <div class="media-box"><video id="preview" controls playsinline></video></div>
      <div id="result-box" hidden>
        <h3>${T('result', 'Kết quả')}</h3>
        <div class="media-box"><video id="r-video" controls playsinline hidden></video></div>
        <audio id="r-audio" controls style="width:100%" hidden></audio>
        <img id="r-img" alt="GIF" style="max-width:100%" hidden />
        <div class="actions"><button type="button" class="btn btn-primary" id="dl">${T('download', 'Tải file kết quả')}</button><span class="note" id="out-info"></span></div>
      </div>
    </section>
  </div>
`;

const $i = (id: string) => $<HTMLInputElement>('#' + id);
const $s = (id: string) => $<HTMLSelectElement>('#' + id);
let tab: MediaOp = 'cut';
let file: File | null = null;
let duration = 0;
let hasVideo = true;
let out: { blob: Blob; name: string } | null = null;
let ff: FFmpeg | null = null;
let outUrl = '';
let inUrl = '';
const showErr = (m: string) => { const e = $('#err'); e.textContent = m; e.hidden = !m; };

$s('format').value = s.format;
$s('quality').value = s.quality;
$i('fast').checked = s.fast;
$s('fps').value = String(s.fps);
$s('width').value = String(s.width);
function readOpts(): void {
  s.format = $s('format').value as TargetFormat;
  s.quality = $s('quality').value as Quality;
  s.fast = $i('fast').checked;
  s.fps = Number($s('fps').value);
  s.width = Number($s('width').value);
  st.set(s);
  updateUi();
}
function updateUi(): void {
  $('#q-row').hidden = tab === 'gif' || (tab === 'cut' && s.fast) || (tab === 'convert' && s.format === 'wav');
  const gifBlocked = !hasVideo;
  $<HTMLButtonElement>('#run').disabled = !file || (tab === 'gif' && gifBlocked) || (tab === 'convert' && needsVideo(s.format) && !hasVideo);
  if (file && tab === 'gif' && gifBlocked) showErr(T('needVideo', 'Cần chọn file video cho thao tác này.'));
  else if (file && tab === 'convert' && needsVideo(s.format) && !hasVideo) showErr(T('needVideo', 'Cần chọn file video cho thao tác này.'));
  else showErr('');
}
document.querySelectorAll('#format,#quality,#fast,#fps,#width').forEach((el) => el.addEventListener('change', readOpts));

async function pick(f: File): Promise<void> {
  showErr('');
  if (f.size > MAX_BYTES) { showErr(T('tooBig', 'File lớn hơn 1 GB, trình duyệt không đủ bộ nhớ để xử lý.')); return; }
  file = f;
  out = null;
  $('#result-box').hidden = true;
  $i('start').value = '';
  $i('end').value = '';
  hasVideo = !(f.type.startsWith('audio/') || AUDIO_EXT.includes(safeExt(f.name)));
  const pv = $<HTMLVideoElement>('#preview');
  if (inUrl) URL.revokeObjectURL(inUrl);
  inUrl = URL.createObjectURL(f);
  pv.src = inUrl;
  duration = 0;
  try {
    const m = hasVideo ? await probeVideo(f) : null;
    if (m) { duration = m.duration; URL.revokeObjectURL(m.url); }
  } catch { /* không đọc được thông tin, vẫn cho xử lý */ }
  if (!duration) {
    duration = await new Promise<number>((res) => {
      const read = () => (Number.isFinite(pv.duration) ? pv.duration : 0);
      if (pv.readyState >= 1) { res(read()); return; }
      const timer = setTimeout(() => res(0), 4000);
      pv.onloadedmetadata = () => { clearTimeout(timer); res(read()); };
      pv.onerror = () => { clearTimeout(timer); res(0); };
    });
  }
  $('#info').textContent = `${f.name} · ${fmtSize(f.size)}${duration ? ` · ${fmtTime(duration)}` : ''}`;
  updateUi();
}
$('#set-start').addEventListener('click', () => { $i('start').value = fmtTime($<HTMLVideoElement>('#preview').currentTime); });
$('#set-end').addEventListener('click', () => { $i('end').value = fmtTime($<HTMLVideoElement>('#preview').currentTime); });

$('#run').addEventListener('click', async () => {
  if (!file) return;
  readOpts();
  showErr('');
  const start = $i('start').value.trim() ? parseTime($i('start').value) : 0;
  const end = $i('end').value.trim() ? parseTime($i('end').value) : 0;
  if (!Number.isFinite(start) || !Number.isFinite(end) || (end && end <= start)) { showErr(T('badTime', 'Thời điểm không hợp lệ. Nhập dạng phút:giây, ví dụ 1:30; điểm kết thúc phải sau điểm bắt đầu.')); return; }
  if (tab === 'gif' && ((end || duration) - start > 60)) { showErr(T('gifLong', 'Ảnh GIF nên ngắn dưới 60 giây. Hãy chọn đoạn ngắn hơn.')); return; }
  const btn = $<HTMLButtonElement>('#run');
  btn.disabled = true;
  const prog = $('#prog');
  prog.hidden = false;
  const bar = prog.querySelector('i') as HTMLElement;
  const input = `in.${safeExt(file.name)}`;
  let written = false;
  try {
    ff ??= new FFmpeg();
    $('#status').textContent = T('loading', 'Đang tải bộ xử lý…');
    await ff.load((l, total) => {
      bar.style.width = `${total ? (l / total) * 100 : 0}%`;
      $('#status').textContent = `${T('loading', 'Đang tải bộ xử lý…')} ${fmtSize(l)}${total ? ` / ${fmtSize(total)}` : ''}`;
    });
    const len = (end || duration) - start;
    ff.onProgress = (_p, timeUs) => {
      const r = len > 0 ? Math.min(1, timeUs / 1e6 / len) : 0;
      bar.style.width = `${r * 100}%`;
      $('#status').textContent = `${T('working', 'Đang xử lý')} ${Math.round(r * 100)}%`;
    };
    await ff.writeFile(input, new Uint8Array(await file.arrayBuffer()));
    written = true;
    const job = buildJob({ inputName: input, op: tab, start, end, fastCut: s.fast, format: s.format, quality: s.quality, fps: s.fps, width: s.width, hasVideo });
    const code = await ff.exec(job.args);
    const data = await ff.readFile(job.outName).catch(() => new Uint8Array());
    await ff.deleteFile(job.outName).catch(() => undefined);
    if (code !== 0 || data.length < 100) throw new Error(T('failed', 'Không xử lý được file này. File có thể bị lỗi hoặc định dạng chưa được hỗ trợ.'));
    const blob = new Blob([data as BlobPart], { type: job.mime });
    out = { blob, name: `${baseName(file.name)}${tab === 'cut' ? '-cut' : ''}.${job.ext}` };
    if (outUrl) URL.revokeObjectURL(outUrl);
    outUrl = URL.createObjectURL(blob);
    const isImg = job.ext === 'gif';
    const isAudio = !isImg && job.mime.startsWith('audio/');
    const rv = $<HTMLVideoElement>('#r-video');
    const ra = $<HTMLAudioElement>('#r-audio');
    const ri = $<HTMLImageElement>('#r-img');
    rv.hidden = isImg || isAudio;
    ra.hidden = !isAudio;
    ri.hidden = !isImg;
    if (isImg) ri.src = outUrl; else if (isAudio) ra.src = outUrl; else rv.src = outUrl;
    $('#result-box').hidden = false;
    $('#out-info').textContent = `${fmtSize(blob.size)}${len > 0 ? ` · ${fmtTime(len)}` : ''}`;
    $('#status').textContent = T('done', 'Xong!');
    bar.style.width = '100%';
  } catch (e) {
    $('#status').textContent = '';
    showErr((e as Error).message);
    ff?.terminate();
    ff = null;
  } finally {
    if (written && ff) await ff.deleteFile(input).catch(() => undefined);
    btn.disabled = false;
    updateUi();
    setTimeout(() => (prog.hidden = true), 600);
  }
});
$('#dl').addEventListener('click', () => { if (out) downloadBlob(out.blob, out.name); });
bindDropzone($('#drop'), $i('file'), (f) => void pick(f[0]));

setupTabs($('.panel') as HTMLElement, (t) => { tab = t as MediaOp; if (document.getElementById('q-row')) updateUi(); });
updateUi();
