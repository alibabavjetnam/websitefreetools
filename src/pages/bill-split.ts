import { mountLayout } from '../layout';
import { $, escapeHtml, fmtMoney, parseNumber, setupTabs, sampleMoney, fmtField } from '../ui';
import { pageText } from '../i18n';
import { input, button, check, bindCopy, el, privacyNote, val, checked, onChange } from '../lib/devkit';

mountLayout({ activeTool: 'bill-split' });
const T = pageText();

$('#tool-root').innerHTML = `
  <div class="tabs" role="tablist" style="margin-top:24px">
    <button type="button" role="tab" data-tab="even">${T('tab.even', 'Chia đều hoá đơn')}</button>
    <button type="button" role="tab" data-tab="group">${T('tab.group', 'Chi tiêu nhóm (ai trả bao nhiêu)')}</button>
  </div>
  <div class="tool-body">
    <div class="panel" data-panel="even">
      <div class="form-grid">
        ${input('total', T('total', 'Tổng hoá đơn'), { value: fmtField(sampleMoney(1250000)), attrs: 'inputmode="decimal"' })}
        ${input('people', T('people', 'Số người'), { type: 'number', value: '4', attrs: 'min="1" max="100"' })}
        ${input('tip', T('tip', 'Tiền tip / phí phục vụ (%)'), { type: 'number', value: '0', attrs: 'min="0" max="50" step="0.5"' })}
        ${input('tax', T('tax', 'Thuế (%) nếu chưa gồm'), { type: 'number', value: '0', attrs: 'min="0" max="30" step="0.5"' })}
        ${input('disc', T('disc', 'Giảm giá (số tiền)'), { value: '0', attrs: 'inputmode="decimal"' })}
      </div>
      ${check('round', T('round', 'Làm tròn lên số đẹp cho mỗi người'), true)}
      <div class="stat-grid" id="evenRes"></div>
    </div>
    <div class="panel" data-panel="group" hidden>
      <p class="note">${T('gHint', 'Mỗi dòng một khoản chi: tên người trả, số tiền, và (không bắt buộc) danh sách người dùng chung, ngăn bằng dấu phẩy. Bỏ trống phần thứ ba nghĩa là chia đều cho cả nhóm.')}</p>
      <label class="field"><span class="field-label">${T('members', 'Thành viên (ngăn bằng dấu phẩy)')}</span><input id="members" value="${escapeHtml(T('s.members', 'An, Bình, Chi, Dũng'))}" /></label>
      <label class="field"><span class="field-label">${T('expenses', 'Các khoản chi')}</span><textarea id="exp" rows="7">${escapeHtml(T('s.exp', 'An | 1200000 | \nBình | 450000 | An, Bình\nChi | 300000 | \nDũng | 160000 | Chi, Dũng'))}</textarea></label>
      <div id="grpRes"></div>
      <div class="row">${button('copy', T('copy', 'Sao chép kết quả để gửi nhóm'), true)}</div>
    </div>
  </div>
  ${privacyNote()}
`;
setupTabs($('#tool-root'));
const stat = (l: string, v: string, main = false) => `<div class="stat${main ? ' stat--main' : ''}"><span class="stat-label">${l}</span><span class="stat-value">${v}</span></div>`;
function even(): void {
  const total = parseNumber(val('total')) || 0, n = Math.max(1, Math.floor(Number(val('people')) || 1));
  const tax = total * (Number(val('tax')) || 0) / 100, tip = total * (Number(val('tip')) || 0) / 100, disc = parseNumber(val('disc')) || 0;
  const grand = Math.max(0, total + tax + tip - disc);
  let each = grand / n;
  const step = grand >= 100000 ? 1000 : grand >= 1000 ? 1 : 0.01;
  if (checked('round')) each = Math.ceil(each / step) * step;
  el('evenRes').innerHTML = stat(T('each', 'Mỗi người trả'), fmtMoney(each), true) + stat(T('grand', 'Tổng phải trả'), fmtMoney(grand)) + (tax ? stat(T('taxAmt', 'Tiền thuế'), fmtMoney(tax)) : '') + (tip ? stat(T('tipAmt', 'Tiền tip'), fmtMoney(tip)) : '') + (checked('round') && each * n - grand > 0.001 ? stat(T('extra', 'Dư sau khi làm tròn'), fmtMoney(each * n - grand)) : '');
}
let report = '';
function group(): void {
  const members = val('members').split(',').map((s) => s.trim()).filter(Boolean);
  const bal = new Map(members.map((m) => [m, 0]));
  const paid = new Map(members.map((m) => [m, 0]));
  const errs: string[] = [];
  let total = 0;
  val('exp').split('\n').forEach((line, i) => {
    if (!line.trim()) return;
    const [who, amt, share] = line.split(/[|\t]/).map((s) => (s ?? '').trim());
    const a = parseNumber(amt ?? '');
    if (!who || !(a > 0)) { errs.push(T('badLine', 'Dòng {n} chưa đúng dạng: Tên | Số tiền | Người dùng chung').replace('{n}', String(i + 1))); return; }
    if (!bal.has(who)) { members.push(who); bal.set(who, 0); paid.set(who, 0); }
    const users = share ? share.split(',').map((s) => s.trim()).filter(Boolean) : members;
    for (const u of users) if (!bal.has(u)) { members.push(u); bal.set(u, 0); paid.set(u, 0); }
    total += a;
    paid.set(who, (paid.get(who) ?? 0) + a);
    bal.set(who, (bal.get(who) ?? 0) + a);
    for (const u of users) bal.set(u, (bal.get(u) ?? 0) - a / users.length);
  });
  // Ghép người nợ với người được trả để số lần chuyển tiền ít nhất
  const deb = [...bal].filter(([, v]) => v < -0.5).map(([k, v]) => [k, -v] as [string, number]).sort((a, b) => b[1] - a[1]);
  const cre = [...bal].filter(([, v]) => v > 0.5).map(([k, v]) => [k, v] as [string, number]).sort((a, b) => b[1] - a[1]);
  const tx: [string, string, number][] = [];
  let i = 0, j = 0;
  while (i < deb.length && j < cre.length) {
    const x = Math.min(deb[i][1], cre[j][1]);
    tx.push([deb[i][0], cre[j][0], x]);
    deb[i][1] -= x; cre[j][1] -= x;
    if (deb[i][1] < 0.5) i++;
    if (cre[j][1] < 0.5) j++;
  }
  const rows = members.map((m) => `<tr><td>${escapeHtml(m)}</td><td>${fmtMoney(paid.get(m) ?? 0)}</td><td style="color:${(bal.get(m) ?? 0) >= 0 ? '#0e7a55' : '#b9000e'}">${fmtMoney(bal.get(m) ?? 0)}</td></tr>`).join('');
  const arrow = (a: string, b: string, x: number) => T('pays', '{a} chuyển cho {b}: {x}').replace('{a}', a).replace('{b}', b).replace('{x}', fmtMoney(x));
  el('grpRes').innerHTML = (errs.length ? `<p class="error">${errs.map(escapeHtml).join('<br>')}</p>` : '') +
    `<p><b>${T('sum', 'Tổng chi')}: ${fmtMoney(total)}</b></p><table class="data-table data-table--compact"><thead><tr><th>${T('col.who', 'Thành viên')}</th><th>${T('col.paid', 'Đã trả')}</th><th>${T('col.bal', 'Chênh lệch (+ được nhận lại)')}</th></tr></thead><tbody>${rows}</tbody></table>` +
    `<h2 class="panel-title">${T('settle', 'Cách thanh toán gọn nhất')}</h2>${tx.length ? `<ol>${tx.map(([a, b, x]) => `<li>${escapeHtml(arrow(a, b, x))}</li>`).join('')}</ol>` : `<p class="note">${T('even', 'Không ai nợ ai.')}</p>`}`;
  report = `${T('sum', 'Tổng chi')}: ${fmtMoney(total)}\n` + tx.map(([a, b, x]) => '• ' + arrow(a, b, x)).join('\n');
}
onChange(['total', 'people', 'tip', 'tax', 'disc', 'round'], even, 80);
onChange(['members', 'exp'], group, 150);
bindCopy('copy', () => report);
even(); group();
