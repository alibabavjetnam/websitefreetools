import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml } from '../ui';
import { pageText, localeTag } from '../i18n';
import { button, check, el, privacyNote, showError, errorBox, checked } from '../lib/devkit';
import { fmtSize } from '../lib/files';

mountLayout({ activeTool: 'voice-recorder' });
const T = pageText();

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px;align-items:center;text-align:center">
    <canvas id="wave" class="vr-wave" width="600" height="90"></canvas>
    <div class="vr-time" id="time">00:00</div>
    <div class="row" style="justify-content:center">${button('rec', T('rec', '● Bắt đầu ghi âm'), true)}${button('pause', T('pause', 'Tạm dừng'))}${button('stop', T('stop', '■ Dừng'))}</div>
    <div class="row" style="justify-content:center">${check('ns', T('ns', 'Giảm tiếng ồn'), true)}${check('ec', T('ec', 'Khử tiếng vọng'), true)}</div>
    ${errorBox('err')}
  </div>
  <div class="panel" style="margin-top:16px"><h2 class="panel-title">${T('list', 'Bản ghi')}</h2><div id="list"><p class="note">${T('empty', 'Chưa có bản ghi nào.')}</p></div></div>
  <p class="note" style="margin-top:12px">${T('note', 'Bản ghi chỉ nằm trong trình duyệt của bạn cho tới khi tải về; đóng trang là mất. Tải dạng WAV để mở được bằng mọi phần mềm, hoặc dạng gốc (WebM/MP4) cho dung lượng nhỏ.')}</p>
  ${privacyNote()}
`;
interface Clip { url: string; blob: Blob; ms: number; at: Date }
const clips: Clip[] = [];
let rec: MediaRecorder | null = null, stream: MediaStream | null = null, chunks: Blob[] = [];
let startAt = 0, elapsed = 0, raf = 0, analyser: AnalyserNode | null = null, actx: AudioContext | null = null;
const fmt = (ms: number) => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
function draw(): void {
  const c = el<HTMLCanvasElement>('wave'), g = c.getContext('2d') as CanvasRenderingContext2D;
  g.clearRect(0, 0, c.width, c.height);
  if (analyser) {
    const d = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(d);
    g.strokeStyle = '#b9000e'; g.lineWidth = 2; g.beginPath();
    d.forEach((v, i) => { const x = (i / d.length) * c.width, y = (v / 255) * c.height; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.stroke();
  }
  if (rec?.state === 'recording') el('time').textContent = fmt(elapsed + performance.now() - startAt);
  raf = requestAnimationFrame(draw);
}
const mime = () => ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
el('rec').addEventListener('click', async () => {
  showError('err', '');
  if (rec?.state === 'recording') return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { noiseSuppression: checked('ns'), echoCancellation: checked('ec') } });
  } catch { showError('err', T('micErr', 'Không mở được micro. Hãy cho phép trình duyệt dùng micro (biểu tượng ổ khoá cạnh thanh địa chỉ) và kiểm tra micro đã cắm.')); return; }
  actx = new AudioContext();
  analyser = actx.createAnalyser(); analyser.fftSize = 1024;
  actx.createMediaStreamSource(stream).connect(analyser);
  rec = new MediaRecorder(stream, mime() ? { mimeType: mime() } : undefined);
  chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    const blob = new Blob(chunks, { type: rec?.mimeType || 'audio/webm' });
    clips.unshift({ url: URL.createObjectURL(blob), blob, ms: elapsed, at: new Date() });
    stream?.getTracks().forEach((t) => t.stop());
    void actx?.close(); analyser = null;
    render();
  };
  rec.start(250);
  startAt = performance.now(); elapsed = 0;
  cancelAnimationFrame(raf); draw();
});
el('pause').addEventListener('click', () => {
  if (!rec) return;
  if (rec.state === 'recording') { rec.pause(); elapsed += performance.now() - startAt; el('pause').textContent = T('resume', 'Ghi tiếp'); }
  else if (rec.state === 'paused') { rec.resume(); startAt = performance.now(); el('pause').textContent = T('pause', 'Tạm dừng'); }
});
el('stop').addEventListener('click', () => {
  if (!rec || rec.state === 'inactive') return;
  if (rec.state === 'recording') elapsed += performance.now() - startAt;
  rec.stop();
  el('pause').textContent = T('pause', 'Tạm dừng');
});
function wav(buf: AudioBuffer): Blob {
  const ch = Math.min(2, buf.numberOfChannels), sr = buf.sampleRate, n = buf.length;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * ch * 2, true);
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  return new Blob([out.buffer], { type: 'audio/wav' });
}
function render(): void {
  const name = (c: Clip) => `recording-${c.at.toISOString().slice(0, 19).replace(/[T:]/g, '-')}`;
  el('list').innerHTML = clips.map((c, i) => `<div class="vr-clip"><b>${escapeHtml(c.at.toLocaleTimeString(localeTag()))}</b> <span class="note">${fmt(c.ms)} · ${fmtSize(c.blob.size)}</span><audio controls src="${c.url}"></audio><div class="row"><button type="button" class="btn btn-sm" data-wav="${i}">${T('dlWav', 'Tải WAV')}</button><button type="button" class="btn btn-sm" data-raw="${i}">${T('dlRaw', 'Tải bản gốc')}</button><button type="button" class="btn btn-sm" data-del="${i}">${T('del', 'Xoá')}</button></div></div>`).join('') || `<p class="note">${T('empty', 'Chưa có bản ghi nào.')}</p>`;
  el('list').querySelectorAll<HTMLElement>('[data-wav]').forEach((b) => b.addEventListener('click', async () => {
    const c = clips[Number(b.dataset.wav)];
    const ac = new AudioContext();
    try { downloadBlob(wav(await ac.decodeAudioData(await c.blob.arrayBuffer())), name(c) + '.wav'); } catch { showError('err', T('wavErr', 'Trình duyệt không đổi được sang WAV, hãy tải bản gốc.')); }
    void ac.close();
  }));
  el('list').querySelectorAll<HTMLElement>('[data-raw]').forEach((b) => b.addEventListener('click', () => { const c = clips[Number(b.dataset.raw)]; downloadBlob(c.blob, name(c) + (c.blob.type.includes('mp4') ? '.m4a' : c.blob.type.includes('ogg') ? '.ogg' : '.webm')); }));
  el('list').querySelectorAll<HTMLElement>('[data-del]').forEach((b) => b.addEventListener('click', () => { const [c] = clips.splice(Number(b.dataset.del), 1); URL.revokeObjectURL(c.url); render(); }));
}
draw();
