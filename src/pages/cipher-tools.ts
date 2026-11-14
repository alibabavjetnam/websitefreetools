import { mountLayout } from '../layout';
import { $ } from '../ui';
import { pageText } from '../i18n';
import { area, input, select, button, bindCopy, dk, el, privacyNote, val, setVal, onChange, utf8, fromUtf8, toHex, fromHex, showError, errorBox } from '../lib/devkit';
import { caesar, rot13, vigenere, atbash, toMorse, fromMorse, toBinary, fromBinary } from '../calc/encoding';

mountLayout({ activeTool: 'cipher-tools' });
const T = pageText();

$('#tool-root').innerHTML = `
  <div class="panel" style="margin-top:24px">
    <div class="form-grid">
      ${select('kind', T('kind', 'Kiểu mã'), [['caesar', T('k.caesar', 'Mật mã Caesar (dịch chữ)')], ['rot13', 'ROT13'], ['vigenere', T('k.vig', 'Mật mã Vigenère (theo từ khoá)')], ['atbash', T('k.atbash', 'Atbash (đảo bảng chữ)')], ['morse', T('k.morse', 'Mã Morse')], ['binary', T('k.bin', 'Nhị phân (0 và 1)')], ['hex', T('k.hex', 'Hệ thập lục phân (hex)')], ['reverse', T('k.rev', 'Viết ngược chuỗi')]], 'caesar')}
      <div id="opt-shift">${input('shift', T('shift', 'Số bước dịch'), { type: 'number', value: '3', attrs: 'min="-25" max="25"' })}</div>
      <div id="opt-key" hidden>${input('vkey', T('vkey', 'Từ khoá'), { value: 'WFTOOLS' })}</div>
    </div>
    <div class="workspace" style="margin-top:0">
      ${area('in', T('plain', 'Văn bản gốc'), { rows: 9, mono: false, value: T('sample', 'Hello World') })}
      ${area('out', T('coded', 'Văn bản đã mã'), { rows: 9 })}
    </div>
    ${errorBox('err')}
    <div class="row">${button('enc', T('encode', 'Mã hoá →'), true)}${button('dec', T('decode', '← Giải mã'))}${button('copy', dk.copy())}</div>
    <p class="note">${T('note', 'Caesar, ROT13, Vigenère, Atbash chỉ đổi chữ cái A-Z, giữ nguyên số và dấu. Morse bỏ dấu tiếng Việt trước khi mã. Các mã này dùng để học và giải đố, không đủ an toàn để bảo vệ dữ liệu thật.')}</p>
  </div>
  ${privacyNote()}
`;
const kind = () => val('kind');
function opts(): void {
  el('opt-shift').hidden = kind() !== 'caesar';
  el('opt-key').hidden = kind() !== 'vigenere';
}
function run(dir: 'enc' | 'dec'): void {
  showError('err', '');
  const src = dir === 'enc' ? val('in') : val('out');
  let r = '';
  try {
    switch (kind()) {
      case 'caesar': r = caesar(src, (Number(val('shift')) || 0) * (dir === 'enc' ? 1 : -1)); break;
      case 'rot13': r = rot13(src); break;
      case 'vigenere': r = vigenere(src, val('vkey'), dir === 'dec'); break;
      case 'atbash': r = atbash(src); break;
      case 'morse': r = dir === 'enc' ? toMorse(src) : fromMorse(src); break;
      case 'binary': r = dir === 'enc' ? toBinary(utf8(src)) : fromUtf8(fromBinary(src)); break;
      case 'hex': r = dir === 'enc' ? toHex(utf8(src)).replace(/(..)(?!$)/g, '$1 ') : fromUtf8(fromHex(src)); break;
      case 'reverse': r = [...src].reverse().join(''); break;
    }
  } catch {
    showError('err', T('bad', 'Không giải mã được: dữ liệu không đúng định dạng của kiểu mã đã chọn.'));
    return;
  }
  setVal(dir === 'enc' ? 'out' : 'in', r);
}
onChange(['kind'], () => { opts(); run('enc'); }, 10);
onChange(['in', 'shift', 'vkey'], () => run('enc'), 80);
el('enc').addEventListener('click', () => run('enc'));
el('dec').addEventListener('click', () => run('dec'));
bindCopy('copy', () => val('out'));
opts();
run('enc');
