import { mountLayout } from '../layout';
import { $, escapeHtml } from '../ui';
import { pageText } from '../i18n';
import { input, button, bindCopy, el, privacyNote, val, setVal, onChange, showError, errorBox } from '../lib/devkit';

mountLayout({ activeTool: 'url-parser' });
const T = pageText();

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px">
    ${input('url', T('url', 'Dán địa chỉ URL'), { mono: true, value: 'https://user:pass@shop.example.com:8443/products/qr-code?utm_source=facebook&utm_medium=cpc&color=xanh%20d%C6%B0%C6%A1ng&id=42#reviews' })}
    ${errorBox('err')}
    <table class="data-table"><tbody id="parts"></tbody></table>
  </div>
  <div class="panel" style="margin-top:16px">
    <h2 class="panel-title">${T('params', 'Tham số truy vấn')} <span class="note" id="pcount"></span></h2>
    <table class="data-table data-table--compact"><thead><tr><th>${T('key', 'Tên')}</th><th>${T('value', 'Giá trị (đã giải mã)')}</th><th></th></tr></thead><tbody id="params"></tbody></table>
    <div class="row">${button('add', T('add', 'Thêm tham số'))}${button('strip', T('strip', 'Xoá tham số theo dõi (utm, fbclid, gclid)'))}</div>
    ${input('out', T('rebuilt', 'URL sau khi sửa'), { mono: true, attrs: 'readonly' })}
    <div class="row">${button('copy', T('copy', 'Sao chép URL'), true)}</div>
  </div>
  ${privacyNote()}
`;
let u: URL | null = null;
const TRACK = /^(utm_\w+|fbclid|gclid|gbraid|wbraid|msclkid|yclid|igshid|mc_cid|mc_eid|_hsenc|_hsmi|ref_src|si)$/i;
function render(): void {
  if (!u) return;
  const rows: [string, string][] = [[T('p.protocol', 'Giao thức'), u.protocol.replace(':', '')], [T('p.host', 'Tên miền'), u.hostname], [T('p.port', 'Cổng'), u.port || T('default', '(mặc định)')], [T('p.path', 'Đường dẫn'), decodeURIComponent(u.pathname)], [T('p.hash', 'Neo (#)'), u.hash.slice(1) || '—'], [T('p.origin', 'Gốc (origin)'), u.origin]];
  if (u.username) rows.splice(1, 0, [T('p.user', 'Tài khoản'), `${u.username}${u.password ? ':' + '•'.repeat(u.password.length) : ''}`]);
  el('parts').innerHTML = rows.map(([k, v]) => `<tr><th style="width:30%">${k}</th><td class="mono" style="word-break:break-all">${escapeHtml(v)}</td></tr>`).join('');
  const ps = [...u.searchParams.entries()];
  el('pcount').textContent = `(${ps.length})`;
  el('params').innerHTML = ps.map(([k, v], i) => `<tr><td><input class="mono" data-k="${i}" value="${escapeHtml(k)}" /></td><td><input class="mono" data-v="${i}" value="${escapeHtml(v)}" /></td><td><button type="button" class="btn btn-sm" data-del="${i}" aria-label="${T('del', 'Xoá')}">✕</button></td></tr>`).join('');
  setVal('out', u.toString());
}
function parse(): void {
  showError('err', '');
  const s = val('url').trim();
  try { u = new URL(/^[a-z][\w+.-]*:/i.test(s) ? s : 'https://' + s); render(); }
  catch { u = null; el('parts').innerHTML = ''; el('params').innerHTML = ''; showError('err', T('bad', 'Không đọc được URL. Kiểm tra lại tên miền có dấu chấm và không chứa khoảng trắng.')); }
}
function rebuild(): void {
  if (!u) return;
  const sp = new URLSearchParams();
  el('params').querySelectorAll<HTMLInputElement>('[data-k]').forEach((k) => {
    const v = el('params').querySelector<HTMLInputElement>(`[data-v="${k.dataset.k}"]`);
    if (k.value) sp.append(k.value, v?.value ?? '');
  });
  u.search = sp.toString();
  setVal('out', u.toString());
}
el('params').addEventListener('input', rebuild);
el('params').addEventListener('click', (e) => {
  const d = (e.target as HTMLElement).closest<HTMLElement>('[data-del]')?.dataset.del;
  if (d == null || !u) return;
  const ps = [...u.searchParams.entries()].filter((_, i) => i !== Number(d));
  u.search = new URLSearchParams(ps).toString();
  render();
});
el('add').addEventListener('click', () => { if (u) { u.searchParams.append('key', 'value'); render(); } });
el('strip').addEventListener('click', () => { if (u) { for (const k of [...u.searchParams.keys()]) if (TRACK.test(k)) u.searchParams.delete(k); render(); } });
onChange(['url'], parse, 120);
bindCopy('copy', () => val('out'));
parse();
