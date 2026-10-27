import { mountLayout } from '../layout';
import { $, escapeHtml, parseNumber, storage } from '../ui';
import { pageText, localeTag, currentLang } from '../i18n';
import { CATEGORIES, convert, type Category } from '../calc/units';

mountLayout({ activeTool: 'unit-convert' });
const T = pageText();
const LOCALE = localeTag();

const CAT_NAMES: Record<string, string> = {
  length: T('c.length', 'Độ dài'), weight: T('c.weight', 'Khối lượng'), temp: T('c.temp', 'Nhiệt độ'), area: T('c.area', 'Diện tích'),
  volume: T('c.volume', 'Thể tích'), speed: T('c.speed', 'Tốc độ'), time: T('c.time', 'Thời gian'), data: T('c.data', 'Dữ liệu'),
  pressure: T('c.pressure', 'Áp suất'), energy: T('c.energy', 'Năng lượng'), power: T('c.power', 'Công suất'), fuel: T('c.fuel', 'Tiêu hao nhiên liệu'), angle: T('c.angle', 'Góc'),
};
/** Tên đơn vị: khoá "loại.đơnvị" */
const U: Record<string, string> = {
  'length.mm': T('u.mm', 'Milimét'), 'length.cm': T('u.cm', 'Xentimét'), 'length.m': T('u.m', 'Mét'), 'length.km': T('u.km', 'Kilômét'),
  'length.in': T('u.in', 'Inch'), 'length.ft': T('u.ft', 'Foot (bộ)'), 'length.yd': T('u.yd', 'Yard'), 'length.mi': T('u.mi', 'Dặm'),
  'length.nmi': T('u.nmi', 'Hải lý'), 'length.um': T('u.um', 'Micrômét'), 'length.nm': T('u.nm', 'Nanômét'), 'length.ly': T('u.ly', 'Năm ánh sáng'),
  'weight.mg': T('u.mg', 'Miligam'), 'weight.g': T('u.g', 'Gam'), 'weight.kg': T('u.kg', 'Kilôgam'), 'weight.t': T('u.t', 'Tấn'),
  'weight.oz': T('u.oz', 'Ounce'), 'weight.lb': T('u.lb', 'Pound'), 'weight.st': T('u.st', 'Stone'), 'weight.ust': T('u.ust', 'Tấn Mỹ'),
  'weight.ct': T('u.ct', 'Carat'), 'weight.luong': 'Lượng (cây vàng)',
  'temp.c': T('u.c', 'Độ C'), 'temp.f': T('u.f', 'Độ F'), 'temp.k': T('u.k', 'Kelvin'), 'temp.r': T('u.r', 'Rankine'),
  'area.mm2': T('u.mm2', 'Milimét vuông'), 'area.cm2': T('u.cm2', 'Xentimét vuông'), 'area.m2': T('u.m2', 'Mét vuông'), 'area.ha': T('u.ha', 'Héc-ta'),
  'area.km2': T('u.km2', 'Kilômét vuông'), 'area.in2': T('u.in2', 'Inch vuông'), 'area.ft2': T('u.ft2', 'Foot vuông'), 'area.yd2': T('u.yd2', 'Yard vuông'),
  'area.ac': T('u.ac', 'Mẫu Anh (acre)'), 'area.mi2': T('u.mi2', 'Dặm vuông'), 'area.sao': 'Sào Bắc Bộ', 'area.mau': 'Mẫu Bắc Bộ',
  'volume.ml': T('u.ml', 'Mililít'), 'volume.l': T('u.l', 'Lít'), 'volume.m3': T('u.m3', 'Mét khối'), 'volume.cm3': T('u.cm3', 'Xentimét khối'),
  'volume.tsp': T('u.tsp', 'Thìa cà phê (Mỹ)'), 'volume.tbsp': T('u.tbsp', 'Thìa canh (Mỹ)'), 'volume.floz': T('u.floz', 'Ounce chất lỏng (Mỹ)'),
  'volume.cup': T('u.cup', 'Cốc (Mỹ)'), 'volume.pt': T('u.pt', 'Pint (Mỹ)'), 'volume.qt': T('u.qt', 'Quart (Mỹ)'), 'volume.gal': T('u.gal', 'Gallon (Mỹ)'),
  'volume.ukgal': T('u.ukgal', 'Gallon (Anh)'), 'volume.in3': T('u.in3', 'Inch khối'), 'volume.ft3': T('u.ft3', 'Foot khối'), 'volume.bbl': T('u.bbl', 'Thùng dầu'),
  'speed.ms': T('u.ms', 'Mét/giây'), 'speed.kmh': T('u.kmh', 'Kilômét/giờ'), 'speed.mph': T('u.mph', 'Dặm/giờ'), 'speed.kn': T('u.kn', 'Hải lý/giờ (knot)'),
  'speed.fts': T('u.fts', 'Foot/giây'), 'speed.mach': T('u.mach', 'Mach (tốc độ âm thanh)'), 'speed.c': T('u.light', 'Tốc độ ánh sáng'),
  'time.ms': T('u.msec', 'Mili giây'), 'time.s': T('u.s', 'Giây'), 'time.min': T('u.min', 'Phút'), 'time.h': T('u.h', 'Giờ'), 'time.d': T('u.d', 'Ngày'),
  'time.wk': T('u.wk', 'Tuần'), 'time.mo': T('u.mo', 'Tháng (trung bình)'), 'time.yr': T('u.yr', 'Năm (trung bình)'),
  'data.bit': 'Bit', 'data.b': 'Byte', 'data.kb': T('u.kb', 'Kilobyte (1000)'), 'data.mb': T('u.mb', 'Megabyte (1000²)'), 'data.gb': T('u.gb', 'Gigabyte (1000³)'),
  'data.tb': T('u.tb', 'Terabyte (1000⁴)'), 'data.kib': T('u.kib', 'Kibibyte (1024)'), 'data.mib': T('u.mib', 'Mebibyte (1024²)'), 'data.gib': T('u.gib', 'Gibibyte (1024³)'), 'data.tib': T('u.tib', 'Tebibyte (1024⁴)'),
  'pressure.pa': 'Pascal', 'pressure.kpa': 'Kilopascal', 'pressure.mpa': 'Megapascal', 'pressure.bar': 'Bar', 'pressure.psi': 'PSI',
  'pressure.atm': T('u.atm', 'Átmốtphe'), 'pressure.mmhg': T('u.mmhg', 'Milimét thuỷ ngân'),
  'energy.j': 'Joule', 'energy.kj': 'Kilojoule', 'energy.cal': T('u.cal', 'Calo'), 'energy.kcal': T('u.kcal', 'Kilocalo'), 'energy.wh': T('u.wh', 'Oát giờ'),
  'energy.kwh': T('u.kwh', 'Kilôoát giờ (số điện)'), 'energy.btu': 'BTU', 'energy.ev': 'Electronvolt',
  'power.w': T('u.w', 'Oát'), 'power.kw': T('u.kw', 'Kilôoát'), 'power.hp': T('u.hp', 'Mã lực (Anh, hp)'), 'power.ps': T('u.ps', 'Mã lực (mét, PS)'), 'power.btuh': 'BTU/h',
  'fuel.kml': T('u.kml', 'Kilômét/lít'), 'fuel.l100': T('u.l100', 'Lít/100 km'), 'fuel.mpg': T('u.mpg', 'Dặm/gallon (Mỹ)'), 'fuel.mpguk': T('u.mpguk', 'Dặm/gallon (Anh)'),
  'angle.deg': T('u.deg', 'Độ'), 'angle.rad': 'Radian', 'angle.grad': 'Gradian', 'angle.arcmin': T('u.arcmin', 'Phút góc'), 'angle.arcsec': T('u.arcsec', 'Giây góc'), 'angle.turn': T('u.turn', 'Vòng'),
};
// Đơn vị riêng của Việt Nam chỉ hiện khi dùng tiếng Việt
const VN_ONLY = new Set(['weight.luong', 'area.sao', 'area.mau']);
const isVi = currentLang() === 'vi';
const unitsOf = (c: Category) => c.units.filter((u) => isVi || !VN_ONLY.has(`${c.id}.${u.id}`));

const st = storage<{ cat: string; v: string; sel: Record<string, [string, string]> }>('unit-convert', { cat: 'length', v: '1', sel: {} });
let { cat, v, sel } = st.get();
if (!CATEGORIES.some((c) => c.id === cat)) cat = 'length';

$('#tool-root').innerHTML = `
  <div class="tabs" role="tablist" id="cats" style="margin-top:24px;flex-wrap:wrap">
    ${CATEGORIES.map((c) => `<button type="button" role="tab" data-cat="${c.id}">${CAT_NAMES[c.id]}</button>`).join('')}
  </div>
  <div class="workspace tool-body">
    <section class="panel">
      <div class="field-row">
        <label class="field"><span class="field-label">${T('value', 'Giá trị')}</span><input type="text" inputmode="decimal" id="val" class="input-inline" style="font-size:1.25rem;padding:10px 12px" /></label>
      </div>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('from', 'Từ')}</span><select id="from"></select></label>
        <button type="button" class="btn" id="swap" title="${T('swap', 'Đổi chiều')}" aria-label="${T('swap', 'Đổi chiều')}" style="align-self:flex-end">⇄</button>
        <label class="field"><span class="field-label">${T('to', 'Sang')}</span><select id="to"></select></label>
      </div>
      <div class="stat stat--main"><span class="stat-label" id="eq-label"></span><span class="stat-value" id="eq" style="overflow-wrap:anywhere"></span></div>
      <p class="formula" id="formula"></p>
    </section>
    <section class="panel">
      <div class="panel-title" style="margin:0">${T('all', 'Đổi sang mọi đơn vị')}</div>
      <div class="table-wrap"><table class="data-table unit-table" id="table"></table></div>
    </section>
  </div>
`;

const valEl = $<HTMLInputElement>('#val');
const fromEl = $<HTMLSelectElement>('#from');
const toEl = $<HTMLSelectElement>('#to');
valEl.value = v;

const fmt = (n: number) => {
  if (!Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a !== 0 && (a >= 1e15 || a < 1e-7)) return n.toExponential(6);
  return n.toLocaleString(LOCALE, { maximumSignificantDigits: 10 });
};
const curCat = () => CATEGORIES.find((c) => c.id === cat) as Category;

function setCat(id: string): void {
  cat = id;
  const c = curCat();
  document.querySelectorAll<HTMLButtonElement>('[data-cat]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.cat === id)));
  const opts = unitsOf(c).map((u) => `<option value="${u.id}">${escapeHtml(U[`${c.id}.${u.id}`] ?? u.id)} (${escapeHtml(u.symbol)})</option>`).join('');
  fromEl.innerHTML = opts;
  toEl.innerHTML = opts;
  const [f, t] = sel[id] ?? [c.defFrom, c.defTo];
  fromEl.value = f;
  toEl.value = t;
  render();
}

function render(): void {
  const c = curCat();
  sel[cat] = [fromEl.value, toEl.value];
  st.set({ cat, v: valEl.value, sel });
  const x = parseNumber(valEl.value);
  const uf = c.units.find((u) => u.id === fromEl.value)!;
  const ut = c.units.find((u) => u.id === toEl.value)!;
  if (!Number.isFinite(x)) {
    $('#eq').textContent = '—';
    $('#eq-label').textContent = T('enterNum', 'Nhập một số');
    $('#table').innerHTML = '';
    $('#formula').textContent = '';
    return;
  }
  const r = convert(c, x, uf.id, ut.id);
  $('#eq-label').textContent = `${fmt(x)} ${uf.symbol} =`;
  $('#eq').textContent = `${fmt(r)} ${ut.symbol}`;
  $('#formula').textContent = uf.f && ut.f ? `1 ${uf.symbol} = ${fmt(uf.f / ut.f)} ${ut.symbol}` : '';
  $('#table').innerHTML = `<tbody>${unitsOf(c)
    .map((u) => `<tr class="${u.id === uf.id ? 'is-from' : ''}"><td>${escapeHtml(U[`${c.id}.${u.id}`] ?? u.id)}</td><td>${escapeHtml(fmt(convert(c, x, uf.id, u.id)))} ${escapeHtml(u.symbol)}</td></tr>`)
    .join('')}</tbody>`;
}

$('#cats').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-cat]');
  if (b) setCat(b.dataset.cat as string);
});
valEl.addEventListener('input', render);
fromEl.addEventListener('change', render);
toEl.addEventListener('change', render);
$('#swap').addEventListener('click', () => {
  const f = fromEl.value;
  fromEl.value = toEl.value;
  toEl.value = f;
  render();
});
setCat(cat);
