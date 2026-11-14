import { mountLayout } from '../layout';
import { $, fmtInt, fmtVnd, parseNumber, setupTabs } from '../ui';
import { pageText } from '../i18n';
import { input, select, el, val, onChange } from '../lib/devkit';
import { TARIFFS, calcBill, kwhForMoney } from '../calc/electricity';

mountLayout({ activeTool: 'electricity-bill' });
const T = pageText();
const APPLIANCES: [string, string, number, number][] = [
  ['ac', T('a.ac', 'Điều hoà 1 HP (9.000 BTU)'), 800, 8], ['fridge', T('a.fridge', 'Tủ lạnh'), 120, 24], ['wash', T('a.wash', 'Máy giặt'), 500, 1], ['heater', T('a.heater', 'Bình nóng lạnh'), 2500, 0.5],
  ['tv', T('a.tv', 'Tivi 50 inch'), 100, 5], ['fan', T('a.fan', 'Quạt'), 50, 8], ['light', T('a.light', 'Đèn LED (10 bóng)'), 100, 6], ['rice', T('a.rice', 'Nồi cơm điện'), 600, 1],
  ['pc', T('a.pc', 'Máy tính để bàn'), 250, 6], ['iron', T('a.iron', 'Bàn là'), 1000, 0.3], ['cook', T('a.cook', 'Bếp từ'), 2000, 1], ['pump', T('a.pump', 'Máy bơm nước'), 750, 0.5],
];

$('#tool-root').innerHTML = `
  <p class="note" style="margin-top:12px"><b>${T('vnOnly', 'Dành cho Việt Nam.')}</b> ${T('vnNote', 'Tính theo biểu giá bán lẻ điện sinh hoạt bậc thang của EVN, đơn vị đồng (đ).')}</p>
  <div class="tabs" role="tablist" style="margin-top:12px">
    <button type="button" role="tab" data-tab="kwh">${T('tab.kwh', 'Tính tiền theo số điện')}</button>
    <button type="button" role="tab" data-tab="money">${T('tab.money', 'Đổi tiền ra số kWh')}</button>
    <button type="button" role="tab" data-tab="app">${T('tab.app', 'Ước tính theo thiết bị')}</button>
  </div>
  <div class="workspace" style="margin-top:0">
    <div class="panel">
      <div class="form-grid">
        ${select('tariff', T('tariff', 'Biểu giá áp dụng từ'), Object.entries(TARIFFS).map(([k, v]) => [k, v.label + (k === '2026-11' ? T('current', ' (hiện hành, 5 bậc)') : T('old', ' (cũ, 6 bậc)'))] as [string, string]), '2026-11')}
        ${select('vat', T('vat', 'Thuế GTGT'), [['0.08', '8%'], ['0.1', '10%'], ['0', T('noVat', 'Không tính')]], '0.08')}
        ${input('hh', T('hh', 'Số hộ dùng chung công tơ'), { type: 'number', value: '1', attrs: 'min="1" max="20"' })}
      </div>
      <div data-panel="kwh">${input('kwh', T('kwh', 'Số điện tiêu thụ trong tháng (kWh)'), { type: 'number', value: '250', attrs: 'min="0"' })}
        <div class="form-grid">${input('old', T('oldIdx', 'Hoặc nhập chỉ số cũ'), { type: 'number', attrs: 'min="0"' })}${input('new', T('newIdx', 'Chỉ số mới'), { type: 'number', attrs: 'min="0"' })}</div></div>
      <div data-panel="money" hidden>${input('money', T('money', 'Số tiền điện đã trả (đ, gồm thuế)'), { value: fmtInt(800000), attrs: 'inputmode="numeric"' })}</div>
      <div data-panel="app" hidden>
        <table class="data-table dk-table data-table--compact"><thead><tr><th>${T('dev', 'Thiết bị')}</th><th>W</th><th>${T('hours', 'Giờ/ngày')}</th><th>${T('qty', 'SL')}</th></tr></thead><tbody>
        ${APPLIANCES.map(([k, l, w, h]) => `<tr><td>${l}</td><td><input type="number" id="w-${k}" value="${w}" min="0" style="width:80px" /></td><td><input type="number" id="h-${k}" value="${h}" min="0" max="24" step="0.5" style="width:70px" /></td><td><input type="number" id="q-${k}" value="${['fridge', 'light', 'tv', 'fan', 'rice', 'wash'].includes(k) ? 1 : 0}" min="0" max="20" style="width:60px" /></td></tr>`).join('')}
        </tbody></table>
      </div>
    </div>
    <div class="panel">
      <div class="stat-grid" id="sum"></div>
      <table class="data-table dk-table data-table--compact"><thead><tr><th>${T('tier', 'Bậc')}</th><th>kWh</th><th>${T('price', 'Đơn giá')}</th><th>${T('amount', 'Thành tiền')}</th></tr></thead><tbody id="lines"></tbody></table>
      <p class="note">${T('note', 'Giá chưa gồm thuế; hoá đơn thực tế có thể lệch vài đồng do làm tròn. Kỳ ghi chỉ số không tròn tháng thì định mức mỗi bậc được tính theo số ngày.')}</p>
    </div>
  </div>
  <p class="note" style="margin-top:16px">${T('src', 'Biểu giá theo Quyết định 2892/QĐ-BCT (áp dụng từ 01/11/2026): bậc 1 (0–100 kWh) 1.901 đ, bậc 2 (101–200) 2.289 đ, bậc 3 (201–400) 2.894 đ, bậc 4 (401–700) 3.456 đ, bậc 5 (từ 701) 3.844 đ/kWh.')}</p>
`;
let tab = 'kwh';
const stat = (l: string, v: string, main = false) => `<div class="stat${main ? ' stat--main' : ''}"><span class="stat-label">${l}</span><span class="stat-value">${v}</span></div>`;
function run(): void {
  const tiers = TARIFFS[val('tariff')].tiers, vat = Number(val('vat')), hh = Math.max(1, Number(val('hh')) || 1);
  let kwh: number;
  if (tab === 'money') kwh = kwhForMoney(parseNumber(val('money')) || 0, tiers, vat, hh);
  else if (tab === 'app') kwh = Math.round(APPLIANCES.reduce((s, [k]) => s + (Number(val('w-' + k)) || 0) * (Number(val('h-' + k)) || 0) * (Number(val('q-' + k)) || 0) * 30 / 1000, 0));
  else {
    const o = Number(val('old')), n = Number(val('new'));
    kwh = val('old') && val('new') && n >= o ? n - o : Math.max(0, Number(val('kwh')) || 0);
  }
  const b = calcBill(kwh, tiers, hh);
  const tax = Math.round(b.subtotal * vat);
  el('sum').innerHTML = stat(T('total', 'Tổng tiền phải trả'), fmtVnd(Math.round(b.subtotal) + tax), true) + stat(T('used', 'Số điện'), `${fmtInt(kwh)} kWh`) + stat(T('before', 'Chưa thuế'), fmtVnd(Math.round(b.subtotal))) + stat(T('tax', 'Thuế GTGT'), fmtVnd(tax)) + stat(T('avg', 'Giá bình quân'), kwh ? `${fmtInt((b.subtotal + tax) / kwh)} đ/kWh` : '—');
  el('lines').innerHTML = b.lines.map((l, i) => `<tr><td>${i + 1} (${fmtInt(l.from)}–${fmtInt(l.to)})</td><td>${fmtInt(l.kwh)}</td><td>${fmtInt(l.price)}</td><td>${fmtVnd(Math.round(l.amount))}</td></tr>`).join('');
}
el('tool-root').addEventListener('input', run);
onChange(['tariff', 'vat'], run, 10);
setupTabs($('#tool-root'), (t) => { tab = t; run(); });
run();
