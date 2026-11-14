import { mountLayout } from '../layout';
import { $, downloadBlob } from '../ui';
import { pageText } from '../i18n';
import { input, select, button, el, privacyNote, val, showError, errorBox } from '../lib/devkit';
import { makeZip } from '../lib/zipstore';
import { baseName } from '../lib/files';

mountLayout({ activeTool: 'video-frames' });
const T = pageText();

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px">
    <label class="field"><span class="field-label">${T('pick', 'Chọn video (MP4, WebM, MOV…)')}</span><input type="file" id="file" accept="video/*" /></label>
    <video id="vid" class="vf-video" controls playsinline muted></video>
    ${errorBox('err')}
    <div class="row">${button('snap', T('snap', 'Chụp khung hình hiện tại'), true)}${button('back', T('back', '◀ Lùi 1 khung'))}${button('fwd', T('fwd', 'Tới 1 khung ▶'))}<span class="note mono" id="pos"></span></div>
    <div class="form-grid">
      ${select('fmt', T('fmt', 'Định dạng ảnh'), [['image/jpeg', 'JPG'], ['image/png', 'PNG'], ['image/webp', 'WebP']], 'image/jpeg')}
      ${select('scale', T('scale', 'Kích thước'), [['1', T('s.orig', 'Gốc')], ['0.5', '50%'], ['0.25', '25%']], '1')}
      ${input('every', T('every', 'Tách tự động mỗi (giây)'), { type: 'number', value: '2', attrs: 'min="0.1" step="0.1"' })}
      ${input('max', T('max', 'Tối đa số ảnh'), { type: 'number', value: '60', attrs: 'min="1" max="500"' })}
    </div>
    <div class="row">${button('auto', T('auto', 'Tách hàng loạt'))}${button('zip', T('zip', 'Tải tất cả (.zip)'))}${button('clear', T('clear', 'Xoá danh sách'))}<span class="note" id="prog"></span></div>
  </div>
  <div id="shots" class="vf-grid"></div>
  ${privacyNote()}
`;
const v = el<HTMLVideoElement>('vid');
let name = 'video';
const shots: { t: number; blob: Blob; url: string }[] = [];
const FPS = 30;
const ts = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}-${(t % 60).toFixed(2).padStart(5, '0')}`;
el('file').addEventListener('change', () => {
  const f = el<HTMLInputElement>('file').files?.[0];
  if (!f) return;
  name = baseName(f.name);
  v.src = URL.createObjectURL(f);
  showError('err', '');
});
v.addEventListener('error', () => showError('err', T('bad', 'Trình duyệt không phát được video này (định dạng hoặc mã hoá không hỗ trợ). Thử đổi sang MP4 H.264 bằng công cụ Cắt và đổi định dạng video.')));
v.addEventListener('timeupdate', () => (el('pos').textContent = `${v.currentTime.toFixed(2)} s / ${(v.duration || 0).toFixed(2)} s`));
async function capture(): Promise<void> {
  if (!v.videoWidth) return;
  const k = Number(val('scale'));
  const c = document.createElement('canvas');
  c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
  (c.getContext('2d') as CanvasRenderingContext2D).drawImage(v, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob>((ok) => c.toBlob((b) => ok(b as Blob), val('fmt'), 0.92));
  shots.push({ t: v.currentTime, blob, url: URL.createObjectURL(blob) });
  render();
}
const ext = () => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[val('fmt')];
function render(): void {
  el('shots').innerHTML = shots.map((s, i) => `<figure><img src="${s.url}" alt="" /><figcaption>${s.t.toFixed(2)} s <a href="${s.url}" download="${name}-${ts(s.t)}.${ext()}">${T('dl', 'Tải')}</a> <button type="button" class="btn btn-sm" data-del="${i}">✕</button></figcaption></figure>`).join('');
}
el('shots').addEventListener('click', (e) => { const d = (e.target as HTMLElement).closest<HTMLElement>('[data-del]')?.dataset.del; if (d != null) { URL.revokeObjectURL(shots[Number(d)].url); shots.splice(Number(d), 1); render(); } });
const seek = (t: number) => new Promise<void>((ok) => { v.addEventListener('seeked', () => ok(), { once: true }); v.currentTime = t; });
el('snap').addEventListener('click', () => void capture());
el('back').addEventListener('click', () => { v.pause(); v.currentTime = Math.max(0, v.currentTime - 1 / FPS); });
el('fwd').addEventListener('click', () => { v.pause(); v.currentTime = Math.min(v.duration || 0, v.currentTime + 1 / FPS); });
el('auto').addEventListener('click', async () => {
  if (!v.duration) return showError('err', T('noVideo', 'Hãy chọn video trước.'));
  v.pause();
  const step = Math.max(0.1, Number(val('every')) || 1), max = Math.min(500, Number(val('max')) || 60);
  for (let t = 0, n = 0; t < v.duration && n < max; t += step, n++) {
    await seek(t);
    await capture();
    el('prog').textContent = `${n + 1} / ${Math.min(max, Math.ceil(v.duration / step))}`;
  }
});
el('zip').addEventListener('click', async () => {
  if (!shots.length) return;
  const files = await Promise.all(shots.map(async (s) => ({ name: `${name}-${ts(s.t)}.${ext()}`, data: new Uint8Array(await s.blob.arrayBuffer()) })));
  downloadBlob(makeZip(files), `${name}-frames.zip`);
});
el('clear').addEventListener('click', () => { shots.splice(0).forEach((s) => URL.revokeObjectURL(s.url)); render(); });
