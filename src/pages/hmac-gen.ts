import { mountLayout } from '../layout';
import { $ } from '../ui';
import { pageText } from '../i18n';
import { area, input, select, check, button, bindCopy, dk, el, privacyNote, val, setVal, checked, onChange, utf8, toHex, toB64, fromHex, fromB64, type Bytes } from '../lib/devkit';

mountLayout({ activeTool: 'hmac-gen' });
const T = pageText();

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px">
    ${area('msg', T('msg', 'Nội dung cần ký'), { rows: 6, value: '{"order":1001,"amount":250000}' })}
    <div class="form-grid">
      ${input('key', T('key', 'Khoá bí mật'), { value: 'my-secret-key', mono: true })}
      ${select('keyFmt', T('keyFmt', 'Dạng khoá'), [['text', T('f.text', 'Văn bản')], ['hex', 'Hex'], ['b64', 'Base64']], 'text')}
      ${select('algo', T('algo', 'Thuật toán'), [['SHA-256', 'HMAC-SHA256'], ['SHA-384', 'HMAC-SHA384'], ['SHA-512', 'HMAC-SHA512'], ['SHA-1', 'HMAC-SHA1']], 'SHA-256')}
      ${select('outFmt', T('outFmt', 'Dạng kết quả'), [['hex', 'Hex'], ['b64', 'Base64'], ['b64url', 'Base64URL']], 'hex')}
    </div>
    ${check('upper', T('upper', 'Chữ in hoa (hex)'))}
    ${input('out', T('sig', 'Chữ ký HMAC'), { mono: true, attrs: 'readonly' })}
    <div class="row">${button('copy', dk.copy(), true)}</div>
    ${input('cmp', T('compare', 'So sánh với chữ ký nhận được (không bắt buộc)'), { mono: true })}
    <p class="note" id="cmp-res"></p>
    <p class="note" id="err"></p>
  </div>
  <p class="note" style="margin-top:12px">${T('use', 'HMAC thường dùng để kiểm tra webhook (Stripe, GitHub, Shopify, cổng thanh toán): bên gửi ký nội dung bằng khoá chung, bên nhận ký lại và so sánh.')}</p>
  ${privacyNote()}
`;
async function run(): Promise<void> {
  el('err').textContent = '';
  let k: Bytes;
  try { k = val('keyFmt') === 'hex' ? fromHex(val('key')) : val('keyFmt') === 'b64' ? fromB64(val('key')) : utf8(val('key')); }
  catch { el('err').className = 'note error-text'; el('err').textContent = T('badKey', 'Khoá không đúng dạng đã chọn (hex chỉ gồm 0-9, a-f).'); setVal('out', ''); return; }
  if (!k.length) { setVal('out', ''); return; }
  const ck = await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: val('algo') }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', ck, utf8(val('msg'))));
  const f = val('outFmt');
  const s = f === 'hex' ? (checked('upper') ? toHex(sig).toUpperCase() : toHex(sig)) : toB64(sig, f === 'b64url');
  setVal('out', s);
  const c = val('cmp').trim();
  const r = el('cmp-res');
  if (!c) r.textContent = '';
  else {
    const ok = c === s || c.toLowerCase() === s.toLowerCase() || c.replace(/^sha\d+=/, '').toLowerCase() === toHex(sig);
    r.className = ok ? 'note ok-text' : 'note error-text';
    r.textContent = ok ? T('match', 'Khớp: nội dung đúng và đến từ bên có khoá.') : T('noMatch', 'Không khớp: sai khoá, sai thuật toán hoặc nội dung đã bị thay đổi.');
  }
}
onChange(['msg', 'key', 'keyFmt', 'algo', 'outFmt', 'upper', 'cmp'], () => void run(), 80);
bindCopy('copy', () => val('out'));
void run();
