import { mountLayout } from '../layout';
import { $, escapeHtml, storage } from '../ui';
import { FOODS, type Food } from '../data/foods';

mountLayout({ activeTool: 'meal-calo' });

interface Entry { id: string; name: string; meal: string; kcal: number; protein: number; carb: number; fat: number; qty: number }
type DayData = Record<string, Entry[]>; // key = YYYY-MM-DD
const store = storage<DayData>('meal-calo', {});
const targetStore = storage<number>('meal-calo-target', 2000);

const MEALS = ['Sáng', 'Trưa', 'Tối', 'Phụ'];
const todayKey = () => new Date().toLocaleDateString('en-CA');
let day = todayKey();
const vi = (n: number, d = 0) => n.toLocaleString('vi-VN', { maximumFractionDigits: d });
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const groups = [...new Set(FOODS.map((f) => f.group))];

const root = $('#tool-root');
root.innerHTML = `
  <div class="panel meal-toolbar">
    <label class="field field--inline"><span class="field-label">Ngày</span><input type="date" id="day" value="${day}" /></label>
    <label class="field field--inline"><span class="field-label">Mục tiêu calo/ngày</span><input type="number" id="target" min="800" max="6000" step="50" value="${targetStore.get()}" /></label>
  </div>
  <div class="workspace meal-main">
    <div class="panel">
      <div class="panel-title">Thêm món</div>
      <div class="field-row">
        <label class="field" style="flex:2"><span class="field-label">Chọn món có sẵn</span>
          <select id="food"><option value="">— Chọn món —</option>${groups.map((g) => `<optgroup label="${escapeHtml(g)}">${FOODS.filter((f) => f.group === g).map((f, i) => `<option value="${g}|${i}">${escapeHtml(f.name)} (${f.kcal} kcal/${escapeHtml(f.serving)})</option>`).join('')}</optgroup>`).join('')}</select>
        </label>
        <label class="field"><span class="field-label">Bữa</span><select id="meal">${MEALS.map((m) => `<option>${m}</option>`).join('')}</select></label>
        <label class="field"><span class="field-label">Số phần</span><input type="number" id="qty" min="0.5" step="0.5" value="1" /></label>
      </div>
      <div class="actions"><button type="button" class="btn btn-primary" id="add">Thêm vào thực đơn</button></div>
      <details class="meal-custom"><summary>Nhập món tự do (nếu không có trong danh sách)</summary>
        <div class="field-row" style="margin-top:10px">
          <label class="field" style="flex:2"><span class="field-label">Tên món</span><input type="text" id="c-name" maxlength="60" /></label>
          <label class="field"><span class="field-label">Calo</span><input type="number" id="c-kcal" min="0" /></label>
          <label class="field"><span class="field-label">Bữa</span><select id="c-meal">${MEALS.map((m) => `<option>${m}</option>`).join('')}</select></label>
        </div>
        <div class="actions"><button type="button" class="btn" id="c-add">Thêm món tự do</button></div>
      </details>
    </div>
    <section class="preview">
      <div class="panel" id="summary"></div>
    </section>
  </div>
  <div id="menu-list" style="margin-top:20px"></div>
  <p class="note">Số liệu calo và dinh dưỡng là ước lượng cho khẩu phần trung bình, dùng để tham khảo. Dữ liệu lưu trên trình duyệt của bạn.</p>
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
    <div class="panel-title">Tổng kết ngày ${day.split('-').reverse().join('/')}</div>
    <div class="ring-wrap"><svg viewBox="0 0 120 120" class="ring"><circle cx="60" cy="60" r="52" class="ring-bg"/><circle cx="60" cy="60" r="52" class="ring-fg" style="stroke-dasharray:${(pct / 100) * 326.7} 326.7"/></svg>
      <div class="ring-center"><b>${vi(tot.kcal)}</b><span>/ ${vi(target)} kcal</span></div></div>
    <p class="meal-remain ${remain < 0 ? 'over' : ''}">${remain >= 0 ? `Còn lại ${vi(remain)} kcal` : `Vượt ${vi(-remain)} kcal`}</p>
    <div class="macro-row">
      <div class="macro"><span>Đạm</span><b>${vi(tot.protein)}g</b></div>
      <div class="macro"><span>Tinh bột</span><b>${vi(tot.carb)}g</b></div>
      <div class="macro"><span>Chất béo</span><b>${vi(tot.fat)}g</b></div>
    </div>`;

  $('#menu-list').innerHTML = MEALS.map((m) => {
    const list = entries.filter((e) => e.meal === m);
    if (!list.length) return '';
    const mk = list.reduce((a, e) => a + e.kcal * e.qty, 0);
    return `<div class="meal-group"><h3>${m} <span class="note">${vi(mk)} kcal</span></h3>
      <table class="data-table data-table--compact"><tbody>${list.map((e) => `<tr>
        <td>${escapeHtml(e.name)}${e.qty !== 1 ? ` ×${vi(e.qty, 1)}` : ''}</td>
        <td>${vi(e.kcal * e.qty)} kcal</td>
        <td><button type="button" class="btn btn-sm" data-del="${e.id}">Xoá</button></td></tr>`).join('')}</tbody></table></div>`;
  }).join('') || '<p class="note">Chưa có món nào cho ngày này. Chọn món và bấm "Thêm vào thực đơn".</p>';
}

$('#add').addEventListener('click', () => {
  const v = $<HTMLSelectElement>('#food').value;
  if (!v) return;
  const [g, i] = v.split('|');
  const f = FOODS.filter((x) => x.group === g)[Number(i)] as Food;
  const qty = Math.max(0.5, Number($<HTMLInputElement>('#qty').value) || 1);
  setDay([...getDay(), { id: newId(), name: f.name, meal: $<HTMLSelectElement>('#meal').value, kcal: f.kcal, protein: f.protein, carb: f.carb, fat: f.fat, qty }]);
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
