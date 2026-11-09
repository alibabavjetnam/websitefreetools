// Sinh src/btn-icons.json: khoá chuỗi dịch → tên biểu tượng nút, dựa trên chữ tiếng Việt gốc (public/language/vi.json)
// và luật trong src/btn-icon-rules.json. Chạy: node scripts/btn-icons.mjs
import fs from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const vi = JSON.parse(fs.readFileSync(root + 'public/language/vi.json', 'utf8'));
const rules = JSON.parse(fs.readFileSync(root + 'src/btn-icon-rules.json', 'utf8')).map(([n, r]) => [n, new RegExp(r, 'u')]);
export const normVi = (s) => s.normalize('NFC').toLowerCase().trim()
  .replace(/òa/g, 'oà').replace(/óa/g, 'oá').replace(/ỏa/g, 'oả').replace(/õa/g, 'oã').replace(/ọa/g, 'oạ')
  .replace(/ùy/g, 'uỳ').replace(/úy/g, 'uý').replace(/ủy/g, 'uỷ').replace(/ũy/g, 'uỹ').replace(/ụy/g, 'uỵ');
const pick = (v) => {
  if (typeof v !== 'string' || v.length > 40 || /[.!?:]$/.test(v.trim()) && v.length > 20) return null;
  const s = normVi(v);
  for (const [n, r] of rules) if (r.test(s)) return n;
  return null;
};
const out = { ui: {}, s: {} };
for (const [k, v] of Object.entries(vi.ui)) { const n = pick(v); if (n) out.ui[k] = n; }
for (const [tool, m] of Object.entries(vi.s)) for (const [k, v] of Object.entries(m)) {
  const n = pick(v); if (n) (out.s[tool] ||= {})[k] = n;
}
fs.writeFileSync(root + 'src/btn-icons.json', JSON.stringify(out));
const cnt = Object.keys(out.ui).length + Object.values(out.s).reduce((a, m) => a + Object.keys(m).length, 0);
console.log('btn-icons:', cnt, 'keys,', fs.statSync(root + 'src/btn-icons.json').size, 'bytes');
