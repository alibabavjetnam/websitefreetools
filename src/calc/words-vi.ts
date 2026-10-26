import { currentLang } from '../i18n';
import { moneyInWordsMore } from './words-more';
import LANG_META from '../langs.json';

/** Đọc số tiền thành chữ tiếng Việt, ví dụ 1.250.000 -> "Một triệu hai trăm năm mươi nghìn đồng" */

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

/** Đọc một nhóm 3 chữ số. full = true khi phía trước còn nhóm lớn hơn (phải đọc "không trăm", "lẻ") */
function readGroup(n: number, full: boolean): string {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  const words: string[] = [];
  if (h > 0 || full) words.push(DIGITS[h], 'trăm');
  if (t === 0) {
    if (u > 0 && (h > 0 || full)) words.push('lẻ');
  } else if (t === 1) {
    words.push('mười');
  } else {
    words.push(DIGITS[t], 'mươi');
  }
  if (u > 0) {
    if (u === 1 && t >= 2) words.push('mốt');
    else if (u === 5 && t >= 1) words.push('lăm');
    else if (u === 4 && t >= 2) words.push('tư');
    else words.push(DIGITS[u]);
  }
  return words.join(' ');
}

const UNITS = ['', 'nghìn', 'triệu'];

/** Đọc số nguyên không âm (tối đa 15 chữ số, đủ cho số tiền) */
export function numberToVietnamese(value: number): string {
  let n = Math.round(Math.abs(value));
  if (!Number.isFinite(n) || n > 999_999_999_999_999) return '';
  if (n === 0) return 'không';
  // Tách theo từng "tỷ": phần dưới tỷ đọc nghìn/triệu, mỗi lần qua tỷ thì thêm chữ "tỷ"
  const billions: number[] = [];
  while (n > 0) {
    billions.push(n % 1_000_000_000);
    n = Math.floor(n / 1_000_000_000);
  }
  const parts: string[] = [];
  for (let b = billions.length - 1; b >= 0; b--) {
    const chunk = billions[b];
    const hasHigher = b < billions.length - 1;
    if (chunk > 0) {
      const groups = [chunk % 1000, Math.floor(chunk / 1000) % 1000, Math.floor(chunk / 1_000_000)];
      let started = hasHigher;
      for (let g = 2; g >= 0; g--) {
        if (groups[g] === 0) continue;
        parts.push(readGroup(groups[g], started));
        if (UNITS[g]) parts.push(UNITS[g]);
        started = true;
      }
    }
    if (b > 0 && (chunk > 0 || parts.length)) parts.push('tỷ');
  }
  // "một tỷ tỷ" không xảy ra trong giới hạn 15 chữ số; gộp khoảng trắng thừa
  return parts.join(' ').replace(/\s+/g, ' ').replace(/(tỷ )+tỷ/g, 'tỷ').trim();
}

/** "Một triệu hai trăm nghìn đồng" (viết hoa chữ đầu) */
export function moneyInVietnamese(value: number): string {
  const w = numberToVietnamese(value);
  if (!w) return '';
  const text = `${value < 0 ? 'âm ' : ''}${w} đồng`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------- English ----------
const EN_ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const EN_SCALES = ['', 'thousand', 'million', 'billion', 'trillion'];

function enGroup(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h) parts.push(EN_ONES[h], 'hundred');
  if (r) {
    if (r < 20) parts.push(EN_ONES[r]);
    else parts.push(EN_TENS[Math.floor(r / 10)] + (r % 10 ? '-' + EN_ONES[r % 10] : ''));
  }
  return parts.join(' ');
}

/** 1234 -> "one thousand two hundred thirty-four" */
export function numberToEnglish(value: number): string {
  let n = Math.round(Math.abs(value));
  if (!Number.isFinite(n) || n > 999_999_999_999_999) return '';
  if (n === 0) return 'zero';
  const parts: string[] = [];
  for (let g = 0; n > 0; g++, n = Math.floor(n / 1000)) {
    const chunk = n % 1000;
    if (chunk) parts.unshift(enGroup(chunk) + (EN_SCALES[g] ? ' ' + EN_SCALES[g] : ''));
  }
  return parts.join(' ');
}

// ---------- Español ----------
const ES_U = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const ES_T = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
const ES_V = ['veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const ES_D = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const ES_C = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
/** 1..999 en español; `apo` = "uno" pasa a "un" cuando va antes de un sustantivo (un euro, veintiún mil). */
function esHundreds(n: number, apo: boolean): string {
  if (n === 100) return 'cien';
  const c = Math.floor(n / 100), r = n % 100, parts: string[] = [];
  if (c) parts.push(ES_C[c]);
  if (r) {
    if (r < 10) parts.push(r === 1 && apo ? 'un' : ES_U[r]);
    else if (r < 20) parts.push(ES_T[r - 10]);
    else if (r < 30) parts.push(r === 21 && apo ? 'veintiún' : ES_V[r - 20]);
    else {
      const u = r % 10, d = ES_D[Math.floor(r / 10)];
      parts.push(u ? `${d} y ${u === 1 && apo ? 'un' : ES_U[u]}` : d);
    }
  }
  return parts.join(' ');
}
function esBelowMillion(k: number): string {
  const th = Math.floor(k / 1000), r = k % 1000, parts: string[] = [];
  if (th) parts.push(th === 1 ? 'mil' : `${esHundreds(th, true)} mil`);
  if (r) parts.push(esHundreds(r, true));
  return parts.join(' ');
}
export function numberToSpanish(value: number): string {
  const n = Math.round(Math.abs(value));
  if (!Number.isFinite(n) || n > 999_999_999_999_999) return '';
  if (n === 0) return 'cero';
  const mill = Math.floor(n / 1e6), rest = n % 1e6, parts: string[] = [];
  if (mill) parts.push(mill === 1 ? 'un millón' : `${esBelowMillion(mill)} millones`);
  if (rest) parts.push(esBelowMillion(rest));
  else if (mill) parts.push('de');
  return parts.join(' ');
}

// ---------- 日本語 (大字: 金壱千弐百参拾四円也) ----------
const JA_DIGITS = ['零', '壱', '弐', '参', '四', '伍', '六', '七', '八', '九'];
const JA_SMALL = ['', '拾', '百', '千'];
const JA_BIG = ['', '万', '億', '兆'];

function jaGroup(n: number): string {
  let out = '';
  for (let p = 3; p >= 0; p--) {
    const d = Math.floor(n / 10 ** p) % 10;
    if (d) out += JA_DIGITS[d] + JA_SMALL[p];
  }
  return out;
}

export function numberToJapanese(value: number): string {
  let n = Math.round(Math.abs(value));
  if (!Number.isFinite(n) || n > 999_999_999_999_999) return '';
  if (n === 0) return '零';
  let out = '';
  for (let g = 0; n > 0; g++, n = Math.floor(n / 10000)) {
    const chunk = n % 10000;
    if (chunk) out = jaGroup(chunk) + JA_BIG[g] + out;
  }
  return out;
}

// ---------- 中文 (财务大写: 壹仟贰佰叁拾肆元整) ----------
const ZH_DIGITS = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
const ZH_SMALL = ['', '拾', '佰', '仟'];
const ZH_BIG = ['', '万', '亿', '万亿'];

function zhGroup(n: number): string {
  let out = '';
  let zero = false;
  for (let p = 3; p >= 0; p--) {
    const d = Math.floor(n / 10 ** p) % 10;
    if (d === 0) {
      if (out) zero = true;
    } else {
      if (zero) out += '零';
      zero = false;
      out += ZH_DIGITS[d] + ZH_SMALL[p];
    }
  }
  return out;
}

export function numberToChinese(value: number): string {
  let n = Math.round(Math.abs(value));
  if (!Number.isFinite(n) || n > 999_999_999_999_999) return '';
  if (n === 0) return '零';
  const chunks: number[] = [];
  for (; n > 0; n = Math.floor(n / 10000)) chunks.push(n % 10000);
  let out = '';
  let pendingZero = false;
  for (let g = chunks.length - 1; g >= 0; g--) {
    const c = chunks[g];
    if (c === 0) {
      if (out) pendingZero = true;
      continue;
    }
    if (out && (pendingZero || c < 1000)) out += '零';
    pendingZero = false;
    out += zhGroup(c) + ZH_BIG[g];
  }
  return out;
}

// ---------- Deutsch ----------
const DE_U = ['', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'];
const DE_T = ['zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
const DE_D = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];
/** 1..999 auf Deutsch, in einem Wort; `eins` = "eins" statt "ein" am Ende. */
function deHundreds(n: number, eins: boolean): string {
  const c = Math.floor(n / 100), r = n % 100;
  let out = c ? DE_U[c] + 'hundert' : '';
  if (r) {
    if (r < 10) out += r === 1 && eins ? 'eins' : DE_U[r];
    else if (r < 20) out += DE_T[r - 10];
    else {
      const u = r % 10;
      out += u ? `${u === 1 ? 'ein' : DE_U[u]}und${DE_D[Math.floor(r / 10)]}` : DE_D[Math.floor(r / 10)];
    }
  }
  return out;
}
export function numberToGerman(value: number): string {
  const n = Math.round(Math.abs(value));
  if (!Number.isFinite(n) || n > 999_999_999_999_999) return '';
  if (n === 0) return 'null';
  const parts: string[] = [];
  const scales: [number, string, string][] = [[1e12, 'eine Billion', 'Billionen'], [1e9, 'eine Milliarde', 'Milliarden'], [1e6, 'eine Million', 'Millionen']];
  let rest = n;
  for (const [sz, one, many] of scales) {
    const q = Math.floor(rest / sz);
    rest %= sz;
    if (!q) continue;
    parts.push(q === 1 ? one : `${deHundreds(q, false)} ${many}`);
  }
  const th = Math.floor(rest / 1000), r = rest % 1000;
  let tail = '';
  if (th) tail += th === 1 ? 'eintausend' : `${deHundreds(th, false)}tausend`;
  if (r) tail += deHundreds(r, true);
  if (tail) parts.push(tail);
  return parts.join(' ');
}

// ---------- Русский ----------
const RU_U_M = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const RU_U_F = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const RU_T = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
const RU_D = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
const RU_C = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
/** Склонение по числу: [1 рубль, 2 рубля, 5 рублей]. */
function ruPlural(n: number, forms: [string, string, string]): string {
  const m100 = n % 100, m10 = n % 10;
  if (m100 >= 11 && m100 <= 14) return forms[2];
  if (m10 === 1) return forms[0];
  if (m10 >= 2 && m10 <= 4) return forms[1];
  return forms[2];
}
function ruHundreds(n: number, fem: boolean): string {
  const parts: string[] = [];
  const c = Math.floor(n / 100), r = n % 100;
  if (c) parts.push(RU_C[c]);
  if (r >= 10 && r < 20) parts.push(RU_T[r - 10]);
  else {
    if (r >= 20) parts.push(RU_D[Math.floor(r / 10)]);
    const u = r % 10;
    if (u) parts.push((fem ? RU_U_F : RU_U_M)[u]);
  }
  return parts.join(' ');
}
export function numberToRussian(value: number): string {
  const n = Math.round(Math.abs(value));
  if (!Number.isFinite(n) || n > 999_999_999_999_999) return '';
  if (n === 0) return 'ноль';
  const scales: [number, [string, string, string], boolean][] = [
    [1e12, ['триллион', 'триллиона', 'триллионов'], false],
    [1e9, ['миллиард', 'миллиарда', 'миллиардов'], false],
    [1e6, ['миллион', 'миллиона', 'миллионов'], false],
    [1e3, ['тысяча', 'тысячи', 'тысяч'], true],
  ];
  const parts: string[] = [];
  let rest = n;
  for (const [sz, forms, fem] of scales) {
    const q = Math.floor(rest / sz);
    rest %= sz;
    if (q) parts.push(`${ruHundreds(q, fem)} ${ruPlural(q, forms)}`);
  }
  if (rest) parts.push(ruHundreds(rest, false));
  return parts.join(' ');
}

// ---------- Français ----------
const FR_U = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const FR_D = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];
/** 1..99 en français (orthographe rectifiée, traits d'union); `fin` = « quatre-vingts » prend un s en fin de nombre. */
function frTens(r: number, fin: boolean): string {
  if (r < 20) return FR_U[r];
  if (r < 70) {
    const d = Math.floor(r / 10), u = r % 10;
    return u ? `${FR_D[d]}-${u === 1 ? 'et-' : ''}${FR_U[u]}` : FR_D[d];
  }
  if (r < 80) return r === 71 ? 'soixante-et-onze' : `soixante-${FR_U[r - 60]}`;
  if (r === 80) return fin ? 'quatre-vingts' : 'quatre-vingt';
  return `quatre-vingt-${FR_U[r - 80]}`;
}
function frHundreds(n: number, fin: boolean): string {
  const c = Math.floor(n / 100), r = n % 100, parts: string[] = [];
  if (c) parts.push(c === 1 ? 'cent' : `${FR_U[c]} cent${r === 0 && fin ? 's' : ''}`);
  if (r) parts.push(frTens(r, fin));
  return parts.join(' ');
}
function frBelowMillion(k: number, fin: boolean): string {
  const th = Math.floor(k / 1000), r = k % 1000, parts: string[] = [];
  if (th) parts.push(th === 1 ? 'mille' : `${frHundreds(th, false)} mille`);
  if (r) parts.push(frHundreds(r, fin));
  return parts.join(' ');
}
export function numberToFrench(value: number): string {
  const n = Math.round(Math.abs(value));
  if (!Number.isFinite(n) || n >= 1e12) return '';
  if (n === 0) return 'zéro';
  const mill = Math.floor(n / 1e6), rest = n % 1e6, parts: string[] = [];
  if (mill) parts.push(mill === 1 ? 'un million' : `${frBelowMillion(mill, false)} millions`);
  if (rest) parts.push(frBelowMillion(rest, true));
  return parts.join(' ');
}

// ---------- Português (Brasil) ----------
const PT_U = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const PT_D = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const PT_C = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
function ptBelowThousand(n: number): string {
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100), r = n % 100, parts: string[] = [];
  if (c) parts.push(PT_C[c]);
  if (r) {
    if (r < 20) parts.push(PT_U[r]);
    else parts.push(r % 10 ? `${PT_D[Math.floor(r / 10)]} e ${PT_U[r % 10]}` : PT_D[Math.floor(r / 10)]);
  }
  return parts.join(' e ');
}
/** "e" liga as partes quando o resto é menor que 100 ou múltiplo de 100. */
const ptJoin = (r: number): string => (r < 100 || r % 100 === 0 ? ' e ' : ' ');
function ptBelowMillion(k: number): string {
  const th = Math.floor(k / 1000), r = k % 1000;
  let out = th ? (th === 1 ? 'mil' : `${ptBelowThousand(th)} mil`) : '';
  if (r) out += (th ? ptJoin(r) : '') + ptBelowThousand(r);
  return out;
}
export function numberToPortuguese(value: number): string {
  const n = Math.round(Math.abs(value));
  if (!Number.isFinite(n) || n >= 1e12) return '';
  if (n === 0) return 'zero';
  const mill = Math.floor(n / 1e6), rest = n % 1e6;
  let out = mill ? (mill === 1 ? 'um milhão' : `${ptBelowMillion(mill)} milhões`) : '';
  if (rest) out += (mill ? ptJoin(rest) : '') + ptBelowMillion(rest);
  else if (mill) out += ' de';
  return out;
}

// ---------- Italiano ----------
const IT_U = ['', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove'];
const IT_D = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta'];
function itTens(r: number): string {
  if (r < 20) return IT_U[r];
  const d = IT_D[Math.floor(r / 10)], u = r % 10;
  if (!u) return d;
  return u === 1 || u === 8 ? d.slice(0, -1) + IT_U[u] : d + IT_U[u];
}
function itHundreds(n: number): string {
  const c = Math.floor(n / 100), r = n % 100;
  let out = c ? (c === 1 ? 'cento' : `${IT_U[c]}cento`) : '';
  if (r) {
    if (c && r >= 80 && r < 90) out = out.slice(0, -1);
    out += itTens(r);
  }
  return out;
}
function itBelowMillion(k: number): string {
  const th = Math.floor(k / 1000), r = k % 1000;
  return (th ? (th === 1 ? 'mille' : `${itHundreds(th)}mila`) : '') + (r ? itHundreds(r) : '');
}
export function numberToItalian(value: number): string {
  const n = Math.round(Math.abs(value));
  if (!Number.isFinite(n) || n >= 1e12) return '';
  if (n === 0) return 'zero';
  const mill = Math.floor(n / 1e6), rest = n % 1e6, parts: string[] = [];
  if (mill) parts.push(mill === 1 ? 'un milione' : `${itBelowMillion(mill)} milioni`);
  if (rest) parts.push(itBelowMillion(rest));
  else if (mill) parts.push('di');
  return parts.map((w) => (w.length > 3 && w.endsWith('tre') ? w.slice(0, -1) + 'é' : w)).join(' ');
}

// ---------- Türkçe ----------
const TR_U = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
const TR_D = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];
function trBelowThousand(n: number): string {
  const c = Math.floor(n / 100), r = n % 100, parts: string[] = [];
  if (c) parts.push(c === 1 ? 'yüz' : `${TR_U[c]} yüz`);
  if (r >= 10) parts.push(TR_D[Math.floor(r / 10)]);
  if (r % 10) parts.push(TR_U[r % 10]);
  return parts.join(' ');
}
function trBelowMillion(k: number): string {
  const th = Math.floor(k / 1000), r = k % 1000, parts: string[] = [];
  if (th) parts.push(th === 1 ? 'bin' : `${trBelowThousand(th)} bin`);
  if (r) parts.push(trBelowThousand(r));
  return parts.join(' ');
}
export function numberToTurkish(value: number): string {
  const n = Math.round(Math.abs(value));
  if (!Number.isFinite(n) || n >= 1e12) return '';
  if (n === 0) return 'sıfır';
  const mill = Math.floor(n / 1e6), rest = n % 1e6, parts: string[] = [];
  if (mill) parts.push(`${trBelowMillion(mill)} milyon`);
  if (rest) parts.push(trBelowMillion(rest));
  return parts.join(' ');
}

// ---------- Nederlands ----------
const NL_U = ['', 'een', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien', 'elf', 'twaalf', 'dertien', 'veertien', 'vijftien', 'zestien', 'zeventien', 'achttien', 'negentien'];
const NL_D = ['', '', 'twintig', 'dertig', 'veertig', 'vijftig', 'zestig', 'zeventig', 'tachtig', 'negentig'];
function nlTens(r: number): string {
  if (r < 20) return NL_U[r];
  const u = r % 10, d = NL_D[Math.floor(r / 10)];
  return u ? `${NL_U[u]}${u === 2 || u === 3 ? 'ën' : 'en'}${d}` : d;
}
function nlHundreds(n: number): string {
  const c = Math.floor(n / 100), r = n % 100;
  return (c ? (c === 1 ? 'honderd' : `${NL_U[c]}honderd`) : '') + (r ? nlTens(r) : '');
}
function nlBelowMillion(k: number): string {
  const th = Math.floor(k / 1000), r = k % 1000;
  return (th ? (th === 1 ? 'duizend' : `${nlHundreds(th)}duizend`) : '') + (r ? nlHundreds(r) : '');
}
export function numberToDutch(value: number): string {
  const n = Math.round(Math.abs(value));
  if (!Number.isFinite(n) || n >= 1e12) return '';
  if (n === 0) return 'nul';
  const mill = Math.floor(n / 1e6), rest = n % 1e6, parts: string[] = [];
  if (mill) parts.push(mill === 1 ? 'een miljoen' : `${nlBelowMillion(mill)} miljoen`);
  if (rest) parts.push(nlBelowMillion(rest));
  return parts.join(' ');
}

/** Số tiền bằng chữ theo ngôn ngữ trang: vi "... đồng", en "... dollars", es "... euros", ja "金...円也", zh "...元整" */
export function moneyInWords(value: number): string {
  const lang = currentLang();
  const neg = value < 0;
  if (lang === 'en') {
    const w = numberToEnglish(value);
    if (!w) return '';
    const text = `${neg ? 'minus ' : ''}${w} ${Math.round(Math.abs(value)) === 1 ? 'dollar' : 'dollars'}`;
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  if (lang === 'es') {
    const w = numberToSpanish(value);
    if (!w) return '';
    const text = `${neg ? 'menos ' : ''}${w} ${Math.round(Math.abs(value)) === 1 ? 'euro' : 'euros'}`;
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  if (lang === 'de') {
    const w = numberToGerman(value);
    if (!w) return '';
    const one = Math.round(Math.abs(value)) === 1;
    const text = `${neg ? 'minus ' : ''}${one ? 'ein' : w} Euro`;
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  if (lang === 'ru') {
    const w = numberToRussian(value);
    if (!w) return '';
    const text = `${neg ? 'минус ' : ''}${w} ${ruPlural(Math.round(Math.abs(value)), ['рубль', 'рубля', 'рублей'])}`;
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  if (lang === 'fr') {
    const w = numberToFrench(value);
    if (!w) return '';
    const n = Math.round(Math.abs(value));
    const unit = n % 1e6 === 0 && n > 0 ? 'd’euros' : n < 2 ? 'euro' : 'euros';
    const text = `${neg ? 'moins ' : ''}${w} ${unit}`;
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  if (lang === 'pt') {
    const w = numberToPortuguese(value);
    if (!w) return '';
    const n = Math.round(Math.abs(value));
    const text = `${neg ? 'menos ' : ''}${w} ${n === 1 ? 'real' : 'reais'}`;
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  if (lang === 'it') {
    const w = numberToItalian(value);
    if (!w) return '';
    const base = w.endsWith('uno') ? w.slice(0, -1) : w;
    const text = `${neg ? 'meno ' : ''}${base} euro`;
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  if (lang === 'tr') {
    const w = numberToTurkish(value);
    if (!w) return '';
    const text = `${neg ? 'eksi ' : ''}${w} lira`;
    return text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1);
  }
  if (lang === 'nl') {
    const w = numberToDutch(value);
    if (!w) return '';
    const text = `${neg ? 'min ' : ''}${w} euro`;
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  const more = moneyInWordsMore(lang, value);
  if (more !== null) return more;
  if (lang === 'ja') {
    const w = numberToJapanese(value);
    return w ? `${neg ? 'マイナス' : ''}金${w}円也` : '';
  }
  if (lang === 'zh') {
    const w = numberToChinese(value);
    return w ? `${neg ? '负' : ''}${w}元整` : '';
  }
  if (lang !== 'vi') {
    // Ngôn ngữ chưa có bộ đọc số riêng: đọc bằng tiếng Anh kèm mã tiền tệ của nước đó
    const w = numberToEnglish(value);
    const code = (LANG_META as unknown as Record<string, { cur?: [string, number, number] }>)[lang]?.cur?.[0] ?? '';
    if (!w) return '';
    const text = `${neg ? 'minus ' : ''}${w}${code ? ' ' + code : ''}`;
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  return moneyInVietnamese(value);
}

