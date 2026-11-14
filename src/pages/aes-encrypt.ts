import { mountLayout } from '../layout';
import { $, downloadBlob, setupTabs } from '../ui';
import { pageText } from '../i18n';
import { area, button, input, bindCopy, dk, el, errorBox, showError, privacyNote, val, setVal, utf8, fromUtf8, toB64, fromB64, fmtBytes, type Bytes } from '../lib/devkit';

mountLayout({ activeTool: 'aes-encrypt' });
const T = pageText();
const MAGIC = [0x57, 0x46, 0x54, 0x31]; // "WFT1"
const ITER = 200000;

$('#tool-root').innerHTML = `
  <div class="tabs" role="tablist" style="margin-top:24px">
    <button type="button" role="tab" data-tab="text">${T('tab.text', 'Mã hoá văn bản')}</button>
    <button type="button" role="tab" data-tab="file">${T('tab.file', 'Mã hoá file')}</button>
  </div>
  <div class="tool-body">
    <div class="panel">
      ${input('pw', T('pw', 'Mật khẩu'), { type: 'password', attrs: 'minlength="1"' })}
      <p class="note">${T('pwNote', 'Hãy nhớ kỹ mật khẩu: không có cách nào khôi phục dữ liệu nếu quên. Dùng mật khẩu dài, khó đoán.')}</p>
    </div>
    <div class="panel" data-panel="text">
      <div class="workspace" style="margin-top:0">
        ${area('plain', T('plain', 'Văn bản gốc'), { rows: 9, mono: false, value: T('sample', 'Ghi chú bí mật: mã mở két là 2468.') })}
        ${area('cipher', T('cipher', 'Văn bản đã mã hoá (Base64)'), { rows: 9 })}
      </div>
      ${errorBox('err')}
      <div class="row">${button('enc', T('encrypt', 'Mã hoá →'), true)}${button('dec', T('decrypt', '← Giải mã'))}${button('copy', dk.copy())}</div>
    </div>
    <div class="panel" data-panel="file" hidden>
      <label class="field"><span class="field-label">${dk.chooseFile()}</span><input type="file" id="file" /></label>
      ${errorBox('ferr')}
      <div class="row">${button('fenc', T('encFile', 'Mã hoá và tải về (.wftenc)'), true)}${button('fdec', T('decFile', 'Giải mã file .wftenc'))}</div>
      <p class="note" id="fstat"></p>
    </div>
  </div>
  <p class="note" style="margin-top:12px">${T('algo', 'Thuật toán: AES-256-GCM, khoá suy từ mật khẩu bằng PBKDF2-SHA256 200.000 vòng, muối và IV ngẫu nhiên cho mỗi lần mã hoá.')}</p>
  ${privacyNote()}
`;
setupTabs($('#tool-root'));

async function key(salt: Bytes): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', utf8(val('pw')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encrypt(data: Bytes): Promise<Bytes> {
  const salt = crypto.getRandomValues(new Uint8Array(16)) as Bytes;
  const iv = crypto.getRandomValues(new Uint8Array(12)) as Bytes;
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(salt), data));
  const out = new Uint8Array(4 + 16 + 12 + ct.length) as Bytes;
  out.set(MAGIC); out.set(salt, 4); out.set(iv, 20); out.set(ct, 32);
  return out;
}
async function decrypt(blob: Bytes): Promise<Bytes> {
  if (blob.length < 33 || MAGIC.some((m, i) => blob[i] !== m)) throw new Error('format');
  const salt = blob.slice(4, 20), iv = blob.slice(20, 32);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await key(salt), blob.slice(32))) as Bytes;
}
const needPw = (box: string) => { if (!val('pw')) { showError(box, T('noPw', 'Hãy nhập mật khẩu trước.')); return true; } return false; };
const wrongPw = () => T('wrong', 'Giải mã thất bại: sai mật khẩu, hoặc dữ liệu không phải do công cụ này mã hoá / đã bị sửa.');

el('enc').addEventListener('click', async () => {
  showError('err', '');
  if (needPw('err')) return;
  setVal('cipher', toB64(await encrypt(utf8(val('plain')))));
});
el('dec').addEventListener('click', async () => {
  showError('err', '');
  if (needPw('err')) return;
  try { setVal('plain', fromUtf8(await decrypt(fromB64(val('cipher').trim())))); }
  catch { showError('err', wrongPw()); }
});
bindCopy('copy', () => val('cipher'));
const pick = () => el<HTMLInputElement>('file').files?.[0];
el('fenc').addEventListener('click', async () => {
  showError('ferr', '');
  const f = pick();
  if (!f) return showError('ferr', T('noFile', 'Hãy chọn file trước.'));
  if (needPw('ferr')) return;
  const name = utf8(f.name);
  const body = new Uint8Array(2 + name.length + f.size) as Bytes;
  body[0] = name.length >> 8; body[1] = name.length & 255;
  body.set(name, 2); body.set(new Uint8Array(await f.arrayBuffer()), 2 + name.length);
  const out = await encrypt(body);
  downloadBlob(new Blob([out]), f.name + '.wftenc');
  el('fstat').textContent = `${f.name} · ${fmtBytes(f.size)} → ${fmtBytes(out.length)}`;
});
el('fdec').addEventListener('click', async () => {
  showError('ferr', '');
  const f = pick();
  if (!f) return showError('ferr', T('noFile', 'Hãy chọn file trước.'));
  if (needPw('ferr')) return;
  try {
    const body = await decrypt(new Uint8Array(await f.arrayBuffer()) as Bytes);
    const n = (body[0] << 8) | body[1];
    const name = fromUtf8(body.slice(2, 2 + n)) || 'decrypted';
    downloadBlob(new Blob([body.slice(2 + n)]), name);
    el('fstat').textContent = `${name} · ${fmtBytes(body.length - 2 - n)}`;
  } catch { showError('ferr', wrongPw()); }
});
