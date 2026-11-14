import { mountLayout } from '../layout';
import { $ } from '../ui';
import { pageText } from '../i18n';
import { area, select, button, bindCopy, dk, privacyNote, val, setVal, onChange, showError, errorBox } from '../lib/devkit';
import { parseCurl, curlTo, type CurlTarget } from '../calc/devconv';

mountLayout({ activeTool: 'curl-convert' });
const T = pageText();
const SAMPLE = `curl -X POST 'https://api.example.com/v1/orders?notify=true' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer YOUR_TOKEN' \\
  -d '{"product":"QR Pro","quantity":2,"gift":false}'`;

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px">
    ${select('target', T('target', 'Chuyển sang'), [['fetch', 'JavaScript fetch'], ['axios', 'JavaScript axios'], ['node', 'Node.js fetch'], ['python', 'Python requests'], ['php', 'PHP cURL'], ['go', 'Go net/http']], 'fetch')}
    <div class="workspace" style="margin-top:0">
      ${area('in', T('curl', 'Lệnh cURL'), { rows: 14, value: SAMPLE })}
      ${area('out', dk.output(), { rows: 14, ro: true })}
    </div>
    ${errorBox('err')}
    <div class="row">${button('copy', dk.copy(), true)}</div>
    <p class="note">${T('note', 'Nhận các tuỳ chọn hay dùng: -X, -H, -d / --data / --data-raw / --json, --data-urlencode, -F, -u, -A, -b, -e. Mẹo: trong tab Network của trình duyệt, bấm chuột phải vào một yêu cầu → Copy → Copy as cURL rồi dán vào đây.')}</p>
  </div>
  ${privacyNote()}
`;
function run(): void {
  showError('err', '');
  if (!val('in').trim()) { setVal('out', ''); return; }
  try { setVal('out', curlTo(parseCurl(val('in')), val('target') as CurlTarget)); }
  catch (e) {
    setVal('out', '');
    const m = (e as Error).message;
    showError('err', m === 'curl' ? T('noCurl', 'Lệnh phải bắt đầu bằng chữ curl.') : m === 'url' ? T('noUrl', 'Không tìm thấy địa chỉ URL trong lệnh.') : T('quote', 'Lệnh có dấu nháy chưa đóng. Kiểm tra lại dấu \' hoặc " bị thiếu.'));
  }
}
onChange(['in', 'target'], run, 150);
bindCopy('copy', () => val('out'));
run();
