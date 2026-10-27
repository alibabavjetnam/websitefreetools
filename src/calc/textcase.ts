/** Đổi kiểu chữ (hoa, thường, tiêu đề, câu, camelCase…). Hàm thuần, kiểm thử riêng được. */

/** Tách từ cho các kiểu lập trình: theo khoảng trắng, dấu câu, gạch dưới, gạch ngang và chỗ chuyển chữ thường → hoa */
export function splitWords(s: string): string[] {
  return s
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2')
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Bỏ dấu tiếng Việt (và dấu của các chữ Latin khác) */
export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFC');
}

const cap = (w: string, locale: string) => (w ? w.charAt(0).toLocaleUpperCase(locale) + w.slice(1) : w);

/** Từ nhỏ không viết hoa trong tiêu đề tiếng Anh (trừ khi đứng đầu/cuối) */
const SMALL_EN = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'per', 'so', 'the', 'to', 'up', 'via', 'vs', 'yet']);

export type CaseKind =
  | 'upper' | 'lower' | 'title' | 'headline' | 'sentence' | 'toggle' | 'alternating'
  | 'camel' | 'pascal' | 'snake' | 'constant' | 'kebab' | 'dot' | 'noAccent';

export function convertCase(text: string, kind: CaseKind, locale = 'en-US'): string {
  switch (kind) {
    case 'upper':
      return text.toLocaleUpperCase(locale);
    case 'lower':
      return text.toLocaleLowerCase(locale);
    case 'title':
      // Viết hoa chữ cái đầu mọi từ, giữ nguyên khoảng trắng, xuống dòng
      return text.toLocaleLowerCase(locale).replace(/(^|[\s\-–—("'“‘/[])(\p{L})/gu, (_, p: string, c: string) => p + c.toLocaleUpperCase(locale));
    case 'headline': {
      // Kiểu tiêu đề tiếng Anh: không viết hoa mạo từ, giới từ ngắn ở giữa câu
      const lines = text.split('\n');
      return lines
        .map((line) => {
          const parts = line.toLocaleLowerCase(locale).split(/(\s+)/);
          const wordIdx = parts.map((p, i) => (/\S/.test(p) ? i : -1)).filter((i) => i >= 0);
          const first = wordIdx[0];
          const last = wordIdx[wordIdx.length - 1];
          return parts
            .map((p, i) => {
              if (!/\S/.test(p)) return p;
              const bare = p.replace(/[^\p{L}]/gu, '');
              if (i !== first && i !== last && SMALL_EN.has(bare)) return p;
              return p.replace(/\p{L}/u, (c) => c.toLocaleUpperCase(locale));
            })
            .join('');
        })
        .join('\n');
    }
    case 'sentence':
      // Viết hoa chữ đầu câu: đầu văn bản, sau . ! ? … và sau dòng trống
      return text
        .toLocaleLowerCase(locale)
        .replace(/(^\s*|[.!?…]\s+|\n\s*)(\p{L})/gu, (_, p: string, c: string) => p + c.toLocaleUpperCase(locale));
    case 'toggle':
      return [...text].map((c) => (c === c.toLocaleUpperCase(locale) ? c.toLocaleLowerCase(locale) : c.toLocaleUpperCase(locale))).join('');
    case 'alternating': {
      let i = 0;
      return [...text].map((c) => (/\p{L}/u.test(c) ? (i++ % 2 ? c.toLocaleUpperCase(locale) : c.toLocaleLowerCase(locale)) : c)).join('');
    }
    case 'noAccent':
      return stripAccents(text);
    default: {
      // Các kiểu đặt tên trong lập trình: xử lý từng dòng
      return text
        .split('\n')
        .map((line) => {
          const words = splitWords(stripAccents(line)).map((w) => w.toLowerCase());
          if (!words.length) return line;
          switch (kind) {
            case 'camel': return words[0] + words.slice(1).map((w) => cap(w, 'en')).join('');
            case 'pascal': return words.map((w) => cap(w, 'en')).join('');
            case 'snake': return words.join('_');
            case 'constant': return words.join('_').toUpperCase();
            case 'kebab': return words.join('-');
            case 'dot': return words.join('.');
            default: return line;
          }
        })
        .join('\n');
    }
  }
}
