import { mountLayout } from '../layout';
import { $, storage } from '../ui';
import { ACTIVITY_LEVELS, bmi, bmr, tdee, waistHipRisk, type Sex } from '../calc/health';
import { pageText, localeTag } from '../i18n';

mountLayout({ activeTool: 'bmi-bmr' });
const T = pageText();
const catCode = (v: number) => (v < 18.5 ? 'under' : v < 23 ? 'normal' : v < 25 ? 'over' : v < 30 ? 'obese1' : 'obese2');
const riskCode = (ratio: number, sex: Sex) => { const hi = sex === 'male' ? 0.9 : 0.85, mid = sex === 'male' ? 0.85 : 0.8; return ratio >= hi ? 'high' : ratio >= mid ? 'mid' : 'low'; };

interface Form { sex: Sex; age: number; height: number; weight: number; activity: string; waist: number; hip: number }
const store = storage<Form>('bmi-bmr', { sex: 'male', age: 28, height: 170, weight: 65, activity: 'light', waist: 0, hip: 0 });

const root = $('#tool-root');
root.innerHTML = `
  <div class="workspace">
    <form class="panel" id="form" novalidate>
      <fieldset class="field">
        <legend>${T('sex','Giới tính')}</legend>
        <div class="format-list">
          <label class="format-option"><input type="radio" name="sex" value="male" /><span class="format-name">${T('male','Nam')}</span></label>
          <label class="format-option"><input type="radio" name="sex" value="female" /><span class="format-name">${T('female','Nữ')}</span></label>
        </div>
      </fieldset>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('age','Tuổi')}</span><input type="number" id="age" min="10" max="120" /></label>
        <label class="field"><span class="field-label">${T('height','Chiều cao (cm)')}</span><input type="number" id="height" min="100" max="230" /></label>
        <label class="field"><span class="field-label">${T('weight','Cân nặng (kg)')}</span><input type="number" id="weight" min="25" max="300" step="0.1" /></label>
      </div>
      <label class="field"><span class="field-label">${T('activity','Mức vận động')}</span>
        <select id="activity">${ACTIVITY_LEVELS.map((a) => `<option value="${a.id}">${T('actlvl.' + a.id, a.label)} — ${T('actlvl.' + a.id + '.hint', a.hint)}</option>`).join('')}</select>
      </label>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('waist','Vòng eo (cm, tuỳ chọn)')}</span><input type="number" id="waist" min="0" max="200" /></label>
        <label class="field"><span class="field-label">${T('hip','Vòng hông (cm, tuỳ chọn)')}</span><input type="number" id="hip" min="0" max="200" /></label>
      </div>
    </form>
    <section class="preview">
      <div class="panel" id="bmi-card"></div>
      <div class="stat-grid" id="energy"></div>
      <div class="panel" id="goals"></div>
    </section>
  </div>
  <p class="note">${T('note','BMI phân loại theo ngưỡng châu Á (phù hợp người Việt): bình thường 18,5–22,9. BMR tính theo công thức Mifflin–St Jeor; TDEE là tổng năng lượng tiêu hao mỗi ngày. Số liệu chỉ để tham khảo, không thay cho tư vấn của bác sĩ hoặc chuyên gia dinh dưỡng.')}</p>
`;

const vi = (n: number, d = 0) => n.toLocaleString(localeTag(), { maximumFractionDigits: d });

function read(): Form {
  return {
    sex: (root.querySelector<HTMLInputElement>('input[name="sex"]:checked')?.value ?? 'male') as Sex,
    age: Number($<HTMLInputElement>('#age').value) || 0,
    height: Number($<HTMLInputElement>('#height').value) || 0,
    weight: Number($<HTMLInputElement>('#weight').value) || 0,
    activity: $<HTMLSelectElement>('#activity').value,
    waist: Number($<HTMLInputElement>('#waist').value) || 0,
    hip: Number($<HTMLInputElement>('#hip').value) || 0,
  };
}

function render(): void {
  const f = read();
  store.set(f);
  if (f.height < 100 || f.weight < 25 || f.age < 10) {
    $('#bmi-card').innerHTML = `<p class="note">${T('prompt','Nhập tuổi, chiều cao và cân nặng hợp lệ để xem kết quả.')}</p>`;
    $('#energy').innerHTML = '';
    $('#goals').innerHTML = '';
    return;
  }
  const b = bmi(f.weight, f.height);
  const pct = Math.max(0, Math.min(100, ((b.bmi - 15) / (35 - 15)) * 100));
  const whr = f.waist > 0 && f.hip > 0 ? waistHipRisk(f.waist, f.hip, f.sex) : null;
  $('#bmi-card').innerHTML = `
    <div class="bmi-top"><div><div class="bmi-value">${vi(b.bmi, 1)}</div><div class="bmi-cat">${T('cat.' + catCode(b.bmi), b.category)}</div></div>
      <div class="note">${T('healthy','Cân nặng khoẻ mạnh')}: <b>${vi(b.healthyMin, 1)}–${vi(b.healthyMax, 1)} kg</b></div></div>
    <div class="bmi-bar"><span class="bmi-seg s1"></span><span class="bmi-seg s2"></span><span class="bmi-seg s3"></span><span class="bmi-seg s4"></span><span class="bmi-marker" style="left:${pct}%"></span></div>
    <div class="bmi-scale"><span>${T('scale.under','Thiếu cân')}</span><span>${T('scale.normal','Bình thường')}</span><span>${T('scale.over','Thừa cân')}</span><span>${T('scale.obese','Béo phì')}</span></div>
    ${whr ? `<p class="note" style="margin-top:12px">${T('whr','Tỷ lệ eo/hông')}: <b>${vi(whr.ratio, 2)}</b> — ${T('risk.' + riskCode(whr.ratio, f.sex), whr.level)}</p>` : ''}`;

  const bmrV = bmr(f.sex, f.weight, f.height, f.age);
  const factor = ACTIVITY_LEVELS.find((a) => a.id === f.activity)!.factor;
  const tdeeV = tdee(bmrV, factor);
  $('#energy').innerHTML = `
    <div class="stat"><span class="stat-label">${T('bmr','BMR (năng lượng nghỉ)')}</span><span class="stat-value">${vi(bmrV)} kcal</span></div>
    <div class="stat stat--main"><span class="stat-label">${T('tdee','TDEE (tiêu hao/ngày)')}</span><span class="stat-value">${vi(tdeeV)} kcal</span></div>`;
  $('#goals').innerHTML = `
    <div class="panel-title">${T('goals.title','Gợi ý calo theo mục tiêu')}</div>
    <table class="data-table data-table--compact"><tbody>
      <tr><td>${T('goal.lose','Giảm cân (−0,5 kg/tuần)')}</td><td><b>${vi(tdeeV - 500)} ${T('unit.kcalDay','kcal/ngày')}</b></td></tr>
      <tr><td>${T('goal.keep','Giữ cân')}</td><td><b>${vi(tdeeV)} ${T('unit.kcalDay','kcal/ngày')}</b></td></tr>
      <tr><td>${T('goal.gain','Tăng cân (+0,5 kg/tuần)')}</td><td><b>${vi(tdeeV + 500)} ${T('unit.kcalDay','kcal/ngày')}</b></td></tr>
    </tbody></table>`;
}

// Khởi tạo từ dữ liệu đã lưu
const f0 = store.get();
(root.querySelector(`input[name="sex"][value="${f0.sex}"]`) as HTMLInputElement).checked = true;
$<HTMLInputElement>('#age').value = String(f0.age);
$<HTMLInputElement>('#height').value = String(f0.height);
$<HTMLInputElement>('#weight').value = String(f0.weight);
$<HTMLSelectElement>('#activity').value = f0.activity;
if (f0.waist) $<HTMLInputElement>('#waist').value = String(f0.waist);
if (f0.hip) $<HTMLInputElement>('#hip').value = String(f0.hip);

$('#form').addEventListener('input', render);
render();
