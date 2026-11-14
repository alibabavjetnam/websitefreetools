import { mountLayout } from '../layout';
import { $, escapeHtml, fmtInt, parseNumber, storage, downloadBlob } from '../ui';
import { pageText } from '../i18n';
import { input, select, button, bindCopy, el, val, setVal, onChange, showError, errorBox } from '../lib/devkit';
import { BANKS, vietQrPayload, cleanMemo } from '../calc/vietqr';
import { encodeQr, qrToSvg } from '../lib/qr';
import { downloadSvg } from '../lib/download';
import { moneyInVietnamese } from '../calc/words-vi';

mountLayout({ activeTool: 'vietqr' });
const T = pageText();
const st = storage<{ bin: string; acct: string; name: string }>('vietqr', { bin: '970436', acct: '', name: '' });
const s0 = st.get();

$('#tool-root').innerHTML = `
  <p class="note" style="margin-top:12px"><b>${T('vnOnly', 'Dành cho tài khoản ngân hàng tại Việt Nam.')}</b> ${T('vnNote', 'Mã theo chuẩn VietQR (NAPAS 247), quét được bằng ứng dụng của hầu hết ngân hàng và ví điện tử Việt Nam.')}</p>
  <div class="workspace">
    <div class="panel">
      ${select('bank', T('bank', 'Ngân hàng'), BANKS.map(([b, n, c]) => [b, `${n} (${c})`] as [string, string]), s0.bin)}
      ${input('acct', T('acct', 'Số tài khoản'), { mono: true, value: s0.acct, ph: '0123456789', attrs: 'inputmode="numeric"' })}
      ${input('name', T('name', 'Tên chủ tài khoản (để in trên ảnh, không bắt buộc)'), { value: s0.name, ph: 'NGUYEN VAN A' })}
      ${input('amount', T('amount', 'Số tiền (đ) — để trống cho người chuyển tự nhập'), { attrs: 'inputmode="numeric"', ph: '150.000' })}
      <p class="note" id="words"></p>
      ${input('memo', T('memo', 'Nội dung chuyển khoản'), { ph: T('memoPh', 'Thanh toan don hang 1024') })}
      <p class="note" id="memoNote"></p>
      ${errorBox('err')}
    </div>
    <div class="panel" style="align-items:center">
      <div class="vq-card" id="card"><div class="vq-qr" id="qr"></div><div class="vq-info" id="info"></div></div>
      <div class="row">${button('png', T('png', 'Tải ảnh PNG'), true)}${button('svg', T('svg', 'Tải SVG'))}${button('copy', T('copy', 'Sao chép nội dung mã'))}</div>
      <p class="note">${T('check', 'Hãy quét thử bằng ứng dụng ngân hàng của bạn để kiểm tra đúng tên người nhận trước khi in hoặc gửi cho khách.')}</p>
    </div>
  </div>
  <p class="note" style="margin-top:16px">${T('privacy', 'Mã được tạo ngay trên máy bạn; số tài khoản chỉ lưu trong trình duyệt này để lần sau khỏi nhập lại.')}</p>
`;
let payload = '', svg = '';
function run(): void {
  showError('err', '');
  const acct = val('acct').replace(/\s/g, '');
  const amt = parseNumber(val('amount'));
  st.set({ bin: val('bank'), acct, name: val('name') });
  el('words').textContent = amt > 0 ? moneyInVietnamese(amt) : '';
  const m = val('memo');
  el('memoNote').textContent = m && cleanMemo(m) !== m ? T('memoClean', 'Nội dung sẽ được ghi là: "{m}" (bỏ dấu và ký tự đặc biệt để mọi ngân hàng đọc được).').replace('{m}', cleanMemo(m)) : '';
  if (!/^\d{6,19}$/.test(acct)) {
    el('qr').innerHTML = ''; el('info').innerHTML = ''; payload = '';
    if (acct) showError('err', T('badAcct', 'Số tài khoản chỉ gồm chữ số, từ 6 đến 19 số.'));
    return;
  }
  payload = vietQrPayload(val('bank'), acct, amt > 0 ? amt : null, m);
  svg = qrToSvg(encodeQr(payload, 'M'), { margin: 2, px: 8 });
  el('qr').innerHTML = svg;
  const bank = BANKS.find((b) => b[0] === val('bank'));
  el('info').innerHTML = `<b>${escapeHtml(bank?.[1] ?? '')}</b><span class="mono">${escapeHtml(acct)}</span>${val('name') ? `<span>${escapeHtml(val('name').toUpperCase())}</span>` : ''}${amt > 0 ? `<b class="vq-amt">${fmtInt(amt)} đ</b>` : ''}${cleanMemo(m) ? `<small>${escapeHtml(cleanMemo(m))}</small>` : ''}`;
}
onChange(['bank', 'acct', 'name', 'amount', 'memo'], run, 120);
el('amount').addEventListener('blur', () => { const n = parseNumber(val('amount')); if (n > 0) setVal('amount', fmtInt(n)); });
async function cardPng(): Promise<void> {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  await new Promise<void>((ok, no) => { img.onload = () => ok(); img.onerror = () => no(); img.src = url; });
  const lines = [...el('info').children].map((c) => [c.textContent ?? '', c.tagName] as const);
  const W = 720, Q = 600, H = Q + 60 + lines.length * 46 + 30;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.imageSmoothingEnabled = false;
  g.drawImage(img, (W - Q) / 2, 30, Q, Q);
  URL.revokeObjectURL(url);
  g.textAlign = 'center';
  let y = Q + 70;
  for (const [t, tag] of lines) {
    g.fillStyle = tag === 'B' && t.endsWith('đ') ? '#b9000e' : '#16233a';
    g.font = `${tag === 'B' ? 700 : tag === 'SMALL' ? 400 : 500} ${tag === 'SMALL' ? 24 : 30}px "Be Vietnam Pro", system-ui, sans-serif`;
    g.fillText(t, W / 2, y);
    y += 46;
  }
  c.toBlob((b) => b && downloadBlob(b, `vietqr-${val('acct')}.png`), 'image/png');
}
el('png').addEventListener('click', () => { if (svg) void cardPng(); });
el('svg').addEventListener('click', () => { if (svg) downloadSvg(svg, `vietqr-${val('acct')}.svg`); });
bindCopy('copy', () => payload);
run();
