import { mountLayout } from '../layout';
import { $, copyText, downloadBlob } from '../ui';
import { encodeQr, qrToSvg } from '../lib/qr';
import { downloadPng } from '../lib/download';

mountLayout({ activeTool: 'utm' });

const PRESETS: { label: string; source: string; medium: string }[] = [
  { label: 'Facebook (bài viết)', source: 'facebook', medium: 'social' },
  { label: 'Facebook (quảng cáo)', source: 'facebook', medium: 'cpc' },
  { label: 'Zalo', source: 'zalo', medium: 'social' },
  { label: 'TikTok', source: 'tiktok', medium: 'social' },
  { label: 'Google Ads', source: 'google', medium: 'cpc' },
  { label: 'Email', source: 'newsletter', medium: 'email' },
  { label: 'Tờ rơi, mã QR in', source: 'print', medium: 'qr' },
];

$('#tool-root').innerHTML = `
  <div class="workspace tool-body">
    <form class="panel" id="utm-form" novalidate>
      <label class="field">
        <span class="field-label">Liên kết gốc *</span>
        <input id="url" type="url" value="https://websitefreetools.com/" placeholder="https://shopcuaban.vn/san-pham" autocomplete="off" />
      </label>
      <div>
        <span class="field-label">Mẫu nhanh theo kênh</span>
        <div class="row" id="presets">
          ${PRESETS.map((p, i) => `<button type="button" class="btn btn-sm" data-preset="${i}">${p.label}</button>`).join('')}
        </div>
      </div>
      <div class="form-grid">
        <label class="field"><span class="field-label">Nguồn (utm_source) *</span><input id="utm_source" type="text" value="facebook" placeholder="facebook, zalo, google" /></label>
        <label class="field"><span class="field-label">Kênh (utm_medium) *</span><input id="utm_medium" type="text" value="social" placeholder="social, cpc, email" /></label>
        <label class="field span-all"><span class="field-label">Tên chiến dịch (utm_campaign) *</span><input id="utm_campaign" type="text" value="khuyen-mai-thang-11" placeholder="sale-tet-2027" /></label>
        <label class="field"><span class="field-label">Từ khoá (utm_term)</span><input id="utm_term" type="text" placeholder="Không bắt buộc" /></label>
        <label class="field"><span class="field-label">Nội dung (utm_content)</span><input id="utm_content" type="text" placeholder="banner-a, nut-mua-ngay" /></label>
      </div>
      <label class="check"><input type="checkbox" id="normalize" checked /><span>Tự chuyển về chữ thường, bỏ dấu, thay khoảng trắng bằng dấu gạch</span></label>
    </form>

    <section class="preview" aria-live="polite">
      <span class="field-label">Liên kết đã gắn UTM</span>
      <pre class="output" id="result"></pre>
      <p class="error" id="utm-error" hidden></p>
      <div class="actions">
        <button type="button" class="btn btn-primary" id="copy">Sao chép liên kết</button>
        <button type="button" class="btn" id="qr-png">Tải mã QR (PNG)</button>
        <button type="button" class="btn" id="qr-svg">Tải mã QR (SVG)</button>
      </div>
      <div class="label-sheet utm-qr"><div class="code-frame code-frame--qr" id="qr"></div></div>
    </section>
  </div>
  <p class="note" style="margin-top:16px">Sau khi khách bấm vào liên kết, Google Analytics sẽ ghi nhận nguồn, kênh và chiến dịch tương ứng. Nên đặt tên thống nhất (ví dụ luôn viết <code>facebook</code> chứ không lúc <code>Facebook</code> lúc <code>fb</code>) để số liệu không bị tách rời.</p>
`;

const form = $<HTMLFormElement>('#utm-form');
const FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
let current = '';

function normalize(v: string): string {
  return v
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9\-_.]/g, '');
}

function render(): void {
  const errorBox = $('#utm-error');
  const rawUrl = $<HTMLInputElement>('#url').value.trim();
  const doNormalize = $<HTMLInputElement>('#normalize').checked;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    if (!rawUrl || !url.hostname.includes('.')) throw new Error();
  } catch {
    errorBox.textContent = 'Liên kết gốc chưa hợp lệ, ví dụ: https://shopcuaban.vn/san-pham';
    errorBox.hidden = false;
    current = '';
    $('#result').textContent = '';
    $('#qr').innerHTML = '';
    return;
  }
  const missing: string[] = [];
  for (const f of FIELDS) {
    const raw = $<HTMLInputElement>(`#${f}`).value;
    const v = doNormalize ? normalize(raw) : raw.trim();
    if (v) url.searchParams.set(f, v);
    else url.searchParams.delete(f);
    if (!v && (f === 'utm_source' || f === 'utm_medium' || f === 'utm_campaign')) missing.push(f);
  }
  current = url.toString();
  $('#result').textContent = current;
  errorBox.textContent = missing.length ? `Nên điền thêm: ${missing.join(', ')} để báo cáo đầy đủ.` : '';
  errorBox.hidden = !missing.length;
  $('#qr').innerHTML = qrToSvg(encodeQr(current, 'M'), { px: 240 });
}

$('#presets').addEventListener('click', (e) => {
  const i = (e.target as HTMLElement).closest<HTMLElement>('[data-preset]')?.dataset.preset;
  if (i === undefined) return;
  const p = PRESETS[Number(i)];
  $<HTMLInputElement>('#utm_source').value = p.source;
  $<HTMLInputElement>('#utm_medium').value = p.medium;
  render();
});
$('#copy').addEventListener('click', () => current && copyText(current, 'Đã sao chép liên kết'));
$('#qr-svg').addEventListener('click', () => {
  if (!current) return;
  downloadBlob(new Blob([qrToSvg(encodeQr(current, 'M'), { px: 1024 })], { type: 'image/svg+xml' }), 'qr-utm.svg');
});
$('#qr-png').addEventListener('click', async () => {
  if (current) await downloadPng(qrToSvg(encodeQr(current, 'M'), { px: 1024 }), 'qr-utm.png', 1024, 1024);
});
form.addEventListener('input', render);
form.addEventListener('submit', (e) => e.preventDefault());
render();
