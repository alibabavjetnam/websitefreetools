/**
 * Thống kê văn bản: số từ, ký tự, câu, đoạn, thời gian đọc và mật độ từ khoá.
 * "Từ" được đếm như Microsoft Word: mỗi chuỗi chữ/số liền nhau là một từ,
 * nên với tiếng Việt mỗi âm tiết ("cà", "phê") tính là một từ.
 */

/** Tốc độ trung bình (từ/phút) dùng để ước tính thời gian */
export const READ_WPM = 230;
export const SPEAK_WPM = 130;

const WORD = /[\p{L}\p{M}\p{N}]+(?:['’\-][\p{L}\p{M}\p{N}]+)*/gu;

/** Từ phổ biến không mang nghĩa chủ đề, bỏ khi xét mật độ từ khoá */
const STOP = new Set(
  (
    // tiếng Việt
    'và là của có cho các những một được trong với không này đã để thì mà khi đến từ theo về như cũng ra vào lại nên rất người hay hoặc nếu nhưng sẽ đang vì bị do tại trên dưới sau trước nhiều ít còn đó đây ấy nào gì ai sự việc cái chiếc thế vậy rồi chỉ mỗi mọi cả đều bằng nữa lên xuống qua hơn nhất đi làm có thể cần phải nó họ chúng ta tôi bạn anh chị em ông bà mình thêm vẫn luôn vừa mới hết cùng giữa bởi nhằm '
    // tiếng Anh
    + 'a an the and or but if of to in on at by for with from as is are was were be been being it its this that these those he she they we you i me my our your their his her them not no so do does did have has had will would can could should may might must than then there here what which who whom whose when where why how all any each also just about into over under up down out more most such only own same very s t'
  ).split(/\s+/).filter(Boolean),
);

export interface KeywordRow { phrase: string; count: number; density: number }

export interface TextStats {
  words: number;
  uniqueWords: number;
  chars: number;
  charsNoSpaces: number;
  letters: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  avgWordsPerSentence: number;
  avgCharsPerWord: number;
  longestSentence: string;
  longestSentenceWords: number;
  readSeconds: number;
  speakSeconds: number;
}

/** Tách câu: kết thúc bằng . ! ? … (có thể kèm ngoặc, nháy) hoặc hết dòng */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  const push = (s: string) => { if (wordsOf(s).length) out.push(s.trim()); };
  for (const line of text.split(/\n+/)) {
    let start = 0;
    for (const m of line.matchAll(/[.!?…]+["'”’)\]]*/g)) {
      const end = (m.index ?? 0) + m[0].length;
      const next = line.slice(end);
      // Một dấu chấm dính liền chữ/số phía sau (3.5, v.v, www.abc) chưa phải hết câu
      if (m[0] === '.' && next && !/^\s/.test(next)) continue;
      push(line.slice(start, end));
      start = end;
    }
    push(line.slice(start));
  }
  return out;
}

export const wordsOf = (s: string): string[] => s.match(WORD) ?? [];
const norm = (w: string) => w.normalize('NFC').toLocaleLowerCase('vi');

export function textStats(raw: string): TextStats {
  const text = raw.replace(/\r\n?/g, '\n');
  const words = wordsOf(text);
  const sentences = splitSentences(text);
  let longest = '';
  let longestN = 0;
  for (const s of sentences) {
    const n = wordsOf(s).length;
    if (n > longestN) { longestN = n; longest = s; }
  }
  const chars = [...text.normalize('NFC')];
  const lines = text.split('\n');
  return {
    words: words.length,
    uniqueWords: new Set(words.map(norm)).size,
    chars: chars.filter((c) => c !== '\n').length,
    charsNoSpaces: chars.filter((c) => !/\s/.test(c)).length,
    letters: chars.filter((c) => /[\p{L}\p{N}]/u.test(c)).length,
    sentences: sentences.length,
    // Mỗi dòng có chữ là một đoạn (giống cách Word đếm đoạn)
    paragraphs: lines.filter((l) => l.trim()).length,
    lines: text.trim() ? lines.length : 0,
    avgWordsPerSentence: sentences.length ? words.length / sentences.length : 0,
    avgCharsPerWord: words.length ? words.reduce((a, w) => a + [...w].length, 0) / words.length : 0,
    longestSentence: longest,
    longestSentenceWords: longestN,
    readSeconds: Math.round((words.length / READ_WPM) * 60),
    speakSeconds: Math.round((words.length / SPEAK_WPM) * 60),
  };
}

/**
 * Cụm n từ xuất hiện nhiều nhất (không vượt qua ranh giới câu).
 * Mật độ = số lần × số từ trong cụm / tổng số từ × 100.
 */
export function keywords(raw: string, n: number, opts: { skipStopwords: boolean; minCount?: number; limit?: number }): KeywordRow[] {
  const total = wordsOf(raw).length;
  if (!total) return [];
  const counts = new Map<string, number>();
  for (const s of splitSentences(raw.replace(/\r\n?/g, '\n'))) {
    const ws = wordsOf(s).map(norm);
    for (let i = 0; i + n <= ws.length; i++) {
      const gram = ws.slice(i, i + n);
      // Cụm bắt đầu hoặc kết thúc bằng từ phổ biến ("của", "the") thường vô nghĩa
      if (opts.skipStopwords && (STOP.has(gram[0]) || STOP.has(gram[n - 1]))) continue;
      if (gram.every((g) => /^\p{N}+$/u.test(g))) continue;
      const key = gram.join(' ');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const min = opts.minCount ?? (n === 1 ? 1 : 2);
  return [...counts]
    .filter(([, c]) => c >= min)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi'))
    .slice(0, opts.limit ?? 30)
    .map(([phrase, count]) => ({ phrase, count, density: (count * n * 100) / total }));
}

/** Đếm số lần một cụm từ khoá (không phân biệt hoa thường, khớp trọn từ) xuất hiện */
export function countPhrase(raw: string, phrase: string): KeywordRow {
  const target = wordsOf(phrase).map(norm);
  const ws = wordsOf(raw).map(norm);
  let count = 0;
  if (target.length) {
    for (let i = 0; i + target.length <= ws.length; i++) {
      if (target.every((t, k) => ws[i + k] === t)) count++;
    }
  }
  return { phrase: target.join(' '), count, density: ws.length ? (count * target.length * 100) / ws.length : 0 };
}

/** "3 phút 20 giây" */
export function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec} giây`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h && `${h} giờ`, m && `${m} phút`, !h && s && `${s} giây`].filter(Boolean).join(' ');
}
