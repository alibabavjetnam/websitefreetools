/** Mã hoá / băm / chuỗi — phần thuần, không DOM (đợt 50 công cụ 14/11/2026) */

/* ---------- MD5 (RFC 1321) — Web Crypto không có MD5 ---------- */
export function md5(data: Uint8Array): string {
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0;
  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const len = data.length;
  const total = (((len + 8) >> 6) + 1) << 6;
  const buf = new Uint8Array(total);
  buf.set(data);
  buf[len] = 0x80;
  const bits = len * 8;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 8, bits >>> 0, true);
  dv.setUint32(total - 4, Math.floor(bits / 2 ** 32), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const M = new Uint32Array(16);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true);
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D; D = C; C = B;
      const s = S[(i >> 4) * 4 + (i % 4)];
      B = (B + ((F << s) | (F >>> (32 - s)))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const out = new DataView(new ArrayBuffer(16));
  [a0, b0, c0, d0].forEach((v, i) => out.setUint32(i * 4, v, true));
  return [...new Uint8Array(out.buffer)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/* ---------- CRC32 ---------- */
let CRC_T: Uint32Array | null = null;
export function crc32(data: Uint8Array): string {
  if (!CRC_T) {
    CRC_T = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_T[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const b of data) c = CRC_T[(c ^ b) & 0xff] ^ (c >>> 8);
  return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}

/* ---------- HTML entities ---------- */
const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', copy: '©', reg: '®', trade: '™', hellip: '…', mdash: '—', ndash: '–',
  laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', euro: '€', pound: '£', yen: '¥', cent: '¢', deg: '°', plusmn: '±',
  times: '×', divide: '÷', middot: '·', bull: '•', sect: '§', para: '¶', larr: '←', rarr: '→', uarr: '↑', darr: '↓', hearts: '♥', frac12: '½',
};
const REV: Record<string, string> = Object.fromEntries(Object.entries(NAMED).map(([k, v]) => [v, k]));
export function encodeEntities(s: string, mode: 'basic' | 'named' | 'all'): string {
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0) as number;
    if (ch === '&') out += '&amp;';
    else if (ch === '<') out += '&lt;';
    else if (ch === '>') out += '&gt;';
    else if (ch === '"') out += '&quot;';
    else if (ch === "'") out += '&#39;';
    else if (mode !== 'basic' && cp > 127) out += mode === 'named' && REV[ch] ? `&${REV[ch]};` : `&#${cp};`;
    else out += ch;
  }
  return out;
}
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/* ---------- Thoát chuỗi theo ngữ cảnh ---------- */
export type EscapeMode = 'json' | 'js' | 'sql' | 'csv' | 'regex' | 'xml' | 'shell';
export function escapeStr(s: string, mode: EscapeMode): string {
  switch (mode) {
    case 'json': return JSON.stringify(s).slice(1, -1);
    case 'js': return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/\$\{/g, '\\${');
    case 'sql': return s.replace(/'/g, "''");
    case 'csv': return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    case 'regex': return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    case 'xml': return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    case 'shell': return `'${s.replace(/'/g, `'\\''`)}'`;
  }
}
export function unescapeStr(s: string, mode: EscapeMode): string {
  switch (mode) {
    case 'json': return JSON.parse(`"${s.replace(/(^|[^\\])"/g, '$1\\"')}"`) as string;
    case 'js': return s.replace(/\\(u\{[0-9a-f]+\}|u[0-9a-f]{4}|x[0-9a-f]{2}|.)/gi, (_, e: string) => {
      if (e[0] === 'u') return String.fromCodePoint(parseInt(e.replace(/[u{}]/g, ''), 16));
      if (e[0] === 'x') return String.fromCharCode(parseInt(e.slice(1), 16));
      return ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' } as Record<string, string>)[e] ?? e;
    });
    case 'sql': return s.replace(/''/g, "'");
    case 'csv': return /^".*"$/s.test(s) ? s.slice(1, -1).replace(/""/g, '"') : s;
    case 'regex': return s.replace(/\\(.)/g, '$1');
    case 'xml': return decodeEntities(s);
    case 'shell': return s.replace(/^'|'$/g, '').replace(/'\\''/g, "'");
  }
}

/* ---------- Mật mã cổ điển ---------- */
export function caesar(s: string, shift: number): string {
  const k = ((shift % 26) + 26) % 26;
  return s.replace(/[a-z]/gi, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + k) % 26) + base);
  });
}
export const rot13 = (s: string): string => caesar(s, 13);
export function vigenere(s: string, key: string, decode: boolean): string {
  const k = key.toLowerCase().replace(/[^a-z]/g, '');
  if (!k) return s;
  let j = 0;
  return s.replace(/[a-z]/gi, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    const sh = (k.charCodeAt(j++ % k.length) - 97) * (decode ? -1 : 1);
    return String.fromCharCode(((c.charCodeAt(0) - base + sh + 26) % 26) + base);
  });
}
export function atbash(s: string): string {
  return s.replace(/[a-z]/gi, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(25 - (c.charCodeAt(0) - base) + base);
  });
}
const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...',
  ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', _: '..--.-', '"': '.-..-.', $: '...-..-', '@': '.--.-.',
};
const MORSE_REV: Record<string, string> = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
/** Bỏ dấu tiếng Việt / dấu Latin để mã Morse đọc được */
export const stripMarks = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
export function toMorse(s: string): string {
  return stripMarks(s).toUpperCase().split(/\s+/).filter(Boolean).map((w) => [...w].map((c) => MORSE[c] ?? '').filter(Boolean).join(' ')).join(' / ');
}
export function fromMorse(s: string): string {
  return s.trim().split(/\s*\/\s*|\s{3,}/).map((w) => w.split(/\s+/).map((c) => MORSE_REV[c] ?? (c ? '?' : '')).join('')).join(' ');
}
export function toBinary(bytes: Uint8Array, sep = ' '): string {
  return [...bytes].map((b) => b.toString(2).padStart(8, '0')).join(sep);
}
export function fromBinary(s: string): Uint8Array {
  const c = s.replace(/[^01]/g, '');
  if (!c || c.length % 8) throw new Error('bin');
  const out = new Uint8Array(c.length / 8);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(c.slice(i * 8, i * 8 + 8), 2);
  return out;
}

/* ---------- UUID / ULID ---------- */
export function uuidV4(): string {
  return crypto.randomUUID();
}
/** UUID v7: 48 bit thời gian (ms) + ngẫu nhiên, sắp xếp theo thời gian */
export function uuidV7(now = Date.now()): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  let ts = now;
  for (let i = 5; i >= 0; i--) { b[i] = ts % 256; ts = Math.floor(ts / 256); }
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
const CROCK = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function ulid(now = Date.now()): string {
  let ts = now;
  let t = '';
  for (let i = 0; i < 10; i++) { t = CROCK[ts % 32] + t; ts = Math.floor(ts / 32); }
  const r = crypto.getRandomValues(new Uint8Array(16));
  let rand = '';
  for (let i = 0; i < 16; i++) rand += CROCK[r[i] % 32];
  return t + rand;
}
/** Đọc thời điểm tạo từ UUID v7 / ULID; trả null nếu không có */
export function idTime(id: string): number | null {
  const s = id.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-7/i.test(s)) return parseInt(s.replace(/-/g, '').slice(0, 12), 16);
  if (/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(s)) {
    let v = 0;
    for (const c of s.slice(0, 10).toUpperCase()) v = v * 32 + CROCK.indexOf(c);
    return v;
  }
  return null;
}

/* ---------- Unicode ---------- */
export interface CharInfo { ch: string; cp: number; utf8: number; utf16: number; kind: string }
export function charInfo(s: string): CharInfo[] {
  const enc = new TextEncoder();
  return [...s].map((ch) => {
    const cp = ch.codePointAt(0) as number;
    let kind = 'normal';
    if (/[\u200B-\u200F\u2028-\u202E\u2060-\u2064\uFEFF\u00AD]/.test(ch)) kind = 'invisible';
    else if (/\s/.test(ch)) kind = 'space';
    else if (/\p{Cc}|\p{Cf}/u.test(ch)) kind = 'control';
    else if (/\p{M}/u.test(ch)) kind = 'mark';
    else if (cp > 0xffff) kind = 'astral';
    return { ch, cp, utf8: enc.encode(ch).length, utf16: ch.length, kind };
  });
}
export const cpHex = (cp: number): string => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
export const removeInvisible = (s: string): string => s.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD]/g, '');
