/** Chữ kiểu bằng ký tự Unicode (khối Mathematical Alphanumeric Symbols và các bảng riêng). Hàm thuần. */

export interface FancyStyle {
  id: string;
  /** Tên tiếng Anh dùng làm khoá dịch + chuỗi mặc định khi chưa dịch */
  name: string;
  map: (ch: string) => string;
}

const A = 65, a = 97, Z0 = 48;
const cp = (n: number) => String.fromCodePoint(n);

/** Dải liên tục trong khối toán học: hoa bắt đầu từ up, thường từ lo, số từ dg (nếu có), cộng thêm bảng ngoại lệ */
function range(up: number, lo: number, dg?: number, ex: Record<string, string> = {}) {
  return (ch: string): string => {
    if (ex[ch]) return ex[ch];
    const c = ch.codePointAt(0) as number;
    if (c >= A && c < A + 26) return cp(up + c - A);
    if (c >= a && c < a + 26) return cp(lo + c - a);
    if (dg !== undefined && c >= Z0 && c < Z0 + 10) return cp(dg + c - Z0);
    return ch;
  };
}

function table(from: string, to: string[]) {
  const m = new Map<string, string>();
  [...from].forEach((c, i) => m.set(c, to[i]));
  return (ch: string) => m.get(ch) ?? ch;
}

const LOW = 'abcdefghijklmnopqrstuvwxyz';
const UP = LOW.toUpperCase();

const smallCaps = table(LOW + UP, [...'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ', ...'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ']);
const superscript = table(LOW + UP + '0123456789+-=()', [
  ...'ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖqʳˢᵗᵘᵛʷˣʸᶻ', ...'ᴬᴮᶜᴰᴱᶠᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾQᴿˢᵀᵁⱽᵂˣʸᶻ', ...'⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾',
]);
const upsideMap = table(LOW + UP + '0123456789.,!?\'"()[]{}<>_&', [
  ...'ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz', ...'∀ᗺƆᗡƎℲ⅁HIſꞰ˥WNOԀῸᴚS⊥∩ΛMX⅄Z', ...'0ƖᄅƐㄣϛ9ㄥ86', ...'˙\'¡¿,„)(][}{><‾⅋',
]);
const bubble = (ch: string) => {
  const c = ch.codePointAt(0) as number;
  if (c >= A && c < A + 26) return cp(0x24b6 + c - A);
  if (c >= a && c < a + 26) return cp(0x24d0 + c - a);
  if (c === 48) return '⓪';
  if (c > 48 && c < 58) return cp(0x2460 + c - 49);
  return ch;
};
const bubbleDark = (ch: string) => {
  const c = ch.codePointAt(0) as number;
  if (c >= A && c < A + 26) return cp(0x1f150 + c - A);
  if (c >= a && c < a + 26) return cp(0x1f150 + c - a);
  if (c === 48) return '⓿';
  if (c > 48 && c < 58) return cp(0x2776 + c - 49);
  return ch;
};
const squared = (ch: string) => {
  const c = ch.codePointAt(0) as number;
  if (c >= A && c < A + 26) return cp(0x1f130 + c - A);
  if (c >= a && c < a + 26) return cp(0x1f130 + c - a);
  return ch;
};
const squaredDark = (ch: string) => {
  const c = ch.codePointAt(0) as number;
  if (c >= A && c < A + 26) return cp(0x1f170 + c - A);
  if (c >= a && c < a + 26) return cp(0x1f170 + c - a);
  return ch;
};
const fullwidth = (ch: string) => {
  const c = ch.codePointAt(0) as number;
  if (c === 32) return '　';
  if (c > 32 && c < 127) return cp(0xff00 + c - 32);
  return ch;
};
const combine = (mark: string) => (ch: string) => (/\s/.test(ch) ? ch : ch + mark);

export const FANCY_STYLES: FancyStyle[] = [
  { id: 'bold', name: 'Bold', map: range(0x1d400, 0x1d41a, 0x1d7ce) },
  { id: 'italic', name: 'Italic', map: range(0x1d434, 0x1d44e, undefined, { h: 'ℎ' }) },
  { id: 'boldItalic', name: 'Bold italic', map: range(0x1d468, 0x1d482) },
  { id: 'sans', name: 'Sans', map: range(0x1d5a0, 0x1d5ba, 0x1d7e2) },
  { id: 'sansBold', name: 'Sans bold', map: range(0x1d5d4, 0x1d5ee, 0x1d7ec) },
  { id: 'sansItalic', name: 'Sans italic', map: range(0x1d608, 0x1d622) },
  { id: 'sansBoldItalic', name: 'Sans bold italic', map: range(0x1d63c, 0x1d656) },
  { id: 'script', name: 'Script', map: range(0x1d49c, 0x1d4b6, undefined, { B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ', e: 'ℯ', g: 'ℊ', o: 'ℴ' }) },
  { id: 'scriptBold', name: 'Bold script', map: range(0x1d4d0, 0x1d4ea) },
  { id: 'fraktur', name: 'Gothic', map: range(0x1d504, 0x1d51e, undefined, { C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' }) },
  { id: 'frakturBold', name: 'Bold gothic', map: range(0x1d56c, 0x1d586) },
  { id: 'double', name: 'Double-struck', map: range(0x1d538, 0x1d552, 0x1d7d8, { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' }) },
  { id: 'mono', name: 'Monospace', map: range(0x1d670, 0x1d68a, 0x1d7f6) },
  { id: 'bubble', name: 'Bubbles', map: bubble },
  { id: 'bubbleDark', name: 'Dark bubbles', map: bubbleDark },
  { id: 'squared', name: 'Squares', map: squared },
  { id: 'squaredDark', name: 'Dark squares', map: squaredDark },
  { id: 'fullwidth', name: 'Wide', map: fullwidth },
  { id: 'smallCaps', name: 'Small caps', map: smallCaps },
  { id: 'superscript', name: 'Tiny', map: superscript },
  { id: 'strike', name: 'Strikethrough', map: combine('̶') },
  { id: 'underline', name: 'Underline', map: combine('̲') },
  { id: 'doubleUnderline', name: 'Double underline', map: combine('̳') },
  { id: 'slash', name: 'Slashed', map: combine('̸') },
  { id: 'dots', name: 'Dotted', map: combine('̤') },
  { id: 'hearts', name: 'Hearts', map: (ch) => (/\s/.test(ch) ? ch : ch + '♥') },
  { id: 'stars', name: 'Stars', map: (ch) => (/\s/.test(ch) ? ch : ch + '✦') },
];

/** Các kiểu cần cả chuỗi (đảo ngược, trang trí hai đầu) */
export const WHOLE_STYLES: { id: string; name: string; fn: (s: string) => string }[] = [
  { id: 'upsideDown', name: 'Upside down', fn: (s) => [...s].reverse().map(upsideMap).join('') },
  { id: 'mirror', name: 'Reversed', fn: (s) => [...s].reverse().join('') },
  { id: 'wings', name: 'Wings', fn: (s) => `꧁༺ ${s} ༻꧂` },
  { id: 'sparkle', name: 'Sparkles', fn: (s) => `✧･ﾟ: *✧･ﾟ ${s} ﾟ･✧* :ﾟ･✧` },
  { id: 'brackets', name: 'Brackets', fn: (s) => `【${s}】` },
  { id: 'crown', name: 'Crown', fn: (s) => `♛ ${s} ♛` },
  { id: 'arrows', name: 'Arrows', fn: (s) => `➶➶ ${s} ➷➷` },
];

/**
 * Áp kiểu cho cả chuỗi. Chữ có dấu (tiếng Việt, Pháp…) được tách thành chữ gốc + dấu kết hợp
 * để phần chữ gốc vẫn đổi kiểu được, dấu vẫn giữ nguyên.
 */
export function applyFancy(text: string, style: FancyStyle): string {
  let out = '';
  for (const ch of text.normalize('NFD').replace(/đ/g, 'd̵').replace(/Đ/g, 'D̵')) out += style.map(ch);
  return out;
}
