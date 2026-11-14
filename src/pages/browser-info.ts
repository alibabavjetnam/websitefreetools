import { mountLayout } from '../layout';
import { $, escapeHtml } from '../ui';
import { pageText, localeTag } from '../i18n';
import { button, bindCopy, el, privacyNote } from '../lib/devkit';

mountLayout({ activeTool: 'browser-info' });
const T = pageText();

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px">
    <div class="stat-grid" id="top"></div>
    <div class="row">${button('ip', T('showIp', 'Xem địa chỉ IP công cộng'), true)}${button('copy', T('copy', 'Sao chép toàn bộ thông tin'))}</div>
    <p class="note" id="ipnote">${T('ipNote', 'Địa chỉ IP chỉ được tra khi bạn bấm nút, qua dịch vụ miễn phí api.ipify.org.')}</p>
    <table class="data-table"><tbody id="rows"></tbody></table>
  </div>
`;
interface UAData { brands?: { brand: string; version: string }[]; mobile?: boolean; platform?: string }
const nav = navigator as Navigator & { userAgentData?: UAData; deviceMemory?: number; connection?: { effectiveType?: string; downlink?: number; rtt?: number } };
function detect(): { browser: string; os: string } {
  const ua = navigator.userAgent;
  const m = (re: RegExp) => ua.match(re)?.[1];
  const browser = /Edg\//.test(ua) ? `Edge ${m(/Edg\/([\d.]+)/)}` : /OPR\//.test(ua) ? `Opera ${m(/OPR\/([\d.]+)/)}` : /SamsungBrowser/.test(ua) ? `Samsung Internet ${m(/SamsungBrowser\/([\d.]+)/)}` : /coc_coc/i.test(ua) ? `Cốc Cốc ${m(/coc_coc_browser\/([\d.]+)/i)}` : /Firefox\//.test(ua) ? `Firefox ${m(/Firefox\/([\d.]+)/)}` : /Chrome\//.test(ua) ? `Chrome ${m(/Chrome\/([\d.]+)/)}` : /Safari\//.test(ua) ? `Safari ${m(/Version\/([\d.]+)/) ?? ''}` : '?';
  const os = /Windows NT 10/.test(ua) ? 'Windows 10/11' : /Windows/.test(ua) ? 'Windows' : /Android ([\d.]+)/.test(ua) ? `Android ${m(/Android ([\d.]+)/)}` : /iPhone|iPad/.test(ua) ? `iOS ${(m(/OS ([\d_]+)/) ?? '').replace(/_/g, '.')}` : /Mac OS X/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : '?';
  return { browser, os };
}
let ip = '';
function rows(): [string, string][] {
  const d = detect();
  const yes = T('yes', 'Có'), no = T('no', 'Không');
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const r: [string, string][] = [
    [T('r.browser', 'Trình duyệt'), d.browser], [T('r.os', 'Hệ điều hành'), d.os], [T('r.ua', 'Chuỗi User-Agent'), navigator.userAgent],
    [T('r.lang', 'Ngôn ngữ trình duyệt'), (navigator.languages || [navigator.language]).join(', ')], [T('r.tz', 'Múi giờ'), `${tz} (UTC${-new Date().getTimezoneOffset() / 60 >= 0 ? '+' : ''}${-new Date().getTimezoneOffset() / 60})`],
    [T('r.time', 'Giờ trên máy'), new Date().toLocaleString(localeTag())], [T('r.screen', 'Màn hình'), `${screen.width} × ${screen.height} px, ${screen.colorDepth}-bit`],
    [T('r.viewport', 'Vùng hiển thị trình duyệt'), `${innerWidth} × ${innerHeight} px`], [T('r.dpr', 'Tỉ lệ điểm ảnh (DPR)'), String(devicePixelRatio)],
    [T('r.cpu', 'Số nhân CPU'), String(navigator.hardwareConcurrency ?? '?')], [T('r.mem', 'Bộ nhớ RAM (ước tính)'), nav.deviceMemory ? `≥ ${nav.deviceMemory} GB` : '?'],
    [T('r.touch', 'Màn hình cảm ứng'), navigator.maxTouchPoints > 0 ? `${yes} (${navigator.maxTouchPoints})` : no], [T('r.cookies', 'Cookie'), navigator.cookieEnabled ? yes : no],
    [T('r.dnt', 'Yêu cầu không theo dõi (DNT)'), navigator.doNotTrack === '1' ? yes : no], [T('r.online', 'Đang có mạng'), navigator.onLine ? yes : no],
    [T('r.net', 'Loại kết nối'), nav.connection ? `${nav.connection.effectiveType ?? '?'} · ~${nav.connection.downlink ?? '?'} Mbps · ${nav.connection.rtt ?? '?'} ms` : '?'],
    [T('r.dark', 'Chế độ tối'), matchMedia('(prefers-color-scheme: dark)').matches ? yes : no], [T('r.webgl', 'Card đồ hoạ (WebGL)'), gpu()],
    [T('r.ref', 'Trang trước'), document.referrer || '—'],
  ];
  if (ip) r.unshift([T('r.ip', 'Địa chỉ IP công cộng'), ip]);
  return r;
}
function gpu(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl') as WebGLRenderingContext | null;
    if (!gl) return T('no', 'Không');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
  } catch { return '?'; }
}
function render(): void {
  const d = detect();
  const stat = (l: string, v: string) => `<div class="stat"><span class="stat-label">${l}</span><span class="stat-value" style="font-size:1.05rem">${escapeHtml(v)}</span></div>`;
  el('top').innerHTML = stat(T('r.browser', 'Trình duyệt'), d.browser) + stat(T('r.os', 'Hệ điều hành'), d.os) + stat(T('r.screen', 'Màn hình'), `${screen.width}×${screen.height}`) + (ip ? stat('IP', ip) : '');
  el('rows').innerHTML = rows().map(([k, v]) => `<tr><th style="width:34%">${k}</th><td class="mono" style="word-break:break-all">${escapeHtml(v)}</td></tr>`).join('');
}
el('ip').addEventListener('click', async () => {
  try {
    const r = await fetch('https://api.ipify.org?format=json');
    ip = ((await r.json()) as { ip: string }).ip;
    render();
  } catch { el('ipnote').textContent = T('ipFail', 'Không tra được địa chỉ IP (mạng lỗi hoặc trình chặn quảng cáo chặn dịch vụ). Thử tắt trình chặn rồi bấm lại.'); }
});
bindCopy('copy', () => rows().map(([k, v]) => `${k}: ${v}`).join('\n'));
addEventListener('resize', render);
render();
void privacyNote;
