/** Thẻ ghi nhớ: dữ liệu bộ thẻ, hộp ôn tập (Leitner), nhập/xuất CSV, câu hỏi trắc nghiệm. Phần thuần, không DOM. */

export interface Card { id: string; front: string; back: string; box: number; due: number }
export interface Deck { id: string; name: string; lang: string; cards: Card[] }

export const BOX_DAYS = [0, 1, 2, 4, 8, 16];
export const MAX_BOX = BOX_DAYS.length - 1;
const DAY = 86400000;

export const newId = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const makeCard = (front: string, back: string): Card => ({ id: newId(), front: front.trim(), back: back.trim(), box: 0, due: 0 });

/** Tách một dòng: tab, " - ", " | ", " ; ", dấu phẩy (khi không có dấu khác) */
export function splitLine(line: string): [string, string] | null {
  const l = line.trim();
  if (!l) return null;
  for (const sep of ['\t', ' | ', ' - ', ' – ', ' — ', ';', ' : ', ':']) {
    const i = l.indexOf(sep);
    if (i > 0) {
      const a = l.slice(0, i).trim();
      const b = l.slice(i + sep.length).trim();
      if (a && b) return [a, b];
    }
  }
  return null;
}

/** Dán nhiều dòng "mặt trước - mặt sau". Trả về thẻ hợp lệ và số dòng bị bỏ qua */
export function parseBulk(text: string): { cards: Card[]; skipped: number } {
  const cards: Card[] = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const p = splitLine(line);
    if (p) cards.push(makeCard(p[0], p[1]));
    else skipped++;
  }
  return { cards, skipped };
}

export function toCsv(cards: Pick<Card, 'front' | 'back'>[]): string {
  const q = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return cards.map((c) => `${q(c.front)},${q(c.back)}`).join('\r\n');
}

/** Đọc CSV 2 cột (có thể có ngoặc kép, dấu phẩy hoặc chấm phẩy hoặc tab làm phân cách) */
export function parseCsv(text: string): { cards: Card[]; skipped: number } {
  const t = text.replace(/^﻿/, '');
  const first = t.split(/\r?\n/)[0] || '';
  const sep = first.includes('\t') ? '\t' : !first.includes(',') && first.includes(';') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inQ) {
      if (ch === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      rows.push(row); row = [];
    } else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const cards: Card[] = [];
  let skipped = 0;
  for (const r of rows) {
    if (r.every((c) => !c.trim())) continue;
    if (r.length >= 2 && r[0].trim() && r[1].trim()) cards.push(makeCard(r[0], r[1]));
    else skipped++;
  }
  return { cards, skipped };
}

export const isDue = (c: Card, now: number): boolean => c.due <= now;

/** Hàng đợi học: thẻ đến hạn, thẻ ở hộp thấp lên trước */
export function dueQueue(cards: Card[], now: number): Card[] {
  return cards.filter((c) => isDue(c, now)).sort((a, b) => a.box - b.box || a.due - b.due);
}

/** Cập nhật hộp sau khi trả lời: nhớ → lên hộp, quên → về hộp đầu và học lại ngay */
export function review(c: Card, known: boolean, now: number): Card {
  if (!known) return { ...c, box: 0, due: 0 };
  const box = Math.min(MAX_BOX, c.box + 1);
  return { ...c, box, due: now + BOX_DAYS[box] * DAY };
}

export function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface QuizQ { card: Card; options: string[]; answer: number }

/** Câu trắc nghiệm: chọn nghĩa đúng trong 4 đáp án (cần ít nhất 4 thẻ có nghĩa khác nhau) */
export function makeQuiz(cards: Card[], count: number, rnd: () => number = Math.random): QuizQ[] {
  const backs = [...new Set(cards.map((c) => c.back))];
  if (backs.length < 4) return [];
  return shuffle(cards, rnd).slice(0, count).map((card) => {
    const wrong = shuffle(backs.filter((b) => b !== card.back), rnd).slice(0, 3);
    const options = shuffle([card.back, ...wrong], rnd);
    return { card, options, answer: options.indexOf(card.back) };
  });
}

export function deckStats(cards: Card[], now: number): { total: number; due: number; learned: number } {
  return { total: cards.length, due: cards.filter((c) => isDue(c, now)).length, learned: cards.filter((c) => c.box >= 3).length };
}
