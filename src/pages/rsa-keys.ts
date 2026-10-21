import { mountLayout } from '../layout';
import { $, copyText, downloadBlob, toast } from '../ui';

mountLayout({ activeTool: 'rsa-keys' });

const root = $('#tool-root');
root.innerHTML = `
  <div class="panel code-toolbar code-toolbar--wrap">
    <label class="field field--inline"><span class="field-label">Độ dài khoá</span>
      <select id="bits"><option value="2048">2048 bit (phổ biến)</option><option value="3072">3072 bit</option><option value="4096">4096 bit (an toàn hơn, chậm hơn)</option></select>
    </label>
    <label class="field field--inline"><span class="field-label">Mục đích</span>
      <select id="use"><option value="enc">Mã hoá dữ liệu (RSA-OAEP)</option><option value="sig">Ký số (RSASSA-PKCS1-v1_5)</option></select>
    </label>
    <div class="actions"><button type="button" class="btn btn-primary" id="run">Tạo cặp khoá</button></div>
  </div>
  <p class="error" id="err" hidden></p>
  <div class="workspace code-workspace" id="result" hidden>
    <div class="field">
      <span class="field-label">Khoá công khai (public key)<span class="key-hint"> — chia sẻ cho người khác</span></span>
      <textarea id="pub" class="mono code-area" rows="14" readonly spellcheck="false"></textarea>
      <div class="actions"><button type="button" class="btn btn-sm" data-copy="pub">Sao chép</button><button type="button" class="btn btn-sm" data-dl="pub">Tải .pem</button></div>
    </div>
    <div class="field">
      <span class="field-label">Khoá bí mật (private key)<span class="key-hint key-hint--warn"> — GIỮ KÍN, không gửi cho ai</span></span>
      <textarea id="priv" class="mono code-area" rows="14" readonly spellcheck="false"></textarea>
      <div class="actions"><button type="button" class="btn btn-sm" data-copy="priv">Sao chép</button><button type="button" class="btn btn-sm" data-dl="priv">Tải .pem</button></div>
    </div>
  </div>
  <p class="note">Khoá được tạo ngay trên trình duyệt bằng Web Crypto của máy bạn, <b>không gửi lên máy chủ</b>. Khoá bí mật dùng để giải mã hoặc ký; hãy lưu nơi an toàn và không chia sẻ. Khoá công khai dùng để mã hoá hoặc kiểm tra chữ ký, có thể chia sẻ công khai. Định dạng PEM: public theo chuẩn SPKI, private theo chuẩn PKCS#8.</p>
`;

const showErr = (msg: string) => {
  $('#err').textContent = msg;
  $('#err').hidden = !msg;
};

/** DER (ArrayBuffer) -> chuỗi PEM với nhãn và xuống dòng mỗi 64 ký tự */
function toPem(der: ArrayBuffer, label: string): string {
  const bytes = new Uint8Array(der);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin).replace(/(.{64})/g, '$1\n').replace(/\n$/, '');
  return `-----BEGIN ${label}-----\n${b64}\n-----END ${label}-----\n`;
}

let keys: { pub: string; priv: string } | null = null;

async function run(): Promise<void> {
  showErr('');
  const btn = $<HTMLButtonElement>('#run');
  btn.disabled = true;
  btn.textContent = 'Đang tạo khoá…';
  try {
    const bits = Number($<HTMLSelectElement>('#bits').value);
    const enc = $<HTMLSelectElement>('#use').value === 'enc';
    const algo = enc
      ? { name: 'RSA-OAEP', modulusLength: bits, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }
      : { name: 'RSASSA-PKCS1-v1_5', modulusLength: bits, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' };
    const usages: KeyUsage[] = enc ? ['encrypt', 'decrypt'] : ['sign', 'verify'];
    const pair = (await crypto.subtle.generateKey(algo, true, usages)) as CryptoKeyPair;
    const [spki, pkcs8] = await Promise.all([
      crypto.subtle.exportKey('spki', pair.publicKey),
      crypto.subtle.exportKey('pkcs8', pair.privateKey),
    ]);
    keys = { pub: toPem(spki, 'PUBLIC KEY'), priv: toPem(pkcs8, 'PRIVATE KEY') };
    $<HTMLTextAreaElement>('#pub').value = keys.pub;
    $<HTMLTextAreaElement>('#priv').value = keys.priv;
    $('#result').hidden = false;
    toast(`Đã tạo cặp khoá RSA ${bits} bit`);
  } catch (e) {
    showErr(`Không tạo được khoá: ${(e as Error).message}. Trình duyệt cần hỗ trợ Web Crypto (dùng Chrome, Edge, Firefox, Safari bản mới).`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Tạo cặp khoá';
  }
}

$('#run').addEventListener('click', () => void run());
root.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-copy],[data-dl]');
  if (!b || !keys) return;
  const which = (b.dataset.copy ?? b.dataset.dl) as 'pub' | 'priv';
  const text = which === 'pub' ? keys.pub : keys.priv;
  if (b.dataset.copy) void copyText(text);
  else {
    downloadBlob(new Blob([text], { type: 'application/x-pem-file' }), which === 'pub' ? 'public_key.pem' : 'private_key.pem');
    toast('Đã tải file .pem');
  }
});
