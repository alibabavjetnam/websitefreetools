import { mountLayout } from '../layout';
import { $, escapeHtml } from '../ui';
import { pageText, localeTag } from '../i18n';
import { area, button, bindCopy, dk, el, errorBox, showError, privacyNote, val, onChange, fromB64, fromUtf8, utf8, toB64, input } from '../lib/devkit';

mountLayout({ activeTool: 'jwt-decode' });
const T = pageText();
const SAMPLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IldGVG9vbHMiLCJpYXQiOjE3NjMwMDAwMDAsImV4cCI6MTg5MzQ1NjAwMH0.nylTf9Vh7FbbocXM3E3noACVhpTgk5N0XvpttQJ7swY';

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px">
    ${area('in', T('token', 'Dán chuỗi JWT'), { rows: 5, value: SAMPLE })}
    ${errorBox('err')}
    <div class="workspace" style="margin-top:0">
      <div class="field"><span class="field-label">${T('header', 'Phần đầu (header)')}</span><pre class="output" id="h"></pre></div>
      <div class="field"><span class="field-label">${T('payload', 'Nội dung (payload)')}</span><pre class="output" id="p"></pre></div>
    </div>
    <div class="row">${button('copy', T('copyPayload', 'Sao chép payload'), true)}</div>
    <table class="data-table"><tbody id="claims"></tbody></table>
  </div>
  <div class="panel" style="margin-top:16px">
    <h2 class="panel-title">${T('verifyTitle', 'Kiểm tra chữ ký HS256/HS384/HS512')}</h2>
    ${input('secret', T('secret', 'Khoá bí mật (secret)'), { value: 'your-256-bit-secret', mono: true })}
    <p class="note" id="ver"></p>
  </div>
  ${privacyNote()}
`;
const CLAIMS: Record<string, string> = {
  iss: T('c.iss', 'Bên phát hành'), sub: T('c.sub', 'Chủ thể (người dùng)'), aud: T('c.aud', 'Bên nhận'), exp: T('c.exp', 'Hết hạn lúc'),
  nbf: T('c.nbf', 'Có hiệu lực từ'), iat: T('c.iat', 'Tạo lúc'), jti: T('c.jti', 'Mã định danh token'),
};
let parts: string[] = [];
let header: Record<string, unknown> = {};
function parse(): void {
  showError('err', '');
  el('h').textContent = ''; el('p').textContent = ''; el('claims').innerHTML = '';
  parts = val('in').trim().replace(/^Bearer\s+/i, '').split('.');
  if (parts.length < 2 || !parts[0]) { if (val('in').trim()) showError('err', T('bad', 'Không phải JWT: chuỗi phải có 3 phần ngăn bằng dấu chấm (xxx.yyy.zzz).')); return; }
  try {
    header = JSON.parse(fromUtf8(fromB64(parts[0])));
    const payload = JSON.parse(fromUtf8(fromB64(parts[1]))) as Record<string, unknown>;
    el('h').textContent = JSON.stringify(header, null, 2);
    el('p').textContent = JSON.stringify(payload, null, 2);
    const fmt = (n: number) => new Date(n * 1000).toLocaleString(localeTag());
    const now = Date.now() / 1000;
    el('claims').innerHTML = Object.entries(payload).filter(([k]) => CLAIMS[k]).map(([k, v]) => {
      let extra = '';
      if (typeof v === 'number' && ['exp', 'nbf', 'iat'].includes(k)) {
        extra = ` — ${fmt(v)}`;
        if (k === 'exp') extra += v < now ? ` <b class="error-text">${T('expired', '(đã hết hạn)')}</b>` : ` <b class="ok-text">${T('valid', '(còn hạn)')}</b>`;
      }
      return `<tr><th>${escapeHtml(k)}</th><td>${CLAIMS[k]}</td><td class="mono">${escapeHtml(String(v))}${extra}</td></tr>`;
    }).join('');
  } catch {
    showError('err', T('badJson', 'Phần header hoặc payload không giải mã được thành JSON. Có thể token bị cắt thiếu khi sao chép.'));
  }
  void verify();
}
async function verify(): Promise<void> {
  const out = el('ver');
  const alg = String(header.alg || '');
  const hash = ({ HS256: 'SHA-256', HS384: 'SHA-384', HS512: 'SHA-512' } as Record<string, string>)[alg];
  if (parts.length < 3) { out.textContent = ''; return; }
  if (!hash) { out.className = 'note'; out.textContent = T('algNo', 'Token dùng thuật toán {a}: chỉ kiểm tra được chữ ký HMAC (HS256/384/512) bằng khoá bí mật.').replace('{a}', alg || '?'); return; }
  const key = await crypto.subtle.importKey('raw', utf8(val('secret')), { name: 'HMAC', hash }, false, ['sign']);
  const sig = toB64(new Uint8Array(await crypto.subtle.sign('HMAC', key, utf8(parts[0] + '.' + parts[1]))), true);
  const ok = sig === parts[2];
  out.className = ok ? 'note ok-text' : 'note error-text';
  out.textContent = ok ? T('sigOk', 'Chữ ký hợp lệ với khoá này.') : T('sigBad', 'Chữ ký không khớp: khoá bí mật sai hoặc token đã bị sửa.');
}
onChange(['in'], parse, 80);
onChange(['secret'], () => void verify(), 120);
bindCopy('copy', () => el('p').textContent || '');
void dk;
parse();
