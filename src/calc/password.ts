/** Tạo mật khẩu ngẫu nhiên an toàn và ước lượng độ mạnh. */

export const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/~',
};
const AMBIGUOUS = /[O0oIl1|`'"]/g;

/** Số nguyên ngẫu nhiên đều trong [0, n) bằng crypto, không thiên lệch */
export function randInt(n: number): number {
  const limit = Math.floor(0x100000000 / n) * n;
  const b = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(b);
    if (b[0] < limit) return b[0] % n;
  }
}

export interface PwOptions { length: number; lower: boolean; upper: boolean; digits: boolean; symbols: boolean; noAmbiguous: boolean; custom: string }

export function makePassword(o: PwOptions): string {
  const groups = (['lower', 'upper', 'digits', 'symbols'] as const)
    .filter((k) => o[k])
    .map((k) => (o.noAmbiguous ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]));
  if (o.custom) groups.push([...new Set(o.custom)].join(''));
  if (!groups.length) return '';
  const all = groups.join('');
  const len = Math.max(groups.length, o.length);
  // Đảm bảo có ít nhất một ký tự từ mỗi nhóm đã chọn
  const chars = groups.map((g) => g[randInt(g.length)]);
  while (chars.length < len) chars.push(all[randInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = randInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join('');
}

export function makePassphrase(words: string[], count: number, sep: string, capitalize: boolean, addNumber: boolean): string {
  const picked = Array.from({ length: count }, () => {
    const w = words[randInt(words.length)];
    return capitalize ? w[0].toUpperCase() + w.slice(1) : w;
  });
  if (addNumber) picked.push(String(randInt(100)));
  return picked.join(sep);
}

/** Độ mạnh ước tính theo entropy (bit) dựa trên các nhóm ký tự xuất hiện, trừ điểm khi có mẫu dễ đoán */
export function entropy(pw: string): number {
  if (!pw) return 0;
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/\d/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 33;
  if (/[^\x00-\x7f]/.test(pw)) pool += 60;
  let bits = pw.length * Math.log2(Math.max(pool, 2));
  // Trừ điểm: lặp ký tự, chuỗi tăng dần, từ phổ biến
  if (/(.)\1{2,}/.test(pw)) bits *= 0.8;
  if (/(0123|1234|2345|3456|4567|5678|6789|abcd|qwer|asdf|zxcv)/i.test(pw)) bits *= 0.7;
  if (/(password|matkhau|123456|qwerty|iloveyou|admin|welcome|abc123|111111)/i.test(pw)) bits = Math.min(bits, 10);
  return bits;
}

/** Thời gian bẻ khoá ước tính (giây) với 10 tỷ lần thử mỗi giây (máy GPU mạnh, mật khẩu bị lộ dạng băm nhanh) */
export const crackSeconds = (bits: number): number => Math.pow(2, bits - 1) / 1e10;
