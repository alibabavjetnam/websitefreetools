import { mountLayout } from '../layout';
import { $, copyText } from '../ui';
import { pageText } from '../i18n';
import { input, select, el, privacyNote, val, setVal, showError, errorBox } from '../lib/devkit';
import { parseBase, toBase, twosComplement } from '../calc/devconv';

mountLayout({ activeTool: 'number-base' });
const T = pageText();
const BASES: [string, number, string][] = [['bin', 2, T('b.bin', 'Nhị phân (cơ số 2)')], ['oct', 8, T('b.oct', 'Bát phân (cơ số 8)')], ['dec', 10, T('b.dec', 'Thập phân (cơ số 10)')], ['hex', 16, T('b.hex', 'Thập lục phân (cơ số 16)')]];

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px">
    ${BASES.map(([id, , l]) => `<div class="field-row">${input(id, l, { mono: true, value: id === 'dec' ? '255' : '' })}<button type="button" class="btn btn-sm" data-copy="${id}" style="align-self:flex-end">${T('copy', 'Sao chép')}</button></div>`).join('')}
    <div class="field-row">${input('cus', T('custom', 'Cơ số tuỳ chọn'), { mono: true })}${input('cusBase', T('base', 'Cơ số (2-36)'), { type: 'number', value: '36', attrs: 'min="2" max="36"' })}</div>
    ${errorBox('err')}
  </div>
  <div class="panel" style="margin-top:16px">
    <h2 class="panel-title">${T('twos', 'Số có dấu (bù hai)')}</h2>
    ${select('bits', T('bits', 'Số bit'), [['8', '8 bit'], ['16', '16 bit'], ['32', '32 bit'], ['64', '64 bit']], '8')}
    <pre class="output" id="twos"></pre>
    <p class="note">${T('note', 'Nhập ở ô nào cũng được, các ô còn lại tự đổi theo. Hỗ trợ số rất lớn (không giới hạn chữ số), số âm và tiền tố 0x, 0b, 0o. Có thể dùng dấu _ hoặc dấu cách để ngăn nhóm chữ số.')}</p>
  </div>
  ${privacyNote()}
`;
let value: bigint | null = 255n;
function render(except: string): void {
  for (const [id, b] of BASES) if (id !== except) setVal(id, value == null ? '' : toBase(value, b));
  if (except !== 'cus') setVal('cus', value == null ? '' : toBase(value, Math.min(36, Math.max(2, Number(val('cusBase')) || 36))));
  const bits = Number(val('bits'));
  if (value == null) { el('twos').textContent = ''; return; }
  const lim = 1n << BigInt(bits - 1);
  el('twos').textContent = value >= -lim && value < lim * 2n
    ? `${twosComplement(value, bits).replace(/(.{4})(?!$)/g, '$1 ')}\nhex: ${toBase(BigInt('0b' + twosComplement(value, bits)), 16).padStart(bits / 4, '0')}`
    : T('overflow', 'Giá trị vượt quá phạm vi {b} bit.').replace('{b}', String(bits));
}
function from(id: string, base: number): void {
  showError('err', '');
  const s = val(id).trim();
  if (!s) { value = null; render(id); return; }
  try { value = parseBase(s, base); render(id); }
  catch { showError('err', T('bad', 'Có chữ số không hợp lệ cho cơ số {b}. Ví dụ nhị phân chỉ gồm 0 và 1, hex gồm 0-9 và A-F.').replace('{b}', String(base))); }
}
for (const [id, b] of BASES) el(id).addEventListener('input', () => from(id, b));
el('cus').addEventListener('input', () => from('cus', Number(val('cusBase')) || 36));
el('cusBase').addEventListener('input', () => render(''));
el('bits').addEventListener('change', () => render(''));
document.querySelectorAll<HTMLElement>('[data-copy]').forEach((b) => b.addEventListener('click', () => void copyText(val(b.dataset.copy as string))));
render('');
