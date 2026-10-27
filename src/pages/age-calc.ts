import { mountLayout } from '../layout';
import { $, fmtInt, storage } from '../ui';
import { pageText, localeTag } from '../i18n';
import { parseKey, todayKey, daysBetween, ymd, nextBirthday, zodiac, chineseAnimal, addMonths } from '../calc/dates';

mountLayout({ activeTool: 'age-calc' });
const T = pageText();
const LOCALE = localeTag();

const ZODIAC: Record<string, string> = {
  aries: T('z.aries', 'Bạch Dương ♈'), taurus: T('z.taurus', 'Kim Ngưu ♉'), gemini: T('z.gemini', 'Song Tử ♊'), cancer: T('z.cancer', 'Cự Giải ♋'),
  leo: T('z.leo', 'Sư Tử ♌'), virgo: T('z.virgo', 'Xử Nữ ♍'), libra: T('z.libra', 'Thiên Bình ♎'), scorpio: T('z.scorpio', 'Bọ Cạp ♏'),
  sagittarius: T('z.sagittarius', 'Nhân Mã ♐'), capricorn: T('z.capricorn', 'Ma Kết ♑'), aquarius: T('z.aquarius', 'Bảo Bình ♒'), pisces: T('z.pisces', 'Song Ngư ♓'),
};
const ANIMAL: Record<string, string> = {
  rat: T('a.rat', 'Tý (Chuột)'), ox: T('a.ox', 'Sửu (Trâu)'), tiger: T('a.tiger', 'Dần (Hổ)'), rabbit: T('a.rabbit', 'Mão (Mèo)'),
  dragon: T('a.dragon', 'Thìn (Rồng)'), snake: T('a.snake', 'Tỵ (Rắn)'), horse: T('a.horse', 'Ngọ (Ngựa)'), goat: T('a.goat', 'Mùi (Dê)'),
  monkey: T('a.monkey', 'Thân (Khỉ)'), rooster: T('a.rooster', 'Dậu (Gà)'), dog: T('a.dog', 'Tuất (Chó)'), pig: T('a.pig', 'Hợi (Lợn)'),
};

const st = storage<{ birth: string; at: string }>('age-calc', { birth: '', at: '' });
const s0 = st.get();
$('#tool-root').innerHTML = `
  <div class="workspace">
    <form class="panel" id="form" novalidate>
      <label class="field"><span class="field-label">${T('birth', 'Ngày sinh')}</span><input type="date" id="birth" max="9999-12-31" /></label>
      <label class="field"><span class="field-label">${T('at', 'Tính tuổi vào ngày')}</span><input type="date" id="at" /></label>
      <button type="button" class="btn btn-sm" id="today" style="align-self:flex-start">${T('today', 'Đặt về hôm nay')}</button>
      <p class="note">${T('note', 'Tuổi tính theo cách thông thường: tròn một năm khi qua ngày sinh nhật. Người sinh 29/2 được tính sinh nhật vào 28/2 trong năm không nhuận.')}</p>
    </form>
    <section class="preview">
      <div class="stat stat--main"><span class="stat-label">${T('age', 'Tuổi của bạn')}</span><span class="stat-value" id="age">—</span></div>
      <div class="stat-grid" id="stats"></div>
      <div class="panel" id="extra"></div>
    </section>
  </div>
`;
const birthEl = $<HTMLInputElement>('#birth');
const atEl = $<HTMLInputElement>('#at');
birthEl.value = s0.birth || '2000-01-15';
atEl.value = s0.at || todayKey();

const longDate = (d: Date) => d.toLocaleDateString(LOCALE, { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const stat = (label: string, value: string) => `<div class="stat"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`;

function render(): void {
  st.set({ birth: birthEl.value, at: atEl.value === todayKey() ? '' : atEl.value });
  const b = parseKey(birthEl.value);
  const a = parseKey(atEl.value);
  if (!b || !a) { $('#age').textContent = '—'; $('#stats').innerHTML = ''; $('#extra').innerHTML = `<p class="note">${T('pick', 'Chọn ngày sinh để xem kết quả.')}</p>`; return; }
  if (b > a) { $('#age').textContent = '—'; $('#stats').innerHTML = ''; $('#extra').innerHTML = `<p class="error">${T('future', 'Ngày sinh đang sau ngày tính tuổi. Hãy kiểm tra lại năm sinh.')}</p>`; return; }
  const r = ymd(b, a);
  const days = daysBetween(b, a);
  $('#age').textContent = `${fmtInt(r.y)} ${T('years', 'tuổi')}, ${fmtInt(r.m)} ${T('months', 'tháng')}, ${fmtInt(r.d)} ${T('days', 'ngày')}`;
  const months = r.y * 12 + r.m;
  $('#stats').innerHTML = [
    stat(T('totalMonths', 'Tổng số tháng'), fmtInt(months)),
    stat(T('totalWeeks', 'Tổng số tuần'), `${fmtInt(Math.floor(days / 7))} ${T('weeks', 'tuần')} ${days % 7 ? `${days % 7} ${T('days', 'ngày')}` : ''}`),
    stat(T('totalDays', 'Tổng số ngày đã sống'), fmtInt(days)),
    stat(T('totalHours', 'Tổng số giờ (xấp xỉ)'), fmtInt(days * 24)),
  ].join('');
  const nb = nextBirthday(b, a);
  const left = daysBetween(a, nb);
  const turning = r.y + (left === 0 ? 0 : 1);
  // Mốc 10.000 ngày tuổi và các mốc tròn tháng sắp tới
  const ms10k = new Date(b.getTime() + 10000 * 86400000);
  $('#extra').innerHTML = `
    <div class="panel-title" style="margin:0">${left === 0 ? T('happy', '🎉 Chúc mừng sinh nhật!') : T('nextBd', 'Sinh nhật tiếp theo')}</div>
    <ul class="plain-list">
      <li>${left === 0 ? `${T('turnToday', 'Hôm nay bạn tròn')} <b>${fmtInt(turning)}</b> ${T('years', 'tuổi')}` : `<b>${longDate(nb)}</b> — ${T('in', 'còn')} <b>${fmtInt(left)}</b> ${T('days', 'ngày')} (${T('turning', 'tròn')} ${fmtInt(turning)} ${T('years', 'tuổi')})`}</li>
      <li>${T('bornOn', 'Bạn sinh vào')} <b>${longDate(b)}</b></li>
      <li>${T('zodiac', 'Cung hoàng đạo')}: <b>${ZODIAC[zodiac(b)]}</b></li>
      <li>${T('animal', 'Con giáp')}: <b>${ANIMAL[chineseAnimal(b.getUTCFullYear())]}</b> <span class="note">${T('animalNote', '(theo năm dương lịch; sinh trước Tết Nguyên đán thì thuộc con giáp năm trước)')}</span></li>
      <li>${T('m10k', 'Mốc 10.000 ngày tuổi')}: <b>${longDate(ms10k)}</b>${ms10k <= a ? ` <span class="note">(${T('passed', 'đã qua')})</span>` : ''}</li>
      <li>${T('half', 'Nửa năm sinh nhật')}: <b>${longDate(addMonths(nb, -6) > a ? addMonths(nb, -6) : addMonths(nb, 6))}</b></li>
    </ul>`;
}

$('#form').addEventListener('input', render);
$('#today').addEventListener('click', () => { atEl.value = todayKey(); render(); });
render();
