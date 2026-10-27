import { mountLayout } from '../layout';
import { $, downloadBlob, fmtInt, storage } from '../ui';
import { pageText } from '../i18n';
import { FFmpeg, probeVideo, fmtTime } from '../lib/ffmpeg';
import { bindDropzone, baseName, fmtSize } from '../lib/files';

mountLayout({ activeTool: 'video-compress' });
const T = pageText();

type Level = 'light' | 'medium' | 'strong';
const CRF: Record<Level, number> = { light: 24, medium: 28, strong: 32 };
const MAX_BYTES = 500 * 1024 * 1024;
const st = storage<{ level: Level; res: string; audio: string; mute: boolean }>('video-compress', { level: 'medium', res: '720', audio: '96', mute: false });
const s = st.get();

$('#tool-root').innerHTML = `
  <div class="workspace">
    <div class="panel">
      <label class="dropzone" id="drop">
        <input type="file" id="file" accept="video/*,.mkv,.mov,.avi,.webm,.m4v,.3gp" />
        <b>${T('dropTitle', 'Chọn video hoặc kéo thả vào đây')}</b>
        <span>${T('dropHint', 'MP4, MOV, WebM, MKV, AVI. Nên dưới 300 MB (tối đa 500 MB).')}</span>
      </label>
      <p class="note" id="info"></p>
      <fieldset class="field"><legend>${T('level', 'Mức nén')}</legend>
        <div class="row">
          <label class="check"><input type="radio" name="level" value="light" /><span>${T('lLight', 'Nhẹ (đẹp nhất)')}</span></label>
          <label class="check"><input type="radio" name="level" value="medium" /><span>${T('lMedium', 'Vừa (khuyên dùng)')}</span></label>
          <label class="check"><input type="radio" name="level" value="strong" /><span>${T('lStrong', 'Mạnh (nhỏ nhất)')}</span></label>
        </div>
      </fieldset>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('res', 'Độ phân giải tối đa')}</span>
          <select id="res"><option value="0">${T('keep', 'Giữ nguyên')}</option><option value="1080">1080p</option><option value="720">720p</option><option value="480">480p</option><option value="360">360p</option></select>
        </label>
        <label class="field"><span class="field-label">${T('audio', 'Âm thanh')}</span>
          <select id="audio"><option value="128">128 kbps</option><option value="96">96 kbps</option><option value="64">64 kbps</option></select>
        </label>
      </div>
      <label class="check"><input type="checkbox" id="mute" /><span>${T('mute', 'Bỏ âm thanh')}</span></label>
      <div class="actions"><button type="button" class="btn btn-primary" id="run" disabled>${T('run', 'Nén video')}</button><button type="button" class="btn" id="cancel" hidden>${T('cancel', 'Dừng')}</button></div>
      <div class="progress" id="prog" hidden><i></i></div>
      <p class="note" id="status"></p>
      <p class="error" id="err" hidden></p>
      <p class="note">${T('note', 'Video được nén ngay trong trình duyệt bằng ffmpeg, không tải lên máy chủ. Lần đầu cần tải bộ xử lý khoảng 31 MB. Nén chạy bằng CPU nên chậm hơn phần mềm cài trên máy: video 1 phút thường mất 1–5 phút. Hãy giữ tab này mở cho tới khi xong.')}</p>
    </div>
    <section class="panel">
      <div class="media-box"><video id="preview" controls playsinline></video></div>
      <div class="stat-grid" id="stats"></div>
      <div class="actions" id="dl-box" hidden><button type="button" class="btn btn-primary" id="dl">${T('download', 'Tải video đã nén')}</button></div>
    </section>
  </div>
`;

let file: File | null = null;
let meta = { duration: 0, width: 0, height: 0 };
let out: Blob | null = null;
let ff: FFmpeg | null = null;
const showErr = (m: string) => { const e = $('#err'); e.textContent = m; e.hidden = !m; };
document.querySelectorAll<HTMLInputElement>('input[name=level]').forEach((r) => { r.checked = r.value === s.level; });
$<HTMLSelectElement>('#res').value = s.res;
$<HTMLSelectElement>('#audio').value = s.audio;
$<HTMLInputElement>('#mute').checked = s.mute;
function read(): void {
  s.level = (document.querySelector<HTMLInputElement>('input[name=level]:checked')?.value ?? 'medium') as Level;
  s.res = $<HTMLSelectElement>('#res').value;
  s.audio = $<HTMLSelectElement>('#audio').value;
  s.mute = $<HTMLInputElement>('#mute').checked;
  st.set(s);
}
const stat = (l: string, v: string, main = false) => `<div class="stat${main ? ' stat--main' : ''}"><span class="stat-label">${l}</span><span class="stat-value">${v}</span></div>`;

async function pick(f: File): Promise<void> {
  showErr('');
  if (f.size > MAX_BYTES) { showErr(T('tooBig', 'Video lớn hơn 500 MB, trình duyệt không đủ bộ nhớ để xử lý. Hãy cắt ngắn video trước.')); return; }
  file = f;
  out = null;
  $('#dl-box').hidden = true;
  try {
    const m = await probeVideo(f);
    meta = m;
    $<HTMLVideoElement>('#preview').src = m.url;
  } catch { meta = { duration: 0, width: 0, height: 0 }; }
  $('#info').textContent = `${f.name} · ${fmtSize(f.size)}${meta.duration ? ` · ${fmtTime(meta.duration)}` : ''}${meta.width ? ` · ${meta.width}×${meta.height}` : ''}`;
  $('#stats').innerHTML = stat(T('orig', 'Dung lượng gốc'), fmtSize(f.size));
  $<HTMLButtonElement>('#run').disabled = false;
}

$('#run').addEventListener('click', async () => {
  if (!file) return;
  read();
  showErr('');
  const btn = $<HTMLButtonElement>('#run');
  btn.disabled = true;
  $('#cancel').hidden = false;
  const prog = $('#prog');
  prog.hidden = false;
  const bar = prog.querySelector('i') as HTMLElement;
  const t0 = performance.now();
  try {
    ff ??= new FFmpeg();
    $('#status').textContent = T('loading', 'Đang tải bộ xử lý video…');
    await ff.load((l, total) => {
      bar.style.width = `${total ? (l / total) * 100 : 0}%`;
      $('#status').textContent = `${T('loading', 'Đang tải bộ xử lý video…')} ${fmtSize(l)}${total ? ` / ${fmtSize(total)}` : ''}`;
    });
    ff.onProgress = (p, timeUs) => {
      const ratio = meta.duration ? Math.min(1, timeUs / 1e6 / meta.duration) : Math.min(1, Math.max(0, p));
      bar.style.width = `${ratio * 100}%`;
      const el = (performance.now() - t0) / 1000;
      $('#status').textContent = `${T('working', 'Đang nén')} ${Math.round(ratio * 100)}%${ratio > 0.03 ? ` · ${T('left', 'còn khoảng')} ${fmtTime((el / ratio) * (1 - ratio))}` : ''}`;
    };
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
    const input = `in.${ext}`;
    $('#status').textContent = T('reading', 'Đang đọc video…');
    await ff.writeFile(input, new Uint8Array(await file.arrayBuffer()));
    const h = Number(s.res);
    // Chỉ thu nhỏ khi video cao hơn mức chọn; giữ tỉ lệ, kích thước chẵn (yêu cầu của H.264)
    const vf = ['-vf', h ? `scale=-2:'min(${h},trunc(ih/2)*2)'` : 'scale=trunc(iw/2)*2:trunc(ih/2)*2'];
    const audio = s.mute ? ['-an'] : ['-c:a', 'aac', '-b:a', `${s.audio}k`];
    const code = await ff.exec(['-i', input, ...vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(CRF[s.level]), '-pix_fmt', 'yuv420p', ...audio, '-movflags', '+faststart', 'out.mp4']);
    if (code !== 0) throw new Error(T('errCode', 'ffmpeg không xử lý được video này (định dạng lạ hoặc file hỏng).'));
    const data = await ff.readFile('out.mp4');
    await ff.deleteFile(input);
    await ff.deleteFile('out.mp4');
    out = new Blob([data as BlobPart], { type: 'video/mp4' });
    const saved = 1 - out.size / file.size;
    $('#stats').innerHTML = [
      stat(T('orig', 'Dung lượng gốc'), fmtSize(file.size)),
      stat(T('after', 'Sau khi nén'), fmtSize(out.size)),
      stat(T('saved', 'Giảm được'), `${Math.max(0, Math.round(saved * 100))}%`, true),
      stat(T('time', 'Thời gian xử lý'), `${fmtInt((performance.now() - t0) / 1000)} s`),
    ].join('');
    $<HTMLVideoElement>('#preview').src = URL.createObjectURL(out);
    $('#dl-box').hidden = false;
    $('#status').textContent = T('done', 'Xong!');
    bar.style.width = '100%';
    if (saved < 0.02) showErr(T('notSmaller', 'Video nén không nhỏ hơn bản gốc (video gốc đã được nén tốt). Hãy chọn mức nén Mạnh hoặc độ phân giải thấp hơn.'));
  } catch (e) {
    $('#status').textContent = '';
    showErr((e as Error).message);
    // Lỗi giữa chừng (thiếu bộ nhớ…): tạo lại bộ xử lý cho lần sau
    ff?.terminate();
    ff = null;
  } finally {
    btn.disabled = false;
    $('#cancel').hidden = true;
    setTimeout(() => (prog.hidden = true), 600);
  }
});
$('#cancel').addEventListener('click', () => {
  ff?.terminate();
  ff = null;
  showErr(T('cancelled', 'Đã dừng.'));
});
$('#dl').addEventListener('click', () => { if (out && file) downloadBlob(out, `${baseName(file.name)}-${T('suffix', 'da-nen')}.mp4`); });
bindDropzone($('#drop'), $<HTMLInputElement>('#file'), (f) => void pick(f[0]));
