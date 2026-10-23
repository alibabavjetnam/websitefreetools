import { mountLayout } from '../layout';
import { $, escapeHtml, storage } from '../ui';
import { FOODS, type Food } from '../data/foods';
import { pageText, currentLang } from '../i18n';

mountLayout({ activeTool: 'meal-calo' });
const T = pageText();
const LOCALE = ({ en: 'en-US', vi: 'vi-VN', ja: 'ja-JP', zh: 'zh-CN', es: 'es-ES', de: 'de-DE', ru: 'ru-RU', fr: 'fr-FR', pt: 'pt-BR', it: 'it-IT', tr: 'tr-TR', nl: 'nl-NL' } as Record<string, string>)[currentLang()] || 'en-US';
const MEAL_KEY: Record<string, string> = { 'Sáng': 'breakfast', 'Trưa': 'lunch', 'Tối': 'dinner', 'Phụ': 'snack' };
const mealLabel = (m: string): string => T('meal.' + (MEAL_KEY[m] || m), m);
const FG_KEY: Record<string, string> = { 'Cơm & bún phở': 'rice', 'Bánh': 'cake', 'Thịt & cá': 'meatfish', 'Rau củ': 'veggie', 'Trái cây': 'fruit', 'Đồ uống': 'drink', 'Ăn vặt': 'snack' };
const fgLabel = (g: string): string => T('fg.' + (FG_KEY[g] || g), g);

const foodLabel = (f: Food): string => T('food.' + f.key, f.name);
const FOOD_BY_NAME = new Map(FOODS.map((f) => [f.name, f]));
const FOOD_BY_KEY = new Map(FOODS.map((f) => [f.key, f]));
/** Tên món hiển thị theo ngôn ngữ. Mục cũ lưu trước khi có `key` được tra theo tên tiếng Việt. */
const entryName = (e: { key?: string; name: string }): string => {
  const f = e.key ? FOOD_BY_KEY.get(e.key) : FOOD_BY_NAME.get(e.name);
  return f ? foodLabel(f) : e.name;
};
const UNIT_KEY: Record<string, string> = { 'chén': 'bowlS', 'tô': 'bowl', 'suất': 'portion', 'gói': 'pack', 'ổ': 'loaf', 'cái': 'piece', 'quả': 'piece', 'đĩa': 'plate', 'trái': 'ear', 'lát': 'slice', 'ly': 'glass', 'lon': 'can', 'miếng': 'chunk', 'cây': 'stick' };
/** Dịch khẩu phần dạng "1 tô", "1 chén (150g)"; dạng chỉ có đơn vị khối lượng như "100g" giữ nguyên. */
const servingLabel = (s: string): string => {
  const m = /^(\d+(?:[.,]\d+)?)\s+(\S+)(?:\s+\((.+)\))?$/.exec(s);
  const k = m && UNIT_KEY[m[2]];
  if (!m || !k) return s;
  return T('unit.' + k, `{n} ${m[2]}`).replace('{n}', m[1]) + (m[3] ? ` (${m[3]})` : '');
};

interface Entry { id: string; key?: string; name: string; meal: string; kcal: number; protein: number; carb: number; fat: number; qty: number }
type DayData = Record<string, Entry[]>; // key = YYYY-MM-DD
const store = storage<DayData>('meal-calo', {});
const targetStore = storage<number>('meal-calo-target', 2000);

const MEALS = ['Sáng', 'Trưa', 'Tối', 'Phụ'];
const todayKey = () => new Date().toLocaleDateString('en-CA');
let day = todayKey();
const vi = (n: number, d = 0) => n.toLocaleString(LOCALE, { maximumFractionDigits: d });
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const groups = [...new Set(FOODS.map((f) => f.group))];

const root = $('#tool-root');
root.innerHTML = `
  <div class="panel meal-toolbar">
    <label class="field field--inline"><span class="field-label">${T('date','Ngày')}</span><input type="date" id="day" value="${day}" /></label>
    <label class="field field--inline"><span class="field-label">${T('target','Mục tiêu calo/ngày')}</span><input type="number" id="target" min="800" max="6000" step="50" value="${targetStore.get()}" /></label>
  </div>
  <div class="workspace meal-main">
    <div class="panel">
      <div class="panel-title">${T('addDish','Thêm món')}</div>
      <div class="field-row">
        <label class="field" style="flex:2"><span class="field-label">${T('chooseDish','Chọn món có sẵn')}</span>
          <select id="food"><option value="">${T('selectDish','— Chọn món —')}</option>${groups.map((g) => `<optgroup label="${escapeHtml(fgLabel(g))}">${FOODS.filter((f) => f.group === g).map((f, i) => `<option value="${g}|${i}">${escapeHtml(foodLabel(f))} (${f.kcal} kcal/${escapeHtml(servingLabel(f.serving))})</option>`).join('')}</optgroup>`).join('')}</select>
        </label>
        <label class="field"><span class="field-label">${T('meal','Bữa')}</span><select id="meal">${MEALS.map((m) => `<option value="${m}">${mealLabel(m)}</option>`).join('')}</select></label>
        <label class="field"><span class="field-label">${T('servings','Số phần')}</span><input type="number" id="qty" min="0.5" step="0.5" value="1" /></label>
      </div>
      <div class="actions"><button type="button" class="btn btn-primary" id="add">${T('addToMenu','Thêm vào thực đơn')}</button></div>
      <details class="meal-custom"><summary>${T('customDish','Nhập món tự do (nếu không có trong danh sách)')}</summary>
        <div class="field-row" style="margin-top:10px">
          <label class="field" style="flex:2"><span class="field-label">${T('dishName','Tên món')}</span><input type="text" id="c-name" maxlength="60" /></label>
          <label class="field"><span class="field-label">${T('calo','Calo')}</span><input type="number" id="c-kcal" min="0" /></label>
          <label class="field"><span class="field-label">${T('meal','Bữa')}</span><select id="c-meal">${MEALS.map((m) => `<option value="${m}">${mealLabel(m)}</option>`).join('')}</select></label>
        </div>
        <div class="actions"><button type="button" class="btn" id="c-add">${T('addCustom','Thêm món tự do')}</button></div>
      </details>
    </div>
    <section class="preview">
      <div class="panel" id="summary"></div>
    </section>
  </div>
  <div id="menu-list" style="margin-top:20px"></div>
  <p class="note">${T('note','Số liệu calo và dinh dưỡng là ước lượng cho khẩu phần trung bình, dùng để tham khảo. Dữ liệu lưu trên trình duyệt của bạn.')}</p>
`;

function getDay(): Entry[] {
  return store.get()[day] ?? [];
}
function setDay(entries: Entry[]): void {
  const all = store.get();
  if (entries.length) all[day] = entries;
  else delete all[day];
  store.set(all);
}

function render(): void {
  const entries = getDay();
  const target = targetStore.get();
  const tot = entries.reduce((a, e) => ({ kcal: a.kcal + e.kcal * e.qty, protein: a.protein + e.protein * e.qty, carb: a.carb + e.carb * e.qty, fat: a.fat + e.fat * e.qty }), { kcal: 0, protein: 0, carb: 0, fat: 0 });
  const pct = target ? Math.min(100, (tot.kcal / target) * 100) : 0;
  const remain = target - tot.kcal;
  $('#summary').innerHTML = `
    <div class="panel-title">${T('daySummary','Tổng kết ngày')} ${day.split('-').reverse().join('/')}</div>
    <div class="ring-wrap"><svg viewBox="0 0 120 120" class="ring"><circle cx="60" cy="60" r="52" class="ring-bg"/><circle cx="60" cy="60" r="52" class="ring-fg" style="stroke-dasharray:${(pct / 100) * 326.7} 326.7"/></svg>
      <div class="ring-center"><b>${vi(tot.kcal)}</b><span>/ ${vi(target)} kcal</span></div></div>
    <p class="meal-remain ${remain < 0 ? 'over' : ''}">${remain >= 0 ? `${T('remaining','Còn lại')} ${vi(remain)} kcal` : `${T('over','Vượt')} ${vi(-remain)} kcal`}</p>
    <div class="macro-row">
      <div class="macro"><span>${T('protein','Đạm')}</span><b>${vi(tot.protein)}g</b></div>
      <div class="macro"><span>${T('carb','Tinh bột')}</span><b>${vi(tot.carb)}g</b></div>
      <div class="macro"><span>${T('fat','Chất béo')}</span><b>${vi(tot.fat)}g</b></div>
    </div>`;

  $('#menu-list').innerHTML = MEALS.map((m) => {
    const list = entries.filter((e) => e.meal === m);
    if (!list.length) return '';
    const mk = list.reduce((a, e) => a + e.kcal * e.qty, 0);
    return `<div class="meal-group"><h3>${mealLabel(m)} <span class="note">${vi(mk)} kcal</span></h3>
      <table class="data-table data-table--compact"><tbody>${list.map((e) => `<tr>
        <td>${escapeHtml(entryName(e))}${e.qty !== 1 ? ` ×${vi(e.qty, 1)}` : ''}</td>
        <td>${vi(e.kcal * e.qty)} kcal</td>
        <td><button type="button" class="btn btn-sm" data-del="${e.id}">${T('del','Xoá')}</button></td></tr>`).join('')}</tbody></table></div>`;
  }).join('') || `<p class="note">${T('emptyDay','Chưa có món nào cho ngày này. Chọn món và bấm "Thêm vào thực đơn".')}</p>`;
}

$('#add').addEventListener('click', () => {
  const v = $<HTMLSelectElement>('#food').value;
  if (!v) return;
  const [g, i] = v.split('|');
  const f = FOODS.filter((x) => x.group === g)[Number(i)] as Food;
  const qty = Math.max(0.5, Number($<HTMLInputElement>('#qty').value) || 1);
  setDay([...getDay(), { id: newId(), key: f.key, name: f.name, meal: $<HTMLSelectElement>('#meal').value, kcal: f.kcal, protein: f.protein, carb: f.carb, fat: f.fat, qty }]);
  render();
});
$('#c-add').addEventListener('click', () => {
  const name = $<HTMLInputElement>('#c-name').value.trim();
  const kcal = Number($<HTMLInputElement>('#c-kcal').value) || 0;
  if (!name || kcal <= 0) return;
  setDay([...getDay(), { id: newId(), name, meal: $<HTMLSelectElement>('#c-meal').value, kcal, protein: 0, carb: 0, fat: 0, qty: 1 }]);
  $<HTMLInputElement>('#c-name').value = '';
  $<HTMLInputElement>('#c-kcal').value = '';
  render();
});
$('#menu-list').addEventListener('click', (e) => {
  const id = (e.target as HTMLElement).closest<HTMLElement>('[data-del]')?.dataset.del;
  if (!id) return;
  setDay(getDay().filter((x) => x.id !== id));
  render();
});
$('#day').addEventListener('change', () => { day = $<HTMLInputElement>('#day').value || todayKey(); render(); });
$('#target').addEventListener('input', () => { targetStore.set(Number($<HTMLInputElement>('#target').value) || 2000); render(); });
render();
