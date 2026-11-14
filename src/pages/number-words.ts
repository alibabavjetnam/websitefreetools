import { mountLayout } from '../layout';
import { $, parseNumber, fmtInt } from '../ui';
import { pageText, currentLang } from '../i18n';
import { input, select, button, bindCopy, el, privacyNote, val, onChange } from '../lib/devkit';
import { numberToVietnamese, moneyInVietnamese, numberToEnglish, numberToSpanish, numberToJapanese, numberToChinese, numberToGerman, numberToRussian, numberToFrench, numberToPortuguese, numberToItalian, numberToTurkish, numberToDutch } from '../calc/words-vi';
import { numberToKorean, numberToIndonesian, numberToThai, numberToPolish, numberToUkrainian, numberToHindi, numberToBengali, numberToArabic } from '../calc/words-more';

mountLayout({ activeTool: 'number-words' });
const T = pageText();
const FNS: Record<string, [string, (n: number) => string]> = {
  vi: ['Tiếng Việt', numberToVietnamese], en: ['English', numberToEnglish], es: ['Español', numberToSpanish], fr: ['Français', numberToFrench], de: ['Deutsch', numberToGerman],
  pt: ['Português', numberToPortuguese], it: ['Italiano', numberToItalian], nl: ['Nederlands', numberToDutch], ru: ['Русский', numberToRussian], uk: ['Українська', (n) => numberToUkrainian(n)],
  pl: ['Polski', numberToPolish], tr: ['Türkçe', numberToTurkish], id: ['Bahasa Indonesia', numberToIndonesian], ja: ['日本語', numberToJapanese], zh: ['中文', numberToChinese],
  ko: ['한국어', numberToKorean], th: ['ไทย', numberToThai], hi: ['हिन्दी', numberToHindi], bn: ['বাংলা', numberToBengali], ar: ['العربية', numberToArabic],
};
const MINUS: Record<string, string> = { vi: 'âm', en: 'minus', es: 'menos', fr: 'moins', de: 'minus', pt: 'menos', it: 'meno', nl: 'min', ru: 'минус', uk: 'мінус', pl: 'minus', tr: 'eksi', id: 'minus', ja: 'マイナス', zh: '负', ko: '마이너스', th: 'ลบ', hi: 'ऋण', bn: 'ঋণাত্মক', ar: 'سالب' };
const def = FNS[currentLang()] ? currentLang() : 'en';

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px">
    <div class="form-grid">
      ${input('num', T('num', 'Nhập số (số nguyên, tối đa 15 chữ số)'), { value: fmtInt(1250000), attrs: 'inputmode="numeric"' })}
      ${select('lang', T('lang', 'Đọc bằng tiếng'), Object.entries(FNS).map(([k, [n]]) => [k, n] as [string, string]), def)}
      ${select('cs', T('case', 'Kiểu chữ'), [['first', T('c.first', 'Viết hoa chữ đầu')], ['lower', T('c.lower', 'chữ thường')], ['upper', T('c.upper', 'CHỮ IN HOA')], ['title', T('c.title', 'Viết Hoa Mỗi Từ')]], 'first')}
    </div>
    <div class="stat stat--main"><span class="stat-label">${T('result', 'Bằng chữ')}</span><span class="stat-value" id="out" style="font-size:1.25rem;line-height:1.4"></span></div>
    <div class="row">${button('copy', T('copy', 'Sao chép'), true)}</div>
    <div id="vnd" class="panel" style="padding:14px" hidden><span class="field-label">${T('vnd', 'Số tiền đồng Việt Nam (ghi trên hoá đơn, chứng từ)')}</span><p id="vndOut" style="margin:0;font-weight:600"></p>${button('copyVnd', T('copy', 'Sao chép'))}</div>
    <p class="note">${T('note', 'Dùng để ghi số tiền bằng chữ trên hoá đơn, séc, hợp đồng, giấy biên nhận. Hỗ trợ số âm và số rất lớn tới hàng nghìn tỷ.')}</p>
  </div>
  ${privacyNote()}
`;
function cased(s: string): string {
  const c = val('cs');
  if (c === 'lower') return s.toLocaleLowerCase();
  if (c === 'upper') return s.toLocaleUpperCase();
  if (c === 'title') return s.replace(/(^|\s)(\p{L})/gu, (_, a: string, b: string) => a + b.toLocaleUpperCase());
  return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}
let res = '', vnd = '';
function run(): void {
  const n = Math.trunc(parseNumber(val('num')));
  const fn = FNS[val('lang')][1];
  if (!Number.isFinite(n) || Math.abs(n) >= 1e15) { el('out').textContent = T('bad', 'Hãy nhập số nguyên nhỏ hơn 1 triệu tỷ.'); res = ''; return; }
  const L = val('lang');
  res = n === 0 ? fn(0) || '0' : fn(Math.abs(n));
  if (n < 0) res = MINUS[L] + (L === 'ja' || L === 'zh' ? '' : ' ') + res;
  res = cased(res);
  el('out').textContent = res;
  const showVnd = val('lang') === 'vi';
  el('vnd').hidden = !showVnd;
  vnd = showVnd ? moneyInVietnamese(n) : '';
  el('vndOut').textContent = vnd;
}
onChange(['num', 'lang', 'cs'], run, 80);
bindCopy('copy', () => res);
bindCopy('copyVnd', () => vnd);
run();
