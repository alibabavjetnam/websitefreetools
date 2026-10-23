import { mountLayout } from '../layout';
import { $, escapeHtml, storage } from '../ui';
import { ACTIVITIES, caloriesBurned } from '../calc/health';
import { pageText, localeTag } from '../i18n';

mountLayout({ activeTool: 'calo-burn' });
const T = pageText();

interface Row { id: string; actIndex: number; minutes: number }
const weightStore = storage<number>('calo-burn-weight', 60);
let rows: Row[] = [{ id: 'r1', actIndex: 4, minutes: 30 }];

const groups = [...new Set(ACTIVITIES.map((a) => a.groupKey))];
const vi = (n: number, d = 0) => n.toLocaleString(localeTag(), { maximumFractionDigits: d });
const newId = () => Math.random().toString(36).slice(2, 8);

const root = $('#tool-root');
root.innerHTML = `
  <div class="panel code-toolbar">
    <label class="field field--inline"><span class="field-label">${T('weight','Cân nặng (kg)')}</span><input type="number" id="weight" min="20" max="250" step="0.5" value="${weightStore.get()}" /></label>
    <div class="actions"><button type="button" class="btn" id="addrow">${T('addRow','+ Thêm hoạt động')}</button></div>
  </div>
  <div id="rows" style="margin-top:16px"></div>
  <div class="stat-grid" id="summary" style="margin-top:16px"></div>
  <p class="note">${T('note','Ước tính dựa trên chỉ số MET (mức tiêu hao năng lượng) chuẩn quốc tế: calo = MET × 3,5 × cân nặng (kg) ÷ 200 × số phút. Kết quả mang tính tham khảo, thay đổi theo cường độ và thể trạng từng người.')}</p>
`;

function optionsHtml(sel: number): string {
  return groups.map((g) => `<optgroup label="${escapeHtml(T('grp.' + g, ACTIVITIES.find((a) => a.groupKey === g)!.group))}">${ACTIVITIES.map((a, i) => a.groupKey === g ? `<option value="${i}"${i === sel ? ' selected' : ''}>${escapeHtml(T('act.' + a.key, a.name))} (MET ${a.met})</option>` : '').join('')}</optgroup>`).join('');
}

function render(): void {
  const w = Number($<HTMLInputElement>('#weight').value) || 0;
  $('#rows').innerHTML = rows.map((r) => {
    const a = ACTIVITIES[r.actIndex];
    const kcal = w > 0 ? caloriesBurned(a.met, w, r.minutes) : 0;
    return `<div class="panel burn-row" data-id="${r.id}">
      <label class="field" style="flex:2"><span class="field-label">${T('activity','Hoạt động')}</span><select data-act>${optionsHtml(r.actIndex)}</select></label>
      <label class="field"><span class="field-label">${T('minutes','Số phút')}</span><input type="number" data-min min="1" max="1440" value="${r.minutes}" /></label>
      <div class="burn-result"><span class="field-label">${T('burn','Tiêu hao')}</span><b>${vi(kcal)} kcal</b></div>
      ${rows.length > 1 ? `<button type="button" class="btn btn-sm" data-del aria-label="${T('del','Xoá')}">✕</button>` : ''}
    </div>`;
  }).join('');
  const total = w > 0 ? rows.reduce((s, r) => s + caloriesBurned(ACTIVITIES[r.actIndex].met, w, r.minutes), 0) : 0;
  const mins = rows.reduce((s, r) => s + r.minutes, 0);
  $('#summary').innerHTML = `
    <div class="stat"><span class="stat-label">${T('totalTime','Tổng thời gian')}</span><span class="stat-value">${vi(mins)} ${T('unit.min','phút')}</span></div>
    <div class="stat stat--main"><span class="stat-label">${T('totalBurn','Tổng calo tiêu hao')}</span><span class="stat-value">${vi(total)} kcal</span></div>
    <div class="stat"><span class="stat-label">${T('equiv','Tương đương')}</span><span class="stat-value">${vi(total / 7.7, 0)} ${T('unit.fat','g mỡ')}</span></div>`;
}

$('#rows').addEventListener('input', (e) => {
  const row = (e.target as HTMLElement).closest<HTMLElement>('[data-id]');
  if (!row) return;
  const r = rows.find((x) => x.id === row.dataset.id)!;
  const t = e.target as HTMLElement;
  if (t.hasAttribute('data-act')) r.actIndex = Number((t as HTMLSelectElement).value);
  if (t.hasAttribute('data-min')) r.minutes = Math.max(1, Number((t as HTMLInputElement).value) || 1);
  render();
});
$('#rows').addEventListener('click', (e) => {
  const row = (e.target as HTMLElement).closest<HTMLElement>('[data-id]');
  if (row && (e.target as HTMLElement).closest('[data-del]')) {
    rows = rows.filter((x) => x.id !== row.dataset.id);
    render();
  }
});
$('#addrow').addEventListener('click', () => { rows.push({ id: newId(), actIndex: 0, minutes: 30 }); render(); });
$('#weight').addEventListener('input', () => { weightStore.set(Number($<HTMLInputElement>('#weight').value) || 60); render(); });
render();
