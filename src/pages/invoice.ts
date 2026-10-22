import { mountLayout } from '../layout';
import { $, escapeHtml, fmtDec, fmtInt, parseNumber, storage, toast } from '../ui';
import { SheetStore, newId } from '../google/sync';
import { moneyInWords } from '../calc/words-vi';
import { currentLang, pageText } from '../i18n';

mountLayout({ activeTool: 'invoice' });
const T = pageText();

interface Item { desc: string; unit: string; qty: number; price: number; discount: number }
interface Party { name: string; address: string; phone: string; email: string; taxCode: string }
interface InvoiceDoc {
  kind: 'quote' | 'invoice';
  number: string;
  date: string;
  dueDate: string;
  seller: Party & { bank: string };
  buyer: Party;
  items: Item[];
  vat: number;
  shipping: number;
  notes: string;
}
interface SavedDoc { id: string; kind: string; title: string; updated: string; total: number; json: string }
type Data = { docs: SavedDoc[] };

const kindTitle = (k: 'quote' | 'invoice'): string => (k === 'quote' ? T('title.quote', 'BÁO GIÁ') : T('title.invoice', 'HOÁ ĐƠN BÁN HÀNG'));
const MAX_LOGO_BYTES = 300 * 1024;

const store = new SheetStore<Data>({
  tag: 'invoice',
  title: 'WFTools - Hoá đơn & báo giá',
  empty: { docs: [] },
  tables: {
    docs: {
      sheet: 'Chứng từ',
      columns: [
        { key: 'id', label: 'Mã' }, { key: 'kind', label: 'Loại' }, { key: 'title', label: 'Số / khách hàng' },
        { key: 'updated', label: 'Cập nhật' }, { key: 'total', label: 'Tổng tiền', type: 'number' }, { key: 'json', label: 'Dữ liệu (không sửa tay)' },
      ],
    },
  },
});

const sellerPref = storage<InvoiceDoc['seller'] | null>('invoice-seller', null);
const logoPref = storage<string>('invoice-logo', '');
const counter = storage<Record<string, number>>('invoice-counter', {});
const draftPref = storage<InvoiceDoc | null>('invoice-draft', null);

const today = () => new Date().toLocaleDateString('en-CA');
const plusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
const emptyParty = (): Party => ({ name: '', address: '', phone: '', email: '', taxCode: '' });

function nextNumber(kind: 'quote' | 'invoice'): string {
  const year = new Date().getFullYear();
  const key = `${kind}-${year}`;
  const n = (counter.get()[key] ?? 0) + 1;
  return `${kind === 'quote' ? T('numPrefix.quote', 'BG') : T('numPrefix.invoice', 'HD')}-${year}-${String(n).padStart(3, '0')}`;
}

function blankDoc(kind: 'quote' | 'invoice' = 'quote'): InvoiceDoc {
  return {
    kind,
    number: nextNumber(kind),
    date: today(),
    dueDate: plusDays(kind === 'quote' ? 15 : 7),
    seller: sellerPref.get() ?? { ...emptyParty(), bank: '' },
    buyer: emptyParty(),
    items: [{ desc: '', unit: T('defaultUnit', 'cái'), qty: 1, price: 0, discount: 0 }],
    vat: 0,
    shipping: 0,
    notes: kind === 'quote' ? T('notes.quote', 'Báo giá có hiệu lực đến ngày ghi ở trên. Giá chưa gồm phí vận chuyển nếu không ghi rõ.') : T('notes.invoice', 'Cảm ơn quý khách đã mua hàng.'),
  };
}

let doc: InvoiceDoc = draftPref.get() ?? blankDoc();
let currentId: string | null = null;

const root = $('#tool-root');
root.innerHTML = `
  <div class="row no-print" style="margin-top:20px">
    <div class="segmented" role="radiogroup" aria-label="${T('aria.kind','Loại chứng từ')}">
      <label><input type="radio" name="kind" value="quote" /><span>${T('quote','Báo giá')}</span></label>
      <label><input type="radio" name="kind" value="invoice" /><span>${T('invoice','Hoá đơn bán hàng')}</span></label>
    </div>
    <button type="button" class="btn" id="new">${T('new','Tạo mới')}</button>
    <button type="button" class="btn" id="save">${T('save','Lưu')}</button>
    <button type="button" class="btn btn-primary" id="print">${T('print','In / Lưu PDF')}</button>
  </div>

  <div class="doc-layout">
    <form class="panel no-print" id="doc-form" novalidate>
      <div class="form-grid">
        <label class="field"><span class="field-label">${T('docNumber','Số chứng từ')}</span><input name="number" type="text" maxlength="40" /></label>
        <label class="field"><span class="field-label">${T('date','Ngày')}</span><input name="date" type="date" /></label>
        <label class="field"><span class="field-label" id="due-label">${T('validUntil','Hiệu lực đến')}</span><input name="dueDate" type="date" /></label>
      </div>

      <details class="options" open>
        <summary>${T('seller','Bên bán (thông tin của bạn, được nhớ cho lần sau)')}</summary>
        <div class="options-body form-grid">
          <label class="field span-all"><span class="field-label">${T('shopName','Tên cửa hàng / công ty')}</span><input name="seller.name" type="text" maxlength="120" /></label>
          <label class="field span-all"><span class="field-label">${T('address','Địa chỉ')}</span><input name="seller.address" type="text" maxlength="200" /></label>
          <label class="field"><span class="field-label">${T('phone','Điện thoại')}</span><input name="seller.phone" type="tel" maxlength="30" /></label>
          <label class="field"><span class="field-label">${T('email','Email')}</span><input name="seller.email" type="email" maxlength="100" /></label>
          <label class="field"><span class="field-label">${T('taxCode','Mã số thuế')}</span><input name="seller.taxCode" type="text" maxlength="20" /></label>
          <label class="field span-all"><span class="field-label">${T('bank','Thông tin chuyển khoản')}</span><input name="seller.bank" type="text" maxlength="200" placeholder="${T('bankPh','Ngân hàng, số tài khoản, chủ tài khoản')}" /></label>
          <label class="field span-all"><span class="field-label">${T('logo','Logo (PNG, JPG, tối đa 300 KB)')}</span><input id="logo" type="file" accept="image/png,image/jpeg,image/webp" /></label>
          <div class="row span-all"><button type="button" class="btn btn-sm" id="logo-clear">${T('logoClear','Bỏ logo')}</button></div>
        </div>
      </details>

      <details class="options" open>
        <summary>${T('customer','Khách hàng')}</summary>
        <div class="options-body form-grid">
          <label class="field span-all"><span class="field-label">${T('customerName','Tên khách hàng / công ty')}</span><input name="buyer.name" type="text" maxlength="120" /></label>
          <label class="field span-all"><span class="field-label">${T('address','Địa chỉ')}</span><input name="buyer.address" type="text" maxlength="200" /></label>
          <label class="field"><span class="field-label">${T('phone','Điện thoại')}</span><input name="buyer.phone" type="tel" maxlength="30" /></label>
          <label class="field"><span class="field-label">${T('email','Email')}</span><input name="buyer.email" type="email" maxlength="100" /></label>
          <label class="field"><span class="field-label">${T('taxCode','Mã số thuế')}</span><input name="buyer.taxCode" type="text" maxlength="20" /></label>
        </div>
      </details>

      <div>
        <span class="field-label">${T('items','Hàng hoá, dịch vụ')}</span>
        <div class="items-editor" id="items"></div>
        <button type="button" class="btn btn-sm" id="add-item">${T('addRow','+ Thêm dòng')}</button>
      </div>

      <div class="form-grid">
        <label class="field"><span class="field-label">${T('vat','Thuế GTGT')}</span>
          <select name="vat"><option value="0">${T('vat.none','Không ghi thuế')}</option><option value="5">5%</option><option value="8">8%</option><option value="10">10%</option></select>
        </label>
        <label class="field"><span class="field-label">${T('shipping','Phí vận chuyển')}</span><input name="shipping" type="text" inputmode="numeric" /></label>
        <label class="field span-all"><span class="field-label">${T('notesLabel','Ghi chú, điều khoản')}</span><textarea name="notes" rows="3" maxlength="1000"></textarea></label>
      </div>
      <p class="note">${T('legalNote','Hoá đơn bán hàng ở đây là chứng từ nội bộ gửi khách, không thay thế hoá đơn điện tử theo quy định về hoá đơn của cơ quan thuế.')}</p>
    </form>

    <div class="doc-preview-wrap">
      <article class="print-doc" id="preview" aria-label="${T('aria.preview','Xem trước chứng từ')}"></article>
    </div>
  </div>

  <h2 class="section-title no-print" style="margin-top:28px">${T('savedDocs','Chứng từ đã lưu')}</h2>
  <div class="table-wrap no-print"><table class="data-table" id="saved"></table></div>
`;
store.mount(root);

const form = $<HTMLFormElement>('#doc-form');

/* ---------- Đồng bộ form <-> dữ liệu ---------- */
function getPath(o: InvoiceDoc, path: string): string {
  const [a, b] = path.split('.');
  const v = b ? (o as unknown as Record<string, Record<string, unknown>>)[a][b] : (o as unknown as Record<string, unknown>)[a];
  return v === undefined || v === null ? '' : String(v);
}
function setPath(o: InvoiceDoc, path: string, value: string): void {
  const [a, b] = path.split('.');
  if (b) (o as unknown as Record<string, Record<string, unknown>>)[a][b] = value;
  else if (a === 'vat') o.vat = Number(value) || 0;
  else if (a === 'shipping') o.shipping = Math.max(0, parseNumber(value) || 0);
  else (o as unknown as Record<string, unknown>)[a] = value;
}

function fillForm(): void {
  form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[name]').forEach((el) => {
    if (el.name === 'kind' || !el.name) return;
    el.value = el.name === 'shipping' ? (doc.shipping ? fmtInt(doc.shipping) : '') : getPath(doc, el.name);
  });
  root.querySelectorAll<HTMLInputElement>('input[name="kind"]').forEach((r) => (r.checked = r.value === doc.kind));
  $('#due-label').textContent = doc.kind === 'quote' ? T('validUntil','Hiệu lực đến') : T('dueDate','Hạn thanh toán');
  renderItems();
}

function renderItems(): void {
  $('#items').innerHTML = `
    <div class="item-row item-head"><span>${T('it.desc','Mô tả')}</span><span>${T('it.unit','ĐVT')}</span><span>${T('it.qty','SL')}</span><span>${T('it.price','Đơn giá')}</span><span>${T('it.disc','CK %')}</span><span></span></div>
    ${doc.items
      .map(
        (it, i) => `<div class="item-row" data-i="${i}">
        <input data-f="desc" type="text" value="${escapeHtml(it.desc)}" placeholder="${T('it.descPh','Tên hàng hoá, dịch vụ')}" aria-label="${T('it.descAria','Mô tả dòng')} ${i + 1}" maxlength="200" />
        <input data-f="unit" type="text" value="${escapeHtml(it.unit)}" aria-label="${T('it.unitAria','Đơn vị tính')}" maxlength="20" />
        <input data-f="qty" type="text" inputmode="decimal" value="${it.qty}" aria-label="${T('it.qtyAria','Số lượng')}" />
        <input data-f="price" type="text" inputmode="numeric" value="${it.price ? fmtInt(it.price) : ''}" aria-label="${T('it.priceAria','Đơn giá')}" />
        <input data-f="discount" type="text" inputmode="decimal" value="${it.discount || ''}" aria-label="${T('it.discAria','Chiết khấu phần trăm')}" />
        <button type="button" class="btn btn-sm" data-remove="${i}" aria-label="${T('it.removeAria','Xoá dòng')} ${i + 1}">✕</button>
      </div>`,
      )
      .join('')}`;
}

/* ---------- Tính tiền ---------- */
function totals(d: InvoiceDoc) {
  const lines = d.items.map((it) => {
    const gross = it.qty * it.price;
    return { ...it, amount: gross - (gross * Math.min(100, Math.max(0, it.discount))) / 100 };
  });
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const vatAmount = Math.round((subtotal * d.vat) / 100);
  return { lines, subtotal, vatAmount, total: Math.round(subtotal + vatAmount + d.shipping) };
}

const fmtDate = (s: string): string => {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  const l = currentLang();
  return l === 'en' ? `${m}/${d}/${y}` : l === 'ja' || l === 'zh' ? `${y}/${m}/${d}` : `${d}/${m}/${y}`;
};

function renderPreview(): void {
  const t = totals(doc);
  const logo = logoPref.get();
  const party = (p: Party) =>
    [p.address && `${T('p.address','Địa chỉ')}: ${escapeHtml(p.address)}`, p.phone && `${T('p.phone','Điện thoại')}: ${escapeHtml(p.phone)}`, p.email && `Email: ${escapeHtml(p.email)}`, p.taxCode && `${T('p.taxCode','Mã số thuế')}: ${escapeHtml(p.taxCode)}`]
      .filter(Boolean)
      .join('<br />');
  $('#preview').innerHTML = `
    <header class="pd-head">
      <div class="pd-seller">
        ${logo ? `<img src="${logo}" alt="" class="pd-logo" />` : ''}
        <div><b>${escapeHtml(doc.seller.name || T('yourShop','Tên cửa hàng của bạn'))}</b><br />${party(doc.seller)}</div>
      </div>
      <div class="pd-title">
        <h2>${kindTitle(doc.kind)}</h2>
        <p>${T('p.no','Số')}: <b>${escapeHtml(doc.number)}</b><br />${T('p.date','Ngày')}: ${fmtDate(doc.date)}${doc.dueDate ? `<br />${doc.kind === 'quote' ? T('validUntil','Hiệu lực đến') : T('dueDate','Hạn thanh toán')}: ${fmtDate(doc.dueDate)}` : ''}</p>
      </div>
    </header>
    <section class="pd-buyer">
      <span class="pd-label">${doc.kind === 'quote' ? T('p.to','Kính gửi') : T('customer','Khách hàng')}</span>
      <b>${escapeHtml(doc.buyer.name || '…')}</b><br />${party(doc.buyer)}
    </section>
    <table class="pd-table">
      <thead><tr><th>#</th><th>${T('items','Hàng hoá, dịch vụ')}</th><th>${T('it.unit','ĐVT')}</th><th>${T('it.qty','SL')}</th><th>${T('it.price','Đơn giá')}</th><th>${T('p.ck','CK')}</th><th>${T('p.amount','Thành tiền')}</th></tr></thead>
      <tbody>${t.lines
        .filter((l) => l.desc || l.price)
        .map((l, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(l.desc)}</td><td>${escapeHtml(l.unit)}</td><td>${Number.isInteger(l.qty) ? fmtInt(l.qty) : fmtDec(l.qty)}</td>
          <td>${fmtInt(l.price)}</td><td>${l.discount ? `${l.discount}%` : ''}</td><td>${fmtInt(l.amount)}</td></tr>`)
        .join('')}</tbody>
    </table>
    <table class="pd-totals">
      <tr><td>${T('p.subtotal','Cộng tiền hàng')}</td><td>${fmtInt(t.subtotal)}</td></tr>
      ${doc.vat ? `<tr><td>${T('vat','Thuế GTGT')} ${doc.vat}%</td><td>${fmtInt(t.vatAmount)}</td></tr>` : ''}
      ${doc.shipping ? `<tr><td>${T('shipping','Phí vận chuyển')}</td><td>${fmtInt(doc.shipping)}</td></tr>` : ''}
      <tr class="pd-grand"><td>${T('p.total','Tổng thanh toán')}</td><td>${T('p.cur', '{n} đ').replace('{n}', fmtInt(t.total))}</td></tr>
    </table>
    <p class="pd-words">${T('p.inWords','Bằng chữ')}: <i>${escapeHtml(moneyInWords(t.total))}</i></p>
    ${doc.seller.bank ? `<p class="pd-bank"><b>${T('bank','Thông tin chuyển khoản')}:</b> ${escapeHtml(doc.seller.bank)}</p>` : ''}
    ${doc.notes ? `<p class="pd-notes">${escapeHtml(doc.notes).replace(/\n/g, '<br />')}</p>` : ''}
    <footer class="pd-sign">
      <div><b>${doc.kind === 'quote' ? T('sign.buyerConfirm','Xác nhận của khách hàng') : T('sign.buyer','Người mua hàng')}</b><span>${T('sign.signName','(Ký, ghi rõ họ tên)')}</span></div>
      <div><b>${doc.kind === 'quote' ? T('sign.quoter','Người báo giá') : T('sign.seller','Người bán hàng')}</b><span>${T('sign.signName','(Ký, ghi rõ họ tên)')}</span></div>
    </footer>`;
  draftPref.set(doc);
}

function renderSaved(): void {
  const docs = [...store.get().docs].sort((a, b) => b.updated.localeCompare(a.updated));
  $('#saved').innerHTML = docs.length
    ? `<thead><tr><th>${T('th.doc','Chứng từ')}</th><th>${T('th.type','Loại')}</th><th>${T('th.updated','Cập nhật')}</th><th>${T('th.total','Tổng tiền')}</th><th></th></tr></thead><tbody>${docs
        .map((d) => `<tr><td>${escapeHtml(d.title)}</td><td>${d.kind === 'invoice' ? T('invoiceShort','Hoá đơn') : T('quote','Báo giá')}</td><td>${escapeHtml(d.updated.replace('T', ' ').slice(0, 16))}</td>
          <td>${fmtInt(Number(d.total))}</td><td class="row"><button type="button" class="btn btn-sm" data-open="${escapeHtml(d.id)}">${T('open','Mở')}</button>
          <button type="button" class="btn btn-sm" data-copy="${escapeHtml(d.id)}">${T('duplicate','Nhân bản')}</button><button type="button" class="btn btn-sm" data-delete="${escapeHtml(d.id)}">${T('del','Xoá')}</button></td></tr>`)
        .join('')}</tbody>`
    : `<tbody><tr><td class="note">${T('noSaved','Chưa lưu chứng từ nào. Bấm "Lưu" để lưu lại và mở ra sửa sau.')}</td></tr></tbody>`;
}

/* ---------- Sự kiện ---------- */
form.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  const row = el.closest<HTMLElement>('.item-row[data-i]');
  if (row && el.dataset.f) {
    const it = doc.items[Number(row.dataset.i)];
    const f = el.dataset.f as keyof Item;
    if (f === 'desc' || f === 'unit') it[f] = el.value;
    else it[f] = Math.max(0, parseNumber(el.value) || 0);
  } else if (el.name) {
    setPath(doc, el.name, el.value);
    if (el.name.startsWith('seller.')) sellerPref.set(doc.seller);
  }
  renderPreview();
});
form.addEventListener('focusout', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.dataset.f === 'price' || el.name === 'shipping') {
    const n = parseNumber(el.value);
    if (Number.isFinite(n) && n > 0) el.value = fmtInt(n);
  }
});
form.addEventListener('click', (e) => {
  const rm = (e.target as HTMLElement).closest<HTMLElement>('[data-remove]')?.dataset.remove;
  if (rm === undefined) return;
  doc.items.splice(Number(rm), 1);
  if (!doc.items.length) doc.items.push({ desc: '', unit: T('defaultUnit', 'cái'), qty: 1, price: 0, discount: 0 });
  renderItems();
  renderPreview();
});
form.addEventListener('submit', (e) => e.preventDefault());
$('#add-item').addEventListener('click', () => {
  doc.items.push({ desc: '', unit: T('defaultUnit', 'cái'), qty: 1, price: 0, discount: 0 });
  renderItems();
  renderPreview();
  ($('#items').querySelector('.item-row:last-child input') as HTMLInputElement | null)?.focus();
});
root.querySelectorAll<HTMLInputElement>('input[name="kind"]').forEach((r) =>
  r.addEventListener('change', () => {
    const kind = r.value as InvoiceDoc['kind'];
    if (kind === doc.kind) return;
    // Đổi loại chứng từ: giữ nội dung, cấp số mới theo loại
    doc.kind = kind;
    if (!currentId) doc.number = nextNumber(kind);
    fillForm();
    renderPreview();
  }),
);

$<HTMLInputElement>('#logo').addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return toast(T('toast.logoType','Logo cần là ảnh PNG, JPG hoặc WebP'));
  if (file.size > MAX_LOGO_BYTES) return toast(T('toast.logoBig','Logo lớn hơn 300 KB, hãy dùng công cụ Nén ảnh trước'));
  const reader = new FileReader();
  reader.onload = () => {
    logoPref.set(String(reader.result));
    renderPreview();
  };
  reader.readAsDataURL(file);
});
$('#logo-clear').addEventListener('click', () => {
  logoPref.set('');
  $<HTMLInputElement>('#logo').value = '';
  renderPreview();
});

$('#new').addEventListener('click', () => {
  doc = blankDoc(doc.kind);
  currentId = null;
  fillForm();
  renderPreview();
  toast(T('toast.new','Đã tạo chứng từ mới'));
});

$('#save').addEventListener('click', () => {
  const t = totals(doc);
  const d = store.get();
  const isNew = !currentId;
  currentId ??= newId();
  const entry: SavedDoc = {
    id: currentId, kind: doc.kind, title: `${doc.number}${doc.buyer.name ? ` · ${doc.buyer.name}` : ''}`,
    updated: new Date().toLocaleString('sv-SE').slice(0, 16), total: t.total, json: JSON.stringify(doc),
  };
  store.set({ docs: [...d.docs.filter((x) => x.id !== currentId), entry] });
  if (isNew) {
    // Ghi nhận số đã dùng để lần sau tự tăng
    const key = `${doc.kind}-${new Date().getFullYear()}`;
    const m = doc.number.match(/(\d+)$/);
    const used = m ? Number(m[1]) : 0;
    const c = counter.get();
    counter.set({ ...c, [key]: Math.max(c[key] ?? 0, used) });
  }
  renderSaved();
  toast(`${T('toast.saved','Đã lưu')} ${doc.number}`);
});

$('#print').addEventListener('click', () => {
  document.title = `${doc.number}${doc.buyer.name ? ` - ${doc.buyer.name}` : ''}`;
  window.print();
});

$('#saved').addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const open = t.closest<HTMLElement>('[data-open]')?.dataset.open;
  const copy = t.closest<HTMLElement>('[data-copy]')?.dataset.copy;
  const del = t.closest<HTMLButtonElement>('[data-delete]');
  const d = store.get();
  const find = (id: string) => d.docs.find((x) => x.id === id);
  const parse = (s: SavedDoc): InvoiceDoc | null => {
    try {
      return JSON.parse(s.json) as InvoiceDoc;
    } catch {
      toast(T('toast.badData','Dữ liệu chứng từ bị lỗi (có thể đã bị sửa tay trên Google Sheets)'));
      return null;
    }
  };
  if (open) {
    const s = find(open);
    const parsed = s && parse(s);
    if (!parsed) return;
    doc = parsed;
    currentId = open;
    fillForm();
    renderPreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (copy) {
    const s = find(copy);
    const parsed = s && parse(s);
    if (!parsed) return;
    doc = { ...parsed, number: nextNumber(parsed.kind), date: today(), dueDate: plusDays(parsed.kind === 'quote' ? 15 : 7) };
    currentId = null;
    fillForm();
    renderPreview();
    toast(T('toast.duplicated','Đã nhân bản, nhớ bấm Lưu'));
  } else if (del) {
    if (del.dataset.confirm !== '1') {
      del.dataset.confirm = '1';
      del.textContent = T('del.confirm','Bấm lần nữa để xoá');
      setTimeout(() => { del.dataset.confirm = ''; del.textContent = T('del','Xoá'); }, 3000);
      return;
    }
    store.set({ docs: d.docs.filter((x) => x.id !== del.dataset.delete) });
    if (currentId === del.dataset.delete) currentId = null;
    renderSaved();
  }
});

store.onChange(renderSaved);
fillForm();
renderPreview();
renderSaved();
