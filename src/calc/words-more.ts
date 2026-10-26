/**
 * Đọc số tiền thành chữ cho: ko, ar, hi, id, th, pl, uk, bn.
 * Mỗi hàm nhận số (làm tròn, lấy trị tuyệt đối) và trả chuỗi rỗng nếu ≥ 1e12 hoặc không hợp lệ.
 */
const valid = (value: number): number | null => {
  const n = Math.round(Math.abs(value));
  return Number.isFinite(n) && n < 1e12 ? n : null;
};

// ---------- 한국어 (số Hán-Hàn) ----------
const KO_D = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
function koGroup(g: number): string {
  const th = Math.floor(g / 1000), h = Math.floor((g % 1000) / 100), t = Math.floor((g % 100) / 10), u = g % 10;
  return (th ? (th === 1 ? '' : KO_D[th]) + '천' : '') + (h ? (h === 1 ? '' : KO_D[h]) + '백' : '') + (t ? (t === 1 ? '' : KO_D[t]) + '십' : '') + KO_D[u];
}
export function numberToKorean(value: number): string {
  const n = valid(value);
  if (n === null) return '';
  if (n === 0) return '영';
  const units = ['', '만', '억', '조'];
  let out = '', rest = n;
  for (let i = 0; rest > 0; i++, rest = Math.floor(rest / 10000)) {
    const g = rest % 10000;
    if (!g) continue;
    out = (i === 1 && g === 1 ? '' : koGroup(g)) + units[i] + out;
  }
  return out;
}

// ---------- Bahasa Indonesia ----------
const ID_U = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
function idBelow1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100, parts: string[] = [];
  if (h) parts.push(h === 1 ? 'seratus' : `${ID_U[h]} ratus`);
  if (r) {
    if (r < 12) parts.push(ID_U[r]);
    else if (r < 20) parts.push(`${ID_U[r - 10]} belas`);
    else parts.push(`${ID_U[Math.floor(r / 10)]} puluh${r % 10 ? ' ' + ID_U[r % 10] : ''}`);
  }
  return parts.join(' ');
}
export function numberToIndonesian(value: number): string {
  const n = valid(value);
  if (n === null) return '';
  if (n === 0) return 'nol';
  const bil = Math.floor(n / 1e9), mil = Math.floor((n % 1e9) / 1e6), rib = Math.floor((n % 1e6) / 1000), rest = n % 1000, parts: string[] = [];
  if (bil) parts.push(`${idBelow1000(bil)} miliar`);
  if (mil) parts.push(`${idBelow1000(mil)} juta`);
  if (rib) parts.push(rib === 1 ? 'seribu' : `${idBelow1000(rib)} ribu`);
  if (rest) parts.push(idBelow1000(rest));
  return parts.join(' ');
}

// ---------- ไทย ----------
const TH_D = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const TH_P = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];
/** Một nhóm tối đa 6 chữ số. withHigher: phía trước còn nhóm lớn hơn (để dùng "เอ็ด"). */
function thGroup(g: number, withHigher: boolean): string {
  const digits = String(g).split('').map(Number);
  let out = '';
  digits.forEach((d, idx) => {
    const p = digits.length - 1 - idx;
    if (!d) return;
    if (p === 1) out += d === 1 ? 'สิบ' : d === 2 ? 'ยี่สิบ' : TH_D[d] + 'สิบ';
    else if (p === 0) out += d === 1 && (g > 10 || withHigher) ? 'เอ็ด' : TH_D[d];
    else out += TH_D[d] + TH_P[p];
  });
  return out;
}
export function numberToThai(value: number): string {
  const n = valid(value);
  if (n === null) return '';
  if (n === 0) return 'ศูนย์';
  const mill = Math.floor(n / 1e6), rest = n % 1e6;
  return (mill ? thGroup(mill, false) + 'ล้าน' : '') + (rest ? thGroup(rest, mill > 0) : '');
}

// ---------- Polski ----------
const PL_U = ['', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć', 'dziesięć', 'jedenaście', 'dwanaście', 'trzynaście', 'czternaście', 'piętnaście', 'szesnaście', 'siedemnaście', 'osiemnaście', 'dziewiętnaście'];
const PL_T = ['', '', 'dwadzieścia', 'trzydzieści', 'czterdzieści', 'pięćdziesiąt', 'sześćdziesiąt', 'siedemdziesiąt', 'osiemdziesiąt', 'dziewięćdziesiąt'];
const PL_H = ['', 'sto', 'dwieście', 'trzysta', 'czterysta', 'pięćset', 'sześćset', 'siedemset', 'osiemset', 'dziewięćset'];
/** 0 = số ít (1), 1 = 2–4, 2 = còn lại */
const slavForm = (n: number): 0 | 1 | 2 => (n === 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14) ? 1 : 2);
function plBelow1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100, parts: string[] = [];
  if (h) parts.push(PL_H[h]);
  if (r >= 20) { parts.push(PL_T[Math.floor(r / 10)]); if (r % 10) parts.push(PL_U[r % 10]); }
  else if (r) parts.push(PL_U[r]);
  return parts.join(' ');
}
export function numberToPolish(value: number): string {
  const n = valid(value);
  if (n === null) return '';
  if (n === 0) return 'zero';
  const scales: [number, string[]][] = [[1e9, ['miliard', 'miliardy', 'miliardów']], [1e6, ['milion', 'miliony', 'milionów']], [1e3, ['tysiąc', 'tysiące', 'tysięcy']]];
  const parts: string[] = [];
  let rest = n;
  for (const [base, forms] of scales) {
    const c = Math.floor(rest / base);
    rest %= base;
    if (!c) continue;
    parts.push(c === 1 ? forms[0] : `${plBelow1000(c)} ${forms[slavForm(c)]}`);
  }
  if (rest) parts.push(plBelow1000(rest));
  return parts.join(' ');
}
export const polishZloty = (n: number): string => ['złoty', 'złote', 'złotych'][slavForm(Math.round(Math.abs(n)))];

// ---------- Українська ----------
/** Tiếng Ukraina: số tận cùng 1 (trừ 11) dùng dạng số ít, như "двадцять одна тисяча". */
const ukForm = (n: number): 0 | 1 | 2 => (n % 10 === 1 && n % 100 !== 11 ? 0 : slavForm(n));
const UK_U = ['', 'один', 'два', 'три', 'чотири', 'п’ять', 'шість', 'сім', 'вісім', 'дев’ять', 'десять', 'одинадцять', 'дванадцять', 'тринадцять', 'чотирнадцять', 'п’ятнадцять', 'шістнадцять', 'сімнадцять', 'вісімнадцять', 'дев’ятнадцять'];
const UK_T = ['', '', 'двадцять', 'тридцять', 'сорок', 'п’ятдесят', 'шістдесят', 'сімдесят', 'вісімдесят', 'дев’яносто'];
const UK_H = ['', 'сто', 'двісті', 'триста', 'чотириста', 'п’ятсот', 'шістсот', 'сімсот', 'вісімсот', 'дев’ятсот'];
function ukBelow1000(n: number, fem: boolean): string {
  const h = Math.floor(n / 100), r = n % 100, parts: string[] = [];
  if (h) parts.push(UK_H[h]);
  if (r >= 20) {
    parts.push(UK_T[Math.floor(r / 10)]);
    if (r % 10) parts.push(fem && r % 10 === 1 ? 'одна' : fem && r % 10 === 2 ? 'дві' : UK_U[r % 10]);
  } else if (r) parts.push(fem && r === 1 ? 'одна' : fem && r === 2 ? 'дві' : UK_U[r]);
  return parts.join(' ');
}
export function numberToUkrainian(value: number, feminineEnd = false): string {
  const n = valid(value);
  if (n === null) return '';
  if (n === 0) return 'нуль';
  const scales: [number, string[], boolean][] = [[1e9, ['мільярд', 'мільярди', 'мільярдів'], false], [1e6, ['мільйон', 'мільйони', 'мільйонів'], false], [1e3, ['тисяча', 'тисячі', 'тисяч'], true]];
  const parts: string[] = [];
  let rest = n;
  for (const [base, forms, fem] of scales) {
    const c = Math.floor(rest / base);
    rest %= base;
    if (c) parts.push(`${ukBelow1000(c, fem)} ${forms[ukForm(c)]}`);
  }
  if (rest) parts.push(ukBelow1000(rest, feminineEnd));
  return parts.join(' ');
}
export const ukrainianHryvnia = (n: number): string => ['гривня', 'гривні', 'гривень'][ukForm(Math.round(Math.abs(n)))];

// ---------- हिन्दी ----------
const HI = ['शून्य', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ', 'दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस', 'बीस',
  'इक्कीस', 'बाईस', 'तेईस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताईस', 'अट्ठाईस', 'उनतीस', 'तीस', 'इकतीस', 'बत्तीस', 'तैंतीस', 'चौंतीस', 'पैंतीस', 'छत्तीस', 'सैंतीस', 'अड़तीस', 'उनतालीस', 'चालीस',
  'इकतालीस', 'बयालीस', 'तैंतालीस', 'चौवालीस', 'पैंतालीस', 'छियालीस', 'सैंतालीस', 'अड़तालीस', 'उनचास', 'पचास', 'इक्यावन', 'बावन', 'तिरपन', 'चौवन', 'पचपन', 'छप्पन', 'सत्तावन', 'अट्ठावन', 'उनसठ', 'साठ',
  'इकसठ', 'बासठ', 'तिरसठ', 'चौंसठ', 'पैंसठ', 'छियासठ', 'सड़सठ', 'अड़सठ', 'उनहत्तर', 'सत्तर', 'इकहत्तर', 'बहत्तर', 'तिहत्तर', 'चौहत्तर', 'पचहत्तर', 'छिहत्तर', 'सतहत्तर', 'अठहत्तर', 'उनासी', 'अस्सी',
  'इक्यासी', 'बयासी', 'तिरासी', 'चौरासी', 'पचासी', 'छियासी', 'सत्तासी', 'अट्ठासी', 'नवासी', 'नब्बे', 'इक्यानवे', 'बानवे', 'तिरानवे', 'चौरानवे', 'पचानवे', 'छियानवे', 'सत्तानवे', 'अट्ठानवे', 'निन्यानवे'];
const BN = ['শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ', 'এগারো', 'বারো', 'তেরো', 'চোদ্দ', 'পনেরো', 'ষোলো', 'সতেরো', 'আঠারো', 'ঊনিশ', 'বিশ',
  'একুশ', 'বাইশ', 'তেইশ', 'চব্বিশ', 'পঁচিশ', 'ছাব্বিশ', 'সাতাশ', 'আটাশ', 'ঊনত্রিশ', 'ত্রিশ', 'একত্রিশ', 'বত্রিশ', 'তেত্রিশ', 'চৌত্রিশ', 'পঁয়ত্রিশ', 'ছত্রিশ', 'সাঁইত্রিশ', 'আটত্রিশ', 'ঊনচল্লিশ', 'চল্লিশ',
  'একচল্লিশ', 'বিয়াল্লিশ', 'তেতাল্লিশ', 'চুয়াল্লিশ', 'পঁয়তাল্লিশ', 'ছেচল্লিশ', 'সাতচল্লিশ', 'আটচল্লিশ', 'ঊনপঞ্চাশ', 'পঞ্চাশ', 'একান্ন', 'বাহান্ন', 'তিপ্পান্ন', 'চুয়ান্ন', 'পঞ্চান্ন', 'ছাপ্পান্ন', 'সাতান্ন', 'আটান্ন', 'ঊনষাট', 'ষাট',
  'একষট্টি', 'বাষট্টি', 'তেষট্টি', 'চৌষট্টি', 'পঁয়ষট্টি', 'ছেষট্টি', 'সাতষট্টি', 'আটষট্টি', 'ঊনসত্তর', 'সত্তর', 'একাত্তর', 'বাহাত্তর', 'তিয়াত্তর', 'চুয়াত্তর', 'পঁচাত্তর', 'ছিয়াত্তর', 'সাতাত্তর', 'আটাত্তর', 'ঊনআশি', 'আশি',
  'একাশি', 'বিরাশি', 'তিরাশি', 'চুরাশি', 'পঁচাশি', 'ছিয়াশি', 'সাতাশি', 'অষ্টাশি', 'ঊননব্বই', 'নব্বই', 'একানব্বই', 'বিরানব্বই', 'তিরানব্বই', 'চুরানব্বই', 'পঁচানব্বই', 'ছিয়ানব্বই', 'সাতানব্বই', 'আটানব্বই', 'নিরানব্বই'];
/** Hệ đếm Nam Á: trăm, nghìn, lakh (1e5), crore (1e7). */
function indic(n: number, w: string[], hundred: string, thousand: string, lakh: string, crore: string): string {
  if (n < 100) return w[n];
  const join = (a: string, rest: number) => (rest ? `${a} ${indic(rest, w, hundred, thousand, lakh, crore)}` : a);
  if (n < 1000) return join(`${w[Math.floor(n / 100)]} ${hundred}`, n % 100);
  if (n < 1e5) return join(`${w[Math.floor(n / 1000)]} ${thousand}`, n % 1000);
  if (n < 1e7) return join(`${w[Math.floor(n / 1e5)]} ${lakh}`, n % 1e5);
  return join(`${indic(Math.floor(n / 1e7), w, hundred, thousand, lakh, crore)} ${crore}`, n % 1e7);
}
export function numberToHindi(value: number): string {
  const n = valid(value);
  return n === null ? '' : indic(n, HI, 'सौ', 'हज़ार', 'लाख', 'करोड़');
}
export function numberToBengali(value: number): string {
  const n = valid(value);
  return n === null ? '' : indic(n, BN, 'শত', 'হাজার', 'লাখ', 'কোটি');
}

// ---------- العربية ----------
const AR_U = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const AR_T = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const AR_H = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'];
function arBelow1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100, parts: string[] = [];
  if (h) parts.push(AR_H[h]);
  if (r) {
    if (r < 20) parts.push(AR_U[r]);
    else parts.push(r % 10 ? `${AR_U[r % 10]} و${AR_T[Math.floor(r / 10)]}` : AR_T[Math.floor(r / 10)]);
  }
  return parts.join(' و');
}
export function numberToArabic(value: number): string {
  const n = valid(value);
  if (n === null) return '';
  if (n === 0) return 'صفر';
  const scales: [number, string, string, string, string][] = [
    [1e9, 'مليار', 'ملياران', 'مليارات', 'مليارًا'], [1e6, 'مليون', 'مليونان', 'ملايين', 'مليونًا'], [1e3, 'ألف', 'ألفان', 'آلاف', 'ألفًا'],
  ];
  const parts: string[] = [];
  let rest = n;
  for (const [base, one, two, few, many] of scales) {
    const c = Math.floor(rest / base);
    rest %= base;
    if (!c) continue;
    const r100 = c % 100;
    parts.push(c === 1 ? one : c === 2 ? two : r100 === 0 ? `${arBelow1000(c)} ${one}` : r100 >= 3 && r100 <= 10 ? `${arBelow1000(c)} ${few}` : `${arBelow1000(c)} ${many}`);
  }
  if (rest) parts.push(arBelow1000(rest));
  return parts.join(' و');
}

/** Số tiền bằng chữ cho 8 ngôn ngữ mới; trả null nếu ngôn ngữ không thuộc nhóm này. */
export function moneyInWordsMore(lang: string, value: number): string | null {
  const neg = value < 0;
  const cap = (s: string, loc: string) => s.charAt(0).toLocaleUpperCase(loc) + s.slice(1);
  switch (lang) {
    case 'ko': { const w = numberToKorean(value); return w ? `${neg ? '마이너스 ' : ''}일금 ${w}원정` : ''; }
    case 'id': { const w = numberToIndonesian(value); return w ? cap(`${neg ? 'minus ' : ''}${w} rupiah`, 'id') : ''; }
    case 'th': { const w = numberToThai(value); return w ? `${neg ? 'ลบ' : ''}${w}บาทถ้วน` : ''; }
    case 'pl': { const w = numberToPolish(value); return w ? cap(`${neg ? 'minus ' : ''}${w} ${polishZloty(value)}`, 'pl') : ''; }
    case 'uk': { const w = numberToUkrainian(value, true); return w ? cap(`${neg ? 'мінус ' : ''}${w} ${ukrainianHryvnia(value)}`, 'uk') : ''; }
    case 'hi': { const w = numberToHindi(value); return w ? `${neg ? 'ऋण ' : ''}${w} रुपये मात्र` : ''; }
    case 'bn': { const w = numberToBengali(value); return w ? `${neg ? 'ঋণাত্মক ' : ''}${w} টাকা মাত্র` : ''; }
    case 'ar': { const w = numberToArabic(value); return w ? `${neg ? 'سالب ' : ''}${w} درهم فقط لا غير` : ''; }
    default: return null;
  }
}
