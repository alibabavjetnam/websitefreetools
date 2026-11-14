import { mountLayout } from '../layout';
import { $, escapeHtml, storage } from '../ui';
import { pageText } from '../i18n';
import { area, input, select, button, bindCopy, el, privacyNote, val, onChange } from '../lib/devkit';

mountLayout({ activeTool: 'email-signature' });
const T = pageText();
const F = ['name', 'title', 'company', 'phone', 'email', 'web', 'address', 'photo', 'fb', 'li', 'zalo', 'note'] as const;
type Data = Record<(typeof F)[number], string> & { tpl: string; color: string };
const st = storage<Partial<Data>>('email-signature', {});
const d0 = st.get();
const dv = (k: keyof Data, v: string) => (d0[k] as string | undefined) ?? v;

$('#tool-root').innerHTML = `
  <div class="workspace" style="margin-top:24px">
    <div class="panel">
      <div class="form-grid">
        ${input('name', T('name', 'Họ tên'), { value: dv('name', T('s.name', 'Nguyễn Minh Anh')) })}
        ${input('title', T('title', 'Chức danh'), { value: dv('title', T('s.title', 'Trưởng phòng Kinh doanh')) })}
        ${input('company', T('company', 'Công ty'), { value: dv('company', 'WFTools') })}
        ${input('phone', T('phone', 'Điện thoại'), { value: dv('phone', T('s.phone', '0912 345 678')) })}
        ${input('email', 'Email', { value: dv('email', 'minhanh@websitefreetools.com') })}
        ${input('web', 'Website', { value: dv('web', 'websitefreetools.com') })}
      </div>
      ${input('address', T('address', 'Địa chỉ'), { value: dv('address', T('s.address', '12 Lê Lợi, Quận 1, TP. Hồ Chí Minh')) })}
      ${input('photo', T('photo', 'Link ảnh đại diện / logo (https://…, không bắt buộc)'), { value: dv('photo', '') })}
      <div class="form-grid">
        ${input('fb', 'Facebook', { value: dv('fb', ''), ph: 'https://facebook.com/…' })}
        ${input('li', 'LinkedIn', { value: dv('li', ''), ph: 'https://linkedin.com/in/…' })}
        ${input('zalo', T('zalo', 'Zalo / WhatsApp'), { value: dv('zalo', '') })}
        ${select('tpl', T('tpl', 'Mẫu'), [['line', T('t.line', 'Đường kẻ dọc')], ['card', T('t.card', 'Thẻ có ảnh')], ['simple', T('t.simple', 'Tối giản')]], dv('tpl', 'line'))}
        ${input('color', T('color', 'Màu nhấn'), { type: 'color', value: dv('color', '#0d6efd') })}
      </div>
      ${area('note', T('note', 'Dòng ghi chú cuối (không bắt buộc)'), { rows: 2, mono: false, value: dv('note', '') })}
    </div>
    <div class="panel">
      <span class="field-label">${T('preview', 'Xem trước')}</span>
      <div id="prev" class="es-prev"></div>
      <div class="row">${button('copyRich', T('copyRich', 'Sao chép chữ ký (dán vào Gmail, Outlook)'), true)}${button('copyHtml', T('copyHtml', 'Sao chép mã HTML'))}</div>
      <p class="note">${T('how', 'Gmail: Cài đặt → Xem tất cả chế độ cài đặt → Chữ ký → Tạo mới → dán. Outlook: Cài đặt → Thư → Chữ ký → dán. Ảnh phải là đường link công khai (https), không dán được ảnh từ máy.')}</p>
    </div>
  </div>
  ${privacyNote()}
`;
const e = escapeHtml;
const link = (href: string, text: string, color: string) => `<a href="${e(href)}" style="color:${color};text-decoration:none">${e(text)}</a>`;
function html(): string {
  const v = Object.fromEntries([...F, 'tpl', 'color'].map((k) => [k, val(k).trim()])) as Data;
  st.set(v);
  const c = v.color, font = 'font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#333333';
  const web = v.web && (/^https?:/.test(v.web) ? v.web : 'https://' + v.web);
  const contact = [
    v.phone && `${T('l.phone', 'ĐT')}: ${link('tel:' + v.phone.replace(/[^\d+]/g, ''), v.phone, '#333333')}`,
    v.email && `Email: ${link('mailto:' + v.email, v.email, c)}`,
    v.web && `Web: ${link(web, v.web.replace(/^https?:\/\//, ''), c)}`,
    v.address && e(v.address),
  ].filter(Boolean);
  const social = [[v.fb, 'Facebook'], [v.li, 'LinkedIn'], [v.zalo && (/^\+?\d[\d\s]+$/.test(v.zalo) ? 'https://zalo.me/' + v.zalo.replace(/\D/g, '') : v.zalo), 'Zalo']].filter(([u]) => u).map(([u, n]) => link(u as string, n as string, c)).join(' &nbsp;·&nbsp; ');
  const nameBlock = `<div style="font-size:16px;font-weight:bold;color:${c}">${e(v.name)}</div>${v.title || v.company ? `<div style="color:#555555">${e([v.title, v.company].filter(Boolean).join(' · '))}</div>` : ''}`;
  const note = v.note ? `<div style="margin-top:8px;font-size:11px;color:#888888">${e(v.note)}</div>` : '';
  const photo = v.photo ? `<img src="${e(v.photo)}" width="80" height="80" alt="" style="display:block;border-radius:${v.tpl === 'card' ? '50%' : '6px'};object-fit:cover" />` : '';
  if (v.tpl === 'simple') return `<div style="${font}">${nameBlock}<div style="margin-top:4px">${contact.join('<br>')}</div>${social ? `<div style="margin-top:4px">${social}</div>` : ''}${note}</div>`;
  if (v.tpl === 'card') return `<table cellpadding="0" cellspacing="0" border="0" style="${font};border:1px solid #e3e6ea;border-radius:10px"><tr>${photo ? `<td style="padding:14px;vertical-align:middle">${photo}</td>` : ''}<td style="padding:14px 16px 14px ${photo ? 0 : 16}px;vertical-align:middle">${nameBlock}<div style="margin-top:6px">${contact.join('<br>')}</div>${social ? `<div style="margin-top:6px">${social}</div>` : ''}</td></tr></table>${note}`;
  return `<table cellpadding="0" cellspacing="0" border="0" style="${font}"><tr>${photo ? `<td style="padding-right:14px;vertical-align:top">${photo}</td>` : ''}<td style="border-left:3px solid ${c};padding-left:14px;vertical-align:top">${nameBlock}<div style="margin-top:6px">${contact.join('<br>')}</div>${social ? `<div style="margin-top:6px">${social}</div>` : ''}</td></tr></table>${note}`;
}
let out = '';
function run(): void { out = html(); el('prev').innerHTML = out; }
onChange([...F, 'tpl', 'color'], run, 120);
el('copyRich').addEventListener('click', async () => {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([out], { type: 'text/html' }), 'text/plain': new Blob([el('prev').innerText], { type: 'text/plain' }) })]);
    const { toast } = await import('../ui');
    toast(T('copied', 'Đã sao chép, hãy dán vào phần chữ ký email'));
  } catch {
    const r = document.createRange(); r.selectNodeContents(el('prev'));
    const s = getSelection(); s?.removeAllRanges(); s?.addRange(r); document.execCommand('copy'); s?.removeAllRanges();
  }
});
bindCopy('copyHtml', () => out);
run();
