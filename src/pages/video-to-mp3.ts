import { mountLayout } from '../layout';
import { $, downloadBlob, storage } from '../ui';
import { pageText } from '../i18n';
import { FFmpeg, probeVideo, fmtTime, parseTime } from '../lib/ffmpeg';
import { bindDropzone, baseName, fmtSize } from '../lib/files';

mountLayout({ activeTool: 'video-to-mp3' });
const T = pageText();

const MAX_BYTES = 1024 * 1024 * 1024;
const st = storage<{ fmt: string; bitrate: string; fade: boolean }>('video-to-mp3', { fmt: 'mp3', bitrate: '192', fade: false });
const s = st.get();

$('#tool-root').innerHTML = `
  <div class="workspace">
    <div class="panel">
      <label class="dropzone" id="drop">
        <input type="file" id="file" accept="video/*,audio/*,.mkv,.mov,.avi,.webm,.m4v,.3gp,.flv" />
        <b>${T('dropTitle', 'Chọn video hoặc kéo thả vào đây')}</b>
        <span>${T('dropHint', 'MP4, MOV, WebM, MKV, AVI, FLV… Tối đa 1 GB.')}</span>
      </label>
      <p class="note" id="info"></p>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('format', 'Định dạng')}</span>
          <select id="fmt"><option value="mp3">MP3</option><option value="m4a">M4A (AAC)</option><option value="wav">WAV</option><option value="ogg">OGG</option></select>
        </label>
        <label class="field" id="br-row"><span class="field-label">${T('bitrate', 'Chất lượng')}</span>
          <select id="bitrate"><option value="320">320 kbps (${T('best', 'cao nhất')})</option><option value="256">256 kbps</option><option value="192">192 kbps (${T('good', 'khuyên dùng')})</option><option value="128">128 kbps</option><option value="96">96 kbps (${T('voice', 'giọng nói')})</option></select>
        </label>
      </div>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('start', 'Bắt đầu')}</span><input type="text" id="start" class="input-inline" placeholder="0:00" /></label>
        <button type="button" class="btn btn-sm" id="set-start" style="align-self:flex-end">${T('fromPlayer', 'Lấy từ video')}</button>
        <label class="field"><span class="field-label">${T('end', 'Kết thúc')}</span><input type="text" id="end" class="input-inline" placeholder="${T('toEnd', 'hết video')}" /></label>
        <button type="button" class="btn btn-sm" id="set-end" style="align-self:flex-end">${T('fromPlayer', 'Lấy từ video')}</button>
      </div>
      <label class="check"><input type="checkbox" id="fade" /><span>${T('fade', 'Nhỏ dần ở đầu và cuối (2 giây), hợp làm nhạc chuông')}</span></label>
      <div class="actions"><button type="button" class="btn btn-primary" id="run" disabled>${T('run', 'Tách âm thanh')}</button></div>
      <div class="progress" id="prog" hidden><i></i></div>
      <p class="note" id="status"></p>
      <p class="error" id="err" hidden></p>
      <p class="note">${T('note', 'Xử lý ngay trên trình duyệt bằng ffmpeg, video không tải lên máy chủ. Lần đầu cần tải bộ xử lý khoảng 31 MB. Chỉ tách âm thanh từ video bạn có quyền sử dụng.')}</p>
    </div>
    <section class="panel">
      <div class="media-box"><video id="preview" controls playsinline></video></div>
      <audio id="result" controls style="width:100%" hidden></audio>
      <div class="actions" id="dl-box" hidden><button type="button" class="btn btn-primary" id="dl">${T('download', 'Tải file âm thanh')}</button><span class="note" id="out-info"></span></div>
    </section>
  </div>
`;

let file: File | null = null;
let duration = 0;
let out: Blob | null = null;
let ff: FFmpeg | null = null;
const showErr = (m: string) => { const e = $('#err'); e.textContent = m; e.hidden = !m; };
const $i = (id: string) => $<HTMLInputElement>('#' + id);
$<HTMLSelectElement>('#fmt').value = s.fmt;
$<HTMLSelectElement>('#bitrate').value = s.bitrate;
$i('fade').checked = s.fade;
function read(): void {
  s.fmt = $<HTMLSelectElement>('#fmt').value;
  s.bitrate = $<HTMLSelectElement>('#bitrate').value;
  s.fade = $i('fade').checked;
  st.set(s);
  $('#br-row').hidden = s.fmt === 'wav';
}
document.querySelectorAll('#fmt,#bitrate,#fade').forEach((el) => el.addEventListener('change', read));

async function pick(f: File): Promise<void> {
  showErr('');
  if (f.size > MAX_BYTES) { showErr(T('tooBig', 'File lớn hơn 1 GB, trình duyệt không đủ bộ nhớ để xử lý.')); return; }
  file = f;
  out = null;
  $('#dl-box').hidden = true;
  $('#result').hidden = true;
  $i('start').value = '';
  $i('end').value = '';
  try {
    const m = await probeVideo(f);
    duration = m.duration;
    $<HTMLVideoElement>('#preview').src = m.url;
  } catch { duration = 0; }
  $('#info').textContent = `${f.name} · ${fmtSize(f.size)}${duration ? ` · ${fmtTime(duration)}` : ''}`;
  $<HTMLButtonElement>('#run').disabled = false;
}
$('#set-start').addEventListener('click', () => { $i('start').value = fmtTime($<HTMLVideoElement>('#preview').currentTime); });
$('#set-end').addEventListener('click', () => { $i('end').value = fmtTime($<HTMLVideoElement>('#preview').currentTime); });

const CODEC: Record<string, { args: (br: string) => string[]; mime: string }> = {
  mp3: { args: (br) => ['-c:a', 'libmp3lame', '-b:a', `${br}k`], mime: 'audio/mpeg' },
  m4a: { args: (br) => ['-c:a', 'aac', '-b:a', `${br}k`], mime: 'audio/mp4' },
  wav: { args: () => ['-c:a', 'pcm_s16le'], mime: 'audio/wav' },
  ogg: { args: (br) => ['-c:a', 'libvorbis', '-b:a', `${br}k`], mime: 'audio/ogg' },
};

$('#run').addEventListener('click', async () => {
  if (!file) return;
  read();
  showErr('');
  const start = $i('start').value.trim() ? parseTime($i('start').value) : 0;
  const end = $i('end').value.trim() ? parseTime($i('end').value) : duration || 0;
  if (!Number.isFinite(start) || !Number.isFinite(end) || (end && end <= start)) { showErr(T('badTime', 'Thời điểm không hợp lệ. Nhập dạng phút:giây, ví dụ 1:30; điểm kết thúc phải sau điểm bắt đầu.')); return; }
  const btn = $<HTMLButtonElement>('#run');
  btn.disabled = true;
  const prog = $('#prog');
  prog.hidden = false;
  const bar = prog.querySelector('i') as HTMLElement;
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
      $('#status').textContent = `${T('working', 'Đang tách âm thanh')} ${Math.round(r * 100)}%`;
    };
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
    const input = `in.${ext}`;
    await ff.writeFile(input, new Uint8Array(await file.arrayBuffer()));
    const trim = [...(start > 0 ? ['-ss', String(start)] : []), ...(end && end < (duration || Infinity) ? ['-to', String(end)] : [])];
    const fade = s.fade && len > 5 ? ['-af', `afade=t=in:st=0:d=2,afade=t=out:st=${Math.max(0, len - 2).toFixed(2)}:d=2`] : [];
    const outName = `out.${s.fmt}`;
    // -ss/-to đặt sau -i để cắt chính xác; -vn bỏ hình
    const code = await ff.exec(['-i', input, ...trim, '-vn', '-map', '0:a:0?', ...fade, ...CODEC[s.fmt].args(s.bitrate), outName]);
    const data = await ff.readFile(outName).catch(() => new Uint8Array());
    await ff.deleteFile(input);
    await ff.deleteFile(outName);
    if (code !== 0 || data.length < 200) throw new Error(T('noAudio', 'Không tách được âm thanh. Video có thể không có tiếng hoặc định dạng chưa hỗ trợ.'));
    out = new Blob([data as BlobPart], { type: CODEC[s.fmt].mime });
    const a = $<HTMLAudioElement>('#result');
    a.src = URL.createObjectURL(out);
    a.hidden = false;
    $('#dl-box').hidden = false;
    $('#out-info').textContent = `${fmtSize(out.size)} · ${fmtTime(len)}`;
    $('#status').textContent = T('done', 'Xong!');
    bar.style.width = '100%';
  } catch (e) {
    $('#status').textContent = '';
    showErr((e as Error).message);
    ff?.terminate();
    ff = null;
  } finally {
    btn.disabled = false;
    setTimeout(() => (prog.hidden = true), 600);
  }
});
$('#dl').addEventListener('click', () => { if (out && file) downloadBlob(out, `${baseName(file.name)}.${s.fmt}`); });
bindDropzone($('#drop'), $i('file'), (f) => void pick(f[0]));
read();
