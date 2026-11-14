import { mountLayout } from '../layout';
import { $, fmtDec } from '../ui';
import { pageText } from '../i18n';
import { button, el, showError, errorBox } from '../lib/devkit';

mountLayout({ activeTool: 'speed-test' });
const T = pageText();
const BASE = 'https://speed.cloudflare.com';

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px;align-items:center;text-align:center">
    <div class="st-gauge"><span id="big">—</span><small id="unit">Mbps</small><p id="phase" class="note"></p></div>
    <div class="row" style="justify-content:center">${button('go', T('start', 'Bắt đầu đo'), true)}</div>
    ${errorBox('err')}
    <div class="stat-grid" style="width:100%">
      <div class="stat"><span class="stat-label">${T('ping', 'Độ trễ (ping)')}</span><span class="stat-value" id="ping">—</span></div>
      <div class="stat"><span class="stat-label">${T('jitter', 'Độ dao động (jitter)')}</span><span class="stat-value" id="jit">—</span></div>
      <div class="stat"><span class="stat-label">${T('down', 'Tải xuống')}</span><span class="stat-value" id="down">—</span></div>
      <div class="stat"><span class="stat-label">${T('up', 'Tải lên')}</span><span class="stat-value" id="up">—</span></div>
    </div>
    <p class="note" id="verdict"></p>
  </div>
  <p class="note" style="margin-top:12px">${T('how', 'Đo bằng cách tải dữ liệu thử qua máy chủ gần nhất của mạng Cloudflare (speed.cloudflare.com, miễn phí). Mỗi lần đo dùng khoảng 50–150 MB dữ liệu; nếu đang dùng 4G hãy để ý dung lượng gói cước. Kết quả tham khảo, có thể khác ứng dụng của nhà mạng.')}</p>
`;
const mbps = (bytes: number, ms: number) => (bytes * 8) / (ms / 1000) / 1e6;
const phase = (s: string) => (el('phase').textContent = s);
async function ping(): Promise<[number, number]> {
  const xs: number[] = [];
  for (let i = 0; i < 12; i++) {
    const t = performance.now();
    await fetch(`${BASE}/__down?bytes=0&r=${Math.random()}`, { cache: 'no-store' });
    xs.push(performance.now() - t);
  }
  xs.sort((a, b) => a - b);
  const use = xs.slice(1, -2);
  const med = use[Math.floor(use.length / 2)];
  const jit = use.slice(1).reduce((s, x, i) => s + Math.abs(x - use[i]), 0) / (use.length - 1);
  return [med, jit];
}
async function down(): Promise<number> {
  const sizes = [1e6, 5e6, 10e6, 25e6, 25e6, 50e6];
  let best = 0, spent = 0;
  for (const n of sizes) {
    const t = performance.now();
    const r = await fetch(`${BASE}/__down?bytes=${n}&r=${Math.random()}`, { cache: 'no-store' });
    const reader = (r.body as ReadableStream<Uint8Array>).getReader();
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.length;
      const v = mbps(got, performance.now() - t);
      if (got > 2e5) el('big').textContent = fmtDec(v);
    }
    const ms = performance.now() - t;
    best = Math.max(best, mbps(got, ms));
    spent += ms;
    if (spent > 9000 || ms > 4000) break;
  }
  return best;
}
async function up(): Promise<number> {
  const sizes = [5e5, 2e6, 5e6, 10e6, 20e6];
  let best = 0, spent = 0;
  for (const n of sizes) {
    const body = new Uint8Array(n);
    crypto.getRandomValues(body.subarray(0, Math.min(n, 65536)));
    const t = performance.now();
    await fetch(`${BASE}/__up?r=${Math.random()}`, { method: 'POST', body, cache: 'no-store' });
    const ms = performance.now() - t;
    const v = mbps(n, ms);
    best = Math.max(best, v);
    el('big').textContent = fmtDec(v);
    spent += ms;
    if (spent > 8000 || ms > 4000) break;
  }
  return best;
}
el('go').addEventListener('click', async () => {
  const b = el<HTMLButtonElement>('go');
  b.disabled = true;
  showError('err', '');
  for (const id of ['ping', 'jit', 'down', 'up']) el(id).textContent = '—';
  el('verdict').textContent = '';
  try {
    phase(T('p.ping', 'Đang đo độ trễ…'));
    el('big').textContent = '…'; el('unit').textContent = 'ms';
    const [p, j] = await ping();
    el('ping').textContent = `${Math.round(p)} ms`; el('jit').textContent = `${fmtDec(j)} ms`; el('big').textContent = String(Math.round(p));
    phase(T('p.down', 'Đang đo tốc độ tải xuống…')); el('unit').textContent = 'Mbps';
    const d = await down();
    el('down').textContent = `${fmtDec(d)} Mbps`;
    phase(T('p.up', 'Đang đo tốc độ tải lên…'));
    const u = await up();
    el('up').textContent = `${fmtDec(u)} Mbps`;
    el('big').textContent = fmtDec(d);
    phase(T('p.done', 'Xong. Số lớn là tốc độ tải xuống.'));
    el('verdict').textContent = d >= 100 ? T('v.great', 'Rất nhanh: xem video 4K, chơi game online, họp video nhiều người đều thoải mái.') : d >= 25 ? T('v.good', 'Tốt: xem video Full HD/4K, họp video ổn định.') : d >= 8 ? T('v.ok', 'Trung bình: xem video HD và họp video được, tải file lớn hơi chậm.') : T('v.slow', 'Chậm: có thể giật khi xem video hoặc họp trực tuyến. Thử đứng gần bộ phát Wi-Fi hoặc khởi động lại modem.');
  } catch {
    phase('');
    showError('err', T('fail', 'Không đo được: mất kết nối hoặc trình chặn quảng cáo / tường lửa chặn speed.cloudflare.com. Tắt trình chặn rồi thử lại.'));
  }
  b.disabled = false;
});
