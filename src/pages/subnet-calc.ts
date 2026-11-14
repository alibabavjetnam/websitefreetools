import { mountLayout } from '../layout';
import { $, escapeHtml, fmtInt, setupTabs } from '../ui';
import { pageText } from '../i18n';
import { input, select, bindCopy, button, el, privacyNote, val, onChange, showError, errorBox } from '../lib/devkit';
import { parseCidr4, subnet4, split4, expand6, full6, short6, subnet6 } from '../calc/subnet';

mountLayout({ activeTool: 'subnet-calc' });
const T = pageText();

$('#tool-root').innerHTML = `
  <div class="tabs" role="tablist" style="margin-top:24px">
    <button type="button" role="tab" data-tab="v4">IPv4</button>
    <button type="button" role="tab" data-tab="v6">IPv6</button>
  </div>
  <div class="tool-body">
    <div class="panel" data-panel="v4">
      ${input('ip4', T('ip4', 'Địa chỉ IP và prefix (CIDR) hoặc subnet mask'), { mono: true, value: '192.168.1.130/26', ph: '10.0.0.5/24 · 192.168.1.10 255.255.255.0' })}
      ${errorBox('err4')}
      <table class="data-table"><tbody id="res4"></tbody></table>
      <div class="row">${button('copy4', T('copy', 'Sao chép kết quả'))}</div>
      ${select('split', T('split', 'Chia nhỏ thành các mạng'), Array.from({ length: 33 }, (_, i) => [String(i), '/' + i] as [string, string]), '28')}
      <div id="subs" class="mono" style="columns:3 180px;font-size:.875rem"></div>
    </div>
    <div class="panel" data-panel="v6" hidden>
      ${input('ip6', T('ip6', 'Địa chỉ IPv6 / prefix'), { mono: true, value: '2001:db8:abcd:12::1/64' })}
      ${errorBox('err6')}
      <table class="data-table"><tbody id="res6"></tbody></table>
    </div>
  </div>
  ${privacyNote()}
`;
setupTabs($('#tool-root'));
const PRIV: Record<string, string> = { private: T('t.private', 'IP nội bộ (mạng LAN)'), public: T('t.public', 'IP công cộng (Internet)'), loopback: T('t.loop', 'Địa chỉ máy cục bộ (loopback)'), linklocal: T('t.link', 'Tự cấp (link-local)'), cgnat: T('t.cgnat', 'Dùng chung của nhà mạng (CGNAT)'), multicast: T('t.multi', 'Multicast / dành riêng') };
let lines4: [string, string][] = [];
const tr = (rows: [string, string][]) => rows.map(([k, v]) => `<tr><th style="width:40%">${k}</th><td class="mono">${escapeHtml(v)}</td></tr>`).join('');
function v4(): void {
  showError('err4', '');
  try {
    const { ip, prefix } = parseCidr4(val('ip4'));
    const r = subnet4(ip, prefix);
    lines4 = [
      [T('r.net', 'Địa chỉ mạng'), `${r.network}/${r.prefix}`], [T('r.mask', 'Subnet mask'), r.mask], [T('r.wild', 'Wildcard mask'), r.wildcard],
      [T('r.first', 'IP dùng được đầu tiên'), r.first], [T('r.last', 'IP dùng được cuối cùng'), r.last], [T('r.bc', 'Địa chỉ quảng bá (broadcast)'), r.broadcast],
      [T('r.hosts', 'Số máy dùng được'), fmtInt(r.hosts)], [T('r.total', 'Tổng số địa chỉ'), fmtInt(r.total)], [T('r.class', 'Lớp mạng'), r.cls], [T('r.type', 'Loại'), PRIV[r.priv]], [T('r.bin', 'Dạng nhị phân'), r.bin],
    ];
    el('res4').innerHTML = tr(lines4);
    const np = Number(val('split'));
    const subs = split4(ip, prefix, np);
    el('subs').innerHTML = np < prefix ? `<p class="note">${T('splitSmall', 'Chọn prefix lớn hơn /{p} để chia nhỏ.').replace('{p}', String(prefix))}</p>` : subs.map((s) => `<div>${s}</div>`).join('') + (2 ** (np - prefix) > subs.length ? `<p class="note">${T('more', '… và còn {n} mạng nữa').replace('{n}', fmtInt(2 ** (np - prefix) - subs.length))}</p>` : '');
  } catch { el('res4').innerHTML = ''; el('subs').innerHTML = ''; showError('err4', T('bad4', 'Địa chỉ chưa đúng. Ví dụ hợp lệ: 192.168.1.10/24 hoặc 10.0.0.1 255.255.0.0 (mỗi phần từ 0 đến 255, prefix từ 0 đến 32).')); }
}
function v6(): void {
  showError('err6', '');
  try {
    const [a, p] = val('ip6').split('/');
    const prefix = p === undefined ? 64 : Number(p);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 128) throw new Error('p');
    const v = expand6(a);
    const r = subnet6(v, prefix);
    el('res6').innerHTML = tr([[T('r.short', 'Dạng rút gọn'), short6(v)], [T('r.full', 'Dạng đầy đủ'), full6(v)], [T('r.net', 'Địa chỉ mạng'), `${r.network}/${prefix}`], [T('r.range', 'Dải địa chỉ'), `${r.network} – ${r.last}`], [T('r.total', 'Tổng số địa chỉ'), r.total.toLocaleString()], [T('r.n64', 'Số mạng /64 bên trong'), prefix <= 64 ? (1n << BigInt(64 - prefix)).toLocaleString() : '—']]);
  } catch { el('res6').innerHTML = ''; showError('err6', T('bad6', 'Địa chỉ IPv6 chưa đúng. Ví dụ: 2001:db8::1/64 (8 nhóm hex, dùng :: một lần để thay chuỗi số 0).')); }
}
onChange(['ip4', 'split'], v4, 100);
onChange(['ip6'], v6, 100);
bindCopy('copy4', () => lines4.map(([k, v]) => `${k}: ${v}`).join('\n'));
v4(); v6();
