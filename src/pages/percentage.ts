import { mountLayout } from '../layout';
import { $, parseNumber, storage } from '../ui';
import { pageText, localeTag } from '../i18n';

mountLayout({ activeTool: 'percentage' });
const T = pageText();
const LOCALE = localeTag();

const fmt = (n: number, max = 4) => (Number.isFinite(n) ? n.toLocaleString(LOCALE, { maximumFractionDigits: max }) : '—');

interface Calc {
  id: string;
  title: string;
  /** Câu hỏi có ô nhập: {a} {b} là vị trí ô */
  q: string;
  run: (a: number, b: number) => { value: string; formula: string; extra?: string } | null;
}

const CALCS: Calc[] = [
  {
    id: 'of', title: T('of.title', 'Tính X% của một số'), q: T('of.q', '{a} % của {b} là bao nhiêu?'),
    run: (a, b) => ({ value: fmt((a * b) / 100), formula: `${fmt(a)} × ${fmt(b)} ÷ 100 = ${fmt((a * b) / 100)}` }),
  },
  {
    id: 'what', title: T('what.title', 'Một số là bao nhiêu % của số khác'), q: T('what.q', '{a} là bao nhiêu % của {b}?'),
    run: (a, b) => (b === 0 ? null : { value: `${fmt((a / b) * 100)}%`, formula: `${fmt(a)} ÷ ${fmt(b)} × 100 = ${fmt((a / b) * 100)}%` }),
  },
  {
    id: 'change', title: T('change.title', 'Phần trăm tăng / giảm'), q: T('change.q', 'Từ {a} thành {b} thì thay đổi bao nhiêu %?'),
    run: (a, b) => {
      if (a === 0) return null;
      const p = ((b - a) / Math.abs(a)) * 100;
      return {
        value: `${p > 0 ? '+' : ''}${fmt(p)}%`,
        formula: `(${fmt(b)} − ${fmt(a)}) ÷ |${fmt(a)}| × 100 = ${fmt(p)}%`,
        extra: p > 0 ? T('up', 'Tăng') + ` ${fmt(b - a)}` : p < 0 ? T('down', 'Giảm') + ` ${fmt(a - b)}` : T('same', 'Không đổi'),
      };
    },
  },
  {
    id: 'whole', title: T('whole.title', 'Tìm số gốc khi biết phần trăm'), q: T('whole.q', '{a} là {b} % của số nào?'),
    run: (a, b) => (b === 0 ? null : { value: fmt((a * 100) / b), formula: `${fmt(a)} × 100 ÷ ${fmt(b)} = ${fmt((a * 100) / b)}` }),
  },
  {
    id: 'add', title: T('add.title', 'Cộng thêm phần trăm (thuế, tăng giá)'), q: T('add.q', '{a} cộng thêm {b} % là bao nhiêu?'),
    run: (a, b) => ({ value: fmt(a * (1 + b / 100)), formula: `${fmt(a)} × (1 + ${fmt(b)} ÷ 100) = ${fmt(a * (1 + b / 100))}`, extra: `${T('added', 'Phần tăng thêm')}: ${fmt((a * b) / 100)}` }),
  },
  {
    id: 'sale', title: T('sale.title', 'Giá sau giảm giá'), q: T('sale.q', 'Giá {a} giảm {b} % còn bao nhiêu?'),
    run: (a, b) => ({ value: fmt(a * (1 - b / 100)), formula: `${fmt(a)} × (1 − ${fmt(b)} ÷ 100) = ${fmt(a * (1 - b / 100))}`, extra: `${T('saved', 'Tiết kiệm được')}: ${fmt((a * b) / 100)}` }),
  },
  {
    id: 'before', title: T('before.title', 'Giá gốc trước khi giảm'), q: T('before.q', 'Giá sau khi giảm {b} % là {a}, giá gốc là bao nhiêu?'),
    run: (a, b) => (b >= 100 ? null : { value: fmt(a / (1 - b / 100)), formula: `${fmt(a)} ÷ (1 − ${fmt(b)} ÷ 100) = ${fmt(a / (1 - b / 100))}` }),
  },
  {
    id: 'diff', title: T('diff.title', 'Chênh lệch phần trăm giữa hai số'), q: T('diff.q', 'Hai số {a} và {b} chênh nhau bao nhiêu %?'),
    run: (a, b) => {
      const avg = (Math.abs(a) + Math.abs(b)) / 2;
      if (avg === 0) return null;
      const p = (Math.abs(a - b) / avg) * 100;
      return { value: `${fmt(p)}%`, formula: `|${fmt(a)} − ${fmt(b)}| ÷ ((${fmt(a)} + ${fmt(b)}) ÷ 2) × 100 = ${fmt(p)}%` };
    },
  },
];

const saved = storage<Record<string, [string, string]>>('percentage', {});
const vals = saved.get();
const DEF: Record<string, [string, string]> = { of: ['15', '200'], what: ['30', '120'], change: ['80', '100'], whole: ['45', '15'], add: ['100', '10'], sale: ['500', '20'], before: ['400', '20'], diff: ['90', '110'] };

const input = (id: string, k: 'a' | 'b', v: string) =>
  `<input type="text" inputmode="decimal" class="input-inline" data-c="${id}" data-k="${k}" value="${v}" aria-label="${k === 'a' ? 'A' : 'B'}" style="width:110px" />`;

$('#tool-root').innerHTML = `
  <div class="fields" style="margin-top:28px">
    ${CALCS.map((c) => {
      const [a, b] = vals[c.id] ?? DEF[c.id];
      return `<section class="panel" data-card="${c.id}">
        <div class="panel-title" style="margin:0">${c.title}</div>
        <div class="row" style="font-size:1.0625rem">${c.q.replace('{a}', input(c.id, 'a', a)).replace('{b}', input(c.id, 'b', b))}</div>
        <div class="row" style="align-items:baseline"><span class="stat-value" data-out="${c.id}" style="font-size:1.6rem;font-weight:700"></span><span class="note" data-extra="${c.id}"></span></div>
        <div class="formula" data-f="${c.id}"></div>
      </section>`;
    }).join('')}
  </div>
`;

function run(id: string): void {
  const c = CALCS.find((x) => x.id === id) as Calc;
  const a = $<HTMLInputElement>(`[data-c="${id}"][data-k="a"]`);
  const b = $<HTMLInputElement>(`[data-c="${id}"][data-k="b"]`);
  vals[id] = [a.value, b.value];
  saved.set(vals);
  const na = parseNumber(a.value);
  const nb = parseNumber(b.value);
  const out = $(`[data-out="${id}"]`);
  if (!Number.isFinite(na) || !Number.isFinite(nb) || a.value.trim() === '' || b.value.trim() === '') {
    out.textContent = '—';
    $(`[data-f="${id}"]`).textContent = T('enter', 'Nhập đủ hai số.');
    $(`[data-extra="${id}"]`).textContent = '';
    return;
  }
  const r = c.run(na, nb);
  out.textContent = r ? r.value : '—';
  $(`[data-f="${id}"]`).textContent = r ? r.formula : T('noResult', 'Không tính được (chia cho 0).');
  $(`[data-extra="${id}"]`).textContent = r?.extra ?? '';
}

$('#tool-root').addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.dataset.c) run(el.dataset.c);
});
CALCS.forEach((c) => run(c.id));
