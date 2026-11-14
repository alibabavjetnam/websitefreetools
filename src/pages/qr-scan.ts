import { mountLayout } from '../layout';
import { $, escapeHtml, setupTabs } from '../ui';
import { pageText } from '../i18n';
import { button, bindCopy, el, privacyNote, showError, errorBox } from '../lib/devkit';
import { CDN, loadScript, global } from '../lib/cdn';

mountLayout({ activeTool: 'qr-scan' });
const T = pageText();
interface Detected { rawValue: string; format: string }
type BD = new (o?: { formats: string[] }) => { detect(src: CanvasImageSource): Promise<Detected[]> };
type JsQR = (d: Uint8ClampedArray, w: number, h: number, o?: { inversionAttempts: string }) => { data: string } | null;

$('#tool-root').innerHTML = `
  <div class="tabs" role="tablist" style="margin-top:24px">
    <button type="button" role="tab" data-tab="img">${T('tab.img', 'Quét từ ảnh')}</button>
    <button type="button" role="tab" data-tab="cam">${T('tab.cam', 'Quét bằng camera')}</button>
  </div>
  <div class="workspace" style="margin-top:0">
    <div class="panel">
      <div data-panel="img">
        <label class="field"><span class="field-label">${T('pick', 'Chọn ảnh có mã QR / mã vạch (hoặc dán ảnh bằng Ctrl+V)')}</span><input type="file" id="file" accept="image/*" /></label>
        <canvas id="cv" class="qs-canvas" hidden></canvas>
      </div>
      <div data-panel="cam" hidden>
        <div class="row">${button('start', T('start', 'Bật camera'), true)}${button('stop', T('stop', 'Tắt camera'))}</div>
        <video id="vid" class="qs-video" playsinline muted></video>
        <p class="note">${T('camNote', 'Đưa mã vào giữa khung hình, giữ máy ổn định và đủ sáng. Trình duyệt sẽ hỏi quyền dùng camera.')}</p>
      </div>
      ${errorBox('err')}
    </div>
    <div class="panel">
      <span class="field-label">${T('result', 'Nội dung đọc được')}</span>
      <div id="res"><p class="note">${T('waiting', 'Chưa có kết quả.')}</p></div>
      <div class="row">${button('copy', T('copy', 'Sao chép'), true)}</div>
      <p class="note">${T('safety', 'Cẩn thận với mã QR dán ở nơi công cộng: kiểm tra kỹ tên miền trước khi mở link hoặc nhập mật khẩu, thông tin thẻ.')}</p>
    </div>
  </div>
  ${privacyNote()}
`;
let last = '';
let stream: MediaStream | null = null;
let timer = 0;
setupTabs($('#tool-root'), () => stopCam());
const Native = (window as unknown as { BarcodeDetector?: BD }).BarcodeDetector;
let detector: InstanceType<BD> | null = null;
async function scan(src: HTMLCanvasElement | HTMLVideoElement, w: number, h: number): Promise<Detected | null> {
  if (Native) {
    try {
      detector ??= new Native({ formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'data_matrix', 'pdf417', 'aztec', 'itf'] });
      const r = await detector.detect(src);
      if (r.length) return r[0];
      return null;
    } catch { /* dùng jsQR */ }
  }
  await loadScript(CDN.jsqr, 'jsQR');
  const c = src instanceof HTMLCanvasElement ? src : document.createElement('canvas');
  if (!(src instanceof HTMLCanvasElement)) { c.width = w; c.height = h; (c.getContext('2d') as CanvasRenderingContext2D).drawImage(src, 0, 0, w, h); }
  const d = (c.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, c.width, c.height);
  const r = global<JsQR>('jsQR')(d.data, d.width, d.height, { inversionAttempts: 'attemptBoth' });
  return r ? { rawValue: r.data, format: 'qr_code' } : null;
}
function show(r: Detected): void {
  last = r.rawValue;
  const v = r.rawValue;
  let extra = '';
  if (/^https?:\/\//i.test(v)) {
    let host = '';
    try { host = new URL(v).hostname; } catch { /* */ }
    extra = `<p class="note">${T('link', 'Đây là đường link tới:')} <b>${escapeHtml(host)}</b></p><a class="btn" href="${escapeHtml(v)}" target="_blank" rel="noopener noreferrer nofollow">${T('open', 'Mở link')}</a>`;
  } else if (/^WIFI:/i.test(v)) {
    const g = (k: string) => v.match(new RegExp(`${k}:((?:\\\\.|[^;])*)`))?.[1]?.replace(/\\(.)/g, '$1') ?? '';
    extra = `<table class="data-table data-table--compact"><tr><th>${T('wifi.ssid', 'Tên mạng Wi-Fi')}</th><td>${escapeHtml(g('S'))}</td></tr><tr><th>${T('wifi.pw', 'Mật khẩu')}</th><td class="mono">${escapeHtml(g('P'))}</td></tr><tr><th>${T('wifi.sec', 'Bảo mật')}</th><td>${escapeHtml(g('T') || '—')}</td></tr></table>`;
  } else if (/^000201/.test(v)) extra = `<p class="note">${T('pay', 'Mã thanh toán (VietQR / EMVCo). Hãy quét bằng ứng dụng ngân hàng để chuyển tiền.')}</p>`;
  el('res').innerHTML = `<p class="note">${T('format', 'Loại mã')}: <b>${escapeHtml(r.format.replace(/_/g, ' ').toUpperCase())}</b></p><pre class="output">${escapeHtml(v)}</pre>${extra}`;
}
async function fromFile(f: File): Promise<void> {
  showError('err', '');
  const bmp = await createImageBitmap(f);
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = el<HTMLCanvasElement>('cv');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  (c.getContext('2d') as CanvasRenderingContext2D).drawImage(bmp, 0, 0, c.width, c.height);
  c.hidden = false;
  try {
    const r = await scan(c, c.width, c.height);
    if (r) show(r); else showError('err', T('none', 'Không tìm thấy mã trong ảnh. Thử ảnh rõ hơn, cắt sát vào mã hoặc chụp thẳng góc.'));
  } catch (e) { showError('err', (e as Error).message); }
}
el('file').addEventListener('change', () => { const f = el<HTMLInputElement>('file').files?.[0]; if (f) void fromFile(f); });
addEventListener('paste', (e) => { const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/')); if (f) void fromFile(f); });
function stopCam(): void { clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); stream = null; }
el('start').addEventListener('click', async () => {
  showError('err', '');
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    const v = el<HTMLVideoElement>('vid');
    v.srcObject = stream;
    await v.play();
    clearInterval(timer);
    let busy = false;
    timer = window.setInterval(async () => {
      if (busy || !v.videoWidth) return;
      busy = true;
      try { const r = await scan(v, v.videoWidth, v.videoHeight); if (r && r.rawValue !== last) { show(r); navigator.vibrate?.(80); } } catch { /* */ }
      busy = false;
    }, 300);
  } catch { showError('err', T('camErr', 'Không mở được camera. Hãy cho phép trình duyệt dùng camera (biểu tượng ổ khoá cạnh thanh địa chỉ) hoặc dùng tab Quét từ ảnh.')); }
});
el('stop').addEventListener('click', stopCam);
bindCopy('copy', () => last);
