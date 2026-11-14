import { mountLayout } from '../layout';
import { $ } from '../ui';
import { pageText, currentLang } from '../i18n';
import { area, input, select, button, check, bindCopy, bindDownload, dk, el, privacyNote, val, setVal, checked, onChange } from '../lib/devkit';
import { FAKE, type FakeLocale } from '../data/fakedata';
import { stripMarks } from '../calc/encoding';

mountLayout({ activeTool: 'fake-data' });
const T = pageText();
const FIELDS: [string, string][] = [
  ['id', 'ID'], ['name', T('f.name', 'Họ tên')], ['email', 'Email'], ['phone', T('f.phone', 'Điện thoại')], ['address', T('f.address', 'Địa chỉ')], ['city', T('f.city', 'Thành phố')],
  ['company', T('f.company', 'Công ty')], ['birthday', T('f.birthday', 'Ngày sinh')], ['age', T('f.age', 'Tuổi')], ['uuid', 'UUID'], ['ip', 'IPv4'], ['url', 'Website'], ['active', T('f.active', 'Đang hoạt động (true/false)')], ['amount', T('f.amount', 'Số tiền')],
];
const DEF = ['id', 'name', 'email', 'phone', 'city', 'birthday'];
const LOC = FAKE[currentLang()] ? currentLang() : 'en';

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px">
    <div class="form-grid">
      ${select('loc', T('loc', 'Dữ liệu theo nước'), [['vi', T('l.vi', 'Việt Nam')], ['en', T('l.en', 'Mỹ')], ['ja', T('l.ja', 'Nhật Bản')], ['zh', T('l.zh', 'Trung Quốc')], ['es', T('l.es', 'Tây Ban Nha')], ['de', T('l.de', 'Đức')]], LOC)}
      ${input('rows', T('rows', 'Số dòng'), { type: 'number', value: '10', attrs: 'min="1" max="5000"' })}
      ${select('fmt', T('fmt', 'Định dạng'), [['json', 'JSON'], ['csv', 'CSV'], ['sql', 'SQL INSERT'], ['tsv', T('f.tsv', 'Bảng (dán vào Excel)')]], 'json')}
      ${input('table', T('table', 'Tên bảng SQL'), { value: 'users', mono: true })}
    </div>
    <div class="field"><span class="field-label">${T('fields', 'Các trường')}</span><div class="row" id="fields">${FIELDS.map(([k, l]) => check('c-' + k, l, DEF.includes(k))).join('')}</div></div>
    <div class="row">${button('gen', dk.generate(), true)}${button('copy', dk.copy())}${button('dl', dk.download())}</div>
    ${area('out', dk.output(), { rows: 16, ro: true })}
    <p class="note">${T('note', 'Dữ liệu được tạo ngẫu nhiên, chỉ dùng để thử nghiệm phần mềm, làm mẫu giao diện, nhập thử cơ sở dữ liệu. Mọi trùng hợp với người thật là ngẫu nhiên.')}</p>
  </div>
  ${privacyNote()}
`;
const pick = <X>(a: X[]): X => a[Math.floor(Math.random() * a.length)];
const int = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const digits = (p: string) => p.replace(/#/g, () => String(int(0, 9)));
const slug = (s: string) => stripMarks(s).toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
function row(L: FakeLocale, i: number): Record<string, unknown> {
  const f = pick(L.first), l = pick(L.last);
  const name = L.order === 'fl' ? `${f} ${l}` : /^[぀-鿿]/.test(l) ? `${l}${f}` : `${l} ${f}`;
  const ascii = slug(`${L.order === 'fl' ? f : f} ${l.split(' ')[0]}`) || `user${i}`;
  const bd = new Date(int(1960, 2006), int(0, 11), int(1, 28));
  const r: Record<string, unknown> = {
    id: i + 1, name, email: `${/^[a-z]/.test(ascii) ? ascii : 'user' + int(100, 999)}${int(1, 99)}@${pick(L.domain)}`, phone: digits(L.phone),
    address: L.order === 'fl' ? `${int(1, 999)} ${pick(L.streets)}` : L.tld === 'vn' ? `${int(1, 300)} ${pick(L.streets)}` : `${pick(L.streets)}${L.tld === 'cn' ? int(1, 300) + '号' : ''}`,
    city: pick(L.cities), company: pick(L.company), birthday: bd.toISOString().slice(0, 10), age: new Date().getFullYear() - bd.getFullYear(),
    uuid: crypto.randomUUID(), ip: `${int(1, 223)}.${int(0, 255)}.${int(0, 255)}.${int(1, 254)}`, url: `https://${slug(l.split(' ')[0]) || 'site' + int(1, 99)}${int(1, 99)}.example.${L.tld}`,
    active: Math.random() < 0.7, amount: Math.round(Math.random() * 100000) / 100,
  };
  return Object.fromEntries(FIELDS.filter(([k]) => checked('c-' + k)).map(([k]) => [k, r[k]]));
}
const csvCell = (v: unknown, sep: string) => { const s = String(v); return s.includes(sep) || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
function gen(): void {
  const L = FAKE[val('loc')];
  const n = Math.min(5000, Math.max(1, Number(val('rows')) || 1));
  const data = Array.from({ length: n }, (_, i) => row(L, i));
  const keys = Object.keys(data[0] ?? {});
  const f = val('fmt');
  if (f === 'json') setVal('out', JSON.stringify(data, null, 2));
  else if (f === 'csv' || f === 'tsv') { const s = f === 'csv' ? ',' : '\t'; setVal('out', [keys.join(s), ...data.map((d) => keys.map((k) => csvCell(d[k], s)).join(s))].join('\n')); }
  else {
    const tb = val('table').replace(/[^\w]/g, '') || 'users';
    const lit = (v: unknown) => (typeof v === 'number' ? String(v) : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : `'${String(v).replace(/'/g, "''")}'`);
    setVal('out', data.map((d) => `INSERT INTO ${tb} (${keys.join(', ')}) VALUES (${keys.map((k) => lit(d[k])).join(', ')});`).join('\n'));
  }
}
el('gen').addEventListener('click', gen);
onChange(['loc', 'rows', 'fmt', 'table', ...FIELDS.map(([k]) => 'c-' + k)], gen, 120);
bindCopy('copy', () => val('out'));
bindDownload('dl', () => (val('fmt') === 'csv' ? '﻿' : '') + val('out'), () => `fake-data.${({ json: 'json', csv: 'csv', sql: 'sql', tsv: 'tsv' } as Record<string, string>)[val('fmt')]}`);
gen();
