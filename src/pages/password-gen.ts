import { mountLayout } from '../layout';
import { $, copyText, escapeHtml, setupTabs, storage } from '../ui';
import { pageText, currentLang } from '../i18n';
import { makePassword, makePassphrase, entropy, crackSeconds, type PwOptions } from '../calc/password';

mountLayout({ activeTool: 'password-gen' });
const T = pageText();

/** Danh sách từ ngắn, dễ nhớ để ghép cụm mật khẩu (không dấu cho dễ gõ) */
const WORDS_VI = 'an,ba,bac,ban,bang,bao,bay,ben,bien,binh,bo,bong,buom,ca,cam,canh,cay,chim,cho,chua,co,con,cua,cuc,da,dao,dau,den,dep,di,dien,dong,du,duong,em,ga,gao,gio,go,hai,hat,hoa,hong,hu,huong,keo,khe,khoai,la,lan,lang,le,loa,long,lua,lung,ly,ma,mai,man,mat,may,meo,mia,mo,moc,mua,muoi,nai,nang,ngo,nha,nhanh,non,nui,oc,ong,pho,que,ra,rau,rong,ruou,sach,sang,sao,soi,song,sua,tam,tao,thuyen,tim,toi,tre,trang,trau,tre,tron,trung,vai,van,vang,vit,vo,vui,xanh,xe,xoai,yen'.split(',');
const WORDS_EN = 'able,acid,aged,also,arch,area,army,away,baby,back,bake,ball,band,bank,barn,base,bath,beam,bean,bear,beef,bell,belt,bike,bird,blue,boat,body,bold,bolt,bone,book,boot,bowl,brave,bread,brick,bush,cake,calm,camp,card,cart,cash,cave,chalk,chef,city,clay,cliff,cloud,coal,coast,coin,cold,cook,cool,copy,coral,corn,crab,crow,cube,dawn,deer,desk,dive,dock,door,dove,drum,duck,dune,dust,eagle,earth,echo,edge,elbow,elk,ember,fable,face,fair,farm,fern,field,fire,fish,flag,flame,flute,foam,fog,fork,fox,frog,fruit,gate,gem,gift,glow,goat,gold,grape,grass,hawk,heart,hill,honey,horn,horse,iron,island,jade,jazz,jelly,kite,kiwi,knot,lake,lamp,leaf,lemon,lily,lion,lock,maple,mars,meadow,melon,mint,moon,moss,mouse,nest,night,oak,ocean,olive,onion,orbit,otter,owl,palm,panda,paper,peach,pearl,pepper,piano,pine,plum,pond,quilt,rain,raven,reef,rice,river,road,robin,rock,rose,ruby,sail,salt,sand,seal,seed,shell,ship,silk,sky,snow,sock,spark,star,stone,storm,sugar,sun,swan,tea,tent,tiger,toast,tree,tulip,vine,wave,whale,wheat,wind,wolf,wood,yarn,zebra'.split(',');

const st = storage<PwOptions & { count: number; words: number; sep: string; cap: boolean; num: boolean }>('password-gen', {
  length: 16, lower: true, upper: true, digits: true, symbols: true, noAmbiguous: false, custom: '', count: 5, words: 4, sep: '-', cap: true, num: true,
});
const s = st.get();

$('#tool-root').innerHTML = `
  <div class="tabs" role="tablist" style="margin-top:24px">
    <button type="button" role="tab" data-tab="random">${T('tabRandom', 'Mật khẩu ngẫu nhiên')}</button>
    <button type="button" role="tab" data-tab="phrase">${T('tabPhrase', 'Cụm từ dễ nhớ')}</button>
    <button type="button" role="tab" data-tab="check">${T('tabCheck', 'Kiểm tra độ mạnh')}</button>
  </div>
  <div class="tool-body">
    <div class="panel" data-panel="random">
      <div class="pw-out"><output id="pw" aria-live="polite"></output><button type="button" class="btn btn-primary" id="copy">${T('copy', 'Sao chép')}</button><button type="button" class="btn" id="regen" aria-label="${T('regen', 'Tạo mới')}" title="${T('regen', 'Tạo mới')}">↻</button></div>
      <div class="strength"><i id="bar"></i></div>
      <p class="note" id="meter"></p>
      <label class="field"><span class="field-label">${T('length', 'Độ dài')}: <output id="len-out"></output> ${T('chars', 'ký tự')}</span><input type="range" id="length" min="4" max="64" step="1" /></label>
      <div class="row">
        <label class="check"><input type="checkbox" id="lower" /><span>${T('lower', 'Chữ thường')} (a-z)</span></label>
        <label class="check"><input type="checkbox" id="upper" /><span>${T('upper', 'Chữ hoa')} (A-Z)</span></label>
        <label class="check"><input type="checkbox" id="digits" /><span>${T('digits', 'Chữ số')} (0-9)</span></label>
        <label class="check"><input type="checkbox" id="symbols" /><span>${T('symbols', 'Ký hiệu')} (!@#$…)</span></label>
      </div>
      <label class="check"><input type="checkbox" id="noAmbiguous" /><span>${T('noAmb', 'Bỏ ký tự dễ nhầm (O 0 o I l 1)')}</span></label>
      <label class="field"><span class="field-label">${T('custom', 'Thêm ký tự riêng (không bắt buộc)')}</span><input type="text" id="custom" class="input-inline" maxlength="40" /></label>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('count', 'Tạo nhiều mật khẩu cùng lúc')}</span><input type="number" id="count" min="1" max="50" /></label>
        <button type="button" class="btn" id="many" style="align-self:flex-end">${T('makeMany', 'Tạo danh sách')}</button>
      </div>
      <ul class="pw-list" id="list"></ul>
    </div>
    <div class="panel" data-panel="phrase" hidden>
      <div class="pw-out"><output id="pp"></output><button type="button" class="btn btn-primary" id="copy-pp">${T('copy', 'Sao chép')}</button><button type="button" class="btn" id="regen-pp" aria-label="${T('regen', 'Tạo mới')}">↻</button></div>
      <p class="note" id="pp-meter"></p>
      <div class="field-row">
        <label class="field"><span class="field-label">${T('words', 'Số từ')}</span><input type="number" id="words" min="3" max="10" /></label>
        <label class="field"><span class="field-label">${T('sep', 'Ký tự nối')}</span><select id="sep"><option value="-">-</option><option value=".">.</option><option value="_">_</option><option value=" ">${T('space', 'dấu cách')}</option><option value="">${T('none', 'không có')}</option></select></label>
      </div>
      <label class="check"><input type="checkbox" id="cap" /><span>${T('cap', 'Viết hoa chữ cái đầu mỗi từ')}</span></label>
      <label class="check"><input type="checkbox" id="num" /><span>${T('num', 'Thêm một số ở cuối')}</span></label>
      <p class="note">${T('ppNote', 'Cụm từ ngẫu nhiên vừa dễ nhớ vừa khó đoán, phù hợp làm mật khẩu chính của trình quản lý mật khẩu hoặc máy tính.')}</p>
    </div>
    <div class="panel" data-panel="check" hidden>
      <label class="field"><span class="field-label">${T('checkLabel', 'Nhập mật khẩu cần kiểm tra')}</span><input type="password" id="check" class="input-inline" autocomplete="off" /></label>
      <label class="check"><input type="checkbox" id="show" /><span>${T('show', 'Hiện mật khẩu')}</span></label>
      <div class="strength"><i id="cbar"></i></div>
      <p class="note" id="cmeter"></p>
      <ul class="plain-list" id="tips"></ul>
    </div>
  </div>
  <p class="note" style="margin-top:16px">${T('privacy', 'Mật khẩu được tạo và kiểm tra ngay trên máy bạn bằng bộ sinh số ngẫu nhiên an toàn của trình duyệt, không gửi đi đâu và không được lưu lại.')}</p>
`;
setupTabs($('#tool-root'));
const $i = (id: string) => $<HTMLInputElement>('#' + id);

const opts = (): PwOptions => ({
  length: Number($i('length').value), lower: $i('lower').checked, upper: $i('upper').checked, digits: $i('digits').checked,
  symbols: $i('symbols').checked, noAmbiguous: $i('noAmbiguous').checked, custom: $i('custom').value,
});

function fmtDuration(sec: number): string {
  if (sec < 1) return T('instant', 'gần như ngay lập tức');
  const units: [number, string][] = [[31557600 * 1e9, T('uBillionYears', 'tỷ năm')], [31557600 * 1e6, T('uMillionYears', 'triệu năm')], [31557600 * 1000, T('uThousandYears', 'nghìn năm')], [31557600, T('uYears', 'năm')], [86400, T('uDays', 'ngày')], [3600, T('uHours', 'giờ')], [60, T('uMinutes', 'phút')], [1, T('uSeconds', 'giây')]];
  if (sec > 31557600 * 1e12) return T('forever', 'hàng nghìn tỷ năm trở lên');
  const [d, name] = units.find(([d]) => sec >= d) as [number, string];
  return `${Math.floor(sec / d).toLocaleString()} ${name}`;
}
function meter(pw: string, bar: string, out: string): void {
  const bits = entropy(pw);
  const lv = bits < 28 ? 0 : bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
  const colors = ['#b42318', '#e0590b', '#e0a800', '#16a34a', '#0e7a55'];
  const names = [T('lv0', 'Rất yếu'), T('lv1', 'Yếu'), T('lv2', 'Trung bình'), T('lv3', 'Mạnh'), T('lv4', 'Rất mạnh')];
  const b = $<HTMLElement>('#' + bar);
  b.style.width = `${pw ? Math.max(6, Math.min(100, (bits / 100) * 100)) : 0}%`;
  b.style.background = colors[lv];
  $('#' + out).innerHTML = pw ? `<b style="color:${colors[lv]}">${names[lv]}</b> · ${Math.round(bits)} bit · ${T('crack', 'thời gian dò ra ước tính')}: ${fmtDuration(crackSeconds(bits))}` : '';
}

function gen(): void {
  const o = opts();
  st.set({ ...s, ...o, count: Number($i('count').value) });
  $('#len-out').textContent = String(o.length);
  const pw = makePassword(o);
  $('#pw').textContent = pw || T('pickSet', 'Chọn ít nhất một loại ký tự');
  meter(pw, 'bar', 'meter');
}
function genMany(): void {
  const n = Math.min(50, Math.max(1, Number($i('count').value) || 5));
  $('#list').innerHTML = Array.from({ length: n }, () => makePassword(opts())).map((p) => `<li><span>${escapeHtml(p)}</span><button type="button" class="btn btn-sm" data-copy="${escapeHtml(p)}">${T('copy', 'Sao chép')}</button></li>`).join('');
}
function genPhrase(): void {
  const words = Math.min(10, Math.max(3, Number($i('words').value) || 4));
  const sep = $<HTMLSelectElement>('#sep').value;
  st.set({ ...st.get(), words, sep, cap: $i('cap').checked, num: $i('num').checked });
  const list = currentLang() === 'vi' ? WORDS_VI : WORDS_EN;
  const pp = makePassphrase(list, words, sep, $i('cap').checked, $i('num').checked);
  $('#pp').textContent = pp;
  // Entropy thực của cụm từ = số từ × log2(kích thước danh sách)
  const bits = words * Math.log2(list.length) + ($i('num').checked ? Math.log2(100) : 0);
  $('#pp-meter').textContent = `≈ ${Math.round(bits)} bit · ${T('crack', 'thời gian dò ra ước tính')}: ${fmtDuration(crackSeconds(bits))}`;
}
function check(): void {
  const pw = $i('check').value;
  meter(pw, 'cbar', 'cmeter');
  const tips: string[] = [];
  if (pw) {
    if (pw.length < 12) tips.push(T('tipLen', 'Nên dài ít nhất 12 ký tự.'));
    if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw)) tips.push(T('tipCase', 'Nên có cả chữ hoa và chữ thường.'));
    if (!/\d/.test(pw)) tips.push(T('tipDigit', 'Thêm chữ số.'));
    if (!/[^a-zA-Z0-9]/.test(pw)) tips.push(T('tipSym', 'Thêm ký hiệu như ! @ # $.'));
    if (/(.)\1{2,}/.test(pw)) tips.push(T('tipRepeat', 'Tránh lặp một ký tự nhiều lần.'));
    if (/(19|20)\d{2}/.test(pw)) tips.push(T('tipYear', 'Tránh dùng năm sinh hoặc năm dễ đoán.'));
    tips.push(T('tipReuse', 'Không dùng lại một mật khẩu cho nhiều trang; nên dùng trình quản lý mật khẩu.'));
  }
  $('#tips').innerHTML = tips.map((t) => `<li>${t}</li>`).join('');
}

for (const k of ['lower', 'upper', 'digits', 'symbols', 'noAmbiguous'] as const) $i(k).checked = s[k];
$i('length').value = String(s.length);
$i('custom').value = s.custom;
$i('count').value = String(s.count);
$i('words').value = String(s.words);
$<HTMLSelectElement>('#sep').value = s.sep;
$i('cap').checked = s.cap;
$i('num').checked = s.num;

['length', 'lower', 'upper', 'digits', 'symbols', 'noAmbiguous', 'custom'].forEach((id) => $('#' + id).addEventListener('input', gen));
['words', 'sep', 'cap', 'num'].forEach((id) => $('#' + id).addEventListener('input', genPhrase));
$('#regen').addEventListener('click', gen);
$('#regen-pp').addEventListener('click', genPhrase);
$('#many').addEventListener('click', genMany);
$('#copy').addEventListener('click', () => { const t = $('#pw').textContent || ''; if (t) void copyText(t); });
$('#copy-pp').addEventListener('click', () => void copyText($('#pp').textContent || ''));
$('#list').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-copy]'); if (b) void copyText(b.dataset.copy as string); });
$('#check').addEventListener('input', check);
$('#show').addEventListener('change', () => { $i('check').type = $i('show').checked ? 'text' : 'password'; });
gen();
genPhrase();
