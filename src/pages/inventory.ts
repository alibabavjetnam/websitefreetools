import { mountLayout } from '../layout';
import { $, downloadBlob, escapeHtml, fmtDec, fmtInt, fmtMoney, moneyInput, parseNumber, setupTabs, storage } from '../ui';
import { SheetStore, newId } from '../google/sync';
import { breakEvenPrice, priceForMargin, profitAt, type PricingCosts } from '../calc/pricing';
import { pageText } from '../i18n';

mountLayout({ activeTool: 'inventory' });
const T = pageText();

interface Product { id: string; sku: string; name: string; unit: string; cost: number; price: number; minQty: number }
interface Move { id: string; date: string; productId: string; qty: number; note: string }
type Data = { products: Product[]; moves: Move[] };

const store = new SheetStore<Data>({
  tag: 'inventory',
  title: 'WFTools - Tồn kho',
  empty: { products: [], moves: [] },
  tables: {
    products: {
      sheet: 'Sản phẩm',
      columns: [
        { key: 'id', label: 'Mã' }, { key: 'sku', label: 'Mã hàng (SKU)' }, { key: 'name', label: 'Tên sản phẩm' }, { key: 'unit', label: 'Đơn vị' },
        { key: 'cost', label: 'Giá vốn', type: 'number' }, { key: 'price', label: 'Giá bán', type: 'number' }, { key: 'minQty', label: 'Tồn tối thiểu', type: 'number' },
      ],
    },
    moves: {
      sheet: 'Nhập xuất',
      columns: [
        { key: 'id', label: 'Mã' }, { key: 'date', label: 'Ngày' }, { key: 'productId', label: 'Mã sản phẩm' },
        { key: 'qty', label: 'Số lượng (+ nhập, − xuất)', type: 'number' }, { key: 'note', label: 'Ghi chú' },
      ],
    },
  },
});

const root = $('#tool-root');
root.innerHTML = `
  <div class="tabs" role="tablist" aria-label="${T('aria.tabs','Chọn chức năng')}">
    <button type="button" role="tab" data-tab="pricing">${T('tab.pricing','Tính giá bán')}</button>
    <button type="button" role="tab" data-tab="stock">${T('tab.stock','Quản lý tồn kho')}</button>
  </div>

  <section class="tool-body" data-panel="pricing">
    <div class="workspace">
      <form class="panel" id="price-form" novalidate>
        <div class="form-grid">
          <label class="field"><span class="field-label">${T('costPer','Giá vốn / sản phẩm')}</span><input id="p-cost" type="text" value="120.000" /></label>
          <label class="field"><span class="field-label">${T('platformPct','Phí sàn, hoa hồng (%)')}</span><input id="p-platform" type="text" inputmode="decimal" value="0" /></label>
          <label class="field"><span class="field-label">${T('paymentPct','Phí thanh toán (%)')}</span><input id="p-payment" type="text" inputmode="decimal" value="0" /></label>
          <label class="field"><span class="field-label">${T('taxPct','Thuế trên doanh thu (%)')}</span><input id="p-tax" type="text" inputmode="decimal" value="1,5" /></label>
          <label class="field"><span class="field-label">${T('fixedPer','Phí cố định / đơn (ship, đóng gói)')}</span><input id="p-fixed" type="text" value="10.000" /></label>
          <label class="field"><span class="field-label">${T('adsPer','Quảng cáo / đơn')}</span><input id="p-ads" type="text" value="15.000" /></label>
        </div>
        <p class="note">${T('pricing.note','Mỗi sàn và mỗi ngành hàng có mức phí khác nhau, thay đổi theo thời gian. Hãy nhập theo biểu phí hiện hành trong trang quản lý bán hàng của bạn.')}</p>
        <fieldset class="field">
          <legend>${T('wantToCalc','Bạn muốn tính')}</legend>
          <label class="check"><input type="radio" name="mode" value="margin" checked /><span>${T('mode.margin','Giá bán để đạt biên lợi nhuận')}</span></label>
          <label class="check"><input type="radio" name="mode" value="price" /><span>${T('mode.price','Lợi nhuận khi bán ở một mức giá')}</span></label>
        </fieldset>
        <label class="field" id="f-margin"><span class="field-label">${T('marginWanted','Biên lợi nhuận mong muốn (% trên giá bán)')}</span><input id="p-margin" type="text" inputmode="decimal" value="20" /></label>
        <label class="field" id="f-price" hidden><span class="field-label">${T('pricePlanned','Giá bán dự kiến')}</span><input id="p-price" type="text" value="250.000" /></label>
      </form>
      <section class="preview" aria-live="polite">
        <div class="stat-grid" id="p-summary"></div>
        <p class="error" id="p-error" hidden></p>
        <div class="table-wrap"><table class="data-table" id="p-detail"></table></div>
      </section>
    </div>
  </section>

  <section class="tool-body" data-panel="stock" hidden>
    <div class="stat-grid" id="s-summary"></div>
    <div class="workspace" style="margin-top:16px">
      <form class="panel" id="prod-form" novalidate>
        <h2 class="panel-title">${T('addProduct','Thêm sản phẩm')}</h2>
        <div class="form-grid">
          <label class="field"><span class="field-label">${T('sku','Mã hàng (SKU)')}</span><input id="pr-sku" type="text" maxlength="40" placeholder="${T('skuPh', 'AO-TRANG-M')}" /></label>
          <label class="field"><span class="field-label">${T('prodName','Tên sản phẩm *')}</span><input id="pr-name" type="text" maxlength="120" /></label>
          <label class="field"><span class="field-label">${T('unit','Đơn vị')}</span><input id="pr-unit" type="text" maxlength="20" value="${T('defaultUnit', 'cái')}" /></label>
          <label class="field"><span class="field-label">${T('minQty','Tồn tối thiểu')}</span><input id="pr-min" type="number" min="0" step="1" value="5" /></label>
          <label class="field"><span class="field-label">${T('cost','Giá vốn')}</span><input id="pr-cost" type="text" /></label>
          <label class="field"><span class="field-label">${T('price','Giá bán')}</span><input id="pr-price" type="text" /></label>
          <label class="field"><span class="field-label">${T('openingQty','Tồn đầu kỳ')}</span><input id="pr-qty" type="number" min="0" step="1" value="0" /></label>
        </div>
        <p class="error" id="pr-error" hidden></p>
        <div class="row"><button type="submit" class="btn btn-primary">${T('addProduct','Thêm sản phẩm')}</button></div>
      </form>
      <form class="panel" id="move-form" novalidate>
        <h2 class="panel-title">${T('stockMove','Nhập / xuất kho')}</h2>
        <div class="segmented" role="radiogroup" aria-label="${T('aria.moveType','Loại phiếu')}">
          <label><input type="radio" name="dir" value="in" checked /><span>${T('stockIn','Nhập kho')}</span></label>
          <label><input type="radio" name="dir" value="out" /><span>${T('stockOut','Xuất kho, bán')}</span></label>
        </div>
        <div class="form-grid">
          <label class="field span-all"><span class="field-label">${T('product','Sản phẩm')}</span><select id="mv-product"></select></label>
          <label class="field"><span class="field-label">${T('qty','Số lượng')}</span><input id="mv-qty" type="number" min="1" step="1" value="1" /></label>
          <label class="field"><span class="field-label">${T('date','Ngày')}</span><input id="mv-date" type="date" /></label>
          <label class="field span-all"><span class="field-label">${T('note','Ghi chú')}</span><input id="mv-note" type="text" maxlength="200" placeholder="${T('notePh','Đơn Shopee #123, nhập từ xưởng…')}" /></label>
        </div>
        <p class="error" id="mv-error" hidden></p>
        <div class="row"><button type="submit" class="btn btn-primary">${T('saveMove','Ghi phiếu')}</button></div>
      </form>
    </div>
    <div class="row" style="margin-top:24px;justify-content:space-between">
      <h2 class="section-title" style="margin:0">${T('currentStock','Tồn kho hiện tại')}</h2>
      <button type="button" class="btn btn-sm" id="export">${T('exportCsv','Tải CSV tồn kho')}</button>
    </div>
    <div class="table-wrap" style="margin-top:12px"><table class="data-table" id="stock-table"></table></div>
    <h2 class="section-title" style="margin-top:24px">${T('moveHistory','Lịch sử nhập xuất')}</h2>
    <div class="table-wrap is-tall"><table class="data-table" id="move-table"></table></div>
  </section>
`;
setupTabs(root);
store.mount($('[data-panel="stock"]'));

/* ---------------- Tính giá bán (lưu trên máy, không cần đồng bộ) ---------------- */
const priceForm = $<HTMLFormElement>('#price-form');
const pricePrefs = storage<Record<string, string>>('pricing-inputs', {});
const priceIds = ['p-cost', 'p-platform', 'p-payment', 'p-tax', 'p-fixed', 'p-ads', 'p-margin', 'p-price'];
const saved = pricePrefs.get();
priceIds.forEach((id) => saved[id] !== undefined && ($<HTMLInputElement>(`#${id}`).value = saved[id]));
['p-cost', 'p-fixed', 'p-ads', 'p-price'].forEach((id) => moneyInput($<HTMLInputElement>(`#${id}`)));

function renderPricing(): void {
  pricePrefs.set(Object.fromEntries(priceIds.map((id) => [id, $<HTMLInputElement>(`#${id}`).value])));
  const num = (id: string) => parseNumber($<HTMLInputElement>(`#${id}`).value);
  const c: PricingCosts = { cost: num('p-cost'), platformPct: num('p-platform') || 0, paymentPct: num('p-payment') || 0, taxPct: num('p-tax') || 0, fixedPerOrder: num('p-fixed') || 0, adsPerOrder: num('p-ads') || 0 };
  const mode = priceForm.querySelector<HTMLInputElement>('input[name="mode"]:checked')?.value ?? 'margin';
  $('#f-margin').hidden = mode !== 'margin';
  $('#f-price').hidden = mode !== 'price';
  const err = $('#p-error');
  const fail = (msg: string) => { err.textContent = msg; err.hidden = false; $('#p-summary').innerHTML = ''; $('#p-detail').innerHTML = ''; };
  if (!Number.isFinite(c.cost) || c.cost < 0) return fail(T('err.cost','Hãy nhập giá vốn hợp lệ.'));
  if ([c.platformPct, c.paymentPct, c.taxPct].some((x) => x < 0 || x >= 100)) return fail(T('err.fees','Các mức phí % phải từ 0 đến dưới 100.'));

  const r = mode === 'margin' ? priceForMargin(num('p-margin'), c) : profitAt(num('p-price'), c);
  if (!r || !Number.isFinite(r.price) || r.price <= 0)
    return fail(mode === 'margin' ? T('err.margin','Tổng phí % và biên lợi nhuận đang từ 100% trở lên, không có giá bán nào đạt được. Hãy giảm biên lợi nhuận.') : T('err.price','Hãy nhập giá bán lớn hơn 0.'));
  err.hidden = true;
  const be = breakEvenPrice(c);
  $('#p-summary').innerHTML = `
    <div class="stat ${mode === 'margin' ? 'stat--main' : ''}"><span class="stat-label">${T('price','Giá bán')}</span><span class="stat-value">${fmtMoney(Math.ceil(r.price / 1000) * 1000)}</span>${mode === 'margin' ? `<span class="stat-label">${T('exact','Chính xác:')} ${fmtInt(r.price)} ${T('dong','đ, đã làm tròn lên nghìn')}</span>` : ''}</div>
    <div class="stat ${mode === 'price' ? 'stat--main' : ''}"><span class="stat-label">${T('profitPer','Lợi nhuận / sản phẩm')}</span><span class="stat-value ${r.profit < 0 ? 'error-text' : ''}">${fmtMoney(r.profit)}</span></div>
    <div class="stat"><span class="stat-label">${T('marginMarkup','Biên lợi nhuận / trên giá vốn')}</span><span class="stat-value">${fmtDec(r.margin)}% / ${fmtDec(r.markup)}%</span></div>
    <div class="stat"><span class="stat-label">${T('breakEven','Giá hoà vốn')}</span><span class="stat-value">${be ? fmtMoney(be) : '—'}</span></div>`;
  $('#p-detail').innerHTML = `<tbody>
    <tr><td>${T('price','Giá bán')}</td><td>${fmtMoney(r.price)}</td></tr>
    <tr><td>${T('cost','Giá vốn')}</td><td>− ${fmtMoney(c.cost)}</td></tr>
    <tr><td>${T('feesPct','Phí sàn, thanh toán, thuế')} (${fmtDec(c.platformPct + c.paymentPct + c.taxPct)}%)</td><td>− ${fmtMoney(r.percentFees)}</td></tr>
    <tr><td>${T('fixedAds','Phí cố định và quảng cáo')}</td><td>− ${fmtMoney(r.fixedFees)}</td></tr>
    <tr><td><b>${T('profit','Lợi nhuận')}</b></td><td><b>${fmtMoney(r.profit)}</b></td></tr>
  </tbody>`;
}
priceForm.addEventListener('input', renderPricing);
priceForm.addEventListener('change', renderPricing);
priceForm.addEventListener('submit', (e) => e.preventDefault());
renderPricing();

/* ---------------- Tồn kho (đồng bộ Google Sheets) ---------------- */
const today = () => new Date().toLocaleDateString('en-CA');
$<HTMLInputElement>('#mv-date').value = today();
const readCost = moneyInput($<HTMLInputElement>('#pr-cost'));
const readPrice = moneyInput($<HTMLInputElement>('#pr-price'));

function stockOf(d: Data): Map<string, number> {
  const m = new Map<string, number>();
  d.moves.forEach((x) => m.set(x.productId, (m.get(x.productId) ?? 0) + x.qty));
  return m;
}

function renderStock(): void {
  const d = store.get();
  const stock = stockOf(d);
  const low = d.products.filter((p) => (stock.get(p.id) ?? 0) <= p.minQty);
  const value = d.products.reduce((s, p) => s + Math.max(0, stock.get(p.id) ?? 0) * p.cost, 0);
  $('#s-summary').innerHTML = `
    <div class="stat"><span class="stat-label">${T('numItems','Số mặt hàng')}</span><span class="stat-value">${d.products.length}</span></div>
    <div class="stat stat--main"><span class="stat-label">${T('stockValue','Giá trị tồn kho (theo giá vốn)')}</span><span class="stat-value">${fmtMoney(value)}</span></div>
    <div class="stat"><span class="stat-label">${T('lowStock','Sắp hết hàng')}</span><span class="stat-value ${low.length ? 'error-text' : ''}">${low.length} ${T('items','mặt hàng')}</span></div>`;

  $('#mv-product').innerHTML = d.products.length
    ? d.products.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.sku ? `${p.sku} · ${p.name}` : p.name)} (${T('stockLabel','tồn')} ${fmtInt(stock.get(p.id) ?? 0)})</option>`).join('')
    : `<option value="">${T('noProduct','Chưa có sản phẩm')}</option>`;

  $('#stock-table').innerHTML = d.products.length
    ? `<thead><tr><th>${T('th.product','Sản phẩm')}</th><th>${T('th.sku','Mã hàng')}</th><th>${T('th.stock','Tồn kho')}</th><th>${T('th.min','Tối thiểu')}</th><th>${T('th.cost','Giá vốn')}</th><th>${T('th.price','Giá bán')}</th><th>${T('th.value','Giá trị tồn')}</th><th></th></tr></thead><tbody>${d.products
        .map((p) => {
          const q = stock.get(p.id) ?? 0;
          return `<tr${q <= p.minQty ? ' class="is-low"' : ''}><td>${escapeHtml(p.name)}${q <= p.minQty ? ' <span class="badge-low">' + T('badge.low','Sắp hết') + '</span>' : ''}</td><td>${escapeHtml(p.sku)}</td>
            <td><b>${fmtInt(q)}</b> ${escapeHtml(p.unit)}</td><td>${fmtInt(p.minQty)}</td><td>${fmtInt(p.cost)}</td><td>${fmtInt(p.price)}</td><td>${fmtInt(Math.max(0, q) * p.cost)}</td>
            <td><button type="button" class="btn btn-sm" data-del-product="${escapeHtml(p.id)}">${T('del','Xoá')}</button></td></tr>`;
        })
        .join('')}</tbody>`
    : `<tbody><tr><td class="note">${T('noProductYet','Chưa có sản phẩm. Thêm sản phẩm đầu tiên ở khung bên trên.')}</td></tr></tbody>`;

  const names = new Map(d.products.map((p) => [p.id, p.name]));
  const moves = [...d.moves].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 300);
  $('#move-table').innerHTML = moves.length
    ? `<thead><tr><th>${T('th.date','Ngày')}</th><th>${T('th.product','Sản phẩm')}</th><th>${T('th.inout','Nhập / xuất')}</th><th>${T('th.note','Ghi chú')}</th><th></th></tr></thead><tbody>${moves
        .map((m) => `<tr><td>${escapeHtml(m.date.split('-').reverse().join('/'))}</td><td>${escapeHtml(names.get(m.productId) ?? T('deleted','(đã xoá)'))}</td>
          <td class="${m.qty > 0 ? 'ok-text' : ''}">${m.qty > 0 ? '+' : '−'}${fmtInt(Math.abs(m.qty))}</td><td>${escapeHtml(m.note)}</td>
          <td><button type="button" class="btn btn-sm" data-del-move="${escapeHtml(m.id)}">${T('del','Xoá')}</button></td></tr>`)
        .join('')}</tbody>`
    : `<tbody><tr><td class="note">${T('noMoves','Chưa có phiếu nhập xuất.')}</td></tr></tbody>`;
}

$('#prod-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $<HTMLInputElement>('#pr-name').value.trim();
  const cost = readCost();
  const price = readPrice();
  const qty = Math.floor(Number($<HTMLInputElement>('#pr-qty').value) || 0);
  const err = $('#pr-error');
  const problem = !name ? T('err.name','Hãy nhập tên sản phẩm.') : qty < 0 ? T('err.openingNeg','Tồn đầu kỳ không được âm.') : '';
  err.textContent = problem;
  err.hidden = !problem;
  if (problem) return;
  const d = store.get();
  const p: Product = {
    id: newId(), sku: $<HTMLInputElement>('#pr-sku').value.trim(), name, unit: $<HTMLInputElement>('#pr-unit').value.trim() || T('defaultUnit', 'cái'),
    cost: Number.isFinite(cost) ? Math.round(cost) : 0, price: Number.isFinite(price) ? Math.round(price) : 0,
    minQty: Math.max(0, Math.floor(Number($<HTMLInputElement>('#pr-min').value) || 0)),
  };
  const moves = qty > 0 ? [...d.moves, { id: newId(), date: today(), productId: p.id, qty, note: T('openingQty', 'Tồn đầu kỳ') }] : d.moves;
  store.set({ products: [...d.products, p], moves });
  (e.target as HTMLFormElement).reset();
  $<HTMLInputElement>('#pr-unit').value = T('defaultUnit', 'cái');
  $<HTMLInputElement>('#pr-min').value = '5';
  renderStock();
});

$('#move-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const d = store.get();
  const productId = $<HTMLSelectElement>('#mv-product').value;
  const qty = Math.floor(Number($<HTMLInputElement>('#mv-qty').value));
  const dir = (e.target as HTMLFormElement).querySelector<HTMLInputElement>('input[name="dir"]:checked')?.value ?? 'in';
  const current = stockOf(d).get(productId) ?? 0;
  const err = $('#mv-error');
  const problem = !productId ? T('err.addFirst','Hãy thêm sản phẩm trước.') : !(qty > 0) ? T('err.qty','Số lượng phải lớn hơn 0.') : dir === 'out' && qty > current ? `${T('err.notEnough1','Chỉ còn')} ${fmtInt(current)} ${T('err.notEnough2','trong kho, không đủ để xuất')} ${fmtInt(qty)}.` : '';
  err.textContent = problem;
  err.hidden = !problem;
  if (problem) return;
  store.set({ ...d, moves: [...d.moves, { id: newId(), date: $<HTMLInputElement>('#mv-date').value || today(), productId, qty: dir === 'out' ? -qty : qty, note: $<HTMLInputElement>('#mv-note').value.trim() }] });
  $<HTMLInputElement>('#mv-note').value = '';
  renderStock();
});

root.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const delMove = t.closest<HTMLElement>('[data-del-move]')?.dataset.delMove;
  const delProductBtn = t.closest<HTMLButtonElement>('[data-del-product]');
  const d = store.get();
  if (delMove) {
    store.set({ ...d, moves: d.moves.filter((m) => m.id !== delMove) });
    renderStock();
  } else if (delProductBtn) {
    // Xoá sản phẩm xoá luôn lịch sử nhập xuất của nó: cần bấm hai lần
    if (delProductBtn.dataset.confirm !== '1') {
      delProductBtn.dataset.confirm = '1';
      delProductBtn.textContent = T('del.confirm','Bấm lần nữa để xoá');
      setTimeout(() => { delProductBtn.dataset.confirm = ''; delProductBtn.textContent = T('del','Xoá'); }, 3000);
      return;
    }
    const id = delProductBtn.dataset.delProduct;
    store.set({ products: d.products.filter((p) => p.id !== id), moves: d.moves.filter((m) => m.productId !== id) });
    renderStock();
  }
});

$('#export').addEventListener('click', () => {
  const d = store.get();
  const stock = stockOf(d);
  const csv = [T('csv.header', 'Ma hang,Ten,Don vi,Ton kho,Toi thieu,Gia von,Gia ban'), ...d.products.map((p) => [p.sku, p.name, p.unit, stock.get(p.id) ?? 0, p.minQty, p.cost, p.price].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))];
  downloadBlob(new Blob(['﻿' + csv.join('\n')], { type: 'text/csv;charset=utf-8' }), `${T('csv.file', 'ton-kho')}.csv`);
});

store.onChange(renderStock);
renderStock();
