import { mountLayout } from '../layout';
import { $, copyText, downloadBlob, toast } from '../ui';
import { pageText, localeTag } from '../i18n';

mountLayout({ activeTool: 'rsa-keys' });
const T = pageText();
const LOCALE = localeTag();

const root = $('#tool-root');
root.innerHTML = `
  <div class="panel code-toolbar code-toolbar--wrap">
    <label class="field field--inline"><span class="field-label">${T('keyLen','Độ dài khoá')}</span>
      <select id="bits"><option value="2048">${T('bits.2048','2048 bit (phổ biến)')}</option><option value="3072">3072 bit</option><option value="4096">${T('bits.4096','4096 bit (an toàn hơn, chậm hơn)')}</option></select>
    </label>
    <div class="actions">
      <button type="button" class="btn btn-primary" id="run">${T('gen','Tạo cặp khoá mới')}</button>
      <button type="button" class="btn" id="apply">${T('apply','Dùng cặp khoá đã dán')}</button>
    </div>
  </div>
  <p class="error" id="err" hidden></p>
  <p class="ok-text" id="ok" hidden></p>
  <div class="workspace code-workspace">
    <div class="field">
      <span class="field-label">${T('pubKey','Khoá công khai (public key)')}<span class="key-hint"> ${T('pubKeyHint','— để mã hoá, chia sẻ được')}</span></span>
      <textarea id="pub" class="mono code-area" rows="12" spellcheck="false" placeholder="${T('pubPh','Bấm Tạo cặp khoá mới hoặc dán khoá công khai dạng PEM (-----BEGIN PUBLIC KEY-----) vào đây rồi bấm Dùng cặp khoá đã dán.')}"></textarea>
      <div class="actions"><button type="button" class="btn btn-sm" data-copy="pub">${T('copy','Sao chép')}</button><button type="button" class="btn btn-sm" data-dl="pub">${T('dlPem','Tải .pem')}</button></div>
    </div>
    <div class="field">
      <span class="field-label">${T('privKey','Khoá bí mật (private key)')}<span class="key-hint key-hint--warn"> ${T('privKeyHint','— để giải mã, GIỮ KÍN')}</span></span>
      <textarea id="priv" class="mono code-area" rows="12" spellcheck="false" placeholder="${T('privPh','Khoá bí mật dạng PEM (-----BEGIN PRIVATE KEY-----). Cần có khoá này mới giải mã được.')}"></textarea>
      <div class="actions"><button type="button" class="btn btn-sm" data-copy="priv">${T('copy','Sao chép')}</button><button type="button" class="btn btn-sm" data-dl="priv">${T('dlPem','Tải .pem')}</button></div>
    </div>
  </div>

  <section class="panel crypto-panel">
    <div class="panel-title">${T('cryptoTitle','Mã hoá & giải mã')}</div>
    <p class="note crypto-status" id="status" aria-live="polite">${T('status.none','Hãy tạo hoặc dán cặp khoá ở trên. Có khoá công khai là mã hoá được, có khoá bí mật là giải mã được.')}</p>
    <div class="workspace code-workspace">
      <label class="field"><span class="field-label">${T('plainLabel','Văn bản (chữ gốc)')}</span><textarea id="plain" class="code-area" rows="10" spellcheck="false" placeholder="${T('plainPh','Nhập văn bản ở đây, chuỗi mã hoá sẽ tự hiện bên phải.')}"></textarea></label>
      <label class="field"><span class="field-label">${T('cipherLabel','Chuỗi đã mã hoá')}</span><textarea id="cipher" class="mono code-area" rows="10" spellcheck="false" placeholder="${T('cipherPh','Hoặc dán chuỗi đã mã hoá vào đây để tự giải mã sang văn bản.')}"></textarea></label>
    </div>
    <div class="actions">
      <button type="button" class="btn" data-copy="cipher">${T('copyCipher','Sao chép chuỗi mã hoá')}</button>
      <button type="button" class="btn" data-copy="plain">${T('copyPlain','Sao chép văn bản')}</button>
    </div>
  </section>

  <p class="note">${T('note','Mọi thao tác chạy ngay trên trình duyệt bằng Web Crypto, <b>không gửi đi đâu</b>. Vì RSA chỉ mã hoá trực tiếp được dữ liệu rất ngắn, công cụ dùng cách <b>mã hoá lai</b>: sinh một khoá AES ngẫu nhiên để mã hoá văn bản, rồi dùng RSA bọc khoá AES đó — nhờ vậy văn bản dài bao nhiêu cũng mã hoá được. Người nhận cần <b>khoá bí mật</b> tương ứng để giải mã. Khoá công khai (SPKI) có thể chia sẻ; khoá bí mật (PKCS#8) phải giữ kín.')}</p>
`;

const showErr = (msg: string) => { $('#err').textContent = msg; $('#err').hidden = !msg; };
const showOk = (msg: string) => { $('#ok').textContent = msg; $('#ok').hidden = !msg; };
const setStatus = (msg: string, isErr = false) => {
  const el = $('#status');
  el.textContent = msg;
  el.classList.toggle('crypto-status--err', isErr);
};

/* ---------- Base64 ---------- */

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64.replace(/\s+/g, ''));
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
}

/* ---------- PEM ---------- */

function toPem(der: ArrayBuffer, label: string): string {
  const b64 = bufToB64(der).replace(/(.{64})/g, '$1\n').replace(/\n$/, '');
  return `-----BEGIN ${label}-----\n${b64}\n-----END ${label}-----\n`;
}
const pemBody = (pem: string): string => pem.replace(/-----[^-]+-----/g, '').replace(/[^A-Za-z0-9+/=]/g, '');

/* ---------- Khoá ---------- */

const ALGO = { name: 'RSA-OAEP', hash: 'SHA-256' } as const;
const keys: { pub: CryptoKey | null; priv: CryptoKey | null } = { pub: null, priv: null };

function updateStatus(): void {
  if (keys.pub && keys.priv) setStatus(T('status.ready','Đã sẵn sàng: nhập văn bản để mã hoá, hoặc dán chuỗi mã hoá để giải mã.'));
  else if (keys.pub) setStatus(T('status.pubOnly','Có khoá công khai: mã hoá được. Thiếu khoá bí mật nên chưa giải mã được.'));
  else if (keys.priv) setStatus(T('status.privOnly','Có khoá bí mật: giải mã được. Thiếu khoá công khai nên chưa mã hoá được.'));
  else setStatus(T('status.none','Hãy tạo hoặc dán cặp khoá ở trên. Có khoá công khai là mã hoá được, có khoá bí mật là giải mã được.'));
}

async function run(): Promise<void> {
  showErr('');
  showOk('');
  const btn = $<HTMLButtonElement>('#run');
  btn.disabled = true;
  btn.textContent = T('generating','Đang tạo khoá…');
  try {
    const bits = Number($<HTMLSelectElement>('#bits').value);
    const pair = (await crypto.subtle.generateKey(
      { ...ALGO, modulusLength: bits, publicExponent: new Uint8Array([1, 0, 1]) },
      true,
      ['encrypt', 'decrypt'],
    )) as CryptoKeyPair;
    const [spki, pkcs8] = await Promise.all([
      crypto.subtle.exportKey('spki', pair.publicKey),
      crypto.subtle.exportKey('pkcs8', pair.privateKey),
    ]);
    $<HTMLTextAreaElement>('#pub').value = toPem(spki, 'PUBLIC KEY');
    $<HTMLTextAreaElement>('#priv').value = toPem(pkcs8, 'PRIVATE KEY');
    keys.pub = pair.publicKey;
    keys.priv = pair.privateKey;
    updateStatus();
    await refreshFrom('plain');
    toast(`${T('toast.gen','Đã tạo cặp khoá RSA')} ${bits} bit`);
  } catch (e) {
    showErr(`${T('err.gen','Không tạo được khoá')}: ${(e as Error).message}. ${T('err.genHint','Trình duyệt cần hỗ trợ Web Crypto (dùng Chrome, Edge, Firefox, Safari bản mới).')}`);
  } finally {
    btn.disabled = false;
    btn.textContent = T('gen','Tạo cặp khoá mới');
  }
}

async function applyKeys(): Promise<void> {
  showErr('');
  showOk('');
  const pubPem = $<HTMLTextAreaElement>('#pub').value.trim();
  const privPem = $<HTMLTextAreaElement>('#priv').value.trim();
  if (!pubPem && !privPem) { showErr(T('err.pastePem','Hãy dán khoá công khai hoặc khoá bí mật dạng PEM vào ô ở trên.')); return; }
  keys.pub = null;
  keys.priv = null;
  const done: string[] = [];
  try {
    if (pubPem) {
      keys.pub = await crypto.subtle.importKey('spki', b64ToBuf(pemBody(pubPem)), ALGO, true, ['encrypt']);
      done.push(T('word.pub','khoá công khai'));
    }
  } catch {
    showErr(T('err.pubRead','Khoá công khai không đọc được. Cần đúng định dạng PEM công khai (-----BEGIN PUBLIC KEY-----, chuẩn SPKI).'));
    return;
  }
  try {
    if (privPem) {
      keys.priv = await crypto.subtle.importKey('pkcs8', b64ToBuf(pemBody(privPem)), ALGO, true, ['decrypt']);
      done.push(T('word.priv','khoá bí mật'));
    }
  } catch {
    showErr(T('err.privRead','Khoá bí mật không đọc được. Cần đúng định dạng PEM bí mật (-----BEGIN PRIVATE KEY-----, chuẩn PKCS#8).'));
    return;
  }
  showOk(`${T('ok.loaded','Đã nạp')} ${done.join(' ' + T('and','và') + ' ')}.`);
  updateStatus();
  // Nếu đang có nội dung, thử xử lý lại
  if ($<HTMLTextAreaElement>('#plain').value) await refreshFrom('plain');
  else if ($<HTMLTextAreaElement>('#cipher').value) await refreshFrom('cipher');
}

/* ---------- Mã hoá lai (AES-GCM + RSA-OAEP bọc khoá) ---------- */

const FORMAT = 'WFRSA1';

async function encryptText(pub: CryptoKey, text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, data);
  const rawAes = await crypto.subtle.exportKey('raw', aes);
  const wrapped = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pub, rawAes);
  // Chia 64 ký tự mỗi dòng cho dễ nhìn, dễ sao chép
  const blob = `${FORMAT}.${bufToB64(wrapped)}.${bufToB64(iv.buffer as ArrayBuffer)}.${bufToB64(ct)}`;
  return blob.replace(/(.{76})/g, '$1\n');
}

async function decryptText(priv: CryptoKey, blob: string): Promise<string> {
  const parts = blob.replace(/\s+/g, '').split('.');
  if (parts.length !== 4 || parts[0] !== FORMAT) {
    throw new Error('format');
  }
  const wrapped = b64ToBuf(parts[1]);
  const iv = b64ToBuf(parts[2]);
  const ct = b64ToBuf(parts[3]);
  const rawAes = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, priv, wrapped);
  const aes = await crypto.subtle.importKey('raw', rawAes, { name: 'AES-GCM' }, false, ['decrypt']);
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aes, ct);
  return new TextDecoder().decode(data);
}

/* ---------- Liên kết hai ô văn bản ↔ mã hoá ---------- */

let seq = 0; // bỏ kết quả cũ nếu người dùng gõ tiếp
let timer = 0;

async function refreshFrom(source: 'plain' | 'cipher'): Promise<void> {
  const my = ++seq;
  const plain = $<HTMLTextAreaElement>('#plain');
  const cipher = $<HTMLTextAreaElement>('#cipher');
  if (source === 'plain') {
    const text = plain.value;
    if (!text) { cipher.value = ''; updateStatus(); return; }
    if (!keys.pub) { setStatus(T('status.noPub','Chưa có khoá công khai nên không mã hoá được. Hãy tạo hoặc dán khoá công khai.'), true); return; }
    try {
      const out = await encryptText(keys.pub, text);
      if (my === seq) { cipher.value = out; setStatus(`${T('status.encrypted','Đã mã hoá')} ${text.length.toLocaleString(LOCALE)} ${T('chars','ký tự.')}`); }
    } catch (e) {
      if (my === seq) setStatus(`${T('status.encErr','Lỗi khi mã hoá')}: ${(e as Error).message}`, true);
    }
  } else {
    const blob = cipher.value;
    if (!blob.trim()) { plain.value = ''; updateStatus(); return; }
    if (!keys.priv) { setStatus(T('status.noPriv','Chưa có khoá bí mật nên không giải mã được. Hãy dán khoá bí mật tương ứng.'), true); return; }
    try {
      const out = await decryptText(keys.priv, blob);
      if (my === seq) { plain.value = out; setStatus(T('status.decrypted','Đã giải mã xong.')); }
    } catch (e) {
      if (my !== seq) return;
      const msg = (e as Error).message;
      if (msg === 'format') setStatus(T('status.badFormat','Chuỗi mã hoá không đúng định dạng của công cụ này.'), true);
      else setStatus(T('status.decErr','Không giải mã được: sai khoá bí mật hoặc chuỗi mã hoá đã bị sửa, thiếu.'), true);
    }
  }
}

const debounce = (source: 'plain' | 'cipher') => {
  clearTimeout(timer);
  timer = window.setTimeout(() => void refreshFrom(source), 200);
};

$('#plain').addEventListener('input', () => debounce('plain'));
$('#cipher').addEventListener('input', () => debounce('cipher'));

$('#run').addEventListener('click', () => void run());
$('#apply').addEventListener('click', () => void applyKeys());

root.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-copy],[data-dl]');
  if (!b) return;
  const id = (b.dataset.copy ?? b.dataset.dl) as string;
  const text = $<HTMLTextAreaElement>(`#${id}`).value;
  if (!text) return;
  if (b.dataset.copy) void copyText(text);
  else {
    downloadBlob(new Blob([text], { type: 'application/x-pem-file' }), id === 'pub' ? 'public_key.pem' : 'private_key.pem');
    toast(T('toast.dlPem','Đã tải file .pem'));
  }
});
