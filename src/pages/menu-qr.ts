import { mountLayout } from '../layout';
import '../menu/menu.css';
import { $, copyText, downloadBlob, escapeHtml, fmtInt, parseNumber, storage, toast } from '../ui';
import { SheetStore, newId } from '../google/sync';
import { VIEWER_URL, bindMenuNav, encodeMenu, menuHtml, type Menu } from '../menu/menu';
import { encodeQr, qrToSvg } from '../lib/qr';
import { downloadPng } from '../lib/download';

mountLayout({ activeTool: 'menu-qr' });

interface SavedMenu { id: string; title: string; updated: string; json: string }
type Data = { menus: SavedMenu[] };

const ACCENTS = ['#0d6efd', '#b9000e', '#16233a', '#0e7a55', '#c2570c', '#8a5a2b'];

const store = new SheetStore<Data>({
  tag: 'menu-qr',
  title: 'WFTools - Menu QR',
  empty: { menus: [] },
  tables: { menus: { sheet: 'Thực đơn', columns: [{ key: 'id', label: 'Mã' }, { key: 'title', label: 'Tên quán' }, { key: 'updated', label: 'Cập nhật' }, { key: 'json', label: 'Dữ liệu (không sửa tay)' }] } },
});

const sample = (): Menu => ({
  name: 'Cà phê Sông Hương',
  info: '12 Lê Lợi, Huế · Mở cửa 6:30–22:00\nWi‑Fi: SongHuong / matkhau123',
  note: 'Giá đã gồm VAT. Gọi món tại quầy hoặc gọi nhân viên.',
  accent: '#8a5a2b',
  categories: [
    { title: 'Cà phê', items: [{ name: 'Cà phê đen', price: 25000, desc: '' }, { name: 'Cà phê sữa', price: 29000, desc: '' }, { name: 'Cà phê muối', price: 35000, desc: 'Đặc sản Huế, kem muối béo nhẹ' }] },
    { title: 'Trà & nước ép', items: [{ name: 'Trà đào cam sả', price: 39000, desc: '' }, { name: 'Nước ép cam', price: 35000, desc: '' }] },
  ],
});

const draft = storage<Menu | null>('menu-draft', null);
let menu: Menu = draft.get() ?? sample();
let currentId: string | null = null;
let link = '';

const root = $('#tool-root');
root.innerHTML = `
  <div class="row" style="margin-top:20px">
    <button type="button" class="btn" id="new">Thực đơn trống</button>
    <button type="button" class="btn" id="save">Lưu</button>
  </div>
  <div class="doc-layout">
    <form class="panel" id="menu-form" novalidate>
      <div class="form-grid">
        <label class="field span-all"><span class="field-label">Tên quán</span><input name="name" type="text" maxlength="120" /></label>
        <label class="field span-all"><span class="field-label">Thông tin (địa chỉ, giờ mở cửa, Wi‑Fi)</span><textarea name="info" rows="2" maxlength="300"></textarea></label>
      </div>
      <div><span class="field-label">Màu chủ đạo</span><div class="row" id="accents">${ACCENTS.map((c) => `<button type="button" class="accent-dot" data-accent="${c}" style="background:${c}" aria-label="Màu ${c}"></button>`).join('')}</div></div>
      <div id="cats" class="entries"></div>
      <button type="button" class="btn btn-sm" id="add-cat">+ Thêm danh mục</button>
      <label class="field"><span class="field-label">Ghi chú cuối thực đơn</span><textarea name="note" rows="2" maxlength="500"></textarea></label>
    </form>
    <div class="menu-side">
      <div class="panel">
        <div class="label-sheet utm-qr"><div class="code-frame code-frame--qr" id="qr"></div></div>
        <p class="code-meta" id="qr-meta" aria-live="polite"></p>
        <div class="actions">
          <button type="button" class="btn btn-primary" id="qr-png">Tải mã QR (PNG)</button>
          <button type="button" class="btn" id="qr-svg">SVG</button>
          <button type="button" class="btn" id="copy">Sao chép link</button>
          <a class="btn" id="open" target="_blank" rel="noopener">Mở thử</a>
        </div>
        <p class="note">Thực đơn nằm ngay trong mã QR, không cần máy chủ. Khi đổi món hoặc giá, bạn cần in lại mã mới.</p>
      </div>
      <div class="phone-frame"><div class="mv-page" id="preview"></div></div>
    </div>
  </div>
  <h2 class="section-title" style="margin-top:28px">Thực đơn đã lưu</h2>
  <div class="table-wrap"><table class="data-table" id="saved"></table></div>
`;
store.mount(root);
const form = $<HTMLFormElement>('#menu-form');
bindMenuNav($('#preview'));

function renderCats(): void {
  $('#cats').innerHTML = menu.categories
    .map(
      (c, ci) => `<fieldset class="entry" data-ci="${ci}">
      <div class="row" style="justify-content:space-between">
        <label class="field" style="flex:1"><span class="field-label">Danh mục</span><input data-cat="title" type="text" value="${escapeHtml(c.title)}" maxlength="80" /></label>
        <button type="button" class="btn btn-sm" data-del-cat>Xoá danh mục</button>
      </div>
      ${c.items
        .map(
          (it, ii) => `<div class="menu-item-row" data-ii="${ii}">
          <input data-item="name" type="text" value="${escapeHtml(it.name)}" placeholder="Tên món" aria-label="Tên món" maxlength="120" />
          <input data-item="price" type="text" inputmode="numeric" value="${it.price ? fmtInt(it.price) : ''}" placeholder="Giá" aria-label="Giá" />
          <button type="button" class="btn btn-sm" data-del-item aria-label="Xoá món">✕</button>
          <input data-item="desc" type="text" value="${escapeHtml(it.desc)}" placeholder="Mô tả ngắn (không bắt buộc)" aria-label="Mô tả" maxlength="300" />
        </div>`,
        )
        .join('')}
      <button type="button" class="btn btn-sm" data-add-item>+ Thêm món</button>
    </fieldset>`,
    )
    .join('');
}

function fillForm(): void {
  form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[name]').forEach((el) => (el.value = String((menu as unknown as Record<string, unknown>)[el.name] ?? '')));
  root.querySelectorAll<HTMLElement>('[data-accent]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.accent === menu.accent)));
  renderCats();
}

let encodeSeq = 0;
async function renderOutput(): Promise<void> {
  draft.set(menu);
  $('#preview').innerHTML = menuHtml(menu);
  const seq = ++encodeSeq;
  const hash = await encodeMenu(menu);
  if (seq !== encodeSeq) return; // đã có thay đổi mới hơn
  link = `${VIEWER_URL}#${hash}`;
  $<HTMLAnchorElement>('#open').href = link;
  const meta = $('#qr-meta');
  try {
    const qr = encodeQr(link, 'L');
    $('#qr').innerHTML = qrToSvg(qr, { px: 240 });
    meta.textContent =
      qr.version <= 15 ? 'Mã gọn, in cỡ 4 cm trở lên là quét tốt.'
      : qr.version <= 25 ? 'Mã khá dày, nên in rộng từ 6 cm trở lên.'
      : 'Mã rất dày vì thực đơn dài. Nên in rộng từ 9 cm, hoặc rút gọn mô tả món.';
  } catch {
    $('#qr').innerHTML = '';
    meta.textContent = 'Thực đơn quá dài để chứa trong một mã QR. Hãy bớt mô tả món hoặc tách thành hai thực đơn.';
    link = '';
  }
}

form.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  const fs = el.closest<HTMLElement>('[data-ci]');
  if (fs) {
    const cat = menu.categories[Number(fs.dataset.ci)];
    const row = el.closest<HTMLElement>('[data-ii]');
    if (el.dataset.cat) cat.title = el.value;
    else if (row && el.dataset.item) {
      const it = cat.items[Number(row.dataset.ii)];
      if (el.dataset.item === 'price') it.price = Math.max(0, Math.round(parseNumber(el.value) || 0));
      else it[el.dataset.item as 'name' | 'desc'] = el.value;
    }
  } else if (el.name) (menu as unknown as Record<string, string>)[el.name] = el.value;
  void renderOutput();
});
form.addEventListener('focusout', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.dataset.item === 'price') { const n = parseNumber(el.value); if (n > 0) el.value = fmtInt(n); }
});
form.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const fs = t.closest<HTMLElement>('[data-ci]');
  const ci = fs ? Number(fs.dataset.ci) : -1;
  if (t.closest('[data-add-item]')) menu.categories[ci].items.push({ name: '', price: 0, desc: '' });
  else if (t.closest('[data-del-item]')) menu.categories[ci].items.splice(Number(t.closest<HTMLElement>('[data-ii]')!.dataset.ii), 1);
  else if (t.closest('[data-del-cat]')) menu.categories.splice(ci, 1);
  else return;
  renderCats();
  void renderOutput();
});
form.addEventListener('submit', (e) => e.preventDefault());
$('#add-cat').addEventListener('click', () => {
  menu.categories.push({ title: '', items: [{ name: '', price: 0, desc: '' }] });
  renderCats();
  void renderOutput();
});
$('#accents').addEventListener('click', (e) => {
  const c = (e.target as HTMLElement).closest<HTMLElement>('[data-accent]')?.dataset.accent;
  if (!c) return;
  menu.accent = c;
  root.querySelectorAll<HTMLElement>('[data-accent]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.accent === c)));
  void renderOutput();
});

const fileBase = () => `menu-${(menu.name || 'quan').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
$('#qr-png').addEventListener('click', async () => {
  if (link) await downloadPng(qrToSvg(encodeQr(link, 'L'), { px: 1600 }), `${fileBase()}.png`, 1600, 1600);
});
$('#qr-svg').addEventListener('click', () => {
  if (link) downloadBlob(new Blob([qrToSvg(encodeQr(link, 'L'), { px: 1600 })], { type: 'image/svg+xml' }), `${fileBase()}.svg`);
});
$('#copy').addEventListener('click', () => link && copyText(link, 'Đã sao chép link thực đơn'));

$('#new').addEventListener('click', () => {
  menu = { name: '', info: '', note: '', accent: '#0d6efd', categories: [{ title: 'Món chính', items: [{ name: '', price: 0, desc: '' }] }] };
  currentId = null;
  fillForm();
  void renderOutput();
});
$('#save').addEventListener('click', () => {
  currentId ??= newId();
  const d = store.get();
  store.set({ menus: [...d.menus.filter((m) => m.id !== currentId), { id: currentId, title: menu.name || 'Thực đơn chưa đặt tên', updated: new Date().toLocaleString('sv-SE').slice(0, 16), json: JSON.stringify(menu) }] });
  renderSaved();
  toast('Đã lưu thực đơn');
});

function renderSaved(): void {
  const list = [...store.get().menus].sort((a, b) => b.updated.localeCompare(a.updated));
  $('#saved').innerHTML = list.length
    ? `<thead><tr><th>Thực đơn</th><th>Cập nhật</th><th></th></tr></thead><tbody>${list
        .map((m) => `<tr><td>${escapeHtml(m.title)}</td><td>${escapeHtml(m.updated)}</td><td class="row"><button type="button" class="btn btn-sm" data-open="${escapeHtml(m.id)}">Mở</button><button type="button" class="btn btn-sm" data-delete="${escapeHtml(m.id)}">Xoá</button></td></tr>`)
        .join('')}</tbody>`
    : '<tbody><tr><td class="note">Chưa lưu thực đơn nào.</td></tr></tbody>';
}
$('#saved').addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const open = t.closest<HTMLElement>('[data-open]')?.dataset.open;
  const del = t.closest<HTMLButtonElement>('[data-delete]');
  const d = store.get();
  if (open) {
    try {
      menu = JSON.parse(d.menus.find((m) => m.id === open)?.json ?? '') as Menu;
    } catch {
      return toast('Dữ liệu thực đơn bị lỗi');
    }
    currentId = open;
    fillForm();
    void renderOutput();
  } else if (del) {
    if (del.dataset.confirm !== '1') {
      del.dataset.confirm = '1';
      del.textContent = 'Bấm lần nữa để xoá';
      setTimeout(() => { del.dataset.confirm = ''; del.textContent = 'Xoá'; }, 3000);
      return;
    }
    store.set({ menus: d.menus.filter((m) => m.id !== del.dataset.delete) });
    renderSaved();
  }
});

store.onChange(renderSaved);
fillForm();
void renderOutput();
renderSaved();
